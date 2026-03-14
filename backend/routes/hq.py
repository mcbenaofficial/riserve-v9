"""
Ri'Serve HQ Intelligence — Phase 1
Live DB-driven health scores, insights, copilot, briefings, and drill-down.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta, date
import uuid
import math
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_, or_, text, distinct

import models_pg
from .dependencies import get_current_user, User, get_db, require_feature

router = APIRouter(
    prefix="/hq", 
    tags=["HQ Intelligence"],
    dependencies=[Depends(require_feature("hq_intelligence"))]
)

# ─── Constants ───────────────────────────────────────────────────────
REGIONS = ["South", "West", "North", "East", "Central"]
CLUSTERS = ["Metro Tier-1", "Metro Tier-2", "Semi-Urban", "Urban Premium", "Suburban"]

PLAYBOOK_TEMPLATES = [
    {
        "id": "pb-recover-vips",
        "name": "Recover At-Risk VIPs",
        "description": "Identify high-value customers who haven't visited in 30+ days and send personalized win-back offers via SMS/WhatsApp.",
        "trigger": "VIP rebook rate < 60% for 2 consecutive weeks",
        "targeting": "Top 10% customers by LTV who are 30+ days since last visit",
        "actions": ["Send personalized SMS with 15% discount", "Assign preferred stylist for next booking", "Flag for manager follow-up if no response in 7 days"],
        "guardrails": "Max 1 offer per customer per quarter. Discount capped at 20%.",
        "success_metric": "Rebook rate improvement within 14 days",
        "category": "Customer Retention",
        "estimated_impact": "₹2.5L recovered revenue per outlet/month",
        "status": "available",
    },
    {
        "id": "pb-boost-weekday",
        "name": "Boost Weekday Utilization",
        "description": "Fill off-peak weekday slots through dynamic pricing and targeted campaigns to nearby walk-in audiences.",
        "trigger": "Weekday utilization < 50% for 3+ consecutive weeks",
        "targeting": "Outlets with < 50% utilization on Mon–Wed",
        "actions": ["Enable 20% off-peak discount for walk-ins", "Push geo-targeted Instagram/Google ads within 3km radius", "Auto-schedule junior stylists to off-peak shifts"],
        "guardrails": "Discount only on services > ₹500. Campaign budget max ₹5,000/outlet/week.",
        "success_metric": "Weekday utilization increase to 65%+",
        "category": "Revenue Growth",
        "estimated_impact": "₹1.8L additional revenue per outlet/month",
        "status": "available",
    },
    {
        "id": "pb-retail-upsell",
        "name": "Push Retail Add-Ons for High-Margin SKUs",
        "description": "Train and incentivize stylists to recommend retail products during service, focusing on high-margin SKUs.",
        "trigger": "Retail attach rate < 15% (network benchmark: 22%)",
        "targeting": "All outlets with below-average retail attach rate",
        "actions": ["Display product recommendation cards on POS during checkout", "Enable ₹50 commission per retail sale for stylists", "Weekly leaderboard for retail sales"],
        "guardrails": "Only recommend products relevant to the service performed. Max 2 recommendations per visit.",
        "success_metric": "Retail attach rate increase to 20%+",
        "category": "Revenue Growth",
        "estimated_impact": "₹80K additional margin per outlet/month",
        "status": "available",
    },
]


# ─── Helpers — Real DB computation ───────────────────────────────────

async def _compute_outlet_health(outlet, db: AsyncSession, company_id: str) -> dict:
    """Compute a real composite health profile for an outlet from DB data."""
    now = datetime.now(timezone.utc)
    d30_ago = (now - timedelta(days=30)).date()
    d7_ago = (now - timedelta(days=7)).date()
    d14_ago = (now - timedelta(days=14)).date()
    today = now.date()
    oid = outlet.id

    # ── Revenue (trailing 30 days) ──
    rev_30d = float((await db.execute(
        select(func.coalesce(func.sum(models_pg.Transaction.total_amount), 0))
        .where(models_pg.Transaction.outlet_id == oid,
               models_pg.Transaction.date >= datetime.combine(d30_ago, datetime.min.time(), tzinfo=timezone.utc))
    )).scalar() or 0)

    # Revenue current week vs previous week
    rev_this_week = float((await db.execute(
        select(func.coalesce(func.sum(models_pg.Transaction.total_amount), 0))
        .where(models_pg.Transaction.outlet_id == oid,
               models_pg.Transaction.date >= datetime.combine(d7_ago, datetime.min.time(), tzinfo=timezone.utc))
    )).scalar() or 0)

    rev_prev_week = float((await db.execute(
        select(func.coalesce(func.sum(models_pg.Transaction.total_amount), 0))
        .where(models_pg.Transaction.outlet_id == oid,
               models_pg.Transaction.date >= datetime.combine(d14_ago, datetime.min.time(), tzinfo=timezone.utc),
               models_pg.Transaction.date < datetime.combine(d7_ago, datetime.min.time(), tzinfo=timezone.utc))
    )).scalar() or 0)

    rev_delta = round(((rev_this_week - rev_prev_week) / max(rev_prev_week, 1)) * 100, 1)

    # ── Utilization (trailing 7 days) ──
    bookings_7d = (await db.execute(
        select(func.count()).select_from(models_pg.Booking)
        .where(models_pg.Booking.outlet_id == oid,
               models_pg.Booking.date >= d7_ago,
               models_pg.Booking.status == "Completed")
    )).scalar() or 0

    resource_count = (await db.execute(
        select(func.count()).select_from(models_pg.Resource)
        .where(models_pg.Resource.outlet_id == oid, models_pg.Resource.active == True)
    )).scalar() or 1

    slots_per_day = 24  # 12 hours × 2 slots/hour (09:00–21:00)
    max_capacity_7d = resource_count * slots_per_day * 7
    utilization = round((bookings_7d / max(max_capacity_7d, 1)) * 100, 1)
    utilization = min(utilization, 100)

    # ── NPS (trailing 30 days) ──
    nps_result = (await db.execute(
        select(func.avg(models_pg.Feedback.nps_score))
        .where(models_pg.Feedback.outlet_id == oid,
               models_pg.Feedback.nps_score.isnot(None),
               models_pg.Feedback.created_at >= datetime.combine(d30_ago, datetime.min.time(), tzinfo=timezone.utc))
    )).scalar()
    nps = round(float(nps_result) * 10, 1) if nps_result else 50.0  # Scale 1-10 → 10-100

    # ── Feedback score (avg rating × 20) ──
    avg_rating_result = (await db.execute(
        select(func.avg(models_pg.Feedback.rating))
        .where(models_pg.Feedback.outlet_id == oid,
               models_pg.Feedback.created_at >= datetime.combine(d30_ago, datetime.min.time(), tzinfo=timezone.utc))
    )).scalar()
    feedback_score = round(float(avg_rating_result) * 20, 1) if avg_rating_result else 50.0

    # ── Churn (customers with 2+ bookings who haven't rebooked in 30d) ──
    # Active customers = distinct customers with at least 1 booking in last 90 days
    d90_ago = (now - timedelta(days=90)).date()
    active_customers = (await db.execute(
        select(func.count(distinct(models_pg.Booking.customer_id)))
        .where(models_pg.Booking.outlet_id == oid,
               models_pg.Booking.date >= d90_ago)
    )).scalar() or 0

    # Churned = had bookings before 30d ago but none in last 30d
    returning_in_30d = (await db.execute(
        select(func.count(distinct(models_pg.Booking.customer_id)))
        .where(models_pg.Booking.outlet_id == oid,
               models_pg.Booking.date >= d30_ago)
    )).scalar() or 0

    churn_rate = round(((active_customers - returning_in_30d) / max(active_customers, 1)) * 100, 1)
    churn_rate = max(0, min(churn_rate, 100))

    # ── Composite Health Score ──
    # Normalize revenue to 0-100 scale (use a reference of ₹5L/month as "100")
    rev_normalized = min(100, round((rev_30d / 500000) * 100, 1))

    composite = round(
        rev_normalized * 0.30
        + utilization * 0.20
        + nps * 0.20
        + (100 - churn_rate) * 0.15
        + feedback_score * 0.15,
        1,
    )
    composite = max(0, min(100, composite))

    # Trend (compare this week's composite proxy to last week)
    trend_delta = rev_delta  # Simplified: use revenue delta as trend proxy
    trend_direction = "up" if trend_delta > 2 else ("down" if trend_delta < -2 else "flat")

    # ── City Extraction & Coordinates ──
    # Default coordinates fallback
    city_name = "Unknown"
    coords = {"lat": 20.5937, "lng": 78.9629} # Central India roughly

    if outlet.location:
        # Our seed data has "..., City, State" or just "..., City"
        parts = [p.strip() for p in outlet.location.split(",")]
        # Heuristic: the last part is usually the city in our recent seeds, 
        # but let's check for known cities to be safe
        loc_lower = outlet.location.lower()
        if "chennai" in loc_lower:
            city_name = "Chennai"
            coords = {"lat": 13.0827, "lng": 80.2707}
        elif "mumbai" in loc_lower:
            city_name = "Mumbai"
            coords = {"lat": 19.0760, "lng": 72.8777}
        elif "bengaluru" in loc_lower or "bangalore" in loc_lower:
            city_name = "Bengaluru"
            coords = {"lat": 12.9716, "lng": 77.5946}
        elif "delhi" in loc_lower:
            city_name = "Delhi"
            coords = {"lat": 28.7041, "lng": 77.1025}
        elif "hyderabad" in loc_lower:
            city_name = "Hyderabad"
            coords = {"lat": 17.3850, "lng": 78.4867}
        elif "pune" in loc_lower:
            city_name = "Pune"
            coords = {"lat": 18.5204, "lng": 73.8567}
        else:
            # Fallback string manipulation if unknown city
            city_name = parts[-1] if parts else "Unknown"

    if outlet.latitude is not None and outlet.longitude is not None:
        coords = {"lat": float(outlet.latitude), "lng": float(outlet.longitude)}

    cluster = CLUSTERS[hash(outlet.id + "c") % len(CLUSTERS)]

    return {
        "outlet_id": outlet.id,
        "outlet_name": outlet.name,
        "region": city_name,  # Repurposing 'region' key to mean 'city' for backward compat
        "coordinates": coords,
        "cluster": cluster,
        "health_score": composite,
        "trend_direction": trend_direction,
        "trend_delta": trend_delta,
        "metrics": {
            "revenue_30d": rev_30d,
            "revenue_score": rev_normalized,
            "revenue_delta": rev_delta,
            "utilization": utilization,
            "nps": nps,
            "avg_rating": round(float(avg_rating_result), 1) if avg_rating_result else 0,
            "churn_rate": churn_rate,
            "feedback_score": feedback_score,
            "bookings_7d": bookings_7d,
        },
        "status": "critical" if composite < 45 else ("at_risk" if composite < 65 else "healthy"),
    }


# ─── Pydantic schemas ────────────────────────────────────────────────

class CopilotQuery(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = None

class PlaybookDeploy(BaseModel):
    outlet_ids: List[str]
    parameters: Optional[Dict[str, Any]] = None


# ═══════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════

@router.get("/network-health")
async def get_network_health(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns full network health view with real computed metrics."""
    stmt = select(models_pg.Outlet).where(models_pg.Outlet.status == "active")
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Outlet.company_id == current_user.company_id)
    outlets = (await db.execute(stmt)).scalars().all()

    if not outlets:
        return {"status": "success", "kpi_strip": {}, "outlets": [], "top_performers": [], "needs_attention": []}

    company_id = current_user.company_id

    # Compute health for each outlet
    outlet_health_list = []
    for outlet in outlets:
        health = await _compute_outlet_health(outlet, db, company_id)
        outlet_health_list.append(health)

    n = len(outlets)

    # ── Real KPI aggregates ──
    now = datetime.now(timezone.utc)
    d30_ago = (now - timedelta(days=30)).date()
    d7_ago = (now - timedelta(days=7)).date()
    d14_ago = (now - timedelta(days=14)).date()

    # Total revenue 30d
    total_revenue = float((await db.execute(
        select(func.coalesce(func.sum(models_pg.Transaction.total_amount), 0))
        .where(models_pg.Transaction.company_id == company_id,
               models_pg.Transaction.date >= datetime.combine(d30_ago, datetime.min.time(), tzinfo=timezone.utc))
    )).scalar() or 0)

    # Revenue delta (this week vs last week)
    rev_this_week = float((await db.execute(
        select(func.coalesce(func.sum(models_pg.Transaction.total_amount), 0))
        .where(models_pg.Transaction.company_id == company_id,
               models_pg.Transaction.date >= datetime.combine(d7_ago, datetime.min.time(), tzinfo=timezone.utc))
    )).scalar() or 0)

    rev_prev_week = float((await db.execute(
        select(func.coalesce(func.sum(models_pg.Transaction.total_amount), 0))
        .where(models_pg.Transaction.company_id == company_id,
               models_pg.Transaction.date >= datetime.combine(d14_ago, datetime.min.time(), tzinfo=timezone.utc),
               models_pg.Transaction.date < datetime.combine(d7_ago, datetime.min.time(), tzinfo=timezone.utc))
    )).scalar() or 0)

    revenue_delta = round(((rev_this_week - rev_prev_week) / max(rev_prev_week, 1)) * 100, 1)

    # Avg utilization, NPS, churn from computed outlet data
    avg_utilization = round(sum(o["metrics"]["utilization"] for o in outlet_health_list) / n, 1)
    avg_nps = round(sum(o["metrics"]["nps"] for o in outlet_health_list) / n, 1)
    avg_churn = round(sum(o["metrics"]["churn_rate"] for o in outlet_health_list) / n, 1)

    # Bookings this week
    bookings_this_week = (await db.execute(
        select(func.count()).select_from(models_pg.Booking)
        .where(models_pg.Booking.company_id == company_id,
               models_pg.Booking.date >= d7_ago)
    )).scalar() or 0

    bookings_prev_week = (await db.execute(
        select(func.count()).select_from(models_pg.Booking)
        .where(models_pg.Booking.company_id == company_id,
               models_pg.Booking.date >= d14_ago,
               models_pg.Booking.date < d7_ago)
    )).scalar() or 0

    bookings_delta = round(((bookings_this_week - bookings_prev_week) / max(bookings_prev_week, 1)) * 100, 1)

    # Sort by health score
    outlet_health_list.sort(key=lambda x: x["health_score"])

    return {
        "status": "success",
        "kpi_strip": {
            "total_revenue": total_revenue,
            "revenue_delta": revenue_delta,
            "avg_utilization": avg_utilization,
            "utilization_delta": round(avg_utilization - 60, 1),  # vs 60% benchmark
            "avg_nps": avg_nps,
            "nps_delta": round(avg_nps - 65, 1),  # vs 65 benchmark
            "avg_churn_rate": avg_churn,
            "churn_delta": round(avg_churn - 8, 1),  # vs 8% benchmark
            "active_outlets": n,
            "total_bookings_this_week": bookings_this_week,
            "bookings_delta": bookings_delta,
        },
        "outlets": outlet_health_list,
        "top_performers": outlet_health_list[-5:][::-1],
        "needs_attention": outlet_health_list[:5],
        "region_summary": _region_summary(outlet_health_list),
    }


def _region_summary(outlets: list) -> list:
    regions: Dict[str, list] = {}
    for o in outlets:
        regions.setdefault(o["region"], []).append(o["health_score"])
    return [
        {
            "region": region,
            "avg_health": round(sum(scores) / len(scores), 1),
            "outlet_count": len(scores),
            "critical_count": sum(1 for s in scores if s < 45),
        }
        for region, scores in regions.items()
    ]


# ─── Insights (DB-driven anomaly detection) ──────────────────────────

@router.get("/insights")
async def get_insights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns insights generated from real data anomalies."""
    company_id = current_user.company_id
    now = datetime.now(timezone.utc)
    d7_ago = (now - timedelta(days=7)).date()
    d14_ago = (now - timedelta(days=14)).date()
    d30_ago = (now - timedelta(days=30)).date()

    stmt = select(models_pg.Outlet).where(
        models_pg.Outlet.company_id == company_id,
        models_pg.Outlet.status == "active"
    )
    outlets = (await db.execute(stmt)).scalars().all()
    insights = []

    for outlet in outlets:
        oid = outlet.id

        # 1. Revenue drop detection (this week vs last week)
        rev_this = float((await db.execute(
            select(func.coalesce(func.sum(models_pg.Transaction.total_amount), 0))
            .where(models_pg.Transaction.outlet_id == oid,
                   models_pg.Transaction.date >= datetime.combine(d7_ago, datetime.min.time(), tzinfo=timezone.utc))
        )).scalar() or 0)

        rev_prev = float((await db.execute(
            select(func.coalesce(func.sum(models_pg.Transaction.total_amount), 0))
            .where(models_pg.Transaction.outlet_id == oid,
                   models_pg.Transaction.date >= datetime.combine(d14_ago, datetime.min.time(), tzinfo=timezone.utc),
                   models_pg.Transaction.date < datetime.combine(d7_ago, datetime.min.time(), tzinfo=timezone.utc))
        )).scalar() or 0)

        if rev_prev > 0:
            rev_change = round(((rev_this - rev_prev) / rev_prev) * 100, 1)
            if rev_change < -10:
                insights.append({
                    "id": f"insight-rev-{oid[:8]}",
                    "category": "Revenue",
                    "severity": "critical" if rev_change < -20 else "high",
                    "confidence": min(0.95, round(0.7 + abs(rev_change) / 100, 2)),
                    "message": f"Revenue dropped {abs(rev_change)}% week-over-week at {outlet.name}. This week: ₹{rev_this:,.0f} vs last week: ₹{rev_prev:,.0f}.",
                    "outlet_id": oid,
                    "outlet_name": outlet.name,
                    "recommended_action": "Investigate footfall patterns and consider a targeted promotion",
                    "created_at": now.isoformat(),
                    "is_new": True,
                    "data": {"this_week": rev_this, "prev_week": rev_prev, "change_pct": rev_change},
                })

        # 2. Low NPS detection
        avg_nps = (await db.execute(
            select(func.avg(models_pg.Feedback.nps_score))
            .where(models_pg.Feedback.outlet_id == oid,
                   models_pg.Feedback.nps_score.isnot(None),
                   models_pg.Feedback.created_at >= datetime.combine(d30_ago, datetime.min.time(), tzinfo=timezone.utc))
        )).scalar()

        if avg_nps is not None and float(avg_nps) < 6:
            scaled_nps = round(float(avg_nps) * 10, 1)
            insights.append({
                "id": f"insight-nps-{oid[:8]}",
                "category": "Customer",
                "severity": "critical" if scaled_nps < 40 else "high",
                "confidence": 0.92,
                "message": f"NPS at {outlet.name} is {scaled_nps} (below 60 threshold). Top complaints need immediate attention.",
                "outlet_id": oid,
                "outlet_name": outlet.name,
                "recommended_action": "Review recent feedback and deploy service quality playbook",
                "created_at": now.isoformat(),
                "is_new": True,
                "data": {"nps": scaled_nps},
            })

        # 3. Low utilization detection
        bookings_7d = (await db.execute(
            select(func.count()).select_from(models_pg.Booking)
            .where(models_pg.Booking.outlet_id == oid,
                   models_pg.Booking.date >= d7_ago,
                   models_pg.Booking.status == "Completed")
        )).scalar() or 0

        resource_count = (await db.execute(
            select(func.count()).select_from(models_pg.Resource)
            .where(models_pg.Resource.outlet_id == oid, models_pg.Resource.active == True)
        )).scalar() or 1

        utilization = round((bookings_7d / max(resource_count * 24 * 7, 1)) * 100, 1)

        if utilization < 40:
            insights.append({
                "id": f"insight-util-{oid[:8]}",
                "category": "Ops",
                "severity": "medium",
                "confidence": 0.88,
                "message": f"{outlet.name} has only {utilization}% utilization this week ({bookings_7d} bookings across {resource_count} stations). Capacity is being wasted.",
                "outlet_id": oid,
                "outlet_name": outlet.name,
                "recommended_action": "Deploy 'Boost Weekday Utilization' playbook or rebalance staffing",
                "created_at": now.isoformat(),
                "is_new": False,
                "data": {"utilization": utilization, "bookings": bookings_7d},
            })

        # 4. Bad feedback detection (avg rating < 3.5)
        avg_rating = (await db.execute(
            select(func.avg(models_pg.Feedback.rating))
            .where(models_pg.Feedback.outlet_id == oid,
                   models_pg.Feedback.created_at >= datetime.combine(d7_ago, datetime.min.time(), tzinfo=timezone.utc))
        )).scalar()

        if avg_rating is not None and float(avg_rating) < 3.5:
            insights.append({
                "id": f"insight-fb-{oid[:8]}",
                "category": "Risk",
                "severity": "high",
                "confidence": 0.90,
                "message": f"Average rating at {outlet.name} dropped to {float(avg_rating):.1f}/5 this week. Service quality review recommended.",
                "outlet_id": oid,
                "outlet_name": outlet.name,
                "recommended_action": "Trigger service quality audit and staff retraining",
                "created_at": now.isoformat(),
                "is_new": True,
                "data": {"avg_rating": round(float(avg_rating), 1)},
            })

    # Sort by severity
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    insights.sort(key=lambda x: severity_order.get(x["severity"], 4))

    return {"status": "success", "insights": insights, "total": len(insights)}


# ─── Outlet Drill-Down (Enhanced) ────────────────────────────────────

@router.get("/outlet/{outlet_id}")
async def get_outlet_detail(
    outlet_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enhanced drill-down with real daily revenue, service mix, feedback timeline, staff bookings."""
    stmt = select(models_pg.Outlet).where(models_pg.Outlet.id == outlet_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Outlet.company_id == current_user.company_id)
    outlet = (await db.execute(stmt)).scalar_one_or_none()

    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")

    company_id = current_user.company_id
    health = await _compute_outlet_health(outlet, db, company_id)

    now = datetime.now(timezone.utc)
    d30_ago = (now - timedelta(days=30)).date()
    d7_ago = (now - timedelta(days=7)).date()
    today = now.date()

    # ── Daily revenue (last 30 days) ──
    daily_rev_rows = (await db.execute(
        select(
            func.date_trunc('day', models_pg.Transaction.date).label('day'),
            func.sum(models_pg.Transaction.total_amount).label('revenue'),
            func.count().label('txn_count'),
        )
        .where(models_pg.Transaction.outlet_id == outlet_id,
               models_pg.Transaction.date >= datetime.combine(d30_ago, datetime.min.time(), tzinfo=timezone.utc))
        .group_by('day')
        .order_by('day')
    )).all()

    daily_revenue = [
        {"date": row.day.strftime("%Y-%m-%d") if row.day else "", "revenue": float(row.revenue or 0), "transactions": row.txn_count}
        for row in daily_rev_rows
    ]

    # ── Service mix (top 10 by booking count) ──
    svc_mix_rows = (await db.execute(
        select(
            models_pg.Service.name,
            func.count(models_pg.Booking.id).label('booking_count'),
            func.sum(models_pg.Booking.amount).label('revenue'),
        )
        .join(models_pg.Service, models_pg.Booking.service_id == models_pg.Service.id)
        .where(models_pg.Booking.outlet_id == outlet_id,
               models_pg.Booking.date >= d30_ago)
        .group_by(models_pg.Service.name)
        .order_by(func.count(models_pg.Booking.id).desc())
        .limit(10)
    )).all()

    service_mix = [
        {"name": row.name, "bookings": row.booking_count, "revenue": float(row.revenue or 0)}
        for row in svc_mix_rows
    ]

    # ── Feedback timeline (last 20) ──
    fb_rows = (await db.execute(
        select(models_pg.Feedback)
        .where(models_pg.Feedback.outlet_id == outlet_id)
        .order_by(models_pg.Feedback.created_at.desc())
        .limit(20)
    )).scalars().all()

    feedback_timeline = [
        {
            "id": fb.id,
            "rating": fb.rating,
            "nps_score": fb.nps_score,
            "liked_most": fb.liked_most or [],
            "areas_fell_short": fb.areas_fell_short or [],
            "comment": fb.comment,
            "customer_name": fb.customer_name,
            "created_at": fb.created_at.isoformat() if fb.created_at else None,
            "escalation_notes": fb.escalation_notes,
        }
        for fb in fb_rows
    ]

    # ── Staff bookings (last 30 days) ──
    staff_booking_rows = (await db.execute(
        select(
            models_pg.Staff.first_name,
            models_pg.Staff.last_name,
            func.count(models_pg.Booking.id).label('booking_count'),
            func.sum(models_pg.Booking.amount).label('revenue'),
        )
        .join(models_pg.Resource, models_pg.Booking.resource_id == models_pg.Resource.id)
        .join(models_pg.Staff, and_(
            models_pg.Staff.outlet_id == outlet_id,
        ))
        .where(models_pg.Booking.outlet_id == outlet_id,
               models_pg.Booking.date >= d30_ago,
               models_pg.Booking.status == "Completed")
        .group_by(models_pg.Staff.id, models_pg.Staff.first_name, models_pg.Staff.last_name)
        .order_by(func.count(models_pg.Booking.id).desc())
        .limit(10)
    )).all()

    staff_bookings = [
        {"name": f"{row.first_name} {row.last_name}", "bookings": row.booking_count, "revenue": float(row.revenue or 0)}
        for row in staff_booking_rows
    ]

    # ── Network averages for comparison ──
    network_avg_rating = float((await db.execute(
        select(func.avg(models_pg.Feedback.rating))
        .where(models_pg.Feedback.company_id == company_id,
               models_pg.Feedback.created_at >= datetime.combine(d30_ago, datetime.min.time(), tzinfo=timezone.utc))
    )).scalar() or 0)

    network_avg_nps = float((await db.execute(
        select(func.avg(models_pg.Feedback.nps_score))
        .where(models_pg.Feedback.company_id == company_id,
               models_pg.Feedback.nps_score.isnot(None),
               models_pg.Feedback.created_at >= datetime.combine(d30_ago, datetime.min.time(), tzinfo=timezone.utc))
    )).scalar() or 0)

    total_outlets = (await db.execute(
        select(func.count()).select_from(models_pg.Outlet)
        .where(models_pg.Outlet.company_id == company_id, models_pg.Outlet.status == "active")
    )).scalar() or 1

    network_avg_rev = float((await db.execute(
        select(func.coalesce(func.sum(models_pg.Transaction.total_amount), 0))
        .where(models_pg.Transaction.company_id == company_id,
               models_pg.Transaction.date >= datetime.combine(d30_ago, datetime.min.time(), tzinfo=timezone.utc))
    )).scalar() or 0) / total_outlets

    return {
        "status": "success",
        "outlet": {
            "id": outlet.id,
            "name": outlet.name,
            "location": outlet.location,
            "status": outlet.status,
        },
        "health": health,
        "daily_revenue": daily_revenue,
        "service_mix": service_mix,
        "feedback_timeline": feedback_timeline,
        "staff_bookings": staff_bookings,
        "comparison": {
            "network_avg_rating": round(network_avg_rating, 1),
            "network_avg_nps": round(network_avg_nps * 10, 1),
            "network_avg_revenue_30d": round(network_avg_rev, 0),
            "outlet_rating": health["metrics"]["avg_rating"],
            "outlet_nps": health["metrics"]["nps"],
            "outlet_revenue_30d": health["metrics"]["revenue_30d"],
        },
    }


# ─── Morning Briefing ────────────────────────────────────────────────

@router.get("/briefing")
async def get_briefing(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-generated daily briefing comparing today/yesterday vs. previous periods."""
    company_id = current_user.company_id
    now = datetime.now(timezone.utc)
    today = now.date()
    yesterday = today - timedelta(days=1)
    same_day_last_week = today - timedelta(days=7)
    d7_ago = today - timedelta(days=7)
    d30_ago = today - timedelta(days=30)

    # ── Yesterday's metrics ──
    yesterday_bookings = (await db.execute(
        select(func.count()).select_from(models_pg.Booking)
        .where(models_pg.Booking.company_id == company_id, models_pg.Booking.date == yesterday)
    )).scalar() or 0

    yesterday_revenue = float((await db.execute(
        select(func.coalesce(func.sum(models_pg.Transaction.total_amount), 0))
        .where(models_pg.Transaction.company_id == company_id,
               func.date_trunc('day', models_pg.Transaction.date) == datetime.combine(yesterday, datetime.min.time(), tzinfo=timezone.utc))
    )).scalar() or 0)

    yesterday_avg_rating = (await db.execute(
        select(func.avg(models_pg.Feedback.rating))
        .where(models_pg.Feedback.company_id == company_id,
               func.date_trunc('day', models_pg.Feedback.created_at) == datetime.combine(yesterday, datetime.min.time(), tzinfo=timezone.utc))
    )).scalar()
    yesterday_avg_rating = round(float(yesterday_avg_rating), 1) if yesterday_avg_rating else 0

    # ── Same day last week for comparison ──
    lw_bookings = (await db.execute(
        select(func.count()).select_from(models_pg.Booking)
        .where(models_pg.Booking.company_id == company_id, models_pg.Booking.date == same_day_last_week)
    )).scalar() or 0

    lw_revenue = float((await db.execute(
        select(func.coalesce(func.sum(models_pg.Transaction.total_amount), 0))
        .where(models_pg.Transaction.company_id == company_id,
               func.date_trunc('day', models_pg.Transaction.date) == datetime.combine(same_day_last_week, datetime.min.time(), tzinfo=timezone.utc))
    )).scalar() or 0)

    # ── Top movers (outlets with biggest revenue change WoW) ──
    outlets = (await db.execute(
        select(models_pg.Outlet)
        .where(models_pg.Outlet.company_id == company_id, models_pg.Outlet.status == "active")
    )).scalars().all()

    alerts = []
    for outlet in outlets:
        oid = outlet.id
        rev_yesterday = float((await db.execute(
            select(func.coalesce(func.sum(models_pg.Transaction.total_amount), 0))
            .where(models_pg.Transaction.outlet_id == oid,
                   func.date_trunc('day', models_pg.Transaction.date) == datetime.combine(yesterday, datetime.min.time(), tzinfo=timezone.utc))
        )).scalar() or 0)

        rev_lw = float((await db.execute(
            select(func.coalesce(func.sum(models_pg.Transaction.total_amount), 0))
            .where(models_pg.Transaction.outlet_id == oid,
                   func.date_trunc('day', models_pg.Transaction.date) == datetime.combine(same_day_last_week, datetime.min.time(), tzinfo=timezone.utc))
        )).scalar() or 0)

        if rev_lw > 0:
            change_pct = round(((rev_yesterday - rev_lw) / rev_lw) * 100, 1)
        elif rev_yesterday > 0:
            change_pct = 100.0
        else:
            change_pct = 0

        alerts.append({
            "outlet_id": oid,
            "outlet_name": outlet.name,
            "yesterday_revenue": rev_yesterday,
            "last_week_revenue": rev_lw,
            "change_pct": change_pct,
            "direction": "up" if change_pct > 5 else ("down" if change_pct < -5 else "flat"),
        })

    # Sort by absolute change — biggest movers first
    alerts.sort(key=lambda x: abs(x["change_pct"]), reverse=True)

    # ── Day-of-week forecast (average of same weekday over last 4 weeks) ──
    weekday = today.weekday()
    same_weekdays = [today - timedelta(weeks=w) for w in range(1, 5)]
    forecast_bookings = (await db.execute(
        select(func.avg(func.count()).over()).select_from(models_pg.Booking)
        .where(models_pg.Booking.company_id == company_id,
               models_pg.Booking.date.in_(same_weekdays))
    )).scalar()
    # Simpler query for forecast
    total_same_day_bookings = 0
    for wd in same_weekdays:
        cnt = (await db.execute(
            select(func.count()).select_from(models_pg.Booking)
            .where(models_pg.Booking.company_id == company_id, models_pg.Booking.date == wd)
        )).scalar() or 0
        total_same_day_bookings += cnt
    forecast_bookings = round(total_same_day_bookings / max(len(same_weekdays), 1))

    booking_change = round(((yesterday_bookings - lw_bookings) / max(lw_bookings, 1)) * 100, 1)
    revenue_change = round(((yesterday_revenue - lw_revenue) / max(lw_revenue, 1)) * 100, 1)

    # ── Action items based on alerts ──
    action_items = []
    for alert in alerts[:3]:
        if alert["change_pct"] < -15:
            action_items.append({
                "priority": "high",
                "action": f"Investigate revenue drop at {alert['outlet_name']} ({alert['change_pct']}% vs last week)",
                "outlet_id": alert["outlet_id"],
            })
        elif alert["change_pct"] > 20:
            action_items.append({
                "priority": "info",
                "action": f"Revenue surge at {alert['outlet_name']} (+{alert['change_pct']}%) — identify what's working and replicate",
                "outlet_id": alert["outlet_id"],
            })

    return {
        "status": "success",
        "briefing_date": yesterday.isoformat(),
        "summary": {
            "yesterday_bookings": yesterday_bookings,
            "yesterday_revenue": yesterday_revenue,
            "yesterday_avg_rating": yesterday_avg_rating,
            "vs_last_week": {
                "bookings_change": booking_change,
                "revenue_change": revenue_change,
                "lw_bookings": lw_bookings,
                "lw_revenue": lw_revenue,
            },
        },
        "alerts": alerts[:5],
        "action_items": action_items,
        "forecast": {
            "expected_bookings_today": forecast_bookings,
            "day_of_week": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][weekday],
        },
    }


# ─── Playbooks — Phase 2: DB-persisted engine ─────────────────────────

@router.get("/playbooks")
async def get_playbooks(current_user: User = Depends(get_current_user)):
    return {"status": "success", "playbooks": PLAYBOOK_TEMPLATES}


@router.post("/playbooks/{playbook_id}/deploy")
async def deploy_playbook(
    playbook_id: str,
    deploy_input: PlaybookDeploy,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deploy a playbook: persist to DB with baseline metric snapshots."""
    playbook = next((p for p in PLAYBOOK_TEMPLATES if p["id"] == playbook_id), None)
    if not playbook:
        raise HTTPException(status_code=404, detail="Playbook not found")

    company_id = current_user.company_id
    experiment_id = f"exp-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)

    # Snapshot baseline metrics for each outlet
    baseline = {}
    results = []
    for oid in deploy_input.outlet_ids:
        outlet = (await db.execute(
            select(models_pg.Outlet).where(models_pg.Outlet.id == oid)
        )).scalar_one_or_none()
        if not outlet:
            continue
        health = await _compute_outlet_health(outlet, db, company_id)
        before = {
            "revenue_30d": health["metrics"]["revenue_30d"],
            "utilization": health["metrics"]["utilization"],
            "nps": health["metrics"]["nps"],
            "churn_rate": health["metrics"]["churn_rate"],
            "avg_rating": health["metrics"]["avg_rating"],
            "health_score": health["health_score"],
        }
        baseline[oid] = before
        result = models_pg.PlaybookResult(
            deployment_id="__placeholder__",  # set after deployment created
            outlet_id=oid,
            outlet_name=outlet.name,
            before_metrics=before,
            status="monitoring",
        )
        results.append(result)

    deployment = models_pg.PlaybookDeployment(
        company_id=company_id,
        playbook_id=playbook_id,
        playbook_name=playbook["name"],
        outlet_ids=deploy_input.outlet_ids,
        parameters=deploy_input.parameters if hasattr(deploy_input, 'parameters') and deploy_input.parameters else {},
        status="active",
        deployed_by=current_user.id,
        deployed_at=now,
        experiment_id=experiment_id,
        baseline_metrics=baseline,
    )
    db.add(deployment)
    await db.flush()

    # Now set actual deployment_id on results
    for r in results:
        r.deployment_id = deployment.id
        db.add(r)

    await db.commit()

    return {
        "status": "success",
        "message": f"Playbook '{playbook['name']}' deployed to {len(deploy_input.outlet_ids)} outlet(s).",
        "deployment_id": deployment.id,
        "experiment_id": experiment_id,
        "playbook": playbook["name"],
        "outlets_affected": len(deploy_input.outlet_ids),
        "deployed_at": now.isoformat(),
        "estimated_impact": playbook["estimated_impact"],
    }


@router.get("/playbooks/deployments")
async def list_deployments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all playbook deployments with status and impact summary."""
    company_id = current_user.company_id
    rows = (await db.execute(
        select(models_pg.PlaybookDeployment)
        .where(models_pg.PlaybookDeployment.company_id == company_id)
        .order_by(models_pg.PlaybookDeployment.deployed_at.desc())
    )).scalars().all()

    deployments = []
    for d in rows:
        elapsed_hours = (datetime.now(timezone.utc) - d.deployed_at).total_seconds() / 3600 if d.deployed_at else 0
        result_rows = (await db.execute(
            select(models_pg.PlaybookResult).where(models_pg.PlaybookResult.deployment_id == d.id)
        )).scalars().all()

        outlet_summaries = []
        for r in result_rows:
            outlet_summaries.append({
                "outlet_id": r.outlet_id,
                "outlet_name": r.outlet_name,
                "before_health": r.before_metrics.get("health_score", 0) if r.before_metrics else 0,
                "after_health": r.after_metrics.get("health_score", 0) if r.after_metrics else None,
                "improvement_pct": float(r.improvement_pct) if r.improvement_pct else None,
                "status": r.status,
            })

        deployments.append({
            "id": d.id,
            "playbook_id": d.playbook_id,
            "playbook_name": d.playbook_name,
            "experiment_id": d.experiment_id,
            "status": d.status,
            "outlet_count": len(d.outlet_ids or []),
            "deployed_at": d.deployed_at.isoformat() if d.deployed_at else None,
            "completed_at": d.completed_at.isoformat() if d.completed_at else None,
            "elapsed_hours": round(elapsed_hours, 1),
            "baseline_metrics": d.baseline_metrics,
            "current_metrics": d.current_metrics,
            "outlets": outlet_summaries,
            "notes": d.notes,
        })

    return {"status": "success", "deployments": deployments}


@router.get("/playbooks/deployments/{deployment_id}")
async def get_deployment_detail(
    deployment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detailed playbook deployment with per-outlet results."""
    d = (await db.execute(
        select(models_pg.PlaybookDeployment).where(models_pg.PlaybookDeployment.id == deployment_id)
    )).scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="Deployment not found")

    # Get matching playbook template for context
    playbook = next((p for p in PLAYBOOK_TEMPLATES if p["id"] == d.playbook_id), {})

    result_rows = (await db.execute(
        select(models_pg.PlaybookResult).where(models_pg.PlaybookResult.deployment_id == d.id)
    )).scalars().all()

    outlet_results = []
    for r in result_rows:
        outlet_results.append({
            "outlet_id": r.outlet_id,
            "outlet_name": r.outlet_name,
            "before_metrics": r.before_metrics,
            "after_metrics": r.after_metrics,
            "improvement_pct": float(r.improvement_pct) if r.improvement_pct else None,
            "status": r.status,
            "measured_at": r.measured_at.isoformat() if r.measured_at else None,
        })

    return {
        "status": "success",
        "deployment": {
            "id": d.id,
            "playbook_id": d.playbook_id,
            "playbook_name": d.playbook_name,
            "experiment_id": d.experiment_id,
            "status": d.status,
            "deployed_at": d.deployed_at.isoformat() if d.deployed_at else None,
            "completed_at": d.completed_at.isoformat() if d.completed_at else None,
            "baseline_metrics": d.baseline_metrics,
            "current_metrics": d.current_metrics,
            "notes": d.notes,
            "playbook_template": playbook,
        },
        "outlet_results": outlet_results,
    }


class DeploymentStatusUpdate(BaseModel):
    status: str  # paused, active, completed, cancelled
    notes: Optional[str] = None

@router.put("/playbooks/deployments/{deployment_id}/status")
async def update_deployment_status(
    deployment_id: str,
    body: DeploymentStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pause, resume, complete, or cancel a deployment."""
    d = (await db.execute(
        select(models_pg.PlaybookDeployment).where(models_pg.PlaybookDeployment.id == deployment_id)
    )).scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="Deployment not found")

    d.status = body.status
    if body.notes:
        d.notes = body.notes
    if body.status in ("completed", "cancelled"):
        d.completed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "success", "message": f"Deployment {body.status}"}


@router.post("/playbooks/deployments/{deployment_id}/measure")
async def measure_deployment(
    deployment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-compute current metrics for a deployment and compare to baseline."""
    company_id = current_user.company_id
    d = (await db.execute(
        select(models_pg.PlaybookDeployment).where(models_pg.PlaybookDeployment.id == deployment_id)
    )).scalar_one_or_none()
    if not d:
        raise HTTPException(status_code=404, detail="Deployment not found")

    now = datetime.now(timezone.utc)
    current_agg = {}
    result_rows = (await db.execute(
        select(models_pg.PlaybookResult).where(models_pg.PlaybookResult.deployment_id == d.id)
    )).scalars().all()

    for r in result_rows:
        outlet = (await db.execute(
            select(models_pg.Outlet).where(models_pg.Outlet.id == r.outlet_id)
        )).scalar_one_or_none()
        if not outlet:
            continue
        health = await _compute_outlet_health(outlet, db, company_id)
        after = {
            "revenue_30d": health["metrics"]["revenue_30d"],
            "utilization": health["metrics"]["utilization"],
            "nps": health["metrics"]["nps"],
            "churn_rate": health["metrics"]["churn_rate"],
            "avg_rating": health["metrics"]["avg_rating"],
            "health_score": health["health_score"],
        }
        r.after_metrics = after
        r.measured_at = now

        # Calculate improvement based on health score
        before_hs = r.before_metrics.get("health_score", 0) if r.before_metrics else 0
        after_hs = after["health_score"]
        if before_hs > 0:
            r.improvement_pct = round(((after_hs - before_hs) / before_hs) * 100, 1)
            r.status = "improved" if after_hs > before_hs else ("declined" if after_hs < before_hs else "no_change")
        else:
            r.improvement_pct = 0
            r.status = "no_change"

        current_agg[r.outlet_id] = after

    d.current_metrics = current_agg
    await db.commit()

    return {
        "status": "success",
        "message": "Metrics re-measured",
        "deployment_id": d.id,
        "current_metrics": current_agg,
    }


# ─── Copilot v2 — Live DB queries ────────────────────────────────────

@router.post("/copilot")
async def copilot_query(
    query_input: CopilotQuery,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Copilot v2: queries real DB data and builds responses from live metrics."""
    q = query_input.query.lower()
    company_id = current_user.company_id
    now = datetime.now(timezone.utc)
    d30_ago = (now - timedelta(days=30)).date()
    d7_ago = (now - timedelta(days=7)).date()

    # Fetch outlets with health scores
    outlets_stmt = select(models_pg.Outlet).where(
        models_pg.Outlet.company_id == company_id, models_pg.Outlet.status == "active"
    )
    outlets = (await db.execute(outlets_stmt)).scalars().all()

    # Pre-compute health for all outlets
    outlet_health = []
    for outlet in outlets:
        h = await _compute_outlet_health(outlet, db, company_id)
        outlet_health.append(h)

    outlet_health.sort(key=lambda x: x["health_score"])

    # ── Pattern routing with real data ──
    if any(w in q for w in ["underperform", "worst", "bottom", "failing", "attention", "struggling"]):
        underperformers = [o for o in outlet_health if o["health_score"] < 65]
        if not underperformers:
            underperformers = outlet_health[:3]

        worst = underperformers[0] if underperformers else outlet_health[0]
        narrative = (
            f"Based on computed health scores, **{len(underperformers)} outlet(s)** are underperforming "
            f"(health score < 65).\n\n"
            f"The lowest-scoring outlet is **{worst['outlet_name']}** with a health score of "
            f"**{worst['health_score']}**.\n\n"
            f"**Key metrics for {worst['outlet_name']}:**\n"
            f"- Revenue (30d): ₹{worst['metrics']['revenue_30d']:,.0f}\n"
            f"- Utilization: {worst['metrics']['utilization']}%\n"
            f"- NPS: {worst['metrics']['nps']}\n"
            f"- Churn Rate: {worst['metrics']['churn_rate']}%\n"
            f"- Avg Rating: {worst['metrics']['avg_rating']}/5"
        )
        chart_data = {
            "type": "bar",
            "labels": [o["outlet_name"] for o in outlet_health[:8]],
            "values": [o["health_score"] for o in outlet_health[:8]],
            "label": "Health Score",
        }
        actions = ["View outlet details", "Apply 'Boost Weekday Utilization' playbook", "Compare to network average"]

    elif any(w in q for w in ["revenue", "sales", "money", "earning", "income"]):
        total_rev = sum(o["metrics"]["revenue_30d"] for o in outlet_health)
        top_rev = sorted(outlet_health, key=lambda x: x["metrics"]["revenue_30d"], reverse=True)

        narrative = (
            f"Network-wide revenue for the last 30 days is **₹{total_rev:,.0f}**.\n\n"
            f"**Top 5 outlets by revenue:**\n"
        )
        for i, o in enumerate(top_rev[:5]):
            narrative += f"{i+1}. {o['outlet_name']}: ₹{o['metrics']['revenue_30d']:,.0f} ({o['metrics']['revenue_delta']:+.1f}% WoW)\n"

        worst_rev = top_rev[-1]
        narrative += f"\n**Lowest revenue:** {worst_rev['outlet_name']} at ₹{worst_rev['metrics']['revenue_30d']:,.0f}"

        chart_data = {
            "type": "bar",
            "labels": [o["outlet_name"] for o in top_rev],
            "values": [o["metrics"]["revenue_30d"] for o in top_rev],
            "label": "Revenue (₹) — 30 Days",
        }
        actions = ["Drill into top performer", "Investigate lowest outlet", "View weekly trend"]

    elif any(w in q for w in ["churn", "retain", "leaving", "lost", "attrition", "rebook"]):
        avg_churn = round(sum(o["metrics"]["churn_rate"] for o in outlet_health) / max(len(outlet_health), 1), 1)
        high_churn = sorted(outlet_health, key=lambda x: x["metrics"]["churn_rate"], reverse=True)

        narrative = (
            f"Network average churn rate is **{avg_churn}%**.\n\n"
            f"**Outlets with highest churn:**\n"
        )
        for o in high_churn[:5]:
            narrative += f"- {o['outlet_name']}: {o['metrics']['churn_rate']}%\n"

        narrative += (
            f"\nCustomers are considered churned if they had bookings in the past 90 days "
            f"but none in the last 30 days."
        )

        chart_data = {
            "type": "bar",
            "labels": [o["outlet_name"] for o in high_churn],
            "values": [o["metrics"]["churn_rate"] for o in high_churn],
            "label": "Churn Rate %",
        }
        actions = ["Deploy VIP recovery playbook", "View at-risk customers", "Compare to last month"]

    elif any(w in q for w in ["nps", "satisfaction", "feedback", "rating", "experience"]):
        avg_nps = round(sum(o["metrics"]["nps"] for o in outlet_health) / max(len(outlet_health), 1), 1)
        by_nps = sorted(outlet_health, key=lambda x: x["metrics"]["nps"])

        narrative = (
            f"Network average NPS is **{avg_nps}** (scale 0–100).\n\n"
            f"**Outlets below 60 (needs attention):**\n"
        )
        low_nps = [o for o in by_nps if o["metrics"]["nps"] < 60]
        if low_nps:
            for o in low_nps:
                narrative += f"- {o['outlet_name']}: NPS {o['metrics']['nps']}, Rating {o['metrics']['avg_rating']}/5\n"
        else:
            narrative += "All outlets are above the 60 threshold ✓\n"

        narrative += f"\n**Best NPS:** {by_nps[-1]['outlet_name']} at {by_nps[-1]['metrics']['nps']}"

        chart_data = {
            "type": "bar",
            "labels": [o["outlet_name"] for o in by_nps],
            "values": [o["metrics"]["nps"] for o in by_nps],
            "label": "NPS Score",
        }
        actions = ["View feedback details", "Deploy service quality playbook", "Compare to industry benchmark"]

    elif any(w in q for w in ["playbook", "deploy", "action", "fix", "improve"]):
        narrative = (
            "**Available Playbooks:**\n\n"
        )
        for pb in PLAYBOOK_TEMPLATES:
            narrative += f"**{pb['name']}**\n{pb['description']}\n- Estimated Impact: {pb['estimated_impact']}\n\n"

        chart_data = None
        actions = [f"Deploy '{pb['name']}'" for pb in PLAYBOOK_TEMPLATES]

    elif any(w in q for w in ["brief", "morning", "today", "yesterday", "summary"]):
        # Redirect to briefing
        narrative = (
            "I can generate your morning briefing with yesterday's metrics, top alerts, and action items.\n\n"
            "Navigate to **HQ → Briefing** for the full view, or ask me specific questions like:\n"
            "- \"How did we do yesterday?\"\n"
            "- \"Which outlets had the biggest changes?\""
        )
        chart_data = None
        actions = ["View full briefing", "Show yesterday's top performers", "Show alerts"]

    elif any(w in q for w in ["goal", "target", "kpi", "track"]):
        goals = (await db.execute(
            select(models_pg.HQGoal).where(
                models_pg.HQGoal.company_id == company_id,
                models_pg.HQGoal.status.in_(["active", "at_risk"]),
            )
        )).scalars().all()

        if goals:
            narrative = f"You have **{len(goals)} active goals** being tracked.\\n\\n"
            for g in goals[:5]:
                pct = round(min((g.current_value or 0) / max(g.target_value, 0.01) * 100, 100))
                emoji = "🟢" if pct >= 80 else "🟡" if pct >= 50 else "🔴"
                narrative += f"{emoji} **{g.metric}** — {pct}% ({g.current_value:.0f}/{g.target_value:.0f})\\n"
        else:
            narrative = "No active goals are being tracked. Head to **HQ → Goals** to define KPI targets."
        chart_data = None
        actions = ["View all goals", "Create a new goal", "Refresh goal progress"]

    elif any(w in q for w in ["experiment", "a/b", "ab test", "test group", "control group"]):
        exps = (await db.execute(
            select(models_pg.ABExperiment).where(
                models_pg.ABExperiment.company_id == company_id,
            ).order_by(models_pg.ABExperiment.started_at.desc()).limit(5)
        )).scalars().all()

        running = [e for e in exps if e.status == "running"]
        concluded = [e for e in exps if e.status == "concluded"]
        narrative = f"**{len(running)} running** and **{len(concluded)} concluded** experiments.\\n\\n"
        for e in exps[:5]:
            lift = f"+{e.lift_pct}%" if e.lift_pct and float(e.lift_pct) > 0 else f"{e.lift_pct}%" if e.lift_pct else "—"
            narrative += f"• **{e.name}** ({e.status}) — Lift: {lift}\\n"
        chart_data = None
        actions = ["View experiments", "Create new experiment", "Measure running experiments"]

    elif any(w in q for w in ["custom kpi", "composite", "formula", "ratio"]):
        kpis = (await db.execute(
            select(models_pg.CustomKPI).where(
                models_pg.CustomKPI.company_id == company_id,
            )
        )).scalars().all()

        if kpis:
            narrative = f"You have **{len(kpis)} custom KPIs** defined.\\n\\n"
            for k in kpis:
                values = k.values or {}
                avg = round(sum(v.get("value", 0) for v in values.values()) / max(len(values), 1), 2) if values else 0
                narrative += f"• **{k.name}** — Avg: {avg}{k.unit} ({len(values)} outlets)\\n"
        else:
            narrative = "No custom KPIs defined. Navigate to **HQ → Custom KPIs** to create composite metrics."
        chart_data = None
        actions = ["View custom KPIs", "Create a new KPI", "Evaluate all KPIs"]

    elif any(w in q for w in ["automat", "agent", "rule", "workflow", "trigger"]):
        rules = (await db.execute(
            select(models_pg.AgentRule).where(
                models_pg.AgentRule.company_id == company_id,
            )
        )).scalars().all()

        enabled = [r for r in rules if r.enabled]
        total_execs = sum(r.execution_count or 0 for r in rules)
        narrative = (
            f"**{len(enabled)}/{len(rules)}** automation rules are active, "
            f"with **{total_execs}** total executions.\\n\\n"
        )
        for r in rules[:5]:
            status = "🟢 Active" if r.enabled else "⚪ Disabled"
            narrative += f"• {status} **{r.name}** — Triggered {r.execution_count or 0}x\\n"

        # Check pending approvals
        pending = (await db.execute(
            select(func.count(models_pg.AgentExecution.id)).where(
                models_pg.AgentExecution.company_id == company_id,
                models_pg.AgentExecution.status == "pending_approval",
            )
        )).scalar() or 0
        if pending:
            narrative += f"\\n⚠️ **{pending} execution(s) pending approval** in the queue."

        chart_data = None
        actions = ["View agent rules", "View approval queue", "Run rule evaluation"]

    else:
        narrative = (
            "I can help you with:\\n\\n"
            "• **Network health** — \"Show me underperforming outlets\"\\n"
            "• **Revenue** — \"How are revenue trends looking?\"\\n"
            "• **Churn** — \"What are the churn patterns?\"\\n"
            "• **NPS & feedback** — \"What's our NPS looking like?\"\\n"
            "• **Playbooks** — \"What playbooks can I deploy?\"\\n"
            "• **Goals** — \"What goals are we tracking?\"\\n"
            "• **Experiments** — \"Show me running A/B tests\"\\n"
            "• **Custom KPIs** — \"What custom KPIs do we have?\"\\n"
            "• **Agent workflows** — \"What automations are active?\"\\n"
            "• **Briefing** — \"Show me today's briefing\"\\n\\n"
            "All responses are computed from your live booking, transaction, and feedback data."
        )
        chart_data = None
        actions = ["Show underperforming outlets", "Revenue summary", "Churn analysis", "Active goals"]

    # Proactive insights — detect anomalies
    proactive_insights = []
    low_health = [o for o in outlet_health if o["health_score"] < 50]
    if low_health:
        proactive_insights.append(f"⚠️ {len(low_health)} outlet(s) have critically low health scores (<50)")
    high_churn = [o for o in outlet_health if o["metrics"]["churn_rate"] > 20]
    if high_churn:
        proactive_insights.append(f"🔴 {len(high_churn)} outlet(s) have churn rates above 20%")

    return {
        "status": "success",
        "response": {
            "narrative": narrative,
            "chart": chart_data,
            "suggested_actions": actions,
            "follow_up_questions": [
                "What's driving the change?",
                "Show me the outlet breakdown",
                "Deploy a playbook to fix this",
                "Compare to last month",
            ],
            "proactive_insights": proactive_insights,
        },
        "query": query_input.query,
        "timestamp": now.isoformat(),
    }


# ─── Alerts — Phase 2 ─────────────────────────────────────────────────

@router.get("/alerts")
async def list_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List HQ alerts, optionally filtered by status / severity."""
    company_id = current_user.company_id

    # Auto-generate alerts from insights if none exist yet
    existing = (await db.execute(
        select(func.count(models_pg.HQAlert.id))
        .where(models_pg.HQAlert.company_id == company_id)
    )).scalar() or 0

    if existing == 0:
        await _generate_alerts_from_insights(db, company_id)

    stmt = (
        select(models_pg.HQAlert)
        .where(models_pg.HQAlert.company_id == company_id)
        .order_by(
            case(
                (models_pg.HQAlert.severity == "critical", 0),
                (models_pg.HQAlert.severity == "high", 1),
                (models_pg.HQAlert.severity == "medium", 2),
                else_=3,
            ),
            models_pg.HQAlert.created_at.desc(),
        )
    )
    if status:
        stmt = stmt.where(models_pg.HQAlert.status == status)
    if severity:
        stmt = stmt.where(models_pg.HQAlert.severity == severity)

    rows = (await db.execute(stmt)).scalars().all()
    alerts = [
        {
            "id": a.id,
            "outlet_id": a.outlet_id,
            "outlet_name": a.outlet_name,
            "category": a.category,
            "severity": a.severity,
            "title": a.title,
            "message": a.message,
            "status": a.status,
            "source": a.source,
            "assigned_to": a.assigned_to,
            "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
            "resolution_notes": a.resolution_notes,
            "data": a.data,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in rows
    ]
    return {"status": "success", "alerts": alerts, "total": len(alerts)}


@router.get("/alerts/summary")
async def alert_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Counts of open alerts by severity — for notification badge."""
    company_id = current_user.company_id
    rows = (await db.execute(
        select(
            models_pg.HQAlert.severity,
            func.count(models_pg.HQAlert.id),
        )
        .where(models_pg.HQAlert.company_id == company_id, models_pg.HQAlert.status == "open")
        .group_by(models_pg.HQAlert.severity)
    )).all()
    counts = {r[0]: r[1] for r in rows}
    total = sum(counts.values())
    return {
        "status": "success",
        "total_open": total,
        "by_severity": counts,
    }


class AlertActionBody(BaseModel):
    notes: Optional[str] = None
    assigned_to: Optional[str] = None

@router.put("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    body: AlertActionBody = AlertActionBody(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    a = (await db.execute(
        select(models_pg.HQAlert).where(models_pg.HQAlert.id == alert_id)
    )).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")
    a.status = "acknowledged"
    if body.assigned_to:
        a.assigned_to = body.assigned_to
    await db.commit()
    return {"status": "success", "message": "Alert acknowledged"}


@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    body: AlertActionBody = AlertActionBody(),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    a = (await db.execute(
        select(models_pg.HQAlert).where(models_pg.HQAlert.id == alert_id)
    )).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")
    a.status = "resolved"
    a.resolved_by = current_user.id
    a.resolved_at = datetime.now(timezone.utc)
    if body.notes:
        a.resolution_notes = body.notes
    await db.commit()
    return {"status": "success", "message": "Alert resolved"}


@router.put("/alerts/{alert_id}/dismiss")
async def dismiss_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    a = (await db.execute(
        select(models_pg.HQAlert).where(models_pg.HQAlert.id == alert_id)
    )).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")
    a.status = "dismissed"
    await db.commit()
    return {"status": "success", "message": "Alert dismissed"}


async def _generate_alerts_from_insights(db: AsyncSession, company_id: str):
    """Auto-generate HQAlert rows from real anomaly detection."""
    now = datetime.now(timezone.utc)
    d30_ago = (now - timedelta(days=30)).date()
    d7_ago = (now - timedelta(days=7)).date()

    outlets = (await db.execute(
        select(models_pg.Outlet).where(
            models_pg.Outlet.company_id == company_id, models_pg.Outlet.status == "active"
        )
    )).scalars().all()

    alerts = []
    for outlet in outlets:
        health = await _compute_outlet_health(outlet, db, company_id)
        m = health["metrics"]

        if health["health_score"] < 50:
            alerts.append(models_pg.HQAlert(
                company_id=company_id, outlet_id=outlet.id, outlet_name=outlet.name,
                category="Risk", severity="critical",
                title=f"{outlet.name} health score critically low ({health['health_score']:.0f})",
                message=f"Health score is {health['health_score']:.0f}/100. Revenue: ₹{m['revenue_30d']:,.0f}, Utilization: {m['utilization']}%, NPS: {m['nps']}",
                source="system", data={"health": health},
            ))
        elif health["health_score"] < 65:
            alerts.append(models_pg.HQAlert(
                company_id=company_id, outlet_id=outlet.id, outlet_name=outlet.name,
                category="Risk", severity="high",
                title=f"{outlet.name} health declining ({health['health_score']:.0f})",
                message=f"Health score below threshold. Key metrics — Utilization: {m['utilization']}%, Churn: {m['churn_rate']}%",
                source="system", data={"health": health},
            ))

        if m["churn_rate"] > 25:
            alerts.append(models_pg.HQAlert(
                company_id=company_id, outlet_id=outlet.id, outlet_name=outlet.name,
                category="Customer", severity="high",
                title=f"High churn rate at {outlet.name} ({m['churn_rate']}%)",
                message=f"{m['churn_rate']}% of customers haven't returned in 30+ days. Consider deploying VIP recovery playbook.",
                source="system",
            ))

        if m["utilization"] < 35:
            alerts.append(models_pg.HQAlert(
                company_id=company_id, outlet_id=outlet.id, outlet_name=outlet.name,
                category="Ops", severity="medium",
                title=f"Low utilization at {outlet.name} ({m['utilization']}%)",
                message=f"Only {m['utilization']}% of available slots are being used. Consider weekday promotions.",
                source="system",
            ))

        if m["avg_rating"] < 3.5:
            alerts.append(models_pg.HQAlert(
                company_id=company_id, outlet_id=outlet.id, outlet_name=outlet.name,
                category="Customer", severity="high",
                title=f"Low customer rating at {outlet.name} ({m['avg_rating']}/5)",
                message=f"Average rating is {m['avg_rating']}/5. Review recent feedback for patterns.",
                source="system",
            ))

    for a in alerts:
        db.add(a)
    if alerts:
        await db.commit()


# ─── Regional Analytics — Phase 2 ─────────────────────────────────────

@router.get("/regions")
async def list_regions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all regions with aggregated metrics."""
    company_id = current_user.company_id
    outlets = (await db.execute(
        select(models_pg.Outlet).where(
            models_pg.Outlet.company_id == company_id,
            models_pg.Outlet.status == "active",
        )
    )).scalars().all()

    # Group outlets by region and compute health
    region_map = {}
    for outlet in outlets:
        health = await _compute_outlet_health(outlet, db, company_id)
        region = health.get("region", "Unknown")
        coords = health.get("coordinates")
        if region not in region_map:
            region_map[region] = {"outlets": [], "healths": [], "coordinates": coords}
        elif not region_map[region].get("coordinates") and coords:
            region_map[region]["coordinates"] = coords
            
        region_map[region]["outlets"].append(outlet)
        region_map[region]["healths"].append(health)

    regions = []
    for region_name, data in sorted(region_map.items()):
        healths = data["healths"]
        coords = data.get("coordinates", {"lat": 20.5937, "lng": 78.9629}) # fallback
        avg_health = sum(h["health_score"] for h in healths) / max(len(healths), 1)
        total_rev = sum(h["metrics"]["revenue_30d"] for h in healths)
        avg_nps = sum(h["metrics"]["nps"] for h in healths) / max(len(healths), 1)
        avg_util = sum(h["metrics"]["utilization"] for h in healths) / max(len(healths), 1)
        avg_rating = sum(h["metrics"]["avg_rating"] for h in healths) / max(len(healths), 1)
        critical = sum(1 for h in healths if h["health_score"] < 50)
        at_risk = sum(1 for h in healths if 50 <= h["health_score"] < 65)

        best = max(healths, key=lambda x: x["health_score"])
        worst = min(healths, key=lambda x: x["health_score"])

        regions.append({
            "region": region_name,
            "coordinates": coords,
            "outlet_count": len(healths),
            "avg_health": round(avg_health, 1),
            "total_revenue_30d": round(total_rev, 0),
            "avg_nps": round(avg_nps, 1),
            "avg_utilization": round(avg_util, 1),
            "avg_rating": round(avg_rating, 1),
            "critical_count": critical,
            "at_risk_count": at_risk,
            "best_outlet": {"name": best["outlet_name"], "score": round(best["health_score"], 1)},
            "worst_outlet": {"name": worst["outlet_name"], "score": round(worst["health_score"], 1)},
        })

    all_outlets = []
    for region_name, data in sorted(region_map.items()):
        for h in data["healths"]:
            all_outlets.append({
                "outlet_id": h["outlet_id"],
                "outlet_name": h["outlet_name"],
                "region": region_name,
                "coordinates": h["coordinates"],
                "health_score": round(h["health_score"], 1),
                "metrics": h["metrics"]
            })

    return {"status": "success", "regions": regions, "all_outlets": all_outlets}


@router.get("/regions/{region_name}")
async def get_region_detail(
    region_name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Detailed view of a region with all outlet health scores."""
    company_id = current_user.company_id
    outlets = (await db.execute(
        select(models_pg.Outlet).where(
            models_pg.Outlet.company_id == company_id,
            models_pg.Outlet.status == "active",
        )
    )).scalars().all()

    region_outlets = []
    for outlet in outlets:
        health = await _compute_outlet_health(outlet, db, company_id)
        if health.get("region", "").lower() == region_name.lower():
            region_outlets.append({
                "outlet_id": outlet.id,
                "outlet_name": outlet.name,
                "cluster": health.get("cluster", "Unknown"),
                "health_score": round(health["health_score"], 1),
                "status": health["status"],
                "metrics": health["metrics"],
            })

    if not region_outlets:
        raise HTTPException(status_code=404, detail=f"Region '{region_name}' not found")

    region_outlets.sort(key=lambda x: x["health_score"])

    total_rev = sum(o["metrics"]["revenue_30d"] for o in region_outlets)
    avg_health = sum(o["health_score"] for o in region_outlets) / len(region_outlets)
    avg_nps = sum(o["metrics"]["nps"] for o in region_outlets) / len(region_outlets)
    avg_util = sum(o["metrics"]["utilization"] for o in region_outlets) / len(region_outlets)

    return {
        "status": "success",
        "region": region_name,
        "summary": {
            "outlet_count": len(region_outlets),
            "avg_health": round(avg_health, 1),
            "total_revenue_30d": round(total_rev, 0),
            "avg_nps": round(avg_nps, 1),
            "avg_utilization": round(avg_util, 1),
        },
        "outlets": region_outlets,
    }


# ─── Trend Comparison — Phase 2 ───────────────────────────────────────

@router.get("/trends")
async def get_trends(
    outlet_id: str,
    metric: str = "revenue",
    period: str = "30d",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Daily time-series for a single outlet metric."""
    days = int(period.replace("d", "")) if period.endswith("d") else 30
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).date()
    company_id = current_user.company_id

    data = await _get_metric_timeseries(db, outlet_id, company_id, metric, start_date, now.date())

    return {
        "status": "success",
        "outlet_id": outlet_id,
        "metric": metric,
        "period": period,
        "data": data,
    }


@router.get("/compare")
async def compare_outlets(
    outlet_ids: str,  # comma-separated
    metric: str = "revenue",
    period: str = "30d",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Multi-outlet comparison time-series."""
    ids = [x.strip() for x in outlet_ids.split(",")]
    days = int(period.replace("d", "")) if period.endswith("d") else 30
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).date()
    company_id = current_user.company_id

    series = {}
    for oid in ids:
        outlet = (await db.execute(
            select(models_pg.Outlet).where(models_pg.Outlet.id == oid)
        )).scalar_one_or_none()
        name = outlet.name if outlet else oid
        data = await _get_metric_timeseries(db, oid, company_id, metric, start_date, now.date())
        series[name] = data

    return {
        "status": "success",
        "metric": metric,
        "period": period,
        "series": series,
    }


async def _get_metric_timeseries(
    db: AsyncSession, outlet_id: str, company_id: str, metric: str,
    start_date, end_date,
) -> list:
    """Return daily [{date, value}] for a given metric."""
    if metric == "revenue":
        rows = (await db.execute(
            select(
                func.date(models_pg.Booking.date).label("d"),
                func.coalesce(func.sum(models_pg.Booking.amount), 0).label("val"),
            )
            .where(
                models_pg.Booking.outlet_id == outlet_id,
                models_pg.Booking.company_id == company_id,
                func.date(models_pg.Booking.date) >= start_date,
                func.date(models_pg.Booking.date) <= end_date,
            )
            .group_by(func.date(models_pg.Booking.date))
            .order_by(func.date(models_pg.Booking.date))
        )).all()
        return [{"date": r[0].isoformat(), "value": float(r[1])} for r in rows]

    elif metric == "bookings":
        rows = (await db.execute(
            select(
                func.date(models_pg.Booking.date).label("d"),
                func.count(models_pg.Booking.id).label("val"),
            )
            .where(
                models_pg.Booking.outlet_id == outlet_id,
                models_pg.Booking.company_id == company_id,
                func.date(models_pg.Booking.date) >= start_date,
                func.date(models_pg.Booking.date) <= end_date,
            )
            .group_by(func.date(models_pg.Booking.date))
            .order_by(func.date(models_pg.Booking.date))
        )).all()
        return [{"date": r[0].isoformat(), "value": r[1]} for r in rows]

    elif metric in ("rating", "nps"):
        col = models_pg.Feedback.rating if metric == "rating" else models_pg.Feedback.nps_score
        rows = (await db.execute(
            select(
                func.date(models_pg.Feedback.created_at).label("d"),
                func.avg(col).label("val"),
            )
            .where(
                models_pg.Feedback.outlet_id == outlet_id,
                models_pg.Feedback.company_id == company_id,
                func.date(models_pg.Feedback.created_at) >= start_date,
                func.date(models_pg.Feedback.created_at) <= end_date,
                col.isnot(None),
            )
            .group_by(func.date(models_pg.Feedback.created_at))
            .order_by(func.date(models_pg.Feedback.created_at))
        )).all()
        return [{"date": r[0].isoformat(), "value": round(float(r[1]), 1)} for r in rows]

    else:
        return []


# ═══════════════════════════════════════════════════════════════════════
# PHASE 3 — Goals, Predictions, Benchmark, Briefing Schedule
# ═══════════════════════════════════════════════════════════════════════


# ─── Goals — CRUD + live-data refresh ─────────────────────────────────

class GoalCreate(BaseModel):
    outlet_id: str
    metric: str  # revenue, utilization, nps, rating, churn_rate
    target_value: float
    period: str = "monthly"  # weekly, monthly, quarterly
    deadline: Optional[str] = None  # ISO date

class GoalUpdate(BaseModel):
    target_value: Optional[float] = None
    period: Optional[str] = None
    deadline: Optional[str] = None


@router.post("/goals")
async def create_goal(
    body: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a KPI goal for an outlet."""
    company_id = current_user.company_id
    # Resolve outlet name
    outlet = (await db.execute(
        select(models_pg.Outlet).where(
            models_pg.Outlet.id == body.outlet_id,
            models_pg.Outlet.company_id == company_id,
        )
    )).scalar_one_or_none()
    if not outlet:
        raise HTTPException(404, "Outlet not found")

    deadline = None
    if body.deadline:
        deadline = date.fromisoformat(body.deadline)

    goal = models_pg.HQGoal(
        company_id=company_id,
        outlet_id=body.outlet_id,
        outlet_name=outlet.name,
        metric=body.metric,
        target_value=body.target_value,
        period=body.period,
        deadline=deadline,
        created_by=current_user.id,
    )
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return {"goal_id": goal.id, "status": "created"}


@router.get("/goals")
async def list_goals(
    outlet_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all goals, optionally filtered."""
    company_id = current_user.company_id
    q = select(models_pg.HQGoal).where(
        models_pg.HQGoal.company_id == company_id,
    ).order_by(models_pg.HQGoal.created_at.desc())
    if outlet_id:
        q = q.where(models_pg.HQGoal.outlet_id == outlet_id)
    if status:
        q = q.where(models_pg.HQGoal.status == status)
    rows = (await db.execute(q)).scalars().all()
    goals = []
    for g in rows:
        goals.append({
            "id": g.id, "outlet_id": g.outlet_id, "outlet_name": g.outlet_name,
            "metric": g.metric, "target_value": float(g.target_value),
            "current_value": float(g.current_value) if g.current_value else None,
            "period": g.period, "deadline": g.deadline.isoformat() if g.deadline else None,
            "status": g.status, "progress_pct": float(g.progress_pct) if g.progress_pct else 0,
            "created_at": g.created_at.isoformat() if g.created_at else None,
        })
    return {"goals": goals}


@router.put("/goals/{goal_id}")
async def update_goal(
    goal_id: str,
    body: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = (await db.execute(
        select(models_pg.HQGoal).where(models_pg.HQGoal.id == goal_id)
    )).scalar_one_or_none()
    if not goal:
        raise HTTPException(404, "Goal not found")
    if body.target_value is not None:
        goal.target_value = body.target_value
    if body.period:
        goal.period = body.period
    if body.deadline:
        goal.deadline = date.fromisoformat(body.deadline)
    await db.commit()
    return {"status": "updated"}


# ═══════════════════════════════════════════════════════════════════════
# PHASE 4 — CUSTOM KPIs
# ═══════════════════════════════════════════════════════════════════════

AVAILABLE_METRICS = [
    {"id": "revenue_30d", "label": "Revenue (30d)", "unit": "₹"},
    {"id": "utilization", "label": "Utilization %", "unit": "%"},
    {"id": "nps", "label": "NPS Score", "unit": ""},
    {"id": "avg_rating", "label": "Avg Rating", "unit": "/5"},
    {"id": "churn_rate", "label": "Churn Rate", "unit": "%"},
    {"id": "staff_count", "label": "Staff Count", "unit": ""},
    {"id": "bookings_30d", "label": "Bookings (30d)", "unit": ""},
    {"id": "avg_ticket", "label": "Avg Ticket Size", "unit": "₹"},
]


def _compute_kpi_value(formula, metrics):
    """Compute a custom KPI from outlet metrics using the formula."""
    try:
        ftype = formula.get("type", "ratio")
        if ftype == "ratio":
            num = metrics.get(formula.get("numerator", "revenue_30d"), 0)
            den = metrics.get(formula.get("denominator", "staff_count"), 1)
            return round(num / max(den, 0.001), 2)
        elif ftype == "sum":
            fields = formula.get("fields", [])
            return round(sum(metrics.get(f, 0) for f in fields), 2)
        elif ftype == "difference":
            return round(
                metrics.get(formula.get("field_a", ""), 0) - metrics.get(formula.get("field_b", ""), 0), 2
            )
        elif ftype == "product":
            result = 1
            for f in formula.get("fields", []):
                result *= metrics.get(f, 0)
            return round(result, 2)
        return 0
    except Exception:
        return 0


def _threshold_status(value, thresholds):
    green = thresholds.get("green", 80)
    yellow = thresholds.get("yellow", 50)
    if value >= green:
        return "green"
    elif value >= yellow:
        return "yellow"
    return "red"


class CustomKPICreate(BaseModel):
    name: str
    description: str = ""
    formula: dict
    unit: str = ""
    thresholds: dict = {"green": 80, "yellow": 50, "red": 0}
    alert_enabled: bool = False


@router.post("/kpis")
async def create_custom_kpi(
    body: CustomKPICreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    kpi = models_pg.CustomKPI(
        company_id=current_user.company_id,
        name=body.name,
        description=body.description,
        formula=body.formula,
        unit=body.unit,
        thresholds=body.thresholds,
        alert_enabled=body.alert_enabled,
        created_by=current_user.id,
    )
    db.add(kpi)
    await db.commit()
    return {"status": "created", "id": kpi.id}


@router.get("/kpis")
async def list_custom_kpis(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    kpis = (await db.execute(
        select(models_pg.CustomKPI).where(
            models_pg.CustomKPI.company_id == current_user.company_id,
        ).order_by(models_pg.CustomKPI.created_at.desc())
    )).scalars().all()

    return {
        "kpis": [
            {
                "id": k.id,
                "name": k.name,
                "description": k.description,
                "formula": k.formula,
                "unit": k.unit,
                "thresholds": k.thresholds,
                "alert_enabled": k.alert_enabled,
                "values": k.values or {},
                "created_at": k.created_at.isoformat() if k.created_at else None,
            }
            for k in kpis
        ],
        "available_metrics": AVAILABLE_METRICS,
    }


class CustomKPIUpdate(BaseModel):
    name: str = None
    description: str = None
    formula: dict = None
    unit: str = None
    thresholds: dict = None
    alert_enabled: bool = None


@router.put("/kpis/{kpi_id}")
async def update_custom_kpi(
    kpi_id: str,
    body: CustomKPIUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    kpi = (await db.execute(
        select(models_pg.CustomKPI).where(
            models_pg.CustomKPI.id == kpi_id,
            models_pg.CustomKPI.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not kpi:
        raise HTTPException(404, "KPI not found")

    for field in ["name", "description", "formula", "unit", "thresholds", "alert_enabled"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(kpi, field, val)
    await db.commit()
    return {"status": "updated"}


@router.delete("/kpis/{kpi_id}")
async def delete_custom_kpi(
    kpi_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    kpi = (await db.execute(
        select(models_pg.CustomKPI).where(
            models_pg.CustomKPI.id == kpi_id,
            models_pg.CustomKPI.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not kpi:
        raise HTTPException(404, "KPI not found")
    await db.delete(kpi)
    await db.commit()
    return {"status": "deleted"}


@router.post("/kpis/evaluate")
async def evaluate_custom_kpis(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recompute all custom KPIs from live outlet health data."""
    company_id = current_user.company_id
    outlets = (await db.execute(
        select(models_pg.Outlet).where(
            models_pg.Outlet.company_id == company_id, models_pg.Outlet.status == "active"
        )
    )).scalars().all()

    kpis = (await db.execute(
        select(models_pg.CustomKPI).where(models_pg.CustomKPI.company_id == company_id)
    )).scalars().all()

    # Get health metrics for each outlet
    outlet_metrics = {}
    for outlet in outlets:
        h = await _compute_outlet_health(outlet, db, company_id)
        m = h["metrics"]
        # Add extra derived metrics
        staff_count = (await db.execute(
            select(func.count(models_pg.Staff.id)).where(
                models_pg.Staff.outlet_id == outlet.id, models_pg.Staff.active == True
            )
        )).scalar() or 1
        m["staff_count"] = staff_count
        m["bookings_30d"] = m.get("bookings_this_week", 0) * 4
        m["avg_ticket"] = m["revenue_30d"] / max(m.get("bookings_30d", 1), 1)
        outlet_metrics[outlet.id] = {"name": outlet.name, "metrics": m}

    # Evaluate each KPI
    results = []
    for kpi in kpis:
        values = {}
        for oid, odata in outlet_metrics.items():
            val = _compute_kpi_value(kpi.formula, odata["metrics"])
            status = _threshold_status(val, kpi.thresholds)
            values[oid] = {"value": val, "status": status, "outlet_name": odata["name"]}
        kpi.values = values
        results.append({"kpi_id": kpi.id, "name": kpi.name, "outlet_count": len(values)})

    await db.commit()
    return {"status": "evaluated", "results": results}


# ═══════════════════════════════════════════════════════════════════════
# PHASE 4 — A/B EXPERIMENTS
# ═══════════════════════════════════════════════════════════════════════

class ExperimentCreate(BaseModel):
    name: str
    playbook_id: str
    playbook_name: str
    test_outlet_ids: list
    control_outlet_ids: list
    metric: str = "revenue"
    min_duration_days: int = 14


@router.post("/experiments")
async def create_experiment(
    body: ExperimentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = current_user.company_id

    # Capture baseline metrics for both groups
    async def _group_baseline(outlet_ids):
        vals = []
        for oid in outlet_ids:
            outlet = (await db.execute(
                select(models_pg.Outlet).where(models_pg.Outlet.id == oid)
            )).scalar_one_or_none()
            if outlet:
                h = await _compute_outlet_health(outlet, db, company_id)
                vals.append(h["metrics"].get(body.metric, 0))
        avg = round(sum(vals) / max(len(vals), 1), 2) if vals else 0
        return {"values": vals, "avg": avg, "count": len(vals)}

    baseline_test = await _group_baseline(body.test_outlet_ids)
    baseline_control = await _group_baseline(body.control_outlet_ids)

    exp = models_pg.ABExperiment(
        company_id=company_id,
        name=body.name,
        playbook_id=body.playbook_id,
        playbook_name=body.playbook_name,
        test_outlet_ids=body.test_outlet_ids,
        control_outlet_ids=body.control_outlet_ids,
        metric=body.metric,
        baseline_test=baseline_test,
        baseline_control=baseline_control,
        current_test=baseline_test,
        current_control=baseline_control,
        min_duration_days=body.min_duration_days,
        created_by=current_user.id,
    )
    db.add(exp)
    await db.commit()
    return {"status": "created", "id": exp.id}


@router.get("/experiments")
async def list_experiments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    exps = (await db.execute(
        select(models_pg.ABExperiment).where(
            models_pg.ABExperiment.company_id == current_user.company_id,
        ).order_by(models_pg.ABExperiment.started_at.desc())
    )).scalars().all()

    return {
        "experiments": [
            {
                "id": e.id,
                "name": e.name,
                "playbook_name": e.playbook_name,
                "test_outlet_ids": e.test_outlet_ids,
                "control_outlet_ids": e.control_outlet_ids,
                "metric": e.metric,
                "baseline_test": e.baseline_test,
                "baseline_control": e.baseline_control,
                "current_test": e.current_test,
                "current_control": e.current_control,
                "status": e.status,
                "significance": float(e.significance) if e.significance else None,
                "lift_pct": float(e.lift_pct) if e.lift_pct else None,
                "result": e.result,
                "min_duration_days": e.min_duration_days,
                "started_at": e.started_at.isoformat() if e.started_at else None,
                "concluded_at": e.concluded_at.isoformat() if e.concluded_at else None,
                "days_running": (datetime.now(timezone.utc) - e.started_at).days if e.started_at else 0,
            }
            for e in exps
        ]
    }


@router.get("/experiments/{exp_id}")
async def get_experiment_detail(
    exp_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    exp = (await db.execute(
        select(models_pg.ABExperiment).where(
            models_pg.ABExperiment.id == exp_id,
            models_pg.ABExperiment.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not exp:
        raise HTTPException(404, "Experiment not found")

    # Resolve outlet names
    all_ids = (exp.test_outlet_ids or []) + (exp.control_outlet_ids or [])
    outlets_map = {}
    if all_ids:
        outs = (await db.execute(
            select(models_pg.Outlet).where(models_pg.Outlet.id.in_(all_ids))
        )).scalars().all()
        outlets_map = {o.id: o.name for o in outs}

    return {
        "id": exp.id,
        "name": exp.name,
        "playbook_name": exp.playbook_name,
        "metric": exp.metric,
        "status": exp.status,
        "result": exp.result,
        "significance": float(exp.significance) if exp.significance else None,
        "lift_pct": float(exp.lift_pct) if exp.lift_pct else None,
        "min_duration_days": exp.min_duration_days,
        "days_running": (datetime.now(timezone.utc) - exp.started_at).days if exp.started_at else 0,
        "started_at": exp.started_at.isoformat() if exp.started_at else None,
        "concluded_at": exp.concluded_at.isoformat() if exp.concluded_at else None,
        "test_outlets": [{"id": oid, "name": outlets_map.get(oid, oid)} for oid in (exp.test_outlet_ids or [])],
        "control_outlets": [{"id": oid, "name": outlets_map.get(oid, oid)} for oid in (exp.control_outlet_ids or [])],
        "baseline_test": exp.baseline_test,
        "baseline_control": exp.baseline_control,
        "current_test": exp.current_test,
        "current_control": exp.current_control,
    }


@router.post("/experiments/{exp_id}/measure")
async def measure_experiment(
    exp_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recalculate current metrics for test and control groups."""
    exp = (await db.execute(
        select(models_pg.ABExperiment).where(
            models_pg.ABExperiment.id == exp_id,
            models_pg.ABExperiment.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not exp:
        raise HTTPException(404, "Experiment not found")

    company_id = current_user.company_id

    async def _measure_group(outlet_ids):
        vals = []
        for oid in outlet_ids:
            outlet = (await db.execute(
                select(models_pg.Outlet).where(models_pg.Outlet.id == oid)
            )).scalar_one_or_none()
            if outlet:
                h = await _compute_outlet_health(outlet, db, company_id)
                vals.append(h["metrics"].get(exp.metric, 0))
        avg = round(sum(vals) / max(len(vals), 1), 2) if vals else 0
        return {"values": vals, "avg": avg, "count": len(vals)}

    current_test = await _measure_group(exp.test_outlet_ids or [])
    current_control = await _measure_group(exp.control_outlet_ids or [])

    exp.current_test = current_test
    exp.current_control = current_control

    # Calculate lift
    baseline_avg = exp.baseline_control.get("avg", 0) if exp.baseline_control else 0
    control_change = current_control["avg"] - baseline_avg if baseline_avg else 0
    test_change = current_test["avg"] - (exp.baseline_test or {}).get("avg", 0)
    lift = test_change - control_change
    lift_pct = round((lift / max(abs(baseline_avg), 0.01)) * 100, 2) if baseline_avg else 0
    exp.lift_pct = lift_pct

    # Simple significance heuristic (based on sample size and variance)
    n = len(current_test.get("values", [])) + len(current_control.get("values", []))
    days = (datetime.now(timezone.utc) - exp.started_at).days if exp.started_at else 0
    sig = min(0.99, max(0.0, (n * days * abs(lift_pct)) / 10000))
    exp.significance = round(sig, 4)

    # Auto-determine result
    if sig > 0.95:
        exp.result = "winner_test" if lift_pct > 0 else "winner_control"
    elif sig > 0.8:
        exp.result = "likely_test" if lift_pct > 0 else "likely_control"
    else:
        exp.result = "pending"

    await db.commit()
    return {
        "status": "measured",
        "lift_pct": lift_pct,
        "significance": round(sig, 4),
        "result": exp.result,
    }


@router.post("/experiments/{exp_id}/conclude")
async def conclude_experiment(
    exp_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    exp = (await db.execute(
        select(models_pg.ABExperiment).where(
            models_pg.ABExperiment.id == exp_id,
            models_pg.ABExperiment.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not exp:
        raise HTTPException(404, "Experiment not found")

    exp.status = "concluded"
    exp.concluded_at = datetime.now(timezone.utc)
    if exp.result == "pending":
        exp.result = "inconclusive"
    await db.commit()
    return {"status": "concluded", "result": exp.result}


# ═══════════════════════════════════════════════════════════════════════
# PHASE 4 — AGENTIC WORKFLOWS
# ═══════════════════════════════════════════════════════════════════════

TRIGGER_CONDITIONS = ["gt", "lt", "gte", "lte", "eq"]
TRIGGER_METRICS = ["revenue_30d", "utilization", "nps", "avg_rating", "churn_rate", "health_score"]
ACTION_TYPES = [
    {"id": "deploy_playbook", "label": "Deploy Playbook", "params": ["playbook_id"]},
    {"id": "create_alert", "label": "Create Alert", "params": ["severity", "message"]},
    {"id": "set_goal", "label": "Set KPI Goal", "params": ["metric", "target_value"]},
    {"id": "notify", "label": "Send Notification", "params": ["channel", "message"]},
]


class AgentRuleCreate(BaseModel):
    name: str
    description: str = ""
    trigger: dict
    action: dict
    scope: str = "all_outlets"
    outlet_ids: list = []
    requires_approval: bool = True
    cooldown_hours: int = 24


@router.post("/agent/rules")
async def create_agent_rule(
    body: AgentRuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = models_pg.AgentRule(
        company_id=current_user.company_id,
        name=body.name,
        description=body.description,
        trigger=body.trigger,
        action=body.action,
        scope=body.scope,
        outlet_ids=body.outlet_ids,
        requires_approval=body.requires_approval,
        cooldown_hours=body.cooldown_hours,
        created_by=current_user.id,
    )
    db.add(rule)
    await db.commit()
    return {"status": "created", "id": rule.id}


@router.get("/agent/rules")
async def list_agent_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rules = (await db.execute(
        select(models_pg.AgentRule).where(
            models_pg.AgentRule.company_id == current_user.company_id,
        ).order_by(models_pg.AgentRule.created_at.desc())
    )).scalars().all()

    return {
        "rules": [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "trigger": r.trigger,
                "action": r.action,
                "scope": r.scope,
                "outlet_ids": r.outlet_ids,
                "requires_approval": r.requires_approval,
                "enabled": r.enabled,
                "cooldown_hours": r.cooldown_hours,
                "last_triggered_at": r.last_triggered_at.isoformat() if r.last_triggered_at else None,
                "execution_count": r.execution_count,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rules
        ],
        "available_metrics": TRIGGER_METRICS,
        "available_conditions": TRIGGER_CONDITIONS,
        "available_actions": ACTION_TYPES,
    }


class AgentRuleUpdate(BaseModel):
    name: str = None
    description: str = None
    trigger: dict = None
    action: dict = None
    scope: str = None
    outlet_ids: list = None
    requires_approval: bool = None
    enabled: bool = None
    cooldown_hours: int = None


@router.put("/agent/rules/{rule_id}")
async def update_agent_rule(
    rule_id: str,
    body: AgentRuleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = (await db.execute(
        select(models_pg.AgentRule).where(
            models_pg.AgentRule.id == rule_id,
            models_pg.AgentRule.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")

    for field in ["name", "description", "trigger", "action", "scope", "outlet_ids",
                   "requires_approval", "enabled", "cooldown_hours"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(rule, field, val)
    await db.commit()
    return {"status": "updated"}


@router.delete("/agent/rules/{rule_id}")
async def delete_agent_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = (await db.execute(
        select(models_pg.AgentRule).where(
            models_pg.AgentRule.id == rule_id,
            models_pg.AgentRule.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    await db.delete(rule)
    await db.commit()
    return {"status": "deleted"}


@router.get("/agent/queue")
async def get_approval_queue(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List pending approval executions."""
    execs = (await db.execute(
        select(models_pg.AgentExecution).where(
            models_pg.AgentExecution.company_id == current_user.company_id,
            models_pg.AgentExecution.status == "pending_approval",
        ).order_by(models_pg.AgentExecution.created_at.desc())
    )).scalars().all()

    # Fetch rule names
    rule_ids = list({e.rule_id for e in execs})
    rules_map = {}
    if rule_ids:
        rules = (await db.execute(
            select(models_pg.AgentRule).where(models_pg.AgentRule.id.in_(rule_ids))
        )).scalars().all()
        rules_map = {r.id: {"name": r.name, "action": r.action} for r in rules}

    return {
        "queue": [
            {
                "id": e.id,
                "rule_id": e.rule_id,
                "rule_name": rules_map.get(e.rule_id, {}).get("name", "Unknown"),
                "outlet_id": e.outlet_id,
                "outlet_name": e.outlet_name,
                "trigger_data": e.trigger_data,
                "action_data": e.action_data,
                "status": e.status,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in execs
        ],
        "total": len(execs),
    }


@router.get("/agent/log")
async def get_execution_log(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    """List all executions (all statuses) for audit log."""
    execs = (await db.execute(
        select(models_pg.AgentExecution).where(
            models_pg.AgentExecution.company_id == current_user.company_id,
        ).order_by(models_pg.AgentExecution.created_at.desc()).limit(limit)
    )).scalars().all()

    rule_ids = list({e.rule_id for e in execs})
    rules_map = {}
    if rule_ids:
        rules = (await db.execute(
            select(models_pg.AgentRule).where(models_pg.AgentRule.id.in_(rule_ids))
        )).scalars().all()
        rules_map = {r.id: r.name for r in rules}

    return {
        "executions": [
            {
                "id": e.id,
                "rule_name": rules_map.get(e.rule_id, "Unknown"),
                "outlet_name": e.outlet_name,
                "trigger_data": e.trigger_data,
                "action_data": e.action_data,
                "status": e.status,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "executed_at": e.executed_at.isoformat() if e.executed_at else None,
                "result": e.result,
            }
            for e in execs
        ]
    }


@router.post("/agent/queue/{exec_id}/approve")
async def approve_execution(
    exec_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    exe = (await db.execute(
        select(models_pg.AgentExecution).where(
            models_pg.AgentExecution.id == exec_id,
            models_pg.AgentExecution.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not exe:
        raise HTTPException(404, "Execution not found")
    if exe.status != "pending_approval":
        raise HTTPException(400, "Execution is not pending approval")

    exe.status = "approved"
    exe.approved_by = current_user.id
    exe.approved_at = datetime.now(timezone.utc)

    # Execute the action
    action = exe.action_data or {}
    action_type = action.get("type", "")
    result = {"executed": True, "action_type": action_type}

    if action_type == "create_alert":
        alert = models_pg.HQAlert(
            company_id=current_user.company_id,
            outlet_id=exe.outlet_id,
            outlet_name=exe.outlet_name,
            category="Automation",
            severity=action.get("severity", "medium"),
            title=action.get("message", f"Agent rule triggered for {exe.outlet_name}"),
            message=f"Automated alert from rule execution",
            source="agent",
        )
        db.add(alert)
        result["alert_created"] = True

    exe.status = "executed"
    exe.executed_at = datetime.now(timezone.utc)
    exe.result = result

    await db.commit()
    return {"status": "executed", "result": result}


@router.post("/agent/queue/{exec_id}/reject")
async def reject_execution(
    exec_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    exe = (await db.execute(
        select(models_pg.AgentExecution).where(
            models_pg.AgentExecution.id == exec_id,
            models_pg.AgentExecution.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not exe:
        raise HTTPException(404, "Execution not found")

    exe.status = "rejected"
    exe.rejected_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "rejected"}


@router.post("/agent/evaluate")
async def evaluate_agent_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Evaluate all enabled rules against current outlet data."""
    company_id = current_user.company_id
    now = datetime.now(timezone.utc)

    rules = (await db.execute(
        select(models_pg.AgentRule).where(
            models_pg.AgentRule.company_id == company_id,
            models_pg.AgentRule.enabled == True,
        )
    )).scalars().all()

    outlets = (await db.execute(
        select(models_pg.Outlet).where(
            models_pg.Outlet.company_id == company_id, models_pg.Outlet.status == "active"
        )
    )).scalars().all()

    # Compute health for all outlets
    outlet_data = {}
    for outlet in outlets:
        h = await _compute_outlet_health(outlet, db, company_id)
        outlet_data[outlet.id] = h

    triggered = 0
    for rule in rules:
        # Check cooldown
        if rule.last_triggered_at:
            elapsed = (now - rule.last_triggered_at).total_seconds() / 3600
            if elapsed < (rule.cooldown_hours or 24):
                continue

        trigger = rule.trigger or {}
        metric = trigger.get("metric", "health_score")
        condition = trigger.get("condition", "lt")
        threshold = trigger.get("value", 50)

        # Determine which outlets to check
        check_outlets = outlet_data.items()
        if rule.scope == "specific_outlets" and rule.outlet_ids:
            check_outlets = [(oid, od) for oid, od in outlet_data.items() if oid in rule.outlet_ids]

        for outlet_id, odata in check_outlets:
            # Get metric value
            if metric == "health_score":
                val = odata.get("health_score", 0)
            else:
                val = odata.get("metrics", {}).get(metric, 0)

            # Check condition
            triggered_flag = False
            if condition == "gt" and val > threshold:
                triggered_flag = True
            elif condition == "lt" and val < threshold:
                triggered_flag = True
            elif condition == "gte" and val >= threshold:
                triggered_flag = True
            elif condition == "lte" and val <= threshold:
                triggered_flag = True
            elif condition == "eq" and val == threshold:
                triggered_flag = True

            if triggered_flag:
                # Create execution
                exe = models_pg.AgentExecution(
                    rule_id=rule.id,
                    company_id=company_id,
                    outlet_id=outlet_id,
                    outlet_name=odata.get("outlet_name", ""),
                    trigger_data={"metric": metric, "value": val, "threshold": threshold, "condition": condition},
                    action_data=rule.action,
                    status="pending_approval" if rule.requires_approval else "approved",
                )
                db.add(exe)

                if not rule.requires_approval:
                    exe.status = "executed"
                    exe.executed_at = now
                    exe.result = {"auto_executed": True}

                rule.last_triggered_at = now
                rule.execution_count = (rule.execution_count or 0) + 1
                triggered += 1

    await db.commit()
    return {"status": "evaluated", "rules_checked": len(rules), "triggered": triggered}
@router.delete("/goals/{goal_id}")
async def delete_goal(
    goal_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    goal = (await db.execute(
        select(models_pg.HQGoal).where(models_pg.HQGoal.id == goal_id)
    )).scalar_one_or_none()
    if not goal:
        raise HTTPException(404, "Goal not found")
    await db.delete(goal)
    await db.commit()
    return {"status": "deleted"}


@router.post("/goals/refresh")
async def refresh_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Recompute current_value for all active goals from live DB data."""
    company_id = current_user.company_id
    goals = (await db.execute(
        select(models_pg.HQGoal).where(models_pg.HQGoal.company_id == company_id)
    )).scalars().all()

    now = datetime.now(timezone.utc)
    refreshed = 0
    for g in goals:
        # Compute period range
        if g.period == "weekly":
            start = now - timedelta(days=7)
        elif g.period == "quarterly":
            start = now - timedelta(days=90)
        else:  # monthly
            start = now - timedelta(days=30)

        health = await _compute_outlet_health(
            (await db.execute(select(models_pg.Outlet).where(models_pg.Outlet.id == g.outlet_id))).scalar_one_or_none(),
            db, company_id
        )
        if not health:
            continue

        metrics = health.get("metrics", {})
        metric_map = {
            "revenue": metrics.get("revenue_30d", 0),
            "utilization": metrics.get("utilization", 0),
            "nps": metrics.get("nps", 0),
            "rating": metrics.get("avg_rating", 0),
            "churn_rate": metrics.get("churn_rate", 0),
        }
        current = metric_map.get(g.metric, 0)
        target = float(g.target_value)
        g.current_value = Decimal(str(current))

        if target > 0:
            if g.metric == "churn_rate":
                # Lower is better for churn
                progress = max(0, min(100, (1 - current / target) * 100)) if target else 0
            else:
                progress = min(100, (current / target) * 100)
            g.progress_pct = Decimal(str(round(progress, 1)))
        else:
            g.progress_pct = Decimal("0")

        # Determine status
        pct = float(g.progress_pct)
        if pct >= 100:
            g.status = "exceeded"
        elif pct >= 70:
            g.status = "on_track"
        elif pct >= 40:
            g.status = "at_risk"
        else:
            g.status = "behind"

        refreshed += 1

    await db.commit()
    return {"refreshed": refreshed}


# ─── Predictions — Churn ──────────────────────────────────────────────

@router.post("/predictions/churn/compute")
async def compute_churn(
    outlet_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Batch-compute churn risk for all customers of an outlet (or all outlets)."""
    company_id = current_user.company_id
    now = datetime.now(timezone.utc)

    # Get outlets
    oq = select(models_pg.Outlet).where(models_pg.Outlet.company_id == company_id)
    if outlet_id:
        oq = oq.where(models_pg.Outlet.id == outlet_id)
    outlets = (await db.execute(oq)).scalars().all()

    computed = 0
    for outlet in outlets:
        # Get all customers who booked at this outlet
        cust_rows = (await db.execute(
            select(
                models_pg.Customer.id,
                models_pg.Customer.name,
                func.max(models_pg.Booking.date).label("last_visit"),
                func.count(models_pg.Booking.id).label("total_bookings"),
                func.sum(models_pg.Transaction.amount).label("total_spend"),
            )
            .join(models_pg.Booking, models_pg.Booking.customer_id == models_pg.Customer.id)
            .outerjoin(models_pg.Transaction, models_pg.Transaction.booking_id == models_pg.Booking.id)
            .where(
                models_pg.Booking.outlet_id == outlet.id,
                models_pg.Customer.company_id == company_id,
            )
            .group_by(models_pg.Customer.id, models_pg.Customer.name)
        )).all()

        for row in cust_rows:
            cust_id, cust_name, last_visit, total_bookings, total_spend = row
            days_since = (now.date() - last_visit).days if last_visit else 999

            # Heuristic churn scoring
            # Factor 1: Days since last visit (0-40 points)
            recency_score = min(40, days_since * 0.8)
            # Factor 2: Low frequency (0-30 points)
            months_active = max(1, days_since / 30)
            freq = total_bookings / months_active if months_active > 0 else 0
            freq_score = max(0, 30 - freq * 10)
            # Factor 3: Low total spend (0-30 points)
            avg_spend = float(total_spend or 0) / max(1, total_bookings)
            spend_score = max(0, 30 - avg_spend / 100)

            risk = min(100, recency_score + freq_score + spend_score)

            if risk >= 75:
                level = "critical"
                action = "Urgent win-back offer: 30% discount + personal call"
            elif risk >= 50:
                level = "high"
                action = "Send personalized SMS/WhatsApp with 20% offer"
            elif risk >= 30:
                level = "medium"
                action = "Automated reminder email with loyalty rewards"
            else:
                level = "low"
                action = "No action needed — customer is active"

            predicted_churn = (now + timedelta(days=max(7, 60 - days_since))).date() if risk > 30 else None

            # Upsert
            existing = (await db.execute(
                select(models_pg.ChurnPrediction).where(
                    models_pg.ChurnPrediction.outlet_id == outlet.id,
                    models_pg.ChurnPrediction.customer_id == cust_id,
                )
            )).scalar_one_or_none()

            if existing:
                existing.risk_score = risk
                existing.risk_level = level
                existing.factors = {
                    "days_since_last_visit": days_since,
                    "total_bookings": total_bookings,
                    "avg_spend": round(avg_spend, 2),
                    "frequency_per_month": round(freq, 2),
                    "recency_score": round(recency_score, 1),
                    "frequency_score": round(freq_score, 1),
                    "spend_score": round(spend_score, 1),
                }
                existing.predicted_churn_date = predicted_churn
                existing.recommended_action = action
                existing.last_computed = now
            else:
                db.add(models_pg.ChurnPrediction(
                    company_id=company_id,
                    outlet_id=outlet.id,
                    customer_id=cust_id,
                    customer_name=cust_name,
                    risk_score=risk,
                    risk_level=level,
                    factors={
                        "days_since_last_visit": days_since,
                        "total_bookings": total_bookings,
                        "avg_spend": round(avg_spend, 2),
                        "frequency_per_month": round(freq, 2),
                        "recency_score": round(recency_score, 1),
                        "frequency_score": round(freq_score, 1),
                        "spend_score": round(spend_score, 1),
                    },
                    predicted_churn_date=predicted_churn,
                    recommended_action=action,
                ))
            computed += 1

    await db.commit()
    return {"computed": computed}


@router.get("/predictions/churn")
async def list_churn(
    outlet_id: Optional[str] = None,
    risk_level: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List churn predictions, sorted by risk score desc."""
    company_id = current_user.company_id
    q = select(models_pg.ChurnPrediction).where(
        models_pg.ChurnPrediction.company_id == company_id,
    ).order_by(models_pg.ChurnPrediction.risk_score.desc())
    if outlet_id:
        q = q.where(models_pg.ChurnPrediction.outlet_id == outlet_id)
    if risk_level:
        q = q.where(models_pg.ChurnPrediction.risk_level == risk_level)
    rows = (await db.execute(q.limit(200))).scalars().all()

    # Get outlet names
    outlet_map = {}
    results = []
    for p in rows:
        if p.outlet_id not in outlet_map:
            o = (await db.execute(
                select(models_pg.Outlet.name).where(models_pg.Outlet.id == p.outlet_id)
            )).scalar_one_or_none()
            outlet_map[p.outlet_id] = o or "Unknown"
        results.append({
            "id": p.id,
            "outlet_id": p.outlet_id,
            "outlet_name": outlet_map[p.outlet_id],
            "customer_id": p.customer_id,
            "customer_name": p.customer_name,
            "risk_score": float(p.risk_score),
            "risk_level": p.risk_level,
            "factors": p.factors,
            "predicted_churn_date": p.predicted_churn_date.isoformat() if p.predicted_churn_date else None,
            "recommended_action": p.recommended_action,
            "last_computed": p.last_computed.isoformat() if p.last_computed else None,
        })

    summary = {
        "total": len(results),
        "critical": sum(1 for r in results if r["risk_level"] == "critical"),
        "high": sum(1 for r in results if r["risk_level"] == "high"),
        "medium": sum(1 for r in results if r["risk_level"] == "medium"),
        "low": sum(1 for r in results if r["risk_level"] == "low"),
    }
    return {"predictions": results, "summary": summary}


# ─── Predictions — Demand Forecast ────────────────────────────────────

@router.post("/predictions/demand/compute")
async def compute_demand(
    outlet_id: Optional[str] = None,
    days_ahead: int = 14,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compute demand forecast using day-of-week historical averages."""
    company_id = current_user.company_id
    now = datetime.now(timezone.utc)

    oq = select(models_pg.Outlet).where(models_pg.Outlet.company_id == company_id)
    if outlet_id:
        oq = oq.where(models_pg.Outlet.id == outlet_id)
    outlets = (await db.execute(oq)).scalars().all()

    computed = 0
    for outlet in outlets:
        # Get day-of-week averages from last 60 days
        sixty_ago = (now - timedelta(days=60)).date()
        dow_stats = (await db.execute(
            select(
                func.extract("dow", models_pg.Booking.date).label("dow"),
                func.count(models_pg.Booking.id).label("avg_bookings"),
                func.coalesce(func.avg(models_pg.Transaction.amount), 0).label("avg_rev"),
            )
            .outerjoin(models_pg.Transaction, models_pg.Transaction.booking_id == models_pg.Booking.id)
            .where(
                models_pg.Booking.outlet_id == outlet.id,
                models_pg.Booking.company_id == company_id,
                models_pg.Booking.date >= sixty_ago,
            )
            .group_by(func.extract("dow", models_pg.Booking.date))
        )).all()

        # Build lookup: dow -> (avg_bookings_per_week, avg_rev)
        dow_map = {}
        weeks = max(1, 60 / 7)
        for row in dow_stats:
            dow = int(row[0])
            dow_map[dow] = {
                "bookings": round(row[1] / weeks),
                "revenue": round(float(row[2]), 2),
            }

        # Generate forecasts
        for d in range(1, days_ahead + 1):
            forecast_date = (now + timedelta(days=d)).date()
            dow = forecast_date.weekday()  # Mon=0
            stats = dow_map.get(dow, {"bookings": 3, "revenue": 2000})

            # Also get actual if date is in the past or today
            actual_b = None
            actual_r = None
            if forecast_date <= now.date():
                act = (await db.execute(
                    select(
                        func.count(models_pg.Booking.id),
                        func.coalesce(func.sum(models_pg.Transaction.amount), 0),
                    )
                    .outerjoin(models_pg.Transaction, models_pg.Transaction.booking_id == models_pg.Booking.id)
                    .where(
                        models_pg.Booking.outlet_id == outlet.id,
                        models_pg.Booking.date == forecast_date,
                    )
                )).first()
                if act:
                    actual_b, actual_r = act[0], float(act[1])

            # Upsert
            existing = (await db.execute(
                select(models_pg.DemandForecast).where(
                    models_pg.DemandForecast.outlet_id == outlet.id,
                    models_pg.DemandForecast.date == forecast_date,
                )
            )).scalar_one_or_none()

            if existing:
                existing.predicted_bookings = stats["bookings"]
                existing.predicted_revenue = Decimal(str(stats["revenue"]))
                existing.actual_bookings = actual_b
                existing.actual_revenue = Decimal(str(actual_r)) if actual_r else None
                existing.confidence = Decimal("72.5")
                existing.computed_at = now
            else:
                db.add(models_pg.DemandForecast(
                    company_id=company_id,
                    outlet_id=outlet.id,
                    date=forecast_date,
                    predicted_bookings=stats["bookings"],
                    predicted_revenue=Decimal(str(stats["revenue"])),
                    actual_bookings=actual_b,
                    actual_revenue=Decimal(str(actual_r)) if actual_r else None,
                    confidence=Decimal("72.5"),
                ))
            computed += 1

    await db.commit()
    return {"computed": computed}


@router.get("/predictions/demand")
async def list_demand(
    outlet_id: str,
    period: str = "14d",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get demand forecast for an outlet."""
    company_id = current_user.company_id
    days = int(period.replace("d", ""))
    start = datetime.now(timezone.utc).date()
    end = start + timedelta(days=days)

    rows = (await db.execute(
        select(models_pg.DemandForecast)
        .where(
            models_pg.DemandForecast.outlet_id == outlet_id,
            models_pg.DemandForecast.company_id == company_id,
            models_pg.DemandForecast.date >= start,
            models_pg.DemandForecast.date <= end,
        )
        .order_by(models_pg.DemandForecast.date)
    )).scalars().all()

    forecasts = [{
        "date": f.date.isoformat(),
        "predicted_bookings": f.predicted_bookings,
        "predicted_revenue": float(f.predicted_revenue) if f.predicted_revenue else 0,
        "actual_bookings": f.actual_bookings,
        "actual_revenue": float(f.actual_revenue) if f.actual_revenue else None,
        "confidence": float(f.confidence) if f.confidence else 0,
    } for f in rows]

    return {"outlet_id": outlet_id, "forecasts": forecasts}


# ─── Cross-Outlet Benchmark ──────────────────────────────────────────

@router.get("/benchmark")
async def benchmark_outlets(
    outlet_ids: str,  # comma-separated
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full benchmark dataset for selected outlets."""
    company_id = current_user.company_id
    ids = [x.strip() for x in outlet_ids.split(",") if x.strip()]

    if not ids or len(ids) > 10:
        raise HTTPException(400, "Provide 1-10 outlet IDs")

    outlets = (await db.execute(
        select(models_pg.Outlet).where(
            models_pg.Outlet.id.in_(ids),
            models_pg.Outlet.company_id == company_id,
        )
    )).scalars().all()

    results = []
    for outlet in outlets:
        health = await _compute_outlet_health(outlet, db, company_id)
        if not health:
            continue
        m = health.get("metrics", {})
        results.append({
            "outlet_id": outlet.id,
            "outlet_name": outlet.name,
            "region": outlet.location,
            "health_score": health.get("health_score", 0),
            "status": health.get("status", "healthy"),
            "metrics": {
                "revenue_30d": m.get("revenue_30d", 0),
                "utilization": m.get("utilization", 0),
                "nps": m.get("nps", 0),
                "avg_rating": m.get("avg_rating", 0),
                "churn_rate": m.get("churn_rate", 0),
                "bookings_this_week": m.get("bookings_this_week", 0),
            },
        })

    # Network averages for context
    avg_health = sum(r["health_score"] for r in results) / len(results) if results else 0
    avg_rev = sum(r["metrics"]["revenue_30d"] for r in results) / len(results) if results else 0
    avg_nps = sum(r["metrics"]["nps"] for r in results) / len(results) if results else 0
    avg_util = sum(r["metrics"]["utilization"] for r in results) / len(results) if results else 0

    # Best practices: what the top outlet does differently
    if results:
        top = max(results, key=lambda x: x["health_score"])
        best_practices = [
            f"{top['outlet_name']} leads with health score {top['health_score']}",
            f"Revenue: {top['metrics']['revenue_30d']:.0f}",
            f"Utilization: {top['metrics']['utilization']:.1f}%",
            f"NPS: {top['metrics']['nps']:.0f}",
        ]
    else:
        best_practices = []

    return {
        "outlets": results,
        "averages": {
            "health": round(avg_health, 1),
            "revenue_30d": round(avg_rev),
            "nps": round(avg_nps, 1),
            "utilization": round(avg_util, 1),
        },
        "best_practices": best_practices,
    }


# ─── Briefing Schedule ───────────────────────────────────────────────

class BriefingScheduleUpdate(BaseModel):
    frequency: Optional[str] = None
    delivery_time: Optional[str] = None
    channels: Optional[Dict[str, bool]] = None
    enabled: Optional[bool] = None


@router.get("/briefing/schedule")
async def get_briefing_schedule(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the user's briefing schedule preferences."""
    sched = (await db.execute(
        select(models_pg.BriefingSchedule).where(
            models_pg.BriefingSchedule.user_id == current_user.id,
        )
    )).scalar_one_or_none()

    if not sched:
        # Return defaults
        return {
            "frequency": "daily",
            "delivery_time": "08:00",
            "channels": {"in_app": True, "email": False},
            "enabled": False,
            "exists": False,
        }

    return {
        "frequency": sched.frequency,
        "delivery_time": sched.delivery_time,
        "channels": sched.channels,
        "enabled": sched.enabled,
        "last_sent": sched.last_sent.isoformat() if sched.last_sent else None,
        "exists": True,
    }


@router.put("/briefing/schedule")
async def update_briefing_schedule(
    body: BriefingScheduleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update briefing schedule preferences."""
    sched = (await db.execute(
        select(models_pg.BriefingSchedule).where(
            models_pg.BriefingSchedule.user_id == current_user.id,
        )
    )).scalar_one_or_none()

    if not sched:
        sched = models_pg.BriefingSchedule(
            user_id=current_user.id,
            company_id=current_user.company_id,
        )
        db.add(sched)

    if body.frequency is not None:
        sched.frequency = body.frequency
    if body.delivery_time is not None:
        sched.delivery_time = body.delivery_time
    if body.channels is not None:
        sched.channels = body.channels
    if body.enabled is not None:
        sched.enabled = body.enabled

    await db.commit()
    return {"status": "updated"}

