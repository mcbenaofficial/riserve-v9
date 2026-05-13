"""Stripe Connect service helpers."""

import os
import stripe
from typing import Optional

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")

DEFAULT_PLATFORM_FEE_PCT = 1.5


def calculate_fees(amount: float, platform_fee_pct: float) -> dict:
    """Return fee breakdown dict for a given service amount (in dollars/currency units)."""
    platform_fee = round(amount * platform_fee_pct / 100, 2)
    stripe_pct_fee = round(amount * 0.029, 2)  # 2.9%
    stripe_fixed_fee = 0.30  # $0.30 fixed
    stripe_total = round(stripe_pct_fee + stripe_fixed_fee, 2)
    merchant_receives = round(amount - platform_fee - stripe_total, 2)
    return {
        "service_amount": amount,
        "platform_fee_pct": platform_fee_pct,
        "platform_fee": platform_fee,
        "stripe_fee_pct": round(stripe_pct_fee, 2),
        "stripe_fee_fixed": stripe_fixed_fee,
        "stripe_fee_total": stripe_total,
        "merchant_receives": merchant_receives,
    }


async def create_connect_account(email: str, business_name: str) -> dict:
    try:
        account = stripe.Account.create(
            type="express",
            email=email,
            business_profile={"name": business_name},
            capabilities={
                "card_payments": {"requested": True},
                "transfers": {"requested": True},
            },
        )
        return {"success": True, "account_id": account.id}
    except stripe.error.StripeError as e:
        return {"success": False, "error": str(e.user_message)}


async def create_account_link(account_id: str, refresh_url: str, return_url: str) -> dict:
    try:
        link = stripe.AccountLink.create(
            account=account_id,
            refresh_url=refresh_url,
            return_url=return_url,
            type="account_onboarding",
        )
        return {"success": True, "url": link.url}
    except stripe.error.StripeError as e:
        return {"success": False, "error": str(e.user_message)}


async def create_dashboard_link(account_id: str) -> dict:
    try:
        link = stripe.Account.create_login_link(account_id)
        return {"success": True, "url": link.url}
    except stripe.error.StripeError as e:
        return {"success": False, "error": str(e.user_message)}


async def retrieve_account(account_id: str) -> dict:
    try:
        acct = stripe.Account.retrieve(account_id)
        return {
            "success": True,
            "charges_enabled": acct.charges_enabled,
            "payouts_enabled": acct.payouts_enabled,
            "details_submitted": acct.details_submitted,
        }
    except stripe.error.StripeError as e:
        return {"success": False, "error": str(e.user_message)}


async def create_payment_intent(
    amount_cents: int,
    currency: str,
    application_fee_cents: int,
    connected_account_id: str,
    metadata: Optional[dict] = None,
) -> dict:
    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency=currency,
            application_fee_amount=application_fee_cents,
            transfer_data={"destination": connected_account_id},
            metadata=metadata or {},
        )
        return {
            "success": True,
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id,
        }
    except stripe.error.StripeError as e:
        return {"success": False, "error": str(e.user_message)}


def construct_event(payload: bytes, sig_header: str, webhook_secret: str):
    return stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
