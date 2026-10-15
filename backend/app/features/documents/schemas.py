"""API models for the document catalog. JSON uses camelCase to match the frontend."""

from typing import Literal

from app.features.chat.schemas import CamelModel


class Run(CamelModel):
    text: str
    bold: bool = False


class DocBlock(CamelModel):
    """One line of a template. `heading` is a top-level section, `clause` a numbered clause."""

    kind: Literal["title", "heading", "clause"]
    indent: int = 0
    runs: list[Run]


class FieldInfo(CamelModel):
    """A value the user supplies: a named term the template refers to (e.g. "Provider")."""

    key: str
    label: str
    hint: str  # short guidance on what to enter
    context: str  # a sentence from the template that uses the term
    group: str


class DocumentSummary(CamelModel):
    id: str
    name: str
    description: str
    # "nda" has its own dedicated form and cover page; "generic" documents use key terms.
    kind: Literal["nda", "generic"]


class DocumentDetail(DocumentSummary):
    fields: list[FieldInfo]
    blocks: list[DocBlock]
