import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDocument, defaultData } from "./nda";
import { buildPdf } from "./pdf";

const terms = readFileSync(path.join(__dirname, "../../../templates/Mutual-NDA.md"), "utf8");

describe("buildPdf", () => {
  it("produces a multi-page PDF", () => {
    const doc = buildPdf(buildDocument(defaultData(), terms));
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(Buffer.from(doc.output("arraybuffer")).subarray(0, 5).toString()).toBe("%PDF-");
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, Buffer.from(doc.output("arraybuffer")));
  });
});
