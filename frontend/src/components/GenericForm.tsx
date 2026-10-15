"use client";

import type { DocumentDetail, Values } from "@/lib/generic";
import styles from "./DocumentCreator.module.css";

/** A form generated from a document's key terms, grouped the way the template groups them. */
export default function GenericForm({
  doc,
  values,
  onChange,
}: {
  doc: DocumentDetail;
  values: Values;
  onChange: (values: Values) => void;
}) {
  const groups = [...new Set(doc.fields.map((f) => f.group))];
  return (
    <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
      {groups.map((group) => (
        <fieldset key={group} className={styles.group}>
          <legend>{group}</legend>
          {doc.fields
            .filter((f) => f.group === group)
            .map((f) => (
              <label key={f.key} className={styles.field}>
                <span>{f.label}</span>
                <textarea
                  rows={2}
                  value={values[f.key] ?? ""}
                  placeholder={f.hint}
                  onChange={(e) => onChange({ ...values, [f.key]: e.target.value })}
                />
              </label>
            ))}
        </fieldset>
      ))}
    </form>
  );
}
