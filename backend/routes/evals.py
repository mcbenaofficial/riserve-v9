from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import engine
import models_pg
from routes.dependencies import get_current_user
from fastapi import Depends

router = APIRouter(prefix="/evals", tags=["Evals"])


class StartEvalRequest(BaseModel):
    case_ids: Optional[list[str]] = None
    tags: Optional[list[str]] = None
    autonomy_level: int = 1


class StartEvalResponse(BaseModel):
    eval_run_id: str
    message: str


@router.post("", response_model=StartEvalResponse)
async def start_eval(
    body: StartEvalRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
):
    """Trigger an async eval run against the golden dataset."""
    import uuid
    eval_run_id = str(uuid.uuid4())

    async def _run():
        from evals.runner import run_eval
        await run_eval(
            tenant_id=current_user.company_id,
            case_ids=body.case_ids,
            tags=body.tags,
            autonomy_level=body.autonomy_level,
        )

    background_tasks.add_task(_run)
    return StartEvalResponse(
        eval_run_id=eval_run_id,
        message="Eval run started. Check GET /api/evals for results.",
    )


@router.get("")
async def list_eval_runs(
    limit: int = 20,
    current_user=Depends(get_current_user),
):
    """List recent eval runs for this tenant."""
    async with AsyncSession(engine) as db:
        rows = (await db.execute(
            select(models_pg.EvalRun)
            .where(
                models_pg.EvalRun.dataset_id.like(f"%:{current_user.company_id}")
            )
            .order_by(desc(models_pg.EvalRun.run_at))
            .limit(limit)
        )).scalars().all()

    return [
        {
            "id": r.id,
            "dataset_id": r.dataset_id,
            "score": r.score,
            "regressions_count": len(r.regressions or []),
            "run_at": r.run_at.isoformat() if r.run_at else None,
        }
        for r in rows
    ]


@router.get("/{eval_run_id}")
async def get_eval_run(
    eval_run_id: str,
    current_user=Depends(get_current_user),
):
    """Get a specific eval run with full regression details."""
    async with AsyncSession(engine) as db:
        row = (await db.execute(
            select(models_pg.EvalRun).where(models_pg.EvalRun.id == eval_run_id)
        )).scalar_one_or_none()

    if not row:
        raise HTTPException(404, "Eval run not found")

    # Verify ownership via dataset_id suffix
    if not (row.dataset_id or "").endswith(f":{current_user.company_id}"):
        raise HTTPException(403, "Forbidden")

    return {
        "id": row.id,
        "dataset_id": row.dataset_id,
        "score": row.score,
        "regressions": row.regressions,
        "run_at": row.run_at.isoformat() if row.run_at else None,
    }
