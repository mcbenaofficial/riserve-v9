"""
Outbound message send pipeline.

Every agent reply, broadcast, and journey step flows through
enqueue_message().  The six gates are enforced in order:

  1. Customer / identity / inbox exists
  2. Company not suspended
  3. Consent (marketing sends only)
  4. Frequency cap (marketing sends only)
  5. Quiet hours (marketing sends only) — skips, does not block
  6. Channel service window — free-form outside window is blocked

Architecture note:
  Currently runs inline (awaited directly or via FastAPI BackgroundTasks).
  To migrate to Celery, replace the direct call in routes with a
  .delay() / .apply_async() call and move the function body into a
  @celery_app.task.  The six-gate logic is identical either way.
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import models_pg
from channels.base import OutboundContent
from channels.whatsapp_cloud import (
    WhatsAppCloudAdapter,
    InstagramAdapter,
    FacebookMessengerAdapter,
    TelegramAdapter,
    EmailAdapter,
    SMSAdapter,
)

logger = logging.getLogger(__name__)

# Keywords that immediately revoke marketing consent on any channel
STOP_KEYWORDS: frozenset[str] = frozenset(
    {"stop", "unsubscribe", "optout", "opt-out", "opt out", "cancel", "quit", "end"}
)

# Channel adapter registry — feature-flagged stubs ship dark
_ADAPTERS: dict[str, object] = {
    "whatsapp": WhatsAppCloudAdapter(),
    # Remaining adapters are stubs; enable per-tenant via inbox.feature_flags
    "instagram": InstagramAdapter(),
    "facebook": FacebookMessengerAdapter(),
    "telegram": TelegramAdapter(),
    "email": EmailAdapter(),
    "sms": SMSAdapter(),
}


def get_adapter(channel: str):
    adapter = _ADAPTERS.get(channel)
    if not adapter:
        raise NotImplementedError(f"No adapter registered for channel '{channel}'")
    return adapter


# ------------------------------------------------------------------
# Gate helpers
# ------------------------------------------------------------------

async def _check_consent(
    db: AsyncSession,
    company_id: str,
    customer_id: str,
    channel: str,
) -> bool:
    """Returns True if the most-recent marketing consent record is 'granted'."""
    result = await db.execute(
        select(models_pg.MktConsentLedger)
        .where(
            models_pg.MktConsentLedger.company_id == company_id,
            models_pg.MktConsentLedger.customer_id == customer_id,
            models_pg.MktConsentLedger.channel == channel,
            models_pg.MktConsentLedger.purpose == "marketing",
        )
        .order_by(models_pg.MktConsentLedger.occurred_at.desc())
        .limit(1)
    )
    record = result.scalar_one_or_none()
    return record is not None and record.status == "granted"


async def _check_frequency_cap(
    db: AsyncSession,
    company_id: str,
    customer_id: str,
    channel: str,
) -> tuple[bool, str | None]:
    """Returns (allowed, suppression_reason_or_None)."""
    result = await db.execute(
        select(models_pg.MktFrequencyCapConfig).where(
            models_pg.MktFrequencyCapConfig.company_id == company_id
        )
    )
    config = result.scalar_one_or_none()
    if config is None:
        return True, None  # no cap configured for this tenant

    today = date.today()
    count_result = await db.execute(
        select(models_pg.MktMessageSendCount).where(
            models_pg.MktMessageSendCount.company_id == company_id,
            models_pg.MktMessageSendCount.customer_id == customer_id,
            models_pg.MktMessageSendCount.channel == channel,
            models_pg.MktMessageSendCount.date == today,
        )
    )
    rec = count_result.scalar_one_or_none()
    daily_count = rec.count if rec else 0

    if daily_count >= config.max_per_day:
        return False, "cap_exceeded_daily"
    return True, None


def _in_quiet_hours(config: models_pg.MktFrequencyCapConfig | None, customer_tz: str | None) -> bool:
    """Returns True if the customer's local time falls in the configured quiet window."""
    if config is None:
        return False
    try:
        import pytz
        tz = pytz.timezone(customer_tz or "UTC")
        local_now = datetime.now(tz)
        current = local_now.strftime("%H:%M")
        start = config.quiet_hours_start or "22:00"
        end = config.quiet_hours_end or "08:00"
        if start <= end:
            return start <= current < end
        # Wraps midnight (e.g. 22:00 → 08:00)
        return current >= start or current < end
    except Exception:
        return False


async def _increment_send_count(
    db: AsyncSession,
    company_id: str,
    customer_id: str,
    channel: str,
) -> None:
    today = date.today()
    result = await db.execute(
        select(models_pg.MktMessageSendCount).where(
            models_pg.MktMessageSendCount.company_id == company_id,
            models_pg.MktMessageSendCount.customer_id == customer_id,
            models_pg.MktMessageSendCount.channel == channel,
            models_pg.MktMessageSendCount.date == today,
        )
    )
    rec = result.scalar_one_or_none()
    if rec:
        rec.count += 1
    else:
        db.add(models_pg.MktMessageSendCount(
            company_id=company_id,
            customer_id=customer_id,
            channel=channel,
            date=today,
            count=1,
        ))


# ------------------------------------------------------------------
# Main pipeline entrypoint
# ------------------------------------------------------------------

async def enqueue_message(
    db: AsyncSession,
    *,
    conversation_id: str,
    company_id: str,
    customer_id: str,
    channel: str,
    inbox_id: str,
    content: OutboundContent,
    sender_id: str,
    is_marketing: bool = False,
) -> dict:
    """
    Run all pipeline gates, then dispatch via the channel adapter.

    Returns:
        {
            "success": bool,
            "message_id": str | None,      # MktMessage.id if persisted
            "channel_message_id": str | None,
            "suppressed": bool,
            "reason": str | None,
        }
    """

    # Gate 1 — resolve customer, identity, inbox
    customer = (await db.execute(
        select(models_pg.Customer).where(
            models_pg.Customer.id == customer_id,
            models_pg.Customer.company_id == company_id,
        )
    )).scalar_one_or_none()
    if not customer:
        return _suppressed("customer_not_found")

    identity = (await db.execute(
        select(models_pg.MktCustomerIdentity).where(
            models_pg.MktCustomerIdentity.company_id == company_id,
            models_pg.MktCustomerIdentity.customer_id == customer_id,
            models_pg.MktCustomerIdentity.channel == channel,
        ).limit(1)
    )).scalar_one_or_none()
    if not identity:
        return _suppressed("no_channel_identity")

    inbox = (await db.execute(
        select(models_pg.MktInbox).where(
            models_pg.MktInbox.id == inbox_id,
            models_pg.MktInbox.company_id == company_id,
        )
    )).scalar_one_or_none()
    if not inbox:
        return _suppressed("inbox_not_found")

    # Gate 2 — company not suspended
    company = (await db.execute(
        select(models_pg.Company).where(models_pg.Company.id == company_id)
    )).scalar_one_or_none()
    if company and getattr(company, "status", None) == "suspended":
        return _suppressed("company_suspended")

    # Gates 3-5 apply to marketing sends only
    if is_marketing:
        # Gate 3 — consent
        if not await _check_consent(db, company_id, customer_id, channel):
            return _suppressed("no_consent")

        # Gate 4 — frequency cap
        allowed, cap_reason = await _check_frequency_cap(db, company_id, customer_id, channel)
        if not allowed:
            return _suppressed(cap_reason or "cap_exceeded")

        # Gate 5 — quiet hours (skip / reschedule; treated as suppression in v1)
        cap_config = (await db.execute(
            select(models_pg.MktFrequencyCapConfig).where(
                models_pg.MktFrequencyCapConfig.company_id == company_id
            )
        )).scalar_one_or_none()
        customer_tz = getattr(customer, "timezone", None)
        if _in_quiet_hours(cap_config, customer_tz):
            return _suppressed("quiet_hours")

    # Gate 6 — channel service window for free-form messages
    adapter = get_adapter(channel)
    last_conv = (await db.execute(
        select(models_pg.MktConversation).where(
            models_pg.MktConversation.company_id == company_id,
            models_pg.MktConversation.customer_identity_id == identity.id,
        ).order_by(models_pg.MktConversation.last_customer_message_at.desc()).limit(1)
    )).scalar_one_or_none()
    last_inbound_at = last_conv.last_customer_message_at if last_conv else None

    if content.content_type == "text" and not adapter.supports_freeform(last_inbound_at=last_inbound_at):
        return _suppressed("outside_service_window_use_template")

    # --- All gates passed — send ---
    idempotency_key = str(uuid.uuid4())
    result = await adapter.send(
        inbox=inbox,
        to=identity,
        content=content,
        idempotency_key=idempotency_key,
    )

    now = datetime.now(timezone.utc)
    msg = models_pg.MktMessage(
        company_id=company_id,
        conversation_id=conversation_id,
        direction="out",
        sender_type="agent",
        sender_id=sender_id,
        content_type=content.content_type,
        content_text=content.text,
        channel_message_id=result.channel_message_id,
        delivery_status="sent" if result.success else "failed",
        error_code=result.error if not result.success else None,
        sent_at=now if result.success else None,
        raw=result.raw_response or {},
    )
    db.add(msg)

    if is_marketing and result.success:
        await _increment_send_count(db, company_id, customer_id, channel)

    # Update conversation last_message_at
    if last_conv:
        last_conv.last_message_at = now

    await db.commit()
    await db.refresh(msg)

    return {
        "success": result.success,
        "message_id": msg.id,
        "channel_message_id": result.channel_message_id,
        "suppressed": False,
        "reason": result.error if not result.success else None,
    }


def _suppressed(reason: str) -> dict:
    logger.info("Message suppressed: %s", reason)
    return {"success": False, "message_id": None, "channel_message_id": None,
            "suppressed": True, "reason": reason}
