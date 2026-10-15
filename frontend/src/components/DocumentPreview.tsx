import type { Block, Run } from "@/lib/nda";
import styles from "./DocumentCreator.module.css";

const renderRuns = (runs: Run[]) =>
  runs.map((r, i) => (r.bold ? <strong key={i}>{r.text}</strong> : <span key={i}>{r.text}</span>));

function renderBlock(b: Block, i: number) {
  switch (b.type) {
    case "title":
      return <h2 key={i}>{renderRuns(b.runs)}</h2>;
    case "h2":
      return <h4 key={i}>{renderRuns(b.runs)}</h4>;
    case "h3":
      return <h3 key={i}>{renderRuns(b.runs)}</h3>;
    case "note":
      return (
        <p key={i} className={styles.note}>
          {renderRuns(b.runs)}
        </p>
      );
    case "clause":
      return (
        <p key={i} style={{ paddingLeft: b.indent * 20 }}>
          {renderRuns(b.runs)}
        </p>
      );
    case "option":
      return (
        <p key={i} className={styles.option}>
          {b.checked ? "☑" : "☐"} {renderRuns(b.runs)}
        </p>
      );
    case "table":
      return (
        <table key={i}>
          <thead>
            <tr>
              {b.head.map((h, j) => (
                <th key={j}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, j) => (
              <tr key={j}>
                {r.map((c, k) => (
                  <td key={k}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    default:
      return <p key={i}>{renderRuns(b.runs)}</p>;
  }
}

export default function DocumentPreview({
  blocks,
  canDownload,
  onDownload,
}: {
  blocks: Block[];
  canDownload: boolean;
  onDownload: () => void;
}) {
  return (
    <section className={styles.preview} aria-label="Document preview">
      <div className={styles.previewBar}>
        <button
          type="button"
          className={styles.download}
          disabled={!canDownload}
          onClick={onDownload}
        >
          Download PDF
        </button>
      </div>
      <article className={styles.paper}>{blocks.map(renderBlock)}</article>
    </section>
  );
}
