"""
Channel adapter interface.

Every channel (WhatsApp, Instagram, Telegram, Email, SMS …) implements
ChannelAdapter.  Adding a new channel is purely adapter work — the send
pipeline, inbox API, and webhook ingestion are channel-agnostic.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Protocol, runtime_checkable


class ChannelType(str, Enum):
    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    TELEGRAM = "telegram"
    EMAIL = "email"
    SMS = "sms"


@dataclass
class OutboundContent:
    """Normalised outbound payload, channel-agnostic."""
    content_type: str = "text"          # text | template | image | document | audio | video
    text: str | None = None
    # WhatsApp / template fields
    template_name: str | None = None
    template_language: str | None = None
    template_components: list | None = None
    # Media fields
    media_url: str | None = None
    media_mime_type: str | None = None


@dataclass
class SendResult:
    success: bool
    channel_message_id: str | None = None
    error: str | None = None
    raw_response: dict | None = None


@dataclass
class InboundEvent:
    """Normalised inbound message from any channel."""
    channel: str
    external_id: str                        # sender's channel-specific handle
    channel_message_id: str
    direction: str = "in"
    content_type: str = "text"
    content_text: str | None = None
    attachments: list = field(default_factory=list)
    raw: dict = field(default_factory=dict)
    timestamp: datetime | None = None


@runtime_checkable
class ChannelAdapter(Protocol):
    """
    Every channel must implement this interface.
    The protocol is checked at runtime so adapters don't need to
    inherit from a base class.
    """
    channel: ChannelType

    async def send(
        self,
        *,
        inbox,
        to: "InboundEvent | object",
        content: OutboundContent,
        idempotency_key: str,
    ) -> SendResult: ...

    async def parse_inbound(
        self,
        *,
        inbox,
        payload: dict,
        signature: str | None,
    ) -> list[InboundEvent]: ...

    async def fetch_templates(self, *, inbox) -> list[dict]: ...

    def supports_freeform(self, *, last_inbound_at: datetime | None) -> bool: ...
