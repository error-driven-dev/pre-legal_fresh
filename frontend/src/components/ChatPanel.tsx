"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { toFieldsPayload } from "@/lib/chat";
import type { Values } from "@/lib/generic";
import type { NdaData } from "@/lib/nda";
import styles from "./ChatPanel.module.css";

export type ChatResult = components["schemas"]["ChatResponse"];
type Message = { role: "user" | "assistant"; content: string };

const GREETING: Message = {
  role: "assistant",
  content:
    "Hi! I can help you draft a legal agreement. What kind of document do you need?",
};

function errorText(error: unknown): string {
  if (error && typeof error === "object" && "detail" in error && typeof error.detail === "string") {
    return error.detail;
  }
  return "Something went wrong talking to the AI. Please try again.";
}

export default function ChatPanel({
  documentId,
  nda,
  values,
  onResult,
}: {
  documentId: string | null;
  nda: NdaData;
  values: Values;
  onResult: (result: ChatResult) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || busy) return;

    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setError(null);
    setBusy(true);
    try {
      const { data, error: apiError } = await api.POST("/api/chat", {
        body: { messages: next, documentId, document: toFieldsPayload(nda), values },
      });
      if (data) {
        setMessages([...next, { role: "assistant", content: data.reply }]);
        onResult(data);
      } else {
        setError(errorText(apiError));
      }
    } catch {
      setError(errorText(null));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.chat}>
      <div className={styles.messages} aria-live="polite">
        {messages.map((m, i) => (
          <p key={i} className={m.role === "user" ? styles.user : styles.assistant}>
            {m.content}
          </p>
        ))}
        {busy && <p className={styles.assistant}>Thinking…</p>}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>
      <form className={styles.composer} onSubmit={send}>
        <input
          aria-label="Message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your answer…"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
