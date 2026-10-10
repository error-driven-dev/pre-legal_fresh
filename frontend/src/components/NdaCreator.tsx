"use client";

import { useMemo, useState } from "react";
import { applyFieldUpdate, type NdaFieldsUpdate } from "@/lib/chat";
import { buildDocument, defaultData, type NdaData } from "@/lib/nda";
import { downloadPdf } from "@/lib/pdf";
import ChatPanel from "./ChatPanel";
import styles from "./NdaCreator.module.css";
import NdaForm from "./NdaForm";
import NdaPreview from "./NdaPreview";

type Mode = "chat" | "form";

export default function NdaCreator({ standardTerms }: { standardTerms: string }) {
  const [mode, setMode] = useState<Mode>("chat");
  const [data, setData] = useState<NdaData>(defaultData);
  const blocks = useMemo(() => buildDocument(data, standardTerms), [data, standardTerms]);

  return (
    <main className={styles.layout}>
      <div className={styles.side}>
        <header className={styles.sideHeader}>
          <h1>Mutual NDA Creator</h1>
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
          <ChatPanel
            document={data}
            onFields={(update: NdaFieldsUpdate) => setData((d) => applyFieldUpdate(d, update))}
          />
        </div>
        <div className={styles.panel} hidden={mode !== "form"}>
          <NdaForm data={data} onChange={setData} />
        </div>
      </div>

      <NdaPreview blocks={blocks} onDownload={() => downloadPdf(blocks, "Mutual-NDA.pdf")} />
    </main>
  );
}
