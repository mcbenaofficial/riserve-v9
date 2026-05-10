"""
WhatsApp Acquisition routes.

Manages opt-in subscriber lists and broadcast campaigns for WhatsApp marketing.
Distinct from the transactional WhatsApp module (routes/whatsapp.py).

  GET  /whatsapp/acquisition/config/status          — preflight: is WA config ready?
  GET  /whatsapp/acquisition/subscribers             — list opt-in subscribers
  POST /whatsapp/acquisition/subscribers             — add single opt-in
  POST /whatsapp/acquisition/subscribers/bulk        — bulk import
  DELETE /whatsapp/acquisition/subscribers/{id}      — opt-out subscriber
  PATCH /whatsapp/acquisition/subscribers/{id}/tags  — retag subscriber
  POST /whatsapp/acquisition/segment-preview         — count subscribers for tag filter
  GET  /whatsapp/acquisition/campaigns               — list campaigns (paginated)
  POST /whatsapp/acquisition/campaigns               — create campaign
  PUT  /whatsapp/acquisition/campaigns/{id}          — update draft campaign
  DELETE /whatsapp/acquisition/campaigns/{id}        — delete draft
  POST /whatsapp/acquisition/campaigns/{id}/send     — trigger broadcast send
  POST /whatsapp/acquisition/campaigns/{id}/test-send — send to a single test number
  GET  /whatsapp/acquisition/campaigns/{id}/stats    — per-campaign breakdown
  GET  /whatsapp/acquisition/stats                   — aggregate dashboard stats
  GET  /whatsapp/acquisition/webhook                 — Meta webhook verification
  POST /whatsapp/acquisition/webhook                 — Meta delivery/read status updates
"""

import re
import asyncio
import logging
import httpx
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from database_pg import get_db, engine
from routes.dependencies import get_current_user
import models_pg

WA_API_VERSION = "v19.0"
WA_BASE_URL = f"https://graph.facebook.com/{WA_API_VERSION}"

router = APIRouter()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class SubscriberCreate(BaseModel):
    phone: str
    name: Optional[str] = None
    source: str = "organic"
    tags: List[str] = []
    outlet_id: Optional[str] = None


class SubscriberBulkItem(BaseModel):
    phone: str
    name: Optional[str] = None
    source: str = "import"
    tags: List[str] = []


class RetagBody(BaseModel):
    tags: List[str]


class SegmentPreviewBody(BaseModel):
    segment_tags: List[str] = []


class CampaignCreate(BaseModel):
    name: str
    template_name: str
    template_params: List[str] = []
    segment_tags: List[str] = []
    scheduled_at: Optional[str] = None
    cta_button_text: Optional[str] = None
    cta_button_url: Optional[str] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    template_name: Optional[str] = None
    template_params: Optional[List[str]] = None
    segment_tags: Optional[List[str]] = None
    scheduled_at: Optional[str] = None
    cta_button_text: Optional[str] = None
    cta_button_url: Optional[str] = None


class TestSendBody(BaseModel):
    phone: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalize_phone(raw: str) -> str:
    digits = re.sub(r'\D', '', raw)
    return digits[-10:] if len(digits) >= 10 else digits


def _e164(raw: str) -> str:
    digits = re.sub(r'\D', '', raw)
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    return f"+{digits}"


def _build_template_payload(campaign: models_pg.WhatsAppCampaign, phone: str) -> dict:
    """Build the WhatsApp message payload for a template send."""
    components = []
    if campaign.template_params:
        components.append({
            "type": "body",
            "parameters": [{"type": "text", "text": v} for v in campaign.template_params],
        })
    if campaign.cta_button_url:
        components.append({
            "type": "button",
            "sub_type": "url",
            "index": "0",
            "parameters": [{"type": "text", "text": campaign.cta_button_url}],
        })
    return {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": campaign.template_name,
            "language": {"code": "en"},
            "components": components,
        },
    }


# ---------------------------------------------------------------------------
# Config preflight
# ---------------------------------------------------------------------------

@router.get("/whatsapp/acquisition/config/status")
async def config_status(
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    config = (await db.execute(
        select(models_pg.WhatsAppConfig).where(
            models_pg.WhatsAppConfig.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()

    if not config:
        return {"ok": False, "reason": "No WhatsApp configuration found. Set up WhatsApp in Settings first."}
    if not config.enabled:
        return {"ok": False, "reason": "WhatsApp is disabled. Enable it in Settings → WhatsApp."}
    if not config.phone_number_id:
        return {"ok": False, "reason": "Phone Number ID is missing in WhatsApp settings."}
    if not config.access_token_enc:
        return {"ok": False, "reason": "Access token is missing in WhatsApp settings."}
    return {"ok": True, "reason": None, "display_phone": config.display_phone}


# ---------------------------------------------------------------------------
# Subscribers
# ---------------------------------------------------------------------------

@router.get("/whatsapp/acquisition/subscribers")
async def list_subscribers(
    source: Optional[str] = None,
    tag: Optional[str] = None,
    active_only: bool = True,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    q = select(models_pg.WhatsAppSubscriber).where(
        models_pg.WhatsAppSubscriber.company_id == current_user.company_id
    )
    if active_only:
        q = q.where(models_pg.WhatsAppSubscriber.opted_out_at.is_(None))
    if source:
        q = q.where(models_pg.WhatsAppSubscriber.source == source)
    if tag:
        q = q.where(models_pg.WhatsAppSubscriber.tags.contains([tag]))

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = q.order_by(models_pg.WhatsAppSubscriber.created_at.desc()).offset(offset).limit(limit)
    rows = (await db.execute(q)).scalars().all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total,
        "subscribers": [
            {
                "id": s.id,
                "phone": s.phone,
                "name": s.name,
                "source": s.source,
                "tags": s.tags or [],
                "outlet_id": s.outlet_id,
                "opted_in_at": s.opted_in_at.isoformat() if s.opted_in_at else None,
                "opted_out_at": s.opted_out_at.isoformat() if s.opted_out_at else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in rows
        ],
    }


@router.post("/whatsapp/acquisition/subscribers", status_code=201)
async def add_subscriber(
    body: SubscriberCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    phone = _e164(body.phone)
    existing = (await db.execute(
        select(models_pg.WhatsAppSubscriber).where(
            models_pg.WhatsAppSubscriber.company_id == current_user.company_id,
            models_pg.WhatsAppSubscriber.phone == phone,
        )
    )).scalar_one_or_none()

    if existing:
        if existing.opted_out_at:
            existing.opted_out_at = None
            existing.opted_in_at = datetime.now(timezone.utc)
            await db.commit()
            await db.refresh(existing)
        return {"id": existing.id, "status": "existing"}

    sub = models_pg.WhatsAppSubscriber(
        company_id=current_user.company_id,
        outlet_id=body.outlet_id,
        phone=phone,
        name=body.name,
        source=body.source,
        tags=body.tags,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return {"id": sub.id, "status": "created"}


@router.post("/whatsapp/acquisition/subscribers/bulk")
async def bulk_import_subscribers(
    items: List[SubscriberBulkItem],
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    imported = 0
    skipped = 0
    for item in items:
        phone = _e164(item.phone)
        existing = (await db.execute(
            select(models_pg.WhatsAppSubscriber).where(
                models_pg.WhatsAppSubscriber.company_id == current_user.company_id,
                models_pg.WhatsAppSubscriber.phone == phone,
            )
        )).scalar_one_or_none()
        if existing:
            skipped += 1
            continue
        sub = models_pg.WhatsAppSubscriber(
            company_id=current_user.company_id,
            phone=phone,
            name=item.name,
            source=item.source,
            tags=item.tags,
        )
        db.add(sub)
        imported += 1

    await db.commit()
    return {"imported": imported, "skipped": skipped}


@router.delete("/whatsapp/acquisition/subscribers/{subscriber_id}")
async def opt_out_subscriber(
    subscriber_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    sub = (await db.execute(
        select(models_pg.WhatsAppSubscriber).where(
            models_pg.WhatsAppSubscriber.id == subscriber_id,
            models_pg.WhatsAppSubscriber.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    sub.opted_out_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "opted_out"}


@router.patch("/whatsapp/acquisition/subscribers/{subscriber_id}/tags")
async def retag_subscriber(
    subscriber_id: str,
    body: RetagBody,
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    sub = (await db.execute(
        select(models_pg.WhatsAppSubscriber).where(
            models_pg.WhatsAppSubscriber.id == subscriber_id,
            models_pg.WhatsAppSubscriber.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    sub.tags = body.tags
    await db.commit()
    return {"id": sub.id, "tags": sub.tags}


# ---------------------------------------------------------------------------
# Segment preview
# ---------------------------------------------------------------------------

@router.post("/whatsapp/acquisition/segment-preview")
async def segment_preview(
    body: SegmentPreviewBody,
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    q = select(func.count()).where(
        models_pg.WhatsAppSubscriber.company_id == current_user.company_id,
        models_pg.WhatsAppSubscriber.opted_out_at.is_(None),
    )
    for tag in body.segment_tags:
        q = q.where(models_pg.WhatsAppSubscriber.tags.contains([tag]))
    count = (await db.execute(q)).scalar_one()
    return {"count": count}


# ---------------------------------------------------------------------------
# Campaigns
# ---------------------------------------------------------------------------

@router.get("/whatsapp/acquisition/campaigns")
async def list_campaigns(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    q = select(models_pg.WhatsAppCampaign).where(
        models_pg.WhatsAppCampaign.company_id == current_user.company_id
    )
    if status:
        q = q.where(models_pg.WhatsAppCampaign.status == status)

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = q.order_by(models_pg.WhatsAppCampaign.created_at.desc()).offset(offset).limit(limit)
    rows = (await db.execute(q)).scalars().all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < total,
        "campaigns": [_serialize_campaign(c) for c in rows],
    }


@router.post("/whatsapp/acquisition/campaigns", status_code=201)
async def create_campaign(
    body: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    scheduled_at = None
    status = 'draft'
    if body.scheduled_at:
        try:
            scheduled_at = datetime.fromisoformat(body.scheduled_at)
            status = 'scheduled'
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid scheduled_at format")

    campaign = models_pg.WhatsAppCampaign(
        company_id=current_user.company_id,
        name=body.name,
        template_name=body.template_name,
        template_params=body.template_params,
        segment_tags=body.segment_tags,
        scheduled_at=scheduled_at,
        status=status,
        cta_button_text=body.cta_button_text,
        cta_button_url=body.cta_button_url,
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return _serialize_campaign(campaign)


@router.put("/whatsapp/acquisition/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    body: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    campaign = await _get_campaign(campaign_id, current_user.company_id, db)
    if campaign.status not in ('draft', 'scheduled'):
        raise HTTPException(status_code=400, detail="Only draft or scheduled campaigns can be edited")

    if body.name is not None:
        campaign.name = body.name
    if body.template_name is not None:
        campaign.template_name = body.template_name
    if body.template_params is not None:
        campaign.template_params = body.template_params
    if body.segment_tags is not None:
        campaign.segment_tags = body.segment_tags
    if body.cta_button_text is not None:
        campaign.cta_button_text = body.cta_button_text
    if body.cta_button_url is not None:
        campaign.cta_button_url = body.cta_button_url
    if body.scheduled_at is not None:
        try:
            campaign.scheduled_at = datetime.fromisoformat(body.scheduled_at)
            campaign.status = 'scheduled'
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid scheduled_at format")
    campaign.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(campaign)
    return _serialize_campaign(campaign)


@router.delete("/whatsapp/acquisition/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    campaign = await _get_campaign(campaign_id, current_user.company_id, db)
    if campaign.status not in ('draft', 'scheduled'):
        raise HTTPException(status_code=400, detail="Only draft or scheduled campaigns can be deleted")
    await db.delete(campaign)
    await db.commit()
    return {"status": "deleted"}


async def _broadcast_campaign(campaign_id: str, company_id: str) -> None:
    """
    Background task: sends a broadcast campaign to all matching subscribers.

    Opens its own DB session so it runs safely after the HTTP response is returned.
    Calls the WhatsApp Cloud API directly with campaign.template_name, bypassing
    the trigger-lookup in send_template_message (which is for transactional messages only).
    """
    async with AsyncSession(engine) as db:
        try:
            campaign = (await db.execute(
                select(models_pg.WhatsAppCampaign).where(
                    models_pg.WhatsAppCampaign.id == campaign_id,
                    models_pg.WhatsAppCampaign.company_id == company_id,
                )
            )).scalar_one_or_none()
            if not campaign:
                return

            config = (await db.execute(
                select(models_pg.WhatsAppConfig).where(
                    models_pg.WhatsAppConfig.company_id == company_id,
                    models_pg.WhatsAppConfig.enabled == True,
                )
            )).scalar_one_or_none()

            if not config:
                campaign.status = 'failed'
                await db.commit()
                logger.warning(f"[WA Acquisition] campaign {campaign_id}: no WhatsApp config for company {company_id}")
                return

            q = select(models_pg.WhatsAppSubscriber).where(
                models_pg.WhatsAppSubscriber.company_id == company_id,
                models_pg.WhatsAppSubscriber.opted_out_at.is_(None),
            )
            if campaign.segment_tags:
                for tag in campaign.segment_tags:
                    q = q.where(models_pg.WhatsAppSubscriber.tags.contains([tag]))
            subscribers = (await db.execute(q)).scalars().all()

            sent = 0
            failed = 0
            async with httpx.AsyncClient(timeout=10.0) as client:
                for sub in subscribers:
                    phone = sub.phone.replace("+", "").replace(" ", "").replace("-", "")
                    payload = _build_template_payload(campaign, phone)
                    try:
                        resp = await client.post(
                            f"{WA_BASE_URL}/{config.phone_number_id}/messages",
                            headers={
                                "Authorization": f"Bearer {config.access_token_enc}",
                                "Content-Type": "application/json",
                            },
                            json=payload,
                        )
                        data = resp.json()
                        if resp.status_code == 200 and "messages" in data:
                            wa_id = data["messages"][0].get("id")
                            db.add(models_pg.WhatsAppCampaignMessage(
                                campaign_id=campaign_id,
                                subscriber_id=sub.id,
                                phone=sub.phone,
                                status='sent',
                                wa_message_id=wa_id,
                                sent_at=datetime.now(timezone.utc),
                            ))
                            sent += 1
                        else:
                            err = data.get("error", {}).get("message", str(data))
                            db.add(models_pg.WhatsAppCampaignMessage(
                                campaign_id=campaign_id,
                                subscriber_id=sub.id,
                                phone=sub.phone,
                                status='failed',
                                error=err,
                            ))
                            failed += 1
                    except Exception as exc:
                        db.add(models_pg.WhatsAppCampaignMessage(
                            campaign_id=campaign_id,
                            subscriber_id=sub.id,
                            phone=sub.phone,
                            status='failed',
                            error=str(exc),
                        ))
                        failed += 1

            campaign.sent_count = sent
            campaign.failed_count = failed
            campaign.status = 'sent'
            campaign.sent_at = datetime.now(timezone.utc)
            campaign.updated_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info(f"[WA Acquisition] campaign {campaign_id} done: sent={sent} failed={failed}")
        except Exception as exc:
            logger.exception(f"[WA Acquisition] campaign {campaign_id} background error: {exc}")


@router.post("/whatsapp/acquisition/campaigns/{campaign_id}/send")
async def send_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    campaign = await _get_campaign(campaign_id, current_user.company_id, db)
    if campaign.status not in ('draft', 'scheduled'):
        raise HTTPException(status_code=400, detail="Campaign already sent or in progress")

    q = select(func.count()).where(
        models_pg.WhatsAppSubscriber.company_id == current_user.company_id,
        models_pg.WhatsAppSubscriber.opted_out_at.is_(None),
    )
    if campaign.segment_tags:
        for tag in campaign.segment_tags:
            q = q.where(models_pg.WhatsAppSubscriber.tags.contains([tag]))
    total = (await db.execute(q)).scalar_one()

    if total == 0:
        raise HTTPException(status_code=400, detail="No active subscribers match this campaign's segment")

    campaign.status = 'sending'
    campaign.total_recipients = total
    campaign.sent_at = datetime.now(timezone.utc)
    campaign.updated_at = datetime.now(timezone.utc)
    await db.commit()

    background_tasks.add_task(_broadcast_campaign, campaign_id, current_user.company_id)

    return {"status": "queued", "total_recipients": total}


@router.post("/whatsapp/acquisition/campaigns/{campaign_id}/test-send")
async def test_send_campaign(
    campaign_id: str,
    body: TestSendBody,
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    campaign = await _get_campaign(campaign_id, current_user.company_id, db)

    config = (await db.execute(
        select(models_pg.WhatsAppConfig).where(
            models_pg.WhatsAppConfig.company_id == current_user.company_id,
            models_pg.WhatsAppConfig.enabled == True,
        )
    )).scalar_one_or_none()

    if not config or not config.phone_number_id or not config.access_token_enc:
        raise HTTPException(status_code=400, detail="WhatsApp is not configured. Set up WhatsApp in Settings first.")

    phone = re.sub(r'\D', '', body.phone)
    payload = _build_template_payload(campaign, phone)

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{WA_BASE_URL}/{config.phone_number_id}/messages",
                headers={
                    "Authorization": f"Bearer {config.access_token_enc}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            data = resp.json()
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"WhatsApp API error: {exc}")

    if resp.status_code == 200 and "messages" in data:
        return {"status": "sent", "wa_message_id": data["messages"][0].get("id")}
    else:
        err = data.get("error", {}).get("message", str(data))
        raise HTTPException(status_code=400, detail=f"WhatsApp API rejected: {err}")


@router.get("/whatsapp/acquisition/campaigns/{campaign_id}/stats")
async def campaign_stats(
    campaign_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    campaign = await _get_campaign(campaign_id, current_user.company_id, db)
    msgs = (await db.execute(
        select(models_pg.WhatsAppCampaignMessage).where(
            models_pg.WhatsAppCampaignMessage.campaign_id == campaign_id
        )
    )).scalars().all()

    by_status: Dict[str, int] = {}
    for m in msgs:
        by_status[m.status] = by_status.get(m.status, 0) + 1

    return {
        "campaign": _serialize_campaign(campaign),
        "by_status": by_status,
        "messages": [
            {
                "id": m.id,
                "phone": m.phone,
                "status": m.status,
                "sent_at": m.sent_at.isoformat() if m.sent_at else None,
                "error": m.error,
            }
            for m in msgs[:200]
        ],
    }


# ---------------------------------------------------------------------------
# Aggregate stats
# ---------------------------------------------------------------------------

@router.get("/whatsapp/acquisition/stats")
async def acquisition_stats(
    db: AsyncSession = Depends(get_db),
    current_user: models_pg.User = Depends(get_current_user),
):
    cid = current_user.company_id

    total_subs = (await db.execute(
        select(func.count()).where(
            models_pg.WhatsAppSubscriber.company_id == cid,
            models_pg.WhatsAppSubscriber.opted_out_at.is_(None),
        )
    )).scalar_one()

    total_opted_out = (await db.execute(
        select(func.count()).where(
            models_pg.WhatsAppSubscriber.company_id == cid,
            models_pg.WhatsAppSubscriber.opted_out_at.isnot(None),
        )
    )).scalar_one()

    total_campaigns = (await db.execute(
        select(func.count()).where(models_pg.WhatsAppCampaign.company_id == cid)
    )).scalar_one()

    sent_campaigns = (await db.execute(
        select(
            func.sum(models_pg.WhatsAppCampaign.sent_count),
            func.sum(models_pg.WhatsAppCampaign.delivered_count),
            func.sum(models_pg.WhatsAppCampaign.read_count),
            func.sum(models_pg.WhatsAppCampaign.failed_count),
        ).where(
            models_pg.WhatsAppCampaign.company_id == cid,
            models_pg.WhatsAppCampaign.status == 'sent',
        )
    )).one()

    total_sent = int(sent_campaigns[0] or 0)
    total_delivered = int(sent_campaigns[1] or 0)
    total_read = int(sent_campaigns[2] or 0)
    total_failed = int(sent_campaigns[3] or 0)

    source_breakdown = (await db.execute(
        select(
            models_pg.WhatsAppSubscriber.source,
            func.count().label('count'),
        ).where(
            models_pg.WhatsAppSubscriber.company_id == cid,
            models_pg.WhatsAppSubscriber.opted_out_at.is_(None),
        ).group_by(models_pg.WhatsAppSubscriber.source)
    )).all()

    return {
        "total_subscribers": total_subs,
        "total_opted_out": total_opted_out,
        "total_campaigns": total_campaigns,
        "total_sent": total_sent,
        "total_delivered": total_delivered,
        "total_read": total_read,
        "total_failed": total_failed,
        "delivery_rate": round(total_delivered / total_sent * 100, 1) if total_sent > 0 else 0,
        "read_rate": round(total_read / total_sent * 100, 1) if total_sent > 0 else 0,
        "source_breakdown": [{"source": r[0], "count": r[1]} for r in source_breakdown],
    }


# ---------------------------------------------------------------------------
# Webhook — Meta delivery / read status updates
# ---------------------------------------------------------------------------

@router.get("/whatsapp/acquisition/webhook")
async def webhook_verify(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
):
    """Meta webhook verification handshake."""
    import os
    verify_token = os.environ.get("WA_WEBHOOK_VERIFY_TOKEN", "riserve_wa_verify")
    if hub_mode == "subscribe" and hub_verify_token == verify_token:
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(hub_challenge or "")
    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/whatsapp/acquisition/webhook", status_code=200)
async def webhook_receive(request: Request):
    """
    Process delivery/read status updates from Meta.
    Updates WhatsAppCampaignMessage.status and WhatsAppCampaign delivered/read counts.
    """
    try:
        body = await request.json()
    except Exception:
        return {"status": "ignored"}

    statuses = []
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for s in value.get("statuses", []):
                statuses.append(s)

    if not statuses:
        return {"status": "no_statuses"}

    async with AsyncSession(engine) as db:
        for s in statuses:
            wa_id = s.get("id")
            new_status = s.get("status")  # delivered, read, failed
            if not wa_id or new_status not in ("delivered", "read", "failed"):
                continue

            msg = (await db.execute(
                select(models_pg.WhatsAppCampaignMessage).where(
                    models_pg.WhatsAppCampaignMessage.wa_message_id == wa_id
                )
            )).scalar_one_or_none()

            if not msg:
                continue

            # Advance status only — never regress (read > delivered > sent)
            rank = {"sent": 0, "delivered": 1, "read": 2, "failed": -1}
            if rank.get(new_status, -1) > rank.get(msg.status, 0):
                old_status = msg.status
                msg.status = new_status

                campaign = (await db.execute(
                    select(models_pg.WhatsAppCampaign).where(
                        models_pg.WhatsAppCampaign.id == msg.campaign_id
                    )
                )).scalar_one_or_none()

                if campaign:
                    if new_status == "delivered":
                        campaign.delivered_count = (campaign.delivered_count or 0) + 1
                    elif new_status == "read":
                        campaign.read_count = (campaign.read_count or 0) + 1
                        # If advancing from sent → read, also count as delivered
                        if old_status == "sent":
                            campaign.delivered_count = (campaign.delivered_count or 0) + 1

        await db.commit()

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Scheduler — fire due scheduled campaigns
# ---------------------------------------------------------------------------

async def acquisition_scheduler_background_task():
    """Runs every 60 seconds. Finds scheduled campaigns whose time has passed and broadcasts them."""
    while True:
        await asyncio.sleep(60)
        try:
            now = datetime.now(timezone.utc)
            async with AsyncSession(engine) as db:
                due = (await db.execute(
                    select(models_pg.WhatsAppCampaign).where(
                        models_pg.WhatsAppCampaign.status == 'scheduled',
                        models_pg.WhatsAppCampaign.scheduled_at <= now,
                    )
                )).scalars().all()

                for campaign in due:
                    campaign.status = 'sending'
                    campaign.updated_at = now

                await db.commit()

            for campaign in due:
                logger.info(f"[WA Scheduler] Firing scheduled campaign {campaign.id} ({campaign.name})")
                asyncio.create_task(_broadcast_campaign(campaign.id, campaign.company_id))

        except Exception as exc:
            logger.exception(f"[WA Scheduler] error: {exc}")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_campaign(
    campaign_id: str,
    company_id: str,
    db: AsyncSession,
) -> models_pg.WhatsAppCampaign:
    campaign = (await db.execute(
        select(models_pg.WhatsAppCampaign).where(
            models_pg.WhatsAppCampaign.id == campaign_id,
            models_pg.WhatsAppCampaign.company_id == company_id,
        )
    )).scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


def _serialize_campaign(c: models_pg.WhatsAppCampaign) -> Dict[str, Any]:
    return {
        "id": c.id,
        "name": c.name,
        "template_name": c.template_name,
        "template_params": c.template_params or [],
        "segment_tags": c.segment_tags or [],
        "status": c.status,
        "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
        "sent_at": c.sent_at.isoformat() if c.sent_at else None,
        "total_recipients": c.total_recipients,
        "sent_count": c.sent_count,
        "delivered_count": c.delivered_count,
        "read_count": c.read_count,
        "failed_count": c.failed_count,
        "cta_button_text": c.cta_button_text,
        "cta_button_url": c.cta_button_url,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }
