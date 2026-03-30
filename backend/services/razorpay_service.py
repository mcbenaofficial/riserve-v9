"""
Razorpay Route service.

Handles:
  - Linked Account creation  (POST /v2/accounts)
  - Stakeholder creation     (POST /v2/accounts/{id}/stakeholders)
  - Order creation with Route transfer
  - Payment signature verification
  - Fee breakdown calculation

Fee model
─────────
Customer pays:     service_amount  (already includes any applicable service GST)
Platform deducts:  platform_fee  = service_amount × platform_fee_pct / 100
                   platform_gst  = platform_fee × 18%   (statutory GST on platform services)
Merchant receives: service_amount − platform_fee − platform_gst
                   (Razorpay deducts its own 2% PG fee + 0.25% transfer fee from settlement)

All amounts passed to Razorpay APIs are in PAISE (1 INR = 100 paise).
"""

import hashlib
import hmac
import httpx
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

RAZORPAY_BASE_V1 = "https://api.razorpay.com/v1"
RAZORPAY_BASE_V2 = "https://api.razorpay.com/v2"

# Standard rates (informational — Razorpay deducts these from platform settlement)
RAZORPAY_PG_FEE_PCT    = 2.0    # % of order amount
RAZORPAY_TRANSFER_PCT  = 0.25   # % of transfer amount
GST_RATE               = 18.0   # % on platform fee


def _auth() -> tuple[str, str]:
    """Return (key_id, key_secret) from env."""
    key_id     = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    return key_id, key_secret


# ────────────────────────────────────────────────────────────────────────────
# Fee calculator
# ────────────────────────────────────────────────────────────────────────────
def calculate_fees(service_amount_inr: float, platform_fee_pct: float) -> dict:
    """
    Returns a full fee breakdown for a given service amount (in INR).
    All monetary values in the returned dict are in INR (floats).
    """
    platform_fee  = round(service_amount_inr * platform_fee_pct / 100, 2)
    platform_gst  = round(platform_fee * GST_RATE / 100, 2)
    pg_fee        = round(service_amount_inr * RAZORPAY_PG_FEE_PCT / 100, 2)
    transfer_fee  = round((service_amount_inr - platform_fee - platform_gst) * RAZORPAY_TRANSFER_PCT / 100, 2)
    merchant_recv = round(service_amount_inr - platform_fee - platform_gst, 2)

    return {
        "service_amount":  service_amount_inr,
        "platform_fee":    platform_fee,
        "platform_gst":    platform_gst,
        "platform_total":  round(platform_fee + platform_gst, 2),
        "pg_fee_est":      pg_fee,          # informational — deducted by Razorpay from settlement
        "transfer_fee_est": transfer_fee,   # informational
        "merchant_receives": merchant_recv,
        "customer_pays":   service_amount_inr,  # no extra charge to customer
        "platform_fee_pct": platform_fee_pct,
        "gst_rate":        GST_RATE,
    }


# ────────────────────────────────────────────────────────────────────────────
# Linked Account creation
# ────────────────────────────────────────────────────────────────────────────
async def create_linked_account(
    name: str,
    email: str,
    contact: str,
    beneficiary_name: str,
    bank_account_number: str,
    ifsc: str,
    account_type: str,
) -> dict:
    """
    Creates a Razorpay Route linked account and adds the bank account via stakeholder.
    Returns: { success, account_id, stakeholder_id, error }
    """
    key_id, key_secret = _auth()

    account_payload = {
        "email": email,
        "profile": {
            "category": "services",
            "subcategory": "service_centre",
            "addresses": {
                "registered": {
                    "street1": "NA",
                    "city": "NA",
                    "state": "MH",
                    "postal_code": 400001,
                    "country": "IN",
                }
            },
        },
        "legal_info": {"pan": "AAACR5055K"},  # placeholder; must be replaced in prod
        "legal_entity_name": name,
        "business_type": "individual",
        "contact_name": name,
        "contact_info": {"contact_mobile": contact.replace("+", "")},
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Step 1: Create the linked account
            acct_resp = await client.post(
                f"{RAZORPAY_BASE_V2}/accounts",
                json=account_payload,
                auth=(key_id, key_secret),
            )
            acct_data = acct_resp.json()
            if acct_resp.status_code not in (200, 201):
                err = acct_data.get("error", {}).get("description", str(acct_data))
                logger.warning(f"[Razorpay] create_account failed: {err}")
                return {"success": False, "error": err}

            account_id = acct_data["id"]

            # Step 2: Add stakeholder (bank account holder)
            sth_payload = {
                "name": beneficiary_name,
                "email": email,
                "relationship": {"director": True},
                "phone": {"primary": contact.replace("+", "")},
            }
            sth_resp = await client.post(
                f"{RAZORPAY_BASE_V2}/accounts/{account_id}/stakeholders",
                json=sth_payload,
                auth=(key_id, key_secret),
            )
            sth_data = sth_resp.json()
            stakeholder_id = sth_data.get("id") if sth_resp.status_code in (200, 201) else None

            # Step 3: Attach bank account
            bank_payload = {
                "settlements": {
                    "account_number": bank_account_number,
                    "ifsc_code": ifsc,
                    "beneficiary_name": beneficiary_name,
                }
            }
            await client.patch(
                f"{RAZORPAY_BASE_V2}/accounts/{account_id}",
                json=bank_payload,
                auth=(key_id, key_secret),
            )

        logger.info(f"[Razorpay] linked account created: {account_id}")
        return {
            "success": True,
            "account_id": account_id,
            "stakeholder_id": stakeholder_id,
        }

    except Exception as exc:
        logger.exception(f"[Razorpay] create_linked_account exception: {exc}")
        return {"success": False, "error": str(exc)}


# ────────────────────────────────────────────────────────────────────────────
# Order creation with Route transfer
# ────────────────────────────────────────────────────────────────────────────
async def create_order_with_transfer(
    service_amount_inr: float,
    platform_fee_pct: float,
    linked_account_id: str,
    receipt: str,
    notes: Optional[dict] = None,
) -> dict:
    """
    Creates a Razorpay order. The transfer to the linked account is attached
    so Razorpay Route automatically splits on payment capture.

    Returns: { success, order_id, amount_paise, transfer_amount_paise, fees, error }
    """
    key_id, key_secret = _auth()
    fees = calculate_fees(service_amount_inr, platform_fee_pct)

    order_amount_paise   = int(fees["customer_pays"] * 100)
    transfer_amount_paise = int(fees["merchant_receives"] * 100)

    payload = {
        "amount":   order_amount_paise,
        "currency": "INR",
        "receipt":  receipt,
        "notes":    notes or {},
        "transfers": [
            {
                "account":  linked_account_id,
                "amount":   transfer_amount_paise,
                "currency": "INR",
                "on_hold":  False,
                "notes":    {"description": "Service payment transfer"},
            }
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{RAZORPAY_BASE_V1}/orders",
                json=payload,
                auth=(key_id, key_secret),
            )
        data = resp.json()
        if resp.status_code not in (200, 201):
            err = data.get("error", {}).get("description", str(data))
            return {"success": False, "error": err}

        return {
            "success": True,
            "order_id": data["id"],
            "amount_paise": order_amount_paise,
            "transfer_amount_paise": transfer_amount_paise,
            "fees": fees,
        }

    except Exception as exc:
        logger.exception(f"[Razorpay] create_order exception: {exc}")
        return {"success": False, "error": str(exc)}


# ────────────────────────────────────────────────────────────────────────────
# Payment signature verification
# ────────────────────────────────────────────────────────────────────────────
def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify Razorpay payment signature (HMAC-SHA256)."""
    _, key_secret = _auth()
    message = f"{order_id}|{payment_id}"
    expected = hmac.new(
        key_secret.encode("utf-8"),
        message.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


# ────────────────────────────────────────────────────────────────────────────
# Fetch payment details
# ────────────────────────────────────────────────────────────────────────────
async def fetch_payment(payment_id: str) -> dict:
    key_id, key_secret = _auth()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{RAZORPAY_BASE_V1}/payments/{payment_id}",
                auth=(key_id, key_secret),
            )
        return resp.json()
    except Exception as exc:
        logger.exception(f"[Razorpay] fetch_payment {payment_id}: {exc}")
        return {}
