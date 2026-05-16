"""
Customer portal authentication and self-service endpoints.

Auth strategy: passwordless — customer enters email or phone.
Backend looks up the Customer record and returns a short-lived JWT.
No password storage, no OTP (appropriate for a service booking portal).
"""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

import models_pg
from database_pg import get_db

router = APIRouter(prefix="/portal/customer", tags=["Customer Portal Auth"])

_SECRET = os.environ.get("JWT_SECRET_KEY", "ridn-secret-key-change-in-production")
_EXPIRE_DAYS = 30


# ─────────────────────────────────────────────────────────────────────────────
# JWT helpers
# ─────────────────────────────────────────────────────────────────────────────

def _issue_token(customer_id: str, company_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": customer_id, "company_id": company_id, "type": "customer", "exp": expire},
        _SECRET, algorithm="HS256",
    )


def _decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, _SECRET, algorithms=["HS256"])
        if payload.get("type") != "customer":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired — please sign in again")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def _extract_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    raise HTTPException(status_code=401, detail="Authorization header missing")


async def _get_customer(request: Request, db: AsyncSession = Depends(get_db)) -> models_pg.Customer:
    token = _extract_token(request)
    payload = _decode_token(token)
    customer = (await db.execute(
        select(models_pg.Customer).where(models_pg.Customer.id == payload["sub"])
    )).scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=401, detail="Customer not found")
    return customer


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class AuthRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/auth")
async def customer_auth(body: AuthRequest, db: AsyncSession = Depends(get_db)):
    """
    Passwordless login. Customers are created automatically at booking time,
    so any customer who has booked can log in with their email or phone.
    """
    if not body.email and not body.phone:
        raise HTTPException(status_code=400, detail="Email or phone is required")

    q = select(models_pg.Customer)
    if body.email:
        # Case-insensitive match — stored emails may have mixed case from admin entry
        q = q.where(func.lower(models_pg.Customer.email) == body.email.strip().lower())
    else:
        phone = "".join(c for c in (body.phone or "") if c.isdigit() or c == "+")
        q = q.where(models_pg.Customer.phone == phone)

    customer = (await db.execute(q)).scalar_one_or_none()
    if not customer:
        raise HTTPException(
            status_code=404,
            detail="No account found. Book an appointment first — your account is created automatically."
        )

    token = _issue_token(customer.id, customer.company_id)
    return {
        "token": token,
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "email": customer.email,
            "phone": customer.phone,
        },
    }


@router.get("/me")
async def get_customer_profile(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Full customer profile including active membership and credits."""
    customer = await _get_customer(request, db)

    # Active membership
    membership = (await db.execute(
        select(models_pg.Membership, models_pg.MembershipPlan)
        .join(models_pg.MembershipPlan, models_pg.Membership.plan_id == models_pg.MembershipPlan.id, isouter=True)
        .where(
            models_pg.Membership.customer_id == customer.id,
            models_pg.Membership.status.in_(["active", "paused"]),
        )
        .order_by(desc(models_pg.Membership.enrolled_at))
        .limit(1)
    )).first()

    membership_data = None
    if membership:
        m, plan = membership
        membership_data = {
            "id": m.id,
            "status": m.status,
            "credits_balance": float(m.credits_balance or 0),
            "expires_at": m.expires_at.isoformat() if m.expires_at else None,
            "plan_name": plan.name if plan else None,
            "plan_badge": plan.badge_label if plan and hasattr(plan, "badge_label") else None,
        }

    return {
        "id": customer.id,
        "name": customer.name,
        "email": customer.email,
        "phone": customer.phone,
        "total_bookings": customer.total_bookings or 0,
        "total_revenue": float(customer.total_revenue or 0),
        "created_at": customer.created_at.isoformat() if customer.created_at else None,
        "membership": membership_data,
    }


@router.get("/bookings")
async def get_customer_bookings(
    request: Request,
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Paginated booking history for the logged-in customer."""
    customer = await _get_customer(request, db)

    from sqlalchemy import func
    total = (await db.execute(
        select(func.count(models_pg.Booking.id)).where(
            models_pg.Booking.customer_id == customer.id
        )
    )).scalar() or 0

    bookings = (await db.execute(
        select(models_pg.Booking)
        .where(models_pg.Booking.customer_id == customer.id)
        .order_by(desc(models_pg.Booking.date), desc(models_pg.Booking.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    import math
    return {
        "total": total,
        "page": page,
        "pages": math.ceil(total / page_size) if total else 0,
        "items": [
            {
                "id": b.id,
                "date": b.date.isoformat() if b.date else None,
                "time": b.time,
                "duration": b.duration,
                "status": b.status,
                "amount": float(b.amount or 0),
                "notes": b.notes,
                "outlet_id": b.outlet_id,
            }
            for b in bookings
        ],
    }
