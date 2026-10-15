import { describe, expect, it } from "vitest";
import { applyValueUpdate, buildGenericDocument, type DocumentDetail } from "./generic";

const DOC: DocumentDetail = {
  id: "demo",
  name: "Demo Agreement",
  description: "",
  kind: "generic",
  fields: [
    { key: "Provider", label: "Provider", hint: "", context: "", group: "Cover page" },
    { key: "Governing Law", label: "Governing Law", hint: "", context: "", group: "Key terms" },
  ],
  blocks: [
    { kind: "title", indent: 0, runs: [{ text: "Demo Agreement", bold: true }] },
    { kind: "heading", indent: 0, runs: [{ text: "1. ", bold: false }, { text: "Services", bold: true }] },
    { kind: "clause", indent: 1, runs: [{ text: "1.1 Provider delivers.", bold: false }] },
    { kind: "clause", indent: 2, runs: [{ text: "a. Nested.", bold: false }] },
  ],
};

describe("buildGenericDocument", () => {
  it("puts the title first, then a key terms table, then the standard terms", () => {
    const blocks = buildGenericDocument(DOC, { Provider: "Acme" });
    expect(blocks[0]).toMatchObject({ type: "title" });
    const table = blocks.find((b) => b.type === "table");
    expect(table && table.type === "table" && table.rows).toEqual([
      ["Provider", "Acme"],
      ["Governing Law", "[Governing Law]"],
    ]);
    const tableIndex = blocks.findIndex((b) => b.type === "table");
    expect(blocks[tableIndex + 1]).toMatchObject({ type: "h3" });
  });

  it("maps headings to h3 and clauses to indented clauses", () => {
    const blocks = buildGenericDocument(DOC, {});
    const body = blocks.slice(-3);
    expect(body.map((b) => b.type)).toEqual(["h3", "clause", "clause"]);
    expect(body.map((b) => (b.type === "clause" ? b.indent : -1))).toEqual([-1, 1, 2]);
  });

  it("treats blank values as unfilled", () => {
    const blocks = buildGenericDocument(DOC, { Provider: "   " });
    const table = blocks.find((b) => b.type === "table");
    expect(table && table.type === "table" && table.rows[0]).toEqual(["Provider", "[Provider]"]);
  });
});

describe("applyValueUpdate", () => {
  it("adds and overwrites values, trimmed", () => {
    expect(applyValueUpdate({ A: "1" }, { A: " 2 ", B: "x" })).toEqual({ A: "2", B: "x" });
  });

  it("ignores blank, null and undefined values so fields are never wiped", () => {
    expect(applyValueUpdate({ A: "1" }, { A: "", B: null, C: undefined, D: "  " })).toEqual({
      A: "1",
    });
  });

  it("does not mutate its input", () => {
    const current = { A: "1" };
    applyValueUpdate(current, { A: "2" });
    expect(current).toEqual({ A: "1" });
  });
});
