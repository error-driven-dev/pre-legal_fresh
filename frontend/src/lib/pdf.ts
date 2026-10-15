import { jsPDF } from "jspdf";
import type { Block, Run } from "./nda";

const MARGIN = 54;
const LINE = 1.35;

/** Renders document blocks to a PDF document. */
export function buildPdf(blocks: Block[]): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const width = pageW - MARGIN * 2;
  let y = MARGIN;

  const ensure = (h: number) => {
    if (y + h > pageH - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // Word-wraps mixed bold/regular runs.
  const drawRuns = (runs: Run[], size: number, indent = 0) => {
    doc.setFontSize(size);
    const words: { text: string; bold: boolean }[] = [];
    for (const r of runs)
      for (const w of r.text.split(/(\s+)/)) if (w) words.push({ text: w, bold: !!r.bold });
    let x = MARGIN + indent;
    const lh = size * LINE;
    ensure(lh);
    for (const w of words) {
      doc.setFont("helvetica", w.bold ? "bold" : "normal");
      const wW = doc.getTextWidth(w.text);
      const space = /^\s+$/.test(w.text);
      if (!space && x + wW > MARGIN + width && x > MARGIN + indent) {
        x = MARGIN + indent;
        y += lh;
        ensure(lh);
      }
      if (space && x === MARGIN + indent) continue;
      doc.text(w.text, x, y + size);
      x += wW;
    }
    y += lh;
  };

  for (const b of blocks) {
    switch (b.type) {
      case "title":
        y += 6;
        drawRuns(b.runs.map((r) => ({ ...r, bold: true })), 18);
        y += 6;
        break;
      case "h2":
        drawRuns(b.runs.map((r) => ({ ...r, bold: true })), 11);
        y += 4;
        break;
      case "h3":
        y += 6;
        drawRuns(b.runs.map((r) => ({ ...r, bold: true })), 12);
        break;
      case "note":
        drawRuns(b.runs, 9);
        break;
      case "p":
        drawRuns(b.runs, 10);
        y += 6;
        break;
      case "clause":
        drawRuns(b.runs, 10, b.indent * 18);
        y += 4;
        break;
      case "option":
        drawRuns([{ text: b.checked ? "[x]  " : "[  ]  " }, ...b.runs], 10, 8);
        y += 2;
        break;
      case "table": {
        const cols = b.widths.map((w) => width * w);
        const lineH = 10 * LINE;
        for (const [i, row] of [b.head, ...b.rows].entries()) {
          doc.setFontSize(10);
          doc.setFont("helvetica", i === 0 ? "bold" : "normal");
          const cells = row.map((c, ci) => doc.splitTextToSize(c, cols[ci] - 8) as string[]);
          const minLines = i === 1 ? (b.firstRowLines ?? 1) : 1;
          const rowH = Math.max(minLines, ...cells.map((c) => c.length)) * lineH + 8;
          ensure(rowH);
          let x = MARGIN;
          cells.forEach((lines, ci) => {
            doc.rect(x, y, cols[ci], rowH);
            doc.text(lines, x + 4, y + 4 + 10, { baseline: "alphabetic" });
            x += cols[ci];
          });
          y += rowH;
        }
        y += 10;
        break;
      }
    }
  }

  return doc;
}

/** Renders document blocks to a PDF and triggers a browser download. */
export function downloadPdf(blocks: Block[], filename: string) {
  buildPdf(blocks).save(filename);
}
