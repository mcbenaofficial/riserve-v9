"""PetPooja POS integration routes.

Handles credential storage, connection testing, menu/order sync,
webhook ingestion, sync log retrieval, and background polling
for the PetPooja partner POS system.
All data is scoped by company_id. Outlet-level config is 1:1 with outlets.
"""

import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

import models_pg
from database_pg import AsyncSessionLocal
from .dependencies import get_db, get_current_user, require_manager_or_admin, User

router = APIRouter(prefix="/petpooja", tags=["PetPooja"])
log = logging.getLogger(__name__)

# ── Order state map ───────────────────────────────────────────────────────────

_PP_STATE_MAP = {
    "placed": "PLACED",
    "kotted": "KOT_FIRED",
    "kot_fired": "KOT_FIRED",
    "prepared": "PREPARED",
    "served": "SERVED",
    "settled": "SETTLED",
    "cancelled": "CANCELLED",
    "canceled": "CANCELLED",
}

_STATE_ORDER = ["PLACED", "KOT_FIRED", "PREPARED", "SERVED", "SETTLED", "CANCELLED"]

_SYNC_BATCH_SIZE = 100


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class PetPoojaConfigIn(BaseModel):
    app_key: Optional[str] = None
    app_secret: Optional[str] = None
    access_token: Optional[str] = None
    pos_restaurant_id: Optional[str] = None
    base_url: Optional[str] = "https://api.petpooja.com"
    sync_enabled: bool = False
    sync_orders: bool = True
    sync_menu: bool = True
    poll_interval_seconds: int = 30


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe_decimal(val, field: str, order_id: str) -> Decimal:
    try:
        return Decimal(str(val))
    except (InvalidOperation, TypeError):
        raise HTTPException(400, detail=f"Non-numeric value in field '{field}' for order {order_id}")


def _fingerprint(order: dict) -> str:
    parts = "|".join(str(order.get(k, "")) for k in [
        "orderid", "order_status", "order_status_log_id",
        "sub_total", "tax", "discount", "grand_total", "last_updated",
    ])
    return hashlib.sha256(parts.encode()).hexdigest()


def _is_sensitive_cred(val: Optional[str]) -> bool:
    """True if the value is blank, the masked sentinel, or None — don't overwrite."""
    return not val or not val.strip() or val == "••••••"


def _serialize_config(c: models_pg.PetPoojaConfig) -> dict:
    return {
        "id": c.id,
        "outlet_id": c.outlet_id,
        # app_key is a non-secret identifier — returned in plaintext
        "app_key": c.app_key,
        # Sensitive fields: indicate presence only, never return the value
        "app_secret": "••••••" if c.app_secret else None,
        "access_token": "••••••" if c.access_token else None,
        "pos_restaurant_id": c.pos_restaurant_id,
        "base_url": c.base_url,
        "sync_enabled": c.sync_enabled,
        "sync_orders": c.sync_orders,
        "sync_menu": c.sync_menu,
        "poll_interval_seconds": c.poll_interval_seconds,
        "last_order_state_version": c.last_order_state_version,
        "last_menu_sync_at": c.last_menu_sync_at.isoformat() if c.last_menu_sync_at else None,
        "last_order_sync_at": c.last_order_sync_at.isoformat() if c.last_order_sync_at else None,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _serialize_log(l: models_pg.PetPoojaSyncLog) -> dict:
    duration_s = None
    if l.started_at and l.completed_at:
        duration_s = round((l.completed_at - l.started_at).total_seconds(), 1)
    return {
        "id": l.id,
        "outlet_id": l.outlet_id,
        "sync_type": l.sync_type,
        "status": l.status,
        "items_processed": l.items_processed,
        "items_upserted": l.items_upserted,
        "items_skipped": l.items_skipped,
        "error": l.error,
        "started_at": l.started_at.isoformat() if l.started_at else None,
        "completed_at": l.completed_at.isoformat() if l.completed_at else None,
        "duration_s": duration_s,
    }


def _serialize_order(o: models_pg.PetPoojaOrder) -> dict:
    return {
        "id": o.id,
        "external_id": o.external_id,
        "outlet_id": o.outlet_id,
        "state": o.state,
        "state_version": o.state_version,
        "table_external_id": o.table_external_id,
        "sub_total": str(o.sub_total),
        "tax_total": str(o.tax_total),
        "discount_total": str(o.discount_total),
        "grand_total": str(o.grand_total),
        "placed_at": o.placed_at.isoformat() if o.placed_at else None,
        "last_updated_at": o.last_updated_at.isoformat() if o.last_updated_at else None,
        "items": [
            {
                "id": i.id,
                "external_id": i.external_id,
                "name": i.name,
                "quantity": i.quantity,
                "unit_price": str(i.unit_price),
                "line_total": str(i.line_total),
                "notes": i.notes,
            }
            for i in (o.items or [])
        ],
    }


def _serialize_menu_item(m: models_pg.PetPoojaMenuItem) -> dict:
    return {
        "id": m.id,
        "external_id": m.external_id,
        "outlet_id": m.outlet_id,
        "name": m.name,
        "description": m.description,
        "price": str(m.price),
        "category_name": m.category_name,
        "item_type": m.item_type,
        "is_active": m.is_active,
        "synced_at": m.synced_at.isoformat() if m.synced_at else None,
        "updated_at": m.updated_at.isoformat() if hasattr(m, "updated_at") and m.updated_at else None,
    }


# ── Shared order-processing core ──────────────────────────────────────────────

async def _process_order_batch(
    db: AsyncSession,
    cfg: models_pg.PetPoojaConfig,
    raw_orders: list,
    company_id: str,
) -> dict:
    """
    Idempotently upsert a batch of raw PetPooja order dicts into the canonical store.
    Returns counts and the max state_version seen.
    """
    raw_orders = sorted(raw_orders, key=lambda o: int(o.get("order_status_log_id", 0)))
    upserted = skipped = 0
    max_version = cfg.last_order_state_version

    for raw in raw_orders:
        ext_id = str(raw.get("orderid", ""))
        if not ext_id:
            skipped += 1
            continue

        incoming_version = int(raw.get("order_status_log_id", 0))
        pp_state = raw.get("order_status", "").lower()
        canonical_state = _PP_STATE_MAP.get(pp_state)
        if not canonical_state:
            log.warning("Unknown PetPooja order_status=%r for order %s — skipping", pp_state, ext_id)
            skipped += 1
            continue

        fp = _fingerprint(raw)

        existing_res = await db.execute(
            select(models_pg.PetPoojaOrder).where(
                models_pg.PetPoojaOrder.outlet_id == cfg.outlet_id,
                models_pg.PetPoojaOrder.external_id == ext_id,
            )
        )
        order = existing_res.scalar_one_or_none()

        if order:
            if order.state_version >= incoming_version:
                # Stale — already at this version or newer
                max_version = max(max_version, incoming_version)
                skipped += 1
                continue
            if order.source_fingerprint == fp:
                # Identical payload re-arrived — idempotent no-op
                max_version = max(max_version, incoming_version)
                skipped += 1
                continue

        if not order:
            order = models_pg.PetPoojaOrder(
                company_id=company_id,
                outlet_id=cfg.outlet_id,
                external_id=ext_id,
            )
            db.add(order)

        order.state = canonical_state
        order.state_version = incoming_version
        order.table_external_id = raw.get("tableid") or None
        order.sub_total = _safe_decimal(raw.get("sub_total", 0), "sub_total", ext_id)
        order.tax_total = _safe_decimal(raw.get("tax", 0), "tax", ext_id)
        order.discount_total = _safe_decimal(raw.get("discount", 0), "discount", ext_id)
        order.grand_total = _safe_decimal(raw.get("grand_total", 0), "grand_total", ext_id)
        order.source_fingerprint = fp
        order.raw_payload = raw
        order.updated_at = datetime.now(timezone.utc)

        raw_ts = raw.get("date") or raw.get("created_on")
        if raw_ts:
            try:
                order.placed_at = datetime.fromisoformat(raw_ts.replace(" ", "T"))
            except (ValueError, AttributeError):
                pass
        order.last_updated_at = datetime.now(timezone.utc)

        await db.flush()

        # Replace line items (delete-and-insert; pre-KOT edits do happen)
        await db.execute(
            delete(models_pg.PetPoojaOrderItem).where(
                models_pg.PetPoojaOrderItem.order_id == order.id
            )
        )
        for raw_item in raw.get("items", []):
            qty = int(raw_item.get("quantity", 1))
            unit_price = _safe_decimal(raw_item.get("price", 0), "item.price", ext_id)
            db.add(models_pg.PetPoojaOrderItem(
                order_id=order.id,
                external_id=str(raw_item.get("itemid", "")),
                name=raw_item.get("itemname", ""),
                quantity=qty,
                unit_price=unit_price,
                # Decimal arithmetic — no float intermediary
                line_total=unit_price * Decimal(qty),
                notes=raw_item.get("note") or None,
            ))

        upserted += 1
        max_version = max(max_version, incoming_version)

    return {"upserted": upserted, "skipped": skipped, "max_version": max_version}


async def _fetch_and_sync_orders(db: AsyncSession, cfg: models_pg.PetPoojaConfig, company_id: str) -> dict:
    """
    Pull one batch of orders from PetPooja and process them.
    Drains up to _SYNC_BATCH_SIZE changes per call; advances the cursor after commit.
    """
    base = (cfg.base_url or "https://api.petpooja.com").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{base}/external/orders_changed_since",
                # PetPooja partner API expects form-encoded body
                data={
                    "app_key": cfg.app_key,
                    "app_secret": cfg.app_secret,
                    "access_token": cfg.access_token,
                    "restID": cfg.pos_restaurant_id,
                    "min_state_version": str(cfg.last_order_state_version),
                    "limit": str(_SYNC_BATCH_SIZE),
                },
            )
        r.raise_for_status()
        data = r.json()
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:500]}

    raw_orders = data.get("orders", [])
    result = await _process_order_batch(db, cfg, raw_orders, company_id)

    # Advance cursor only after successful processing
    max_v = result["max_version"]
    cfg.last_order_state_version = max_v + 1 if max_v > 0 else 0
    cfg.last_order_sync_at = datetime.now(timezone.utc)
    cfg.updated_at = datetime.now(timezone.utc)

    return {
        "ok": True,
        "orders_upserted": result["upserted"],
        "orders_skipped": result["skipped"],
        "raw_count": len(raw_orders),
    }


# ── Config endpoints ──────────────────────────────────────────────────────────

@router.get("/config")
async def list_configs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return PetPooja configs for all outlets belonging to this company."""
    stmt = select(models_pg.PetPoojaConfig).where(
        models_pg.PetPoojaConfig.company_id == current_user.company_id
    )
    res = await db.execute(stmt)
    return [_serialize_config(c) for c in res.scalars().all()]


@router.get("/config/{outlet_id}")
async def get_config(
    outlet_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.PetPoojaConfig).where(
        models_pg.PetPoojaConfig.outlet_id == outlet_id,
        models_pg.PetPoojaConfig.company_id == current_user.company_id,
    )
    res = await db.execute(stmt)
    cfg = res.scalar_one_or_none()
    if not cfg:
        return {"outlet_id": outlet_id, "status": "not_configured"}
    return _serialize_config(cfg)


@router.put("/config/{outlet_id}")
async def upsert_config(
    outlet_id: str,
    payload: PetPoojaConfigIn,
    current_user: User = Depends(require_manager_or_admin),
    db: AsyncSession = Depends(get_db),
):
    # Verify the outlet belongs to this company before creating any record
    outlet_res = await db.execute(
        select(models_pg.Outlet).where(
            models_pg.Outlet.id == outlet_id,
            models_pg.Outlet.company_id == current_user.company_id,
        )
    )
    if not outlet_res.scalar_one_or_none():
        raise HTTPException(404, detail="Outlet not found.")

    stmt = select(models_pg.PetPoojaConfig).where(
        models_pg.PetPoojaConfig.outlet_id == outlet_id,
        models_pg.PetPoojaConfig.company_id == current_user.company_id,
    )
    res = await db.execute(stmt)
    cfg = res.scalar_one_or_none()

    if not cfg:
        cfg = models_pg.PetPoojaConfig(
            company_id=current_user.company_id,
            outlet_id=outlet_id,
        )
        db.add(cfg)

    # app_key is non-sensitive; reject empty strings to avoid overwriting valid key
    if payload.app_key and payload.app_key.strip():
        cfg.app_key = payload.app_key.strip()
    if not _is_sensitive_cred(payload.app_secret):
        cfg.app_secret = payload.app_secret
    if not _is_sensitive_cred(payload.access_token):
        cfg.access_token = payload.access_token
    if payload.pos_restaurant_id is not None:
        cfg.pos_restaurant_id = payload.pos_restaurant_id
    if payload.base_url and payload.base_url.strip():
        cfg.base_url = payload.base_url.strip()

    cfg.sync_enabled = payload.sync_enabled
    cfg.sync_orders = payload.sync_orders
    cfg.sync_menu = payload.sync_menu
    cfg.poll_interval_seconds = max(10, payload.poll_interval_seconds)
    cfg.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(cfg)
    return _serialize_config(cfg)


@router.delete("/config/{outlet_id}", status_code=204)
async def delete_config(
    outlet_id: str,
    current_user: User = Depends(require_manager_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove PetPooja credentials and all synced data for this outlet."""
    stmt = select(models_pg.PetPoojaConfig).where(
        models_pg.PetPoojaConfig.outlet_id == outlet_id,
        models_pg.PetPoojaConfig.company_id == current_user.company_id,
    )
    res = await db.execute(stmt)
    cfg = res.scalar_one_or_none()
    if not cfg:
        raise HTTPException(404, detail="No PetPooja config found for this outlet.")
    await db.delete(cfg)
    await db.commit()


# ── Connection test ───────────────────────────────────────────────────────────

@router.post("/test/{outlet_id}")
async def test_connection(
    outlet_id: str,
    current_user: User = Depends(require_manager_or_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.PetPoojaConfig).where(
        models_pg.PetPoojaConfig.outlet_id == outlet_id,
        models_pg.PetPoojaConfig.company_id == current_user.company_id,
    )
    res = await db.execute(stmt)
    cfg = res.scalar_one_or_none()

    if not cfg or not all([cfg.app_key, cfg.app_secret, cfg.access_token, cfg.pos_restaurant_id]):
        raise HTTPException(400, detail="Credentials incomplete. Fill in all fields before testing.")

    base = (cfg.base_url or "https://api.petpooja.com").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"{base}/external/restaurant/restaurantDetails",
                data={
                    "app_key": cfg.app_key,
                    "app_secret": cfg.app_secret,
                    "access_token": cfg.access_token,
                    "restID": cfg.pos_restaurant_id,
                },
            )
        ok = r.status_code == 200
        cfg.status = "connected" if ok else "error"
        cfg.updated_at = datetime.now(timezone.utc)
        await db.commit()
        if ok:
            return {"ok": True, "message": "Connection successful"}
        return {"ok": False, "message": f"PetPooja returned HTTP {r.status_code}", "detail": r.text[:300]}
    except httpx.ConnectError:
        cfg.status = "error"
        cfg.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return {"ok": False, "message": f"Could not reach {base}. Check the base URL."}
    except httpx.TimeoutException:
        cfg.status = "error"
        cfg.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return {"ok": False, "message": "Request timed out after 10 seconds."}


# ── Menu sync ─────────────────────────────────────────────────────────────────

@router.post("/sync/menu/{outlet_id}")
async def sync_menu(
    outlet_id: str,
    current_user: User = Depends(require_manager_or_admin),
    db: AsyncSession = Depends(get_db),
):
    # Concurrency guard: skip_locked means a second simultaneous request returns
    # immediately rather than waiting and double-processing.
    stmt = (
        select(models_pg.PetPoojaConfig)
        .where(
            models_pg.PetPoojaConfig.outlet_id == outlet_id,
            models_pg.PetPoojaConfig.company_id == current_user.company_id,
        )
        .with_for_update(skip_locked=True)
    )
    res = await db.execute(stmt)
    cfg = res.scalar_one_or_none()

    if not cfg:
        raise HTTPException(409, detail="A menu sync is already running for this outlet, or no config exists.")
    if not all([cfg.app_key, cfg.app_secret, cfg.access_token, cfg.pos_restaurant_id]):
        raise HTTPException(400, detail="Credentials not configured for this outlet.")

    log_row = models_pg.PetPoojaSyncLog(
        company_id=current_user.company_id,
        outlet_id=outlet_id,
        sync_type="menu",
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.add(log_row)
    await db.flush()

    base = (cfg.base_url or "https://api.petpooja.com").rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                f"{base}/external/restaurant/restaurantDetails",
                data={
                    "app_key": cfg.app_key,
                    "app_secret": cfg.app_secret,
                    "access_token": cfg.access_token,
                    "restID": cfg.pos_restaurant_id,
                },
            )
        r.raise_for_status()
        data = r.json()
    except Exception as exc:
        log_row.status = "failed"
        log_row.error = str(exc)[:1000]
        log_row.completed_at = datetime.now(timezone.utc)
        await db.commit()
        return {"ok": False, "error": str(exc)[:300]}

    # Flatten categories → items
    raw_items = []
    for cat in (data.get("restaurantDetails", {}).get("menu", {}).get("categories", [])):
        cat_name = cat.get("category_name", "")
        for item in cat.get("items", []):
            item["_category_name"] = cat_name
            raw_items.append(item)

    seen_ext_ids: set[str] = set()
    upserted = skipped = 0
    now = datetime.now(timezone.utc)

    for raw in raw_items:
        ext_id = str(raw.get("itemid", ""))
        if not ext_id:
            skipped += 1
            continue
        seen_ext_ids.add(ext_id)

        existing_res = await db.execute(
            select(models_pg.PetPoojaMenuItem).where(
                models_pg.PetPoojaMenuItem.outlet_id == outlet_id,
                models_pg.PetPoojaMenuItem.external_id == ext_id,
            )
        )
        mi = existing_res.scalar_one_or_none()

        try:
            price = Decimal(str(raw.get("price", 0)))
        except InvalidOperation:
            price = Decimal("0")

        if not mi:
            mi = models_pg.PetPoojaMenuItem(
                company_id=current_user.company_id,
                outlet_id=outlet_id,
                external_id=ext_id,
            )
            db.add(mi)

        mi.name = raw.get("itemname", ext_id)
        mi.description = raw.get("item_description") or None
        mi.price = price
        mi.category_name = raw.get("_category_name") or None
        mi.item_type = raw.get("item_type") or None
        mi.is_active = str(raw.get("active", "1")) == "1"
        mi.raw_payload = raw
        mi.synced_at = now
        if hasattr(mi, "updated_at"):
            mi.updated_at = now
        upserted += 1

    # Deactivate items that were present before but absent from this sync
    if seen_ext_ids:
        all_res = await db.execute(
            select(models_pg.PetPoojaMenuItem).where(
                models_pg.PetPoojaMenuItem.outlet_id == outlet_id,
                models_pg.PetPoojaMenuItem.is_active == True,  # noqa: E712
            )
        )
        for stale in all_res.scalars().all():
            if stale.external_id not in seen_ext_ids:
                stale.is_active = False
                if hasattr(stale, "updated_at"):
                    stale.updated_at = now

    cfg.last_menu_sync_at = now
    cfg.updated_at = now

    log_row.status = "success"
    log_row.items_processed = len(raw_items)
    log_row.items_upserted = upserted
    log_row.items_skipped = skipped
    log_row.completed_at = now

    await db.commit()
    return {"ok": True, "items_upserted": upserted, "items_skipped": skipped}


# ── Order sync ────────────────────────────────────────────────────────────────

@router.post("/sync/orders/{outlet_id}")
async def sync_orders(
    outlet_id: str,
    current_user: User = Depends(require_manager_or_admin),
    db: AsyncSession = Depends(get_db),
):
    # Concurrency guard — skip_locked prevents double-processing
    stmt = (
        select(models_pg.PetPoojaConfig)
        .where(
            models_pg.PetPoojaConfig.outlet_id == outlet_id,
            models_pg.PetPoojaConfig.company_id == current_user.company_id,
        )
        .with_for_update(skip_locked=True)
    )
    res = await db.execute(stmt)
    cfg = res.scalar_one_or_none()

    if not cfg:
        raise HTTPException(409, detail="An order sync is already running for this outlet, or no config exists.")
    if not all([cfg.app_key, cfg.app_secret, cfg.access_token, cfg.pos_restaurant_id]):
        raise HTTPException(400, detail="Credentials not configured for this outlet.")

    log_row = models_pg.PetPoojaSyncLog(
        company_id=current_user.company_id,
        outlet_id=outlet_id,
        sync_type="orders",
        status="running",
        started_at=datetime.now(timezone.utc),
    )
    db.add(log_row)
    await db.flush()

    result = await _fetch_and_sync_orders(db, cfg, current_user.company_id)

    if not result["ok"]:
        log_row.status = "failed"
        log_row.error = result.get("error", "")[:1000]
        log_row.completed_at = datetime.now(timezone.utc)
        await db.commit()
        return {"ok": False, "error": result.get("error", "")[:300]}

    log_row.status = "success" if result["orders_upserted"] > 0 else "noop"
    log_row.items_processed = result["raw_count"]
    log_row.items_upserted = result["orders_upserted"]
    log_row.items_skipped = result["orders_skipped"]
    log_row.completed_at = datetime.now(timezone.utc)

    await db.commit()
    return {"ok": True, "orders_upserted": result["orders_upserted"], "orders_skipped": result["orders_skipped"]}


# ── Webhook receiver ──────────────────────────────────────────────────────────

@router.post("/webhook/{outlet_id}")
async def receive_webhook(
    outlet_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receive real-time order state change push events from PetPooja.
    No auth token required — the outlet_id in the URL acts as the routing key.
    PetPooja sends individual order objects or a list; both shapes are handled.
    """
    stmt = select(models_pg.PetPoojaConfig).where(
        models_pg.PetPoojaConfig.outlet_id == outlet_id,
    )
    res = await db.execute(stmt)
    cfg = res.scalar_one_or_none()
    if not cfg:
        raise HTTPException(404, detail="Outlet not found or PetPooja not configured.")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(400, detail="Invalid JSON payload.")

    raw_orders = payload if isinstance(payload, list) else [payload]

    result = await _process_order_batch(db, cfg, raw_orders, cfg.company_id)

    # Advance cursor to the highest version seen
    max_v = result["max_version"]
    if max_v > cfg.last_order_state_version:
        cfg.last_order_state_version = max_v + 1
        cfg.last_order_sync_at = datetime.now(timezone.utc)
        cfg.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return {"ok": True, "orders_processed": result["upserted"]}


# ── Data views ────────────────────────────────────────────────────────────────

@router.get("/sync/logs")
async def get_sync_logs(
    outlet_id: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.PetPoojaSyncLog).where(
        models_pg.PetPoojaSyncLog.company_id == current_user.company_id
    )
    if outlet_id:
        stmt = stmt.where(models_pg.PetPoojaSyncLog.outlet_id == outlet_id)
    stmt = stmt.order_by(models_pg.PetPoojaSyncLog.started_at.desc()).limit(limit)
    res = await db.execute(stmt)
    return [_serialize_log(l) for l in res.scalars().all()]


@router.get("/orders")
async def get_orders(
    outlet_id: Optional[str] = None,
    state: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.PetPoojaOrder).options(
        selectinload(models_pg.PetPoojaOrder.items)
    ).where(models_pg.PetPoojaOrder.company_id == current_user.company_id)
    if outlet_id:
        stmt = stmt.where(models_pg.PetPoojaOrder.outlet_id == outlet_id)
    if state:
        stmt = stmt.where(models_pg.PetPoojaOrder.state == state.upper())
    stmt = stmt.order_by(models_pg.PetPoojaOrder.last_updated_at.desc()).limit(limit)
    res = await db.execute(stmt)
    return [_serialize_order(o) for o in res.scalars().all()]


@router.get("/orders/{order_id}")
async def get_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(models_pg.PetPoojaOrder)
        .options(selectinload(models_pg.PetPoojaOrder.items))
        .where(
            models_pg.PetPoojaOrder.id == order_id,
            models_pg.PetPoojaOrder.company_id == current_user.company_id,
        )
    )
    res = await db.execute(stmt)
    order = res.scalar_one_or_none()
    if not order:
        raise HTTPException(404, detail="Order not found.")
    return _serialize_order(order)


@router.get("/menu-items")
async def get_menu_items(
    outlet_id: Optional[str] = None,
    search: Optional[str] = None,
    category: Optional[str] = None,
    active_only: bool = True,
    limit: int = Query(default=200, le=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.PetPoojaMenuItem).where(
        models_pg.PetPoojaMenuItem.company_id == current_user.company_id
    )
    if outlet_id:
        stmt = stmt.where(models_pg.PetPoojaMenuItem.outlet_id == outlet_id)
    if active_only:
        stmt = stmt.where(models_pg.PetPoojaMenuItem.is_active == True)  # noqa: E712
    if search:
        stmt = stmt.where(models_pg.PetPoojaMenuItem.name.ilike(f"%{search}%"))
    if category:
        stmt = stmt.where(models_pg.PetPoojaMenuItem.category_name.ilike(f"%{category}%"))
    stmt = stmt.order_by(models_pg.PetPoojaMenuItem.category_name, models_pg.PetPoojaMenuItem.name).limit(limit)
    res = await db.execute(stmt)
    return [_serialize_menu_item(m) for m in res.scalars().all()]


# ── Background polling task ───────────────────────────────────────────────────

async def petpooja_polling_background_task():
    """
    Continuously poll PetPooja for order changes on all sync-enabled outlets.
    Runs as a long-lived asyncio task started at app startup.
    Each outlet's poll_interval_seconds is respected individually.
    """
    log.info("PetPooja polling task started.")
    outlet_last_polled: dict[str, float] = {}

    while True:
        try:
            async with AsyncSessionLocal() as db:
                cfg_res = await db.execute(
                    select(models_pg.PetPoojaConfig).where(
                        models_pg.PetPoojaConfig.sync_enabled == True,  # noqa: E712
                        models_pg.PetPoojaConfig.sync_orders == True,   # noqa: E712
                    )
                )
                configs = cfg_res.scalars().all()

            now = asyncio.get_event_loop().time()
            for cfg in configs:
                last = outlet_last_polled.get(cfg.outlet_id, 0.0)
                if now - last < cfg.poll_interval_seconds:
                    continue
                outlet_last_polled[cfg.outlet_id] = now
                asyncio.create_task(_poll_outlet_orders(cfg.outlet_id, cfg.company_id))

        except Exception:
            log.exception("PetPooja polling scheduler error")

        await asyncio.sleep(5)  # Scheduling resolution: re-check every 5 s


async def _poll_outlet_orders(outlet_id: str, company_id: str) -> None:
    """Run one order poll cycle for a single outlet in its own session."""
    try:
        async with AsyncSessionLocal() as db:
            cfg_res = await db.execute(
                select(models_pg.PetPoojaConfig)
                .where(
                    models_pg.PetPoojaConfig.outlet_id == outlet_id,
                    models_pg.PetPoojaConfig.sync_enabled == True,  # noqa: E712
                )
                .with_for_update(skip_locked=True)
            )
            cfg = cfg_res.scalar_one_or_none()
            if not cfg:
                return  # Another task is already polling this outlet

            result = await _fetch_and_sync_orders(db, cfg, company_id)
            if result["ok"]:
                log.debug(
                    "PetPooja auto-poll outlet=%s upserted=%d skipped=%d",
                    outlet_id, result["orders_upserted"], result["orders_skipped"],
                )
            else:
                log.warning("PetPooja auto-poll outlet=%s failed: %s", outlet_id, result.get("error"))
            await db.commit()
    except Exception:
        log.exception("PetPooja auto-poll failed for outlet %s", outlet_id)
