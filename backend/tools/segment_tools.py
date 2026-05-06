from __future__ import annotations

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import engine
import models_pg
from tools.base import BaseTool, ToolResult
from tools.context import AgentExecutionContext

# Rule filter keys recognised for dry-run count estimation
_SUPPORTED_RULE_FILTERS = {"name_contains", "email_domain", "created_after"}


class SegmentPreviewCount(BaseTool):
    name = "segment.preview_count"
    description = (
        "Estimate how many customers would be in a segment without materialising it. "
        "Applies simple rule filters from the segment's JSONB rules."
    )
    scopes = ["segments:read"]

    async def execute(
        self,
        ctx: AgentExecutionContext,
        *,
        segment_id: str,
        tenant_id: str,
    ) -> ToolResult:
        async with AsyncSession(engine) as db:
            seg_result = await db.execute(
                select(models_pg.MktSegment).where(
                    models_pg.MktSegment.id == segment_id,
                    models_pg.MktSegment.company_id == tenant_id,
                )
            )
            segment = seg_result.scalar_one_or_none()

            if segment is None:
                return ToolResult(success=False, data=None, error="segment_not_found")

            rules = segment.rules or []

            # Build a parameterised WHERE clause from supported rule filters
            clauses = ["company_id = :company_id"]
            params: dict = {"company_id": tenant_id}

            for rule in rules:
                field = rule.get("field") if isinstance(rule, dict) else None
                value = rule.get("value") if isinstance(rule, dict) else None

                if field == "name_contains" and value:
                    clauses.append("name ILIKE :name_contains")
                    params["name_contains"] = f"%{value}%"
                elif field == "email_domain" and value:
                    clauses.append("email ILIKE :email_domain")
                    params["email_domain"] = f"%@{value}"
                elif field == "created_after" and value:
                    clauses.append("created_at >= :created_after")
                    params["created_after"] = value

            where_sql = " AND ".join(clauses)
            count_result = await db.execute(
                text(f"SELECT COUNT(*) FROM customers WHERE {where_sql}"),
                params,
            )
            count = count_result.scalar() or 0

        return ToolResult(
            success=True,
            data={"estimated_count": int(count), "note": "dry run"},
        )
