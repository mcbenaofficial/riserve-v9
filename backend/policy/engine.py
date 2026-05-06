from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Optional, List

from langdetect import detect, LangDetectException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_runtime.structured_output import call_structured
from database_pg import engine
import models_pg
from policy.violations import PolicyViolationRecord, record_violation

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# PII regex patterns — each tuple is (name, compiled_pattern)
# ---------------------------------------------------------------------------
_PII_PATTERNS: List[tuple] = [
    (
        "indian_card",
        re.compile(r"\b[4-9]\d{3}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b"),
    ),
    (
        "otp_pin",
        re.compile(r"\b(otp|pin|password)\s*(?:is|:)?\s*\d{4,8}\b", re.IGNORECASE),
    ),
    (
        "aadhaar",
        re.compile(r"\b\d{4}\s\d{4}\s\d{4}\b"),
    ),
    (
        "pan",
        re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"),
    ),
    (
        "cvv",
        re.compile(r"\b(cvv|cvc|cvv2)\s*(?:is|:)?\s*\d{3,4}\b", re.IGNORECASE),
    ),
]

_TEMPLATE_VAR_PATTERN = re.compile(r"\{\{.+?\}\}")


# ---------------------------------------------------------------------------
# Safety classifier schema
# ---------------------------------------------------------------------------
class SafetyVerdict(BaseModel):
    verdict: str   # "SAFE" | "UNSAFE"
    reason: str


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------
@dataclass
class PolicyResult:
    passed: bool
    blocked: bool
    violations: List[PolicyViolationRecord]
    escalate_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------
async def check(
    tenant_id: str,
    message_text: str,
    channel: str,
    inbound_locale: Optional[str],
    agent_run_id: Optional[str] = None,
) -> PolicyResult:
    violations: List[PolicyViolationRecord] = []

    # --- Guardrail 1: PII Filter (hard block) ---
    for pattern_name, pattern in _PII_PATTERNS:
        if pattern.search(message_text):
            v = PolicyViolationRecord(
                kind="pii",
                severity="hard",
                detail=f"PII pattern detected: {pattern_name}",
                blocked=True,
            )
            violations.append(v)
            await record_violation(
                tenant_id=tenant_id,
                kind=v.kind,
                severity=v.severity,
                blocked=v.blocked,
                payload={"detail": v.detail, "message_preview": message_text[:100]},
                agent_run_id=agent_run_id,
            )
            return PolicyResult(
                passed=False,
                blocked=True,
                violations=violations,
                escalate_reason=v.detail,
            )

    # --- Guardrail 2: Forbidden Phrase Filter (soft) ---
    async with AsyncSession(engine) as db:
        bvp_result = await db.execute(
            select(models_pg.BrandVoiceProfile).where(
                models_pg.BrandVoiceProfile.tenant_id == tenant_id
            )
        )
        brand_voice = bvp_result.scalar_one_or_none()

    if brand_voice and brand_voice.dont_phrases:
        lower_text = message_text.lower()
        for phrase in brand_voice.dont_phrases:
            if phrase.lower() in lower_text:
                v = PolicyViolationRecord(
                    kind="forbidden_phrase",
                    severity="soft",
                    detail=f"Forbidden phrase: '{phrase}'",
                    blocked=False,
                )
                violations.append(v)
                await record_violation(
                    tenant_id=tenant_id,
                    kind=v.kind,
                    severity=v.severity,
                    blocked=v.blocked,
                    payload={"detail": v.detail, "phrase": phrase},
                    agent_run_id=agent_run_id,
                )

    # --- Guardrail 3: Compliance Check (soft for template vars) ---
    if channel == "whatsapp" and _TEMPLATE_VAR_PATTERN.search(message_text):
        v = PolicyViolationRecord(
            kind="compliance",
            severity="soft",
            detail="Template variables in free-form message",
            blocked=False,
        )
        violations.append(v)
        await record_violation(
            tenant_id=tenant_id,
            kind=v.kind,
            severity=v.severity,
            blocked=v.blocked,
            payload={"detail": v.detail},
            agent_run_id=agent_run_id,
        )

    # --- Guardrail 4: Safety Classifier (hard if UNSAFE) ---
    _SAFETY_SYSTEM = (
        "You are a content safety classifier for a hospitality business messaging system.\n"
        "Classify the following outbound message as SAFE or UNSAFE.\n\n"
        "UNSAFE if the message:\n"
        '- Makes promises the business cannot keep ("free meal for life", "100% guaranteed")\n'
        "- Contains medical or legal advice\n"
        "- Makes negative claims about other businesses\n"
        "- Contains inappropriate content for a professional hospitality context\n\n"
        'Respond with ONLY a JSON object: {"verdict": "SAFE"|"UNSAFE", "reason": "one sentence or empty string"}'
    )
    try:
        safety_messages = [
            {"role": "system", "content": _SAFETY_SYSTEM},
            {"role": "user", "content": message_text},
        ]
        verdict: SafetyVerdict = await call_structured(
            prompt_id="policy_safety/v1",
            messages=safety_messages,
            output_schema=SafetyVerdict,
            tenant_id=tenant_id,
            agent_name="policy_engine",
        )
        if verdict.verdict.upper() == "UNSAFE":
            v = PolicyViolationRecord(
                kind="safety",
                severity="hard",
                detail=verdict.reason,
                blocked=True,
            )
            violations.append(v)
            await record_violation(
                tenant_id=tenant_id,
                kind=v.kind,
                severity=v.severity,
                blocked=v.blocked,
                payload={"detail": v.detail, "message_preview": message_text[:100]},
                agent_run_id=agent_run_id,
            )
            return PolicyResult(
                passed=False,
                blocked=True,
                violations=violations,
                escalate_reason=v.detail,
            )
    except Exception as exc:
        # Safety check must never block sends on LLM failure
        logger.warning("Safety classifier failed for tenant %s; skipping: %s", tenant_id, exc)

    # --- Guardrail 5: Language Check (soft) ---
    if inbound_locale:
        try:
            reply_lang = detect(message_text)
            inbound_lang = inbound_locale[:2]
            if reply_lang != inbound_lang and inbound_lang != "en":
                v = PolicyViolationRecord(
                    kind="language_mismatch",
                    severity="soft",
                    detail=f"Reply in {reply_lang} but customer wrote in {inbound_locale[:2]}",
                    blocked=False,
                )
                violations.append(v)
                await record_violation(
                    tenant_id=tenant_id,
                    kind=v.kind,
                    severity=v.severity,
                    blocked=v.blocked,
                    payload={"detail": v.detail, "reply_lang": reply_lang, "inbound_locale": inbound_locale},
                    agent_run_id=agent_run_id,
                )
        except LangDetectException:
            pass

    return PolicyResult(
        passed=True,
        blocked=False,
        violations=violations,
    )
