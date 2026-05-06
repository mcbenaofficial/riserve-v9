from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import engine
import models_pg
from tools.base import BaseTool, ToolResult
from tools.context import AgentExecutionContext


class TemplateFind(BaseTool):
    name = "template.find"
    description = "Search active message templates for a given channel, optionally filtered by keyword."
    scopes = ["templates:read"]

    async def execute(
        self,
        ctx: AgentExecutionContext,
        *,
        channel: str,
        tenant_id: str,
        keyword: Optional[str] = None,
    ) -> ToolResult:
        async with AsyncSession(engine) as db:
            query = select(models_pg.MktTemplate).where(
                models_pg.MktTemplate.company_id == tenant_id,
                models_pg.MktTemplate.channel == channel,
                models_pg.MktTemplate.is_active.is_(True),
            )

            if keyword:
                query = query.where(
                    models_pg.MktTemplate.name.ilike(f"%{keyword}%")
                )

            result = await db.execute(query)
            templates = result.scalars().all()

        rows = [
            {
                "id": t.id,
                "name": t.name,
                "channel": t.channel,
                "body_preview": (t.body or "")[:120],
            }
            for t in templates
        ]
        return ToolResult(success=True, data={"templates": rows})
