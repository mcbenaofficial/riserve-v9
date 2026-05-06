"""
WhatsApp Cloud API adapter (Meta Cloud API v19.0, no BSP).

To swap in a BSP (Gupshup, AiSensy …) later, implement the same
ChannelAdapter interface and update the registry in send_pipeline.py.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from .base import ChannelType, InboundEvent, OutboundContent, SendResult

logger = logging.getLogger(__name__)

WA_API_VERSION = "v19.0"
WA_BASE_URL = f"https://graph.facebook.com/{WA_API_VERSION}"
FREEFORM_WINDOW_HOURS = 24  # Meta's customer-service window


class WhatsAppCloudAdapter:
    channel = ChannelType.WHATSAPP

    # ------------------------------------------------------------------
    # Credentials
    # ------------------------------------------------------------------

    def _get_credentials(self, inbox) -> tuple:
        """Returns (phone_number_id, waba_id, access_token)."""
        try:
            creds = json.loads(inbox.credentials_ref or "{}")
        except Exception:
            creds = {}
        phone_number_id = creds.get("phone_number_id", "")
        waba_id = creds.get("waba_id", "")
        access_token = creds.get("access_token") or os.environ.get("WA_ACCESS_TOKEN", "")
        return phone_number_id, waba_id, access_token

    # ------------------------------------------------------------------
    # Window check
    # ------------------------------------------------------------------

    def supports_freeform(self, *, last_inbound_at: Optional[datetime]) -> bool:
        """True when the customer messaged us within the last 24 hours."""
        if last_inbound_at is None:
            return False
        now = datetime.now(timezone.utc)
        if last_inbound_at.tzinfo is None:
            last_inbound_at = last_inbound_at.replace(tzinfo=timezone.utc)
        return (now - last_inbound_at) < timedelta(hours=FREEFORM_WINDOW_HOURS)

    # ------------------------------------------------------------------
    # Outbound send
    # ------------------------------------------------------------------

    async def send(
        self,
        *,
        inbox,
        to,
        content: OutboundContent,
        idempotency_key: str,
    ) -> SendResult:
        phone_number_id, _, access_token = self._get_credentials(inbox)
        url = f"{WA_BASE_URL}/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        recipient = getattr(to, "external_id", str(to))

        if content.content_type == "template":
            body = {
                "messaging_product": "whatsapp",
                "to": recipient,
                "type": "template",
                "template": {
                    "name": content.template_name,
                    "language": {"code": content.template_language or "en"},
                    "components": content.template_components or [],
                },
                "biz_opaque_callback_data": idempotency_key,
            }
        elif content.content_type == "image" and content.media_url:
            body = {
                "messaging_product": "whatsapp",
                "to": recipient,
                "type": "image",
                "image": {"link": content.media_url, "caption": content.text or ""},
                "biz_opaque_callback_data": idempotency_key,
            }
        elif content.content_type == "document" and content.media_url:
            body = {
                "messaging_product": "whatsapp",
                "to": recipient,
                "type": "document",
                "document": {"link": content.media_url, "caption": content.text or ""},
                "biz_opaque_callback_data": idempotency_key,
            }
        else:
            body = {
                "messaging_product": "whatsapp",
                "to": recipient,
                "type": "text",
                "text": {"body": content.text or ""},
                "biz_opaque_callback_data": idempotency_key,
            }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, json=body)
                data = resp.json()
                if resp.status_code == 200 and data.get("messages"):
                    return SendResult(
                        success=True,
                        channel_message_id=data["messages"][0].get("id"),
                        raw_response=data,
                    )
                return SendResult(
                    success=False,
                    error=str(data.get("error", data)),
                    raw_response=data,
                )
        except Exception as exc:
            logger.exception("WhatsApp send failed")
            return SendResult(success=False, error=str(exc))

    # ------------------------------------------------------------------
    # Inbound parse
    # ------------------------------------------------------------------

    async def parse_inbound(
        self,
        *,
        inbox,
        payload: dict,
        signature: Optional[str],
    ) -> list:
        events: list = []
        try:
            for entry in payload.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    for msg in value.get("messages", []):
                        sender = msg.get("from", "")
                        msg_id = msg.get("id", "")
                        ts = msg.get("timestamp")
                        timestamp = (
                            datetime.fromtimestamp(int(ts), tz=timezone.utc)
                            if ts
                            else datetime.now(timezone.utc)
                        )

                        content_type = msg.get("type", "text")
                        content_text: Optional[str] = None
                        attachments: list = []

                        if content_type == "text":
                            content_text = msg.get("text", {}).get("body", "")
                        elif content_type in ("image", "audio", "video", "document", "sticker"):
                            media = msg.get(content_type, {})
                            attachments = [{
                                "type": content_type,
                                "id": media.get("id"),
                                "mime_type": media.get("mime_type"),
                                "sha256": media.get("sha256"),
                            }]
                        elif content_type == "interactive":
                            ir = msg.get("interactive", {})
                            content_text = (
                                ir.get("button_reply", {}).get("title")
                                or ir.get("list_reply", {}).get("title")
                            )
                        elif content_type == "location":
                            loc = msg.get("location", {})
                            content_text = f"📍 {loc.get('latitude')},{loc.get('longitude')}"
                        elif content_type == "reaction":
                            content_text = msg.get("reaction", {}).get("emoji", "👍")

                        events.append(InboundEvent(
                            channel="whatsapp",
                            external_id=sender,
                            channel_message_id=msg_id,
                            content_type=content_type,
                            content_text=content_text,
                            attachments=attachments,
                            raw=msg,
                            timestamp=timestamp,
                        ))

                    # Handle status updates (delivered / read receipts)
                    for status in value.get("statuses", []):
                        logger.debug("WA status update: %s", status)

        except Exception:
            logger.exception("Error parsing WhatsApp inbound payload")
        return events

    # ------------------------------------------------------------------
    # Signature verification
    # ------------------------------------------------------------------

    def verify_signature(
        self,
        *,
        payload_bytes: bytes,
        signature: str,
        webhook_secret: str,
    ) -> bool:
        if not signature or not webhook_secret:
            return False
        expected = "sha256=" + hmac.new(
            webhook_secret.encode(), payload_bytes, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    # ------------------------------------------------------------------
    # Template sync from Meta
    # ------------------------------------------------------------------

    async def fetch_templates(self, *, inbox) -> list:
        _, waba_id, access_token = self._get_credentials(inbox)
        if not waba_id:
            return []
        url = f"{WA_BASE_URL}/{waba_id}/message_templates"
        headers = {"Authorization": f"Bearer {access_token}"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers, params={"limit": 200})
                data = resp.json()
                return data.get("data", [])
        except Exception:
            logger.exception("Failed to fetch WhatsApp templates")
            return []


# ------------------------------------------------------------------
# _StubAdapter — kept for forward compatibility only
# ------------------------------------------------------------------

class _StubAdapter:
    async def send(self, *, inbox, to, content, idempotency_key, **_):
        raise NotImplementedError(f"{self.__class__.__name__} is not implemented yet")

    async def parse_inbound(self, *, inbox, payload, signature, **_):
        raise NotImplementedError(f"{self.__class__.__name__} is not implemented yet")

    async def fetch_templates(self, *, inbox, **_):
        return []

    def supports_freeform(self, *, last_inbound_at, **_):
        from datetime import timedelta, timezone, datetime as dt
        if last_inbound_at is None:
            return False
        now = dt.now(timezone.utc)
        if last_inbound_at.tzinfo is None:
            last_inbound_at = last_inbound_at.replace(tzinfo=timezone.utc)
        return (now - last_inbound_at) < timedelta(hours=24)


# ------------------------------------------------------------------
# Instagram Adapter (Meta Graph API)
# ------------------------------------------------------------------

class InstagramAdapter:
    channel = ChannelType.INSTAGRAM

    def _get_credentials(self, inbox) -> tuple:
        """Returns (ig_account_id, page_access_token)."""
        try:
            creds = json.loads(inbox.credentials_ref or "{}")
        except Exception:
            creds = {}
        return creds.get("ig_account_id", ""), creds.get("page_access_token", "")

    def supports_freeform(self, *, last_inbound_at: Optional[datetime]) -> bool:
        """24-hour customer service window, same as WhatsApp."""
        if last_inbound_at is None:
            return False
        now = datetime.now(timezone.utc)
        if last_inbound_at.tzinfo is None:
            last_inbound_at = last_inbound_at.replace(tzinfo=timezone.utc)
        return (now - last_inbound_at) < timedelta(hours=FREEFORM_WINDOW_HOURS)

    async def send(
        self,
        *,
        inbox,
        to,
        content: OutboundContent,
        idempotency_key: str,
    ) -> SendResult:
        ig_account_id, page_access_token = self._get_credentials(inbox)
        url = f"https://graph.facebook.com/v19.0/{ig_account_id}/messages"
        headers = {
            "Authorization": f"Bearer {page_access_token}",
            "Content-Type": "application/json",
        }
        recipient = getattr(to, "external_id", str(to))

        # Templates not natively supported on Instagram — fall back to text
        body = {
            "recipient": {"id": recipient},
            "message": {"text": content.text or ""},
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, json=body)
                data = resp.json()
                if resp.status_code == 200 and data.get("message_id"):
                    return SendResult(
                        success=True,
                        channel_message_id=data.get("message_id"),
                        raw_response=data,
                    )
                return SendResult(
                    success=False,
                    error=str(data.get("error", data)),
                    raw_response=data,
                )
        except Exception as exc:
            logger.exception("Instagram send failed")
            return SendResult(success=False, error=str(exc))

    async def parse_inbound(
        self,
        *,
        inbox,
        payload: dict,
        signature: Optional[str],
    ) -> list:
        """Instagram uses the same Meta webhook shape as WhatsApp."""
        events: list = []
        try:
            for entry in payload.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    for msg in value.get("messages", []):
                        sender = msg.get("from", "")
                        msg_id = msg.get("id", "")
                        ts = msg.get("timestamp")
                        timestamp = (
                            datetime.fromtimestamp(int(ts), tz=timezone.utc)
                            if ts
                            else datetime.now(timezone.utc)
                        )

                        content_type = msg.get("type", "text")
                        content_text: Optional[str] = None
                        attachments: list = []

                        if content_type == "text":
                            content_text = msg.get("text", {}).get("body", "")
                        elif content_type in ("image", "audio", "video", "document", "sticker"):
                            media = msg.get(content_type, {})
                            attachments = [{
                                "type": content_type,
                                "id": media.get("id"),
                                "mime_type": media.get("mime_type"),
                            }]

                        events.append(InboundEvent(
                            channel="instagram",
                            external_id=sender,
                            channel_message_id=msg_id,
                            content_type=content_type,
                            content_text=content_text,
                            attachments=attachments,
                            raw=msg,
                            timestamp=timestamp,
                        ))
        except Exception:
            logger.exception("Error parsing Instagram inbound payload")
        return events

    async def fetch_templates(self, *, inbox) -> list:
        return []


# ------------------------------------------------------------------
# Facebook Messenger Adapter
# ------------------------------------------------------------------

class FacebookMessengerAdapter:
    channel = ChannelType.FACEBOOK

    def _get_credentials(self, inbox) -> tuple:
        """Returns (page_id, page_access_token)."""
        try:
            creds = json.loads(inbox.credentials_ref or "{}")
        except Exception:
            creds = {}
        return creds.get("page_id", ""), creds.get("page_access_token", "")

    def supports_freeform(self, *, last_inbound_at: Optional[datetime]) -> bool:
        """24-hour customer service window."""
        if last_inbound_at is None:
            return False
        now = datetime.now(timezone.utc)
        if last_inbound_at.tzinfo is None:
            last_inbound_at = last_inbound_at.replace(tzinfo=timezone.utc)
        return (now - last_inbound_at) < timedelta(hours=FREEFORM_WINDOW_HOURS)

    async def send(
        self,
        *,
        inbox,
        to,
        content: OutboundContent,
        idempotency_key: str,
    ) -> SendResult:
        _, page_access_token = self._get_credentials(inbox)
        url = f"https://graph.facebook.com/v19.0/me/messages"
        recipient = getattr(to, "external_id", str(to))

        body = {
            "recipient": {"id": recipient},
            "message": {"text": content.text or ""},
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    url,
                    params={"access_token": page_access_token},
                    json=body,
                )
                data = resp.json()
                if resp.status_code == 200 and data.get("message_id"):
                    return SendResult(
                        success=True,
                        channel_message_id=data.get("message_id"),
                        raw_response=data,
                    )
                return SendResult(
                    success=False,
                    error=str(data.get("error", data)),
                    raw_response=data,
                )
        except Exception as exc:
            logger.exception("Facebook Messenger send failed")
            return SendResult(success=False, error=str(exc))

    async def parse_inbound(
        self,
        *,
        inbox,
        payload: dict,
        signature: Optional[str],
    ) -> list:
        """Facebook webhook shape: entry[].messaging[].{sender.id, message.*}."""
        events: list = []
        try:
            for entry in payload.get("entry", []):
                for messaging in entry.get("messaging", []):
                    sender_id = messaging.get("sender", {}).get("id", "")
                    message = messaging.get("message", {})
                    if not message:
                        continue

                    msg_id = message.get("mid", "")
                    ts = messaging.get("timestamp")
                    timestamp = (
                        datetime.fromtimestamp(int(ts) / 1000, tz=timezone.utc)
                        if ts
                        else datetime.now(timezone.utc)
                    )

                    content_text: Optional[str] = message.get("text")
                    attachments: list = []
                    content_type = "text"

                    if message.get("attachments"):
                        content_type = "attachment"
                        attachments = [
                            {"type": a.get("type"), "url": a.get("payload", {}).get("url")}
                            for a in message.get("attachments", [])
                        ]

                    events.append(InboundEvent(
                        channel="facebook",
                        external_id=sender_id,
                        channel_message_id=msg_id,
                        content_type=content_type,
                        content_text=content_text,
                        attachments=attachments,
                        raw=messaging,
                        timestamp=timestamp,
                    ))
        except Exception:
            logger.exception("Error parsing Facebook inbound payload")
        return events

    async def fetch_templates(self, *, inbox) -> list:
        return []


# ------------------------------------------------------------------
# Telegram Adapter (Telegram Bot API)
# ------------------------------------------------------------------

class TelegramAdapter:
    channel = ChannelType.TELEGRAM

    def _get_credentials(self, inbox) -> str:
        """Returns bot_token."""
        try:
            creds = json.loads(inbox.credentials_ref or "{}")
        except Exception:
            creds = {}
        return creds.get("bot_token", "")

    def supports_freeform(self, *, last_inbound_at: Optional[datetime]) -> bool:
        """Telegram has no service window restriction."""
        return True

    async def send(
        self,
        *,
        inbox,
        to,
        content: OutboundContent,
        idempotency_key: str,
    ) -> SendResult:
        bot_token = self._get_credentials(inbox)
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        recipient = getattr(to, "external_id", str(to))

        # Templates not supported — fall back to plain text
        body = {
            "chat_id": recipient,
            "text": content.text or "",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=body)
                data = resp.json()
                if data.get("ok") and data.get("result"):
                    return SendResult(
                        success=True,
                        channel_message_id=str(data["result"].get("message_id", "")),
                        raw_response=data,
                    )
                return SendResult(
                    success=False,
                    error=str(data.get("description", data)),
                    raw_response=data,
                )
        except Exception as exc:
            logger.exception("Telegram send failed")
            return SendResult(success=False, error=str(exc))

    async def parse_inbound(
        self,
        *,
        inbox,
        payload: dict,
        signature: Optional[str],
    ) -> list:
        """Telegram webhook: { update_id, message: { message_id, from, chat, text, date } }."""
        events: list = []
        try:
            message = payload.get("message")
            if not message:
                return events

            sender = message.get("from", {})
            external_id = str(sender.get("id", ""))
            msg_id = str(message.get("message_id", ""))
            ts = message.get("date")
            timestamp = (
                datetime.fromtimestamp(int(ts), tz=timezone.utc)
                if ts
                else datetime.now(timezone.utc)
            )
            content_text: Optional[str] = message.get("text")

            events.append(InboundEvent(
                channel="telegram",
                external_id=external_id,
                channel_message_id=msg_id,
                content_type="text",
                content_text=content_text,
                attachments=[],
                raw=message,
                timestamp=timestamp,
            ))
        except Exception:
            logger.exception("Error parsing Telegram inbound payload")
        return events

    async def fetch_templates(self, *, inbox) -> list:
        return []


# ------------------------------------------------------------------
# Email Adapter (SendGrid)
# ------------------------------------------------------------------

class EmailAdapter:
    channel = ChannelType.EMAIL

    def _get_credentials(self, inbox) -> tuple:
        """Returns (sendgrid_api_key, from_email, from_name)."""
        try:
            creds = json.loads(inbox.credentials_ref or "{}")
        except Exception:
            creds = {}
        return (
            creds.get("sendgrid_api_key", ""),
            creds.get("from_email", ""),
            creds.get("from_name", ""),
        )

    def supports_freeform(self, *, last_inbound_at: Optional[datetime]) -> bool:
        """Email has no window restriction."""
        return True

    async def send(
        self,
        *,
        inbox,
        to,
        content: OutboundContent,
        idempotency_key: str,
    ) -> SendResult:
        sendgrid_api_key, from_email, from_name = self._get_credentials(inbox)
        url = "https://api.sendgrid.com/v3/mail/send"
        recipient = getattr(to, "external_id", str(to))

        body = {
            "personalizations": [{"to": [{"email": recipient}]}],
            "from": {"email": from_email, "name": from_name},
            "subject": f"Message from {from_name}",
            "content": [{"type": "text/plain", "value": content.text or ""}],
        }

        headers = {
            "Authorization": f"Bearer {sendgrid_api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, headers=headers, json=body)
                if resp.status_code in (200, 202):
                    return SendResult(
                        success=True,
                        channel_message_id=resp.headers.get("X-Message-Id"),
                        raw_response={"status_code": resp.status_code},
                    )
                return SendResult(
                    success=False,
                    error=f"SendGrid returned {resp.status_code}: {resp.text}",
                    raw_response={"status_code": resp.status_code},
                )
        except Exception as exc:
            logger.exception("Email (SendGrid) send failed")
            return SendResult(success=False, error=str(exc))

    async def parse_inbound(
        self,
        *,
        inbox,
        payload: dict,
        signature: Optional[str],
    ) -> list:
        # SendGrid inbound parse webhook uses multipart — deferred
        return []

    async def fetch_templates(self, *, inbox) -> list:
        return []


# ------------------------------------------------------------------
# SMS Adapter (Twilio)
# ------------------------------------------------------------------

class SMSAdapter:
    channel = ChannelType.SMS

    def _get_credentials(self, inbox) -> tuple:
        """Returns (account_sid, auth_token, from_number)."""
        try:
            creds = json.loads(inbox.credentials_ref or "{}")
        except Exception:
            creds = {}
        return (
            creds.get("account_sid", ""),
            creds.get("auth_token", ""),
            creds.get("from_number", ""),
        )

    def supports_freeform(self, *, last_inbound_at: Optional[datetime]) -> bool:
        """SMS has no window restriction."""
        return True

    async def send(
        self,
        *,
        inbox,
        to,
        content: OutboundContent,
        idempotency_key: str,
    ) -> SendResult:
        account_sid, auth_token, from_number = self._get_credentials(inbox)
        url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
        recipient = getattr(to, "external_id", str(to))

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    url,
                    auth=(account_sid, auth_token),
                    data={
                        "To": recipient,
                        "From": from_number,
                        "Body": content.text or "",
                    },
                )
                data = resp.json()
                if resp.status_code in (200, 201) and data.get("sid"):
                    return SendResult(
                        success=True,
                        channel_message_id=data.get("sid"),
                        raw_response=data,
                    )
                return SendResult(
                    success=False,
                    error=str(data.get("message", data)),
                    raw_response=data,
                )
        except Exception as exc:
            logger.exception("SMS (Twilio) send failed")
            return SendResult(success=False, error=str(exc))

    async def parse_inbound(
        self,
        *,
        inbox,
        payload: dict,
        signature: Optional[str],
    ) -> list:
        # Twilio inbound form-encoded parsing deferred
        return []

    async def fetch_templates(self, *, inbox) -> list:
        return []
