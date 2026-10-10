"""Builds the prompt, calls the model, and parses its structured answer."""

import json
import re
from datetime import date

from pydantic import ValidationError

from app.features.chat.llm import LlmClient, LlmError
from app.features.chat.schemas import ChatRequest, ChatResponse

SYSTEM_PROMPT = """You are a friendly assistant that helps a user draft a Mutual Non-Disclosure \
Agreement (MNDA) by chatting with them. Today's date is {today}.

You fill in these cover page fields from what the user tells you:
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

Current document fields (JSON; null means not filled in yet):
{document}

Rules:
- Reply with JSON only: {{"reply": "<message to the user>", "fields": {{...}}}}.
- In "fields", include ONLY fields the user's latest message set or changed. Use {{}} if none.
- Fill in EVERY field the user's message gives you, all at once. Your reply and "fields" must \
agree: never say you recorded something unless it is in "fields".
- Example. User: "Acme and Beta, Delaware law, courts in New Castle, DE, 2 year term". Answer:
{{"reply": "Got it. What is the purpose of sharing information?", "fields": {{"governingLaw": \
"Delaware", "jurisdiction": "New Castle, DE", "termType": "expires", "termYears": 2, \
"party1": {{"company": "Acme"}}, "party2": {{"company": "Beta"}}}}}}
- Never invent values the user has not given you. Ask instead.
- Ask for at most two or three things at a time, starting with what matters most: the parties, \
the purpose, governing law and jurisdiction, then the terms and dates.
- Briefly confirm what you filled in. When everything is complete, tell the user they can \
download the PDF.
- Only help with this Mutual NDA. Politely decline anything else."""

RETRY_PROMPT = (
    "That was not valid JSON for the required schema. "
    'Reply again with only {"reply": ..., "fields": {...}}.'
)


def build_messages(request: ChatRequest) -> list[dict[str, str]]:
    document = request.document.model_dump(by_alias=True, mode="json")
    system = SYSTEM_PROMPT.format(today=date.today().isoformat(), document=json.dumps(document))
    return [{"role": "system", "content": system}] + [
        {"role": m.role, "content": m.content} for m in request.messages
    ]


def parse_response(raw: str) -> ChatResponse:
    """Parse the model's text, tolerating a ```json code fence around it."""
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
    return ChatResponse.model_validate_json(text)


async def run_turn(client: LlmClient, request: ChatRequest) -> ChatResponse:
    """Run one chat turn; retries once if the model's answer does not match the schema."""
    messages = build_messages(request)
    schema = ChatResponse.model_json_schema(by_alias=True)
    for attempt in range(2):
        raw = await client.complete(messages, schema)
        try:
            return parse_response(raw)
        except ValidationError:
            if attempt == 1:
                break
            messages = [
                *messages,
                {"role": "assistant", "content": raw},
                {"role": "user", "content": RETRY_PROMPT},
            ]
    raise LlmError("The AI gave an answer I couldn't understand. Please try again.")
