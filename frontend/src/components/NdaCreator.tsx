"use client";

import { useMemo, useState } from "react";
import { buildDocument, defaultData, type NdaData, type Party, type Run } from "@/lib/nda";
import { downloadPdf } from "@/lib/pdf";
import styles from "./NdaCreator.module.css";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function PartyFields({
  title,
  party,
  onChange,
}: {
  title: string;
  party: Party;
  onChange: (p: Party) => void;
}) {
  const set = (k: keyof Party) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...party, [k]: e.target.value });
  return (
    <fieldset className={styles.group}>
      <legend>{title}</legend>
      <Field label="Print name">
        <input value={party.name} onChange={set("name")} />
      </Field>
      <Field label="Title">
        <input value={party.title} onChange={set("title")} />
      </Field>
      <Field label="Company">
        <input value={party.company} onChange={set("company")} />
      </Field>
      <Field label="Notice address (email or postal)">
        <textarea rows={2} value={party.noticeAddress} onChange={set("noticeAddress")} />
      </Field>
      <Field label="Date">
        <input type="date" value={party.date} onChange={set("date")} />
      </Field>
    </fieldset>
  );
}

const renderRuns = (runs: Run[]) =>
  runs.map((r, i) => (r.bold ? <strong key={i}>{r.text}</strong> : <span key={i}>{r.text}</span>));

export default function NdaCreator({ standardTerms }: { standardTerms: string }) {
  const [data, setData] = useState<NdaData>(defaultData);
  const blocks = useMemo(() => buildDocument(data, standardTerms), [data, standardTerms]);
  const set = <K extends keyof NdaData>(k: K, v: NdaData[K]) => setData((d) => ({ ...d, [k]: v }));
  const years = (v: string) => Math.max(1, parseInt(v, 10) || 1);

  return (
    <main className={styles.layout}>
      <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
        <h1>Mutual NDA Creator</h1>

        <Field label="Purpose">
          <textarea rows={3} value={data.purpose} onChange={(e) => set("purpose", e.target.value)} />
        </Field>
        <Field label="Effective date">
          <input type="date" value={data.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} />
        </Field>

        <fieldset className={styles.group}>
          <legend>MNDA term</legend>
          <label className={styles.radio}>
            <input type="radio" checked={data.termType === "expires"} onChange={() => set("termType", "expires")} />
            Expires
            <input
              type="number"
              min={1}
              className={styles.years}
              value={data.termYears}
              onChange={(e) => set("termYears", years(e.target.value))}
            />
            year(s) from Effective Date
          </label>
          <label className={styles.radio}>
            <input type="radio" checked={data.termType === "continues"} onChange={() => set("termType", "continues")} />
            Continues until terminated
          </label>
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Term of confidentiality</legend>
          <label className={styles.radio}>
            <input
              type="radio"
              checked={data.confidentialityType === "years"}
              onChange={() => set("confidentialityType", "years")}
            />
            <input
              type="number"
              min={1}
              className={styles.years}
              value={data.confidentialityYears}
              onChange={(e) => set("confidentialityYears", years(e.target.value))}
            />
            year(s) from Effective Date (trade secrets protected longer)
          </label>
          <label className={styles.radio}>
            <input
              type="radio"
              checked={data.confidentialityType === "perpetuity"}
              onChange={() => set("confidentialityType", "perpetuity")}
            />
            In perpetuity
          </label>
        </fieldset>

        <Field label="Governing law (state)">
          <input value={data.governingLaw} onChange={(e) => set("governingLaw", e.target.value)} placeholder="Delaware" />
        </Field>
        <Field label="Jurisdiction: federal or state courts located in (city or county and state)">
          <input
            value={data.jurisdiction}
            onChange={(e) => set("jurisdiction", e.target.value)}
            placeholder="New Castle, DE"
          />
        </Field>
        <Field label="MNDA modifications">
          <textarea rows={3} value={data.modifications} onChange={(e) => set("modifications", e.target.value)} />
        </Field>

        <PartyFields title="Party 1" party={data.party1} onChange={(p) => set("party1", p)} />
        <PartyFields title="Party 2" party={data.party2} onChange={(p) => set("party2", p)} />

        <button type="button" className={styles.download} onClick={() => downloadPdf(blocks, "Mutual-NDA.pdf")}>
          Download PDF
        </button>
      </form>

      <section className={styles.preview} aria-label="Document preview">
        <article className={styles.paper}>
          {blocks.map((b, i) => {
            switch (b.type) {
              case "title":
                return <h2 key={i}>{renderRuns(b.runs)}</h2>;
              case "h2":
                return <h4 key={i}>{renderRuns(b.runs)}</h4>;
              case "h3":
                return <h3 key={i}>{renderRuns(b.runs)}</h3>;
              case "note":
                return <p key={i} className={styles.note}>{renderRuns(b.runs)}</p>;
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
                      <tr>{b.head.map((h, j) => <th key={j}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {b.rows.map((r, j) => (
                        <tr key={j}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                );
              default:
                return <p key={i}>{renderRuns(b.runs)}</p>;
            }
          })}
        </article>
      </section>
    </main>
  );
}
