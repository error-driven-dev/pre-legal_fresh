"""Request/response models for the NDA chat. JSON uses camelCase to match the frontend."""

from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PartyUpdate(CamelModel):
    name: str | None = None
    title: str | None = None
    company: str | None = None
    notice_address: str | None = None
    date: str | None = None  # ISO date, YYYY-MM-DD


class NdaFieldsUpdate(CamelModel):
    """Mutual NDA cover page fields. Every field is optional: absent means "unchanged"."""

    purpose: str | None = None
    effective_date: str | None = None  # ISO date, YYYY-MM-DD
    term_type: Literal["expires", "continues"] | None = None
    term_years: int | None = None
    confidentiality_type: Literal["years", "perpetuity"] | None = None
    confidentiality_years: int | None = None
    governing_law: str | None = None  # a US state, e.g. "Delaware"
    jurisdiction: str | None = None  # city or county and state, e.g. "New Castle, DE"
    modifications: str | None = None
    party1: PartyUpdate | None = None
    party2: PartyUpdate | None = None


class ChatMessage(CamelModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(CamelModel):
    messages: list[ChatMessage]
    document: NdaFieldsUpdate  # the fields as they currently stand in the document


class ChatResponse(CamelModel):
    """Also the structured output the model must produce."""

    reply: str
    fields: NdaFieldsUpdate
