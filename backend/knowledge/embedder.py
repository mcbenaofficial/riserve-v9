from __future__ import annotations
import os
import litellm

EMBED_MODEL = os.getenv("LITELLM_EMBED_MODEL", "openrouter/openai/text-embedding-3-small")


class EmbeddingError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


async def embed_text(text: str) -> list:
    try:
        response = await litellm.aembedding(model=EMBED_MODEL, input=text)
        return response.data[0]["embedding"]
    except Exception as exc:
        raise EmbeddingError(str(exc)) from exc


async def embed_batch(texts: list) -> list:
    try:
        response = await litellm.aembedding(model=EMBED_MODEL, input=texts)
        return [r["embedding"] for r in response.data]
    except Exception as exc:
        raise EmbeddingError(str(exc)) from exc
