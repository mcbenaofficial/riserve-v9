from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import engine
import models_pg
from models_pg import generate_uuid
from ai_runtime.gateway import call_model
from ai_runtime.prompt_registry import get_prompt
from ai_runtime.exceptions import ModelGatewayError, DailyCostCapExceeded
from tools.base import BaseTool, ToolResult
from tools.context import AgentExecutionContext

logger = logging.getLogger(__name__)

AGENT_NAME = "concierge"
MAX_ITERATIONS = 8


class AgentRunner:
    """
    Drives a ReAct loop for the Concierge agent.
    At autonomy L1 (suggest), inbox.send_reply is intercepted and the
    draft text is posted as an internal note prefixed with [DRAFT].
    """

    def __init__(
        self,
        tools: list[BaseTool],
        tool_schemas: list[dict],
        autonomy_level: int = 1,
        agent_id: Optional[str] = None,
    ):
        self.tool_map: dict[str, BaseTool] = {t.name: t for t in tools}
        self.tool_schemas = tool_schemas
        self.autonomy_level = autonomy_level
        self.agent_id = agent_id

    async def run(
        self,
        ctx: AgentExecutionContext,
        conversation_id: str,
        inbound_text: str,
    ) -> str:
        """Create an AgentRun row, execute the loop, finalize. Returns final_state string."""
        total_tokens_in = 0
        total_tokens_out = 0
        total_cost = 0.0

        async with AsyncSession(engine) as db:
            run_row = models_pg.AgentRun(
                id=ctx.agent_run_id,
                tenant_id=ctx.tenant_id,
                agent_id=self.agent_id,
                trigger_type="inbound_message",
                trigger_payload={"conversation_id": conversation_id},
                conversation_id=conversation_id,
                final_state="running",
                started_at=datetime.now(timezone.utc),
            )
            db.add(run_row)
            await db.commit()

        final_state = "error"
        try:
            final_state, total_tokens_in, total_tokens_out, total_cost = await self._loop(
                ctx, conversation_id, inbound_text
            )
        except DailyCostCapExceeded:
            logger.warning("Daily cost cap exceeded for tenant %s", ctx.tenant_id)
            final_state = "cost_cap"
        except Exception:
            logger.exception("AgentRunner error for run %s", ctx.agent_run_id)
            final_state = "error"

        async with AsyncSession(engine) as db:
            run_row = (await db.execute(
                select(models_pg.AgentRun).where(models_pg.AgentRun.id == ctx.agent_run_id)
            )).scalar_one_or_none()
            if run_row:
                run_row.final_state = final_state
                run_row.finished_at = datetime.now(timezone.utc)
                run_row.total_tokens_in = total_tokens_in
                run_row.total_tokens_out = total_tokens_out
                run_row.total_cost_usd = total_cost
                await db.commit()

        return final_state

    async def _loop(
        self,
        ctx: AgentExecutionContext,
        conversation_id: str,
        inbound_text: str,
    ) -> tuple[str, int, int, float]:
        system_prompt = get_prompt(AGENT_NAME)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": inbound_text},
        ]

        total_tokens_in = 0
        total_tokens_out = 0
        total_cost = 0.0
        step_index = 0

        for iteration in range(MAX_ITERATIONS):
            t0 = time.monotonic()
            result = await call_model(
                prompt_id=f"{AGENT_NAME}/v1",
                messages=messages,
                tools=self.tool_schemas if self.tool_schemas else None,
                tenant_id=ctx.tenant_id,
                agent_name=AGENT_NAME,
            )
            latency_ms = int((time.monotonic() - t0) * 1000)

            total_tokens_in += result.usage.tokens_in
            total_tokens_out += result.usage.tokens_out
            total_cost += result.usage.cost_usd

            await self._record_step(ctx, step_index, "llm_call", {
                "iteration": iteration,
                "tokens_in": result.usage.tokens_in,
                "tokens_out": result.usage.tokens_out,
                "has_tool_calls": bool(result.tool_calls),
            }, {
                "response_text": result.response_text[:500] if result.response_text else None,
            }, latency_ms)
            step_index += 1

            if not result.tool_calls:
                # Final response — at L1 post as draft note
                if result.response_text:
                    await self._post_draft_note(ctx, conversation_id, result.response_text)
                return "completed", total_tokens_in, total_tokens_out, total_cost

            # Append assistant turn with tool calls
            assistant_msg: dict = {"role": "assistant"}
            if result.response_text:
                assistant_msg["content"] = result.response_text
            assistant_msg["tool_calls"] = result.tool_calls
            messages.append(assistant_msg)

            for tc in result.tool_calls:
                fn_name = tc["function"]["name"]
                try:
                    fn_args = json.loads(tc["function"]["arguments"] or "{}")
                except json.JSONDecodeError:
                    fn_args = {}

                t0 = time.monotonic()
                tool_result = await self._dispatch(ctx, conversation_id, fn_name, fn_args)
                tool_latency = int((time.monotonic() - t0) * 1000)

                await self._record_step(ctx, step_index, "tool_call", {
                    "tool": fn_name,
                    "args": fn_args,
                }, {
                    "success": tool_result.success,
                    "data": tool_result.data,
                    "error": tool_result.error,
                }, tool_latency)
                step_index += 1

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(
                        tool_result.data if tool_result.success else {"error": tool_result.error}
                    ),
                })

        return "max_iterations", total_tokens_in, total_tokens_out, total_cost

    async def _dispatch(
        self,
        ctx: AgentExecutionContext,
        conversation_id: str,
        name: str,
        args: dict,
    ) -> ToolResult:
        # L1 gate: intercept send_reply → post draft note instead
        if name == "inbox.send_reply" and self.autonomy_level < 2:
            body = args.get("body", "")
            note_tool = self.tool_map.get("inbox.add_internal_note")
            if note_tool:
                return await note_tool.execute(
                    ctx,
                    conversation_id=args.get("conversation_id", conversation_id),
                    body=f"[DRAFT] {body}",
                )
            return ToolResult(success=False, data=None, error="note_tool_missing")

        tool = self.tool_map.get(name)
        if not tool:
            return ToolResult(success=False, data=None, error=f"unknown_tool:{name}")

        if "conversation_id" not in args:
            args = {"conversation_id": conversation_id, **args}

        return await tool.run(ctx, **args)

    async def _post_draft_note(
        self,
        ctx: AgentExecutionContext,
        conversation_id: str,
        text: str,
    ) -> None:
        tool = self.tool_map.get("inbox.add_internal_note")
        if tool:
            try:
                await tool.execute(ctx, conversation_id=conversation_id, body=f"[DRAFT] {text}")
            except Exception as exc:
                logger.warning("Failed to post draft note: %s", exc)

    async def _record_step(
        self,
        ctx: AgentExecutionContext,
        step_index: int,
        kind: str,
        input_data: dict,
        output_data: dict,
        latency_ms: int,
    ) -> None:
        try:
            async with AsyncSession(engine) as db:
                step = models_pg.AgentStep(
                    id=generate_uuid(),
                    agent_run_id=ctx.agent_run_id,
                    step_index=step_index,
                    kind=kind,
                    input=input_data,
                    output=output_data,
                    latency_ms=latency_ms,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(step)
                await db.commit()
        except Exception as exc:
            logger.warning("Failed to record agent step: %s", exc)
