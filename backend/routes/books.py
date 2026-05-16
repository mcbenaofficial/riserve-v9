from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import get_db
import models_pg
from routes.dependencies import get_current_user, require_admin, require_feature
from services.books_seed import seed_books_for_company
from services.books_ledger import void_journal_entry, _create_entry, post_financial_event

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/books",
    tags=["Books"],
    dependencies=[Depends(require_feature("books"))],
)


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────────────────────────────────────

class AccountCreate(BaseModel):
    code: str
    name: str
    account_type: str
    account_subtype: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    is_active: Optional[bool] = None

class TaxCodeCreate(BaseModel):
    name: str
    code: str
    rate: float = 0
    tax_type: str = "gst"
    component_cgst: float = 0
    component_sgst: float = 0

class TaxCodeUpdate(BaseModel):
    name: Optional[str] = None
    rate: Optional[float] = None
    is_active: Optional[bool] = None

class ManualJournalLine(BaseModel):
    account_id: str
    debit: float = 0
    credit: float = 0
    description: Optional[str] = None

class ManualJournalCreate(BaseModel):
    entry_date: str
    description: str
    lines: List[ManualJournalLine]

class VoidRequest(BaseModel):
    void_reason: str

class BankAccountCreate(BaseModel):
    account_name: str
    account_type: str = "bank"
    bank_name: Optional[str] = None
    account_number_last4: Optional[str] = None
    ifsc_code: Optional[str] = None
    opening_balance: float = 0
    books_account_id: Optional[str] = None

class BankAccountUpdate(BaseModel):
    account_name: Optional[str] = None
    bank_name: Optional[str] = None
    is_default: Optional[bool] = None
    is_active: Optional[bool] = None

class BillCreate(BaseModel):
    vendor_name: str
    bill_date: str
    total_amount: float
    category: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    items: Optional[list] = []
    subtotal: float = 0
    tax_amount: float = 0
    vendor_id: Optional[str] = None
    expense_account_id: Optional[str] = None

class BillPayment(BaseModel):
    paid_amount: float
    payment_method: str
    payment_reference: Optional[str] = None

class SettingsUpdate(BaseModel):
    fiscal_year_start_month: Optional[int] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    tax_scheme: Optional[str] = None
    auto_post_bookings: Optional[bool] = None
    auto_post_memberships: Optional[bool] = None
    auto_post_marketplace: Optional[bool] = None
    auto_post_inventory: Optional[bool] = None


def _serialize_account(a: models_pg.BooksAccount) -> dict:
    return {
        "id": a.id, "code": a.code, "name": a.name,
        "account_type": a.account_type, "account_subtype": a.account_subtype,
        "is_system": a.is_system, "is_active": a.is_active,
        "description": a.description, "parent_id": a.parent_id,
        "currency": a.currency, "created_at": a.created_at.isoformat() if a.created_at else None,
    }


def _serialize_entry(e: models_pg.BooksJournalEntry, lines=None) -> dict:
    d = {
        "id": e.id, "entry_number": e.entry_number,
        "entry_date": e.entry_date.isoformat() if e.entry_date else None,
        "description": e.description, "source_module": e.source_module,
        "source_id": e.source_id, "source_type": e.source_type,
        "status": e.status, "is_auto_posted": e.is_auto_posted,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }
    if lines is not None:
        d["lines"] = [
            {
                "id": l.id, "account_id": l.account_id, "debit": float(l.debit or 0),
                "credit": float(l.credit or 0), "description": l.description,
                "line_order": l.line_order,
            }
            for l in lines
        ]
    return d


def _serialize_bill(b: models_pg.BooksBill) -> dict:
    return {
        "id": b.id, "bill_number": b.bill_number, "vendor_name": b.vendor_name,
        "category": b.category, "description": b.description,
        "total_amount": float(b.total_amount or 0), "subtotal": float(b.subtotal or 0),
        "tax_amount": float(b.tax_amount or 0), "status": b.status,
        "paid_amount": float(b.paid_amount or 0),
        "bill_date": b.bill_date.isoformat() if b.bill_date else None,
        "due_date": b.due_date.isoformat() if b.due_date else None,
        "paid_at": b.paid_at.isoformat() if b.paid_at else None,
        "payment_method": b.payment_method, "vendor_id": b.vendor_id,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Settings & Activation
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/settings")
async def get_settings(
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.BooksSettings).where(
            models_pg.BooksSettings.company_id == current_user.company_id
        )
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        return {"activated": False}
    return {
        "activated": True,
        "id": settings.id,
        "fiscal_year_start_month": settings.fiscal_year_start_month,
        "default_currency": settings.default_currency,
        "gstin": settings.gstin,
        "pan": settings.pan,
        "tax_scheme": settings.tax_scheme,
        "auto_post_bookings": settings.auto_post_bookings,
        "auto_post_memberships": settings.auto_post_memberships,
        "auto_post_marketplace": settings.auto_post_marketplace,
        "auto_post_inventory": settings.auto_post_inventory,
    }


@router.post("/settings/activate")
async def activate_books(
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = (await db.execute(
        select(models_pg.BooksSettings).where(
            models_pg.BooksSettings.company_id == current_user.company_id
        )
    )).scalar_one_or_none()

    if existing:
        return {"message": "Books already activated", "activated": True}

    settings = models_pg.BooksSettings(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(settings)
    await seed_books_for_company(db, current_user.company_id)
    await db.commit()
    return {"message": "Books activated successfully", "activated": True}


@router.put("/settings")
async def update_settings(
    payload: SettingsUpdate,
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.BooksSettings).where(
            models_pg.BooksSettings.company_id == current_user.company_id
        )
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        raise HTTPException(status_code=404, detail="Books not activated")

    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(settings, field, val)
    settings.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Settings updated"}


# ─────────────────────────────────────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cid = current_user.company_id
    settings = (await db.execute(
        select(models_pg.BooksSettings).where(models_pg.BooksSettings.company_id == cid)
    )).scalar_one_or_none()

    if settings is None:
        return {"activated": False}

    now = datetime.now(timezone.utc)
    month_start = date(now.year, now.month, 1)
    today = now.date()

    # Single joined query: sum debits and credits per account type for MTD
    mtd_agg = (await db.execute(
        select(
            models_pg.BooksAccount.account_type,
            func.coalesce(func.sum(models_pg.BooksJournalLine.credit), 0).label("total_credit"),
            func.coalesce(func.sum(models_pg.BooksJournalLine.debit), 0).label("total_debit"),
        )
        .join(models_pg.BooksJournalEntry, models_pg.BooksJournalLine.entry_id == models_pg.BooksJournalEntry.id)
        .join(models_pg.BooksAccount, models_pg.BooksJournalLine.account_id == models_pg.BooksAccount.id)
        .where(
            models_pg.BooksJournalEntry.company_id == cid,
            models_pg.BooksJournalEntry.status == "posted",
            models_pg.BooksJournalEntry.entry_date >= month_start,
            models_pg.BooksJournalEntry.entry_date <= today,
            models_pg.BooksAccount.account_type.in_(["income", "expense"]),
            models_pg.BooksAccount.is_active == True,
        )
        .group_by(models_pg.BooksAccount.account_type)
    )).all()

    mtd_revenue = Decimal("0")
    mtd_expenses = Decimal("0")
    for row in mtd_agg:
        if row.account_type == "income":
            mtd_revenue = Decimal(str(row.total_credit)) - Decimal(str(row.total_debit))
        elif row.account_type == "expense":
            mtd_expenses = Decimal(str(row.total_debit)) - Decimal(str(row.total_credit))
    mtd_net = mtd_revenue - mtd_expenses

    # Unpaid bills count
    bills_result = await db.execute(
        select(
            func.count(models_pg.BooksBill.id),
            func.coalesce(func.sum(models_pg.BooksBill.total_amount - models_pg.BooksBill.paid_amount), 0)
        ).where(
            models_pg.BooksBill.company_id == cid,
            models_pg.BooksBill.status.in_(["unpaid", "partial"]),
        )
    )
    bills_count, bills_outstanding = bills_result.one()

    # Recent 10 journal entries
    recent_entries_result = await db.execute(
        select(models_pg.BooksJournalEntry).where(
            models_pg.BooksJournalEntry.company_id == cid,
            models_pg.BooksJournalEntry.status == "posted",
        ).order_by(desc(models_pg.BooksJournalEntry.created_at)).limit(10)
    )
    recent_entries = recent_entries_result.scalars().all()

    # Account balances by type
    balances_result = await db.execute(
        select(models_pg.BooksAccountBalance).where(
            models_pg.BooksAccountBalance.company_id == cid,
            models_pg.BooksAccountBalance.fiscal_year == now.year,
            models_pg.BooksAccountBalance.period_month == now.month,
        )
    )
    balances = balances_result.scalars().all()
    balance_map = {b.account_id: float(b.closing_balance or 0) for b in balances}

    accounts_result = await db.execute(
        select(models_pg.BooksAccount).where(
            models_pg.BooksAccount.company_id == cid,
            models_pg.BooksAccount.is_active == True,
            models_pg.BooksAccount.parent_id == None,
        )
    )
    top_accounts = accounts_result.scalars().all()
    account_balances = [
        {**_serialize_account(a), "balance": balance_map.get(a.id, 0)}
        for a in top_accounts
    ]

    return {
        "activated": True,
        "pl_summary": {
            "revenue": float(mtd_revenue),
            "expenses": float(mtd_expenses),
            "net_profit": float(mtd_net),
            "period": f"{month_start.isoformat()} to {today.isoformat()}",
        },
        "bills_outstanding": {"count": bills_count, "total": float(bills_outstanding)},
        "account_balances": account_balances,
        "recent_entries": [_serialize_entry(e) for e in recent_entries],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Chart of Accounts
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/accounts")
async def list_accounts(
    account_type: Optional[str] = None,
    active_only: bool = True,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(models_pg.BooksAccount).where(
        models_pg.BooksAccount.company_id == current_user.company_id
    )
    if account_type:
        q = q.where(models_pg.BooksAccount.account_type == account_type)
    if active_only:
        q = q.where(models_pg.BooksAccount.is_active == True)
    q = q.order_by(models_pg.BooksAccount.code)
    result = await db.execute(q)
    return [_serialize_account(a) for a in result.scalars().all()]


@router.post("/accounts")
async def create_account(
    payload: AccountCreate,
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = (await db.execute(
        select(models_pg.BooksAccount).where(
            models_pg.BooksAccount.company_id == current_user.company_id,
            models_pg.BooksAccount.code == payload.code,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Account code already exists")

    acct = models_pg.BooksAccount(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        code=payload.code,
        name=payload.name,
        account_type=payload.account_type,
        account_subtype=payload.account_subtype,
        description=payload.description,
        parent_id=payload.parent_id,
        is_system=False,
        is_active=True,
        currency="INR",
        created_at=datetime.now(timezone.utc),
    )
    db.add(acct)
    await db.commit()
    await db.refresh(acct)
    return _serialize_account(acct)


@router.get("/accounts/{account_id}")
async def get_account(
    account_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    acct = (await db.execute(
        select(models_pg.BooksAccount).where(
            models_pg.BooksAccount.id == account_id,
            models_pg.BooksAccount.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")
    return _serialize_account(acct)


@router.put("/accounts/{account_id}")
async def update_account(
    account_id: str,
    payload: AccountUpdate,
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    acct = (await db.execute(
        select(models_pg.BooksAccount).where(
            models_pg.BooksAccount.id == account_id,
            models_pg.BooksAccount.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")

    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(acct, field, val)
    acct.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(acct)
    return _serialize_account(acct)


@router.delete("/accounts/{account_id}")
async def deactivate_account(
    account_id: str,
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    acct = (await db.execute(
        select(models_pg.BooksAccount).where(
            models_pg.BooksAccount.id == account_id,
            models_pg.BooksAccount.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")
    if acct.is_system:
        raise HTTPException(status_code=400, detail="System accounts cannot be deactivated")

    line_count = (await db.execute(
        select(func.count(models_pg.BooksJournalLine.id)).where(
            models_pg.BooksJournalLine.account_id == account_id
        )
    )).scalar()
    if line_count and line_count > 0:
        raise HTTPException(status_code=400, detail="Cannot deactivate account with existing journal lines")

    acct.is_active = False
    acct.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Account deactivated"}


@router.get("/accounts/{account_id}/ledger")
async def get_account_ledger(
    account_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    acct = (await db.execute(
        select(models_pg.BooksAccount).where(
            models_pg.BooksAccount.id == account_id,
            models_pg.BooksAccount.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")

    q = (
        select(models_pg.BooksJournalLine, models_pg.BooksJournalEntry)
        .join(models_pg.BooksJournalEntry, models_pg.BooksJournalLine.entry_id == models_pg.BooksJournalEntry.id)
        .where(
            models_pg.BooksJournalLine.account_id == account_id,
            models_pg.BooksJournalEntry.status == "posted",
        )
    )
    if from_date:
        q = q.where(models_pg.BooksJournalEntry.entry_date >= date.fromisoformat(from_date))
    if to_date:
        q = q.where(models_pg.BooksJournalEntry.entry_date <= date.fromisoformat(to_date))
    q = q.order_by(desc(models_pg.BooksJournalEntry.entry_date)).offset((page - 1) * page_size).limit(page_size)

    rows = (await db.execute(q)).all()
    return {
        "account": _serialize_account(acct),
        "lines": [
            {
                "id": line.id, "entry_number": entry.entry_number,
                "entry_date": entry.entry_date.isoformat(),
                "description": entry.description or line.description,
                "source_module": entry.source_module,
                "debit": float(line.debit or 0), "credit": float(line.credit or 0),
            }
            for line, entry in rows
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Journal Entries
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/journal")
async def list_journal_entries(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    source_module: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(models_pg.BooksJournalEntry).where(
        models_pg.BooksJournalEntry.company_id == current_user.company_id
    )
    if from_date:
        q = q.where(models_pg.BooksJournalEntry.entry_date >= date.fromisoformat(from_date))
    if to_date:
        q = q.where(models_pg.BooksJournalEntry.entry_date <= date.fromisoformat(to_date))
    if source_module:
        q = q.where(models_pg.BooksJournalEntry.source_module == source_module)
    if status:
        q = q.where(models_pg.BooksJournalEntry.status == status)
    q = q.order_by(desc(models_pg.BooksJournalEntry.entry_date)).offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(q)
    entries = result.scalars().all()

    total_result = await db.execute(
        select(func.count(models_pg.BooksJournalEntry.id)).where(
            models_pg.BooksJournalEntry.company_id == current_user.company_id
        )
    )
    total = total_result.scalar() or 0

    return {"total": total, "page": page, "entries": [_serialize_entry(e) for e in entries]}


@router.post("/journal")
async def create_manual_entry(
    payload: ManualJournalCreate,
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    total_debit = sum(l.debit for l in payload.lines)
    total_credit = sum(l.credit for l in payload.lines)
    if abs(total_debit - total_credit) > 0.01:
        raise HTTPException(status_code=400, detail="Journal entry is not balanced (debits ≠ credits)")

    entry_date = date.fromisoformat(payload.entry_date)
    lines_data = [
        {
            "account_id": l.account_id,
            "debit": Decimal(str(l.debit)),
            "credit": Decimal(str(l.credit)),
            "description": l.description or "",
        }
        for l in payload.lines
    ]

    # For manual entries we resolve by account_id directly
    from services.books_ledger import _next_entry_number, _update_account_balance
    import uuid as _uuid

    entry = models_pg.BooksJournalEntry(
        id=str(_uuid.uuid4()),
        company_id=current_user.company_id,
        entry_number=await _next_entry_number(db, current_user.company_id),
        entry_date=entry_date,
        description=payload.description,
        source_module="manual",
        status="posted",
        is_auto_posted=False,
        created_by=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)

    for i, ld in enumerate(lines_data):
        acct = (await db.execute(
            select(models_pg.BooksAccount).where(
                models_pg.BooksAccount.id == ld["account_id"],
                models_pg.BooksAccount.company_id == current_user.company_id,
            )
        )).scalar_one_or_none()
        if not acct:
            await db.rollback()
            raise HTTPException(status_code=400, detail=f"Account {ld['account_id']} not found")

        jl = models_pg.BooksJournalLine(
            id=str(_uuid.uuid4()),
            entry_id=entry.id,
            account_id=ld["account_id"],
            company_id=current_user.company_id,
            debit=ld["debit"],
            credit=ld["credit"],
            description=ld.get("description", ""),
            currency="INR",
            line_order=i,
        )
        db.add(jl)
        await _update_account_balance(
            db, current_user.company_id, ld["account_id"], entry_date,
            ld["debit"], ld["credit"],
            account_type=acct.account_type,
        )

    await db.commit()
    await db.refresh(entry)
    return _serialize_entry(entry)


@router.get("/journal/{entry_id}")
async def get_journal_entry(
    entry_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = (await db.execute(
        select(models_pg.BooksJournalEntry).where(
            models_pg.BooksJournalEntry.id == entry_id,
            models_pg.BooksJournalEntry.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")

    lines = (await db.execute(
        select(models_pg.BooksJournalLine).where(
            models_pg.BooksJournalLine.entry_id == entry_id
        ).order_by(models_pg.BooksJournalLine.line_order)
    )).scalars().all()

    return _serialize_entry(entry, lines)


@router.post("/journal/{entry_id}/void")
async def void_entry(
    entry_id: str,
    payload: VoidRequest,
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    reversal = await void_journal_entry(
        db, entry_id, current_user.company_id, current_user.id, payload.void_reason
    )
    if reversal is None:
        raise HTTPException(status_code=400, detail="Entry not found or already voided")
    await db.commit()
    return {"message": "Entry voided", "reversal_entry_id": reversal.id}


# ─────────────────────────────────────────────────────────────────────────────
# Tax Codes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/tax-codes")
async def list_tax_codes(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.BooksTaxCode).where(
            models_pg.BooksTaxCode.company_id == current_user.company_id,
            models_pg.BooksTaxCode.is_active == True,
        ).order_by(models_pg.BooksTaxCode.code)
    )
    codes = result.scalars().all()
    return [
        {
            "id": c.id, "name": c.name, "code": c.code,
            "rate": float(c.rate or 0), "tax_type": c.tax_type,
            "component_cgst": float(c.component_cgst or 0),
            "component_sgst": float(c.component_sgst or 0),
            "is_system": c.is_system, "is_active": c.is_active,
        }
        for c in codes
    ]


@router.post("/tax-codes")
async def create_tax_code(
    payload: TaxCodeCreate,
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = (await db.execute(
        select(models_pg.BooksTaxCode).where(
            models_pg.BooksTaxCode.company_id == current_user.company_id,
            models_pg.BooksTaxCode.code == payload.code,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Tax code already exists")

    tc = models_pg.BooksTaxCode(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        name=payload.name, code=payload.code,
        rate=payload.rate, tax_type=payload.tax_type,
        component_cgst=payload.component_cgst,
        component_sgst=payload.component_sgst,
        is_system=False, is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(tc)
    await db.commit()
    return {"id": tc.id, "name": tc.name, "code": tc.code}


# ─────────────────────────────────────────────────────────────────────────────
# Bank Accounts
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/bank-accounts")
async def list_bank_accounts(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.BooksBankAccount).where(
            models_pg.BooksBankAccount.company_id == current_user.company_id,
            models_pg.BooksBankAccount.is_active == True,
        )
    )
    accounts = result.scalars().all()
    return [
        {
            "id": a.id, "account_name": a.account_name, "account_type": a.account_type,
            "bank_name": a.bank_name, "account_number_last4": a.account_number_last4,
            "current_balance": float(a.current_balance or 0), "is_default": a.is_default,
            "currency": a.currency,
        }
        for a in accounts
    ]


@router.post("/bank-accounts")
async def create_bank_account(
    payload: BankAccountCreate,
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    ba = models_pg.BooksBankAccount(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        account_name=payload.account_name,
        account_type=payload.account_type,
        bank_name=payload.bank_name,
        account_number_last4=payload.account_number_last4,
        ifsc_code=payload.ifsc_code,
        opening_balance=Decimal(str(payload.opening_balance)),
        current_balance=Decimal(str(payload.opening_balance)),
        books_account_id=payload.books_account_id,
        is_default=False,
        is_active=True,
        created_at=datetime.now(timezone.utc),
    )
    db.add(ba)
    await db.commit()
    return {"id": ba.id, "account_name": ba.account_name}


# ─────────────────────────────────────────────────────────────────────────────
# Bills / Expenses
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/bills")
async def list_bills(
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(models_pg.BooksBill).where(
        models_pg.BooksBill.company_id == current_user.company_id
    )
    if status:
        q = q.where(models_pg.BooksBill.status == status)
    if from_date:
        q = q.where(models_pg.BooksBill.bill_date >= date.fromisoformat(from_date))
    if to_date:
        q = q.where(models_pg.BooksBill.bill_date <= date.fromisoformat(to_date))
    q = q.order_by(desc(models_pg.BooksBill.bill_date)).offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(q)
    return [_serialize_bill(b) for b in result.scalars().all()]


@router.post("/bills")
async def create_bill(
    payload: BillCreate,
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    year = now.year
    from sqlalchemy import update as _update
    num_result = await db.execute(
        _update(models_pg.BooksSettings)
        .where(models_pg.BooksSettings.company_id == current_user.company_id)
        .values(next_bill_number=models_pg.BooksSettings.next_bill_number + 1)
        .returning(models_pg.BooksSettings.next_bill_number)
    )
    num_row = num_result.fetchone()
    bill_num = f"BILL-{year}-{(num_row[0] if num_row else 1):05d}"

    bill = models_pg.BooksBill(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        bill_number=bill_num,
        vendor_name=payload.vendor_name,
        vendor_id=payload.vendor_id,
        category=payload.category,
        description=payload.description,
        items=payload.items or [],
        subtotal=Decimal(str(payload.subtotal)),
        tax_amount=Decimal(str(payload.tax_amount)),
        total_amount=Decimal(str(payload.total_amount)),
        bill_date=date.fromisoformat(payload.bill_date),
        due_date=date.fromisoformat(payload.due_date) if payload.due_date else None,
        expense_account_id=payload.expense_account_id,
        status="unpaid",
        paid_amount=Decimal("0"),
        created_by=current_user.id,
        created_at=now,
    )
    db.add(bill)
    await db.commit()
    await db.refresh(bill)

    await post_financial_event(
        db,
        company_id=current_user.company_id,
        event_type="bill_created",
        source_id=bill.id,
        amount=float(bill.total_amount),
        metadata={
            "expense_account_id": bill.expense_account_id,
            "description": f"Bill from {bill.vendor_name} — {bill.bill_number}",
            "entry_date": bill.bill_date.isoformat(),
        },
    )
    await db.commit()
    return _serialize_bill(bill)


@router.get("/bills/{bill_id}")
async def get_bill(
    bill_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bill = (await db.execute(
        select(models_pg.BooksBill).where(
            models_pg.BooksBill.id == bill_id,
            models_pg.BooksBill.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return _serialize_bill(bill)


@router.post("/bills/{bill_id}/pay")
async def pay_bill(
    bill_id: str,
    payload: BillPayment,
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    bill = (await db.execute(
        select(models_pg.BooksBill).where(
            models_pg.BooksBill.id == bill_id,
            models_pg.BooksBill.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill.status in ("paid", "void"):
        raise HTTPException(status_code=400, detail=f"Bill is already {bill.status}")

    paid = Decimal(str(payload.paid_amount))
    bill.paid_amount = (bill.paid_amount or Decimal("0")) + paid
    bill.payment_method = payload.payment_method
    bill.payment_reference = payload.payment_reference
    bill.paid_at = datetime.now(timezone.utc)
    bill.status = "paid" if bill.paid_amount >= bill.total_amount else "partial"
    bill.updated_at = datetime.now(timezone.utc)
    await db.commit()

    await post_financial_event(
        db,
        company_id=current_user.company_id,
        event_type="bill_payment",
        source_id=f"{bill.id}_pay_{int(bill.paid_at.timestamp())}",
        amount=float(paid),
        metadata={
            "description": f"Payment to {bill.vendor_name} — {bill.bill_number} ({payload.payment_method})",
        },
    )
    await db.commit()
    return _serialize_bill(bill)


@router.delete("/bills/{bill_id}")
async def void_bill(
    bill_id: str,
    current_user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    bill = (await db.execute(
        select(models_pg.BooksBill).where(
            models_pg.BooksBill.id == bill_id,
            models_pg.BooksBill.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    bill.status = "void"
    bill.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Bill voided"}


# ─────────────────────────────────────────────────────────────────────────────
# Reports (Phase 1: P&L + Balance Sheet stubs)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/reports/pl")
async def report_pl(
    from_date: str = Query(...),
    to_date: str = Query(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cid = current_user.company_id
    fd = date.fromisoformat(from_date)
    td = date.fromisoformat(to_date)

    # Subquery for valid entry IDs — avoids passing large lists as IN params
    entry_subq = (
        select(models_pg.BooksJournalEntry.id).where(
            models_pg.BooksJournalEntry.company_id == cid,
            models_pg.BooksJournalEntry.status == "posted",
            models_pg.BooksJournalEntry.entry_date >= fd,
            models_pg.BooksJournalEntry.entry_date <= td,
        ).scalar_subquery()
    )

    # Fetch all accounts for P&L
    accounts = (await db.execute(
        select(models_pg.BooksAccount).where(
            models_pg.BooksAccount.company_id == cid,
            models_pg.BooksAccount.account_type.in_(["income", "expense"]),
            models_pg.BooksAccount.is_active == True,
        ).order_by(models_pg.BooksAccount.code)
    )).scalars().all()

    # One grouped query for all account totals — replaces N×2 per-account queries
    agg_rows = (await db.execute(
        select(
            models_pg.BooksJournalLine.account_id,
            func.coalesce(func.sum(models_pg.BooksJournalLine.debit), 0).label("total_debit"),
            func.coalesce(func.sum(models_pg.BooksJournalLine.credit), 0).label("total_credit"),
        ).where(
            models_pg.BooksJournalLine.entry_id.in_(entry_subq),
        ).group_by(models_pg.BooksJournalLine.account_id)
    )).all()
    line_totals = {r.account_id: (Decimal(str(r.total_debit)), Decimal(str(r.total_credit))) for r in agg_rows}

    rows = []
    total_income = Decimal("0")
    total_expense = Decimal("0")

    for acct in accounts:
        debits, credits = line_totals.get(acct.id, (Decimal("0"), Decimal("0")))
        amount = credits - debits if acct.account_type == "income" else debits - credits
        if amount == Decimal("0"):
            continue
        rows.append({"account": _serialize_account(acct), "amount": float(amount)})
        if acct.account_type == "income":
            total_income += amount
        else:
            total_expense += amount

    return {
        "from_date": from_date, "to_date": to_date,
        "rows": rows,
        "total_income": float(total_income),
        "total_expenses": float(total_expense),
        "net_profit": float(total_income - total_expense),
    }


@router.get("/reports/balance-sheet")
async def report_balance_sheet(
    as_of: str = Query(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Balance sheet as of a given date. Assets = Liabilities + Equity."""
    cid = current_user.company_id
    as_of_date = date.fromisoformat(as_of)

    entry_subq = (
        select(models_pg.BooksJournalEntry.id).where(
            models_pg.BooksJournalEntry.company_id == cid,
            models_pg.BooksJournalEntry.status == "posted",
            models_pg.BooksJournalEntry.entry_date <= as_of_date,
        ).scalar_subquery()
    )

    agg_result = await db.execute(
        select(
            models_pg.BooksJournalLine.account_id,
            func.coalesce(func.sum(models_pg.BooksJournalLine.debit), 0).label("total_debit"),
            func.coalesce(func.sum(models_pg.BooksJournalLine.credit), 0).label("total_credit"),
        ).where(
            models_pg.BooksJournalLine.entry_id.in_(entry_subq)
        ).group_by(models_pg.BooksJournalLine.account_id)
    )
    balances = {row.account_id: (Decimal(str(row.total_debit)), Decimal(str(row.total_credit))) for row in agg_result}

    accounts_result = await db.execute(
        select(models_pg.BooksAccount).where(
            models_pg.BooksAccount.company_id == cid,
            models_pg.BooksAccount.account_type.in_(["asset", "liability", "equity"]),
            models_pg.BooksAccount.is_active == True,
        ).order_by(models_pg.BooksAccount.code)
    )
    accounts = accounts_result.scalars().all()

    sections = {"asset": [], "liability": [], "equity": []}
    totals = {"asset": Decimal("0"), "liability": Decimal("0"), "equity": Decimal("0")}

    for acct in accounts:
        dr, cr = balances.get(acct.id, (Decimal("0"), Decimal("0")))
        # Normal balance: assets = debit-normal, liabilities/equity = credit-normal
        balance = dr - cr if acct.account_type == "asset" else cr - dr
        sections[acct.account_type].append({
            **_serialize_account(acct),
            "balance": float(balance),
        })
        totals[acct.account_type] += balance

    return {
        "as_of": as_of,
        "assets": sections["asset"],
        "liabilities": sections["liability"],
        "equity": sections["equity"],
        "total_assets": float(totals["asset"]),
        "total_liabilities": float(totals["liability"]),
        "total_equity": float(totals["equity"]),
        "total_liabilities_and_equity": float(totals["liability"] + totals["equity"]),
        "is_balanced": abs(totals["asset"] - (totals["liability"] + totals["equity"])) < Decimal("0.01"),
    }


@router.get("/reports/trial-balance")
async def report_trial_balance(
    as_of: str = Query(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cid = current_user.company_id
    as_of_date = date.fromisoformat(as_of)

    tb_entry_subq = (
        select(models_pg.BooksJournalEntry.id).where(
            models_pg.BooksJournalEntry.company_id == cid,
            models_pg.BooksJournalEntry.status == "posted",
            models_pg.BooksJournalEntry.entry_date <= as_of_date,
        ).scalar_subquery()
    )

    agg_result = await db.execute(
        select(
            models_pg.BooksJournalLine.account_id,
            func.coalesce(func.sum(models_pg.BooksJournalLine.debit), 0).label("total_debit"),
            func.coalesce(func.sum(models_pg.BooksJournalLine.credit), 0).label("total_credit"),
        ).where(
            models_pg.BooksJournalLine.entry_id.in_(tb_entry_subq)
        ).group_by(models_pg.BooksJournalLine.account_id)
    )
    line_balances = {row.account_id: (Decimal(str(row.total_debit)), Decimal(str(row.total_credit))) for row in agg_result}

    accounts_result = await db.execute(
        select(models_pg.BooksAccount).where(
            models_pg.BooksAccount.company_id == cid,
            models_pg.BooksAccount.is_active == True,
        ).order_by(models_pg.BooksAccount.code)
    )
    accounts = accounts_result.scalars().all()

    rows = []
    total_dr = Decimal("0")
    total_cr = Decimal("0")

    for acct in accounts:
        dr, cr = line_balances.get(acct.id, (Decimal("0"), Decimal("0")))
        if dr == Decimal("0") and cr == Decimal("0"):
            continue
        rows.append({
            **_serialize_account(acct),
            "total_debit": float(dr),
            "total_credit": float(cr),
        })
        total_dr += dr
        total_cr += cr

    return {
        "as_of": as_of,
        "rows": rows,
        "total_debit": float(total_dr),
        "total_credit": float(total_cr),
        "is_balanced": abs(total_dr - total_cr) < Decimal("0.01"),
    }


@router.get("/reports/tax-summary")
async def report_tax_summary(
    from_date: str = Query(...),
    to_date: str = Query(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """GST output (collected) vs GST input (paid on expenses), grouped by month."""
    cid = current_user.company_id
    fd = date.fromisoformat(from_date)
    td = date.fromisoformat(to_date)

    # Get all posted entries in range
    entries_result = await db.execute(
        select(
            models_pg.BooksJournalEntry.id,
            models_pg.BooksJournalEntry.entry_date,
        ).where(
            models_pg.BooksJournalEntry.company_id == cid,
            models_pg.BooksJournalEntry.status == "posted",
            models_pg.BooksJournalEntry.entry_date >= fd,
            models_pg.BooksJournalEntry.entry_date <= td,
        )
    )
    entries = entries_result.all()
    if not entries:
        return {"from_date": from_date, "to_date": to_date, "months": [], "total_output": 0, "total_input": 0, "net_payable": 0}

    entry_date_map = {e.id: e.entry_date for e in entries}
    entry_ids = list(entry_date_map.keys())

    # Find GST Payable account (code 2200)
    gst_acct = (await db.execute(
        select(models_pg.BooksAccount).where(
            models_pg.BooksAccount.company_id == cid,
            models_pg.BooksAccount.code == "2200",
        )
    )).scalar_one_or_none()

    # GST output = credits on 2200 (GST Payable)
    output_by_month: dict = {}
    if gst_acct:
        output_result = await db.execute(
            select(
                models_pg.BooksJournalLine.entry_id,
                func.coalesce(func.sum(models_pg.BooksJournalLine.credit), 0).label("gst_output"),
            ).where(
                models_pg.BooksJournalLine.entry_id.in_(entry_ids),
                models_pg.BooksJournalLine.account_id == gst_acct.id,
            ).group_by(models_pg.BooksJournalLine.entry_id)
        )
        for row in output_result:
            entry_date = entry_date_map[row.entry_id]
            key = f"{entry_date.year}-{entry_date.month:02d}"
            output_by_month[key] = output_by_month.get(key, Decimal("0")) + Decimal(str(row.gst_output))

    # GST input = tax_amount on journal lines for expense entries
    input_by_month: dict = {}
    input_result = await db.execute(
        select(
            models_pg.BooksJournalLine.entry_id,
            func.coalesce(func.sum(models_pg.BooksJournalLine.tax_amount), 0).label("gst_input"),
        ).where(
            models_pg.BooksJournalLine.entry_id.in_(entry_ids),
            models_pg.BooksJournalLine.tax_amount > 0,
        ).group_by(models_pg.BooksJournalLine.entry_id)
    )
    for row in input_result:
        entry_date = entry_date_map[row.entry_id]
        key = f"{entry_date.year}-{entry_date.month:02d}"
        input_by_month[key] = input_by_month.get(key, Decimal("0")) + Decimal(str(row.gst_input))

    all_months = sorted(set(list(output_by_month.keys()) + list(input_by_month.keys())))
    total_output = sum(output_by_month.values(), Decimal("0"))
    total_input = sum(input_by_month.values(), Decimal("0"))

    return {
        "from_date": from_date, "to_date": to_date,
        "months": [
            {
                "month": m,
                "gst_output": float(output_by_month.get(m, Decimal("0"))),
                "gst_input": float(input_by_month.get(m, Decimal("0"))),
                "net_payable": float(output_by_month.get(m, Decimal("0")) - input_by_month.get(m, Decimal("0"))),
            }
            for m in all_months
        ],
        "total_output": float(total_output),
        "total_input": float(total_input),
        "net_payable": float(total_output - total_input),
    }


@router.get("/reports/cash-flow")
async def report_cash_flow(
    from_date: str = Query(...),
    to_date: str = Query(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Simplified cash flow: operating inflows (revenue credits) and outflows (expense debits) for the period."""
    cid = current_user.company_id
    fd = date.fromisoformat(from_date)
    td = date.fromisoformat(to_date)

    entry_ids = (await db.execute(
        select(models_pg.BooksJournalEntry.id).where(
            models_pg.BooksJournalEntry.company_id == cid,
            models_pg.BooksJournalEntry.status == "posted",
            models_pg.BooksJournalEntry.entry_date >= fd,
            models_pg.BooksJournalEntry.entry_date <= td,
        )
    )).scalars().all()

    if not entry_ids:
        return {"from_date": from_date, "to_date": to_date, "inflows": [], "outflows": [],
                "total_inflows": 0, "total_outflows": 0, "net_cash_flow": 0}

    # Cash account IDs (1000 and 1010)
    cash_accts = (await db.execute(
        select(models_pg.BooksAccount).where(
            models_pg.BooksAccount.company_id == cid,
            models_pg.BooksAccount.code.in_(["1000", "1010"]),
        )
    )).scalars().all()
    cash_ids = [a.id for a in cash_accts]

    # Inflows = debits to cash accounts (money coming in)
    inflow_result = await db.execute(
        select(
            models_pg.BooksJournalEntry.source_module,
            func.coalesce(func.sum(models_pg.BooksJournalLine.debit), 0).label("amount"),
        ).join(
            models_pg.BooksJournalEntry,
            models_pg.BooksJournalLine.entry_id == models_pg.BooksJournalEntry.id
        ).where(
            models_pg.BooksJournalLine.entry_id.in_(entry_ids),
            models_pg.BooksJournalLine.account_id.in_(cash_ids),
            models_pg.BooksJournalLine.debit > 0,
        ).group_by(models_pg.BooksJournalEntry.source_module)
    )

    # Outflows = credits to cash accounts (money going out)
    outflow_result = await db.execute(
        select(
            models_pg.BooksJournalEntry.source_module,
            func.coalesce(func.sum(models_pg.BooksJournalLine.credit), 0).label("amount"),
        ).join(
            models_pg.BooksJournalEntry,
            models_pg.BooksJournalLine.entry_id == models_pg.BooksJournalEntry.id
        ).where(
            models_pg.BooksJournalLine.entry_id.in_(entry_ids),
            models_pg.BooksJournalLine.account_id.in_(cash_ids),
            models_pg.BooksJournalLine.credit > 0,
        ).group_by(models_pg.BooksJournalEntry.source_module)
    )

    MODULE_LABELS = {
        "booking": "Booking Payments", "membership": "Membership Fees",
        "marketplace": "Marketplace Subscriptions", "invoice": "Invoice Payments",
        "inventory": "Inventory Purchases", "manual": "Manual Entries",
    }
    inflows = [{"source": MODULE_LABELS.get(r.source_module, r.source_module or "Other"), "amount": float(r.amount)} for r in inflow_result if r.amount > 0]
    outflows = [{"source": MODULE_LABELS.get(r.source_module, r.source_module or "Other"), "amount": float(r.amount)} for r in outflow_result if r.amount > 0]
    total_in = sum(r["amount"] for r in inflows)
    total_out = sum(r["amount"] for r in outflows)

    return {
        "from_date": from_date, "to_date": to_date,
        "inflows": inflows, "outflows": outflows,
        "total_inflows": total_in, "total_outflows": total_out,
        "net_cash_flow": total_in - total_out,
    }


@router.get("/reports/aged-receivables")
async def report_aged_receivables(
    as_of: str = Query(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Outstanding invoices bucketed by age."""
    cid = current_user.company_id
    as_of_date = date.fromisoformat(as_of)

    result = await db.execute(
        select(models_pg.Invoice).where(
            models_pg.Invoice.company_id == cid,
            models_pg.Invoice.status.in_(["sent", "partially_paid", "overdue"]),
            models_pg.Invoice.issue_date <= as_of_date,
        ).order_by(models_pg.Invoice.due_date)
    )
    invoices = result.scalars().all()

    buckets = {"current": [], "1_30": [], "31_60": [], "61_90": [], "over_90": []}

    for inv in invoices:
        outstanding = float((inv.total_amount or 0)) - float((inv.paid_amount or 0))
        if outstanding <= 0:
            continue
        ref_date = inv.due_date or inv.issue_date
        days_overdue = (as_of_date - ref_date).days if ref_date else 0
        record = {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "customer_name": inv.customer_name,
            "issue_date": inv.issue_date.isoformat() if inv.issue_date else None,
            "due_date": inv.due_date.isoformat() if inv.due_date else None,
            "total_amount": float(inv.total_amount or 0),
            "outstanding": outstanding,
            "days_overdue": max(0, days_overdue),
        }
        if days_overdue <= 0:
            buckets["current"].append(record)
        elif days_overdue <= 30:
            buckets["1_30"].append(record)
        elif days_overdue <= 60:
            buckets["31_60"].append(record)
        elif days_overdue <= 90:
            buckets["61_90"].append(record)
        else:
            buckets["over_90"].append(record)

    def bucket_total(items):
        return sum(i["outstanding"] for i in items)

    return {
        "as_of": as_of,
        "buckets": buckets,
        "totals": {k: bucket_total(v) for k, v in buckets.items()},
        "grand_total": sum(bucket_total(v) for v in buckets.values()),
    }


@router.get("/reports/aged-payables")
async def report_aged_payables(
    as_of: str = Query(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Outstanding bills bucketed by age."""
    cid = current_user.company_id
    as_of_date = date.fromisoformat(as_of)

    result = await db.execute(
        select(models_pg.BooksBill).where(
            models_pg.BooksBill.company_id == cid,
            models_pg.BooksBill.status.in_(["unpaid", "partial"]),
            models_pg.BooksBill.bill_date <= as_of_date,
        ).order_by(models_pg.BooksBill.due_date)
    )
    bills = result.scalars().all()

    buckets = {"current": [], "1_30": [], "31_60": [], "61_90": [], "over_90": []}

    for bill in bills:
        outstanding = float((bill.total_amount or 0)) - float((bill.paid_amount or 0))
        if outstanding <= 0:
            continue
        ref_date = bill.due_date or bill.bill_date
        days_overdue = (as_of_date - ref_date).days if ref_date else 0
        record = {
            "id": bill.id,
            "bill_number": bill.bill_number,
            "vendor_name": bill.vendor_name,
            "bill_date": bill.bill_date.isoformat() if bill.bill_date else None,
            "due_date": bill.due_date.isoformat() if bill.due_date else None,
            "total_amount": float(bill.total_amount or 0),
            "outstanding": outstanding,
            "days_overdue": max(0, days_overdue),
        }
        if days_overdue <= 0:
            buckets["current"].append(record)
        elif days_overdue <= 30:
            buckets["1_30"].append(record)
        elif days_overdue <= 60:
            buckets["31_60"].append(record)
        elif days_overdue <= 90:
            buckets["61_90"].append(record)
        else:
            buckets["over_90"].append(record)

    def bucket_total(items):
        return sum(i["outstanding"] for i in items)

    return {
        "as_of": as_of,
        "buckets": buckets,
        "totals": {k: bucket_total(v) for k, v in buckets.items()},
        "grand_total": sum(bucket_total(v) for v in buckets.values()),
    }
