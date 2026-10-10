export type Party = {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
  date: string;
};

export type NdaData = {
  purpose: string;
  effectiveDate: string;
  termType: "expires" | "continues";
  termYears: number;
  confidentialityType: "years" | "perpetuity";
  confidentialityYears: number;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
};

export type Run = { text: string; bold?: boolean };
export type Block =
  | { type: "title" | "h2" | "h3" | "note"; runs: Run[] }
  | { type: "p"; runs: Run[] }
  | { type: "option"; runs: Run[]; checked: boolean }
  | { type: "table"; head: string[]; rows: string[][] };

const emptyParty: Party = { name: "", title: "", company: "", noticeAddress: "", date: "" };

export function defaultData(): NdaData {
  return {
    purpose: "Evaluating whether to enter into a business relationship with the other party.",
    effectiveDate: new Date().toISOString().slice(0, 10),
    termType: "expires",
    termYears: 1,
    confidentialityType: "years",
    confidentialityYears: 1,
    governingLaw: "",
    jurisdiction: "",
    modifications: "",
    party1: { ...emptyParty },
    party2: { ...emptyParty },
  };
}

const years = (n: number) => `${n} year${n === 1 ? "" : "s"}`;

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "[Effective Date]";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const blank = (value: string, label: string) => value.trim() || `[${label}]`;

/** Splits inline markdown (bold, links, coverpage spans) into runs. */
function inline(text: string, vars: Record<string, string>): Run[] {
  const runs: Run[] = [];
  const re = /\*\*(.+?)\*\*|<span class="coverpage_link">(.+?)<\/span>|\[([^\]]+)\]\([^)]+\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) runs.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) runs.push({ text: vars[m[2]] ?? m[2], bold: true });
    else runs.push({ text: m[3] });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}

/** Builds the full document (cover page + standard terms) as renderer-neutral blocks. */
export function buildDocument(d: NdaData, standardTermsMd: string): Block[] {
  const vars: Record<string, string> = {
    Purpose: blank(d.purpose.trim().replace(/[.\s]+$/, ""), "Purpose"),
    "Effective Date": formatDate(d.effectiveDate),
    "Governing Law": blank(d.governingLaw, "Governing Law"),
    Jurisdiction: blank(d.jurisdiction, "Jurisdiction"),
  };
  const t = (s: string): Run[] => [{ text: s }];

  const blocks: Block[] = [
    { type: "title", runs: t("Mutual Non-Disclosure Agreement") },
    { type: "h2", runs: t("USING THIS MUTUAL NON-DISCLOSURE AGREEMENT") },
    {
      type: "p",
      runs: inline(
        "This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“**Cover Page**”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“**Standard Terms**”) identical to those posted at [commonpaper.com/standards/mutual-nda/1.0](https://commonpaper.com/standards/mutual-nda/1.0). Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.",
        vars,
      ),
    },
    { type: "h3", runs: t("Purpose") },
    { type: "note", runs: t("How Confidential Information may be used") },
    { type: "p", runs: t(blank(d.purpose, "Purpose")) },
    { type: "h3", runs: t("Effective Date") },
    { type: "p", runs: t(vars["Effective Date"]) },
    { type: "h3", runs: t("MNDA Term") },
    { type: "note", runs: t("The length of this MNDA") },
    { type: "option", checked: d.termType === "expires", runs: t(`Expires ${years(d.termYears)} from Effective Date.`) },
    { type: "option", checked: d.termType === "continues", runs: t("Continues until terminated in accordance with the terms of the MNDA.") },
    { type: "h3", runs: t("Term of Confidentiality") },
    { type: "note", runs: t("How long Confidential Information is protected") },
    {
      type: "option",
      checked: d.confidentialityType === "years",
      runs: t(`${years(d.confidentialityYears)} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`),
    },
    { type: "option", checked: d.confidentialityType === "perpetuity", runs: t("In perpetuity.") },
    { type: "h3", runs: t("Governing Law & Jurisdiction") },
    { type: "p", runs: [{ text: "Governing Law: ", bold: true }, { text: vars["Governing Law"] }] },
    { type: "p", runs: [{ text: "Jurisdiction: ", bold: true }, { text: vars.Jurisdiction }] },
    { type: "h3", runs: t("MNDA Modifications") },
    { type: "p", runs: t(d.modifications.trim() || "None.") },
    { type: "p", runs: t("By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.") },
    {
      type: "table",
      head: ["", "PARTY 1", "PARTY 2"],
      rows: [
        ["Signature", "", ""],
        ["Print Name", d.party1.name, d.party2.name],
        ["Title", d.party1.title, d.party2.title],
        ["Company", d.party1.company, d.party2.company],
        ["Notice Address", d.party1.noticeAddress, d.party2.noticeAddress],
        ["Date", d.party1.date, d.party2.date],
      ],
    },
    { type: "title", runs: t("Standard Terms") },
  ];

  for (const line of standardTermsMd.split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith("# ")) continue;
    // The Effective Date value is a full date, so drop the article that precedes the defined term.
    const filled = text.replace('the <span class="coverpage_link">Effective Date', '<span class="coverpage_link">Effective Date');
    blocks.push({ type: "p", runs: inline(filled, vars) });
  }
  return blocks;
}
