from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import engine
from tools.context import AgentExecutionContext

logger = logging.getLogger(__name__)


@dataclass
class ToolResult:
    success: bool
    data: Optional[dict]
    error: Optional[str] = None


async def _log_tool_call(
    ctx: AgentExecutionContext,
    tool_name: str,
    scopes: list,
    kwargs: dict,
    result: Optional[ToolResult],
    duration_s: float,
    error: Optional[str],
) -> None:
    try:
        async with AsyncSession(engine) as db:
            await db.execute(
                text(
                    """
                    INSERT INTO tool_call_log
                        (tenant_id, agent_name, agent_run_id, conversation_id,
                         idempotency_key, tool_name, scopes, kwargs,
                         success, result_data, error, duration_s, called_at)
                    VALUES
                        (:tenant_id, :agent_name, :agent_run_id, :conversation_id,
                         :idempotency_key, :tool_name, :scopes::jsonb, :kwargs::jsonb,
                         :success, :result_data::jsonb, :error, :duration_s, :called_at)
                    """
                ),
                {
                    "tenant_id": ctx.tenant_id,
                    "agent_name": ctx.agent_name,
                    "agent_run_id": ctx.agent_run_id,
                    "conversation_id": ctx.conversation_id,
                    "idempotency_key": ctx.idempotency_key,
                    "tool_name": tool_name,
                    "scopes": __import__("json").dumps(scopes),
                    "kwargs": __import__("json").dumps(kwargs, default=str),
                    "success": result.success if result else False,
                    "result_data": __import__("json").dumps(result.data, default=str) if result and result.data else "null",
                    "error": error,
                    "duration_s": duration_s,
                    "called_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            await db.commit()
    except ProgrammingError:
        # Table not yet created — tools must remain usable before Phase B migration runs
        logger.warning("tool_call_log table not found; skipping audit write for %s", tool_name)
    except Exception as exc:
        logger.warning("Failed to write tool_call_log for %s: %s", tool_name, exc)


class BaseTool(ABC):
    name: str          # namespaced, e.g. "inbox.send_reply"
    description: str   # what the agent should know
    scopes: list       # e.g. ["inbox:write"]
    requires_human_approval: bool = False

    @abstractmethod
    async def execute(self, ctx: AgentExecutionContext, **kwargs) -> ToolResult: ...

    async def run(self, ctx: AgentExecutionContext, **kwargs) -> ToolResult:
        """Wraps execute() with audit logging to tool_call_log table."""
        start = time.monotonic()
        error = None
        result = None
        try:
            result = await self.execute(ctx, **kwargs)
        except Exception as exc:
            error = str(exc)
            result = ToolResult(success=False, data=None, error=error)
        finally:
            await _log_tool_call(
                ctx,
                self.name,
                self.scopes,
                kwargs,
                result,
                time.monotonic() - start,
                error,
            )
        return result
