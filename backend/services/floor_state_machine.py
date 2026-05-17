"""
Floor table state machine.

Provides:
  - VALID_TRANSITIONS  — allowed status edges
  - get_allowed_transitions(status) -> list[str]
  - transition_table(db, company_id, table_id, to_status, ...) -> FloorTable
      Atomically transitions a table, writes FloorTableLog + FloorEvent.
      Does NOT commit — caller is responsible for db.commit().
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import models_pg

VALID_TRANSITIONS: dict[str, set[str]] = {
    "available":      {"reserved", "occupied", "blocked", "out_of_service"},
    "reserved":       {"occupied", "available", "blocked"},
    "occupied":       {"settling", "available"},
    "settling":       {"cleaning"},
    "cleaning":       {"available"},
    "blocked":        {"available", "out_of_service"},
    "out_of_service": {"available"},
}


def get_allowed_transitions(status: str) -> list[str]:
    """Return the list of valid next statuses from the given status."""
    return sorted(VALID_TRANSITIONS.get(status, set()))


async def transition_table(
    db: AsyncSession,
    company_id: str,
    table_id: str,
    to_status: str,
    changed_by_user_id: str | None,
    source: str = "manual",
    session_id: str | None = None,
    server_id: str | None = None,
) -> models_pg.FloorTable:
    """
    Atomically transition a FloorTable to a new status.

    Steps:
      1. SELECT FOR UPDATE to prevent races.
      2. Validate transition — raises HTTPException(422) if illegal.
      3. Compute duration_prev_ms from status_since → now.
      4. Update table.status + status_since.
      5. Write FloorTableLog.
      6. Write FloorEvent (event_type="table_state_changed").
      7. Return updated ORM object (caller must commit).
    """
    now = datetime.now(timezone.utc)

    # 1. Lock the row
    result = await db.execute(
        select(models_pg.FloorTable)
        .where(
            models_pg.FloorTable.id == table_id,
            models_pg.FloorTable.company_id == company_id,
        )
        .with_for_update()
    )
    table = result.scalar_one_or_none()

    if table is None:
        raise HTTPException(status_code=404, detail="Table not found")

    # 2. Validate transition
    allowed = VALID_TRANSITIONS.get(table.status, set())
    if to_status not in allowed:
        raise HTTPException(
            status_code=422,
            detail={
                "error": f"Cannot transition table from '{table.status}' to '{to_status}'",
                "current_status": table.status,
                "allowed_next_states": sorted(allowed),
            },
        )

    # 3. Compute duration in previous status
    duration_prev_ms: int | None = None
    if table.status_since:
        prev_since = table.status_since
        if prev_since.tzinfo is None:
            prev_since = prev_since.replace(tzinfo=timezone.utc)
        delta_ms = int((now - prev_since).total_seconds() * 1000)
        duration_prev_ms = max(0, delta_ms)

    from_status = table.status

    # 4. Update table
    table.status = to_status
    table.status_since = now
    table.updated_at = now
    if session_id is not None:
        table.current_session_id = session_id
    if server_id is not None:
        table.assigned_server_id = server_id

    # 5. Write log row
    log_entry = models_pg.FloorTableLog(
        table_id=table_id,
        company_id=company_id,
        from_status=from_status,
        to_status=to_status,
        session_id=session_id,
        server_id=server_id,
        changed_by_user_id=changed_by_user_id,
        changed_at=now,
        duration_prev_ms=duration_prev_ms,
        source=source,
    )
    db.add(log_entry)

    # 6. Write event row
    event = models_pg.FloorEvent(
        company_id=company_id,
        event_type="table_state_changed",
        actor_type="user" if changed_by_user_id else "system",
        actor_id=changed_by_user_id,
        payload={
            "table_id": table_id,
            "from_status": from_status,
            "to_status": to_status,
            "session_id": session_id,
            "allowed_next_states": get_allowed_transitions(to_status),
        },
        occurred_at=now,
    )
    db.add(event)

    # 7. Return (caller commits)
    return table
