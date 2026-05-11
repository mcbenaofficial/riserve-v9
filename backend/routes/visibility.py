from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import os
import logging

from database_pg import get_db
from routes.dependencies import get_current_user
import models_pg

router = APIRouter(prefix="/visibility", tags=["visibility"])
logger = logging.getLogger(__name__)

PLATFORMS = ["google", "zomato", "justdial", "tripadvisor"]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _review_out(r: models_pg.Review) -> dict:
    return {
        "id": r.id,
        "outlet_id": r.outlet_id,
        "source": r.source,
        "source_review_id": r.source_review_id,
        "author_name": r.author_name,
        "author_avatar_url": r.author_avatar_url,
        "rating": r.rating,
        "content": r.content,
        "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
        "reply_content": r.reply_content,
        "reply_status": r.reply_status,
        "ai_draft": r.ai_draft,
        "sentiment": r.sentiment,
        "topics": r.topics or [],
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _listing_out(l: models_pg.ListingProfile) -> dict:
    return {
        "id": l.id,
        "outlet_id": l.outlet_id,
        "platform": l.platform,
        "status": l.status,
        "listing_url": l.listing_url,
        "external_id": l.external_id,
        "last_synced_at": l.last_synced_at.isoformat() if l.last_synced_at else None,
        "meta": l.meta or {},
        "created_at": l.created_at.isoformat() if l.created_at else None,
        "updated_at": l.updated_at.isoformat() if l.updated_at else None,
    }


# ── Schemas ────────────────────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    outlet_id: Optional[str] = None
    source: str = "manual"
    author_name: Optional[str] = None
    rating: int
    content: Optional[str] = None
    reviewed_at: Optional[datetime] = None


class ReviewReplyUpdate(BaseModel):
    reply_content: str
    reply_status: str = "approved"


class ListingUpsert(BaseModel):
    outlet_id: Optional[str] = None
    platform: str
    status: str = "not_connected"
    listing_url: Optional[str] = None
    external_id: Optional[str] = None
    meta: Optional[dict] = None


# ── Reviews ────────────────────────────────────────────────────────────────────

@router.get("/reviews")
async def list_reviews(
    outlet_id: Optional[str] = None,
    source: Optional[str] = None,
    rating: Optional[int] = None,
    reply_status: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(models_pg.Review)
        .where(models_pg.Review.company_id == current_user.company_id)
        .order_by(desc(models_pg.Review.reviewed_at))
    )
    if outlet_id:
        stmt = stmt.where(models_pg.Review.outlet_id == outlet_id)
    if source:
        stmt = stmt.where(models_pg.Review.source == source)
    if rating is not None:
        stmt = stmt.where(models_pg.Review.rating == rating)
    if reply_status:
        stmt = stmt.where(models_pg.Review.reply_status == reply_status)
    result = await db.execute(stmt)
    return [_review_out(r) for r in result.scalars().all()]


@router.post("/reviews", status_code=201)
async def create_review(
    body: ReviewCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sentiment = (
        "positive" if body.rating >= 4
        else "negative" if body.rating <= 2
        else "neutral"
    )
    review = models_pg.Review(
        company_id=current_user.company_id,
        outlet_id=body.outlet_id,
        source=body.source,
        author_name=body.author_name,
        rating=body.rating,
        content=body.content,
        reviewed_at=body.reviewed_at or datetime.now(timezone.utc),
        sentiment=sentiment,
        topics=[],
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return _review_out(review)


@router.delete("/reviews/{review_id}", status_code=204)
async def delete_review(
    review_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.Review).where(
            models_pg.Review.id == review_id,
            models_pg.Review.company_id == current_user.company_id,
        )
    )
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(404, "Review not found")
    await db.delete(review)
    await db.commit()


@router.post("/reviews/{review_id}/draft")
async def draft_reply(
    review_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.Review).where(
            models_pg.Review.id == review_id,
            models_pg.Review.company_id == current_user.company_id,
        )
    )
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(404, "Review not found")

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(500, "LLM not configured")

    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import SystemMessage, HumanMessage

        llm = ChatOpenAI(
            model="openai/gpt-4o",
            api_key=api_key,
            base_url="https://openrouter.ai/api/v1",
            temperature=0.7,
        )
        system = (
            "You are a professional review response writer for a hospitality business. "
            "Write a warm, brand-appropriate reply to this customer review. "
            "Be concise (2–4 sentences), thank them, address key points, and invite them back. "
            "Do not use placeholders — write a complete, ready-to-publish response."
        )
        rating_label = ["terrible", "poor", "okay", "good", "excellent"][review.rating - 1]
        user_msg = (
            f"Review ({rating_label}, {review.rating}/5 stars) from {review.author_name or 'a customer'} "
            f"on {review.source}:\n\n{review.content or '(No text provided)'}"
        )
        response = await llm.ainvoke([SystemMessage(content=system), HumanMessage(content=user_msg)])
        draft = response.content.strip()
    except Exception as e:
        logger.error(f"LLM draft error: {e}")
        raise HTTPException(500, f"Failed to generate draft: {e}")

    review.ai_draft = draft
    review.reply_status = "drafted"
    review.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(review)
    return _review_out(review)


@router.patch("/reviews/{review_id}/reply")
async def set_reply(
    review_id: str,
    body: ReviewReplyUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.Review).where(
            models_pg.Review.id == review_id,
            models_pg.Review.company_id == current_user.company_id,
        )
    )
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(404, "Review not found")
    review.reply_content = body.reply_content
    review.reply_status = body.reply_status
    review.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(review)
    return _review_out(review)


# ── Listings ───────────────────────────────────────────────────────────────────

@router.get("/listings")
async def list_listings(
    outlet_id: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.ListingProfile).where(
        models_pg.ListingProfile.company_id == current_user.company_id
    )
    if outlet_id:
        stmt = stmt.where(models_pg.ListingProfile.outlet_id == outlet_id)
    result = await db.execute(stmt)
    return [_listing_out(l) for l in result.scalars().all()]


@router.put("/listings")
async def upsert_listing(
    body: ListingUpsert,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update a listing profile for a platform+outlet combo."""
    stmt = select(models_pg.ListingProfile).where(
        models_pg.ListingProfile.company_id == current_user.company_id,
        models_pg.ListingProfile.platform == body.platform,
    )
    if body.outlet_id:
        stmt = stmt.where(models_pg.ListingProfile.outlet_id == body.outlet_id)
    result = await db.execute(stmt)
    listing = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if listing:
        listing.status = body.status
        listing.listing_url = body.listing_url
        listing.external_id = body.external_id
        listing.meta = body.meta or listing.meta
        listing.updated_at = now
        if body.status == "connected":
            listing.last_synced_at = now
    else:
        listing = models_pg.ListingProfile(
            company_id=current_user.company_id,
            outlet_id=body.outlet_id,
            platform=body.platform,
            status=body.status,
            listing_url=body.listing_url,
            external_id=body.external_id,
            meta=body.meta or {},
            last_synced_at=now if body.status == "connected" else None,
        )
        db.add(listing)

    await db.commit()
    await db.refresh(listing)
    return _listing_out(listing)


# ── Visibility Score ───────────────────────────────────────────────────────────

@router.get("/score")
async def get_visibility_score(
    outlet_id: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cid = current_user.company_id
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    # Reviews for this company (optionally scoped to outlet)
    review_stmt = select(models_pg.Review).where(models_pg.Review.company_id == cid)
    if outlet_id:
        review_stmt = review_stmt.where(models_pg.Review.outlet_id == outlet_id)
    reviews_result = await db.execute(review_stmt)
    reviews = reviews_result.scalars().all()

    total_reviews = len(reviews)
    avg_rating = (sum(r.rating for r in reviews) / total_reviews) if total_reviews else 0
    recent_reviews = sum(1 for r in reviews if r.reviewed_at and r.reviewed_at >= thirty_days_ago)
    replied_reviews = sum(1 for r in reviews if r.reply_status in ("approved", "published"))

    # Listings for this company
    listing_stmt = select(models_pg.ListingProfile).where(models_pg.ListingProfile.company_id == cid)
    if outlet_id:
        listing_stmt = listing_stmt.where(models_pg.ListingProfile.outlet_id == outlet_id)
    listings_result = await db.execute(listing_stmt)
    listings = listings_result.scalars().all()

    connected = sum(1 for l in listings if l.status == "connected")
    listing_score = (connected / len(PLATFORMS)) * 100 if PLATFORMS else 0

    # Outlet profile completeness
    outlet_stmt = select(models_pg.Outlet).where(models_pg.Outlet.company_id == cid)
    if outlet_id:
        outlet_stmt = outlet_stmt.where(models_pg.Outlet.id == outlet_id)
    outlets_result = await db.execute(outlet_stmt)
    outlets = outlets_result.scalars().all()

    def _outlet_completeness(o):
        fields = [o.name, o.location, o.contact_email, o.contact_phone]
        return sum(1 for f in fields if f) / len(fields) * 100

    outlet_score = (
        sum(_outlet_completeness(o) for o in outlets) / len(outlets)
        if outlets else 0
    )

    # Component scores (0–100)
    rating_score = ((avg_rating - 1) / 4) * 100 if avg_rating else 0
    velocity_score = min(recent_reviews / 20 * 100, 100)  # 20 reviews/month = 100
    reply_rate_score = (replied_reviews / total_reviews * 100) if total_reviews else 0

    # Weighted composite
    composite = (
        rating_score * 0.25
        + velocity_score * 0.20
        + reply_rate_score * 0.15
        + listing_score * 0.30
        + outlet_score * 0.10
    )

    # Action items
    actions = []
    if listing_score < 75:
        missing = [p for p in PLATFORMS if not any(l.platform == p and l.status == "connected" for l in listings)]
        if missing:
            actions.append({"priority": "high", "text": f"Connect your listing on {', '.join(p.title() for p in missing)}"})
    if reply_rate_score < 50 and total_reviews > 0:
        unreplied = total_reviews - replied_reviews
        actions.append({"priority": "high", "text": f"Reply to {unreplied} unanswered review{'s' if unreplied != 1 else ''}"})
    if velocity_score < 40:
        actions.append({"priority": "medium", "text": "Ask recent customers for a Google review to boost velocity"})
    if outlet_score < 75:
        actions.append({"priority": "medium", "text": "Complete your outlet profile (address, phone, email)"})
    if avg_rating > 0 and avg_rating < 4.0:
        actions.append({"priority": "low", "text": "Review negative feedback topics to improve your average rating"})

    return {
        "score": round(composite),
        "components": {
            "rating": {"score": round(rating_score), "weight": 25, "raw": round(avg_rating, 2), "label": "Avg Rating"},
            "velocity": {"score": round(velocity_score), "weight": 20, "raw": recent_reviews, "label": "Reviews (30d)"},
            "reply_rate": {"score": round(reply_rate_score), "weight": 15, "raw": f"{replied_reviews}/{total_reviews}", "label": "Reply Rate"},
            "listings": {"score": round(listing_score), "weight": 30, "raw": f"{connected}/{len(PLATFORMS)}", "label": "Listings"},
            "outlet_profile": {"score": round(outlet_score), "weight": 10, "raw": f"{round(outlet_score)}%", "label": "Profile"},
        },
        "actions": actions,
        "meta": {
            "total_reviews": total_reviews,
            "avg_rating": round(avg_rating, 2),
            "recent_reviews": recent_reviews,
            "replied_reviews": replied_reviews,
            "connected_listings": connected,
        },
    }


# ── GEO (Generative Engine Optimisation) ──────────────────────────────────────

GEO_PLATFORMS = ["chatgpt", "perplexity", "google_ai"]


class GEOQueryCreate(BaseModel):
    query_text: str


def _geo_query_out(q: models_pg.GEOQuery) -> dict:
    return {
        "id": q.id,
        "query_text": q.query_text,
        "active": q.active,
        "created_at": q.created_at.isoformat() if q.created_at else None,
    }


def _geo_check_out(c: models_pg.GEOCheck) -> dict:
    return {
        "id": c.id,
        "query_id": c.query_id,
        "platform": c.platform,
        "simulated_response": c.simulated_response,
        "cited": c.cited,
        "citation_excerpt": c.citation_excerpt,
        "competitors_cited": c.competitors_cited or [],
        "checked_at": c.checked_at.isoformat() if c.checked_at else None,
    }


async def _run_geo_check(query_text: str, platform: str, business_name: str, business_location: str) -> dict:
    """Call LLM to simulate an AI platform's response and detect citation."""
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(500, "LLM not configured")

    from langchain_openai import ChatOpenAI
    from langchain_core.messages import SystemMessage, HumanMessage
    import json as _json

    platform_labels = {
        "chatgpt": "ChatGPT (OpenAI)",
        "perplexity": "Perplexity AI",
        "google_ai": "Google AI Overviews",
    }
    platform_label = platform_labels.get(platform, platform)

    llm = ChatOpenAI(
        model="openai/gpt-4o",
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
        temperature=0.4,
    )

    system = f"""You are a GEO (Generative Engine Optimisation) research tool.
Your task: simulate how {platform_label} would respond to a local search query, then analyse your own response.

Business being tracked: "{business_name}" (located in {business_location or 'the local area'})

Respond with ONLY valid JSON — no markdown, no code fences — in this exact format:
{{
  "simulated_response": "The full simulated {platform_label} answer to the query (2-4 sentences, natural tone)",
  "cited": true or false,
  "citation_excerpt": "The exact sentence mentioning the business, or null if not cited",
  "competitors_cited": ["Competitor Name 1", "Competitor Name 2"]
}}"""

    response = await llm.ainvoke([
        SystemMessage(content=system),
        HumanMessage(content=query_text),
    ])

    raw = response.content.strip()
    # Strip markdown fences if the model adds them anyway
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        data = _json.loads(raw)
    except Exception:
        # Fallback: treat whole response as simulated_response, not cited
        data = {"simulated_response": raw, "cited": False, "citation_excerpt": None, "competitors_cited": []}

    return data


@router.get("/geo/queries")
async def list_geo_queries(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.GEOQuery)
        .where(models_pg.GEOQuery.company_id == current_user.company_id)
        .order_by(models_pg.GEOQuery.created_at)
    )
    return [_geo_query_out(q) for q in result.scalars().all()]


@router.post("/geo/queries", status_code=201)
async def create_geo_query(
    body: GEOQueryCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = models_pg.GEOQuery(
        company_id=current_user.company_id,
        query_text=body.query_text.strip(),
    )
    db.add(q)
    await db.commit()
    await db.refresh(q)
    return _geo_query_out(q)


@router.delete("/geo/queries/{query_id}", status_code=204)
async def delete_geo_query(
    query_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.GEOQuery).where(
            models_pg.GEOQuery.id == query_id,
            models_pg.GEOQuery.company_id == current_user.company_id,
        )
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(404, "Query not found")
    await db.delete(q)
    await db.commit()


@router.post("/geo/queries/{query_id}/run")
async def run_geo_query(
    query_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run a single query across all three GEO platforms and store results."""
    q_result = await db.execute(
        select(models_pg.GEOQuery).where(
            models_pg.GEOQuery.id == query_id,
            models_pg.GEOQuery.company_id == current_user.company_id,
        )
    )
    query = q_result.scalar_one_or_none()
    if not query:
        raise HTTPException(404, "Query not found")

    # Fetch company name + location for grounding
    company_result = await db.execute(
        select(models_pg.Company).where(models_pg.Company.id == current_user.company_id)
    )
    company = company_result.scalar_one_or_none()
    business_name = company.name if company else "the business"
    business_location = company.address if company else ""

    checks = []
    for platform in GEO_PLATFORMS:
        try:
            data = await _run_geo_check(query.query_text, platform, business_name, business_location)
            check = models_pg.GEOCheck(
                company_id=current_user.company_id,
                query_id=query_id,
                platform=platform,
                simulated_response=data.get("simulated_response"),
                cited=bool(data.get("cited", False)),
                citation_excerpt=data.get("citation_excerpt"),
                competitors_cited=data.get("competitors_cited", []),
                checked_at=datetime.now(timezone.utc),
            )
            db.add(check)
            checks.append(check)
        except Exception as e:
            logger.error(f"GEO check failed for platform {platform}: {e}")

    await db.commit()
    for c in checks:
        await db.refresh(c)
    return [_geo_check_out(c) for c in checks]


@router.get("/geo/checks")
async def list_geo_checks(
    query_id: Optional[str] = None,
    platform: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(models_pg.GEOCheck)
        .where(models_pg.GEOCheck.company_id == current_user.company_id)
        .order_by(desc(models_pg.GEOCheck.checked_at))
    )
    if query_id:
        stmt = stmt.where(models_pg.GEOCheck.query_id == query_id)
    if platform:
        stmt = stmt.where(models_pg.GEOCheck.platform == platform)
    result = await db.execute(stmt)
    return [_geo_check_out(c) for c in result.scalars().all()]


@router.get("/geo/summary")
async def geo_summary(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Citation share % per platform + overall, based on all checks."""
    result = await db.execute(
        select(models_pg.GEOCheck).where(
            models_pg.GEOCheck.company_id == current_user.company_id
        )
    )
    checks = result.scalars().all()

    if not checks:
        return {
            "total_checks": 0,
            "overall_citation_rate": 0,
            "by_platform": {p: {"checks": 0, "cited": 0, "rate": 0} for p in GEO_PLATFORMS},
            "top_competitors": [],
        }

    by_platform = {p: {"checks": 0, "cited": 0, "rate": 0} for p in GEO_PLATFORMS}
    competitor_counts: dict = {}

    for c in checks:
        if c.platform in by_platform:
            by_platform[c.platform]["checks"] += 1
            if c.cited:
                by_platform[c.platform]["cited"] += 1
        for comp in (c.competitors_cited or []):
            competitor_counts[comp] = competitor_counts.get(comp, 0) + 1

    for p, stats in by_platform.items():
        stats["rate"] = round(stats["cited"] / stats["checks"] * 100) if stats["checks"] else 0

    overall_cited = sum(1 for c in checks if c.cited)
    overall_rate = round(overall_cited / len(checks) * 100) if checks else 0

    top_competitors = sorted(competitor_counts.items(), key=lambda x: -x[1])[:5]

    return {
        "total_checks": len(checks),
        "overall_citation_rate": overall_rate,
        "by_platform": by_platform,
        "top_competitors": [{"name": n, "mentions": m} for n, m in top_competitors],
    }


# ── Knowledge Entries ──────────────────────────────────────────────────────────

KNOWLEDGE_CATEGORIES = ["faq", "highlight"]


class KnowledgeEntryCreate(BaseModel):
    outlet_id: Optional[str] = None
    category: str = "faq"
    title: str
    body: Optional[str] = None
    sort_order: int = 0
    active: bool = True


class KnowledgeEntryUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    sort_order: Optional[int] = None
    active: Optional[bool] = None


def _knowledge_entry_out(e: models_pg.KnowledgeEntry) -> dict:
    return {
        "id": e.id,
        "outlet_id": e.outlet_id,
        "category": e.category,
        "title": e.title,
        "body": e.body,
        "sort_order": e.sort_order,
        "active": e.active,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


@router.get("/knowledge")
async def list_knowledge_entries(
    outlet_id: Optional[str] = None,
    category: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import asc
    stmt = (
        select(models_pg.KnowledgeEntry)
        .where(models_pg.KnowledgeEntry.company_id == current_user.company_id)
        .order_by(models_pg.KnowledgeEntry.category, asc(models_pg.KnowledgeEntry.sort_order))
    )
    if outlet_id:
        stmt = stmt.where(models_pg.KnowledgeEntry.outlet_id == outlet_id)
    if category:
        stmt = stmt.where(models_pg.KnowledgeEntry.category == category)
    result = await db.execute(stmt)
    return [_knowledge_entry_out(e) for e in result.scalars().all()]


@router.post("/knowledge", status_code=201)
async def create_knowledge_entry(
    body: KnowledgeEntryCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.category not in KNOWLEDGE_CATEGORIES:
        raise HTTPException(400, f"category must be one of {KNOWLEDGE_CATEGORIES}")
    entry = models_pg.KnowledgeEntry(
        company_id=current_user.company_id,
        outlet_id=body.outlet_id,
        category=body.category,
        title=body.title.strip(),
        body=body.body,
        sort_order=body.sort_order,
        active=body.active,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return _knowledge_entry_out(entry)


@router.put("/knowledge/{entry_id}")
async def update_knowledge_entry(
    entry_id: str,
    body: KnowledgeEntryUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.KnowledgeEntry).where(
            models_pg.KnowledgeEntry.id == entry_id,
            models_pg.KnowledgeEntry.company_id == current_user.company_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Entry not found")
    if body.title is not None:
        entry.title = body.title.strip()
    if body.body is not None:
        entry.body = body.body
    if body.sort_order is not None:
        entry.sort_order = body.sort_order
    if body.active is not None:
        entry.active = body.active
    entry.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(entry)
    return _knowledge_entry_out(entry)


@router.delete("/knowledge/{entry_id}", status_code=204)
async def delete_knowledge_entry(
    entry_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.KnowledgeEntry).where(
            models_pg.KnowledgeEntry.id == entry_id,
            models_pg.KnowledgeEntry.company_id == current_user.company_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Entry not found")
    await db.delete(entry)
    await db.commit()
