"""
Double-entry ledger service for the Books module.

Call post_financial_event() from any route after a financial transaction occurs.
If Books is not activated for the company, the call is a silent no-op.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import models_pg

logger = logging.getLogger(__name__)

# System account codes (must match books_seed.py)
CODE_BANK = "1010"
CODE_CASH = "1000"
CODE_AR = "1100"
CODE_INVENTORY = "1200"
CODE_AP = "2000"
CODE_DEFERRED_REVENUE = "2100"
CODE_GST_PAYABLE = "2200"
CODE_SERVICE_REVENUE = "4000"
CODE_MEMBERSHIP_REVENUE = "4010"
CODE_PRODUCT_REVENUE = "4020"
CODE_MARKETPLACE_REVENUE = "4030"
CODE_COGS = "5000"
CODE_MISC_EXPENSE = "5500"


async def _get_settings(db: AsyncSession, company_id: str) -> Optional[models_pg.BooksSettings]:
    result = await db.execute(
        select(models_pg.BooksSettings).where(models_pg.BooksSettings.company_id == company_id)
    )
    return result.scalar_one_or_none()


async def _get_account(db: AsyncSession, company_id: str, code: str) -> Optional[models_pg.BooksAccount]:
    result = await db.execute(
        select(models_pg.BooksAccount).where(
            models_pg.BooksAccount.company_id == company_id,
            models_pg.BooksAccount.code == code,
            models_pg.BooksAccount.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def _next_entry_number(db: AsyncSession, company_id: str) -> str:
    from sqlalchemy import update as _update
    year = datetime.now(timezone.utc).year
    result = await db.execute(
        _update(models_pg.BooksSettings)
        .where(models_pg.BooksSettings.company_id == company_id)
        .values(next_entry_number=models_pg.BooksSettings.next_entry_number + 1)
        .returning(models_pg.BooksSettings.next_entry_number)
    )
    row = result.fetchone()
    num = row[0] if row else 1
    return f"JE-{year}-{num:05d}"


async def _update_account_balance(
    db: AsyncSession,
    company_id: str,
    account_id: str,
    entry_date: date,
    debit: Decimal,
    credit: Decimal,
    account_type: str = "asset",
) -> None:
    fiscal_year = entry_date.year
    period_month = entry_date.month

    result = await db.execute(
        select(models_pg.BooksAccountBalance).where(
            models_pg.BooksAccountBalance.company_id == company_id,
            models_pg.BooksAccountBalance.account_id == account_id,
            models_pg.BooksAccountBalance.fiscal_year == fiscal_year,
            models_pg.BooksAccountBalance.period_month == period_month,
        )
    )
    bal = result.scalar_one_or_none()

    if bal is None:
        bal = models_pg.BooksAccountBalance(
            id=str(uuid.uuid4()),
            company_id=company_id,
            account_id=account_id,
            fiscal_year=fiscal_year,
            period_month=period_month,
            opening_balance=Decimal("0"),
            total_debits=Decimal("0"),
            total_credits=Decimal("0"),
            closing_balance=Decimal("0"),
        )
        db.add(bal)

    bal.total_debits = (bal.total_debits or Decimal("0")) + debit
    bal.total_credits = (bal.total_credits or Decimal("0")) + credit
    opening = bal.opening_balance or Decimal("0")
    # debit-normal accounts (asset, expense): balance = debits - credits
    # credit-normal accounts (liability, equity, income): balance = credits - debits
    if account_type in ("asset", "expense"):
        bal.closing_balance = opening + bal.total_debits - bal.total_credits
    else:
        bal.closing_balance = opening + bal.total_credits - bal.total_debits
    bal.updated_at = datetime.now(timezone.utc)


async def _already_posted(db: AsyncSession, company_id: str, source_module: str, source_id: str) -> bool:
    result = await db.execute(
        select(models_pg.BooksJournalEntry.id).where(
            models_pg.BooksJournalEntry.company_id == company_id,
            models_pg.BooksJournalEntry.source_module == source_module,
            models_pg.BooksJournalEntry.source_id == source_id,
            models_pg.BooksJournalEntry.status == "posted",
        )
    )
    return result.scalar_one_or_none() is not None


async def _create_entry(
    db: AsyncSession,
    company_id: str,
    entry_date: date,
    description: str,
    source_module: str,
    source_id: str,
    source_type: str,
    lines: list[dict],  # [{"account_code": str, "debit": Decimal, "credit": Decimal, "description": str}]
    created_by: Optional[str] = None,
) -> Optional[models_pg.BooksJournalEntry]:
    """Create a balanced journal entry. Returns None if any account code is missing."""
    resolved_lines = []
    for line in lines:
        # Lines may specify account by ID (preferred) or by code
        if line.get("account_id"):
            from sqlalchemy import select as _select
            result = await db.execute(
                _select(models_pg.BooksAccount).where(
                    models_pg.BooksAccount.id == line["account_id"],
                    models_pg.BooksAccount.company_id == company_id,
                )
            )
            acct = result.scalar_one_or_none()
        else:
            acct = await _get_account(db, company_id, line["account_code"])
        if acct is None:
            ref = line.get("account_id") or line.get("account_code", "?")
            logger.warning(f"[Books] account {ref} not found for company {company_id} — skipping entry")
            return None
        resolved_lines.append({**line, "account_id": acct.id, "_account_type": acct.account_type})

    entry = models_pg.BooksJournalEntry(
        id=str(uuid.uuid4()),
        company_id=company_id,
        entry_number=await _next_entry_number(db, company_id),
        entry_date=entry_date,
        description=description,
        source_module=source_module,
        source_id=source_id,
        source_type=source_type,
        status="posted",
        is_auto_posted=True,
        created_by=created_by,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)

    for i, line in enumerate(resolved_lines):
        debit = Decimal(str(line.get("debit", 0)))
        credit = Decimal(str(line.get("credit", 0)))
        jl = models_pg.BooksJournalLine(
            id=str(uuid.uuid4()),
            entry_id=entry.id,
            account_id=line["account_id"],
            company_id=company_id,
            debit=debit,
            credit=credit,
            description=line.get("description", ""),
            tax_amount=Decimal(str(line.get("tax_amount", 0))),
            currency="INR",
            line_order=i,
        )
        db.add(jl)
        await _update_account_balance(
            db, company_id, line["account_id"], entry_date, debit, credit,
            account_type=line.get("_account_type", "asset"),
        )

    return entry


# ─────────────────────────────────────────────────────────────────────────────
# Public interface
# ─────────────────────────────────────────────────────────────────────────────

async def post_financial_event(
    db: AsyncSession,
    company_id: str,
    event_type: str,
    source_id: str,
    amount: float,
    metadata: dict,
) -> Optional[models_pg.BooksJournalEntry]:
    """
    Route-callable hook. Returns None if Books is not activated or already posted.
    Does NOT commit — the caller's transaction handles commit.
    """
    try:
        settings = await _get_settings(db, company_id)
        if settings is None:
            return None  # Books not activated

        # Auto-post flag checks
        if event_type in ("booking_payment", "booking_refund") and not settings.auto_post_bookings:
            return None
        if event_type in ("membership_enrollment", "membership_renewal", "membership_amortization") and not settings.auto_post_memberships:
            return None
        if event_type == "marketplace_subscription" and not settings.auto_post_marketplace:
            return None
        if event_type in ("inventory_purchase", "inventory_cogs") and not settings.auto_post_inventory:
            return None

        source_module = _module_for_event(event_type)
        if await _already_posted(db, company_id, source_module, source_id):
            return None

        amt = Decimal(str(amount))
        today = date.today()
        entry_date = metadata.get("entry_date", today)
        if isinstance(entry_date, str):
            entry_date = date.fromisoformat(entry_date)

        return await _dispatch(db, company_id, event_type, source_id, source_module, amt, entry_date, metadata)

    except Exception as e:
        logger.error(f"[Books] post_financial_event error ({event_type}, {source_id}): {e}")
        return None


def _module_for_event(event_type: str) -> str:
    mapping = {
        "booking_payment": "booking",
        "booking_refund": "booking",
        "membership_enrollment": "membership",
        "membership_renewal": "membership",
        "membership_amortization": "membership",
        "marketplace_subscription": "marketplace",
        "inventory_purchase": "inventory",
        "inventory_cogs": "inventory",
        "invoice_payment": "invoice",
        "invoice_ar_posted": "invoice",
        "bill_created": "bill",
        "bill_payment": "bill",
    }
    return mapping.get(event_type, "manual")


async def _dispatch(
    db: AsyncSession,
    company_id: str,
    event_type: str,
    source_id: str,
    source_module: str,
    amt: Decimal,
    entry_date: date,
    metadata: dict,
) -> Optional[models_pg.BooksJournalEntry]:

    if event_type == "booking_payment":
        service_amt = Decimal(str(metadata.get("service_amount", amt)))
        items_amt = Decimal(str(metadata.get("items_total", 0)))
        tax_amt = Decimal(str(metadata.get("tax_amount", 0)))
        description = metadata.get("description", f"Booking payment {source_id}")
        lines = [{"account_code": CODE_BANK, "debit": amt, "credit": Decimal("0"), "description": description}]
        if service_amt > 0:
            lines.append({"account_code": CODE_SERVICE_REVENUE, "debit": Decimal("0"), "credit": service_amt})
        if items_amt > 0:
            lines.append({"account_code": CODE_PRODUCT_REVENUE, "debit": Decimal("0"), "credit": items_amt})
        if tax_amt > 0:
            lines.append({"account_code": CODE_GST_PAYABLE, "debit": Decimal("0"), "credit": tax_amt, "tax_amount": tax_amt})
        # Balance any rounding gap into service revenue
        total_cr = (service_amt + items_amt + tax_amt)
        if total_cr == Decimal("0"):
            lines.append({"account_code": CODE_SERVICE_REVENUE, "debit": Decimal("0"), "credit": amt})
        return await _create_entry(db, company_id, entry_date, description, source_module, source_id, event_type, lines)

    elif event_type == "booking_refund":
        description = metadata.get("description", f"Booking refund {source_id}")
        lines = [
            {"account_code": CODE_SERVICE_REVENUE, "debit": amt, "credit": Decimal("0"), "description": description},
            {"account_code": CODE_BANK, "debit": Decimal("0"), "credit": amt},
        ]
        return await _create_entry(db, company_id, entry_date, description, source_module, source_id, event_type, lines)

    elif event_type == "membership_enrollment":
        description = metadata.get("description", f"Membership enrollment {source_id}")
        monthly = Decimal(str(metadata.get("monthly_portion", amt)))
        deferred = amt - monthly
        lines = [{"account_code": CODE_BANK, "debit": amt, "credit": Decimal("0"), "description": description}]
        if deferred > 0:
            lines.append({"account_code": CODE_DEFERRED_REVENUE, "debit": Decimal("0"), "credit": deferred})
        if monthly > 0:
            lines.append({"account_code": CODE_MEMBERSHIP_REVENUE, "debit": Decimal("0"), "credit": monthly})
        return await _create_entry(db, company_id, entry_date, description, source_module, source_id, event_type, lines)

    elif event_type == "membership_renewal":
        description = metadata.get("description", f"Membership renewal {source_id}")
        lines = [
            {"account_code": CODE_BANK, "debit": amt, "credit": Decimal("0"), "description": description},
            {"account_code": CODE_MEMBERSHIP_REVENUE, "debit": Decimal("0"), "credit": amt},
        ]
        return await _create_entry(db, company_id, entry_date, description, source_module, source_id, event_type, lines)

    elif event_type == "membership_amortization":
        description = metadata.get("description", f"Membership revenue recognition {source_id}")
        lines = [
            {"account_code": CODE_DEFERRED_REVENUE, "debit": amt, "credit": Decimal("0"), "description": description},
            {"account_code": CODE_MEMBERSHIP_REVENUE, "debit": Decimal("0"), "credit": amt},
        ]
        return await _create_entry(db, company_id, entry_date, description, source_module, source_id, event_type, lines)

    elif event_type == "marketplace_subscription":
        description = metadata.get("description", f"Marketplace subscription {source_id}")
        lines = [
            {"account_code": CODE_BANK, "debit": amt, "credit": Decimal("0"), "description": description},
            {"account_code": CODE_MARKETPLACE_REVENUE, "debit": Decimal("0"), "credit": amt},
        ]
        return await _create_entry(db, company_id, entry_date, description, source_module, source_id, event_type, lines)

    elif event_type == "inventory_purchase":
        description = metadata.get("description", f"Inventory purchase {source_id}")
        is_cash = metadata.get("is_cash", True)
        credit_code = CODE_BANK if is_cash else CODE_AP
        lines = [
            {"account_code": CODE_INVENTORY, "debit": amt, "credit": Decimal("0"), "description": description},
            {"account_code": credit_code, "debit": Decimal("0"), "credit": amt},
        ]
        return await _create_entry(db, company_id, entry_date, description, source_module, source_id, event_type, lines)

    elif event_type == "inventory_cogs":
        description = metadata.get("description", f"Cost of goods sold {source_id}")
        lines = [
            {"account_code": CODE_COGS, "debit": amt, "credit": Decimal("0"), "description": description},
            {"account_code": CODE_INVENTORY, "debit": Decimal("0"), "credit": amt},
        ]
        return await _create_entry(db, company_id, entry_date, description, source_module, source_id, event_type, lines)

    elif event_type == "invoice_payment":
        description = metadata.get("description", f"Invoice payment {source_id}")
        lines = [
            {"account_code": CODE_BANK, "debit": amt, "credit": Decimal("0"), "description": description},
            {"account_code": CODE_AR, "debit": Decimal("0"), "credit": amt},
        ]
        return await _create_entry(db, company_id, entry_date, description, source_module, source_id, event_type, lines)

    elif event_type == "invoice_ar_posted":
        # DR: Accounts Receivable / CR: Revenue + GST — posted when invoice is sent
        subtotal = Decimal(str(metadata.get("subtotal", amt)))
        tax_amt = Decimal(str(metadata.get("tax_amount", 0)))
        description = metadata.get("description", f"Invoice issued {source_id}")
        lines = [
            {"account_code": CODE_AR, "debit": amt, "credit": Decimal("0"), "description": description},
        ]
        if subtotal > 0:
            lines.append({"account_code": CODE_SERVICE_REVENUE, "debit": Decimal("0"), "credit": subtotal})
        if tax_amt > 0:
            lines.append({"account_code": CODE_GST_PAYABLE, "debit": Decimal("0"), "credit": tax_amt, "tax_amount": tax_amt})
        if subtotal == Decimal("0") and tax_amt == Decimal("0"):
            lines.append({"account_code": CODE_SERVICE_REVENUE, "debit": Decimal("0"), "credit": amt})
        return await _create_entry(db, company_id, entry_date, description, source_module, source_id, event_type, lines)

    elif event_type == "bill_created":
        # DR: Expense account / CR: Accounts Payable — posted when bill is recorded
        description = metadata.get("description", f"Bill from vendor {source_id}")
        expense_account_id = metadata.get("expense_account_id")
        expense_line = {
            "debit": amt, "credit": Decimal("0"), "description": description,
        }
        if expense_account_id:
            expense_line["account_id"] = expense_account_id
        else:
            expense_line["account_code"] = CODE_MISC_EXPENSE
        lines = [
            expense_line,
            {"account_code": CODE_AP, "debit": Decimal("0"), "credit": amt},
        ]
        return await _create_entry(db, company_id, entry_date, description, source_module, source_id, event_type, lines)

    elif event_type == "bill_payment":
        # DR: Accounts Payable / CR: Bank — posted when a bill is paid
        description = metadata.get("description", f"Bill payment {source_id}")
        lines = [
            {"account_code": CODE_AP, "debit": amt, "credit": Decimal("0"), "description": description},
            {"account_code": CODE_BANK, "debit": Decimal("0"), "credit": amt},
        ]
        return await _create_entry(db, company_id, entry_date, description, source_module, source_id, event_type, lines)

    return None


async def void_journal_entry(
    db: AsyncSession,
    entry_id: str,
    company_id: str,
    voided_by: str,
    void_reason: str,
) -> Optional[models_pg.BooksJournalEntry]:
    """Void a journal entry by creating a reversing entry and marking original voided."""
    result = await db.execute(
        select(models_pg.BooksJournalEntry).where(
            models_pg.BooksJournalEntry.id == entry_id,
            models_pg.BooksJournalEntry.company_id == company_id,
        )
    )
    entry = result.scalar_one_or_none()
    if entry is None or entry.status != "posted":
        return None

    lines_result = await db.execute(
        select(models_pg.BooksJournalLine).where(models_pg.BooksJournalLine.entry_id == entry_id)
    )
    original_lines = lines_result.scalars().all()

    # Load account types in one query so reversals use the correct balance formula
    acct_ids = list({l.account_id for l in original_lines})
    accts_result = await db.execute(
        select(models_pg.BooksAccount.id, models_pg.BooksAccount.account_type).where(
            models_pg.BooksAccount.id.in_(acct_ids)
        )
    )
    acct_type_map = {row.id: row.account_type for row in accts_result}

    # Mark original voided
    entry.status = "voided"
    entry.voided_at = datetime.now(timezone.utc)
    entry.voided_by = voided_by
    entry.void_reason = void_reason

    # Create reversing entry
    reversing = models_pg.BooksJournalEntry(
        id=str(uuid.uuid4()),
        company_id=company_id,
        entry_number=await _next_entry_number(db, company_id),
        entry_date=date.today(),
        description=f"Reversal of {entry.entry_number}: {void_reason}",
        source_module=entry.source_module,
        source_id=entry.id,
        source_type="void_reversal",
        status="posted",
        is_auto_posted=True,
        created_by=voided_by,
        created_at=datetime.now(timezone.utc),
    )
    db.add(reversing)

    for line in original_lines:
        rev_line = models_pg.BooksJournalLine(
            id=str(uuid.uuid4()),
            entry_id=reversing.id,
            account_id=line.account_id,
            company_id=company_id,
            debit=line.credit,
            credit=line.debit,
            description=f"Reversal: {line.description or ''}",
            currency=line.currency,
            line_order=line.line_order,
        )
        db.add(rev_line)
        await _update_account_balance(
            db, company_id, line.account_id, date.today(),
            line.credit, line.debit,
            account_type=acct_type_map.get(line.account_id, "asset"),
        )

    return reversing
