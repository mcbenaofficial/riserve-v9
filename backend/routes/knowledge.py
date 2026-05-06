from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from database_pg import get_db
from routes.dependencies import get_current_user
import models_pg
from knowledge.schema import KnowledgeSourceType
from knowledge.ingestion import ingest_source
from knowledge.retriever import search_kb

router = APIRouter(prefix="/knowledge", tags=["Knowledge"])


class KnowledgeSourceCreate(BaseModel):
    type: str
    source_ref: Optional[str] = None


class ContentItem(BaseModel):
    text: str
    metadata: dict = {}


class BrandVoiceUpsert(BaseModel):
    tone: Optional[str] = None
    do_phrases: Optional[List[str]] = None
    dont_phrases: Optional[List[str]] = None
    required_disclosures: Optional[List[str]] = None
    example_messages: Optional[List[str]] = None


@router.post("/sources")
async def create_knowledge_source(
    body: KnowledgeSourceCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    source = models_pg.KnowledgeSource(
        id=str(uuid.uuid4()),
        tenant_id=current_user.company_id,
        type=body.type,
        source_ref=body.source_ref,
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    return {
        "id": source.id,
        "tenant_id": source.tenant_id,
        "type": source.type,
        "source_ref": source.source_ref,
        "status": source.status,
        "created_at": source.created_at,
    }


@router.get("/sources")
async def list_knowledge_sources(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.KnowledgeSource).where(
            models_pg.KnowledgeSource.tenant_id == current_user.company_id
        )
    )
    sources = result.scalars().all()
    return [
        {
            "id": s.id,
            "type": s.type,
            "source_ref": s.source_ref,
            "status": s.status,
            "last_synced_at": s.last_synced_at,
            "created_at": s.created_at,
        }
        for s in sources
    ]


async def _run_ingestion(
    tenant_id: str,
    source_id: str,
    source_type: str,
    items: list,
) -> None:
    try:
        ks_type = KnowledgeSourceType(source_type)
    except ValueError:
        ks_type = KnowledgeSourceType.FAQS
    await ingest_source(
        tenant_id=tenant_id,
        source_id=source_id,
        source_type=ks_type,
        content_items=items,
    )


@router.post("/sources/{source_id}/ingest")
async def trigger_ingestion(
    source_id: str,
    items: List[ContentItem],
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.KnowledgeSource).where(
            models_pg.KnowledgeSource.id == source_id,
            models_pg.KnowledgeSource.tenant_id == current_user.company_id,
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Knowledge source not found")

    background_tasks.add_task(
        _run_ingestion,
        tenant_id=current_user.company_id,
        source_id=source_id,
        source_type=source.type,
        items=[item.dict() for item in items],
    )
    return {"status": "ingestion_started", "source_id": source_id}


@router.get("/search")
async def search_knowledge(
    q: str,
    source_types: Optional[str] = None,
    top_k: int = 5,
    current_user=Depends(get_current_user),
):
    types_list = None
    if source_types:
        types_list = [t.strip() for t in source_types.split(",") if t.strip()]

    chunks = await search_kb(
        tenant_id=current_user.company_id,
        query=q,
        source_types=types_list,
        top_k=top_k,
    )
    return [
        {
            "chunk_id": c.chunk_id,
            "content": c.content,
            "source_type": c.source_type,
            "metadata": c.metadata,
            "similarity": c.similarity,
        }
        for c in chunks
    ]


@router.get("/brand-voice")
async def get_brand_voice(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.BrandVoiceProfile).where(
            models_pg.BrandVoiceProfile.tenant_id == current_user.company_id
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Brand voice profile not found")
    return {
        "id": profile.id,
        "tenant_id": profile.tenant_id,
        "tone": profile.tone,
        "do_phrases": profile.do_phrases,
        "dont_phrases": profile.dont_phrases,
        "required_disclosures": profile.required_disclosures,
        "example_messages": profile.example_messages,
        "updated_at": profile.updated_at,
    }


@router.put("/brand-voice")
async def upsert_brand_voice(
    body: BrandVoiceUpsert,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.BrandVoiceProfile).where(
            models_pg.BrandVoiceProfile.tenant_id == current_user.company_id
        )
    )
    profile = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if profile is None:
        profile = models_pg.BrandVoiceProfile(
            id=str(uuid.uuid4()),
            tenant_id=current_user.company_id,
            tone=body.tone or "warm",
            do_phrases=body.do_phrases or [],
            dont_phrases=body.dont_phrases or [],
            required_disclosures=body.required_disclosures or [],
            example_messages=body.example_messages or [],
            updated_at=now,
        )
        db.add(profile)
    else:
        if body.tone is not None:
            profile.tone = body.tone
        if body.do_phrases is not None:
            profile.do_phrases = body.do_phrases
        if body.dont_phrases is not None:
            profile.dont_phrases = body.dont_phrases
        if body.required_disclosures is not None:
            profile.required_disclosures = body.required_disclosures
        if body.example_messages is not None:
            profile.example_messages = body.example_messages
        profile.updated_at = now

    await db.commit()
    await db.refresh(profile)
    return {
        "id": profile.id,
        "tenant_id": profile.tenant_id,
        "tone": profile.tone,
        "do_phrases": profile.do_phrases,
        "dont_phrases": profile.dont_phrases,
        "required_disclosures": profile.required_disclosures,
        "example_messages": profile.example_messages,
        "updated_at": profile.updated_at,
    }
