from __future__ import annotations

import asyncio
import logging
import uuid

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import engine
import models_pg
from tools.context import AgentExecutionContext

logger = logging.getLogger(__name__)

_AUTONOMY_MAP = {"L0": 0, "L1": 1, "L2": 2, "L3": 3, "L4": 4}


async def maybe_trigger_concierge(
    company_id: str,
    conversation_id: str,
    message_text: str,
) -> None:
    """
    Called after each inbound message is persisted.  Looks up the active
    Concierge config for the tenant; if found and is_active, fires the
    AgentRunner as a fire-and-forget task.  If shadow_mode is enabled on
    the config, a ShadowRunner also runs in parallel.
    Silently skips if no config exists or autonomy is L0 (disabled).
    """
    try:
        async with AsyncSession(engine) as db:
            config = (await db.execute(
                select(models_pg.AgentConfig).where(
                    models_pg.AgentConfig.tenant_id == company_id,
                    models_pg.AgentConfig.agent_name == "concierge",
                    models_pg.AgentConfig.is_active == True,
                )
            )).scalar_one_or_none()

        if not config:
            return

        autonomy_int = _AUTONOMY_MAP.get(config.autonomy_level or "L1", 1)
        if autonomy_int == 0:
            return

        from agents.concierge import build_runner

        ctx = AgentExecutionContext(
            tenant_id=company_id,
            agent_name="concierge",
            agent_run_id=str(uuid.uuid4()),
            conversation_id=conversation_id,
        )
        runner = build_runner(autonomy_level=autonomy_int, agent_id=config.id)
        asyncio.ensure_future(_run_safe(runner, ctx, conversation_id, message_text))

        # Shadow pass: runs in parallel, suppresses all write side-effects
        shadow_enabled = (config.allowed_tools or {}).get("shadow_mode", False)
        if shadow_enabled:
            from agents.shadow import ShadowRunner
            shadow_ctx = AgentExecutionContext(
                tenant_id=company_id,
                agent_name="concierge",
                agent_run_id=str(uuid.uuid4()),
                conversation_id=conversation_id,
            )
            shadow_tools = runner.tool_map.values()
            shadow_runner = ShadowRunner(
                tools=list(shadow_tools),
                tool_schemas=runner.tool_schemas,
                autonomy_level=autonomy_int,
                agent_id=config.id,
            )
            asyncio.ensure_future(
                _shadow_run_safe(shadow_runner, shadow_ctx, conversation_id, message_text)
            )

    except Exception:
        logger.exception(
            "maybe_trigger_concierge failed for conversation %s", conversation_id
        )


async def record_human_reply_diff(
    company_id: str,
    conversation_id: str,
    human_reply_text: str,
) -> None:
    """
    Called when a human agent posts an outbound message.  Finds the most
    recent completed shadow run for the conversation, computes a diff
    between the AI's shadow draft and the human reply, and stores the
    result on the AgentRun row.
    """
    try:
        async with AsyncSession(engine) as db:
            shadow_run = (await db.execute(
                select(models_pg.AgentRun)
                .where(
                    models_pg.AgentRun.tenant_id == company_id,
                    models_pg.AgentRun.conversation_id == conversation_id,
                    models_pg.AgentRun.trigger_type == "shadow",
                    models_pg.AgentRun.final_state == "completed",
                )
                .order_by(desc(models_pg.AgentRun.finished_at))
                .limit(1)
            )).scalar_one_or_none()

            if not shadow_run:
                return

            # Extract draft from the most recent llm_call step
            step = (await db.execute(
                select(models_pg.AgentStep)
                .where(
                    models_pg.AgentStep.agent_run_id == shadow_run.id,
                    models_pg.AgentStep.kind == "llm_call",
                )
                .order_by(desc(models_pg.AgentStep.step_index))
                .limit(1)
            )).scalar_one_or_none()

            ai_draft = ""
            if step and step.output:
                ai_draft = step.output.get("response_text", "")

        from agents.diff_report import compute_diff
        report = compute_diff(
            conversation_id=conversation_id,
            shadow_run_id=shadow_run.id,
            ai_draft=ai_draft,
            human_reply=human_reply_text,
        )

        async with AsyncSession(engine) as db:
            run_row = (await db.execute(
                select(models_pg.AgentRun).where(models_pg.AgentRun.id == shadow_run.id)
            )).scalar_one_or_none()
            if run_row:
                run_row.trigger_payload = {
                    **(run_row.trigger_payload or {}),
                    "diff_report": {
                        "token_overlap": report.token_overlap,
                        "quality_score": report.quality_score,
                        "verdict": report.verdict,
                        "notes": report.notes,
                        "length_ratio": report.length_ratio,
                        "ai_escalates_only": report.ai_escalates_only,
                        "human_escalates_only": report.human_escalates_only,
                    },
                }
                await db.commit()

        logger.info(
            "Shadow diff for conv %s: %s (score=%.2f)",
            conversation_id, report.verdict, report.quality_score,
        )

    except Exception:
        logger.exception("record_human_reply_diff failed for conv %s", conversation_id)


async def _run_safe(runner, ctx: AgentExecutionContext, conversation_id: str, text: str) -> None:
    try:
        state = await runner.run(ctx, conversation_id, text)
        logger.info(
            "Concierge run %s finished: %s (conv=%s)",
            ctx.agent_run_id, state, conversation_id,
        )
    except Exception:
        logger.exception("Concierge run %s crashed", ctx.agent_run_id)


async def _shadow_run_safe(
    runner,
    ctx: AgentExecutionContext,
    conversation_id: str,
    text: str,
) -> None:
    try:
        # Override trigger_type on the run row to "shadow" after it's created
        state = await runner.run(ctx, conversation_id, text)

        async with AsyncSession(engine) as db:
            run_row = (await db.execute(
                select(models_pg.AgentRun).where(models_pg.AgentRun.id == ctx.agent_run_id)
            )).scalar_one_or_none()
            if run_row:
                run_row.trigger_type = "shadow"
                run_row.trigger_payload = {
                    **(run_row.trigger_payload or {}),
                    "shadow_draft": runner.shadow_draft,
                    "suppressed_calls": runner.suppressed_calls,
                }
                await db.commit()

        logger.info(
            "Shadow run %s finished: %s (conv=%s, draft_len=%d)",
            ctx.agent_run_id, state, conversation_id, len(runner.shadow_draft),
        )
    except Exception:
        logger.exception("Shadow run %s crashed", ctx.agent_run_id)
