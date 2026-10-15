"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import { applyFieldUpdate } from "@/lib/chat";
import {
  applyValueUpdate,
  buildGenericDocument,
  type DocumentDetail,
  type DocumentSummary,
  NDA_ID,
  type Values,
} from "@/lib/generic";
import { type Block, buildDocument, defaultData, type NdaData } from "@/lib/nda";
import { downloadPdf } from "@/lib/pdf";
import ChatPanel, { type ChatResult } from "./ChatPanel";
import GenericForm from "./GenericForm";
import styles from "./DocumentCreator.module.css";
import NdaForm from "./NdaForm";
import DocumentPreview from "./DocumentPreview";

type Mode = "chat" | "form";

const PLACEHOLDER: Block[] = [
  {
    type: "p",
    runs: [{ text: "Choose a document from the list, or tell the assistant what you need." }],
  },
];

export default function DocumentCreator({ ndaTerms }: { ndaTerms: string }) {
  const [mode, setMode] = useState<Mode>("chat");
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [nda, setNda] = useState<NdaData>(defaultData);
  const [valuesByDoc, setValuesByDoc] = useState<Record<string, Values>>({});
  const [details, setDetails] = useState<Record<string, DocumentDetail>>({});

  useEffect(() => {
    api.GET("/api/documents").then(({ data }) => data && setDocuments(data));
  }, []);

  useEffect(() => {
    if (!documentId || documentId === NDA_ID || details[documentId]) return;
    api
      .GET("/api/documents/{doc_id}", { params: { path: { doc_id: documentId } } })
      .then(({ data }) => data && setDetails((d) => ({ ...d, [data.id]: data })));
  }, [documentId, details]);

  const detail = documentId ? details[documentId] : undefined;
  const values = (documentId && valuesByDoc[documentId]) || {};

  const blocks = useMemo(() => {
    if (documentId === NDA_ID) return buildDocument(nda, ndaTerms);
    if (documentId && detail) return buildGenericDocument(detail, valuesByDoc[documentId] ?? {});
    return PLACEHOLDER;
  }, [documentId, nda, ndaTerms, detail, valuesByDoc]);

  function onChatResult(result: ChatResult) {
    const target = result.documentId ?? documentId;
    if (result.documentId) setDocumentId(result.documentId);
    if (target === NDA_ID) {
      setNda((d) => applyFieldUpdate(d, result.fields ?? {}));
    } else if (target) {
      setValuesByDoc((all) => ({
        ...all,
        [target]: applyValueUpdate(all[target] ?? {}, result.values ?? {}),
      }));
    }
  }

  const docName = documents.find((d) => d.id === documentId)?.name ?? "Document";

  return (
    <main className={styles.layout}>
      <div className={styles.side}>
        <header className={styles.sideHeader}>
          <h1>Legal Document Creator</h1>
          <label className={styles.field}>
            <span>Document</span>
            <select value={documentId ?? ""} onChange={(e) => setDocumentId(e.target.value || null)}>
              <option value="">Choose a document…</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.toggle} role="group" aria-label="Input mode">
            {(["chat", "form"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                className={mode === m ? styles.toggleOn : undefined}
                onClick={() => setMode(m)}
              >
                {m === "chat" ? "Chat" : "Form"}
              </button>
            ))}
          </div>
        </header>

        {/* Both panels stay mounted so the chat history survives switching modes. */}
        <div className={styles.panel} hidden={mode !== "chat"}>
          <ChatPanel documentId={documentId} nda={nda} values={values} onResult={onChatResult} />
        </div>
        <div className={styles.panel} hidden={mode !== "form"}>
          {documentId === NDA_ID && <NdaForm data={nda} onChange={setNda} />}
          {documentId && documentId !== NDA_ID && detail && (
            <GenericForm
              doc={detail}
              values={values}
              onChange={(v) => setValuesByDoc((all) => ({ ...all, [documentId]: v }))}
            />
          )}
          {!documentId && <p className={styles.empty}>Choose a document above to fill it in.</p>}
        </div>
      </div>

      <DocumentPreview
        blocks={blocks}
        canDownload={documentId !== null && (documentId === NDA_ID || !!detail)}
        onDownload={() => downloadPdf(blocks, `${docName.replace(/\s+/g, "-")}.pdf`)}
      />
    </main>
  );
}
