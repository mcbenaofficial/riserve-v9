from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import JSONB
from database_pg import get_db
from routes.dependencies import get_current_user
import models_pg
from datetime import date

router = APIRouter(prefix="/marketing/segments", tags=["Marketing - Segments"])

# Field → column map for segment rule evaluation
FIELD_MAP = {
    "total_bookings": "total_bookings",
    "total_revenue": "total_revenue",
    "last_booking_date": "last_visit",
}
OPS = {
    "gte": lambda col, val: col >= val,
    "lte": lambda col, val: col <= val,
    "eq": lambda col, val: col == val,
    "gt": lambda col, val: col > val,
    "lt": lambda col, val: col < val,
}

async def evaluate_segment(rules: list, company_id: str, db: AsyncSession) -> list:
    """Returns list of customer_ids matching all rules (AND logic)."""
    q = select(models_pg.Customer.id).where(models_pg.Customer.company_id == company_id)
    for rule in rules:
        field = rule.get("field", "")
        op = rule.get("operator", "")
        val = rule.get("value")
        if val is None or val == "":
            continue
        if field in FIELD_MAP:
            col = getattr(models_pg.Customer, FIELD_MAP[field])
            if field == "last_booking_date":
                try:
                    val = date.fromisoformat(str(val))
                except ValueError:
                    continue
            else:
                try:
                    val = float(val)
                except (ValueError, TypeError):
                    continue
            if op in OPS:
                q = q.where(OPS[op](col, val))
        elif field == "channel":
            subq = select(models_pg.MktCustomerIdentity.customer_id).where(
                models_pg.MktCustomerIdentity.company_id == company_id,
                models_pg.MktCustomerIdentity.channel == val,
            )
            if op == "has_identity":
                q = q.where(models_pg.Customer.id.in_(subq))
            elif op == "no_identity":
                q = q.where(models_pg.Customer.id.not_in(subq))
        elif field == "tags":
            subq = select(models_pg.MktConversation.customer_id).where(
                models_pg.MktConversation.company_id == company_id,
                models_pg.MktConversation.labels.cast(JSONB).contains([val]),
            )
            q = q.where(models_pg.Customer.id.in_(subq))
    result = await db.execute(q)
    return list(result.scalars().all())

@router.get("")
async def list_segments(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktSegment)
        .where(models_pg.MktSegment.company_id == current_user.company_id)
        .order_by(models_pg.MktSegment.created_at.desc())
    )
    return result.scalars().all()

@router.post("")
async def create_segment(body: dict, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    seg = models_pg.MktSegment(
        company_id=current_user.company_id,
        name=body["name"],
        description=body.get("description"),
        rules=body.get("rules", []),
    )
    db.add(seg)
    await db.flush()
    customer_ids = await evaluate_segment(seg.rules, current_user.company_id, db)
    seg.estimated_count = len(customer_ids)
    await db.commit()
    await db.refresh(seg)
    return seg

@router.get("/preview-rules")
async def preview_rules_get(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return {"count": 0, "customer_ids": []}

@router.post("/preview-rules")
async def preview_rules(body: dict, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rules = body.get("rules", [])
    customer_ids = await evaluate_segment(rules, current_user.company_id, db)
    return {"count": len(customer_ids), "customer_ids": customer_ids[:50]}

@router.get("/{segment_id}")
async def get_segment(segment_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktSegment).where(
            models_pg.MktSegment.id == segment_id,
            models_pg.MktSegment.company_id == current_user.company_id,
        )
    )
    seg = result.scalar_one_or_none()
    if not seg:
        raise HTTPException(404, "Segment not found")
    return seg

@router.put("/{segment_id}")
async def update_segment(segment_id: str, body: dict, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktSegment).where(
            models_pg.MktSegment.id == segment_id,
            models_pg.MktSegment.company_id == current_user.company_id,
        )
    )
    seg = result.scalar_one_or_none()
    if not seg:
        raise HTTPException(404, "Segment not found")
    if "name" in body:
        seg.name = body["name"]
    if "description" in body:
        seg.description = body["description"]
    if "rules" in body:
        seg.rules = body["rules"]
        customer_ids = await evaluate_segment(seg.rules, current_user.company_id, db)
        seg.estimated_count = len(customer_ids)
    await db.commit()
    await db.refresh(seg)
    return seg

@router.delete("/{segment_id}")
async def delete_segment(segment_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktSegment).where(
            models_pg.MktSegment.id == segment_id,
            models_pg.MktSegment.company_id == current_user.company_id,
        )
    )
    seg = result.scalar_one_or_none()
    if not seg:
        raise HTTPException(404, "Segment not found")
    await db.delete(seg)
    await db.commit()
    return {"ok": True}

@router.post("/{segment_id}/preview")
async def preview_segment(segment_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktSegment).where(
            models_pg.MktSegment.id == segment_id,
            models_pg.MktSegment.company_id == current_user.company_id,
        )
    )
    seg = result.scalar_one_or_none()
    if not seg:
        raise HTTPException(404, "Segment not found")
    customer_ids = await evaluate_segment(seg.rules, current_user.company_id, db)
    seg.estimated_count = len(customer_ids)
    await db.commit()
    return {"count": len(customer_ids), "customer_ids": customer_ids[:50]}
