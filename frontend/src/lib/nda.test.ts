import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDocument, defaultData, formatDate, type Block } from "./nda";

const terms = readFileSync(path.join(__dirname, "../../../templates/Mutual-NDA.md"), "utf8");
const text = (blocks: Block[]) =>
  blocks.map((b) => ("runs" in b ? b.runs.map((r) => r.text).join("") : JSON.stringify(b))).join("\n");

describe("formatDate", () => {
  it("formats ISO dates without timezone shift", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
  });
  it("falls back to a placeholder for empty input", () => {
    expect(formatDate("")).toBe("[Effective Date]");
  });
});

describe("buildDocument", () => {
  const filled = {
    ...defaultData(),
    effectiveDate: "2026-03-15",
    governingLaw: "Delaware",
    jurisdiction: "New Castle, DE",
    termYears: 2,
    confidentialityYears: 3,
    party1: { name: "Ann", title: "CEO", company: "Acme", noticeAddress: "a@acme.com", date: "2026-03-15" },
    party2: { name: "Bob", title: "CTO", company: "Beta", noticeAddress: "b@beta.com", date: "2026-03-16" },
  };

  it("fills coverpage values into the standard terms", () => {
    const out = text(buildDocument(filled, terms));
    expect(out).toContain("State of Delaware");
    expect(out).toContain("courts located in New Castle, DE");
    expect(out).toContain("commences on March 15, 2026");
    expect(out).toContain("Expires 2 years from Effective Date.");
    expect(out).toContain("3 years from Effective Date, but in the case of trade secrets");
    expect(out).not.toContain("coverpage_link");
    expect(out).not.toContain("..");
    expect(out).toContain("expires at the end of the MNDA Term");
  });

  it("puts party details in the signature table", () => {
    const table = buildDocument(filled, terms).find((b) => b.type === "table");
    expect(table && table.type === "table" && table.rows).toContainEqual(["Print Name", "Ann", "Bob"]);
  });

  it("shows placeholders when required fields are empty", () => {
    const out = text(buildDocument(defaultData(), terms));
    expect(out).toContain("[Governing Law]");
    expect(out).toContain("[Jurisdiction]");
  });

  it("checks the selected term options", () => {
    const opts = (d = filled) =>
      buildDocument(d, terms).filter((b) => b.type === "option").map((b) => b.type === "option" && b.checked);
    expect(opts()).toEqual([true, false, true, false]);
    expect(opts({ ...filled, termType: "continues", confidentialityType: "perpetuity" })).toEqual([false, true, false, true]);
  });

  it("includes all 11 numbered standard terms", () => {
    const out = text(buildDocument(filled, terms));
    for (let i = 1; i <= 11; i++) expect(out).toContain(`${i}. `);
  });

  it("renders links as plain text and bold markers as bold runs", () => {
    const blocks = buildDocument(filled, terms);
    expect(text(blocks)).not.toMatch(/\*\*|\]\(/);
    const intro = blocks.find((b) => b.type === "p" && b.runs[0]?.text.startsWith("1."));
    expect(intro && "runs" in intro && intro.runs.some((r) => r.bold)).toBe(true);
  });
});
