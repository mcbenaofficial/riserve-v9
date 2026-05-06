from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class DiffReport:
    conversation_id: str
    shadow_run_id: str
    ai_draft: str
    human_reply: str
    # Token-level overlap
    token_overlap: float          # Jaccard similarity of lowercased word sets
    # Structural signals
    both_escalate: bool           # both AI and human routed to a human
    ai_escalates_only: bool       # AI wanted to escalate, human didn't
    human_escalates_only: bool    # Human escalated without AI suggesting it
    length_ratio: float           # len(ai_draft) / max(len(human_reply), 1)
    # Verdict
    quality_score: float          # 0–1 composite; higher = AI draft was closer to human reply
    verdict: str                  # "good", "acceptable", "needs_improvement"
    notes: list[str] = field(default_factory=list)


_ESCALATION_SIGNALS = frozenset({
    "manager", "escalat", "human agent", "team member",
    "call us", "contact us", "speak to",
})


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"\b\w+\b", text.lower()))


def _has_escalation_signal(text: str) -> bool:
    lower = text.lower()
    return any(sig in lower for sig in _ESCALATION_SIGNALS)


def compute_diff(
    conversation_id: str,
    shadow_run_id: str,
    ai_draft: str,
    human_reply: str,
) -> DiffReport:
    """
    Compute a lightweight similarity report between the AI's shadow draft
    and the human agent's actual reply.  No LLM call — pure heuristics.
    """
    ai_tokens = _tokenize(ai_draft)
    human_tokens = _tokenize(human_reply)

    union = ai_tokens | human_tokens
    intersection = ai_tokens & human_tokens
    token_overlap = len(intersection) / len(union) if union else 0.0

    ai_esc = _has_escalation_signal(ai_draft)
    human_esc = _has_escalation_signal(human_reply)

    length_ratio = len(ai_draft) / max(len(human_reply), 1)

    notes: list[str] = []

    # ── Quality scoring ────────────────────────────────────────────────
    score = token_overlap  # base: word overlap

    # Escalation agreement bonus / penalty
    if ai_esc == human_esc:
        score += 0.15
    else:
        score -= 0.20
        if ai_esc and not human_esc:
            notes.append("AI over-escalated: suggested human handoff, human replied directly")
        else:
            notes.append("AI under-escalated: human escalated but AI did not suggest it")

    # Length sanity (penalise extreme length mismatch)
    if length_ratio < 0.3:
        score -= 0.10
        notes.append("AI draft was much shorter than human reply")
    elif length_ratio > 3.0:
        score -= 0.05
        notes.append("AI draft was much longer than human reply")

    score = max(0.0, min(1.0, score))

    if score >= 0.65:
        verdict = "good"
    elif score >= 0.40:
        verdict = "acceptable"
    else:
        verdict = "needs_improvement"

    return DiffReport(
        conversation_id=conversation_id,
        shadow_run_id=shadow_run_id,
        ai_draft=ai_draft,
        human_reply=human_reply,
        token_overlap=token_overlap,
        both_escalate=ai_esc and human_esc,
        ai_escalates_only=ai_esc and not human_esc,
        human_escalates_only=human_esc and not ai_esc,
        length_ratio=length_ratio,
        quality_score=score,
        verdict=verdict,
        notes=notes,
    )
