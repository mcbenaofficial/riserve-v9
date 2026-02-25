"""
Vorta Swarm — Multi-Agent Architecture using LangGraph Swarm.

Four specialized agents that dynamically hand off to each other:
  - Triage Agent:    Routes user requests to the right specialist
  - Bookings Agent:  Handles booking queries and creation
  - Revenue Agent:   Financial analytics and revenue reporting
  - Inventory Agent: Stock levels and inventory management
"""

import os
import logging
import functools
from typing import List, Any, Dict, Optional
from datetime import datetime

from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langgraph_swarm import create_handoff_tool, create_swarm

from agent_tools import (
    get_recent_bookings,
    create_booking_tool,
    get_revenue_stats,
    check_inventory_tool,
    trigger_inventory_reorder,
)

logger = logging.getLogger(__name__)

# ─── LLM Factory ────────────────────────────────────────────────

def _get_llm():
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        return None
    return ChatOpenAI(
        model="openai/gpt-4o",
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.7,
    )


# ─── User Context Binding ───────────────────────────────────────

def _bind_user_context(tools: list, user_context: Dict[str, Any]) -> list:
    """Wrap every tool so that `user_context` is injected automatically."""
    bound = []
    for t in tools:
        p_coroutine = None
        if hasattr(t, "coroutine") and t.coroutine:
            def make_coro(coro, ctx):
                @functools.wraps(coro)
                async def wrapper(*a, **kw):
                    if "user_context" not in kw:
                        kw["user_context"] = ctx
                    return await coro(*a, **kw)
                return wrapper
            p_coroutine = make_coro(t.coroutine, user_context)

        p_func = None
        if hasattr(t, "func") and t.func:
            def make_func(func, ctx):
                @functools.wraps(func)
                def wrapper(*a, **kw):
                    if "user_context" not in kw:
                        kw["user_context"] = ctx
                    return func(*a, **kw)
                return wrapper
            p_func = make_func(t.func, user_context)

        if hasattr(t, "model_copy"):
            bound.append(t.model_copy(update={"func": p_func, "coroutine": p_coroutine}))
        elif hasattr(t, "copy"):
            bound.append(t.copy(update={"func": p_func, "coroutine": p_coroutine}))
        else:
            bound.append(t)
    return bound


# ─── Swarm Factory ──────────────────────────────────────────────

def get_swarm_app(user_context: Dict[str, Any]):
    """
    Build and return a compiled LangGraph Swarm with 4 specialized agents.
    Returns None if the LLM cannot be initialized.
    """
    llm = _get_llm()
    if not llm:
        logger.warning("OPENROUTER_API_KEY not found. Swarm will fail.")
        return None

    current_time = datetime.now().isoformat()

    # ── Bind user context to domain tools ──
    booking_tools = _bind_user_context(
        [get_recent_bookings, create_booking_tool], user_context
    )
    revenue_tools = _bind_user_context(
        [get_revenue_stats], user_context
    )
    inventory_tools = _bind_user_context(
        [check_inventory_tool, trigger_inventory_reorder], user_context
    )

    # ── Handoff Tools ──
    handoff_to_bookings = create_handoff_tool(
        agent_name="BookingsAgent",
        description="Transfer to the Bookings Agent for booking queries, listing bookings, or creating new bookings.",
    )
    handoff_to_revenue = create_handoff_tool(
        agent_name="RevenueAgent",
        description="Transfer to the Revenue Agent for revenue statistics, financial analytics, or income reports.",
    )
    handoff_to_inventory = create_handoff_tool(
        agent_name="InventoryAgent",
        description="Transfer to the Inventory Agent for stock levels, product inventory, or low-stock alerts.",
    )
    handoff_to_triage = create_handoff_tool(
        agent_name="TriageAgent",
        description="Transfer back to the Triage Agent for general questions or when the task is outside your specialty.",
    )

    # ── Agent Definitions ──

    base_context = f"""
    You are part of Vorta, the AI assistant for the Ri'Serve business management platform.
    Current Time: {current_time}
    
    Security & RBAC:
    - You are acting on behalf of a specific user.
    - Use the provided tools which enforce RBAC.
    - If a tool returns a permission error, politely inform the user.
    
    Tone: Professional, helpful, and data-driven. Use "We" when referring to the platform.
    """

    triage_agent = create_react_agent(
        llm,
        tools=[handoff_to_bookings, handoff_to_revenue, handoff_to_inventory],
        prompt=f"""{base_context}
        You are the Triage Agent. Your job is to understand the user's request and 
        route it to the right specialist agent:
        
        - For booking-related questions (list, create, manage bookings) → transfer to BookingsAgent
        - For revenue, financial stats, or income questions → transfer to RevenueAgent
        - For inventory, stock levels, or product queries → transfer to InventoryAgent
        
        For general questions or greetings, respond directly without transferring.
        Always transfer to the most appropriate agent rather than trying to answer domain-specific questions yourself.
        """,
        name="TriageAgent",
    )

    bookings_agent = create_react_agent(
        llm,
        tools=booking_tools + [handoff_to_revenue, handoff_to_inventory, handoff_to_triage],
        prompt=f"""{base_context}
        You are the Bookings Agent, specialized in booking management.
        
        Your capabilities:
        - List recent bookings using get_recent_bookings
        - Create new bookings using create_booking_tool
        - Answer questions about booking status, dates, and customers
        
        If the user asks about revenue or financial data, transfer to RevenueAgent.
        If the user asks about inventory or stock, transfer to InventoryAgent.
        If the question is outside your domain, transfer to TriageAgent.
        """,
        name="BookingsAgent",
    )

    revenue_agent = create_react_agent(
        llm,
        tools=revenue_tools + [handoff_to_bookings, handoff_to_inventory, handoff_to_triage],
        prompt=f"""{base_context}
        You are the Revenue Agent, specialized in financial analytics.
        
        Your capabilities:
        - Get revenue statistics for different periods (today, week, month, all) using get_revenue_stats
        - Provide financial insights and trends
        
        If the user asks about bookings, transfer to BookingsAgent.
        If the user asks about inventory or stock, transfer to InventoryAgent.
        If the question is outside your domain, transfer to TriageAgent.
        """,
        name="RevenueAgent",
    )

    inventory_agent = create_react_agent(
        llm,
        tools=inventory_tools + [handoff_to_bookings, handoff_to_revenue, handoff_to_triage],
        prompt=f"""{base_context}
        You are the Inventory Agent, specialized in stock and product management.
        
        Your capabilities:
        - Check inventory levels using check_inventory_tool
        - Identify low-stock items
        - Generate a reorder report to replenish stock using trigger_inventory_reorder
        
        If the user asks about bookings, transfer to BookingsAgent.
        If the user asks about revenue, transfer to RevenueAgent.
        If the question is outside your domain, transfer to TriageAgent.
        """,
        name="InventoryAgent",
    )

    # ── Build Swarm ──
    workflow = create_swarm(
        [triage_agent, bookings_agent, revenue_agent, inventory_agent],
        default_active_agent="TriageAgent",
    )

    # Compile without checkpointer (we manage conversation history externally via MongoDB)
    app = workflow.compile()

    return app
