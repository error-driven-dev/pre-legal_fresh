import type { components } from "@/api/schema";
import type { NdaData, Party } from "./nda";

export type NdaFieldsUpdate = components["schemas"]["NdaFieldsUpdate"];
type PartyUpdate = components["schemas"]["PartyUpdate"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date, not just something shaped like one (rejects 2025-02-30). */
function isRealDate(v: string): boolean {
  const d = new Date(`${v}T00:00:00Z`);
  return ISO_DATE.test(v) && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// Empty strings count as "no update": a model that fills the whole schema must not wipe fields.
const text = (v: string | null | undefined, fallback: string) =>
  typeof v === "string" && v.trim() ? v : fallback;
const date = (v: string | null | undefined, fallback: string) =>
  typeof v === "string" && isRealDate(v) ? v : fallback;
const years = (v: number | null | undefined, fallback: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : fallback;

function mergeParty(current: Party, u: PartyUpdate | null | undefined): Party {
  if (!u) return current;
  return {
    name: text(u.name, current.name),
    title: text(u.title, current.title),
    company: text(u.company, current.company),
    noticeAddress: text(u.noticeAddress, current.noticeAddress),
    date: date(u.date, current.date),
  };
}

/**
 * Applies the fields the AI returned to the document. Absent, null or invalid values leave the
 * current value untouched, so a bad model answer can never corrupt the document.
 */
export function applyFieldUpdate(data: NdaData, u: NdaFieldsUpdate): NdaData {
  return {
    purpose: text(u.purpose, data.purpose),
    effectiveDate: date(u.effectiveDate, data.effectiveDate),
    termType: u.termType === "expires" || u.termType === "continues" ? u.termType : data.termType,
    termYears: years(u.termYears, data.termYears),
    confidentialityType:
      u.confidentialityType === "years" || u.confidentialityType === "perpetuity"
        ? u.confidentialityType
        : data.confidentialityType,
    confidentialityYears: years(u.confidentialityYears, data.confidentialityYears),
    governingLaw: text(u.governingLaw, data.governingLaw),
    jurisdiction: text(u.jurisdiction, data.jurisdiction),
    modifications: text(u.modifications, data.modifications),
    party1: mergeParty(data.party1, u.party1),
    party2: mergeParty(data.party2, u.party2),
  };
}

const orNull = (v: string) => (v.trim() ? v : null);

const partyPayload = (p: Party): PartyUpdate => ({
  name: orNull(p.name),
  title: orNull(p.title),
  company: orNull(p.company),
  noticeAddress: orNull(p.noticeAddress),
  date: orNull(p.date),
});

/** The document as sent to the AI so it knows what is already filled in (null = empty). */
export function toFieldsPayload(d: NdaData): NdaFieldsUpdate {
  return {
    purpose: orNull(d.purpose),
    effectiveDate: orNull(d.effectiveDate),
    termType: d.termType,
    termYears: d.termYears,
    confidentialityType: d.confidentialityType,
    confidentialityYears: d.confidentialityYears,
    governingLaw: orNull(d.governingLaw),
    jurisdiction: orNull(d.jurisdiction),
    modifications: orNull(d.modifications),
    party1: partyPayload(d.party1),
    party2: partyPayload(d.party2),
  };
}
