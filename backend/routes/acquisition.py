"""
Acquisition module — social accounts, media assets, social posts, post metrics.
All routes at /api/acquisition/...
"""
from __future__ import annotations

import uuid
import re
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from database_pg import get_db
from routes.dependencies import get_current_user
from services.storage import StorageService
import models_pg

# ---------------------------------------------------------------------------
# Media validation rules
# ---------------------------------------------------------------------------
_IMAGE_MIMES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
_VIDEO_MIMES = {"video/mp4", "video/quicktime", "video/x-msvideo", "video/mpeg"}

# Max bytes per category per post kind
_KIND_RULES: dict[str, dict[str, int]] = {
    "feed":     {"image": 8 * 1024 * 1024,          "video": 100 * 1024 * 1024},
    "reel":     {                                     "video": 1024 * 1024 * 1024},
    "story":    {"image": 8 * 1024 * 1024,          "video": 100 * 1024 * 1024},
    "carousel": {"image": 8 * 1024 * 1024,          "video": 100 * 1024 * 1024},
}

def _media_category(mime: str) -> Optional[str]:
    if mime in _IMAGE_MIMES:
        return "image"
    if mime in _VIDEO_MIMES:
        return "video"
    return None

router = APIRouter(prefix="/acquisition", tags=["Acquisition"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ser_account(a: models_pg.SocialAccount) -> dict:
    return {
        "id": a.id,
        "platform": a.platform,
        "external_id": a.external_id,
        "handle": a.handle,
        "display_name": a.display_name,
        "scopes": a.scopes or [],
        "connected_by": a.connected_by,
        "status": a.status,
        "last_synced_at": a.last_synced_at,
        "created_at": a.created_at,
    }


def _ser_asset(a: models_pg.MediaAsset) -> dict:
    return {
        "id": a.id,
        "kind": a.kind,
        "storage_url": a.storage_url,
        "storage_backend": a.storage_backend or "local",
        "thumbnail_url": a.thumbnail_url,
        "file_size": a.file_size,
        "mime_type": a.mime_type,
        "duration_seconds": a.duration_seconds,
        "dimensions": a.dimensions,
        "alt_text": a.alt_text,
        "tags": a.tags or [],
        "used_in_post_ids": a.used_in_post_ids or [],
        "expires_at": a.expires_at,
        "created_at": a.created_at,
    }


def _ser_post(p: models_pg.SocialPost) -> dict:
    return {
        "id": p.id,
        "social_account_id": p.social_account_id,
        "kind": p.kind,
        "status": p.status,
        "scheduled_for": p.scheduled_for,
        "published_at": p.published_at,
        "caption": p.caption,
        "hashtags": p.hashtags or [],
        "media_asset_ids": p.media_asset_ids or [],
        "external_post_id": p.external_post_id,
        "external_permalink": p.external_permalink,
        "paid_partnership": p.paid_partnership,
        "publish_error": p.publish_error,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
    }


def _ser_metric(m: models_pg.PostMetric) -> dict:
    return {
        "id": m.id,
        "social_post_id": m.social_post_id,
        "captured_at": m.captured_at,
        "impressions": m.impressions,
        "reach": m.reach,
        "likes": m.likes,
        "comments": m.comments,
        "saves": m.saves,
        "shares": m.shares,
        "video_views": m.video_views,
        "video_completion_rate": m.video_completion_rate,
        "profile_visits": m.profile_visits,
        "follows_attributed": m.follows_attributed,
    }


# ---------------------------------------------------------------------------
# Social Accounts
# ---------------------------------------------------------------------------

class SocialAccountCreate(BaseModel):
    platform: str
    external_id: str
    handle: Optional[str] = None
    display_name: Optional[str] = None
    access_token_ref: Optional[str] = None
    refresh_token_ref: Optional[str] = None
    scopes: Optional[List[str]] = []


class SocialAccountUpdate(BaseModel):
    handle: Optional[str] = None
    display_name: Optional[str] = None
    access_token_ref: Optional[str] = None
    refresh_token_ref: Optional[str] = None
    status: Optional[str] = None


@router.get("/accounts")
async def list_accounts(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.SocialAccount).where(
            models_pg.SocialAccount.tenant_id == current_user.company_id
        ).order_by(models_pg.SocialAccount.created_at)
    )
    return [_ser_account(a) for a in result.scalars().all()]


@router.post("/accounts", status_code=201)
async def create_account(
    body: SocialAccountCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account = models_pg.SocialAccount(
        id=str(uuid.uuid4()),
        tenant_id=current_user.company_id,
        platform=body.platform,
        external_id=body.external_id,
        handle=body.handle,
        display_name=body.display_name,
        access_token_ref=body.access_token_ref,
        refresh_token_ref=body.refresh_token_ref,
        scopes=body.scopes or [],
        connected_by=current_user.id,
        status="active",
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return _ser_account(account)


@router.put("/accounts/{account_id}")
async def update_account(
    account_id: str,
    body: SocialAccountUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.SocialAccount).where(
            models_pg.SocialAccount.id == account_id,
            models_pg.SocialAccount.tenant_id == current_user.company_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Social account not found")
    if body.handle is not None:
        account.handle = body.handle
    if body.display_name is not None:
        account.display_name = body.display_name
    if body.access_token_ref is not None:
        account.access_token_ref = body.access_token_ref
    if body.refresh_token_ref is not None:
        account.refresh_token_ref = body.refresh_token_ref
    if body.status is not None:
        account.status = body.status
    await db.commit()
    await db.refresh(account)
    return _ser_account(account)


@router.delete("/accounts/{account_id}", status_code=204)
async def delete_account(
    account_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.SocialAccount).where(
            models_pg.SocialAccount.id == account_id,
            models_pg.SocialAccount.tenant_id == current_user.company_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Social account not found")
    await db.delete(account)
    await db.commit()


# ---------------------------------------------------------------------------
# Media Assets
# ---------------------------------------------------------------------------

class MediaAssetCreate(BaseModel):
    kind: str
    storage_url: str
    thumbnail_url: Optional[str] = None
    duration_seconds: Optional[float] = None
    dimensions: Optional[dict] = None
    alt_text: Optional[str] = None
    tags: Optional[List[str]] = []


class MediaAssetUpdate(BaseModel):
    alt_text: Optional[str] = None
    tags: Optional[List[str]] = None


@router.get("/media")
async def list_media(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.MediaAsset).where(
            models_pg.MediaAsset.tenant_id == current_user.company_id
        ).order_by(desc(models_pg.MediaAsset.created_at))
    )
    return [_ser_asset(a) for a in result.scalars().all()]


@router.post("/media", status_code=201)
async def create_media_asset(
    body: MediaAssetCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    asset = models_pg.MediaAsset(
        id=str(uuid.uuid4()),
        tenant_id=current_user.company_id,
        kind=body.kind,
        storage_url=body.storage_url,
        thumbnail_url=body.thumbnail_url,
        duration_seconds=body.duration_seconds,
        dimensions=body.dimensions,
        alt_text=body.alt_text,
        tags=body.tags or [],
        used_in_post_ids=[],
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return _ser_asset(asset)


@router.post("/media/upload", status_code=201)
async def upload_media_asset(
    file: UploadFile = File(...),
    kind: str = Form("feed"),
    alt_text: str = Form(""),
    tags: str = Form(""),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Multipart upload: validates, stores locally, returns a MediaAsset."""
    mime = (file.content_type or "").lower()
    category = _media_category(mime)
    if not category:
        raise HTTPException(
            400,
            f"Unsupported file type '{mime}'. Accepted: JPEG, PNG, WebP (images) or MP4, MOV (videos).",
        )

    rules = _KIND_RULES.get(kind, {})
    if category not in rules:
        accepted = " or ".join(rules.keys())
        raise HTTPException(400, f"Post type '{kind}' only accepts {accepted} files.")

    data = await file.read()
    max_bytes = rules[category]
    if len(data) > max_bytes:
        mb = max_bytes // (1024 * 1024)
        raise HTTPException(400, f"File too large ({len(data) // (1024*1024)} MB). Max {mb} MB for {kind} {category}.")

    asset_id = str(uuid.uuid4())
    original_name = file.filename or f"upload.{mime.split('/')[-1]}"
    sp = StorageService.storage_path(current_user.company_id, asset_id, original_name)
    StorageService.upload(data, sp)

    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)

    asset = models_pg.MediaAsset(
        id=asset_id,
        tenant_id=current_user.company_id,
        kind=category,
        storage_url=StorageService.public_url(sp),
        storage_path=sp,
        storage_backend="local",
        file_size=len(data),
        mime_type=mime,
        alt_text=alt_text or None,
        tags=tag_list,
        used_in_post_ids=[],
        expires_at=expires_at,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return _ser_asset(asset)


@router.put("/media/{asset_id}")
async def update_media_asset(
    asset_id: str,
    body: MediaAssetUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.MediaAsset).where(
            models_pg.MediaAsset.id == asset_id,
            models_pg.MediaAsset.tenant_id == current_user.company_id,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "Media asset not found")
    if body.alt_text is not None:
        asset.alt_text = body.alt_text
    if body.tags is not None:
        asset.tags = body.tags
    await db.commit()
    await db.refresh(asset)
    return _ser_asset(asset)


@router.delete("/media/{asset_id}", status_code=204)
async def delete_media_asset(
    asset_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.MediaAsset).where(
            models_pg.MediaAsset.id == asset_id,
            models_pg.MediaAsset.tenant_id == current_user.company_id,
        )
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(404, "Media asset not found")
    if asset.storage_path:
        StorageService.delete(asset.storage_path)
    await db.delete(asset)
    await db.commit()


# ---------------------------------------------------------------------------
# Social Posts
# ---------------------------------------------------------------------------

class SocialPostCreate(BaseModel):
    social_account_id: str
    kind: str
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = []
    media_asset_ids: Optional[List[str]] = []
    scheduled_for: Optional[datetime] = None
    paid_partnership: Optional[dict] = None


class SocialPostUpdate(BaseModel):
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = None
    media_asset_ids: Optional[List[str]] = None
    scheduled_for: Optional[datetime] = None
    status: Optional[str] = None
    paid_partnership: Optional[dict] = None


@router.get("/posts")
async def list_posts(
    account_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.SocialPost).where(
        models_pg.SocialPost.tenant_id == current_user.company_id
    )
    if account_id:
        stmt = stmt.where(models_pg.SocialPost.social_account_id == account_id)
    if status:
        stmt = stmt.where(models_pg.SocialPost.status == status)
    stmt = stmt.order_by(desc(models_pg.SocialPost.created_at))
    result = await db.execute(stmt)
    return [_ser_post(p) for p in result.scalars().all()]


@router.post("/posts", status_code=201)
async def create_post(
    body: SocialPostCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    account_result = await db.execute(
        select(models_pg.SocialAccount).where(
            models_pg.SocialAccount.id == body.social_account_id,
            models_pg.SocialAccount.tenant_id == current_user.company_id,
        )
    )
    if not account_result.scalar_one_or_none():
        raise HTTPException(404, "Social account not found")

    post = models_pg.SocialPost(
        id=str(uuid.uuid4()),
        tenant_id=current_user.company_id,
        social_account_id=body.social_account_id,
        kind=body.kind,
        status="scheduled" if body.scheduled_for else "draft",
        caption=body.caption,
        hashtags=body.hashtags or [],
        media_asset_ids=body.media_asset_ids or [],
        scheduled_for=body.scheduled_for,
        paid_partnership=body.paid_partnership,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return _ser_post(post)


@router.put("/posts/{post_id}")
async def update_post(
    post_id: str,
    body: SocialPostUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.SocialPost).where(
            models_pg.SocialPost.id == post_id,
            models_pg.SocialPost.tenant_id == current_user.company_id,
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(404, "Post not found")
    if body.caption is not None:
        post.caption = body.caption
    if body.hashtags is not None:
        post.hashtags = body.hashtags
    if body.media_asset_ids is not None:
        post.media_asset_ids = body.media_asset_ids
    if body.scheduled_for is not None:
        post.scheduled_for = body.scheduled_for
        if post.status == "draft":
            post.status = "scheduled"
    if body.status is not None:
        post.status = body.status
    if body.paid_partnership is not None:
        post.paid_partnership = body.paid_partnership
    post.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(post)
    return _ser_post(post)


@router.delete("/posts/{post_id}", status_code=204)
async def delete_post(
    post_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.SocialPost).where(
            models_pg.SocialPost.id == post_id,
            models_pg.SocialPost.tenant_id == current_user.company_id,
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(404, "Post not found")
    await db.delete(post)
    await db.commit()


@router.post("/posts/{post_id}/publish")
async def publish_post_now(
    post_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a post as publishing (actual IG API publish is async via background task)."""
    result = await db.execute(
        select(models_pg.SocialPost).where(
            models_pg.SocialPost.id == post_id,
            models_pg.SocialPost.tenant_id == current_user.company_id,
        )
    )
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(404, "Post not found")
    if post.status not in ("draft", "scheduled", "failed"):
        raise HTTPException(400, f"Cannot publish post in status '{post.status}'")
    post.status = "publishing"
    post.updated_at = datetime.now(timezone.utc)

    # Give Meta 7 days to fetch the media, then auto-purge
    if post.media_asset_ids:
        media_result = await db.execute(
            select(models_pg.MediaAsset).where(
                models_pg.MediaAsset.id.in_(post.media_asset_ids)
            )
        )
        purge_at = datetime.now(timezone.utc) + timedelta(days=7)
        for asset in media_result.scalars().all():
            asset.expires_at = purge_at

    await db.commit()
    return {"status": "publishing", "post_id": post_id}


# ---------------------------------------------------------------------------
# Post Metrics
# ---------------------------------------------------------------------------

class PostMetricCreate(BaseModel):
    impressions: Optional[int] = 0
    reach: Optional[int] = 0
    likes: Optional[int] = 0
    comments: Optional[int] = 0
    saves: Optional[int] = 0
    shares: Optional[int] = 0
    video_views: Optional[int] = 0
    video_completion_rate: Optional[float] = None
    profile_visits: Optional[int] = 0
    follows_attributed: Optional[int] = 0


@router.get("/posts/{post_id}/metrics")
async def get_post_metrics(
    post_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.PostMetric).where(
            models_pg.PostMetric.social_post_id == post_id,
            models_pg.PostMetric.tenant_id == current_user.company_id,
        ).order_by(desc(models_pg.PostMetric.captured_at))
    )
    return [_ser_metric(m) for m in result.scalars().all()]


@router.post("/posts/{post_id}/metrics", status_code=201)
async def record_post_metrics(
    post_id: str,
    body: PostMetricCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    metric = models_pg.PostMetric(
        id=str(uuid.uuid4()),
        social_post_id=post_id,
        tenant_id=current_user.company_id,
        impressions=body.impressions or 0,
        reach=body.reach or 0,
        likes=body.likes or 0,
        comments=body.comments or 0,
        saves=body.saves or 0,
        shares=body.shares or 0,
        video_views=body.video_views or 0,
        video_completion_rate=body.video_completion_rate,
        profile_visits=body.profile_visits or 0,
        follows_attributed=body.follows_attributed or 0,
    )
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    return _ser_metric(metric)


# ---------------------------------------------------------------------------
# Attribution Links
# ---------------------------------------------------------------------------

class AttributionLinkCreate(BaseModel):
    target_url: str
    source_post_id: Optional[str] = None
    source_lead_flow_id: Optional[str] = None
    slug: Optional[str] = None


def _ser_link(l: models_pg.AttributionLink) -> dict:
    return {
        "id": l.id,
        "slug": l.slug,
        "target_url": l.target_url,
        "source_post_id": l.source_post_id,
        "source_lead_flow_id": l.source_lead_flow_id,
        "total_clicks": l.total_clicks,
        "unique_clicks": l.unique_clicks,
        "created_at": l.created_at,
    }


@router.get("/links")
async def list_links(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.AttributionLink).where(
            models_pg.AttributionLink.tenant_id == current_user.company_id
        ).order_by(desc(models_pg.AttributionLink.created_at))
    )
    return [_ser_link(l) for l in result.scalars().all()]


@router.post("/links", status_code=201)
async def create_link(
    body: AttributionLinkCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    slug = body.slug or str(uuid.uuid4())[:8]
    link = models_pg.AttributionLink(
        id=str(uuid.uuid4()),
        tenant_id=current_user.company_id,
        slug=slug,
        target_url=body.target_url,
        source_post_id=body.source_post_id,
        source_lead_flow_id=body.source_lead_flow_id,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return _ser_link(link)


@router.get("/go/{slug}")
async def redirect_attribution_link(slug: str, db: AsyncSession = Depends(get_db)):
    """Public redirect endpoint — increments click count and redirects."""
    result = await db.execute(
        select(models_pg.AttributionLink).where(models_pg.AttributionLink.slug == slug)
    )
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(404, "Link not found")
    link.total_clicks = (link.total_clicks or 0) + 1
    link.unique_clicks = (link.unique_clicks or 0) + 1
    await db.commit()
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=link.target_url, status_code=302)
