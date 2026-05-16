"""
Invoice delivery service — sends invoices via email (SendGrid) and/or WhatsApp.

Called from POST /invoices/{id}/send. Both channels are best-effort:
failures are logged but do not prevent the invoice status from updating.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


def _render(template: str, **kwargs) -> str:
    """Simple {key} substitution — no external dep needed."""
    try:
        return template.format(**kwargs)
    except (KeyError, ValueError):
        return template


async def send_invoice_email(
    *,
    to_email: str,
    customer_name: str,
    invoice_number: str,
    total_amount: float,
    currency_symbol: str,
    due_date: Optional[str],
    company_name: str,
    subject_template: str,
    body_template: str,
) -> bool:
    """Send invoice via SendGrid. Returns True on success."""
    api_key = os.getenv("SENDGRID_API_KEY", "")
    from_email = os.getenv("SENDGRID_FROM_EMAIL", "")
    if not api_key or not from_email:
        logger.info("[Invoice] SendGrid not configured — skipping email delivery")
        return False

    ctx = dict(
        invoice_number=invoice_number,
        customer_name=customer_name,
        total_amount=f"{currency_symbol}{total_amount:,.2f}",
        due_date=due_date or "On receipt",
        company_name=company_name,
    )
    subject = _render(subject_template, **ctx)
    body = _render(body_template, **ctx)

    payload = {
        "personalizations": [{"to": [{"email": to_email, "name": customer_name}]}],
        "from": {"email": from_email, "name": company_name},
        "subject": subject,
        "content": [{"type": "text/plain", "value": body}],
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post("https://api.sendgrid.com/v3/mail/send", headers=headers, json=payload)
        if resp.status_code in (200, 202):
            logger.info(f"[Invoice] Email sent to {to_email} for invoice {invoice_number}")
            return True
        logger.warning(f"[Invoice] SendGrid returned {resp.status_code} for {invoice_number}: {resp.text[:200]}")
        return False
    except Exception as e:
        logger.error(f"[Invoice] Email delivery error for {invoice_number}: {e}")
        return False


async def send_invoice_whatsapp(
    *,
    to_phone: str,
    customer_name: str,
    invoice_number: str,
    total_amount: float,
    currency_symbol: str,
    due_date: Optional[str],
    company_name: str,
) -> bool:
    """Send a WhatsApp text notification via the Cloud API. Returns True on success."""
    token = os.getenv("WHATSAPP_API_TOKEN", "")
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    if not token or not phone_id:
        logger.info("[Invoice] WhatsApp not configured — skipping WA delivery")
        return False

    # Normalize phone: strip non-digits, ensure country code
    phone = "".join(c for c in to_phone if c.isdigit())
    if not phone:
        return False

    text = (
        f"Hi {customer_name}, your invoice *{invoice_number}* from *{company_name}* "
        f"is ready.\n\nAmount due: *{currency_symbol}{total_amount:,.2f}*"
        + (f"\nDue by: {due_date}" if due_date else "")
        + "\n\nThank you for your business!"
    )

    url = f"https://graph.facebook.com/v18.0/{phone_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "text",
        "text": {"body": text},
    }
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
        if resp.status_code == 200:
            logger.info(f"[Invoice] WhatsApp sent to {phone} for invoice {invoice_number}")
            return True
        logger.warning(f"[Invoice] WhatsApp returned {resp.status_code} for {invoice_number}: {resp.text[:200]}")
        return False
    except Exception as e:
        logger.error(f"[Invoice] WhatsApp delivery error for {invoice_number}: {e}")
        return False
