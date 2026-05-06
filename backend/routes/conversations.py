"""
Unified Conversations (Inbox) API.

Endpoints:
  GET    /conversations/inboxes            — list inboxes
  POST   /conversations/inboxes            — create inbox
  GET    /conversations/inboxes/{id}/templates/sync — sync WA templates from Meta
  GET    /conversations                    — list conversations (cursor-paginated)
  GET    /conversations/{id}               — get single conversation
  GET    /conversations/{id}/messages      — message history (cursor-paginated)
  POST   /conversations/{id}/messages      — send message or post internal note
  PUT    /conversations/{id}/assign        — assign to agent
  PUT    /conversations/{id}/status        — open/pending/resolved/snoozed
  PUT    /conversations/{id}/labels        — set labels
  GET    /conversations/{id}/notes         — list internal notes
  WS     /conversations/ws/{company_id}    — realtime push channel
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

import models_pg
from channels.base import OutboundContent
from database_pg import get_db
from routes.dependencies import User, get_current_user
from services.send_pipeline import enqueue_message

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/conversations", tags=["Conversations"])


# ------------------------------------------------------------------
# WebSocket connection manager (in-process realtime)
# ------------------------------------------------------------------

class _ConnectionManager:
    def __init__(self):
        self._pool: dict[str, list[WebSocket]] = {}

    async def connect(self, ws: WebSocket, company_id: str) -> None:
        await ws.accept()
        self._pool.setdefault(company_id, []).append(ws)

    def disconnect(self, ws: WebSocket, company_id: str) -> None:
        bucket = self._pool.get(company_id, [])
        if ws in bucket:
            bucket.remove(ws)

    async def broadcast(self, company_id: str, payload: dict) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._pool.get(company_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, company_id)


manager = _ConnectionManager()


# ------------------------------------------------------------------
# Inboxes
# ------------------------------------------------------------------

@router.get("/inboxes")
async def list_inboxes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.MktInbox).where(
            models_pg.MktInbox.company_id == current_user.company_id,
            models_pg.MktInbox.is_active == True,
        ).order_by(models_pg.MktInbox.created_at)
    )
    return [_inbox_dict(i) for i in result.scalars().all()]


@router.post("/inboxes", status_code=201)
async def create_inbox(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    inbox = models_pg.MktInbox(
        company_id=current_user.company_id,
        name=body["name"],
        channel=body["channel"],
        credentials_ref=body.get("credentials_ref"),
        webhook_secret=body.get("webhook_secret"),
        auto_assignment_rule=body.get("auto_assignment_rule", "round_robin"),
        business_hours=body.get("business_hours", {}),
    )
    db.add(inbox)
    await db.commit()
    await db.refresh(inbox)
    return _inbox_dict(inbox)


@router.get("/inboxes/{inbox_id}/templates/sync")
async def sync_templates(
    inbox_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pull approved templates from Meta and upsert into mkt_templates."""
    inbox = await _require_inbox(db, inbox_id, current_user.company_id)
    if inbox.channel != "whatsapp":
        raise HTTPException(400, "Template sync only supported for WhatsApp inboxes")

    from channels.whatsapp_cloud import WhatsAppCloudAdapter
    adapter = WhatsAppCloudAdapter()
    remote = await adapter.fetch_templates(inbox=inbox)

    synced = 0
    for t in remote:
        name = t.get("name", "")
        status = t.get("status", "")
        components = t.get("components", [])
        body_text = next(
            (c.get("text", "") for c in components if c.get("type") == "BODY"),
            "",
        )

        existing = (await db.execute(
            select(models_pg.MktTemplate).where(
                models_pg.MktTemplate.company_id == current_user.company_id,
                models_pg.MktTemplate.channel == "whatsapp",
                models_pg.MktTemplate.provider_template_id == t.get("id"),
            )
        )).scalar_one_or_none()

        if existing:
            existing.provider_status = status
            existing.body = body_text or existing.body
            existing.is_active = status == "APPROVED"
        else:
            db.add(models_pg.MktTemplate(
                company_id=current_user.company_id,
                channel="whatsapp",
                name=name,
                locale=t.get("language", "en"),
                body=body_text,
                variables={"components": components},
                provider_status=status,
                provider_template_id=t.get("id"),
                is_active=status == "APPROVED",
            ))
            synced += 1

    await db.commit()
    return {"synced": synced, "total_remote": len(remote)}


@router.get("/templates")
async def list_templates(
    channel: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(models_pg.MktTemplate).where(
        models_pg.MktTemplate.company_id == current_user.company_id,
        models_pg.MktTemplate.is_active == True,
    )
    if channel:
        q = q.where(models_pg.MktTemplate.channel == channel)
    result = await db.execute(q.order_by(models_pg.MktTemplate.name))
    return [_template_dict(t) for t in result.scalars().all()]


# ------------------------------------------------------------------
# Conversations
# ------------------------------------------------------------------

@router.get("")
async def list_conversations(
    status: Optional[str] = Query(None),
    assignee_id: Optional[str] = Query(None),
    inbox_id: Optional[str] = Query(None),
    label: Optional[str] = Query(None),
    unread_only: bool = Query(False),
    cursor: Optional[str] = Query(None),
    limit: int = Query(25, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(models_pg.MktConversation).where(
        models_pg.MktConversation.company_id == current_user.company_id
    )
    if status:
        q = q.where(models_pg.MktConversation.status == status)
    if assignee_id:
        q = q.where(models_pg.MktConversation.assignee_id == assignee_id)
    if inbox_id:
        q = q.where(models_pg.MktConversation.inbox_id == inbox_id)
    if unread_only:
        q = q.where(models_pg.MktConversation.unread_count > 0)
    if cursor:
        cursor_dt = datetime.fromisoformat(cursor)
        q = q.where(models_pg.MktConversation.last_message_at < cursor_dt)
    q = q.order_by(desc(models_pg.MktConversation.last_message_at)).limit(limit)

    result = await db.execute(q)
    return [_conv_dict(c) for c in result.scalars().all()]


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await _require_conv(db, conversation_id, current_user.company_id)
    return _conv_dict(conv)


@router.get("/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    cursor: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_conv(db, conversation_id, current_user.company_id)
    q = select(models_pg.MktMessage).where(
        models_pg.MktMessage.conversation_id == conversation_id,
        models_pg.MktMessage.company_id == current_user.company_id,
    )
    if cursor:
        q = q.where(models_pg.MktMessage.created_at < datetime.fromisoformat(cursor))
    q = q.order_by(desc(models_pg.MktMessage.created_at)).limit(limit)

    result = await db.execute(q)
    # Return in ascending order (oldest first) for the UI
    return [_msg_dict(m) for m in reversed(result.scalars().all())]


@router.post("/{conversation_id}/messages", status_code=201)
async def send_message(
    conversation_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await _require_conv(db, conversation_id, current_user.company_id)

    # Internal note path
    if body.get("is_note"):
        note = models_pg.MktInternalNote(
            company_id=current_user.company_id,
            conversation_id=conversation_id,
            author_id=current_user.id,
            body=body.get("body", ""),
            mentions=body.get("mentions", []),
        )
        db.add(note)
        await db.commit()
        await db.refresh(note)
        await manager.broadcast(current_user.company_id, {
            "type": "new_note",
            "conversation_id": conversation_id,
            "note": _note_dict(note),
        })
        return {"id": note.id, "type": "note"}

    # Outbound message path
    inbox = (await db.execute(
        select(models_pg.MktInbox).where(models_pg.MktInbox.id == conv.inbox_id)
    )).scalar_one_or_none()
    if not inbox:
        raise HTTPException(400, "Inbox missing on conversation")

    content = OutboundContent(
        content_type=body.get("content_type", "text"),
        text=body.get("text"),
        template_name=body.get("template_name"),
        template_language=body.get("template_language"),
        template_components=body.get("template_components"),
        media_url=body.get("media_url"),
    )

    result = await enqueue_message(
        db,
        conversation_id=conversation_id,
        company_id=current_user.company_id,
        customer_id=conv.customer_id,
        channel=inbox.channel,
        inbox_id=inbox.id,
        content=content,
        sender_id=current_user.id,
        is_marketing=False,
    )

    if result.get("message_id"):
        msg = (await db.execute(
            select(models_pg.MktMessage).where(
                models_pg.MktMessage.id == result["message_id"]
            )
        )).scalar_one_or_none()
        if msg:
            await manager.broadcast(current_user.company_id, {
                "type": "new_message",
                "conversation_id": conversation_id,
                "message": _msg_dict(msg),
            })

    return result


# ------------------------------------------------------------------
# Typing indicator
# ------------------------------------------------------------------

@router.post("/{conversation_id}/typing")
async def typing_indicator(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Broadcast a typing event to all agents watching this conversation."""
    await _require_conv(db, conversation_id, current_user.company_id)
    await manager.broadcast(current_user.company_id, {
        "type": "typing",
        "conversation_id": conversation_id,
        "agent_id": current_user.id,
        "agent_name": current_user.name,
    })
    return {"ok": True}


# ------------------------------------------------------------------
# Assignment / status / labels
# ------------------------------------------------------------------

@router.put("/{conversation_id}/assign")
async def assign_conversation(
    conversation_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await _require_conv(db, conversation_id, current_user.company_id)
    conv.assignee_id = body.get("assignee_id")
    await db.commit()
    await manager.broadcast(current_user.company_id, {
        "type": "assignment_change",
        "conversation_id": conversation_id,
        "assignee_id": conv.assignee_id,
    })
    return {"ok": True, "assignee_id": conv.assignee_id}


@router.put("/{conversation_id}/status")
async def set_status(
    conversation_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await _require_conv(db, conversation_id, current_user.company_id)
    new_status = body.get("status")
    if new_status not in ("open", "pending", "resolved", "snoozed"):
        raise HTTPException(400, f"Invalid status '{new_status}'")
    conv.status = new_status
    if new_status == "snoozed" and body.get("snooze_until"):
        conv.snooze_until = datetime.fromisoformat(body["snooze_until"])
    await db.commit()
    return {"ok": True, "status": conv.status}


@router.put("/{conversation_id}/labels")
async def set_labels(
    conversation_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await _require_conv(db, conversation_id, current_user.company_id)
    conv.labels = body.get("labels", [])
    await db.commit()
    return {"ok": True, "labels": conv.labels}


@router.put("/{conversation_id}/unread/clear")
async def clear_unread(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await _require_conv(db, conversation_id, current_user.company_id)
    conv.unread_count = 0
    await db.commit()
    return {"ok": True}


# ------------------------------------------------------------------
# Internal notes
# ------------------------------------------------------------------

@router.get("/{conversation_id}/notes")
async def list_notes(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_conv(db, conversation_id, current_user.company_id)
    result = await db.execute(
        select(models_pg.MktInternalNote).where(
            models_pg.MktInternalNote.conversation_id == conversation_id,
            models_pg.MktInternalNote.company_id == current_user.company_id,
        ).order_by(models_pg.MktInternalNote.created_at)
    )
    return [_note_dict(n) for n in result.scalars().all()]


# ------------------------------------------------------------------
# Customer identity management
# ------------------------------------------------------------------

@router.get("/customers/{customer_id}/identities")
async def list_identities(
    customer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.MktCustomerIdentity).where(
            models_pg.MktCustomerIdentity.company_id == current_user.company_id,
            models_pg.MktCustomerIdentity.customer_id == customer_id,
        )
    )
    return [
        {
            "id": i.id, "channel": i.channel, "external_id": i.external_id,
            "verified": i.verified, "source": i.source,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in result.scalars().all()
    ]


@router.post("/customers/{customer_id}/identities", status_code=201)
async def add_identity(
    customer_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    identity = models_pg.MktCustomerIdentity(
        company_id=current_user.company_id,
        customer_id=customer_id,
        channel=body["channel"],
        external_id=body["external_id"],
        source=body.get("source", "manual"),
    )
    db.add(identity)
    await db.commit()
    await db.refresh(identity)
    return {"id": identity.id, "channel": identity.channel, "external_id": identity.external_id}


# ------------------------------------------------------------------
# Consent
# ------------------------------------------------------------------

@router.get("/customers/{customer_id}/consent")
async def get_consent(
    customer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.MktConsentLedger).where(
            models_pg.MktConsentLedger.company_id == current_user.company_id,
            models_pg.MktConsentLedger.customer_id == customer_id,
        ).order_by(models_pg.MktConsentLedger.occurred_at.desc())
    )
    rows = result.scalars().all()
    # Return effective consent per (channel, purpose) — first row wins (DESC order)
    seen: set[tuple] = set()
    effective = []
    for r in rows:
        key = (r.channel, r.purpose)
        if key not in seen:
            seen.add(key)
            effective.append({
                "channel": r.channel, "purpose": r.purpose,
                "status": r.status, "source": r.source,
                "occurred_at": r.occurred_at.isoformat(),
            })
    return effective


@router.post("/customers/{customer_id}/consent", status_code=201)
async def record_consent(
    customer_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = models_pg.MktConsentLedger(
        company_id=current_user.company_id,
        customer_id=customer_id,
        channel=body["channel"],
        purpose=body.get("purpose", "marketing"),
        status=body["status"],   # granted | revoked
        source=body.get("source", "manual"),
        evidence=body.get("evidence", {}),
    )
    db.add(entry)
    await db.commit()
    return {"ok": True}


# ------------------------------------------------------------------
# Frequency cap config
# ------------------------------------------------------------------

@router.get("/settings/frequency-cap")
async def get_frequency_cap(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = (await db.execute(
        select(models_pg.MktFrequencyCapConfig).where(
            models_pg.MktFrequencyCapConfig.company_id == current_user.company_id
        )
    )).scalar_one_or_none()
    if not result:
        return {"max_per_day": 3, "max_per_week": 10,
                "quiet_hours_start": "22:00", "quiet_hours_end": "08:00"}
    return {
        "max_per_day": result.max_per_day,
        "max_per_week": result.max_per_week,
        "quiet_hours_start": result.quiet_hours_start,
        "quiet_hours_end": result.quiet_hours_end,
    }


@router.put("/settings/frequency-cap")
async def upsert_frequency_cap(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = (await db.execute(
        select(models_pg.MktFrequencyCapConfig).where(
            models_pg.MktFrequencyCapConfig.company_id == current_user.company_id
        )
    )).scalar_one_or_none()
    if result:
        result.max_per_day = body.get("max_per_day", result.max_per_day)
        result.max_per_week = body.get("max_per_week", result.max_per_week)
        result.quiet_hours_start = body.get("quiet_hours_start", result.quiet_hours_start)
        result.quiet_hours_end = body.get("quiet_hours_end", result.quiet_hours_end)
    else:
        db.add(models_pg.MktFrequencyCapConfig(
            company_id=current_user.company_id,
            **{k: v for k, v in body.items() if k in
               ("max_per_day", "max_per_week", "quiet_hours_start", "quiet_hours_end")}
        ))
    await db.commit()
    return {"ok": True}


# ------------------------------------------------------------------
# AI handling state
# ------------------------------------------------------------------

@router.put("/{conversation_id}/ai-state")
async def set_ai_handling_state(
    conversation_id: str,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Set the AI handling state for a conversation.
    body: { "state": "ai_handling" | "escalated" | "human_takeover" | null }
    """
    conv = (await db.execute(
        select(models_pg.MktConversation).where(
            models_pg.MktConversation.id == conversation_id,
            models_pg.MktConversation.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")

    state = body.get("state")
    conv.ai_handling_state = state
    await db.commit()

    try:
        await manager.broadcast(current_user.company_id, {
            "type": "ai_state_change",
            "conversation_id": conversation_id,
            "state": state,
        })
    except Exception:
        pass

    return {"ok": True, "ai_handling_state": state}


# ------------------------------------------------------------------
# WebSocket realtime channel
# ------------------------------------------------------------------

@router.websocket("/ws/{company_id}")
async def ws_endpoint(websocket: WebSocket, company_id: str):
    await manager.connect(websocket, company_id)
    try:
        while True:
            await websocket.receive_text()  # keep alive; server pushes events
    except WebSocketDisconnect:
        manager.disconnect(websocket, company_id)


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

async def _require_conv(db: AsyncSession, conversation_id: str, company_id: str):
    result = (await db.execute(
        select(models_pg.MktConversation).where(
            models_pg.MktConversation.id == conversation_id,
            models_pg.MktConversation.company_id == company_id,
        )
    )).scalar_one_or_none()
    if not result:
        raise HTTPException(404, "Conversation not found")
    return result


async def _require_inbox(db: AsyncSession, inbox_id: str, company_id: str):
    result = (await db.execute(
        select(models_pg.MktInbox).where(
            models_pg.MktInbox.id == inbox_id,
            models_pg.MktInbox.company_id == company_id,
        )
    )).scalar_one_or_none()
    if not result:
        raise HTTPException(404, "Inbox not found")
    return result


def _inbox_dict(i) -> dict:
    return {
        "id": i.id, "name": i.name, "channel": i.channel,
        "is_active": i.is_active,
        "auto_assignment_rule": i.auto_assignment_rule,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }


def _conv_dict(c) -> dict:
    return {
        "id": c.id, "inbox_id": c.inbox_id, "customer_id": c.customer_id,
        "status": c.status, "assignee_id": c.assignee_id,
        "unread_count": c.unread_count, "labels": c.labels or [],
        "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
        "last_customer_message_at": (
            c.last_customer_message_at.isoformat() if c.last_customer_message_at else None
        ),
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _msg_dict(m) -> dict:
    return {
        "id": m.id, "conversation_id": m.conversation_id,
        "direction": m.direction, "sender_type": m.sender_type,
        "sender_id": m.sender_id, "content_type": m.content_type,
        "content_text": m.content_text, "attachments": m.attachments or [],
        "delivery_status": m.delivery_status,
        "sent_at": m.sent_at.isoformat() if m.sent_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def _note_dict(n) -> dict:
    return {
        "id": n.id, "conversation_id": n.conversation_id,
        "author_id": n.author_id, "body": n.body,
        "mentions": n.mentions or [],
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


def _template_dict(t) -> dict:
    return {
        "id": t.id, "channel": t.channel, "name": t.name,
        "locale": t.locale, "body": t.body,
        "variables": t.variables, "provider_status": t.provider_status,
        "is_active": t.is_active,
    }
