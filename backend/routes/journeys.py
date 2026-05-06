from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database_pg import get_db
from routes.dependencies import get_current_user
import models_pg
from datetime import datetime, timezone

router = APIRouter(prefix="/marketing/journeys", tags=["Marketing - Journeys"])

@router.get("")
async def list_journeys(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktJourney)
        .where(models_pg.MktJourney.company_id == current_user.company_id)
        .order_by(models_pg.MktJourney.created_at.desc())
    )
    return result.scalars().all()

@router.post("")
async def create_journey(body: dict, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    journey = models_pg.MktJourney(
        company_id=current_user.company_id,
        name=body["name"],
        description=body.get("description"),
        trigger_type=body.get("trigger_type", "manual"),
        trigger_config=body.get("trigger_config", {}),
        dag=body.get("dag", {"nodes": [], "edges": []}),
        is_active=False,
    )
    db.add(journey)
    await db.commit()
    await db.refresh(journey)
    return journey

@router.get("/{journey_id}")
async def get_journey(journey_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktJourney).where(
            models_pg.MktJourney.id == journey_id,
            models_pg.MktJourney.company_id == current_user.company_id,
        )
    )
    j = result.scalar_one_or_none()
    if not j:
        raise HTTPException(404, "Journey not found")
    return j

@router.put("/{journey_id}")
async def update_journey(journey_id: str, body: dict, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktJourney).where(
            models_pg.MktJourney.id == journey_id,
            models_pg.MktJourney.company_id == current_user.company_id,
        )
    )
    j = result.scalar_one_or_none()
    if not j:
        raise HTTPException(404, "Journey not found")
    for field in ["name", "description", "trigger_type", "trigger_config", "dag"]:
        if field in body:
            setattr(j, field, body[field])
    await db.commit()
    await db.refresh(j)
    return j

@router.delete("/{journey_id}")
async def delete_journey(journey_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktJourney).where(
            models_pg.MktJourney.id == journey_id,
            models_pg.MktJourney.company_id == current_user.company_id,
        )
    )
    j = result.scalar_one_or_none()
    if not j:
        raise HTTPException(404, "Journey not found")
    await db.delete(j)
    await db.commit()
    return {"ok": True}

@router.put("/{journey_id}/toggle")
async def toggle_active(journey_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktJourney).where(
            models_pg.MktJourney.id == journey_id,
            models_pg.MktJourney.company_id == current_user.company_id,
        )
    )
    j = result.scalar_one_or_none()
    if not j:
        raise HTTPException(404, "Journey not found")
    j.is_active = not j.is_active
    await db.commit()
    await db.refresh(j)
    return j

@router.post("/{journey_id}/enroll/{customer_id}")
async def enroll_customer(journey_id: str, customer_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    j_result = await db.execute(
        select(models_pg.MktJourney).where(
            models_pg.MktJourney.id == journey_id,
            models_pg.MktJourney.company_id == current_user.company_id,
        )
    )
    j = j_result.scalar_one_or_none()
    if not j:
        raise HTTPException(404, "Journey not found")
    # Get first non-trigger node id
    dag = j.dag or {}
    nodes = dag.get("nodes", [])
    first_node_id = nodes[0]["id"] if nodes else "start"
    enrollment = models_pg.MktJourneyEnrollment(
        journey_id=journey_id,
        customer_id=customer_id,
        current_node_id=first_node_id,
        status="active",
    )
    db.add(enrollment)
    await db.commit()
    await db.refresh(enrollment)
    return enrollment

@router.get("/{journey_id}/enrollments")
async def list_enrollments(journey_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    j_result = await db.execute(
        select(models_pg.MktJourney).where(
            models_pg.MktJourney.id == journey_id,
            models_pg.MktJourney.company_id == current_user.company_id,
        )
    )
    if not j_result.scalar_one_or_none():
        raise HTTPException(404, "Journey not found")
    result = await db.execute(
        select(models_pg.MktJourneyEnrollment)
        .where(models_pg.MktJourneyEnrollment.journey_id == journey_id)
        .order_by(models_pg.MktJourneyEnrollment.enrolled_at.desc())
    )
    return result.scalars().all()

@router.get("/enrollments/{enrollment_id}/logs")
async def get_step_logs(enrollment_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktJourneyStepLog)
        .where(models_pg.MktJourneyStepLog.enrollment_id == enrollment_id)
        .order_by(models_pg.MktJourneyStepLog.executed_at.asc())
    )
    return result.scalars().all()
