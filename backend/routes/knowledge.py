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


class AgentConfigCreate(BaseModel):
    agent_name: str
    model: Optional[str] = "gpt-4o-mini"
    allowed_tools: Optional[List[str]] = []
    autonomy_level: Optional[str] = "L1"
    confidence_threshold: Optional[float] = 0.75
    is_active: Optional[bool] = True


class AgentConfigUpdate(BaseModel):
    agent_name: Optional[str] = None
    model: Optional[str] = None
    allowed_tools: Optional[List[str]] = None
    autonomy_level: Optional[str] = None
    confidence_threshold: Optional[float] = None
    is_active: Optional[bool] = None


def _serialize_agent_config(c):
    return {
        "id": c.id,
        "agent_name": c.agent_name,
        "model": c.model,
        "allowed_tools": c.allowed_tools if isinstance(c.allowed_tools, list) else [],
        "autonomy_level": c.autonomy_level,
        "confidence_threshold": c.confidence_threshold,
        "is_active": c.is_active,
        "created_at": c.created_at,
    }


@router.get("/agent-config")
async def list_agent_configs(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.AgentConfig)
        .where(models_pg.AgentConfig.tenant_id == current_user.company_id)
        .order_by(models_pg.AgentConfig.created_at)
    )
    return [_serialize_agent_config(c) for c in result.scalars().all()]


@router.post("/agent-config", status_code=201)
async def create_agent_config(
    body: AgentConfigCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = models_pg.AgentConfig(
        id=str(uuid.uuid4()),
        tenant_id=current_user.company_id,
        agent_name=body.agent_name,
        model=body.model or "gpt-4o-mini",
        allowed_tools=body.allowed_tools or [],
        autonomy_level=body.autonomy_level or "L1",
        confidence_threshold=body.confidence_threshold if body.confidence_threshold is not None else 0.75,
        is_active=body.is_active if body.is_active is not None else True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return _serialize_agent_config(config)


@router.put("/agent-config/{config_id}")
async def update_agent_config(
    config_id: str,
    body: AgentConfigUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.AgentConfig).where(
            models_pg.AgentConfig.id == config_id,
            models_pg.AgentConfig.tenant_id == current_user.company_id,
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Agent config not found")

    if body.agent_name is not None:
        config.agent_name = body.agent_name
    if body.model is not None:
        config.model = body.model
    if body.allowed_tools is not None:
        config.allowed_tools = body.allowed_tools
    if body.autonomy_level is not None:
        config.autonomy_level = body.autonomy_level
    if body.confidence_threshold is not None:
        config.confidence_threshold = body.confidence_threshold
    if body.is_active is not None:
        config.is_active = body.is_active

    await db.commit()
    await db.refresh(config)
    return _serialize_agent_config(config)


@router.delete("/agent-config/{config_id}", status_code=204)
async def delete_agent_config(
    config_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.AgentConfig).where(
            models_pg.AgentConfig.id == config_id,
            models_pg.AgentConfig.tenant_id == current_user.company_id,
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Agent config not found")
    await db.delete(config)
    await db.commit()


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
