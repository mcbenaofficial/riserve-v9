from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class EscalationDecision:
    should_escalate: bool
    rule: Optional[str] = None       # which rule fired
    reason: str = ""
    confidence_used: Optional[float] = None


# ── Rule patterns ──────────────────────────────────────────────────────────────

_HUMAN_REQUEST = re.compile(
    r"\b(speak|talk|chat)\s+(to|with)\s+(a\s+)?(human|person|manager|agent|supervisor|someone)\b"
    r"|\bmanager\b|\bsupervisor\b|\bescalat\b|\breal\s+person\b|\bhuman\s+agent\b",
    re.IGNORECASE,
)

_SAFETY_SIGNALS = re.compile(
    r"\bforeign\s+object\b|\bfound\s+(a\s+)?(bug|insect|hair|glass|metal|plastic)\b"
    r"|\binjur(ed|y)\b|\bsick\s+after\b|\bfood\s+poison(ing)?\b|\bhospital\b",
    re.IGNORECASE,
)

_LEGAL_SIGNALS = re.compile(
    r"\blegal\s+(action|complaint|counsel|team)\b|\battorney\b|\blawyer\b"
    r"|\bfile\s+a\s+(complaint|claim)\b|\bconsumer\s+(court|forum)\b|\bsue\b",
    re.IGNORECASE,
)

_BILLING_DISPUTE = re.compile(
    r"\bdouble\s+charge\b|\bcharged\s+twice\b|\bunauthori[sz]ed\s+charge\b"
    r"|\brefund\b|\bfraud(ulent)?\s+(charge|transaction)\b|\bwrong\s+amount\b",
    re.IGNORECASE,
)

_NEGATIVE_SENTIMENT = re.compile(
    r"\bterrible\b|\bdisgusting\b|\bunacceptable\b|\boutrageous\b"
    r"|\bworst\s+ever\b|\bhighly\s+disappointed\b|\bnever\s+coming\s+back\b"
    r"|\bcompletely\s+unacceptable\b|\bdemand\b",
    re.IGNORECASE,
)


def check_escalation(
    message_text: str,
    prior_messages: list[str],
    confidence_score: Optional[float] = None,
    confidence_threshold: float = 0.60,
) -> EscalationDecision:
    """
    Apply 7 escalation rules in priority order. Returns the first rule that fires.

    Rules:
      1. Customer explicitly requests a human / manager
      2. Safety complaint (foreign object, injury, food poisoning)
      3. Legal / regulatory complaint
      4. Billing dispute / double charge / refund demand
      5. Repeated message: customer sent the same text 3+ times recently
      6. Negative sentiment spike: 3+ consecutive messages with strong negative language
      7. Agent confidence below configured threshold
    """
    text = message_text or ""

    # Rule 1 — explicit human request
    if _HUMAN_REQUEST.search(text):
        return EscalationDecision(
            should_escalate=True,
            rule="explicit_human_request",
            reason="Customer explicitly requested a human agent or manager.",
        )

    # Rule 2 — safety
    if _SAFETY_SIGNALS.search(text):
        return EscalationDecision(
            should_escalate=True,
            rule="safety_complaint",
            reason="Safety-related complaint detected (foreign object / injury / illness).",
        )

    # Rule 3 — legal
    if _LEGAL_SIGNALS.search(text):
        return EscalationDecision(
            should_escalate=True,
            rule="legal_complaint",
            reason="Legal or regulatory complaint detected.",
        )

    # Rule 4 — billing dispute
    if _BILLING_DISPUTE.search(text):
        return EscalationDecision(
            should_escalate=True,
            rule="billing_dispute",
            reason="Billing dispute, double charge, or refund demand detected.",
        )

    # Rule 5 — repeated message (exact or near-exact)
    if prior_messages:
        stripped = text.strip().lower()
        repeat_count = sum(
            1 for m in prior_messages[-10:]
            if m.strip().lower() == stripped
        )
        if repeat_count >= 2:
            return EscalationDecision(
                should_escalate=True,
                rule="repeated_message",
                reason="Customer has sent the same message 3+ times without resolution.",
            )

    # Rule 6 — negative sentiment spike (3+ recent negative messages)
    if prior_messages:
        negative_run = 0
        for m in reversed(prior_messages[-6:]):
            if _NEGATIVE_SENTIMENT.search(m):
                negative_run += 1
            else:
                break
        # Include the current message
        if _NEGATIVE_SENTIMENT.search(text):
            negative_run += 1
        if negative_run >= 3:
            return EscalationDecision(
                should_escalate=True,
                rule="negative_sentiment_spike",
                reason=f"Detected {negative_run} consecutive messages with strong negative sentiment.",
            )

    # Rule 7 — low confidence
    if confidence_score is not None and confidence_score < confidence_threshold:
        return EscalationDecision(
            should_escalate=True,
            rule="low_confidence",
            reason=f"Agent confidence {confidence_score:.0%} is below threshold {confidence_threshold:.0%}.",
            confidence_used=confidence_score,
        )

    return EscalationDecision(should_escalate=False)
