from __future__ import annotations

import logging
import os
from datetime import date

import sqlalchemy.exc
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import engine
from ai_runtime.exceptions import DailyCostCapExceeded

logger = logging.getLogger(__name__)

_DAILY_CAP = float(os.environ.get("AGENT_DAILY_COST_CAP_USD", "5.0"))

_UPSERT_SQL = text("""
    INSERT INTO agent_cost_daily (id, tenant_id, agent_name, date, tokens_in, tokens_out, cost_usd)
    VALUES (gen_random_uuid()::text, :tenant_id, :agent_name, :date, :tokens_in, :tokens_out, :cost_usd)
    ON CONFLICT (tenant_id, agent_name, date)
    DO UPDATE SET
        tokens_in  = agent_cost_daily.tokens_in  + EXCLUDED.tokens_in,
        tokens_out = agent_cost_daily.tokens_out + EXCLUDED.tokens_out,
        cost_usd   = agent_cost_daily.cost_usd   + EXCLUDED.cost_usd
""")

_DAILY_TOTAL_SQL = text("""
    SELECT COALESCE(SUM(cost_usd), 0)
    FROM agent_cost_daily
    WHERE tenant_id = :tenant_id AND date = :date
""")


async def record_usage(tenant_id: str, agent_name: str, usage) -> None:
    try:
        async with AsyncSession(engine) as session:
            await session.execute(_UPSERT_SQL, {
                "tenant_id": tenant_id,
                "agent_name": agent_name,
                "date": date.today(),
                "tokens_in": usage.tokens_in,
                "tokens_out": usage.tokens_out,
                "cost_usd": usage.cost_usd,
            })
            await session.commit()
    except sqlalchemy.exc.ProgrammingError:
        # Table not yet migrated; agents must not crash before migrations run
        logger.warning("agent_cost_daily table does not exist; skipping cost record")


async def get_daily_spend(tenant_id: str) -> float:
    try:
        async with AsyncSession(engine) as session:
            result = await session.execute(_DAILY_TOTAL_SQL, {
                "tenant_id": tenant_id,
                "date": date.today(),
            })
            return float(result.scalar() or 0.0)
    except sqlalchemy.exc.ProgrammingError:
        logger.warning("agent_cost_daily table does not exist; reporting $0 spend")
        return 0.0


async def check_daily_cap(tenant_id: str) -> None:
    spend = await get_daily_spend(tenant_id)
    if spend >= _DAILY_CAP:
        raise DailyCostCapExceeded(tenant_id, spend, _DAILY_CAP)
