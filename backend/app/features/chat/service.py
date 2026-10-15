"""Builds the prompt, calls the model, and parses and sanitizes its structured answer."""

import json
import re
from datetime import date

from pydantic import ValidationError

from app.features.chat.llm import LlmClient, LlmError
from app.features.chat.schemas import ChatRequest, ChatResponse, NdaFieldsUpdate
from app.features.documents import registry
from app.features.documents.schemas import DocumentDetail

PREAMBLE = """You are a friendly assistant that helps a user draft a legal agreement by chatting \
with them. Today's date is {today}. You can only draft these documents:
{catalog}

Reply with JSON only: {{"reply": "<message to the user>", "documentId": <id or null>, \
"fields": {{...}}, "values": {{...}}}}.
Rules:
- Never invent values the user has not given you. Ask instead.
- Ask for at most two or three things at a time, most important first.
- Fill in EVERY value the user's message gives you, all at once. Your reply and the filled \
values must agree: never say you recorded something unless it is in the JSON.
- Only help with drafting these documents. Politely decline anything else.
"""

SELECT_SECTION = """No document has been chosen yet. Work out which document the user needs.
- If one of the documents above fits, set "documentId" to its id, say briefly what it is, and \
ask the first one or two questions to start filling it in.
- If the user asks for a document we cannot draft (for example a lease, an employment \
agreement or a will), say plainly that you cannot generate that, name the closest document \
above and why it is close, and ask if they would like that one instead. Leave "documentId" \
null until they agree.
- If the request is unclear, ask what they are trying to accomplish.
- "fields" and "values" stay empty until a document is chosen."""

NDA_SECTION = """The user is drafting the Mutual NDA (documentId "{nda_id}"). Keep \
"documentId" as "{nda_id}" unless the user asks for a different document. Put field updates \
in "fields" and leave "values" empty. Fields:
- purpose: how Confidential Information may be used
- effectiveDate: ISO date YYYY-MM-DD
- termType: "expires" (MNDA ends after termYears years) or "continues" (until terminated)
- termYears: whole number of years
- confidentialityType: "years" (confidentialityYears years) or "perpetuity"
- confidentialityYears: whole number of years
- governingLaw: a US state, e.g. "Delaware"
- jurisdiction: city or county and state of the courts, e.g. "New Castle, DE"
- modifications: any changes to the standard terms
- party1 and party2: name, title, company, noticeAddress (email or postal), date (YYYY-MM-DD)

Current fields (JSON; null means not filled in yet):
{document}

Only include fields the user's latest message set or changed; use {{}} if none. Start with the \
parties, the purpose, governing law and jurisdiction, then terms and dates. When everything is \
complete, tell the user they can download the PDF.
Example. User: "Acme and Beta, Delaware law, courts in New Castle, DE, 2 year term". Answer:
{{"reply": "Got it. What is the purpose of sharing information?", "documentId": "{nda_id}", \
"fields": {{"governingLaw": "Delaware", "jurisdiction": "New Castle, DE", "termType": \
"expires", "termYears": 2, "party1": {{"company": "Acme"}}, "party2": {{"company": "Beta"}}}}, \
"values": {{}}}}"""

GENERIC_SECTION = """The user is drafting the "{name}" (documentId "{id}"). Keep "documentId" as \
"{id}" unless the user asks for a different document. Put value updates in "values", keyed by the \
exact field name below, and leave "fields" empty. Fields to fill in (name: guidance | where the \
template uses it):
{fields}

Current values (JSON; null means not filled in yet):
{values}

Only include values the user's latest message set or changed; use {{}} if none. Ask first for \
the parties, then dates and the most important commercial terms. Dates are YYYY-MM-DD. If a \
term does not apply, the user may say so: record "None" or "N/A". When everything is complete, \
tell the user they can download the PDF.
Example. User: "Acme provides to Beta, Delaware law". Answer:
{{"reply": "Got it. What is the effective date?", "documentId": "{id}", "fields": {{}}, \
"values": {{"Provider": "Acme", "Customer": "Beta", "Governing Law": "Delaware"}}}}"""

RETRY_PROMPT = (
    "That was not valid JSON for the required schema. "
    'Reply again with only {"reply": ..., "documentId": ..., "fields": {...}, "values": {...}}.'
)


def _catalog_text() -> str:
    return "\n".join(f'- id "{d.id}": {d.name}. {d.description}' for d in registry.list_documents())


def _generic_section(doc: DocumentDetail, current: dict[str, str | None]) -> str:
    lines = "\n".join(f"- {f.key}: {f.hint or 'see context'} | {f.context}" for f in doc.fields)
    values = {f.key: current.get(f.key) for f in doc.fields}
    return GENERIC_SECTION.format(name=doc.name, id=doc.id, fields=lines, values=json.dumps(values))


def build_system_prompt(request: ChatRequest) -> str:
    prompt = PREAMBLE.format(today=date.today().isoformat(), catalog=_catalog_text())
    doc = registry.get_document(request.document_id) if request.document_id else None
    if request.document_id == registry.NDA_ID:
        document = request.document.model_dump(by_alias=True, mode="json")
        return prompt + NDA_SECTION.format(nda_id=registry.NDA_ID, document=json.dumps(document))
    if doc:
        return prompt + _generic_section(doc, request.values)
    return prompt + SELECT_SECTION


def build_messages(request: ChatRequest) -> list[dict[str, str]]:
    return [{"role": "system", "content": build_system_prompt(request)}] + [
        {"role": m.role, "content": m.content} for m in request.messages
    ]


def parse_response(raw: str) -> ChatResponse:
    """Parse the model's text, tolerating a ```json code fence around it."""
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
    return ChatResponse.model_validate_json(text)


def sanitize(request: ChatRequest, response: ChatResponse) -> ChatResponse:
    """Drop anything the model returned that does not belong: unknown documents, fields for a
    different document, and values for unknown or blank keys."""
    known = {d.id for d in registry.list_documents()}
    document_id = response.document_id if response.document_id in known else None
    effective = document_id or request.document_id
    fields = response.fields if effective == registry.NDA_ID else NdaFieldsUpdate()
    values: dict[str, str | None] = {}
    doc = registry.get_document(effective) if effective else None
    if doc and doc.kind == "generic":
        allowed = {f.key for f in doc.fields}
        values = {
            k: v.strip() for k, v in response.values.items() if k in allowed and v and v.strip()
        }
    return ChatResponse(reply=response.reply, document_id=document_id, fields=fields, values=values)


async def run_turn(client: LlmClient, request: ChatRequest) -> ChatResponse:
    """Run one chat turn; retries once if the model's answer does not match the schema."""
    messages = build_messages(request)
    schema = ChatResponse.model_json_schema(by_alias=True)
    for attempt in range(2):
        raw = await client.complete(messages, schema)
        try:
            return sanitize(request, parse_response(raw))
        except ValidationError:
            if attempt == 1:
                break
            messages = [
                *messages,
                {"role": "assistant", "content": raw},
                {"role": "user", "content": RETRY_PROMPT},
            ]
    raise LlmError("The AI gave an answer I couldn't understand. Please try again.")
