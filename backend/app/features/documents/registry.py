"""The document catalog: catalog.json plus the parsed templates. Loaded once, then cached."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from app.config import settings
from app.features.documents.parser import extract_fields, parse_blocks
from app.features.documents.schemas import DocumentDetail, DocumentSummary

NDA_ID = "mutual-nda"
# The NDA cover page is part of the NDA document, not a separate document.
_SKIP_FILES = {"Mutual-NDA-coverpage.md"}


def _doc_id(filename: str) -> str:
    stem = Path(filename).stem.lower()
    return NDA_ID if stem == "mutual-nda" else stem


def _title(name: str) -> str:
    return name.removesuffix(" (Standard Terms)")


@lru_cache(maxsize=1)
def _load() -> dict[str, DocumentDetail]:
    catalog = json.loads(settings.catalog_path.read_text(encoding="utf8"))
    docs: dict[str, DocumentDetail] = {}
    for entry in catalog:
        filename = Path(entry["filename"]).name
        if filename in _SKIP_FILES:
            continue
        doc_id = _doc_id(filename)
        kind: Literal["nda", "generic"] = "nda" if doc_id == NDA_ID else "generic"
        markdown = (settings.templates_dir / filename).read_text(encoding="utf8")
        docs[doc_id] = DocumentDetail(
            id=doc_id,
            name=_title(entry["name"]),
            description=entry["description"],
            kind=kind,
            fields=[] if kind == "nda" else extract_fields(markdown),
            blocks=[] if kind == "nda" else parse_blocks(markdown),
        )
    return docs


def list_documents() -> list[DocumentSummary]:
    return [
        DocumentSummary(id=d.id, name=d.name, description=d.description, kind=d.kind)
        for d in _load().values()
    ]


def get_document(doc_id: str) -> DocumentDetail | None:
    return _load().get(doc_id)
