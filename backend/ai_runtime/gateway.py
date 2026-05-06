from __future__ import annotations

import os
import logging
from dataclasses import dataclass
from typing import Optional

import litellm

from ai_runtime.exceptions import ModelGatewayError

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = os.environ.get("LITELLM_MODEL", "openrouter/openai/gpt-4o")


@dataclass
class ModelUsage:
    tokens_in: int
    tokens_out: int
    cost_usd: float


@dataclass
class ModelCallResult:
    response_text: str
    tool_calls: list[dict]
    usage: ModelUsage


async def call_model(
    prompt_id: str,
    messages: list[dict],
    tools: Optional[list[dict]],
    tenant_id: str,
    agent_name: str,
    model_override: Optional[str] = None,
) -> ModelCallResult:
    model = model_override or _DEFAULT_MODEL

    kwargs: dict = {"model": model, "messages": messages}
    if tools:
        kwargs["tools"] = tools

    try:
        response = await litellm.acompletion(**kwargs)
    except litellm.exceptions.AuthenticationError as exc:
        raise ModelGatewayError(str(exc), retryable=False) from exc
    except litellm.exceptions.RateLimitError as exc:
        raise ModelGatewayError(str(exc), retryable=True) from exc

    choice = response.choices[0]
    message = choice.message

    response_text = message.content or ""

    raw_tool_calls: list[dict] = []
    if hasattr(message, "tool_calls") and message.tool_calls:
        for tc in message.tool_calls:
            raw_tool_calls.append({
                "id": tc.id,
                "type": tc.type,
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                },
            })

    usage_obj = response.usage
    cost = litellm.completion_cost(completion_response=response)
    usage = ModelUsage(
        tokens_in=usage_obj.prompt_tokens if usage_obj else 0,
        tokens_out=usage_obj.completion_tokens if usage_obj else 0,
        cost_usd=cost or 0.0,
    )

    # Lazy import to avoid circular dependency
    from ai_runtime import cost_ledger
    await cost_ledger.record_usage(tenant_id, agent_name, usage)

    return ModelCallResult(
        response_text=response_text,
        tool_calls=raw_tool_calls,
        usage=usage,
    )
