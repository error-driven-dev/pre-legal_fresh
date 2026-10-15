import type { components } from "@/api/schema";
import type { Block } from "./nda";

export type DocumentSummary = components["schemas"]["DocumentSummary"];
export type DocumentDetail = components["schemas"]["DocumentDetail"];
export type FieldInfo = components["schemas"]["FieldInfo"];

/** The Mutual NDA keeps its own dedicated form and cover page (see nda.ts). */
export const NDA_ID = "mutual-nda";

/** Key term values the user has entered for one document, by field key. */
export type Values = Record<string, string>;

/**
 * Builds a generic document: the title, a Key Terms table holding the values the user supplied,
 * then the template's standard terms. The terms are defined terms, so the body keeps their names
 * and the table gives their values.
 */
export function buildGenericDocument(doc: DocumentDetail, values: Values): Block[] {
  const [title, ...body] = doc.blocks;
  const blocks: Block[] = [];
  if (title) blocks.push({ type: "title", runs: title.runs });
  blocks.push(
    { type: "h3", runs: [{ text: "Key Terms" }] },
    { type: "note", runs: [{ text: "Defined terms used throughout this agreement" }] },
    {
      type: "table",
      head: ["Term", "Value"],
      widths: [0.3, 0.7],
      rows: doc.fields.map((f) => [f.label, values[f.key]?.trim() || `[${f.label}]`]),
    },
    { type: "h3", runs: [{ text: "Standard Terms" }] },
  );
  for (const b of body) {
    blocks.push(
      b.kind === "heading"
        ? { type: "h3", runs: b.runs }
        : { type: "clause", indent: b.indent, runs: b.runs },
    );
  }
  return blocks;
}

/** Merges AI-returned values into the current ones. Blank, null and non-string values are ignored. */
export function applyValueUpdate(
  current: Values,
  update: Record<string, string | null | undefined>,
): Values {
  const next = { ...current };
  for (const [key, value] of Object.entries(update)) {
    if (typeof value === "string" && value.trim()) next[key] = value.trim();
  }
  return next;
}
