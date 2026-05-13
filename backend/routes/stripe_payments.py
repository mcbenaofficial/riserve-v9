"""
Stripe Connect payment routes.

Company-level:
  GET  /stripe/config                      — fetch own config (+ platform publishable key)
  PUT  /stripe/config                      — upsert enabled + platform_fee_pct
  POST /stripe/connect/account             — create Express Connect account + return onboarding URL
  POST /stripe/connect/account/refresh     — regenerate onboarding link for existing account
  GET  /stripe/connect/account/dashboard   — Express dashboard login link (active accounts only)
  GET  /stripe/connect/account/status      — sync account status from Stripe API
  POST /stripe/payment-intent              — create PaymentIntent with application fee + transfer
  GET  /stripe/fee-preview                 — fee breakdown for a given amount (query param)
  POST /stripe/webhook                     — Stripe webhook receiver

Super Admin:
  GET  /super-admin/stripe/stats               — platform-wide overview
  GET  /super-admin/stripe/config/{company_id} — fetch any company's config
  PUT  /super-admin/stripe/config/{company_id} — update platform_fee_pct + enabled
"""

import logging
import os
import uuid
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import models_pg
from database_pg import get_db
from routes.dependencies import get_current_user, get_super_admin
from services.stripe_service import (
    calculate_fees,
    create_account_link,
    create_connect_account,
    create_dashboard_link,
    create_payment_intent,
    construct_event,
    retrieve_account,
    DEFAULT_PLATFORM_FEE_PCT,
)

router = APIRouter()
logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3001")


# ────────────────────────────────────────────────────────────────────────────
# Schemas
# ────────────────────────────────────────────────────────────────────────────
class StripeConfigUpdate(BaseModel):
    enabled: bool = False
    platform_fee_pct: Optional[float] = None


class CreateConnectAccountRequest(BaseModel):
    email: str
    business_name: str


class CreatePaymentIntentRequest(BaseModel):
    amount: float          # in cents (smallest currency unit)
    currency: str = "usd"
    receipt: str
    metadata: Optional[dict] = None


class SuperAdminConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    platform_fee_pct: Optional[float] = None


# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────
async def _get_or_create_config(
    company_id: str, db: AsyncSession
) -> models_pg.StripeConfig:
    result = await db.execute(
        select(models_pg.StripeConfig).where(
            models_pg.StripeConfig.company_id == company_id
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        cfg = models_pg.StripeConfig(
            id=str(uuid.uuid4()),
            company_id=company_id,
            platform_fee_pct=DEFAULT_PLATFORM_FEE_PCT,
        )
        db.add(cfg)
        await db.flush()
    return cfg


def _serialize_config(cfg: models_pg.StripeConfig) -> dict:
    return {
        "enabled": cfg.enabled,
        "connect_account_id": cfg.connect_account_id,
        "connect_account_status": cfg.connect_account_status or "not_started",
        "connect_details_submitted": cfg.connect_details_submitted,
        "connect_charges_enabled": cfg.connect_charges_enabled,
        "connect_payouts_enabled": cfg.connect_payouts_enabled,
        "platform_fee_pct": cfg.platform_fee_pct,
        "publishable_key": os.getenv("STRIPE_PUBLISHABLE_KEY", ""),
    }


def _derive_status(charges_enabled: bool, details_submitted: bool) -> str:
    if charges_enabled:
        return "active"
    if details_submitted:
        return "pending"
    return "not_started"


# ────────────────────────────────────────────────────────────────────────────
# Company-level endpoints
# ────────────────────────────────────────────────────────────────────────────
@router.get("/stripe/config")
async def get_stripe_config(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.StripeConfig).where(
            models_pg.StripeConfig.company_id == current_user["company_id"]
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        return {
            "enabled": False,
            "connect_account_id": None,
            "connect_account_status": "not_started",
            "connect_details_submitted": False,
            "connect_charges_enabled": False,
            "connect_payouts_enabled": False,
            "platform_fee_pct": DEFAULT_PLATFORM_FEE_PCT,
            "publishable_key": os.getenv("STRIPE_PUBLISHABLE_KEY", ""),
        }
    return _serialize_config(cfg)


@router.put("/stripe/config")
async def update_stripe_config(
    body: StripeConfigUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cfg = await _get_or_create_config(current_user["company_id"], db)
    cfg.enabled = body.enabled
    # Only allow super admins to change platform fee — company admins get enabled toggle only
    # (Super admin endpoint below handles fee changes for other companies)
    await db.commit()
    return {"success": True, "message": "Configuration saved"}


@router.post("/stripe/connect/account")
async def create_stripe_connect_account(
    body: CreateConnectAccountRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Connect Express account for the company and return the onboarding URL."""
    cfg = await _get_or_create_config(current_user["company_id"], db)

    result = await create_connect_account(
        email=body.email,
        business_name=body.business_name,
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    cfg.connect_account_id = result["account_id"]
    cfg.connect_account_status = "pending"
    await db.flush()

    return_url = f"{FRONTEND_URL}/integrations/stripe/return"
    refresh_url = f"{FRONTEND_URL}/integrations/stripe/refresh"

    link_result = await create_account_link(
        account_id=result["account_id"],
        refresh_url=refresh_url,
        return_url=return_url,
    )
    if not link_result["success"]:
        await db.commit()  # still save the account_id
        raise HTTPException(status_code=400, detail=link_result["error"])

    await db.commit()
    return {
        "success": True,
        "account_id": result["account_id"],
        "onboarding_url": link_result["url"],
    }


@router.post("/stripe/connect/account/refresh")
async def refresh_stripe_onboarding_link(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate the onboarding account link for an existing Connect account."""
    result = await db.execute(
        select(models_pg.StripeConfig).where(
            models_pg.StripeConfig.company_id == current_user["company_id"]
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg or not cfg.connect_account_id:
        raise HTTPException(status_code=400, detail="No Stripe Connect account found. Create one first.")

    return_url = f"{FRONTEND_URL}/integrations/stripe/return"
    refresh_url = f"{FRONTEND_URL}/integrations/stripe/refresh"

    link_result = await create_account_link(
        account_id=cfg.connect_account_id,
        refresh_url=refresh_url,
        return_url=return_url,
    )
    if not link_result["success"]:
        raise HTTPException(status_code=400, detail=link_result["error"])

    return {"success": True, "onboarding_url": link_result["url"]}


@router.get("/stripe/connect/account/dashboard")
async def get_stripe_dashboard_link(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate an Express dashboard login link (only for active/charges-enabled accounts)."""
    result = await db.execute(
        select(models_pg.StripeConfig).where(
            models_pg.StripeConfig.company_id == current_user["company_id"]
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg or not cfg.connect_account_id:
        raise HTTPException(status_code=400, detail="No Stripe Connect account found.")
    if not cfg.connect_charges_enabled:
        raise HTTPException(status_code=400, detail="Account is not yet active. Complete onboarding first.")

    link_result = await create_dashboard_link(cfg.connect_account_id)
    if not link_result["success"]:
        raise HTTPException(status_code=400, detail=link_result["error"])

    return {"success": True, "url": link_result["url"]}


@router.get("/stripe/connect/account/status")
async def sync_stripe_account_status(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sync the Connect account status from the Stripe API and update DB."""
    result = await db.execute(
        select(models_pg.StripeConfig).where(
            models_pg.StripeConfig.company_id == current_user["company_id"]
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg or not cfg.connect_account_id:
        return {
            "connect_account_id": None,
            "connect_account_status": "not_started",
            "connect_charges_enabled": False,
            "connect_payouts_enabled": False,
            "connect_details_submitted": False,
        }

    acct_result = await retrieve_account(cfg.connect_account_id)
    if not acct_result["success"]:
        raise HTTPException(status_code=400, detail=acct_result["error"])

    cfg.connect_charges_enabled = acct_result["charges_enabled"]
    cfg.connect_payouts_enabled = acct_result["payouts_enabled"]
    cfg.connect_details_submitted = acct_result["details_submitted"]
    cfg.connect_account_status = _derive_status(
        acct_result["charges_enabled"], acct_result["details_submitted"]
    )
    await db.commit()

    return {
        "connect_account_id": cfg.connect_account_id,
        "connect_account_status": cfg.connect_account_status,
        "connect_charges_enabled": cfg.connect_charges_enabled,
        "connect_payouts_enabled": cfg.connect_payouts_enabled,
        "connect_details_submitted": cfg.connect_details_submitted,
    }


@router.post("/stripe/payment-intent")
async def create_stripe_payment_intent(
    body: CreatePaymentIntentRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.StripeConfig).where(
            models_pg.StripeConfig.company_id == current_user["company_id"],
            models_pg.StripeConfig.enabled == True,
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg or not cfg.connect_account_id:
        raise HTTPException(status_code=400, detail="Stripe not configured or Connect account missing.")
    if not cfg.connect_charges_enabled:
        raise HTTPException(status_code=400, detail="Stripe Connect account is not yet active.")

    # amount is in cents already; calculate fee in cents
    application_fee_cents = int(body.amount * cfg.platform_fee_pct / 100)

    intent_result = await create_payment_intent(
        amount_cents=int(body.amount),
        currency=body.currency,
        application_fee_cents=application_fee_cents,
        connected_account_id=cfg.connect_account_id,
        metadata={**(body.metadata or {}), "receipt": body.receipt},
    )
    if not intent_result["success"]:
        raise HTTPException(status_code=400, detail=intent_result["error"])

    return intent_result


@router.get("/stripe/fee-preview")
async def stripe_fee_preview(
    amount: float,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return fee breakdown for a given amount (in major currency units, e.g. dollars)."""
    result = await db.execute(
        select(models_pg.StripeConfig).where(
            models_pg.StripeConfig.company_id == current_user["company_id"]
        )
    )
    cfg = result.scalar_one_or_none()
    pct = cfg.platform_fee_pct if cfg else DEFAULT_PLATFORM_FEE_PCT
    return calculate_fees(amount, pct)


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Receive and validate Stripe webhooks.
    Stripe signs the body with the Stripe-Signature header (HMAC-SHA256).
    """
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    body_bytes = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")

    if webhook_secret:
        try:
            event = construct_event(body_bytes, sig_header, webhook_secret)
        except stripe.error.SignatureVerificationError:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid webhook payload")
    else:
        import json
        try:
            event = json.loads(body_bytes)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = event.get("type", "") if isinstance(event, dict) else event.type
    logger.info(f"[Stripe webhook] {event_type}")

    if event_type == "account.updated":
        data = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
        acct_id = data.get("id") if isinstance(data, dict) else data.id
        charges_enabled = data.get("charges_enabled", False) if isinstance(data, dict) else data.charges_enabled
        payouts_enabled = data.get("payouts_enabled", False) if isinstance(data, dict) else data.payouts_enabled
        details_submitted = data.get("details_submitted", False) if isinstance(data, dict) else data.details_submitted

        result = await db.execute(
            select(models_pg.StripeConfig).where(
                models_pg.StripeConfig.connect_account_id == acct_id
            )
        )
        cfg = result.scalar_one_or_none()
        if cfg:
            cfg.connect_charges_enabled = charges_enabled
            cfg.connect_payouts_enabled = payouts_enabled
            cfg.connect_details_submitted = details_submitted
            cfg.connect_account_status = _derive_status(charges_enabled, details_submitted)
            await db.commit()
            logger.info(f"[Stripe] account.updated synced for {acct_id}")

    elif event_type == "payment_intent.succeeded":
        data = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
        pi_id = data.get("id") if isinstance(data, dict) else data.id
        logger.info(f"[Stripe] payment_intent.succeeded: {pi_id}")

    elif event_type == "payment_intent.payment_failed":
        data = event.get("data", {}).get("object", {}) if isinstance(event, dict) else event.data.object
        pi_id = data.get("id") if isinstance(data, dict) else data.id
        logger.info(f"[Stripe] payment_intent.payment_failed: {pi_id}")

    return {"status": "ok"}


# ────────────────────────────────────────────────────────────────────────────
# Super Admin endpoints
# ────────────────────────────────────────────────────────────────────────────
@router.get("/super-admin/stripe/stats")
async def super_admin_stripe_stats(
    _=Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    configs_result = await db.execute(select(models_pg.StripeConfig))
    configs = list(configs_result.scalars().all())

    companies_result = await db.execute(
        select(models_pg.Company).where(models_pg.Company.status == "active")
    )
    company_map = {c.id: c for c in companies_result.scalars().all()}
    config_map = {c.company_id: c for c in configs}

    breakdown = []
    for cid, comp in company_map.items():
        cfg = config_map.get(cid)
        breakdown.append({
            "company_id": cid,
            "company_name": comp.name,
            "company_plan": comp.plan,
            "stripe_configured": cfg is not None,
            "stripe_enabled": cfg.enabled if cfg else False,
            "connect_account_id": cfg.connect_account_id if cfg else None,
            "connect_account_status": cfg.connect_account_status if cfg else "not_started",
            "connect_charges_enabled": cfg.connect_charges_enabled if cfg else False,
            "connect_payouts_enabled": cfg.connect_payouts_enabled if cfg else False,
            "connect_details_submitted": cfg.connect_details_submitted if cfg else False,
            "platform_fee_pct": cfg.platform_fee_pct if cfg else DEFAULT_PLATFORM_FEE_PCT,
        })

    configured = sum(1 for b in breakdown if b["stripe_configured"])
    active = sum(1 for b in breakdown if b["connect_account_status"] == "active")

    return {
        "companies_total": len(company_map),
        "companies_configured": configured,
        "companies_active": active,
        "per_company": sorted(breakdown, key=lambda x: x["company_name"]),
    }


@router.get("/super-admin/stripe/config/{company_id}")
async def super_admin_get_stripe_config(
    company_id: str,
    _=Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.StripeConfig).where(
            models_pg.StripeConfig.company_id == company_id
        )
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        return {
            "enabled": False,
            "connect_account_id": None,
            "connect_account_status": "not_started",
            "connect_details_submitted": False,
            "connect_charges_enabled": False,
            "connect_payouts_enabled": False,
            "platform_fee_pct": DEFAULT_PLATFORM_FEE_PCT,
            "publishable_key": os.getenv("STRIPE_PUBLISHABLE_KEY", ""),
        }
    return _serialize_config(cfg)


@router.put("/super-admin/stripe/config/{company_id}")
async def super_admin_update_stripe_config(
    company_id: str,
    body: SuperAdminConfigUpdate,
    _=Depends(get_super_admin),
    db: AsyncSession = Depends(get_db),
):
    comp = await db.get(models_pg.Company, company_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Company not found")

    cfg = await _get_or_create_config(company_id, db)
    if body.enabled is not None:
        cfg.enabled = body.enabled
    if body.platform_fee_pct is not None:
        cfg.platform_fee_pct = body.platform_fee_pct

    await db.commit()
    return {"success": True, "message": f"Stripe config saved for {comp.name}"}
