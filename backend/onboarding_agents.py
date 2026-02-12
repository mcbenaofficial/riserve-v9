"""
Onboarding Swarm — Multi-Agent Architecture for conversational onboarding.

Five specialized agents that guide new users through setup:
  - OnboardingTriageAgent:  Entry point, greets user, detects industry, routes
  - CompanySetupAgent:      Collects company profile (timezone, hours, address)
  - OutletConfigAgent:      Creates outlet with industry-aware resources
  - ServiceSetupAgent:      Creates services (suggests based on industry)
  - DataImportAgent:        Conversational data import (v1: describes → creates)
"""

import os
import logging
import functools
from typing import List, Any, Dict, Optional
from datetime import datetime

from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langgraph_swarm import create_handoff_tool, create_swarm

from onboarding_tools import (
    get_industry_suggestions,
    update_company_profile,
    create_outlet,
    create_services_batch,
    get_onboarding_progress,
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


# ─── User Context Binding (same pattern as swarm_agents.py) ────

def _bind_user_context(tools: list, user_context: Dict[str, Any]) -> list:
    """Wrap every tool so that user_context is injected automatically."""
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

def get_onboarding_swarm(user_context: Dict[str, Any], company_name: str = "", business_type: str = "", user_name: str = "", current_progress: Dict[str, Any] = None):
    """
    Build and return a compiled LangGraph Swarm for the onboarding flow.
    Returns None if the LLM cannot be initialized.
    """
    llm = _get_llm()
    if not llm:
        logger.warning("OPENROUTER_API_KEY not found. Onboarding Swarm unavailable.")
        return None

    current_time = datetime.now().isoformat()
    if current_progress is None:
        current_progress = {}

    # Bind user context to all tools
    company_tools = _bind_user_context([update_company_profile, get_onboarding_progress], user_context)
    outlet_tools = _bind_user_context([create_outlet, get_onboarding_progress], user_context)
    service_tools = _bind_user_context([create_services_batch, get_onboarding_progress], user_context)
    # Triage does NOT need get_onboarding_progress anymore as it's in the prompt
    triage_tools = _bind_user_context([get_industry_suggestions], user_context) 
    import_tools = _bind_user_context([create_services_batch, get_onboarding_progress], user_context)

    # ── Handoff Tools ──
    handoff_to_company = create_handoff_tool(
        agent_name="CompanySetupAgent",
        description="Transfer to CompanySetupAgent to collect company profile details.",
    )
    handoff_to_outlet = create_handoff_tool(
        agent_name="OutletConfigAgent",
        description="Transfer to OutletConfigAgent to set up the first outlet/location.",
    )
    handoff_to_services = create_handoff_tool(
        agent_name="ServiceSetupAgent",
        description="Transfer to ServiceSetupAgent to create the service menu.",
    )
    handoff_to_import = create_handoff_tool(
        agent_name="DataImportAgent",
        description="Transfer to DataImportAgent when the user mentions importing existing data.",
    )
    handoff_to_triage = create_handoff_tool(
        agent_name="OnboardingTriageAgent",
        description="Transfer back to the Triage Agent when a step is complete.",
    )

    # ── Base Context ──
    base_context = f"""
    You are Ri'Serve's Onboarding Assistant.
    Current Time: {current_time}
    User: {user_name} | Company: {company_name} | Business: {business_type}
    
    IMPORTANT RULES:
    1. **ASK ONE QUESTION AT A TIME.** Never ask for a list of things.
    2. Be concise. Short messages (1-2 sentences) are best.
    3. Be warm but efficient.
    4. Validate data immediately.
    """

    # ── Agent Definitions ──

    # Inject progress directly into Triage prompt
    completed_steps = current_progress.get("completed_steps", [])
    pending_steps = current_progress.get("pending_steps", [])
    
    triage_agent = create_react_agent(
        llm,
        tools=triage_tools + [handoff_to_company, handoff_to_outlet, handoff_to_services, handoff_to_import],
        prompt=f"""{base_context}
        You are the Onboarding Triage Agent.
        
        CURRENT STATE:
        - Completed Steps: {completed_steps}
        - Pending Steps: {pending_steps}
        
        GOAL: Route the user immediately based on the above state.
        
        RULES:
        1. If 'company_profile' is in Pending Steps:
           - Call `transfer_to_CompanySetupAgent` immediately.
           - DO NOT SPEAK.
           
        2. If 'first_outlet' is in Pending Steps:
           - Call `transfer_to_OutletConfigAgent` immediately.
           - DO NOT SPEAK.
           
        3. If 'services' is in Pending Steps:
           - Call `transfer_to_ServiceSetupAgent` immediately.
           - DO NOT SPEAK.
           
        4. If Pending Steps is empty (All done):
           - Say: "You're all set! I'll take you to the dashboard now."
        
        DO NOT ask questions. DO NOT say "Let me check". JUST ROUTE.
        """,
        name="OnboardingTriageAgent",
    )

    company_agent = create_react_agent(
        llm,
        tools=company_tools + [handoff_to_outlet, handoff_to_triage],
        prompt=f"""{base_context}
        You are the Company Setup Agent.
        
        GOAL: Collect City, Hours, Working Days, Timezone, Currency.
        
        RULES:
        - If this is the start of the conversation, greet {user_name} warmly!
        - Ask for **ONE** piece of information immediately: "Where is {company_name} based?"
        - Then ask: "What are your operating hours?"
        - Then ask: "Which days are you open?"
        - Infer Timezone/Currency from City.
        
        Once you have all 5 fields, call `update_company_profile`.
        Then hand off to OutletConfigAgent.
        """,
        name="CompanySetupAgent",
    )

    outlet_agent = create_react_agent(
        llm,
        tools=outlet_tools + [handoff_to_services, handoff_to_triage],
        prompt=f"""{base_context}
        You are the Outlet Configuration Agent.
        
        GOAL: Create the first location/outlet.
        
        RULES:
        - Ask **ONE** question at a time.
        - Start with: "How many [industry_resource_name] do you have?" (e.g. Chairs for Salon, Bays for Car Wash).
          - If they say "3", automatically suggest names like "Station 1, Station 2, Station 3".
        - Confirm the names.
        
        Once confirmed, call `create_outlet`.
        Then hand off to ServiceSetupAgent.
        """,
        name="OutletConfigAgent",
    )

    service_agent = create_react_agent(
        llm,
        tools=service_tools + [handoff_to_import, handoff_to_triage],
        prompt=f"""{base_context}
        You are the Service Setup Agent.
        
        GOAL: Create the service menu.
        
        RULES:
        - Suggest 3 common services for {business_type} with prices/durations.
        - Ask: "Would you like to add these default services to get started?"
        - If yes -> call `create_services_batch`.
        - If no -> ask for their top service.
        
        Keep it simple. Don't ask for a full menu.
        After creating, hand off to OnboardingTriageAgent.
        """,
        name="ServiceSetupAgent",
    )

    import_agent = create_react_agent(
        llm,
        tools=import_tools + [handoff_to_triage],
        prompt=f"""{base_context}
        You are the Data Import Agent.
        
        For now, just ask what data they have (customers, inventory).
        Acknowledge it, say import tools are coming soon, and hand off to Triage.
        """,
        name="DataImportAgent",
    )

    # ── Build Swarm ──
    workflow = create_swarm(
        [triage_agent, company_agent, outlet_agent, service_agent, import_agent],
        default_active_agent="OnboardingTriageAgent",
    )

    app = workflow.compile()
    return app
