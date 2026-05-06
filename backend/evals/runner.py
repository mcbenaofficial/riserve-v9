from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import engine
import models_pg
from tools.context import AgentExecutionContext
from agents.concierge import build_runner
from evals.dataset import EvalCase, GOLDEN_DATASET

logger = logging.getLogger(__name__)


@dataclass
class EvalResult:
    case_id: str
    final_state: str
    draft_text: str = ""
    tools_called: list[str] = field(default_factory=list)
    # Scoring
    tool_precision: float = 0.0   # fraction of called tools that were expected
    tool_recall: float = 0.0      # fraction of expected tools that were called
    response_hit_rate: float = 0.0  # fraction of expected_response_contains found
    escalation_correct: bool = True
    passed: bool = False
    error: Optional[str] = None


@dataclass
class EvalRunSummary:
    eval_run_id: str
    tenant_id: str
    agent_name: str
    total: int
    passed: int
    failed: int
    avg_tool_precision: float
    avg_tool_recall: float
    avg_response_hit_rate: float
    pass_rate: float
    started_at: datetime
    finished_at: Optional[datetime] = None
    results: list[EvalResult] = field(default_factory=list)


class _DraftCapture:
    """Patches add_internal_note to capture draft text emitted during eval."""

    def __init__(self):
        self.notes: list[str] = []

    def extract_draft(self, body: str) -> None:
        if body.startswith("[DRAFT] "):
            self.notes.append(body[len("[DRAFT] "):])
        else:
            self.notes.append(body)


async def _run_case(
    case: EvalCase,
    tenant_id: str,
    autonomy_level: int = 1,
    capture: _DraftCapture = None,
) -> EvalResult:
    """Execute one eval case and return a scored EvalResult."""
    run_id = str(uuid.uuid4())
    ctx = AgentExecutionContext(
        tenant_id=tenant_id,
        agent_name="concierge",
        agent_run_id=run_id,
        conversation_id=f"eval-{case.id}",
    )

    tools_called: list[str] = []
    draft_text = ""

    # Use a fake conversation_id so eval runs don't need real DB conversations
    runner = build_runner(autonomy_level=autonomy_level)

    # Monkey-patch tool dispatch to record which tools were called
    original_dispatch = runner._dispatch

    async def _tracking_dispatch(_ctx, _conv_id, name, args):
        tools_called.append(name)
        return await original_dispatch(_ctx, _conv_id, name, args)

    runner._dispatch = _tracking_dispatch  # type: ignore[method-assign]

    async def _capture_post(_ctx, _conv_id, text):
        nonlocal draft_text
        draft_text = text
        if capture:
            capture.extract_draft(text)

    runner._post_draft_note = _capture_post  # type: ignore[method-assign]

    try:
        final_state = await runner.run(ctx, f"eval-{case.id}", case.inbound)
    except Exception as exc:
        return EvalResult(
            case_id=case.id,
            final_state="error",
            error=str(exc),
        )

    # ── Scoring ──────────────────────────────────────────────────────────
    expected_set = set(case.expected_tool_calls)
    called_set = set(tools_called)

    if called_set:
        tool_precision = len(called_set & expected_set) / len(called_set)
    else:
        tool_precision = 1.0 if not expected_set else 0.0

    if expected_set:
        tool_recall = len(called_set & expected_set) / len(expected_set)
    else:
        tool_recall = 1.0

    combined_draft = draft_text.lower()
    hits = sum(
        1 for phrase in case.expected_response_contains
        if phrase.lower() in combined_draft
    )
    response_hit_rate = hits / len(case.expected_response_contains) if case.expected_response_contains else 1.0

    escalation_correct = True
    if case.should_escalate:
        escalation_correct = "inbox.assign_to_human" in called_set

    passed = (
        tool_recall >= 0.5
        and response_hit_rate >= 0.5
        and escalation_correct
        and final_state not in ("error", "cost_cap")
    )

    return EvalResult(
        case_id=case.id,
        final_state=final_state,
        draft_text=draft_text,
        tools_called=tools_called,
        tool_precision=tool_precision,
        tool_recall=tool_recall,
        response_hit_rate=response_hit_rate,
        escalation_correct=escalation_correct,
        passed=passed,
    )


async def run_eval(
    tenant_id: str,
    case_ids: list[str] | None = None,
    tags: list[str] | None = None,
    autonomy_level: int = 1,
) -> EvalRunSummary:
    """
    Run the eval harness.  Filters by case_ids or tags if provided,
    otherwise runs the full golden dataset.  Persists results to eval_runs.
    """
    eval_run_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)

    # Filter dataset
    cases = GOLDEN_DATASET
    if case_ids:
        id_set = set(case_ids)
        cases = [c for c in cases if c.id in id_set]
    if tags:
        tag_set = set(tags)
        cases = [c for c in cases if tag_set & set(c.tags)]

    logger.info("Starting eval run %s — %d cases", eval_run_id, len(cases))

    # Run cases concurrently (max 4 at a time to avoid LLM rate limits)
    semaphore = asyncio.Semaphore(4)

    async def _bounded(case: EvalCase) -> EvalResult:
        async with semaphore:
            return await _run_case(case, tenant_id, autonomy_level)

    results = await asyncio.gather(*[_bounded(c) for c in cases])

    finished_at = datetime.now(timezone.utc)

    passed_count = sum(1 for r in results if r.passed)
    avg_prec = sum(r.tool_precision for r in results) / len(results) if results else 0.0
    avg_rec = sum(r.tool_recall for r in results) / len(results) if results else 0.0
    avg_hit = sum(r.response_hit_rate for r in results) / len(results) if results else 0.0

    summary = EvalRunSummary(
        eval_run_id=eval_run_id,
        tenant_id=tenant_id,
        agent_name="concierge",
        total=len(results),
        passed=passed_count,
        failed=len(results) - passed_count,
        avg_tool_precision=avg_prec,
        avg_tool_recall=avg_rec,
        avg_response_hit_rate=avg_hit,
        pass_rate=passed_count / len(results) if results else 0.0,
        started_at=started_at,
        finished_at=finished_at,
        results=list(results),
    )

    # Persist to eval_runs (schema: id, dataset_id, score, regressions, run_at)
    try:
        async with AsyncSession(engine) as db:
            row = models_pg.EvalRun(
                id=eval_run_id,
                dataset_id=f"golden-v1:{tenant_id}",
                score={
                    "tenant_id": tenant_id,
                    "agent_name": "concierge",
                    "total": len(results),
                    "passed": passed_count,
                    "pass_rate": summary.pass_rate,
                    "avg_tool_precision": avg_prec,
                    "avg_tool_recall": avg_rec,
                    "avg_response_hit_rate": avg_hit,
                    "started_at": started_at.isoformat(),
                    "finished_at": finished_at.isoformat(),
                },
                regressions=[
                    {"case_id": r.case_id, "error": r.error or r.final_state}
                    for r in results if not r.passed
                ],
                run_at=started_at,
            )
            db.add(row)
            await db.commit()
    except Exception as exc:
        logger.warning("Failed to persist eval run: %s", exc)

    logger.info(
        "Eval run %s complete — %d/%d passed (%.0f%%)",
        eval_run_id, passed_count, len(results), summary.pass_rate * 100,
    )
    return summary
