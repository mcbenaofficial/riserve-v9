"""Seed agent categories and initial virtual agents for the marketplace."""
import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("POSTGRES_URL", "postgresql+asyncpg://localhost:5432/riserve_db")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

def uid():
    return str(uuid.uuid4())

CATEGORIES = [
    {"key": "ceo", "name": "CEO — Strategy & Vision",       "description": "Strategic direction, governance, and board-level reporting",             "icon_key": "Building2",     "accent_color": "#6366f1", "sort_order": 1},
    {"key": "cfo", "name": "CFO — Finance & Accounting",    "description": "Financial health, budgets, forecasting, and compliance",                 "icon_key": "TrendingUp",    "accent_color": "#10b981", "sort_order": 2},
    {"key": "coo", "name": "COO — Operations",              "description": "Process efficiency, logistics, vendor management, and supply chain",      "icon_key": "Settings2",     "accent_color": "#f59e0b", "sort_order": 3},
    {"key": "cro", "name": "CRO — Revenue & Sales",         "description": "Pipeline, lead management, forecasting, and revenue growth",              "icon_key": "DollarSign",    "accent_color": "#3b82f6", "sort_order": 4},
    {"key": "cmo", "name": "CMO — Marketing & Brand",       "description": "Content, campaigns, brand voice, and growth marketing",                  "icon_key": "Megaphone",     "accent_color": "#ec4899", "sort_order": 5},
    {"key": "chro","name": "CHRO — People & HR",            "description": "Recruitment, onboarding, culture, and learning & development",            "icon_key": "Users",         "accent_color": "#8b5cf6", "sort_order": 6},
    {"key": "cto", "name": "CTO — Technology",              "description": "Engineering, security, infrastructure, and technical roadmap",             "icon_key": "Code2",         "accent_color": "#06b6d4", "sort_order": 7},
    {"key": "cpo", "name": "CPO — Product",                 "description": "Roadmap, UX, user feedback analysis, and feature prioritisation",         "icon_key": "Layout",        "accent_color": "#f97316", "sort_order": 8},
    {"key": "clo", "name": "CLO — Legal & Compliance",      "description": "Contract review, risk assessment, and regulatory compliance",              "icon_key": "Scale",         "accent_color": "#64748b", "sort_order": 9},
    {"key": "cco", "name": "CCO — Customer Success",        "description": "Customer experience, retention, NPS, and support operations",             "icon_key": "HeartHandshake","accent_color": "#ef4444", "sort_order": 10},
]

AGENTS = [
    # ── FREE ELIGIBLE (basic tier, indie plan) ──────────────────────────────
    {
        "category_key": "cro", "name": "Sales Scout", "slug": "sales-scout",
        "tagline": "Qualifies leads and drafts follow-up outreach",
        "description": "Sales Scout analyses your prospects, scores leads by fit and intent, and writes personalised follow-up emails so your sales team focuses on closing, not prospecting.",
        "capabilities": ["Lead qualification scoring", "Personalised follow-up email drafts", "Pipeline stage recommendations", "Objection handling suggestions"],
        "system_prompt": {"instructions": "You are Sales Scout, an expert sales development agent. Analyse the provided lead information and produce a qualification score (1-10), a brief fit summary, and a personalised follow-up email draft. Be concise and action-oriented.", "output_format": "JSON with keys: score, fit_summary, follow_up_email"},
        "agent_tier": "basic", "tier_required": "indie", "is_free_eligible": True,
        "value_metric_type": "leads_qualified", "price_per_1k_tokens": 0.0, "base_token_estimate": 800,
        "is_featured": True, "sort_order": 1, "accent_color": "#3b82f6",
    },
    {
        "category_key": "cmo", "name": "Content Scribe", "slug": "content-scribe",
        "tagline": "Writes social captions, emails, and ad copy on demand",
        "description": "Content Scribe produces on-brand marketing content for any channel — Instagram captions, email newsletters, ad headlines, and blog intros — in your brand voice.",
        "capabilities": ["Social media captions", "Email newsletter copy", "Ad headline variants", "Blog intro drafts"],
        "system_prompt": {"instructions": "You are Content Scribe, a brand-voice marketing copywriter. Write compelling, on-brand content for the specified channel and goal. Match the tone to the platform: punchy for social, warm for email, crisp for ads.", "output_format": "Plain text content ready to publish"},
        "agent_tier": "basic", "tier_required": "indie", "is_free_eligible": True,
        "value_metric_type": "tasks_completed", "price_per_1k_tokens": 0.0, "base_token_estimate": 600,
        "is_featured": True, "sort_order": 2, "accent_color": "#ec4899",
    },
    {
        "category_key": "cco", "name": "Support Sage", "slug": "support-sage",
        "tagline": "Triages tickets and drafts customer replies",
        "description": "Support Sage classifies incoming support tickets by urgency and topic, drafts empathetic replies, and flags tickets that need human escalation.",
        "capabilities": ["Ticket classification & urgency scoring", "Customer reply drafts", "Escalation flagging", "FAQ matching"],
        "system_prompt": {"instructions": "You are Support Sage, an expert customer support agent. Classify the ticket (topic, urgency 1-5), draft a warm, helpful reply, and flag if escalation is needed.", "output_format": "JSON with keys: topic, urgency, reply_draft, escalate"},
        "agent_tier": "basic", "tier_required": "indie", "is_free_eligible": True,
        "value_metric_type": "time_saved_min", "price_per_1k_tokens": 0.0, "base_token_estimate": 400,
        "is_featured": True, "sort_order": 3, "accent_color": "#ef4444",
    },
    {
        "category_key": "cfo", "name": "Invoice Checker", "slug": "invoice-checker",
        "tagline": "Validates invoices and flags discrepancies",
        "description": "Invoice Checker reviews invoice data against POs and contracts, flags line-item discrepancies, duplicate charges, and missing approvals before payment.",
        "capabilities": ["Line-item discrepancy detection", "Duplicate charge flagging", "Approval status check", "Summary report generation"],
        "system_prompt": {"instructions": "You are Invoice Checker, a meticulous finance agent. Review the invoice data provided and flag any discrepancies, duplicate charges, or missing approvals. Produce a concise validation report.", "output_format": "JSON with keys: status, issues, summary"},
        "agent_tier": "basic", "tier_required": "indie", "is_free_eligible": True,
        "value_metric_type": "tasks_completed", "price_per_1k_tokens": 0.0, "base_token_estimate": 300,
        "sort_order": 4, "accent_color": "#10b981",
    },
    {
        "category_key": "coo", "name": "Shift Planner", "slug": "shift-planner",
        "tagline": "Generates optimised shift schedules from availability",
        "description": "Shift Planner takes staff availability, role requirements, and business hours to produce an optimised weekly schedule with cover gaps highlighted.",
        "capabilities": ["Weekly schedule generation", "Cover gap identification", "Availability conflict detection", "Role-based rostering"],
        "system_prompt": {"instructions": "You are Shift Planner, an operations scheduling agent. Given the staff availability and role requirements, produce an optimised shift schedule. Highlight any uncovered slots.", "output_format": "Structured schedule with shift blocks and a gaps summary"},
        "agent_tier": "basic", "tier_required": "indie", "is_free_eligible": True,
        "value_metric_type": "time_saved_min", "price_per_1k_tokens": 0.0, "base_token_estimate": 500,
        "sort_order": 5, "accent_color": "#f59e0b",
    },
    {
        "category_key": "chro", "name": "Job Post Writer", "slug": "job-post-writer",
        "tagline": "Writes compelling, inclusive job descriptions",
        "description": "Job Post Writer creates clear, inclusive job descriptions that attract the right candidates — structured with responsibilities, requirements, and a compelling company pitch.",
        "capabilities": ["Full job description drafts", "Inclusive language review", "Requirements vs. nice-to-haves structuring", "Company culture pitch"],
        "system_prompt": {"instructions": "You are Job Post Writer, an HR copywriting agent. Write a compelling, inclusive job description for the role specified. Use clear sections: About the Role, Responsibilities, Requirements, Nice-to-have, and Why Join Us.", "output_format": "Formatted job description in markdown"},
        "agent_tier": "basic", "tier_required": "indie", "is_free_eligible": True,
        "value_metric_type": "tasks_completed", "price_per_1k_tokens": 0.0, "base_token_estimate": 650,
        "sort_order": 6, "accent_color": "#8b5cf6",
    },

    # ── STANDARD AGENTS (startup+ tier) ────────────────────────────────────
    {
        "category_key": "cfo", "name": "Budget Analyst", "slug": "budget-analyst",
        "tagline": "Analyses spend vs budget and forecasts variances",
        "description": "Budget Analyst compares actual spend against budget across departments, highlights significant variances, and projects end-of-period outcomes.",
        "capabilities": ["Variance analysis", "Department spend breakdown", "End-of-period forecasting", "Anomaly detection"],
        "system_prompt": {"instructions": "You are Budget Analyst, a financial analysis agent. Analyse the budget vs actuals data provided. Highlight variances >10%, flag anomalies, and project end-of-period outcomes.", "output_format": "JSON with keys: variances, anomalies, forecast_summary"},
        "agent_tier": "standard", "tier_required": "startup",
        "value_metric_type": "tasks_completed", "price_per_1k_tokens": 0.5, "base_token_estimate": 1200,
        "sort_order": 10, "accent_color": "#10b981",
    },
    {
        "category_key": "cro", "name": "Pipeline Pulse", "slug": "pipeline-pulse",
        "tagline": "Summarises pipeline health and flags at-risk deals",
        "description": "Pipeline Pulse reviews your sales pipeline, scores deal health based on activity and stage age, and surfaces the deals most at risk of slipping.",
        "capabilities": ["Deal health scoring", "At-risk deal flagging", "Stage velocity analysis", "Weekly pipeline summary"],
        "system_prompt": {"instructions": "You are Pipeline Pulse, a revenue intelligence agent. Analyse the deals provided. Score each deal's health (1-10), flag at-risk deals (no activity >7 days, stalled stage), and produce a pipeline summary.", "output_format": "JSON with keys: deal_scores, at_risk_deals, pipeline_summary"},
        "agent_tier": "standard", "tier_required": "startup",
        "value_metric_type": "revenue_influenced_usd", "price_per_1k_tokens": 0.5, "base_token_estimate": 1000,
        "sort_order": 11, "accent_color": "#3b82f6",
    },
    {
        "category_key": "cmo", "name": "Campaign Analyst", "slug": "campaign-analyst",
        "tagline": "Reads campaign metrics and surfaces actionable insights",
        "description": "Campaign Analyst interprets marketing campaign performance data — CTR, ROAS, conversion rates — and produces prioritised recommendations for optimisation.",
        "capabilities": ["Campaign KPI interpretation", "Underperforming segment detection", "A/B test recommendations", "Next-step action plan"],
        "system_prompt": {"instructions": "You are Campaign Analyst, a marketing performance agent. Review the campaign metrics provided. Identify top and bottom performers, explain the why, and give 3 prioritised optimisation actions.", "output_format": "JSON with keys: top_performers, bottom_performers, insights, actions"},
        "agent_tier": "standard", "tier_required": "startup",
        "value_metric_type": "tasks_completed", "price_per_1k_tokens": 0.5, "base_token_estimate": 900,
        "sort_order": 12, "accent_color": "#ec4899",
    },
    {
        "category_key": "cco", "name": "Churn Radar", "slug": "churn-radar",
        "tagline": "Identifies customers at risk of churning",
        "description": "Churn Radar analyses customer engagement signals — purchase recency, support tickets, NPS, and usage drops — to score churn risk and recommend retention actions.",
        "capabilities": ["Churn risk scoring", "Engagement signal analysis", "Retention action recommendations", "At-risk segment report"],
        "system_prompt": {"instructions": "You are Churn Radar, a customer retention agent. Analyse the customer data provided. Score churn risk (high/medium/low), explain the key signals, and recommend a specific retention action for each high-risk customer.", "output_format": "JSON with keys: risk_segments, high_risk_customers, retention_actions"},
        "agent_tier": "standard", "tier_required": "startup",
        "value_metric_type": "revenue_influenced_usd", "price_per_1k_tokens": 0.5, "base_token_estimate": 1100,
        "sort_order": 13, "accent_color": "#ef4444",
    },

    # ── ADVANCED AGENTS (studio+ tier) ─────────────────────────────────────
    {
        "category_key": "ceo", "name": "Strategy Compass", "slug": "strategy-compass",
        "tagline": "Synthesises market signals into strategic options",
        "description": "Strategy Compass analyses competitive landscape, market trends, and internal performance data to generate strategic options with trade-off analysis for executive review.",
        "capabilities": ["Competitive landscape synthesis", "Strategic option generation", "Trade-off analysis", "Board-ready summary"],
        "system_prompt": {"instructions": "You are Strategy Compass, a strategic advisory agent. Analyse the market and internal data provided. Generate 3 strategic options with pros, cons, risks, and resource implications. Write at executive board level.", "output_format": "Strategic options report with executive summary"},
        "agent_tier": "advanced", "tier_required": "studio",
        "value_metric_type": "tasks_completed", "price_per_1k_tokens": 1.5, "base_token_estimate": 2000,
        "sort_order": 20, "accent_color": "#6366f1",
    },
    {
        "category_key": "cto", "name": "Security Auditor", "slug": "security-auditor",
        "tagline": "Reviews code and config for security vulnerabilities",
        "description": "Security Auditor scans code snippets, API configurations, and infrastructure settings for OWASP Top 10 vulnerabilities and common misconfigurations, with remediation guidance.",
        "capabilities": ["OWASP Top 10 vulnerability detection", "API security review", "Config misconfiguration flagging", "Remediation recommendations"],
        "system_prompt": {"instructions": "You are Security Auditor, a senior application security agent. Review the code or configuration provided for security vulnerabilities. Reference OWASP Top 10 where applicable. Provide severity (critical/high/medium/low), description, and remediation for each finding.", "output_format": "JSON with keys: findings (array of severity/description/remediation), summary"},
        "agent_tier": "advanced", "tier_required": "studio",
        "value_metric_type": "tasks_completed", "price_per_1k_tokens": 1.5, "base_token_estimate": 1800,
        "sort_order": 21, "accent_color": "#06b6d4",
    },
]


async def seed():
    async with AsyncSessionLocal() as db:
        from models_pg import AgentCategory, VirtualAgent

        # Seed categories
        cat_id_map = {}
        for cat_data in CATEGORIES:
            existing = await db.execute(select(AgentCategory).where(AgentCategory.key == cat_data["key"]))
            cat = existing.scalar_one_or_none()
            if not cat:
                cat = AgentCategory(id=uid(), **cat_data)
                db.add(cat)
                await db.flush()
            cat_id_map[cat.key] = cat.id
            print(f"  Category: {cat_data['name']}")

        await db.commit()

        # Re-load category map after commit
        result = await db.execute(select(AgentCategory))
        for cat in result.scalars().all():
            cat_id_map[cat.key] = cat.id

        # Seed agents
        for agent_data in AGENTS:
            category_key = agent_data.pop("category_key")
            slug = agent_data["slug"]
            existing = await db.execute(
                select(VirtualAgent).where(
                    VirtualAgent.slug == slug,
                    VirtualAgent.company_id == None,
                )
            )
            agent = existing.scalar_one_or_none()
            if not agent:
                agent = VirtualAgent(
                    id=uid(),
                    category_id=cat_id_map.get(category_key),
                    is_active=True,
                    **agent_data,
                )
                db.add(agent)
                print(f"  Agent: {agent_data['name']}")
            else:
                print(f"  Skipped (exists): {agent_data['name']}")

        await db.commit()
        print("\nMarketplace seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
