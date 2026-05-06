from __future__ import annotations
from enum import Enum


class KnowledgeSourceType(str, Enum):
    MENU = "menu"
    HOURS = "hours"
    LOCATIONS = "locations"
    POLICIES = "policies"
    FAQS = "faqs"
    BRAND_VOICE = "brand_voice"
    PAST_TICKETS = "past_tickets"
