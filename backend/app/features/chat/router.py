from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.config import settings
from app.features.chat.llm import LlmClient, LlmError, OpenRouterClient
from app.features.chat.schemas import ChatRequest, ChatResponse
from app.features.chat.service import run_turn

router = APIRouter(prefix="/api", tags=["chat"])


def get_llm_client() -> LlmClient:
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=503, detail="AI chat is not configured on the server.")
    return OpenRouterClient()


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest, client: Annotated[LlmClient, Depends(get_llm_client)]
) -> ChatResponse:
    try:
        return await run_turn(client, request)
    except LlmError as exc:
        raise HTTPException(status_code=502, detail=exc.message) from exc
