"""
WhatsApp Business Cloud API service.

Sends utility (transactional) template messages via the Meta Cloud API.
Each company stores its own credentials in WhatsAppConfig.

Template trigger keys (used as keys in WhatsAppConfig.templates JSONB):
    booking_confirmed
    booking_reminder
    booking_cancelled
    booking_completed
    order_confirmed
    order_ready
    order_cancelled
    payment_receipt
"""

import logging
import httpx
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

import models_pg

logger = logging.getLogger(__name__)

# WhatsApp Cloud API base
WA_API_VERSION = "v19.0"
WA_BASE_URL = f"https://graph.facebook.com/{WA_API_VERSION}"

# Estimated per-message cost in USD for utility messages (approximation)
UTILITY_MESSAGE_COST_USD = 0.005


async def _get_config(company_id: str, db: AsyncSession) -> Optional[models_pg.WhatsAppConfig]:
    result = await db.execute(
        select(models_pg.WhatsAppConfig).where(
            models_pg.WhatsAppConfig.company_id == company_id,
            models_pg.WhatsAppConfig.enabled == True,
        )
    )
    return result.scalar_one_or_none()


async def send_template_message(
    company_id: str,
    trigger: str,
    recipient_phone: str,
    recipient_name: str,
    template_variables: list[str],
    db: AsyncSession,
) -> dict:
    """
    Dispatch a WhatsApp template message for a given trigger event.

    Returns a dict with keys: success (bool), message_id (str|None), error (str|None)
    """
    config = await _get_config(company_id, db)
    if not config:
        return {"success": False, "error": "WhatsApp not configured or disabled"}

    templates: dict = config.templates or {}
    tpl_cfg = templates.get(trigger)
    if not tpl_cfg or not tpl_cfg.get("active", False):
        return {"success": False, "error": f"Template for trigger '{trigger}' is inactive"}

    template_name = tpl_cfg.get("template_name", "")
    language_code = tpl_cfg.get("language", "en")
    if not template_name:
        return {"success": False, "error": "No template_name configured"}

    # Normalise phone number — strip non-digit chars, ensure no leading +
    phone = recipient_phone.replace("+", "").replace(" ", "").replace("-", "")

    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language_code},
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        {"type": "text", "text": v} for v in template_variables
                    ],
                }
            ] if template_variables else [],
        },
    }

    log = models_pg.WhatsAppMessageLog(
        id=str(uuid.uuid4()),
        company_id=company_id,
        trigger=trigger,
        template_name=template_name,
        recipient_phone=phone,
        recipient_name=recipient_name,
        status="queued",
        cost_usd=UTILITY_MESSAGE_COST_USD,
    )
    db.add(log)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
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
            wa_msg_id = data["messages"][0].get("id")
            log.status = "sent"
            log.wa_message_id = wa_msg_id
            await db.commit()
            logger.info(f"[WhatsApp] sent trigger={trigger} to={phone} msg_id={wa_msg_id}")
            return {"success": True, "message_id": wa_msg_id}
        else:
            error_detail = data.get("error", {}).get("message", str(data))
            log.status = "failed"
            log.error_message = error_detail
            await db.commit()
            logger.warning(f"[WhatsApp] failed trigger={trigger} to={phone}: {error_detail}")
            return {"success": False, "error": error_detail}

    except Exception as exc:
        log.status = "failed"
        log.error_message = str(exc)
        await db.commit()
        logger.exception(f"[WhatsApp] exception trigger={trigger} to={phone}: {exc}")
        return {"success": False, "error": str(exc)}


async def send_booking_confirmation(
    company_id: str,
    customer_name: str,
    customer_phone: str,
    outlet_name: str,
    service_name: str,
    appointment_time: str,
    db: AsyncSession,
) -> dict:
    return await send_template_message(
        company_id=company_id,
        trigger="booking_confirmed",
        recipient_phone=customer_phone,
        recipient_name=customer_name,
        template_variables=[customer_name, service_name, outlet_name, appointment_time],
        db=db,
    )


async def send_booking_reminder(
    company_id: str,
    customer_name: str,
    customer_phone: str,
    outlet_name: str,
    appointment_time: str,
    db: AsyncSession,
) -> dict:
    return await send_template_message(
        company_id=company_id,
        trigger="booking_reminder",
        recipient_phone=customer_phone,
        recipient_name=customer_name,
        template_variables=[customer_name, outlet_name, appointment_time],
        db=db,
    )


async def send_booking_cancelled(
    company_id: str,
    customer_name: str,
    customer_phone: str,
    outlet_name: str,
    db: AsyncSession,
) -> dict:
    return await send_template_message(
        company_id=company_id,
        trigger="booking_cancelled",
        recipient_phone=customer_phone,
        recipient_name=customer_name,
        template_variables=[customer_name, outlet_name],
        db=db,
    )


async def send_order_confirmed(
    company_id: str,
    customer_name: str,
    customer_phone: str,
    order_number: str,
    outlet_name: str,
    db: AsyncSession,
) -> dict:
    return await send_template_message(
        company_id=company_id,
        trigger="order_confirmed",
        recipient_phone=customer_phone,
        recipient_name=customer_name,
        template_variables=[customer_name, order_number, outlet_name],
        db=db,
    )


async def send_order_ready(
    company_id: str,
    customer_name: str,
    customer_phone: str,
    order_number: str,
    outlet_name: str,
    db: AsyncSession,
) -> dict:
    return await send_template_message(
        company_id=company_id,
        trigger="order_ready",
        recipient_phone=customer_phone,
        recipient_name=customer_name,
        template_variables=[customer_name, order_number, outlet_name],
        db=db,
    )


async def send_payment_receipt(
    company_id: str,
    customer_name: str,
    customer_phone: str,
    amount: str,
    outlet_name: str,
    db: AsyncSession,
) -> dict:
    return await send_template_message(
        company_id=company_id,
        trigger="payment_receipt",
        recipient_phone=customer_phone,
        recipient_name=customer_name,
        template_variables=[customer_name, amount, outlet_name],
        db=db,
    )
