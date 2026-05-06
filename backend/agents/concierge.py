from __future__ import annotations

from agents.runner import AgentRunner
from tools.inbox_tools import (
    InboxListRecentMessages,
    InboxSendReply,
    InboxAddInternalNote,
    InboxAssignToHuman,
)
from tools.customer_tools import CustomerGetProfile
from tools.kb_tools import KBSearch

# JSON schemas for each tool exposed to the Concierge
_TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "inbox.list_recent_messages",
            "description": "Fetch the most recent messages in a conversation thread.",
            "parameters": {
                "type": "object",
                "properties": {
                    "conversation_id": {"type": "string"},
                    "limit": {"type": "integer", "default": 10},
                },
                "required": ["conversation_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "inbox.send_reply",
            "description": (
                "Send an outbound reply to the customer. "
                "At autonomy L1 this will be posted as a draft note instead of sent."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "conversation_id": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["conversation_id", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "inbox.add_internal_note",
            "description": "Add an agent-only internal note (not visible to the customer).",
            "parameters": {
                "type": "object",
                "properties": {
                    "conversation_id": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["conversation_id", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "inbox.assign_to_human",
            "description": "Escalate this conversation to a human agent.",
            "parameters": {
                "type": "object",
                "properties": {
                    "conversation_id": {"type": "string"},
                    "reason": {"type": "string"},
                },
                "required": ["conversation_id", "reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "customer.get_profile",
            "description": "Fetch the customer's profile including booking history summary.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_id": {"type": "string"},
                },
                "required": ["customer_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "kb.search",
            "description": "Semantic search over the venue's knowledge base (menu, hours, FAQs, policies).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "source_types": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Filter by source type: MENU, HOURS, LOCATIONS, POLICIES, FAQS, BRAND_VOICE",
                    },
                    "top_k": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
]

_TOOL_INSTANCES = [
    InboxListRecentMessages(),
    InboxSendReply(),
    InboxAddInternalNote(),
    InboxAssignToHuman(),
    CustomerGetProfile(),
    KBSearch(),
]


def build_runner(autonomy_level: int = 1, agent_id: str | None = None) -> AgentRunner:
    """Return an AgentRunner configured for the Concierge agent."""
    return AgentRunner(
        tools=_TOOL_INSTANCES,
        tool_schemas=_TOOL_SCHEMAS,
        autonomy_level=autonomy_level,
        agent_id=agent_id,
    )
