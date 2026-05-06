from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import engine
import models_pg
from models_pg import generate_uuid

logger = logging.getLogger(__name__)


@dataclass
class PolicyViolationRecord:
    kind: str       # pii, forbidden_phrase, compliance, safety, language_mismatch
    severity: str   # hard, soft
    detail: str     # human-readable reason
    blocked: bool


async def record_violation(
    tenant_id: str,
    kind: str,
    severity: str,
    blocked: bool,
    payload: dict,
    agent_run_id: Optional[str] = None,
) -> None:
    try:
        async with AsyncSession(engine) as db:
            row = models_pg.PolicyViolation(
                id=generate_uuid(),
                tenant_id=tenant_id,
                agent_run_id=agent_run_id,
                kind=kind,
                severity=severity,
                blocked=blocked,
                payload=payload,
            )
            db.add(row)
            await db.commit()
    except ProgrammingError:
        logger.warning(
            "policy_violations table not yet migrated; skipping persistence for kind=%s tenant=%s",
            kind,
            tenant_id,
        )
