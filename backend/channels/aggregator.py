"""
Aggregator adapter interface and platform stubs.

Each aggregator (Zomato, Swiggy, JustDial, Practo …) implements
AggregatorAdapter. The sync pipeline is adapter-agnostic.

Real API credentials are stored in AggregatorConnection.meta (JSONB).
Until a platform grants API access, the manual import path is used.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Protocol, runtime_checkable


class AggregatorPlatform(str, Enum):
    ZOMATO = "zomato"
    SWIGGY = "swiggy"
    JUSTDIAL = "justdial"
    PRACTO = "practo"
    URBAN_COMPANY = "urban_company"
    TRIPADVISOR = "tripadvisor"


PLATFORM_META: dict[str, dict] = {
    AggregatorPlatform.ZOMATO: {
        "display_name": "Zomato",
        "color": "#E23744",
        "icon": "zomato",
        "verticals": ["restaurant"],
        "api_status": "partner_gated",   # open | partner_gated | unavailable
        "supports_orders": True,
        "supports_reviews": True,
        "supports_menu_sync": True,
    },
    AggregatorPlatform.SWIGGY: {
        "display_name": "Swiggy",
        "color": "#FC8019",
        "icon": "swiggy",
        "verticals": ["restaurant"],
        "api_status": "partner_gated",
        "supports_orders": True,
        "supports_reviews": False,
        "supports_menu_sync": True,
    },
    AggregatorPlatform.JUSTDIAL: {
        "display_name": "JustDial",
        "color": "#2F80ED",
        "icon": "justdial",
        "verticals": ["restaurant", "salon", "clinic", "gym"],
        "api_status": "partner_gated",
        "supports_orders": False,
        "supports_reviews": True,
        "supports_menu_sync": False,
    },
    AggregatorPlatform.PRACTO: {
        "display_name": "Practo",
        "color": "#5DB075",
        "icon": "practo",
        "verticals": ["clinic"],
        "api_status": "partner_gated",
        "supports_orders": True,
        "supports_reviews": True,
        "supports_menu_sync": False,
    },
    AggregatorPlatform.URBAN_COMPANY: {
        "display_name": "Urban Company",
        "color": "#7C3AED",
        "icon": "urban_company",
        "verticals": ["salon", "spa", "cleaning", "gym"],
        "api_status": "unavailable",
        "supports_orders": True,
        "supports_reviews": True,
        "supports_menu_sync": False,
    },
    AggregatorPlatform.TRIPADVISOR: {
        "display_name": "TripAdvisor",
        "color": "#00AA6C",
        "icon": "tripadvisor",
        "verticals": ["restaurant", "hotel"],
        "api_status": "open",
        "supports_orders": False,
        "supports_reviews": True,
        "supports_menu_sync": False,
    },
}


@dataclass
class AggregatorOrderItem:
    name: str
    quantity: int = 1
    price: float | None = None
    external_id: str | None = None


@dataclass
class NormalizedOrder:
    """Platform-agnostic order pulled from any aggregator."""
    platform: str
    external_order_id: str
    external_customer_id: str | None = None
    customer_name: str | None = None
    customer_phone: str | None = None   # may be masked/proxy
    customer_email: str | None = None
    amount: float | None = None
    items: list[AggregatorOrderItem] = field(default_factory=list)
    status: str = "delivered"           # placed | confirmed | delivered | cancelled
    ordered_at: datetime | None = None
    raw: dict = field(default_factory=dict)


@dataclass
class SyncResult:
    success: bool
    orders_fetched: int = 0
    reviews_fetched: int = 0
    error: str | None = None


@runtime_checkable
class AggregatorAdapter(Protocol):
    """
    Every aggregator integration must implement this interface.
    Until API access is granted, adapters raise NotImplementedError
    from fetch_orders/fetch_reviews and the system falls back to
    the manual import path.
    """
    platform: AggregatorPlatform

    async def fetch_orders(
        self,
        *,
        connection_meta: dict,
        since: datetime | None = None,
        limit: int = 100,
    ) -> list[NormalizedOrder]: ...

    async def fetch_reviews(
        self,
        *,
        connection_meta: dict,
        since: datetime | None = None,
        limit: int = 100,
    ) -> list[dict]: ...

    async def validate_credentials(self, *, connection_meta: dict) -> bool: ...


# ---------------------------------------------------------------------------
# Platform stub implementations
# ---------------------------------------------------------------------------

class ZomatoAdapter:
    platform = AggregatorPlatform.ZOMATO

    async def fetch_orders(self, *, connection_meta, since=None, limit=100):
        raise NotImplementedError("Zomato Partner API access not yet granted — use manual import")

    async def fetch_reviews(self, *, connection_meta, since=None, limit=100):
        raise NotImplementedError("Zomato Partner API access not yet granted — use manual import")

    async def validate_credentials(self, *, connection_meta):
        return False


class SwiggyAdapter:
    platform = AggregatorPlatform.SWIGGY

    async def fetch_orders(self, *, connection_meta, since=None, limit=100):
        raise NotImplementedError("Swiggy Partner API access not yet granted — use manual import")

    async def fetch_reviews(self, *, connection_meta, since=None, limit=100):
        raise NotImplementedError("Swiggy does not expose a public reviews API")

    async def validate_credentials(self, *, connection_meta):
        return False


class JustDialAdapter:
    platform = AggregatorPlatform.JUSTDIAL

    async def fetch_orders(self, *, connection_meta, since=None, limit=100):
        raise NotImplementedError("JustDial does not support order sync")

    async def fetch_reviews(self, *, connection_meta, since=None, limit=100):
        raise NotImplementedError("JustDial Partner API access not yet granted — use manual import")

    async def validate_credentials(self, *, connection_meta):
        return False


class PractoAdapter:
    platform = AggregatorPlatform.PRACTO

    async def fetch_orders(self, *, connection_meta, since=None, limit=100):
        raise NotImplementedError("Practo Partner API access not yet granted — use manual import")

    async def fetch_reviews(self, *, connection_meta, since=None, limit=100):
        raise NotImplementedError("Practo Partner API access not yet granted — use manual import")

    async def validate_credentials(self, *, connection_meta):
        return False


class UrbanCompanyAdapter:
    platform = AggregatorPlatform.URBAN_COMPANY

    async def fetch_orders(self, *, connection_meta, since=None, limit=100):
        raise NotImplementedError("Urban Company API not available — use manual import")

    async def fetch_reviews(self, *, connection_meta, since=None, limit=100):
        raise NotImplementedError("Urban Company API not available — use manual import")

    async def validate_credentials(self, *, connection_meta):
        return False


class TripAdvisorAdapter:
    platform = AggregatorPlatform.TRIPADVISOR

    async def fetch_orders(self, *, connection_meta, since=None, limit=100):
        raise NotImplementedError("TripAdvisor does not support order sync")

    async def fetch_reviews(self, *, connection_meta, since=None, limit=100):
        raise NotImplementedError("TripAdvisor review API — implement with Content API v3")

    async def validate_credentials(self, *, connection_meta):
        return False


# Registry — key is the platform string value
AGGREGATOR_ADAPTERS: dict[str, AggregatorAdapter] = {
    AggregatorPlatform.ZOMATO: ZomatoAdapter(),
    AggregatorPlatform.SWIGGY: SwiggyAdapter(),
    AggregatorPlatform.JUSTDIAL: JustDialAdapter(),
    AggregatorPlatform.PRACTO: PractoAdapter(),
    AggregatorPlatform.URBAN_COMPANY: UrbanCompanyAdapter(),
    AggregatorPlatform.TRIPADVISOR: TripAdvisorAdapter(),
}
