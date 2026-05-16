"""
Seed the Chart of Accounts and GST tax codes for a company on Books activation.
Called once from POST /books/settings/activate.
"""
from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

import models_pg

logger = logging.getLogger(__name__)

SYSTEM_ACCOUNTS = [
    # Assets
    {"code": "1000", "name": "Cash",                    "type": "asset",     "subtype": "current_asset"},
    {"code": "1010", "name": "Bank Account",            "type": "asset",     "subtype": "current_asset"},
    {"code": "1100", "name": "Accounts Receivable",     "type": "asset",     "subtype": "accounts_receivable"},
    {"code": "1200", "name": "Inventory Asset",         "type": "asset",     "subtype": "current_asset"},
    {"code": "1500", "name": "Prepaid Expenses",        "type": "asset",     "subtype": "current_asset"},
    # Liabilities
    {"code": "2000", "name": "Accounts Payable",        "type": "liability", "subtype": "accounts_payable"},
    {"code": "2100", "name": "Deferred Revenue",        "type": "liability", "subtype": "deferred_revenue"},
    {"code": "2200", "name": "GST Payable",             "type": "liability", "subtype": "tax_payable"},
    {"code": "2300", "name": "TDS Payable",             "type": "liability", "subtype": "tax_payable"},
    # Equity
    {"code": "3000", "name": "Owner's Equity",          "type": "equity",    "subtype": "retained_earnings"},
    # Income
    {"code": "4000", "name": "Service Revenue",         "type": "income",    "subtype": "operating_income"},
    {"code": "4010", "name": "Membership Revenue",      "type": "income",    "subtype": "operating_income"},
    {"code": "4020", "name": "Product Revenue",         "type": "income",    "subtype": "operating_income"},
    {"code": "4030", "name": "Marketplace Revenue",     "type": "income",    "subtype": "operating_income"},
    # Expenses
    {"code": "5000", "name": "Cost of Goods Sold",      "type": "expense",   "subtype": "cogs"},
    {"code": "5100", "name": "Staff Wages",             "type": "expense",   "subtype": "direct_expense"},
    {"code": "5200", "name": "Rent",                    "type": "expense",   "subtype": "indirect_expense"},
    {"code": "5300", "name": "Software & Subscriptions","type": "expense",   "subtype": "indirect_expense"},
    {"code": "5400", "name": "Marketing",               "type": "expense",   "subtype": "indirect_expense"},
    {"code": "5500", "name": "Miscellaneous",           "type": "expense",   "subtype": "indirect_expense"},
]

SYSTEM_TAX_CODES = [
    {"code": "GST5",   "name": "GST 5%",   "rate": "5.000",  "type": "gst",  "cgst": "2.500", "sgst": "2.500"},
    {"code": "GST12",  "name": "GST 12%",  "rate": "12.000", "type": "gst",  "cgst": "6.000", "sgst": "6.000"},
    {"code": "GST18",  "name": "GST 18%",  "rate": "18.000", "type": "gst",  "cgst": "9.000", "sgst": "9.000"},
    {"code": "GST28",  "name": "GST 28%",  "rate": "28.000", "type": "gst",  "cgst": "14.000","sgst": "14.000"},
    {"code": "IGST18", "name": "IGST 18%", "rate": "18.000", "type": "igst", "cgst": "0",     "sgst": "0"},
    {"code": "EXEMPT", "name": "Exempt",   "rate": "0.000",  "type": "none", "cgst": "0",     "sgst": "0"},
]


async def seed_books_for_company(db: AsyncSession, company_id: str) -> None:
    now = datetime.now(timezone.utc)

    for acct in SYSTEM_ACCOUNTS:
        db.add(models_pg.BooksAccount(
            id=str(uuid.uuid4()),
            company_id=company_id,
            code=acct["code"],
            name=acct["name"],
            account_type=acct["type"],
            account_subtype=acct["subtype"],
            is_system=True,
            is_active=True,
            currency="INR",
            created_at=now,
        ))

    for tc in SYSTEM_TAX_CODES:
        db.add(models_pg.BooksTaxCode(
            id=str(uuid.uuid4()),
            company_id=company_id,
            name=tc["name"],
            code=tc["code"],
            rate=tc["rate"],
            tax_type=tc["type"],
            component_cgst=tc["cgst"],
            component_sgst=tc["sgst"],
            is_system=True,
            is_active=True,
            created_at=now,
        ))

    logger.info(f"[Books] seeded {len(SYSTEM_ACCOUNTS)} accounts and {len(SYSTEM_TAX_CODES)} tax codes for company {company_id}")
