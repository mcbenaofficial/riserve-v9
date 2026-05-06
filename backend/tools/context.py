from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class AgentExecutionContext:
    tenant_id: str
    agent_name: str
    agent_run_id: str
    conversation_id: Optional[str]
    idempotency_key: str  # sha256 of (agent_run_id + tool_name + step_index)
    user_id: Optional[str] = None  # human user if acting on behalf of one
