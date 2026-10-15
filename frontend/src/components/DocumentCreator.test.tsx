// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/api/client";
import DocumentCreator from "./DocumentCreator";

vi.mock("@/api/client", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("@/lib/pdf", () => ({ downloadPdf: vi.fn() }));

const post = vi.mocked(api.POST) as unknown as ReturnType<typeof vi.fn>;
const get = vi.mocked(api.GET) as unknown as ReturnType<typeof vi.fn>;

const TERMS = 'Uses <span class="coverpage_link">Purpose</span>.';
const run = (text: string, bold = false) => ({ text, bold });
const SLA = {
  id: "sla",
  name: "Service Level Agreement",
  description: "",
  kind: "generic",
  fields: [
    { key: "Provider", label: "Provider", hint: "Provider name", context: "", group: "Cover page" },
    {
      key: "Target Uptime",
      label: "Target Uptime",
      hint: "e.g. 99.9%",
      context: "",
      group: "Order form",
    },
  ],
  blocks: [
    { kind: "title", indent: 0, runs: [run("Service Level Agreement", true)] },
    { kind: "heading", indent: 0, runs: [run("1. "), run("Uptime", true)] },
    { kind: "clause", indent: 1, runs: [run("1.1 Provider will meet the Target Uptime.")] },
  ],
};
const LIST = [
  { id: "mutual-nda", name: "Mutual Non-Disclosure Agreement", description: "", kind: "nda" },
  { id: "sla", name: "Service Level Agreement", description: "", kind: "generic" },
];

const picker = () => screen.getByLabelText("Document") as HTMLSelectElement;
const preview = () => screen.getByLabelText("Document preview").textContent ?? "";
const chatInput = () => screen.getByLabelText("Message") as HTMLInputElement;
const downloadButton = () =>
  screen.getByRole("button", { name: "Download PDF" }) as HTMLButtonElement;

async function renderApp() {
  render(<DocumentCreator ndaTerms={TERMS} />);
  await screen.findByRole("option", { name: "Service Level Agreement" });
}
function choose(id: string) {
  fireEvent.change(picker(), { target: { value: id } });
}
function say(text: string) {
  fireEvent.change(chatInput(), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
}

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  get.mockImplementation(async (path: string) =>
    path === "/api/documents" ? { data: LIST } : { data: SLA },
  );
});
afterEach(cleanup);

describe("document selection", () => {
  it("starts with no document chosen and downloads disabled", async () => {
    await renderApp();
    expect(picker().value).toBe("");
    expect(preview()).toContain("Choose a document");
    expect(downloadButton().disabled).toBe(true);
  });

  it("shows the NDA when chosen, and the generic document with a Key Terms table", async () => {
    await renderApp();
    choose("mutual-nda");
    expect(preview()).toContain("USING THIS MUTUAL NON-DISCLOSURE AGREEMENT");
    choose("sla");
    await waitFor(() => expect(preview()).toContain("Key Terms"));
    expect(preview()).toContain("[Target Uptime]");
    expect(preview()).toContain("1.1 Provider will meet the Target Uptime.");
    expect(downloadButton().disabled).toBe(false);
  });
});

describe("mode toggle", () => {
  it("starts in chat mode and hides the other mode", async () => {
    await renderApp();
    expect(screen.getByRole("button", { name: "Chat" }).getAttribute("aria-pressed")).toBe("true");
    expect(chatInput().closest("[hidden]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Form" }));
    expect(chatInput().closest("[hidden]")).not.toBeNull();
  });

  it("edits NDA fields in form mode and keeps the preview in sync", async () => {
    await renderApp();
    choose("mutual-nda");
    fireEvent.click(screen.getByRole("button", { name: "Form" }));
    fireEvent.change(screen.getByLabelText("Governing law (state)"), { target: { value: "Ohio" } });
    expect(preview()).toContain("Ohio");
  });

  it("generates a form from the key terms of a generic document", async () => {
    await renderApp();
    choose("sla");
    fireEvent.click(screen.getByRole("button", { name: "Form" }));
    const uptime = (await screen.findByLabelText("Target Uptime")) as HTMLTextAreaElement;
    expect(uptime.placeholder).toBe("e.g. 99.9%");
    fireEvent.change(uptime, { target: { value: "99.95%" } });
    expect(preview()).toContain("99.95%");
  });

  it("keeps values per document when switching between documents", async () => {
    await renderApp();
    choose("mutual-nda");
    fireEvent.click(screen.getByRole("button", { name: "Form" }));
    fireEvent.change(screen.getByLabelText("Governing law (state)"), { target: { value: "Ohio" } });
    choose("sla");
    choose("mutual-nda");
    expect(preview()).toContain("Ohio");
  });
});

describe("chat", () => {
  it("lets the AI choose the document and fill the NDA, sending the whole conversation", async () => {
    post.mockResolvedValue({
      data: {
        reply: "Let's draft the NDA.",
        documentId: "mutual-nda",
        fields: { governingLaw: "Delaware" },
        values: {},
      },
    });
    await renderApp();
    say("I need an NDA, Delaware law");

    await waitFor(() => expect(screen.getByText("Let's draft the NDA.")).toBeTruthy());
    expect(picker().value).toBe("mutual-nda");
    expect(preview()).toContain("Delaware");
    const body = post.mock.calls[0][1].body;
    expect(body.documentId).toBeNull();
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["assistant", "user"]);

    post.mockResolvedValue({
      data: { reply: "Thanks!", documentId: null, fields: {}, values: {} },
    });
    say("Acme is party 1");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const second = post.mock.calls[1][1].body;
    expect(second.documentId).toBe("mutual-nda");
    expect(second.messages).toHaveLength(4);
    expect(second.document.governingLaw).toBe("Delaware");
  });

  it("fills key terms of a generic document from the chat", async () => {
    post.mockResolvedValue({
      data: {
        reply: "SLA it is.",
        documentId: "sla",
        fields: {},
        values: { "Target Uptime": "99.9%", Provider: "Acme" },
      },
    });
    await renderApp();
    say("I need an SLA");
    await waitFor(() => expect(preview()).toContain("99.9%"));
    expect(preview()).toContain("Acme");
    expect(picker().value).toBe("sla");

    post.mockResolvedValue({ data: { reply: "ok", documentId: null, fields: {}, values: {} } });
    say("next");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls[1][1].body.values).toEqual({
      "Target Uptime": "99.9%",
      Provider: "Acme",
    });
  });

  it("explains an unsupported request without choosing a document", async () => {
    post.mockResolvedValue({
      data: {
        reply: "We can't generate a lease. The closest is the Cloud Service Agreement.",
        documentId: null,
        fields: {},
        values: {},
      },
    });
    await renderApp();
    say("I need a lease");
    await waitFor(() => expect(screen.getByText(/can't generate a lease/)).toBeTruthy());
    expect(picker().value).toBe("");
    expect(preview()).toContain("Choose a document");
  });

  it("shows the server's error message and keeps the document unchanged", async () => {
    post.mockResolvedValue({ error: { detail: "The free AI model is busy right now." } });
    await renderApp();
    choose("mutual-nda");
    say("hello");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("busy"));
    expect(preview()).toContain("[Governing Law]");
  });

  it("shows a generic error when the error response has no detail", async () => {
    post.mockResolvedValue({ error: { message: "boom" } });
    await renderApp();
    say("hello");
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Something went wrong"),
    );
  });

  it("keeps the chat history when switching to the form and back", async () => {
    post.mockResolvedValue({
      data: { reply: "Got it.", documentId: null, fields: {}, values: {} },
    });
    await renderApp();
    say("hi there");
    await waitFor(() => expect(screen.getByText("Got it.")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Form" }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    expect(screen.getByText("hi there")).toBeTruthy();
  });

  it("does not send blank messages", async () => {
    await renderApp();
    fireEvent.change(chatInput(), { target: { value: "   " } });
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(post).not.toHaveBeenCalled();
  });
});
