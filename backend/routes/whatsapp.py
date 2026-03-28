"""
WhatsApp integration routes.

Company-level:
  GET  /whatsapp/config           — fetch config (credentials masked)
  PUT  /whatsapp/config           — save/update config
  POST /whatsapp/test             — send a test message
  GET  /whatsapp/logs             — paginated message log for this company
  GET  /whatsapp/stats            — aggregate delivery stats for this company

Super Admin:
  GET  /super-admin/whatsapp/stats   — platform-wide usage + per-company breakdown
"""

import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from pydantic import BaseModel

from database_pg import get_db
from routes.dependencies import get_current_user, get_super_admin
import models_pg
from services.whatsapp_service import send_template_message, UTILITY_MESSAGE_COST_USD

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Default template definitions (shown in the UI even before config is saved)
# ---------------------------------------------------------------------------
DEFAULT_TEMPLATES = [
    {
        "trigger": "booking_confirmed",
        "label": "Booking Confirmation",
        "description": "Sent when a booking is created",
        "default_template_name": "booking_confirmation",
        "variables": ["customer_name", "service_name", "outlet_name", "appointment_time"],
        "active": True,
        "language": "en",
    },
    {
        "trigger": "booking_reminder",
        "label": "Booking Reminder",
        "description": "Sent 1 hour before the appointment",
        "default_template_name": "booking_reminder",
        "variables": ["customer_name", "outlet_name", "appointment_time"],
        "active": True,
        "language": "en",
    },
    {
        "trigger": "booking_cancelled",
        "label": "Booking Cancelled",
        "description": "Sent when a booking is cancelled",
        "default_template_name": "booking_cancelled",
        "variables": ["customer_name", "outlet_name"],
        "active": True,
        "language": "en",
    },
    {
        "trigger": "booking_completed",
        "label": "Service Completed",
        "description": "Sent when a booking is marked complete",
        "default_template_name": "service_completed",
        "variables": ["customer_name", "service_name", "outlet_name"],
        "active": False,
        "language": "en",
    },
    {
        "trigger": "order_confirmed",
        "label": "Order Confirmed",
        "description": "Sent when a restaurant order is placed",
        "default_template_name": "order_confirmed",
        "variables": ["customer_name", "order_number", "outlet_name"],
        "active": True,
        "language": "en",
    },
    {
        "trigger": "order_ready",
        "label": "Order Ready for Pickup",
        "description": "Sent when order status moves to ReadyToCollect",
        "default_template_name": "order_ready",
        "variables": ["customer_name", "order_number", "outlet_name"],
        "active": True,
        "language": "en",
    },
    {
        "trigger": "order_cancelled",
        "label": "Order Cancelled",
        "description": "Sent when an order is cancelled",
        "default_template_name": "order_cancelled",
        "variables": ["customer_name", "order_number"],
        "active": True,
        "language": "en",
    },
    {
        "trigger": "payment_receipt",
        "label": "Payment Receipt",
        "description": "Sent after a successful payment",
        "default_template_name": "payment_receipt",
        "variables": ["customer_name", "amount", "outlet_name"],
        "active": False,
        "language": "en",
    },
]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class WhatsAppConfigUpdate(BaseModel):
    enabled: bool = False
    phone_number_id: Optional[str] = None
    waba_id: Optional[str] = None
    access_token: Optional[str] = None   # plain-text on the way in; stored as-is (encrypt in prod)
    display_phone: Optional[str] = None
    templates: Optional[dict] = None


class TestMessageRequest(BaseModel):
    recipient_phone: str
    trigger: str = "booking_confirmed"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _mask_token(token: Optional[str]) -> Optional[str]:
    if not token or len(token) < 8:
        return None
    return token[:4] + "•" * (len(token) - 8) + token[-4:]


def _merge_templates(saved: dict) -> list:
    """Merge saved per-trigger overrides on top of DEFAULT_TEMPLATES."""
    merged = []
    for tpl in DEFAULT_TEMPLATES:
        trigger = tpl["trigger"]
        override = saved.get(trigger, {})
        merged.append({
            **tpl,
            "template_name": override.get("template_name", tpl["default_template_name"]),
            "active": override.get("active", tpl["active"]),
            "language": override.get("language", tpl["language"]),
        })
    return merged


# ---------------------------------------------------------------------------
# Company-level endpoints
# ---------------------------------------------------------------------------
@router.get("/whatsapp/config")
async def get_whatsapp_config(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.WhatsAppConfig).where(
            models_pg.WhatsAppConfig.company_id == current_user["company_id"]
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        return {
            "enabled": False,
            "phone_number_id": None,
            "waba_id": None,
            "access_token_masked": None,
            "display_phone": None,
            "templates": _merge_templates({}),
        }

    return {
        "enabled": config.enabled,
        "phone_number_id": config.phone_number_id,
        "waba_id": config.waba_id,
        "access_token_masked": _mask_token(config.access_token_enc),
        "display_phone": config.display_phone,
        "templates": _merge_templates(config.templates or {}),
    }


@router.put("/whatsapp/config")
async def update_whatsapp_config(
    body: WhatsAppConfigUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = current_user["company_id"]

    result = await db.execute(
        select(models_pg.WhatsAppConfig).where(
            models_pg.WhatsAppConfig.company_id == company_id
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        config = models_pg.WhatsAppConfig(
            id=str(uuid.uuid4()),
            company_id=company_id,
        )
        db.add(config)

    config.enabled = body.enabled
    if body.phone_number_id is not None:
        config.phone_number_id = body.phone_number_id
    if body.waba_id is not None:
        config.waba_id = body.waba_id
    if body.access_token is not None and body.access_token.strip():
        config.access_token_enc = body.access_token  # encrypt in production
    if body.display_phone is not None:
        config.display_phone = body.display_phone
    if body.templates is not None:
        config.templates = body.templates

    await db.commit()
    return {"success": True, "message": "WhatsApp configuration saved"}


@router.post("/whatsapp/test")
async def send_test_message(
    body: TestMessageRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await send_template_message(
        company_id=current_user["company_id"],
        trigger=body.trigger,
        recipient_phone=body.recipient_phone,
        recipient_name=current_user.get("name", "Test User"),
        template_variables=["Test User", "Test Service", "Test Outlet", "12:00 PM"],
        db=db,
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"success": True, "message_id": result.get("message_id")}


@router.get("/whatsapp/logs")
async def get_whatsapp_logs(
    page: int = 1,
    limit: int = 50,
    trigger: Optional[str] = None,
    status: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = current_user["company_id"]
    filters = [models_pg.WhatsAppMessageLog.company_id == company_id]
    if trigger:
        filters.append(models_pg.WhatsAppMessageLog.trigger == trigger)
    if status:
        filters.append(models_pg.WhatsAppMessageLog.status == status)

    total_result = await db.execute(
        select(func.count(models_pg.WhatsAppMessageLog.id)).where(and_(*filters))
    )
    total = total_result.scalar()

    logs_result = await db.execute(
        select(models_pg.WhatsAppMessageLog)
        .where(and_(*filters))
        .order_by(models_pg.WhatsAppMessageLog.sent_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    logs = logs_result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "logs": [
            {
                "id": log.id,
                "trigger": log.trigger,
                "template_name": log.template_name,
                "recipient_phone": log.recipient_phone,
                "recipient_name": log.recipient_name,
                "status": log.status,
                "wa_message_id": log.wa_message_id,
                "error_message": log.error_message,
                "cost_usd": log.cost_usd,
                "sent_at": log.sent_at.isoformat() if log.sent_at else None,
            }
            for log in logs
        ],
    }


@router.get("/whatsapp/stats")
async def get_whatsapp_stats(
    days: int = 30,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = current_user["company_id"]
    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = await db.execute(
        select(
            models_pg.WhatsAppMessageLog.status,
            models_pg.WhatsAppMessageLog.trigger,
            func.count(models_pg.WhatsAppMessageLog.id).label("count"),
            func.sum(models_pg.WhatsAppMessageLog.cost_usd).label("cost"),
        )
        .where(
            models_pg.WhatsAppMessageLog.company_id == company_id,
            models_pg.WhatsAppMessageLog.sent_at >= since,
        )
        .group_by(
            models_pg.WhatsAppMessageLog.status,
            models_pg.WhatsAppMessageLog.trigger,
        )
    )
    data = rows.all()

    total_sent = sum(r.count for r in data if r.status == "sent")
    total_failed = sum(r.count for r in data if r.status == "failed")
    total_cost = sum((r.cost or 0) for r in data)

    by_trigger = {}
    for r in data:
        if r.trigger not in by_trigger:
            by_trigger[r.trigger] = {"sent": 0, "failed": 0}
        by_trigger[r.trigger][r.status] = r.count

    return {
        "period_days": days,
        "total_sent": total_sent,
        "total_failed": total_failed,
        "total_cost_usd": round(total_cost, 4),
        "delivery_rate": round(total_sent / (total_sent + total_failed) * 100, 1) if (total_sent + total_failed) else 0,
        "by_trigger": by_trigger,
    }


# ---------------------------------------------------------------------------
# Super Admin endpoints — manage any company's WhatsApp config
# ---------------------------------------------------------------------------
@router.get("/super-admin/whatsapp/config/{company_id}")
async def super_admin_get_company_whatsapp_config(
    company_id: str,
    _=Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.WhatsAppConfig).where(
            models_pg.WhatsAppConfig.company_id == company_id
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        return {
            "enabled": False,
            "phone_number_id": None,
            "waba_id": None,
            "access_token_masked": None,
            "display_phone": None,
            "templates": _merge_templates({}),
        }

    return {
        "enabled": config.enabled,
        "phone_number_id": config.phone_number_id,
        "waba_id": config.waba_id,
        "access_token_masked": _mask_token(config.access_token_enc),
        "display_phone": config.display_phone,
        "templates": _merge_templates(config.templates or {}),
    }


@router.put("/super-admin/whatsapp/config/{company_id}")
async def super_admin_update_company_whatsapp_config(
    company_id: str,
    body: WhatsAppConfigUpdate,
    _=Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    # Verify company exists
    comp = await db.get(models_pg.Company, company_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Company not found")

    result = await db.execute(
        select(models_pg.WhatsAppConfig).where(
            models_pg.WhatsAppConfig.company_id == company_id
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        config = models_pg.WhatsAppConfig(
            id=str(uuid.uuid4()),
            company_id=company_id,
        )
        db.add(config)

    config.enabled = body.enabled
    if body.phone_number_id is not None:
        config.phone_number_id = body.phone_number_id
    if body.waba_id is not None:
        config.waba_id = body.waba_id
    if body.access_token is not None and body.access_token.strip():
        config.access_token_enc = body.access_token
    if body.display_phone is not None:
        config.display_phone = body.display_phone
    if body.templates is not None:
        config.templates = body.templates

    await db.commit()
    return {"success": True, "message": f"WhatsApp configuration saved for {comp.name}"}


@router.post("/super-admin/whatsapp/test/{company_id}")
async def super_admin_send_test_message(
    company_id: str,
    body: TestMessageRequest,
    _=Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await send_template_message(
        company_id=company_id,
        trigger=body.trigger,
        recipient_phone=body.recipient_phone,
        recipient_name="Super Admin Test",
        template_variables=["Test User", "Test Service", "Test Outlet", "12:00 PM"],
        db=db,
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"success": True, "message_id": result.get("message_id")}


# ---------------------------------------------------------------------------
# Super Admin endpoint — platform-wide WhatsApp usage
# ---------------------------------------------------------------------------
@router.get("/super-admin/whatsapp/stats")
async def super_admin_whatsapp_stats(
    days: int = 30,
    _=Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Per-company aggregate
    rows = await db.execute(
        select(
            models_pg.WhatsAppMessageLog.company_id,
            models_pg.WhatsAppMessageLog.status,
            func.count(models_pg.WhatsAppMessageLog.id).label("count"),
            func.sum(models_pg.WhatsAppMessageLog.cost_usd).label("cost"),
        )
        .where(models_pg.WhatsAppMessageLog.sent_at >= since)
        .group_by(
            models_pg.WhatsAppMessageLog.company_id,
            models_pg.WhatsAppMessageLog.status,
        )
    )
    raw = rows.all()

    # Fetch all WA-configured companies
    configs_result = await db.execute(select(models_pg.WhatsAppConfig))
    configs = {c.company_id: c for c in configs_result.scalars().all()}

    # Fetch ALL active companies (so unconfigured ones are also surfaced)
    companies_result = await db.execute(
        select(models_pg.Company).where(models_pg.Company.status == "active")
    )
    company_map = {c.id: c for c in companies_result.scalars().all()}

    # Aggregate by company
    per_company: dict = {}
    for r in raw:
        cid = r.company_id
        if cid not in per_company:
            per_company[cid] = {"sent": 0, "failed": 0, "cost": 0.0}
        per_company[cid][r.status] = r.count
        per_company[cid]["cost"] += r.cost or 0.0

    breakdown = []
    for cid, comp in company_map.items():
        cfg = configs.get(cid)
        stats = per_company.get(cid, {"sent": 0, "failed": 0, "cost": 0.0})
        sent = stats.get("sent", 0)
        failed = stats.get("failed", 0)
        breakdown.append({
            "company_id": cid,
            "company_name": comp.name,
            "company_plan": comp.plan,
            "wa_configured": cfg is not None,
            "wa_enabled": cfg.enabled if cfg else False,
            "display_phone": cfg.display_phone if cfg else None,
            "messages_sent": sent,
            "messages_failed": failed,
            "delivery_rate": round(sent / (sent + failed) * 100, 1) if (sent + failed) else 0,
            "cost_usd": round(stats["cost"], 4),
        })

    total_sent = sum(b["messages_sent"] for b in breakdown)
    total_failed = sum(b["messages_failed"] for b in breakdown)
    total_cost = sum(b["cost_usd"] for b in breakdown)
    enabled_count = sum(1 for b in breakdown if b["wa_enabled"])
    configured_count = sum(1 for b in breakdown if b["wa_configured"])

    return {
        "period_days": days,
        "companies_total": len(company_map),
        "companies_with_wa": configured_count,
        "companies_wa_enabled": enabled_count,
        "total_messages_sent": total_sent,
        "total_messages_failed": total_failed,
        "total_cost_usd": round(total_cost, 4),
        "platform_delivery_rate": round(total_sent / (total_sent + total_failed) * 100, 1) if (total_sent + total_failed) else 0,
        "per_company": sorted(breakdown, key=lambda x: x["messages_sent"], reverse=True),
    }
