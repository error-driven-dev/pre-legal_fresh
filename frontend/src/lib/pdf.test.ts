import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildGenericDocument, type DocumentDetail } from "./generic";
import { buildDocument, defaultData } from "./nda";
import { buildPdf } from "./pdf";

const terms = readFileSync(path.join(__dirname, "../../../templates/Mutual-NDA.md"), "utf8");
const isPdf = (doc: ReturnType<typeof buildPdf>) =>
  Buffer.from(doc.output("arraybuffer")).subarray(0, 5).toString() === "%PDF-";

const run = (text: string, bold = false) => ({ text, bold });
const clause = (n: number, indent: number) => ({
  kind: "clause" as const,
  indent,
  runs: [run(`${n}. `), run("A long clause that has to wrap across several lines. ".repeat(6))],
});
const DOC: DocumentDetail = {
  id: "demo",
  name: "Demo",
  description: "",
  kind: "generic",
  fields: [{ key: "Provider", label: "Provider", hint: "", context: "", group: "Key terms" }],
  blocks: [
    { kind: "title", indent: 0, runs: [run("Demo Agreement", true)] },
    { kind: "heading", indent: 0, runs: [run("1. "), run("Services", true)] },
    ...Array.from({ length: 60 }, (_, i) => clause(i, i % 3)),
  ],
};

describe("buildPdf", () => {
  it("produces a multi-page PDF for the NDA", () => {
    const doc = buildPdf(buildDocument(defaultData(), terms));
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(isPdf(doc)).toBe(true);
  });

  it("renders a generic document: wrapped values, indented clauses, page breaks", () => {
    const value = "A very long value that must wrap inside its table cell. ".repeat(8);
    const doc = buildPdf(buildGenericDocument(DOC, { Provider: value }));
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
    expect(isPdf(doc)).toBe(true);
  });

  it("keeps a short generic document on one page", () => {
    const doc = buildPdf(buildGenericDocument({ ...DOC, blocks: DOC.blocks.slice(0, 3) }, {}));
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
