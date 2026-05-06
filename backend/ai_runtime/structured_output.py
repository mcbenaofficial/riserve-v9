from __future__ import annotations

import json
from typing import Type

from pydantic import BaseModel, ValidationError

from ai_runtime.exceptions import StructuredOutputError
from ai_runtime.gateway import call_model


def _make_tool_schema(output_schema: Type[BaseModel]) -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": "structured_output",
                "description": "Return the response in the required structured format.",
                "parameters": output_schema.model_json_schema(),
            },
        }
    ]


def _extract_and_validate(response, output_schema: Type[BaseModel]) -> BaseModel:
    if response.tool_calls:
        raw = response.tool_calls[0]["function"]["arguments"]
        data = json.loads(raw) if isinstance(raw, str) else raw
    else:
        data = json.loads(response.response_text)

    return output_schema.model_validate(data)


async def call_structured(
    prompt_id: str,
    messages: list[dict],
    output_schema: Type[BaseModel],
    tenant_id: str,
    agent_name: str,
) -> BaseModel:
    tools = _make_tool_schema(output_schema)
    schema_name = output_schema.__name__

    response = await call_model(
        prompt_id=prompt_id,
        messages=messages,
        tools=tools,
        tenant_id=tenant_id,
        agent_name=agent_name,
    )

    try:
        return _extract_and_validate(response, output_schema)
    except (ValidationError, Exception) as first_error:
        retry_messages = messages + [
            {
                "role": "user",
                "content": f"Validation failed: {first_error}. Please retry.",
            }
        ]
        retry_response = await call_model(
            prompt_id=prompt_id,
            messages=retry_messages,
            tools=tools,
            tenant_id=tenant_id,
            agent_name=agent_name,
        )

        try:
            return _extract_and_validate(retry_response, output_schema)
        except (ValidationError, Exception) as second_error:
            raise StructuredOutputError(schema_name, second_error) from second_error
