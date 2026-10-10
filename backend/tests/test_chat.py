import json
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.features.chat.llm import LlmError, OpenRouterClient
from app.features.chat.router import get_llm_client
from app.features.chat.schemas import ChatRequest
from app.features.chat.service import build_messages, run_turn

GOOD = json.dumps(
    {
        "reply": "Got it. What is the purpose?",
        "fields": {"governingLaw": "Delaware", "party1": {"company": "Acme"}},
    }
)


class FakeClient:
    """Returns queued raw answers (or raises queued errors) and records each call."""

    def __init__(self, *answers: str | LlmError) -> None:
        self.answers = list(answers)
        self.calls: list[list[dict[str, str]]] = []

    async def complete(self, messages: list[dict[str, str]], schema: dict[str, Any]) -> str:
        self.calls.append(messages)
        answer = self.answers.pop(0)
        if isinstance(answer, LlmError):
            raise answer
        return answer


def make_request(text: str = "Acme and Beta, Delaware law") -> ChatRequest:
    return ChatRequest.model_validate(
        {"messages": [{"role": "user", "content": text}], "document": {"purpose": "Testing"}}
    )


async def test_run_turn_parses_reply_and_fields() -> None:
    result = await run_turn(FakeClient(GOOD), make_request())
    assert result.reply == "Got it. What is the purpose?"
    assert result.fields.governing_law == "Delaware"
    assert result.fields.party1 is not None and result.fields.party1.company == "Acme"
    assert result.fields.purpose is None  # untouched fields stay unset


async def test_run_turn_accepts_json_code_fence() -> None:
    result = await run_turn(FakeClient(f"```json\n{GOOD}\n```"), make_request())
    assert result.fields.governing_law == "Delaware"


async def test_run_turn_retries_once_on_invalid_json() -> None:
    client = FakeClient("not json at all", GOOD)
    result = await run_turn(client, make_request())
    assert result.reply.startswith("Got it")
    assert len(client.calls) == 2
    assert client.calls[1][-1]["role"] == "user"  # corrective message was appended


async def test_run_turn_gives_up_after_second_invalid_answer() -> None:
    with pytest.raises(LlmError):
        await run_turn(FakeClient("nope", "still nope"), make_request())


async def test_run_turn_rejects_invalid_enum_value() -> None:
    bad = json.dumps({"reply": "x", "fields": {"termType": "forever"}})
    with pytest.raises(LlmError):
        await run_turn(FakeClient(bad, bad), make_request())


def test_build_messages_sends_whole_conversation_and_current_document() -> None:
    request = ChatRequest.model_validate(
        {
            "messages": [
                {"role": "assistant", "content": "Hi!"},
                {"role": "user", "content": "Acme"},
                {"role": "assistant", "content": "And the other party?"},
                {"role": "user", "content": "Beta"},
            ],
            "document": {"governingLaw": "Texas"},
        }
    )
    messages = build_messages(request)
    assert [m["role"] for m in messages] == ["system", "assistant", "user", "assistant", "user"]
    assert '"governingLaw": "Texas"' in messages[0]["content"]


def override(client: TestClient, fake: FakeClient) -> None:
    client.app.dependency_overrides[get_llm_client] = lambda: fake  # type: ignore[attr-defined]


BODY = {"messages": [{"role": "user", "content": "hi"}], "document": {}}


def test_chat_endpoint_returns_reply_and_fields(client: TestClient) -> None:
    override(client, FakeClient(GOOD))
    response = client.post("/api/chat", json=BODY)
    assert response.status_code == 200
    assert response.json()["fields"]["governingLaw"] == "Delaware"
    assert response.json()["reply"] == "Got it. What is the purpose?"


def test_chat_endpoint_maps_model_failure_to_502(client: TestClient) -> None:
    override(client, FakeClient(LlmError("The free AI model is busy right now.")))
    response = client.post("/api/chat", json=BODY)
    assert response.status_code == 502
    assert "busy" in response.json()["detail"]


def test_chat_endpoint_rejects_bad_role(client: TestClient) -> None:
    override(client, FakeClient(GOOD))
    body = {"messages": [{"role": "system", "content": "x"}], "document": {}}
    assert client.post("/api/chat", json=body).status_code == 422


def test_chat_endpoint_reports_missing_api_key(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "openrouter_api_key", "")
    response = client.post("/api/chat", json=BODY)
    assert response.status_code == 503


def patch_http(monkeypatch: pytest.MonkeyPatch, handler: Any) -> None:
    real = httpx.AsyncClient
    monkeypatch.setattr(
        httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw)
    )


async def test_openrouter_client_sends_model_schema_and_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "openrouter_api_key", "test-key")
    monkeypatch.setattr(settings, "model", "openrouter/free")
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": GOOD}}]})

    patch_http(monkeypatch, handler)
    out = await OpenRouterClient().complete([{"role": "user", "content": "hi"}], {"type": "object"})
    assert out == GOOD
    assert seen["auth"] == "Bearer test-key"
    assert seen["body"]["model"] == "openrouter/free"
    assert seen["body"]["response_format"]["type"] == "json_schema"
    assert seen["body"]["response_format"]["json_schema"]["schema"] == {"type": "object"}


@pytest.mark.parametrize(
    ("response", "expected"),
    [
        (httpx.Response(429), "busy"),
        (httpx.Response(500), r"error \(500\)"),
        (httpx.Response(200, json={"unexpected": True}), "unexpected"),
        (httpx.Response(200, json={"choices": [{"message": {"content": ""}}]}), "empty"),
    ],
)
async def test_openrouter_client_maps_failures(
    monkeypatch: pytest.MonkeyPatch, response: httpx.Response, expected: str
) -> None:
    patch_http(monkeypatch, lambda request: response)
    with pytest.raises(LlmError, match=expected):
        await OpenRouterClient().complete([], {})


async def test_openrouter_client_maps_network_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom")

    patch_http(monkeypatch, handler)
    with pytest.raises(LlmError, match="reach"):
        await OpenRouterClient().complete([], {})
