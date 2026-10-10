"""OpenRouter client. Only this module knows about the HTTP API."""

from typing import Any, Protocol

import httpx

from app.config import settings


class LlmError(Exception):
    """The model call failed; `message` is safe to show to the user."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class LlmClient(Protocol):
    async def complete(self, messages: list[dict[str, str]], schema: dict[str, Any]) -> str:
        """Return the model's raw text for `messages`, constrained to the JSON `schema`."""
        ...


class OpenRouterClient:
    async def complete(self, messages: list[dict[str, str]], schema: dict[str, Any]) -> str:
        payload = {
            "model": settings.model,
            "messages": messages,
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "nda_turn", "strict": False, "schema": schema},
            },
        }
        headers = {"Authorization": f"Bearer {settings.openrouter_api_key}"}
        try:
            async with httpx.AsyncClient(timeout=60) as http:
                response = await http.post(
                    f"{settings.openrouter_base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                )
        except httpx.HTTPError as exc:
            raise LlmError("Could not reach the AI service. Please try again.") from exc

        if response.status_code == 429:
            raise LlmError("The free AI model is busy right now. Please try again in a moment.")
        if response.status_code != 200:
            raise LlmError(f"The AI service returned an error ({response.status_code}).")
        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError, ValueError) as exc:
            raise LlmError("The AI service returned an unexpected response.") from exc
        if not isinstance(content, str) or not content.strip():
            raise LlmError("The AI returned an empty response. Please try again.")
        return content
