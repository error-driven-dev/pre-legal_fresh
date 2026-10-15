from fastapi import APIRouter, HTTPException

from app.features.documents import registry
from app.features.documents.schemas import DocumentDetail, DocumentSummary

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("", response_model=list[DocumentSummary])
def list_documents() -> list[DocumentSummary]:
    return registry.list_documents()


@router.get("/{doc_id}", response_model=DocumentDetail)
def get_document(doc_id: str) -> DocumentDetail:
    """Fields and clauses of a generic document. The NDA has its own dedicated flow."""
    doc = registry.get_document(doc_id)
    if doc is None or doc.kind == "nda":
        raise HTTPException(status_code=404, detail="Unknown document.")
    return doc
