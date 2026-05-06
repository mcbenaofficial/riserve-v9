from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession

from channels.base import OutboundContent
from database_pg import engine
import models_pg
from models_pg import generate_uuid
from services.send_pipeline import enqueue_message
from tools.base import BaseTool, ToolResult
from tools.context import AgentExecutionContext

logger = logging.getLogger(__name__)

try:
    from routes.conversations import manager as _ws_manager
except ImportError:
    _ws_manager = None


class InboxListRecentMessages(BaseTool):
    name = "inbox.list_recent_messages"
    description = "Fetch the most recent messages in a conversation thread."
    scopes = ["inbox:read"]

    async def execute(
        self,
        ctx: AgentExecutionContext,
        *,
        conversation_id: str,
        limit: int = 10,
    ) -> ToolResult:
        async with AsyncSession(engine) as db:
            result = await db.execute(
                select(models_pg.MktMessage)
                .where(models_pg.MktMessage.conversation_id == conversation_id)
                .order_by(models_pg.MktMessage.created_at.desc())
                .limit(limit)
            )
            messages = result.scalars().all()

        rows = [
            {
                "id": m.id,
                "direction": m.direction,
                "body": m.content_text,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ]
        return ToolResult(success=True, data={"messages": rows})


class InboxSendReply(BaseTool):
    name = "inbox.send_reply"
    description = (
        "Send an outbound reply to the customer in the given conversation. "
        "The pipeline enforces consent, frequency cap, and channel service window gates."
    )
    scopes = ["inbox:write"]
    requires_human_approval = False  # runner checks autonomy level before calling

    async def execute(
        self,
        ctx: AgentExecutionContext,
        *,
        conversation_id: str,
        body: str,
    ) -> ToolResult:
        async with AsyncSession(engine) as db:
            convo_result = await db.execute(
                select(models_pg.MktConversation).where(
                    models_pg.MktConversation.id == conversation_id
                )
            )
            convo = convo_result.scalar_one_or_none()
            if not convo:
                return ToolResult(success=False, data=None, error="conversation_not_found")

            inbox_result = await db.execute(
                select(models_pg.MktInbox).where(
                    models_pg.MktInbox.id == convo.inbox_id
                )
            )
            inbox = inbox_result.scalar_one_or_none()
            if not inbox:
                return ToolResult(success=False, data=None, error="inbox_not_found")

            # Detect inbound locale from the customer's last message for language guardrail
            last_inbound_result = await db.execute(
                select(models_pg.MktMessage)
                .where(
                    models_pg.MktMessage.conversation_id == conversation_id,
                    models_pg.MktMessage.direction == "inbound",
                )
                .order_by(models_pg.MktMessage.created_at.desc())
                .limit(1)
            )
            last_msg = last_inbound_result.scalar_one_or_none()
            inbound_locale = None
            if last_msg and last_msg.content_text:
                try:
                    from langdetect import detect
                    inbound_locale = detect(last_msg.content_text)
                except Exception:
                    pass

            from policy.engine import check as policy_check
            from policy.violations import record_violation
            policy_result = await policy_check(
                tenant_id=convo.company_id,
                message_text=body,
                channel=inbox.channel,
                inbound_locale=inbound_locale,
                agent_run_id=ctx.agent_run_id,
            )

            if policy_result.blocked:
                # Hard violations are already persisted inside policy_check;
                # returning early without calling enqueue_message is intentional.
                return ToolResult(
                    success=False,
                    data={"policy_violations": [v.kind for v in policy_result.violations]},
                    error=f"policy_blocked:{policy_result.violations[0].kind}",
                )

            outcome = await enqueue_message(
                db,
                conversation_id=conversation_id,
                company_id=convo.company_id,
                customer_id=convo.customer_id,
                channel=inbox.channel,
                inbox_id=inbox.id,
                content=OutboundContent(content_type="text", text=body),
                sender_id=ctx.agent_run_id,
                is_marketing=False,
            )

        return ToolResult(
            success=outcome["success"],
            data={
                "suppressed": outcome.get("suppressed", False),
                "reason": outcome.get("reason"),
            },
        )


class InboxAddInternalNote(BaseTool):
    name = "inbox.add_internal_note"
    description = "Add an agent-only internal note to a conversation (not sent to the customer)."
    scopes = ["inbox:write"]

    async def execute(
        self,
        ctx: AgentExecutionContext,
        *,
        conversation_id: str,
        body: str,
    ) -> ToolResult:
        async with AsyncSession(engine) as db:
            convo_result = await db.execute(
                select(models_pg.MktConversation).where(
                    models_pg.MktConversation.id == conversation_id
                )
            )
            convo = convo_result.scalar_one_or_none()
            if not convo:
                return ToolResult(success=False, data=None, error="conversation_not_found")

            note = models_pg.MktMessage(
                id=generate_uuid(),
                company_id=convo.company_id,
                conversation_id=conversation_id,
                direction="note",
                sender_type="agent",
                sender_id=ctx.agent_run_id,
                content_type="text",
                content_text=body,
                delivery_status="sent",
                created_at=datetime.now(timezone.utc),
            )
            db.add(note)
            await db.commit()
            await db.refresh(note)

        return ToolResult(success=True, data={"note_id": note.id})


class InboxAssignToHuman(BaseTool):
    name = "inbox.assign_to_human"
    description = (
        "Escalate this conversation to a human agent. "
        "Sets AI handling state to 'escalated' and broadcasts a WebSocket event."
    )
    scopes = ["inbox:write"]

    async def execute(
        self,
        ctx: AgentExecutionContext,
        *,
        conversation_id: str,
        reason: str,
    ) -> ToolResult:
        company_id: Optional[str] = None

        async with AsyncSession(engine) as db:
            # Resolve company_id for WS broadcast
            convo_result = await db.execute(
                select(models_pg.MktConversation).where(
                    models_pg.MktConversation.id == conversation_id
                )
            )
            convo = convo_result.scalar_one_or_none()
            if not convo:
                return ToolResult(success=False, data=None, error="conversation_not_found")

            company_id = convo.company_id

            # Update ai_handling_state — column may not exist until Phase B migration
            try:
                await db.execute(
                    text(
                        "UPDATE mkt_conversations SET ai_handling_state = :state WHERE id = :id"
                    ),
                    {"state": "escalated", "id": conversation_id},
                )
            except ProgrammingError:
                logger.warning(
                    "ai_handling_state column missing on mkt_conversations; "
                    "skipping state update for conversation %s",
                    conversation_id,
                )
                await db.rollback()
                async with AsyncSession(engine) as db2:
                    await _insert_escalation_note(db2, convo, conversation_id, reason, ctx)
                    await db2.commit()
            else:
                await _insert_escalation_note(db, convo, conversation_id, reason, ctx)
                await db.commit()

        if _ws_manager is not None:
            try:
                await _ws_manager.broadcast(
                    company_id,
                    {
                        "type": "ai_escalated",
                        "conversation_id": conversation_id,
                        "reason": reason,
                    },
                )
            except Exception as exc:
                logger.warning("WS broadcast failed for ai_escalated: %s", exc)

        return ToolResult(success=True, data={"escalated": True, "reason": reason})


async def _insert_escalation_note(
    db: AsyncSession,
    convo: models_pg.MktConversation,
    conversation_id: str,
    reason: str,
    ctx: AgentExecutionContext,
) -> None:
    note = models_pg.MktMessage(
        id=generate_uuid(),
        company_id=convo.company_id,
        conversation_id=conversation_id,
        direction="note",
        sender_type="agent",
        sender_id=ctx.agent_run_id,
        content_type="text",
        content_text=f"AI escalated: {reason}",
        delivery_status="sent",
        created_at=datetime.now(timezone.utc),
    )
    db.add(note)
