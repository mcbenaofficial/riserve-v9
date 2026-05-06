from __future__ import annotations

import logging
from typing import Any

from tools.base import ToolResult
from tools.context import AgentExecutionContext
from agents.runner import AgentRunner

logger = logging.getLogger(__name__)


class ShadowRunner(AgentRunner):
    """
    Runs the Concierge agent in shadow mode: all LLM reasoning and tool
    lookups proceed normally, but no side-effecting actions are executed:
      - inbox.send_reply    → captured, not sent
      - inbox.add_internal_note → captured, not written
      - inbox.assign_to_human   → captured, not executed
    Read-only tools (kb.search, customer.get_profile, etc.) run normally.

    The final draft and the list of tools *that would have fired* are stored
    on the AgentRun row (trigger_type="shadow") for diff_report analysis.
    """

    # Tools that write to the conversation — suppressed in shadow mode
    _WRITE_TOOLS = frozenset({
        "inbox.send_reply",
        "inbox.add_internal_note",
        "inbox.assign_to_human",
    })

    def __init__(self, *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)
        self.shadow_draft: str = ""
        self.suppressed_calls: list[dict] = []

    async def _dispatch(
        self,
        ctx: AgentExecutionContext,
        conversation_id: str,
        name: str,
        args: dict,
    ) -> ToolResult:
        if name in self._WRITE_TOOLS:
            # Log what would have fired without executing
            entry = {"tool": name, "args": args}
            self.suppressed_calls.append(entry)
            logger.debug("Shadow suppressed %s for conv %s", name, conversation_id)
            return ToolResult(success=True, data={"shadow_suppressed": True})

        return await super()._dispatch(ctx, conversation_id, name, args)

    async def _post_draft_note(
        self,
        ctx: AgentExecutionContext,
        conversation_id: str,
        text: str,
    ) -> None:
        # Capture draft without writing an internal note
        self.shadow_draft = text
        logger.debug(
            "Shadow captured draft for conv %s (%d chars)", conversation_id, len(text)
        )
