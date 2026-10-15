import pytest
from fastapi.testclient import TestClient

from app.features.documents import registry
from app.features.documents.parser import base_term, extract_fields, parse_blocks

SAMPLE = (
    "# Sample Agreement\n\n"
    '1. <span class="header_2" id="1">Services</span>\n'
    '    1. <span class="header_3" id="1.1">Delivery.</span>  '
    '<span class="coverpage_link">Provider</span> will deliver to '
    '<span class="coverpage_link">Customer</span> during the '
    '<span class="orderform_link">Subscription Period</span>. See [terms](https://example.com).\n'
    '    2. <span class="coverpage_link">Provider’s</span> duty ends after the '
    '<span class="orderform_link">Subscription Periods</span> expire; **Customer** pays.\n'
    '        a. Nested <span class="keyterms_link">Provider</span> item.\n'
)


def test_base_term_strips_possessives() -> None:
    assert base_term("Provider’s") == "Provider"
    assert base_term("Customer's") == "Customer"
    assert base_term("Governing Law") == "Governing Law"


def test_parse_blocks_structure_and_indent() -> None:
    blocks = parse_blocks(SAMPLE)
    assert [b.kind for b in blocks] == ["title", "heading", "clause", "clause", "clause"]
    assert [b.indent for b in blocks] == [0, 0, 1, 1, 2]
    assert blocks[0].runs[0].text == "Sample Agreement"


def test_parse_blocks_keeps_numbering_and_bolds_headings() -> None:
    heading = parse_blocks(SAMPLE)[1]
    assert heading.runs[0].text == "1. "
    assert any(r.text == "Services" and r.bold for r in heading.runs)


def test_parse_blocks_has_no_markup_left() -> None:
    text = "".join(r.text for b in parse_blocks(SAMPLE) for r in b.runs)
    assert "<span" not in text and "](" not in text and "**" not in text
    assert "terms" in text and "Customer" in text


def test_id_only_anchor_spans_are_dropped() -> None:
    md = (
        "# T\n\n"
        '1. <span id="1.1"></span>"Term" means <span class="keyterms_link">Provider</span>.\n'
    )
    blocks = parse_blocks(md)
    assert "".join(r.text for r in blocks[1].runs) == '1. "Term" means Provider.'
    assert [f.key for f in extract_fields(md)] == ["Provider"]


def test_extract_fields_dedupes_terms_and_merges_possessives_and_plurals() -> None:
    fields = extract_fields(SAMPLE)
    assert [f.key for f in fields] == ["Provider", "Customer", "Subscription Period"]
    by_key = {f.key: f for f in fields}
    assert by_key["Provider"].group == "Cover page"
    assert by_key["Subscription Period"].group == "Order form"
    assert "Subscription Period" in by_key["Subscription Period"].context
    assert by_key["Provider"].hint  # common terms get a hint


def test_extract_fields_headings_are_not_fields() -> None:
    assert "Services" not in {f.key for f in extract_fields(SAMPLE)}


def test_registry_has_all_catalog_documents() -> None:
    ids = {d.id for d in registry.list_documents()}
    assert ids == {
        "mutual-nda",
        "csa",
        "design-partner-agreement",
        "sla",
        "psa",
        "dpa",
        "software-license-agreement",
        "partnership-agreement",
        "baa",
        "pilot-agreement",
        "ai-addendum",
    }


@pytest.mark.parametrize("doc_id", sorted(registry._load().keys() - {"mutual-nda"}))
def test_every_generic_template_parses_cleanly(doc_id: str) -> None:
    doc = registry.get_document(doc_id)
    assert doc is not None
    assert doc.kind == "generic" and doc.fields and len(doc.blocks) > 10
    assert doc.blocks[0].kind == "title"
    text = "".join(r.text for b in doc.blocks for r in b.runs)
    assert "<span" not in text and "class=" not in text
    keys = [f.key for f in doc.fields]
    assert len(keys) == len(set(keys))  # no duplicate fields
    assert not any(k.endswith(("'s", "’s")) for k in keys)  # no possessive duplicates


def test_known_fields_present() -> None:
    csa = registry.get_document("csa")
    assert csa is not None
    assert {"Provider", "Customer", "Governing Law", "Chosen Courts"} <= {f.key for f in csa.fields}


def test_documents_endpoint_lists_catalog(client: TestClient) -> None:
    docs = client.get("/api/documents").json()
    assert len(docs) == 11
    nda = next(d for d in docs if d["id"] == "mutual-nda")
    assert nda["kind"] == "nda" and nda["name"] == "Mutual Non-Disclosure Agreement"


def test_document_detail_endpoint(client: TestClient) -> None:
    detail = client.get("/api/documents/sla").json()
    assert detail["name"] == "Service Level Agreement"
    assert any(f["key"] == "Target Uptime" for f in detail["fields"])
    assert detail["blocks"][0]["kind"] == "title"


def test_document_detail_404s(client: TestClient) -> None:
    assert client.get("/api/documents/nope").status_code == 404
    assert client.get("/api/documents/mutual-nda").status_code == 404


def test_long_context_sentences_are_truncated() -> None:
    long = "word " * 100
    md = f'1. <span class="keyterms_link">Provider</span> {long}.\n'
    context = extract_fields(md)[0].context
    assert len(context) <= 240 and context.endswith("...")


def test_nda_cover_page_is_not_a_separate_document() -> None:
    names = [d.name for d in registry.list_documents()]
    assert not any("Cover Page" in n for n in names)
    assert names.count("Mutual Non-Disclosure Agreement") == 1
