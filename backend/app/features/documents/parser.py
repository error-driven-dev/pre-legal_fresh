"""Parses a Common Paper template (markdown with <span> markers) into blocks and fields.

Template format: a `# Title` line, then numbered clauses indented 0/4/8/12 spaces. Spans mark
headings (`header_2`, `header_3`) and named terms (`*_link`) that the user supplies values for.
"""

import re
from collections import Counter

from app.features.documents.hints import GROUP_LABELS, HINTS
from app.features.documents.schemas import DocBlock, FieldInfo, Run

_SPAN = re.compile(r'<span class="([^"]+)"[^>]*>(.*?)</span>')
_ITEM = re.compile(r"^(\s*)((?:\d+|[a-zA-Z]|[ivxIVX]+)\.|\([a-zA-Z0-9]+\))\s+(.*)$")
# Anchor spans carrying only an id (e.g. <span id="4.1"></span>) have no visible meaning.
_PLAIN_SPAN = re.compile(r"<span(?![^>]*class=)[^>]*>(.*?)</span>")
_BOLD = re.compile(r"\*\*(.+?)\*\*")
_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_HEADING_CLASSES = {"header_2", "header_3"}


def base_term(term: str) -> str:
    """Strip a possessive: "Provider’s" -> "Provider"."""
    return re.sub(r"['’]s?$", "", term.strip())


def _inline(text: str) -> list[Run]:
    text = _PLAIN_SPAN.sub(r"\1", text)
    runs: list[Run] = []
    pos = 0
    for m in _SPAN.finditer(text):
        if m.start() > pos:
            runs.append(Run(text=text[pos : m.start()]))
        bold = m.group(1) in _HEADING_CLASSES
        runs.append(Run(text=m.group(2), bold=bold))
        pos = m.end()
    if pos < len(text):
        runs.append(Run(text=text[pos:]))
    # Plain markdown inside the remaining text runs.
    out: list[Run] = []
    for run in runs:
        text_ = _LINK.sub(r"\1", run.text)
        if run.bold:
            out.append(Run(text=text_, bold=True))
            continue
        p = 0
        for b in _BOLD.finditer(text_):
            if b.start() > p:
                out.append(Run(text=text_[p : b.start()]))
            out.append(Run(text=b.group(1), bold=True))
            p = b.end()
        if p < len(text_):
            out.append(Run(text=text_[p:]))
    return out


def parse_blocks(markdown: str) -> list[DocBlock]:
    blocks: list[DocBlock] = []
    for line in markdown.splitlines():
        if not line.strip():
            continue
        if line.startswith("# "):
            blocks.append(DocBlock(kind="title", runs=[Run(text=line[2:].strip(), bold=True)]))
            continue
        m = _ITEM.match(line)
        indent, label, body = (len(m.group(1)) // 4, m.group(2), m.group(3)) if m else (0, "", line)
        runs = _inline(body)
        if label:
            runs.insert(0, Run(text=f"{label} "))
        is_heading = indent == 0 and 'class="header_2"' in body
        blocks.append(
            DocBlock(kind="heading" if is_heading else "clause", indent=indent, runs=runs)
        )
    return blocks


def _plain(text: str) -> str:
    return _LINK.sub(r"\1", _SPAN.sub(r"\2", text)).replace("**", "")


def extract_fields(markdown: str) -> list[FieldInfo]:
    """One field per distinct named term, in order of first appearance."""
    order: list[str] = []
    counts: Counter[str] = Counter()
    first: dict[str, tuple[str, str]] = {}  # term -> (group class, context sentence)
    for line in markdown.splitlines():
        m = _ITEM.match(line)
        body = _PLAIN_SPAN.sub(r"\1", m.group(3) if m else line)
        for span in _SPAN.finditer(body):
            if span.group(1) in _HEADING_CLASSES:
                continue
            term = base_term(span.group(2))
            counts[term] += 1
            if term not in first:
                order.append(term)
                first[term] = (span.group(1), _context(body, term))
    canonical = _merge_plurals(order, counts)

    fields: list[FieldInfo] = []
    seen: set[str] = set()
    for term in order:
        key = canonical[term]
        if key in seen:
            continue
        seen.add(key)
        group_class, context = first[key]
        fields.append(
            FieldInfo(
                key=key,
                label=key,
                hint=HINTS.get(key, ""),
                context=context,
                group=GROUP_LABELS.get(group_class, "Key terms"),
            )
        )
    return fields


def _merge_plurals(order: list[str], counts: Counter[str]) -> dict[str, str]:
    """Map "Subscription Periods" and "Subscription Period" to whichever is used more."""
    canonical = {t: t for t in order}
    for term in order:
        if term.endswith("s") and term[:-1] in counts:
            winner = term if counts[term] > counts[term[:-1]] else term[:-1]
            canonical[term] = canonical[term[:-1]] = winner
    return canonical


def _context(body: str, term: str) -> str:
    """The sentence of the clause that mentions the term, trimmed for use in a prompt."""
    text = _plain(body)
    sentences = re.split(r"(?<=[.;])\s+", text)
    hit = next((s for s in sentences if term in s), text)
    return hit if len(hit) <= 240 else hit[:237].rstrip() + "..."
