"use client";

import type { NdaData, Party } from "@/lib/nda";
import styles from "./DocumentCreator.module.css";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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

export default function NdaForm({
  data,
  onChange,
}: {
  data: NdaData;
  onChange: (data: NdaData) => void;
}) {
  const set = <K extends keyof NdaData>(k: K, v: NdaData[K]) => onChange({ ...data, [k]: v });
  const years = (v: string) => Math.max(1, parseInt(v, 10) || 1);

  return (
    <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
      <Field label="Purpose">
        <textarea rows={3} value={data.purpose} onChange={(e) => set("purpose", e.target.value)} />
      </Field>
      <Field label="Effective date">
        <input
          type="date"
          value={data.effectiveDate}
          onChange={(e) => set("effectiveDate", e.target.value)}
        />
      </Field>

      <fieldset className={styles.group}>
        <legend>MNDA term</legend>
        <label className={styles.radio}>
          <input
            type="radio"
            checked={data.termType === "expires"}
            onChange={() => set("termType", "expires")}
          />
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
          <input
            type="radio"
            checked={data.termType === "continues"}
            onChange={() => set("termType", "continues")}
          />
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
        <input
          value={data.governingLaw}
          onChange={(e) => set("governingLaw", e.target.value)}
          placeholder="Delaware"
        />
      </Field>
      <Field label="Jurisdiction: federal or state courts located in (city or county and state)">
        <input
          value={data.jurisdiction}
          onChange={(e) => set("jurisdiction", e.target.value)}
          placeholder="New Castle, DE"
        />
      </Field>
      <Field label="MNDA modifications">
        <textarea
          rows={3}
          value={data.modifications}
          onChange={(e) => set("modifications", e.target.value)}
        />
      </Field>

      <PartyFields title="Party 1" party={data.party1} onChange={(p) => set("party1", p)} />
      <PartyFields title="Party 2" party={data.party2} onChange={(p) => set("party2", p)} />
    </form>
  );
}
