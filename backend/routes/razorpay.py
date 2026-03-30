"""
Razorpay Route integration routes.

Company-level:
  GET  /razorpay/config              — fetch own config (bank details masked)
  PUT  /razorpay/config              — save/update primary + bank details
  POST /razorpay/create-account      — trigger Razorpay linked account creation
  GET  /razorpay/fee-preview         — fee breakdown for a given amount
  POST /razorpay/order               — create a payment order (with Route transfer)
  POST /razorpay/verify              — verify payment signature
  POST /razorpay/webhook             — Razorpay webhook receiver

Super Admin:
  GET  /super-admin/razorpay/stats               — platform-wide overview
  GET  /super-admin/razorpay/config/{company_id} — fetch any company's config
  PUT  /super-admin/razorpay/config/{company_id} — update (incl. platform fee)
  POST /super-admin/razorpay/create-account/{company_id} — provision on behalf of company
"""

import hashlib
import hmac
import json
import logging
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

import models_pg
from database_pg import get_db
from routes.dependencies import get_current_user, get_super_admin
from services.razorpay_service import (
    create_linked_account,
    create_order_with_transfer,
    calculate_fees,
    verify_payment_signature,
    fetch_payment,
)

router = APIRouter()
logger = logging.getLogger(__name__)

DEFAULT_PLATFORM_FEE_PCT = 1.75


# ────────────────────────────────────────────────────────────────────────────
# Schemas
# ────────────────────────────────────────────────────────────────────────────
class RazorpayConfigUpdate(BaseModel):
    enabled: bool = False
    linked_account_name: Optional[str] = None
    contact_number:      Optional[str] = None
    email:               Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_type:   Optional[str] = None
    ifsc_code:           Optional[str] = None
    beneficiary_name:    Optional[str] = None


class SuperAdminConfigUpdate(RazorpayConfigUpdate):
    platform_fee_pct: Optional[float] = None


class CreateOrderRequest(BaseModel):
    amount: float          # service amount in INR (excl. all fees)
    receipt: str
    notes: Optional[dict] = None


class VerifyPaymentRequest(BaseModel):
    order_id:   str
    payment_id: str
    signature:  str


# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────
def _mask(value: Optional[str]) -> Optional[str]:
    if not value or len(value) < 6:
        return None
    return value[:2] + "•" * (len(value) - 4) + value[-2:]


async def _get_or_create_config(
    company_id: str, db: AsyncSession
) -> models_pg.RazorpayConfig:
    result = await db.execute(
        select(models_pg.RazorpayConfig).where(
            models_pg.RazorpayConfig.company_id == company_id
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        cfg = models_pg.RazorpayConfig(
            id=str(uuid.uuid4()),
            company_id=company_id,
            platform_fee_pct=DEFAULT_PLATFORM_FEE_PCT,
        )
        db.add(cfg)
        await db.flush()
    return cfg


def _serialize_config(cfg: models_pg.RazorpayConfig, mask_sensitive: bool = True) -> dict:
    return {
        "enabled": cfg.enabled,
        "linked_account_name": cfg.linked_account_name,
        "contact_number": cfg.contact_number,
        "email": cfg.email,
        "bank_account_number": _mask(cfg.bank_account_number) if mask_sensitive else cfg.bank_account_number,
        "bank_account_type": cfg.bank_account_type,
        "ifsc_code": cfg.ifsc_code,
        "beneficiary_name": cfg.beneficiary_name,
        "razorpay_account_id": cfg.razorpay_account_id,
        "account_status": cfg.account_status or "draft",
        "penny_test_status": cfg.penny_test_status or "pending",
        "platform_fee_pct": cfg.platform_fee_pct,
        "gst_rate": 18.0,
    }


# ────────────────────────────────────────────────────────────────────────────
# Company-level endpoints
# ────────────────────────────────────────────────────────────────────────────
@router.get("/razorpay/config")
async def get_razorpay_config(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.RazorpayConfig).where(
            models_pg.RazorpayConfig.company_id == current_user["company_id"]
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        return {
            "enabled": False,
            "linked_account_name": None,
            "contact_number": None,
            "email": None,
            "bank_account_number": None,
            "bank_account_type": None,
            "ifsc_code": None,
            "beneficiary_name": None,
            "razorpay_account_id": None,
            "account_status": "draft",
            "penny_test_status": "pending",
            "platform_fee_pct": DEFAULT_PLATFORM_FEE_PCT,
            "gst_rate": 18.0,
        }
    return _serialize_config(cfg)


@router.put("/razorpay/config")
async def update_razorpay_config(
    body: RazorpayConfigUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cfg = await _get_or_create_config(current_user["company_id"], db)
    cfg.enabled = body.enabled
    if body.linked_account_name is not None:
        cfg.linked_account_name = body.linked_account_name
    if body.contact_number is not None:
        cfg.contact_number = body.contact_number
    if body.email is not None:
        cfg.email = body.email
    if body.bank_account_number is not None:
        cfg.bank_account_number = body.bank_account_number
    if body.bank_account_type is not None:
        cfg.bank_account_type = body.bank_account_type
    if body.ifsc_code is not None:
        cfg.ifsc_code = body.ifsc_code
    if body.beneficiary_name is not None:
        cfg.beneficiary_name = body.beneficiary_name
    await db.commit()
    return {"success": True, "message": "Configuration saved"}


@router.post("/razorpay/create-account")
async def create_razorpay_account(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger linked account creation using the company's saved config."""
    cfg = await _get_or_create_config(current_user["company_id"], db)

    missing = [
        f for f in ["linked_account_name", "email", "contact_number",
                    "bank_account_number", "ifsc_code", "beneficiary_name"]
        if not getattr(cfg, f)
    ]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required fields: {', '.join(missing)}")

    result = await create_linked_account(
        name=cfg.linked_account_name,
        email=cfg.email,
        contact=cfg.contact_number,
        beneficiary_name=cfg.beneficiary_name,
        bank_account_number=cfg.bank_account_number,
        ifsc=cfg.ifsc_code,
        account_type=cfg.bank_account_type or "savings",
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    cfg.razorpay_account_id    = result["account_id"]
    cfg.razorpay_stakeholder_id = result.get("stakeholder_id")
    cfg.account_status         = "pending_verification"
    cfg.penny_test_status      = "initiated"
    await db.commit()

    return {
        "success": True,
        "account_id": result["account_id"],
        "account_status": "pending_verification",
    }


@router.get("/razorpay/fee-preview")
async def fee_preview(
    amount: float,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.RazorpayConfig).where(
            models_pg.RazorpayConfig.company_id == current_user["company_id"]
        )
    )
    cfg = result.scalar_one_or_none()
    pct = cfg.platform_fee_pct if cfg else DEFAULT_PLATFORM_FEE_PCT
    return calculate_fees(amount, pct)


@router.post("/razorpay/order")
async def create_payment_order(
    body: CreateOrderRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.RazorpayConfig).where(
            models_pg.RazorpayConfig.company_id == current_user["company_id"],
            models_pg.RazorpayConfig.enabled == True,
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg or not cfg.razorpay_account_id:
        raise HTTPException(status_code=400, detail="Razorpay not configured or linked account missing")

    order = await create_order_with_transfer(
        service_amount_inr=body.amount,
        platform_fee_pct=cfg.platform_fee_pct,
        linked_account_id=cfg.razorpay_account_id,
        receipt=body.receipt,
        notes=body.notes,
    )
    if not order["success"]:
        raise HTTPException(status_code=400, detail=order["error"])

    return order


@router.post("/razorpay/verify")
async def verify_razorpay_payment(
    body: VerifyPaymentRequest,
    current_user=Depends(get_current_user),
):
    ok = verify_payment_signature(body.order_id, body.payment_id, body.signature)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid payment signature")
    payment = await fetch_payment(body.payment_id)
    return {"verified": True, "payment": payment}


@router.post("/razorpay/webhook")
async def razorpay_webhook(request: Request):
    """
    Receive and validate Razorpay webhooks.
    Razorpay signs the body with X-Razorpay-Signature (HMAC-SHA256 using webhook secret).
    """
    secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    body_bytes = await request.body()
    sig_header  = request.headers.get("X-Razorpay-Signature", "")

    if secret:
        expected = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig_header):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        event = json.loads(body_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = event.get("event", "")
    logger.info(f"[Razorpay webhook] {event_type}")

    # Handle key events — extend as needed
    if event_type == "payment.captured":
        payment = event.get("payload", {}).get("payment", {}).get("entity", {})
        logger.info(f"[Razorpay] payment captured: {payment.get('id')}")

    elif event_type == "transfer.processed":
        transfer = event.get("payload", {}).get("transfer", {}).get("entity", {})
        logger.info(f"[Razorpay] transfer processed: {transfer.get('id')} → {transfer.get('recipient')}")

    elif event_type == "account.activated":
        acct = event.get("payload", {}).get("account", {}).get("entity", {})
        logger.info(f"[Razorpay] linked account activated: {acct.get('id')}")

    return {"status": "ok"}


# ────────────────────────────────────────────────────────────────────────────
# Super Admin endpoints
# ────────────────────────────────────────────────────────────────────────────
@router.get("/super-admin/razorpay/stats")
async def super_admin_razorpay_stats(
    _=Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    configs_result = await db.execute(select(models_pg.RazorpayConfig))
    configs = list(configs_result.scalars().all())

    companies_result = await db.execute(
        select(models_pg.Company).where(models_pg.Company.status == "active")
    )
    company_map = {c.id: c for c in companies_result.scalars().all()}
    config_map  = {c.company_id: c for c in configs}

    breakdown = []
    for cid, comp in company_map.items():
        cfg = config_map.get(cid)
        breakdown.append({
            "company_id":           cid,
            "company_name":         comp.name,
            "company_plan":         comp.plan,
            "rp_configured":        cfg is not None,
            "rp_enabled":           cfg.enabled if cfg else False,
            "linked_account_name":  cfg.linked_account_name if cfg else None,
            "email":                cfg.email if cfg else None,
            "contact_number":       cfg.contact_number if cfg else None,
            "bank_account_number":  _mask(cfg.bank_account_number) if cfg else None,
            "bank_account_type":    cfg.bank_account_type if cfg else None,
            "ifsc_code":            cfg.ifsc_code if cfg else None,
            "beneficiary_name":     cfg.beneficiary_name if cfg else None,
            "razorpay_account_id":  cfg.razorpay_account_id if cfg else None,
            "account_status":       cfg.account_status if cfg else "draft",
            "penny_test_status":    cfg.penny_test_status if cfg else "pending",
            "platform_fee_pct":     cfg.platform_fee_pct if cfg else DEFAULT_PLATFORM_FEE_PCT,
        })

    configured = sum(1 for b in breakdown if b["rp_configured"])
    active      = sum(1 for b in breakdown if b["account_status"] == "active")

    return {
        "companies_total":      len(company_map),
        "companies_configured": configured,
        "companies_active":     active,
        "per_company": sorted(breakdown, key=lambda x: x["company_name"]),
    }


@router.get("/super-admin/razorpay/config/{company_id}")
async def super_admin_get_razorpay_config(
    company_id: str,
    _=Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.RazorpayConfig).where(
            models_pg.RazorpayConfig.company_id == company_id
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        return {
            "enabled": False, "linked_account_name": None, "contact_number": None,
            "email": None, "bank_account_number": None, "bank_account_type": None,
            "ifsc_code": None, "beneficiary_name": None, "razorpay_account_id": None,
            "account_status": "draft", "penny_test_status": "pending",
            "platform_fee_pct": DEFAULT_PLATFORM_FEE_PCT, "gst_rate": 18.0,
        }
    return _serialize_config(cfg, mask_sensitive=False)


@router.put("/super-admin/razorpay/config/{company_id}")
async def super_admin_update_razorpay_config(
    company_id: str,
    body: SuperAdminConfigUpdate,
    _=Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    comp = await db.get(models_pg.Company, company_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Company not found")

    cfg = await _get_or_create_config(company_id, db)

    cfg.enabled = body.enabled
    for field in ["linked_account_name", "contact_number", "email",
                  "bank_account_number", "bank_account_type", "ifsc_code", "beneficiary_name"]:
        val = getattr(body, field)
        if val is not None:
            setattr(cfg, field, val)
    if body.platform_fee_pct is not None:
        cfg.platform_fee_pct = body.platform_fee_pct

    await db.commit()
    return {"success": True, "message": f"Razorpay config saved for {comp.name}"}


@router.post("/super-admin/razorpay/create-account/{company_id}")
async def super_admin_create_razorpay_account(
    company_id: str,
    _=Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    cfg = await _get_or_create_config(company_id, db)

    missing = [
        f for f in ["linked_account_name", "email", "contact_number",
                    "bank_account_number", "ifsc_code", "beneficiary_name"]
        if not getattr(cfg, f)
    ]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing: {', '.join(missing)}")

    result = await create_linked_account(
        name=cfg.linked_account_name,
        email=cfg.email,
        contact=cfg.contact_number,
        beneficiary_name=cfg.beneficiary_name,
        bank_account_number=cfg.bank_account_number,
        ifsc=cfg.ifsc_code,
        account_type=cfg.bank_account_type or "savings",
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    cfg.razorpay_account_id     = result["account_id"]
    cfg.razorpay_stakeholder_id = result.get("stakeholder_id")
    cfg.account_status          = "pending_verification"
    cfg.penny_test_status       = "initiated"
    await db.commit()

    return {
        "success": True,
        "account_id": result["account_id"],
        "account_status": "pending_verification",
    }
