"""
Webhook ingestion routes.

One route per channel: POST /webhooks/{channel}/{inbox_id}
Each handler:
  1. Verifies the HMAC signature (where applicable)
  2. Returns 200 immediately after logging the raw event + enqueuing background work
  3. Background task: identity resolution → conversation upsert → message insert → WS broadcast

Currently uses FastAPI BackgroundTasks (no Redis/Celery required).
To migrate: wrap _process_* functions in @celery_app.task and call .delay() here.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import models_pg
from channels.whatsapp_cloud import (
    WhatsAppCloudAdapter,
    InstagramAdapter,
    FacebookMessengerAdapter,
    TelegramAdapter,
    EmailAdapter,
    SMSAdapter,
)
from channels.base import InboundEvent
from database_pg import engine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

_WA_ADAPTER = WhatsAppCloudAdapter()
_IG_ADAPTER = InstagramAdapter()
_FB_ADAPTER = FacebookMessengerAdapter()
_TG_ADAPTER = TelegramAdapter()
_EMAIL_ADAPTER = EmailAdapter()
_SMS_ADAPTER = SMSAdapter()

# Keywords that immediately revoke marketing consent
STOP_KEYWORDS: frozenset = frozenset(
    {"stop", "unsubscribe", "optout", "opt-out", "opt out", "cancel", "quit", "end"}
)


# ------------------------------------------------------------------
# Shared helpers
# ------------------------------------------------------------------

async def _save_raw_event(db: AsyncSession, channel: str, inbox_id: str, payload: dict) -> str:
    """Insert a MktWebhookRawEvent and return its ID."""
    raw_event = models_pg.MktWebhookRawEvent(
        channel=channel,
        inbox_id=inbox_id,
        payload=payload,
    )
    db.add(raw_event)
    await db.commit()
    return raw_event.id


async def _mark_processed(db: AsyncSession, raw_event_id: str, error: str = None) -> None:
    raw_ev = (await db.execute(
        select(models_pg.MktWebhookRawEvent).where(
            models_pg.MktWebhookRawEvent.id == raw_event_id
        )
    )).scalar_one_or_none()
    if raw_ev:
        if error:
            raw_ev.error = error
        else:
            raw_ev.processed = True
            raw_ev.processed_at = datetime.now(timezone.utc)
    await db.commit()


def _meta_verify_challenge(p, inbox):
    """Return the challenge int if mode/token match, else raise 403."""
    mode = p.get("hub.mode")
    token = p.get("hub.verify_token")
    challenge = p.get("hub.challenge")
    if mode == "subscribe" and token == inbox.webhook_secret:
        return int(challenge)
    raise HTTPException(403, "Verification failed")


# ------------------------------------------------------------------
# WhatsApp — GET (Meta verification challenge)
# ------------------------------------------------------------------

@router.get("/whatsapp/{inbox_id}")
async def whatsapp_verify(inbox_id: str, request: Request):
    """Handle Meta's webhook verification handshake."""
    async with AsyncSession(engine) as db:
        inbox = (await db.execute(
            select(models_pg.MktInbox).where(
                models_pg.MktInbox.id == inbox_id,
                models_pg.MktInbox.channel == "whatsapp",
            )
        )).scalar_one_or_none()

    if not inbox:
        raise HTTPException(404, "Inbox not found")

    return _meta_verify_challenge(request.query_params, inbox)


# ------------------------------------------------------------------
# WhatsApp — POST (live messages)
# ------------------------------------------------------------------

@router.post("/whatsapp/{inbox_id}")
async def whatsapp_receive(
    inbox_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Receive inbound WhatsApp messages.
    Returns 200 immediately — processing happens in the background.
    Meta retries for up to 24 h if it doesn't get a 200.
    """
    raw_body = await request.body()

    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored_bad_json"}

    signature = request.headers.get("x-hub-signature-256", "")

    async with AsyncSession(engine) as db:
        inbox = (await db.execute(
            select(models_pg.MktInbox).where(
                models_pg.MktInbox.id == inbox_id,
                models_pg.MktInbox.channel == "whatsapp",
            )
        )).scalar_one_or_none()

        if not inbox:
            return {"status": "ignored_unknown_inbox"}

        if inbox.webhook_secret:
            if not _WA_ADAPTER.verify_signature(
                payload_bytes=raw_body,
                signature=signature,
                webhook_secret=inbox.webhook_secret,
            ):
                raise HTTPException(401, "Invalid webhook signature")

        raw_event_id = await _save_raw_event(db, "whatsapp", inbox_id, payload)

    background_tasks.add_task(_process_whatsapp, inbox_id, raw_event_id, payload)
    return {"status": "queued"}


# ------------------------------------------------------------------
# WhatsApp background processor
# ------------------------------------------------------------------

async def _process_whatsapp(inbox_id: str, raw_event_id: str, payload: dict) -> None:
    async with AsyncSession(engine) as db:
        try:
            inbox = (await db.execute(
                select(models_pg.MktInbox).where(models_pg.MktInbox.id == inbox_id)
            )).scalar_one_or_none()
            if not inbox:
                return

            events = await _WA_ADAPTER.parse_inbound(
                inbox=inbox, payload=payload, signature=None
            )
            for event in events:
                await _handle_inbound_event(db, inbox, event)

            await _mark_processed(db, raw_event_id)

        except Exception as exc:
            logger.exception("Error processing WhatsApp webhook %s", raw_event_id)
            try:
                await _mark_processed(db, raw_event_id, error=str(exc))
            except Exception:
                pass


# ------------------------------------------------------------------
# Instagram — GET (Meta verification challenge)
# ------------------------------------------------------------------

@router.get("/instagram/{inbox_id}")
async def instagram_verify(inbox_id: str, request: Request):
    """Handle Meta's webhook verification handshake for Instagram."""
    async with AsyncSession(engine) as db:
        inbox = (await db.execute(
            select(models_pg.MktInbox).where(
                models_pg.MktInbox.id == inbox_id,
                models_pg.MktInbox.channel == "instagram",
            )
        )).scalar_one_or_none()

    if not inbox:
        raise HTTPException(404, "Inbox not found")

    return _meta_verify_challenge(request.query_params, inbox)


# ------------------------------------------------------------------
# Instagram — POST (live messages)
# ------------------------------------------------------------------

@router.post("/instagram/{inbox_id}")
async def instagram_receive(
    inbox_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """Receive inbound Instagram messages via Meta webhook."""
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored_bad_json"}

    async with AsyncSession(engine) as db:
        inbox = (await db.execute(
            select(models_pg.MktInbox).where(
                models_pg.MktInbox.id == inbox_id,
                models_pg.MktInbox.channel == "instagram",
            )
        )).scalar_one_or_none()

        if not inbox:
            return {"status": "ignored_unknown_inbox"}

        raw_event_id = await _save_raw_event(db, "instagram", inbox_id, payload)

    background_tasks.add_task(_process_instagram, inbox_id, raw_event_id, payload)
    return {"status": "queued"}


async def _process_instagram(inbox_id: str, raw_event_id: str, payload: dict) -> None:
    async with AsyncSession(engine) as db:
        try:
            inbox = (await db.execute(
                select(models_pg.MktInbox).where(models_pg.MktInbox.id == inbox_id)
            )).scalar_one_or_none()
            if not inbox:
                return

            # --- Lead trigger evaluation for comments/story events ---
            await _evaluate_ig_triggers(db, inbox, payload)

            events = await _IG_ADAPTER.parse_inbound(
                inbox=inbox, payload=payload, signature=None
            )
            for event in events:
                await _handle_inbound_event(db, inbox, event)

            await _mark_processed(db, raw_event_id)

        except Exception as exc:
            logger.exception("Error processing Instagram webhook %s", raw_event_id)
            try:
                await _mark_processed(db, raw_event_id, error=str(exc))
            except Exception:
                pass


async def _evaluate_ig_triggers(db, inbox, payload: dict) -> None:
    """
    Evaluate active LeadTriggers against an incoming Instagram webhook payload.
    Creates Lead rows on match, idempotent by (tenant_id, source_external_user_id, source_trigger_id).
    """
    import re
    import uuid as _uuid
    from datetime import datetime, timezone

    tenant_id = inbox.company_id

    # Fetch all active triggers for this tenant
    triggers_result = await db.execute(
        select(models_pg.LeadTrigger).where(
            models_pg.LeadTrigger.tenant_id == tenant_id,
            models_pg.LeadTrigger.is_active == True,  # noqa: E712
        )
    )
    triggers = triggers_result.scalars().all()
    if not triggers:
        return

    entries = payload.get("entry", [])
    for entry in entries:
        # --- Comment events ---
        for change in entry.get("changes", []):
            if change.get("field") != "comments":
                continue
            value = change.get("value", {})
            comment_text = value.get("text", "")
            media_id = value.get("media", {}).get("id") or value.get("media_id")
            commenter_id = value.get("from", {}).get("id")
            commenter_name = value.get("from", {}).get("name")
            platform_event_id = value.get("id", "")

            for trigger in triggers:
                if trigger.trigger_type != "comment_keyword":
                    continue
                if trigger.applies_to == "specific_post" and media_id not in (trigger.specific_post_ids or []):
                    continue
                if trigger.source_post_id and trigger.source_post_id != media_id:
                    continue

                keywords = (trigger.match_rules or {}).get("keywords", [])
                if keywords and not any(
                    re.search(rf"\b{re.escape(kw.lower())}\b", comment_text.lower())
                    for kw in keywords
                ):
                    continue

                await _upsert_lead_from_trigger(
                    db, tenant_id, trigger, commenter_id, commenter_name,
                    source_post_id=media_id, platform_event_id=platform_event_id,
                )

        # --- Story reply / mention events ---
        for change in entry.get("changes", []):
            field = change.get("field", "")
            if field not in ("mentions", "story_mentions"):
                continue
            value = change.get("value", {})
            user_id = value.get("mentioned_profile", {}).get("id") or value.get("from", {}).get("id")
            story_id = value.get("media_id") or value.get("id")

            for trigger in triggers:
                if trigger.trigger_type not in ("story_reply", "story_mention"):
                    continue
                await _upsert_lead_from_trigger(
                    db, tenant_id, trigger, user_id, None,
                    source_post_id=story_id, platform_event_id=story_id or "",
                )

        # --- DM keyword events ---
        for messaging in entry.get("messaging", []):
            msg_text = (messaging.get("message") or {}).get("text", "")
            sender_id = (messaging.get("sender") or {}).get("id")
            platform_event_id = messaging.get("mid") or messaging.get("message", {}).get("mid", "")

            for trigger in triggers:
                if trigger.trigger_type not in ("dm_keyword", "dm_default"):
                    continue
                if trigger.trigger_type == "dm_keyword":
                    keywords = (trigger.match_rules or {}).get("keywords", [])
                    if keywords and not any(
                        re.search(rf"\b{re.escape(kw.lower())}\b", msg_text.lower())
                        for kw in keywords
                    ):
                        continue

                await _upsert_lead_from_trigger(
                    db, tenant_id, trigger, sender_id, None,
                    source_post_id=None, platform_event_id=platform_event_id,
                )


async def _upsert_lead_from_trigger(
    db,
    tenant_id: str,
    trigger: models_pg.LeadTrigger,
    external_user_id: str,
    display_name,
    source_post_id,
    platform_event_id: str,
) -> None:
    """Create or find the Lead for this trigger+user combination."""
    import uuid as _uuid
    from datetime import datetime, timezone

    if not external_user_id:
        return

    # Idempotency: one lead per (tenant, trigger, external_user)
    existing = (await db.execute(
        select(models_pg.Lead).where(
            models_pg.Lead.tenant_id == tenant_id,
            models_pg.Lead.source_trigger_id == trigger.id,
            models_pg.Lead.source_external_user_id == external_user_id,
        )
    )).scalar_one_or_none()

    if existing:
        # Don't re-trigger for already-blocked/converted leads
        if existing.status in ("blocked", "converted"):
            return
        # Record the re-engagement event
        db.add(models_pg.LeadEvent(
            id=str(_uuid.uuid4()),
            lead_id=existing.id,
            tenant_id=tenant_id,
            kind="re_triggered",
            payload={"platform_event_id": platform_event_id, "trigger_id": trigger.id},
        ))
        await db.commit()
        return

    lead = models_pg.Lead(
        id=str(_uuid.uuid4()),
        tenant_id=tenant_id,
        source_platform="instagram",
        source_external_user_id=external_user_id,
        source_handle=display_name,
        source_post_id=source_post_id,
        source_trigger_id=trigger.id,
        current_flow_id=trigger.flow_id,
        status="new",
        score=0,
        score_breakdown={},
        attributes={},
        owner_type="bot",
    )
    db.add(lead)
    await db.flush()

    db.add(models_pg.LeadEvent(
        id=str(_uuid.uuid4()),
        lead_id=lead.id,
        tenant_id=tenant_id,
        kind="lead_created",
        payload={
            "trigger_id": trigger.id,
            "trigger_type": trigger.trigger_type,
            "platform_event_id": platform_event_id,
            "source_post_id": source_post_id,
        },
    ))
    await db.commit()
    logger.info("Lead created: %s from trigger %s for user %s", lead.id, trigger.id, external_user_id)


# ------------------------------------------------------------------
# Facebook Messenger — GET (Meta verification challenge)
# ------------------------------------------------------------------

@router.get("/facebook/{inbox_id}")
async def facebook_verify(inbox_id: str, request: Request):
    """Handle Meta's webhook verification handshake for Facebook Messenger."""
    async with AsyncSession(engine) as db:
        inbox = (await db.execute(
            select(models_pg.MktInbox).where(
                models_pg.MktInbox.id == inbox_id,
                models_pg.MktInbox.channel == "facebook",
            )
        )).scalar_one_or_none()

    if not inbox:
        raise HTTPException(404, "Inbox not found")

    return _meta_verify_challenge(request.query_params, inbox)


# ------------------------------------------------------------------
# Facebook Messenger — POST (live messages)
# ------------------------------------------------------------------

@router.post("/facebook/{inbox_id}")
async def facebook_receive(
    inbox_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """Receive inbound Facebook Messenger messages via Meta webhook."""
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored_bad_json"}

    async with AsyncSession(engine) as db:
        inbox = (await db.execute(
            select(models_pg.MktInbox).where(
                models_pg.MktInbox.id == inbox_id,
                models_pg.MktInbox.channel == "facebook",
            )
        )).scalar_one_or_none()

        if not inbox:
            return {"status": "ignored_unknown_inbox"}

        raw_event_id = await _save_raw_event(db, "facebook", inbox_id, payload)

    background_tasks.add_task(_process_facebook, inbox_id, raw_event_id, payload)
    return {"status": "queued"}


async def _process_facebook(inbox_id: str, raw_event_id: str, payload: dict) -> None:
    async with AsyncSession(engine) as db:
        try:
            inbox = (await db.execute(
                select(models_pg.MktInbox).where(models_pg.MktInbox.id == inbox_id)
            )).scalar_one_or_none()
            if not inbox:
                return

            events = await _FB_ADAPTER.parse_inbound(
                inbox=inbox, payload=payload, signature=None
            )
            for event in events:
                await _handle_inbound_event(db, inbox, event)

            await _mark_processed(db, raw_event_id)

        except Exception as exc:
            logger.exception("Error processing Facebook webhook %s", raw_event_id)
            try:
                await _mark_processed(db, raw_event_id, error=str(exc))
            except Exception:
                pass


# ------------------------------------------------------------------
# Telegram — POST only (no GET verification; Telegram uses secret token in URL)
# ------------------------------------------------------------------

@router.post("/telegram/{inbox_id}")
async def telegram_receive(
    inbox_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """Receive inbound Telegram updates via Bot API webhook."""
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored_bad_json"}

    async with AsyncSession(engine) as db:
        inbox = (await db.execute(
            select(models_pg.MktInbox).where(
                models_pg.MktInbox.id == inbox_id,
                models_pg.MktInbox.channel == "telegram",
            )
        )).scalar_one_or_none()

        if not inbox:
            return {"status": "ignored_unknown_inbox"}

        raw_event_id = await _save_raw_event(db, "telegram", inbox_id, payload)

    background_tasks.add_task(_process_telegram, inbox_id, raw_event_id, payload)
    return {"status": "queued"}


async def _process_telegram(inbox_id: str, raw_event_id: str, payload: dict) -> None:
    async with AsyncSession(engine) as db:
        try:
            inbox = (await db.execute(
                select(models_pg.MktInbox).where(models_pg.MktInbox.id == inbox_id)
            )).scalar_one_or_none()
            if not inbox:
                return

            events = await _TG_ADAPTER.parse_inbound(
                inbox=inbox, payload=payload, signature=None
            )
            for event in events:
                await _handle_inbound_event(db, inbox, event)

            await _mark_processed(db, raw_event_id)

        except Exception as exc:
            logger.exception("Error processing Telegram webhook %s", raw_event_id)
            try:
                await _mark_processed(db, raw_event_id, error=str(exc))
            except Exception:
                pass


# ------------------------------------------------------------------
# Email (SendGrid inbound parse) — POST only, deferred processing
# ------------------------------------------------------------------

@router.post("/email/{inbox_id}")
async def email_receive(
    inbox_id: str,
    request: Request,
):
    """
    Receive SendGrid inbound parse webhook (multipart/form-data).
    Logs the raw body and saves a raw event. Full parsing is deferred
    because multipart assembly is complex and varies by SendGrid plan.
    Returns 200 immediately so SendGrid doesn't retry.
    """
    try:
        raw_body = await request.body()
    except Exception:
        raw_body = b""

    logger.info(
        "Email inbound webhook received for inbox %s (%d bytes)",
        inbox_id,
        len(raw_body),
    )

    async with AsyncSession(engine) as db:
        inbox = (await db.execute(
            select(models_pg.MktInbox).where(
                models_pg.MktInbox.id == inbox_id,
                models_pg.MktInbox.channel == "email",
            )
        )).scalar_one_or_none()

        if not inbox:
            # Return 200 regardless — SendGrid retries on non-2xx
            logger.warning("Email webhook for unknown inbox %s", inbox_id)
            return {"status": "ignored_unknown_inbox"}

        raw_event = models_pg.MktWebhookRawEvent(
            channel="email",
            inbox_id=inbox_id,
            payload={"raw_bytes_length": len(raw_body), "deferred": True},
        )
        db.add(raw_event)
        await db.commit()

    return {"status": "received"}


# ------------------------------------------------------------------
# SMS (Twilio inbound) — POST only, deferred processing
# ------------------------------------------------------------------

@router.post("/sms/{inbox_id}")
async def sms_receive(
    inbox_id: str,
    request: Request,
):
    """
    Receive Twilio inbound SMS webhook (application/x-www-form-urlencoded).
    Logs the raw form data and saves a raw event. Returns 200 immediately
    with an empty TwiML response so Twilio doesn't retry.
    """
    try:
        form = await request.form()
        payload = dict(form)
    except Exception:
        payload = {}

    logger.info(
        "SMS inbound webhook received for inbox %s: From=%s Body=%s",
        inbox_id,
        payload.get("From", "unknown"),
        payload.get("Body", "")[:80],
    )

    async with AsyncSession(engine) as db:
        inbox = (await db.execute(
            select(models_pg.MktInbox).where(
                models_pg.MktInbox.id == inbox_id,
                models_pg.MktInbox.channel == "sms",
            )
        )).scalar_one_or_none()

        if not inbox:
            logger.warning("SMS webhook for unknown inbox %s", inbox_id)
            return {"status": "ignored_unknown_inbox"}

        raw_event = models_pg.MktWebhookRawEvent(
            channel="sms",
            inbox_id=inbox_id,
            payload=payload,
        )
        db.add(raw_event)
        await db.commit()

    # Return empty TwiML so Twilio doesn't attempt a voice response
    from fastapi.responses import Response
    return Response(
        content='<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        media_type="application/xml",
    )


# ------------------------------------------------------------------
# Shared inbound event handler
# ------------------------------------------------------------------

async def _handle_inbound_event(db: AsyncSession, inbox, event: InboundEvent) -> None:
    now = datetime.now(timezone.utc)
    company_id = inbox.company_id

    # --- Step 1: resolve or create customer identity ---
    identity = (await db.execute(
        select(models_pg.MktCustomerIdentity).where(
            models_pg.MktCustomerIdentity.company_id == company_id,
            models_pg.MktCustomerIdentity.channel == event.channel,
            models_pg.MktCustomerIdentity.external_id == event.external_id,
        )
    )).scalar_one_or_none()

    if not identity:
        customer = (await db.execute(
            select(models_pg.Customer).where(
                models_pg.Customer.company_id == company_id,
                models_pg.Customer.phone == event.external_id,
            )
        )).scalar_one_or_none()

        if not customer:
            customer = models_pg.Customer(
                company_id=company_id,
                name=event.external_id,
                phone=event.external_id,
            )
            db.add(customer)
            await db.flush()

        identity = models_pg.MktCustomerIdentity(
            company_id=company_id,
            customer_id=customer.id,
            channel=event.channel,
            external_id=event.external_id,
            source="inbound_message",
        )
        db.add(identity)
        await db.flush()

    customer_id = identity.customer_id

    # --- Step 2: handle STOP keyword — revoke marketing consent ---
    if event.content_text and event.content_text.strip().lower() in STOP_KEYWORDS:
        db.add(models_pg.MktConsentLedger(
            company_id=company_id,
            customer_id=customer_id,
            channel=event.channel,
            purpose="marketing",
            status="revoked",
            source="inbound_stop",
            evidence={
                "keyword": event.content_text.strip(),
                "channel_message_id": event.channel_message_id,
            },
        ))

    # --- Step 3: upsert conversation ---
    conv = (await db.execute(
        select(models_pg.MktConversation).where(
            models_pg.MktConversation.inbox_id == inbox.id,
            models_pg.MktConversation.customer_identity_id == identity.id,
            models_pg.MktConversation.status.in_(["open", "pending", "snoozed"]),
        ).order_by(models_pg.MktConversation.created_at.desc()).limit(1)
    )).scalar_one_or_none()

    if not conv:
        conv = models_pg.MktConversation(
            company_id=company_id,
            inbox_id=inbox.id,
            customer_id=customer_id,
            customer_identity_id=identity.id,
            status="open",
            last_message_at=now,
            last_customer_message_at=now,
            unread_count=1,
        )
        db.add(conv)
        await db.flush()
    else:
        conv.last_message_at = now
        conv.last_customer_message_at = now
        conv.unread_count = (conv.unread_count or 0) + 1
        if conv.status == "resolved":
            conv.status = "open"

    # --- Step 4: insert message ---
    msg = models_pg.MktMessage(
        company_id=company_id,
        conversation_id=conv.id,
        direction="in",
        sender_type="customer",
        sender_id=event.external_id,
        content_type=event.content_type,
        content_text=event.content_text,
        attachments=event.attachments or [],
        raw=event.raw or {},
        channel_message_id=event.channel_message_id,
        delivery_status="delivered",
        sent_at=event.timestamp,
    )
    db.add(msg)
    await db.flush()

    # --- Step 5: broadcast via WebSocket manager ---
    try:
        from routes.conversations import manager
        await manager.broadcast(company_id, {
            "type": "new_message",
            "conversation_id": conv.id,
            "message": {
                "id": msg.id,
                "direction": "in",
                "sender_type": "customer",
                "content_type": event.content_type,
                "content_text": event.content_text,
                "created_at": now.isoformat(),
            },
        })
    except Exception:
        pass  # WS broadcast failure must never block message persistence

    # --- Step 6: trigger Concierge agent (fire-and-forget) ---
    if event.content_text:
        try:
            from agents.trigger import maybe_trigger_concierge
            await maybe_trigger_concierge(
                company_id=company_id,
                conversation_id=conv.id,
                message_text=event.content_text,
            )
        except Exception:
            pass  # agent trigger failure must never block message persistence
