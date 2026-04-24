from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone, date
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import models_pg

from .dependencies import get_current_user, User, get_db

router = APIRouter(prefix="/invoices", tags=["Invoices"])


# ─── Pydantic models ──────────────────────────────────────────────────────────

class InvoiceItem(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float = 0
    tax_rate: float = 0
    discount: float = 0
    amount: float = 0


class InvoiceCreate(BaseModel):
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_id: Optional[str] = None
    outlet_id: Optional[str] = None
    booking_id: Optional[str] = None
    billing_address: Optional[dict] = None
    items: List[dict] = []
    subtotal: float = 0
    discount_amount: float = 0
    tax_amount: float = 0
    total_amount: float = 0
    issue_date: str  # ISO date string
    due_date: Optional[str] = None
    payment_terms: str = "net_30"
    notes: Optional[str] = None
    footer: Optional[str] = None
    currency: str = "INR"
    currency_symbol: str = "₹"


class InvoiceUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    billing_address: Optional[dict] = None
    outlet_id: Optional[str] = None
    items: Optional[List[dict]] = None
    subtotal: Optional[float] = None
    discount_amount: Optional[float] = None
    tax_amount: Optional[float] = None
    total_amount: Optional[float] = None
    issue_date: Optional[str] = None
    due_date: Optional[str] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    footer: Optional[str] = None


class RecordPaymentRequest(BaseModel):
    amount: float
    payment_method: str = "cash"
    reference: Optional[str] = None
    notes: Optional[str] = None
    paid_at: Optional[str] = None


class InvoiceSettingsUpdate(BaseModel):
    prefix: Optional[str] = None
    next_number: Optional[int] = None
    default_payment_terms: Optional[str] = None
    tax_name: Optional[str] = None
    default_tax_rate: Optional[float] = None
    show_tax_breakdown: Optional[bool] = None
    default_notes: Optional[str] = None
    default_footer: Optional[str] = None
    auto_generate_from_booking: Optional[bool] = None
    auto_generate_from_order: Optional[bool] = None
    auto_send_on_generate: Optional[bool] = None
    brand_color: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    invoice_company_name: Optional[str] = None
    invoice_company_address: Optional[str] = None
    invoice_company_phone: Optional[str] = None
    invoice_company_email: Optional[str] = None
    invoice_company_website: Optional[str] = None
    invoice_company_gstin: Optional[str] = None
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _fmt_invoice(inv: models_pg.Invoice, payments: list = None) -> dict:
    return {
        "id": inv.id,
        "company_id": inv.company_id,
        "outlet_id": inv.outlet_id,
        "booking_id": inv.booking_id,
        "order_id": inv.order_id,
        "customer_id": inv.customer_id,
        "invoice_number": inv.invoice_number,
        "status": inv.status,
        "customer_name": inv.customer_name,
        "customer_email": inv.customer_email,
        "customer_phone": inv.customer_phone,
        "billing_address": inv.billing_address,
        "items": inv.items or [],
        "subtotal": float(inv.subtotal or 0),
        "discount_amount": float(inv.discount_amount or 0),
        "tax_amount": float(inv.tax_amount or 0),
        "total_amount": float(inv.total_amount or 0),
        "paid_amount": float(inv.paid_amount or 0),
        "currency": inv.currency,
        "currency_symbol": inv.currency_symbol,
        "issue_date": inv.issue_date.isoformat() if inv.issue_date else None,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "payment_terms": inv.payment_terms,
        "notes": inv.notes,
        "footer": inv.footer,
        "sent_at": inv.sent_at.isoformat() if inv.sent_at else None,
        "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
        "created_by": inv.created_by,
        "created_at": inv.created_at.isoformat() if inv.created_at else None,
        "updated_at": inv.updated_at.isoformat() if inv.updated_at else None,
        "payments": [
            {
                "id": p.id,
                "amount": float(p.amount),
                "payment_method": p.payment_method,
                "reference": p.reference,
                "notes": p.notes,
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
                "created_by": p.created_by,
            }
            for p in (payments or [])
        ],
    }


def _fmt_settings(s: models_pg.InvoiceSettings) -> dict:
    return {
        "id": s.id,
        "company_id": s.company_id,
        "prefix": s.prefix,
        "next_number": s.next_number,
        "default_payment_terms": s.default_payment_terms,
        "tax_name": s.tax_name,
        "default_tax_rate": float(s.default_tax_rate or 0),
        "show_tax_breakdown": s.show_tax_breakdown,
        "default_notes": s.default_notes,
        "default_footer": s.default_footer,
        "auto_generate_from_booking": s.auto_generate_from_booking,
        "auto_generate_from_order": s.auto_generate_from_order,
        "auto_send_on_generate": s.auto_send_on_generate,
        "brand_color": s.brand_color or "#5FA8D3",
        "email_subject": s.email_subject,
        "email_body": s.email_body,
        "invoice_company_name": s.invoice_company_name,
        "invoice_company_address": s.invoice_company_address,
        "invoice_company_phone": s.invoice_company_phone,
        "invoice_company_email": s.invoice_company_email,
        "invoice_company_website": s.invoice_company_website,
        "invoice_company_gstin": s.invoice_company_gstin,
        "currency": s.currency,
        "currency_symbol": s.currency_symbol,
    }


async def _get_or_create_settings(company_id: str, db: AsyncSession) -> models_pg.InvoiceSettings:
    stmt = select(models_pg.InvoiceSettings).where(models_pg.InvoiceSettings.company_id == company_id)
    settings = (await db.execute(stmt)).scalar_one_or_none()
    if not settings:
        settings = models_pg.InvoiceSettings(company_id=company_id)
        db.add(settings)
        await db.flush()
    return settings


async def _next_invoice_number(company_id: str, db: AsyncSession) -> str:
    settings = await _get_or_create_settings(company_id, db)
    number = settings.next_number
    invoice_number = f"{settings.prefix}-{number:04d}"
    settings.next_number = number + 1
    return invoice_number


def _compute_status(inv: models_pg.Invoice) -> str:
    """Recompute overdue status without modifying the record."""
    if inv.status in ("paid", "void", "cancelled"):
        return inv.status
    if inv.status == "partially_paid" and inv.due_date and inv.due_date < date.today():
        return "overdue"
    if inv.status == "sent" and inv.due_date and inv.due_date < date.today():
        return "overdue"
    return inv.status


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/settings")
async def get_invoice_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == "SuperAdmin":
        raise HTTPException(status_code=403, detail="SuperAdmin has no company invoice settings")
    settings = await _get_or_create_settings(current_user.company_id, db)
    await db.commit()
    return _fmt_settings(settings)


@router.put("/settings")
async def update_invoice_settings(
    body: InvoiceSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in ("Admin", "SuperAdmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    settings = await _get_or_create_settings(current_user.company_id, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(settings, field, value)
    await db.commit()
    await db.refresh(settings)
    return _fmt_settings(settings)


@router.get("/stats")
async def get_invoice_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == "SuperAdmin":
        raise HTTPException(status_code=403, detail="Not available for SuperAdmin")
    company_id = current_user.company_id
    stmt = select(models_pg.Invoice).where(models_pg.Invoice.company_id == company_id)
    invoices = (await db.execute(stmt)).scalars().all()

    today = date.today()
    total_invoiced = sum(float(i.total_amount or 0) for i in invoices if i.status != "void")
    total_paid = sum(float(i.paid_amount or 0) for i in invoices if i.status != "void")
    total_outstanding = sum(
        float(i.total_amount or 0) - float(i.paid_amount or 0)
        for i in invoices
        if i.status not in ("paid", "void", "cancelled")
    )
    total_overdue = sum(
        float(i.total_amount or 0) - float(i.paid_amount or 0)
        for i in invoices
        if i.status in ("sent", "partially_paid") and i.due_date and i.due_date < today
    )
    counts = {"draft": 0, "sent": 0, "paid": 0, "partially_paid": 0, "overdue": 0, "cancelled": 0, "void": 0}
    for inv in invoices:
        s = _compute_status(inv)
        counts[s] = counts.get(s, 0) + 1

    return {
        "total_invoiced": total_invoiced,
        "total_paid": total_paid,
        "total_outstanding": total_outstanding,
        "total_overdue": total_overdue,
        "counts": counts,
    }


@router.get("")
async def list_invoices(
    status: Optional[str] = Query(None),
    outlet_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.Invoice)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Invoice.company_id == current_user.company_id)
    if outlet_id:
        stmt = stmt.where(models_pg.Invoice.outlet_id == outlet_id)
    if date_from:
        stmt = stmt.where(models_pg.Invoice.issue_date >= date_from)
    if date_to:
        stmt = stmt.where(models_pg.Invoice.issue_date <= date_to)
    if search:
        like = f"%{search}%"
        from sqlalchemy import or_
        stmt = stmt.where(
            or_(
                models_pg.Invoice.customer_name.ilike(like),
                models_pg.Invoice.invoice_number.ilike(like),
                models_pg.Invoice.customer_email.ilike(like),
            )
        )
    stmt = stmt.order_by(desc(models_pg.Invoice.created_at))
    invoices = (await db.execute(stmt)).scalars().all()

    result = []
    for inv in invoices:
        computed_status = _compute_status(inv)
        if status and status != "all" and computed_status != status:
            continue
        # Update overdue status in DB lazily
        if computed_status == "overdue" and inv.status != "overdue":
            inv.status = "overdue"
        d = _fmt_invoice(inv)
        d["status"] = computed_status
        result.append(d)

    if any(inv.status == "overdue" for inv in invoices):
        await db.commit()

    return result


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.Invoice).where(models_pg.Invoice.id == invoice_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Invoice.company_id == current_user.company_id)
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    pay_stmt = select(models_pg.InvoicePayment).where(models_pg.InvoicePayment.invoice_id == invoice_id)
    payments = (await db.execute(pay_stmt)).scalars().all()

    d = _fmt_invoice(inv, payments)
    d["status"] = _compute_status(inv)
    return d


@router.post("")
async def create_invoice(
    body: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in ("Admin", "Manager", "SuperAdmin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    company_id = current_user.company_id
    invoice_number = await _next_invoice_number(company_id, db)

    inv = models_pg.Invoice(
        id=str(uuid.uuid4()),
        company_id=company_id,
        invoice_number=invoice_number,
        outlet_id=body.outlet_id,
        booking_id=body.booking_id,
        customer_id=body.customer_id,
        customer_name=body.customer_name,
        customer_email=body.customer_email,
        customer_phone=body.customer_phone,
        billing_address=body.billing_address,
        items=body.items,
        subtotal=body.subtotal,
        discount_amount=body.discount_amount,
        tax_amount=body.tax_amount,
        total_amount=body.total_amount,
        paid_amount=0,
        currency=body.currency,
        currency_symbol=body.currency_symbol,
        issue_date=date.fromisoformat(body.issue_date),
        due_date=date.fromisoformat(body.due_date) if body.due_date else None,
        payment_terms=body.payment_terms,
        notes=body.notes,
        footer=body.footer,
        status="draft",
        created_by=current_user.email,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return _fmt_invoice(inv)


@router.put("/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    body: InvoiceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.Invoice).where(
        models_pg.Invoice.id == invoice_id,
        models_pg.Invoice.company_id == current_user.company_id,
    )
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status not in ("draft",):
        raise HTTPException(status_code=400, detail="Only draft invoices can be edited")

    for field, value in body.model_dump(exclude_none=True).items():
        if field in ("issue_date", "due_date") and value:
            setattr(inv, field, date.fromisoformat(value))
        else:
            setattr(inv, field, value)

    await db.commit()
    await db.refresh(inv)
    return _fmt_invoice(inv)


@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in ("Admin", "SuperAdmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    stmt = select(models_pg.Invoice).where(
        models_pg.Invoice.id == invoice_id,
        models_pg.Invoice.company_id == current_user.company_id,
    )
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status not in ("draft", "cancelled", "void"):
        raise HTTPException(status_code=400, detail="Only draft, cancelled, or void invoices can be deleted")
    await db.delete(inv)
    await db.commit()
    return {"message": "Invoice deleted"}


@router.post("/{invoice_id}/send")
async def send_invoice(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.Invoice).where(
        models_pg.Invoice.id == invoice_id,
        models_pg.Invoice.company_id == current_user.company_id,
    )
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status not in ("draft", "sent"):
        raise HTTPException(status_code=400, detail="Invoice cannot be sent in its current state")

    inv.status = "sent"
    inv.sent_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(inv)
    return _fmt_invoice(inv)


@router.post("/{invoice_id}/mark-paid")
async def mark_invoice_paid(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.Invoice).where(
        models_pg.Invoice.id == invoice_id,
        models_pg.Invoice.company_id == current_user.company_id,
    )
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status in ("void", "cancelled"):
        raise HTTPException(status_code=400, detail="Cannot mark a voided or cancelled invoice as paid")

    inv.paid_amount = inv.total_amount
    inv.status = "paid"
    inv.paid_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(inv)
    return _fmt_invoice(inv)


@router.post("/{invoice_id}/record-payment")
async def record_payment(
    invoice_id: str,
    body: RecordPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.Invoice).where(
        models_pg.Invoice.id == invoice_id,
        models_pg.Invoice.company_id == current_user.company_id,
    )
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status in ("void", "cancelled", "paid"):
        raise HTTPException(status_code=400, detail="Cannot record payment for this invoice")

    paid_at = datetime.now(timezone.utc)
    if body.paid_at:
        try:
            paid_at = datetime.fromisoformat(body.paid_at)
        except ValueError:
            pass

    payment = models_pg.InvoicePayment(
        id=str(uuid.uuid4()),
        invoice_id=inv.id,
        company_id=current_user.company_id,
        amount=body.amount,
        payment_method=body.payment_method,
        reference=body.reference,
        notes=body.notes,
        paid_at=paid_at,
        created_by=current_user.email,
    )
    db.add(payment)

    new_paid = float(inv.paid_amount or 0) + body.amount
    inv.paid_amount = min(new_paid, float(inv.total_amount or 0))

    if inv.paid_amount >= float(inv.total_amount or 0):
        inv.status = "paid"
        inv.paid_at = paid_at
    elif inv.paid_amount > 0:
        inv.status = "partially_paid"

    await db.commit()
    await db.refresh(inv)

    pay_stmt = select(models_pg.InvoicePayment).where(models_pg.InvoicePayment.invoice_id == invoice_id)
    payments = (await db.execute(pay_stmt)).scalars().all()
    return _fmt_invoice(inv, payments)


@router.post("/{invoice_id}/void")
async def void_invoice(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in ("Admin", "SuperAdmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    stmt = select(models_pg.Invoice).where(
        models_pg.Invoice.id == invoice_id,
        models_pg.Invoice.company_id == current_user.company_id,
    )
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status == "paid":
        raise HTTPException(status_code=400, detail="Cannot void a fully paid invoice")

    inv.status = "void"
    await db.commit()
    await db.refresh(inv)
    return _fmt_invoice(inv)


@router.post("/{invoice_id}/cancel")
async def cancel_invoice(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.Invoice).where(
        models_pg.Invoice.id == invoice_id,
        models_pg.Invoice.company_id == current_user.company_id,
    )
    inv = (await db.execute(stmt)).scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status in ("paid", "void"):
        raise HTTPException(status_code=400, detail="Cannot cancel a paid or voided invoice")

    inv.status = "cancelled"
    await db.commit()
    await db.refresh(inv)
    return _fmt_invoice(inv)


@router.post("/from-booking/{booking_id}")
async def create_invoice_from_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Auto-generate an invoice from a completed booking."""
    if current_user.role not in ("Admin", "Manager", "SuperAdmin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    stmt = select(models_pg.Booking).where(
        models_pg.Booking.id == booking_id,
        models_pg.Booking.company_id == current_user.company_id,
    )
    booking = (await db.execute(stmt)).scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Check not already invoiced
    existing = (await db.execute(
        select(models_pg.Invoice).where(
            models_pg.Invoice.booking_id == booking_id,
            models_pg.Invoice.status != "void",
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Invoice already exists for this booking")

    settings = await _get_or_create_settings(current_user.company_id, db)

    # Resolve customer info
    customer_name = "Customer"
    customer_email = None
    customer_phone = None
    if booking.customer_id:
        c = (await db.execute(
            select(models_pg.Customer).where(models_pg.Customer.id == booking.customer_id)
        )).scalar_one_or_none()
        if c:
            customer_name = c.name
            customer_email = c.email
            customer_phone = c.phone

    # Build line item from booking
    amount = float(booking.price or 0)
    tax_rate = float(settings.default_tax_rate or 0)
    tax_amount = round(amount * tax_rate / 100, 2)
    items = [{
        "description": booking.service_name or "Service",
        "quantity": 1,
        "unit_price": amount,
        "tax_rate": tax_rate,
        "discount": 0,
        "amount": amount,
    }]

    invoice_number = await _next_invoice_number(current_user.company_id, db)

    inv = models_pg.Invoice(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        booking_id=booking_id,
        outlet_id=booking.outlet_id,
        customer_id=booking.customer_id,
        invoice_number=invoice_number,
        customer_name=customer_name,
        customer_email=customer_email,
        customer_phone=customer_phone,
        items=items,
        subtotal=amount,
        discount_amount=0,
        tax_amount=tax_amount,
        total_amount=amount + tax_amount,
        paid_amount=0,
        currency=settings.currency,
        currency_symbol=settings.currency_symbol,
        issue_date=date.today(),
        payment_terms=settings.default_payment_terms,
        notes=settings.default_notes,
        footer=settings.default_footer,
        status="draft",
        created_by=current_user.email,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return _fmt_invoice(inv)
