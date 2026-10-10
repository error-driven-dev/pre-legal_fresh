// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/api/client";
import NdaCreator from "./NdaCreator";

vi.mock("@/api/client", () => ({ api: { POST: vi.fn() } }));
vi.mock("@/lib/pdf", () => ({ downloadPdf: vi.fn() }));

const post = vi.mocked(api.POST) as unknown as ReturnType<typeof vi.fn>;
const TERMS = "1. **Introduction**. Uses <span class=\"coverpage_link\">Purpose</span>.";

const chatInput = () => screen.getByLabelText("Message") as HTMLInputElement;
async function say(text: string) {
  fireEvent.change(chatInput(), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
}

beforeEach(() => post.mockReset());
afterEach(cleanup);

describe("mode toggle", () => {
  it("starts in chat mode with the form hidden", () => {
    render(<NdaCreator standardTerms={TERMS} />);
    expect(screen.getByRole("button", { name: "Chat" }).getAttribute("aria-pressed")).toBe("true");
    expect(chatInput().closest("[hidden]")).toBeNull();
    expect(screen.getByLabelText("Governing law (state)").closest("[hidden]")).not.toBeNull();
  });

  it("hides the chat and shows the form when toggled", () => {
    render(<NdaCreator standardTerms={TERMS} />);
    fireEvent.click(screen.getByRole("button", { name: "Form" }));
    expect(screen.getByLabelText("Governing law (state)").closest("[hidden]")).toBeNull();
    expect(chatInput().closest("[hidden]")).not.toBeNull();
  });

  it("keeps form edits and the preview in sync across modes", () => {
    render(<NdaCreator standardTerms={TERMS} />);
    fireEvent.click(screen.getByRole("button", { name: "Form" }));
    fireEvent.change(screen.getByLabelText("Governing law (state)"), { target: { value: "Ohio" } });
    expect(screen.getByLabelText("Document preview").textContent).toContain("Ohio");
  });
});

describe("chat", () => {
  it("sends the whole conversation and applies returned fields to the document", async () => {
    post.mockResolvedValue({
      data: { reply: "Noted: Delaware.", fields: { governingLaw: "Delaware" } },
    });
    render(<NdaCreator standardTerms={TERMS} />);
    await say("Delaware law please");

    await waitFor(() => expect(screen.getByText("Noted: Delaware.")).toBeTruthy());
    const body = post.mock.calls[0][1].body;
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(["assistant", "user"]);
    expect(body.messages[1].content).toBe("Delaware law please");
    expect(screen.getByLabelText("Document preview").textContent).toContain("Delaware");

    // Second turn sends the full history again, plus the updated document.
    post.mockResolvedValue({ data: { reply: "Thanks!", fields: {} } });
    await say("Acme is party 1");
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const second = post.mock.calls[1][1].body;
    expect(second.messages).toHaveLength(4);
    expect(second.document.governingLaw).toBe("Delaware");
  });

  it("shows the server's error message and keeps the document unchanged", async () => {
    post.mockResolvedValue({ error: { detail: "The free AI model is busy right now." } });
    render(<NdaCreator standardTerms={TERMS} />);
    await say("hello");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("busy"));
    expect(screen.getByLabelText("Document preview").textContent).toContain("[Governing Law]");
  });

  it("shows a generic error when the error response has no detail", async () => {
    post.mockResolvedValue({ error: { message: "boom" } });
    render(<NdaCreator standardTerms={TERMS} />);
    await say("hello");
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Something went wrong"),
    );
  });

  it("keeps the chat history when switching to the form and back", async () => {
    post.mockResolvedValue({ data: { reply: "Got it.", fields: {} } });
    render(<NdaCreator standardTerms={TERMS} />);
    await say("hi there");
    await waitFor(() => expect(screen.getByText("Got it.")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Form" }));
    fireEvent.click(screen.getByRole("button", { name: "Chat" }));
    expect(screen.getByText("hi there")).toBeTruthy();
  });

  it("does not send blank messages", () => {
    render(<NdaCreator standardTerms={TERMS} />);
    fireEvent.change(chatInput(), { target: { value: "   " } });
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
    expect(post).not.toHaveBeenCalled();
  });
});
