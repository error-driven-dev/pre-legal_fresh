import { describe, expect, it } from "vitest";
import { applyFieldUpdate, toFieldsPayload } from "./chat";
import { defaultData } from "./nda";

describe("applyFieldUpdate", () => {
  it("applies valid fields and leaves the rest untouched", () => {
    const before = defaultData();
    const after = applyFieldUpdate(before, {
      governingLaw: "Delaware",
      termType: "continues",
      confidentialityYears: 3,
      party1: { company: "Acme" },
    });
    expect(after.governingLaw).toBe("Delaware");
    expect(after.termType).toBe("continues");
    expect(after.confidentialityYears).toBe(3);
    expect(after.party1.company).toBe("Acme");
    expect(after.party1.name).toBe(before.party1.name);
    expect(after.purpose).toBe(before.purpose);
  });

  it("ignores null and missing values", () => {
    const before = { ...defaultData(), governingLaw: "Texas" };
    const after = applyFieldUpdate(before, { governingLaw: null, party2: null });
    expect(after).toEqual(before);
  });

  it("rejects invalid dates, years and enum values", () => {
    const before = defaultData();
    const after = applyFieldUpdate(before, {
      effectiveDate: "next tuesday",
      termYears: 0,
      confidentialityYears: 2.5,
      termType: "forever" as never,
      party1: { date: "10/10/2026" },
    });
    expect(after).toEqual(before);
  });

  it("treats empty or blank strings as no update instead of wiping fields", () => {
    const before = { ...defaultData(), governingLaw: "Texas" };
    before.party1.company = "Acme";
    const after = applyFieldUpdate(before, {
      governingLaw: "",
      purpose: "   ",
      party1: { company: "" },
    });
    expect(after).toEqual(before);
  });

  it("rejects impossible calendar dates", () => {
    const before = defaultData();
    const after = applyFieldUpdate(before, {
      effectiveDate: "2025-02-30",
      party1: { date: "2025-13-45" },
    });
    expect(after).toEqual(before);
    expect(applyFieldUpdate(before, { effectiveDate: "2028-02-29" }).effectiveDate).toBe("2028-02-29");
  });

  it("does not mutate its input", () => {
    const before = defaultData();
    const snapshot = structuredClone(before);
    applyFieldUpdate(before, { party1: { name: "Ann" } });
    expect(before).toEqual(snapshot);
  });
});

describe("toFieldsPayload", () => {
  it("sends empty strings as null so the AI sees them as unfilled", () => {
    const payload = toFieldsPayload(defaultData());
    expect(payload.governingLaw).toBeNull();
    expect(payload.party1?.name).toBeNull();
    expect(payload.purpose).toContain("Evaluating");
  });
});
