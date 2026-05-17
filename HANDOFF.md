# Ri'Serve v9 — Developer Handoff

> Last updated: May 16, 2026. Covers the full platform as built — architecture, module status, key patterns, and known gaps.

---

## System Overview

Three services, one PostgreSQL database.

| Service | Stack | Port | Purpose |
|---|---|---|---|
| Backend | FastAPI + SQLAlchemy async + asyncpg | 8000 | REST API, background tasks |
| Frontend | React 19, CRA, Tailwind 3, Radix UI | 3001 | Admin / operator dashboard |
| Customer Portal | Next.js App Router, TypeScript, Tailwind 4 | 3002 | End-customer booking + account |

```
make start    # PostgreSQL + all three services (logs in .pids/)
make stop
make logs
make db-migrate  # alembic upgrade head
```

---

## Auth

### Admin / Staff JWT (`ridn_token`)
- Issued at `POST /api/auth/login`
- HS256, 7-day expiry, stored in `localStorage`
- Payload: `{ sub: user_id }`
- Decoded + validated by `get_current_user` in `routes/dependencies.py`
- Roles: `SuperAdmin`, `Admin`, `Manager`, `User`, `outlet_staff`, `recruiter`, `franchise_lead`, `analyst`

### Customer Portal JWT (`portal_token`)
- Issued at `POST /api/portal/customer/auth` (passwordless — email/phone lookup)
- Payload: `{ sub: customer_id, type: "customer" }`
- Validated by separate dependency in `routes/customer_portal_auth.py`
- **No refresh token infrastructure exists.** Tokens expire in 7 days; users must re-authenticate.

### Multi-tenancy
- Every resource is scoped by `company_id`
- `SuperAdmin` users have no `company_id` and can cross tenant boundaries
- `Manager`/`outlet_staff` are further scoped to specific outlet IDs via the `user_outlets` join table

---

## Subscription Plans & Feature Gates

Plans defined in `routes/dependencies.py::SUBSCRIPTION_PLANS`:

| Plan | Outlets | Bookings/mo | Key Features |
|---|---|---|---|
| trial | 3 | 100 | basic_booking, reports, feedback — auto-downgrades to free after 30 days |
| free | 1 | 50 | basic_booking, slot_manager |
| essential | 3 | 500 | + ai_assistant, agents_marketplace, ai_flows, **memberships** |
| pro | unlimited | unlimited | + books, api_access, priority_support |
| custom | unlimited | unlimited | all |

Feature gates use `require_feature(feature_name)` as a FastAPI router-level dependency. The function reads `Company.enabled_features` (JSONB array) from the DB — it does **not** derive from the plan; features must be explicitly backfilled when plans change.

Gated routers:
- `routes/books.py` → `require_feature("books")`
- `routes/memberships.py` → `require_feature("memberships")`
- `routes/marketplace.py` → `require_feature("agents_marketplace")`

To grant a feature to an existing company:
```sql
UPDATE companies
SET enabled_features = enabled_features || '["books"]'
WHERE id = '<company_id>';
```

---

## Database & Migrations

ORM: SQLAlchemy async (`models_pg.py`). Migrations: Alembic (`backend/alembic/`).

Migration chain tail: `s2t3u4v5w6x7` (counter columns for Books).

Key migration landmarks:

| Migration | What it adds |
|---|---|
| `3d204f8db1c4_init` | Core schema (companies, users, outlets, bookings, services, staff) |
| `b9c8d7e6f5a4_add_invoice_tables` | Invoices, invoice lines, invoice payments, invoice settings |
| `j3k4l5m6n7o8_add_unified_campaign_model` | Campaigns, submissions, submission events, attachments vault |
| `o8p9q0r1s2t3_add_memberships` | Membership plans, memberships, membership transactions, events |
| `q0r1s2t3u4v5_add_virtual_team_marketplace` | CompanyAgentTier, CompanyAgent, AgentRun, FlowDefinition |
| `r1s2t3u4v5w6_add_books_module` | 9 Books tables (accounts, journal entries, lines, balances, bills, etc.) |
| `s2t3u4v5w6x7_add_counter_columns` | `next_entry_number`, `next_bill_number` on `books_settings` |

**Number generation pattern** (race-condition safe):
```python
row = await db.execute(
    text("UPDATE books_settings SET next_entry_number = next_entry_number + 1 "
         "RETURNING next_entry_number WHERE company_id = :cid"),
    {"cid": company_id}
)
```
All three number generators (invoice, journal entry, bill) use this atomic UPDATE pattern. Do not use `SELECT … +1` without a lock.

---

## Books Module

Full double-entry accounting system gated behind `require_feature("books")`.

### Activation
`POST /api/books/activate` — seeds 20 system accounts + 6 GST tax codes via `services/books_seed.py`. Sets `books_settings.activated = true`. Frontend gates Ledger/Accounts/Bills/Reports tabs behind this flag.

### Ledger engine (`services/books_ledger.py`)
- `post_financial_event(db, company_id, event_type, source_id, amount, metadata)` — call from any route to create a journal entry
- Dispatches 12 event types: `booking_completed`, `invoice_ar_posted`, `invoice_payment`, `bill_created`, `bill_payment`, `membership_enrolled`, `membership_renewed`, `pos_sale`, `inventory_purchase`, `cogs_booking`, `refund_issued`, `marketplace_charge`
- Account balance formula is credit-normal aware — do not use a single `debit - credit` formula for all account types

### Known gaps in Books integration
- `POST /transactions/pos` (POS checkout) does **not** post to Books
- Booking stock deduction via `add_items_to_booking` does **not** post COGS
- `opening_balance` on `books_account_balances` never carries forward from prior months — all history queries from beginning of time

---

## Invoices

Router: `routes/invoices.py`, prefix `/api/invoices`.

### Number generation
Atomic `UPDATE invoice_settings SET next_number = next_number + 1 RETURNING next_number, prefix`.

### Status lifecycle
`draft → sent → partially_paid / paid / overdue` (overdue is computed, not stored). `void` and `cancelled` are terminal.

`_compute_status(inv)` recalculates overdue from `due_date` at read time — the `status` column may say `sent` while the computed status is `overdue`.

### Delivery (`POST /api/invoices/{id}/send`)
- Email via SendGrid (`SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`)
- WhatsApp via Cloud API (`WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`)
- Both channels best-effort; missing credentials are a silent no-op

### Books integration
- `send_invoice` posts `invoice_ar_posted` event (Dr AR / Cr Revenue)
- `mark_invoice_paid` posts `invoice_payment` event (Dr Cash / Cr AR)
- `record_payment` posts `invoice_payment` event

### Known gap
- `mark_invoice_paid` does **not** create an `InvoicePayment` record — only updates the Invoice. For audit trails, prefer `record_payment`.

---

## Memberships

Router: `routes/memberships.py`, prefix `/api/memberships`.  
Feature gate: `require_feature("memberships")`.

### Lifecycle
Enroll → active → (renew) → expired / cancelled. Each transition creates a `MembershipEvent` row.

### Books integration
- Enrollment posts `membership_enrolled` (Dr Cash / Cr Deferred Revenue)
- Renewal posts `membership_renewed`

### Background tasks
- `membership_expiry_background_task` — runs hourly, marks expired memberships
- `membership_amortization_background_task` — runs monthly, amortizes deferred revenue to earned revenue

---

## Marketplace (Virtual Team)

Router: `routes/marketplace.py`, prefix `/api/marketplace`.  
Feature gate: `require_feature("agents_marketplace")`.

### Tier system
Five tiers: `indie` (free), `startup`, `studio`, `firm`, `corp`. Defined in `TIER_DEFS` inside `marketplace.py`.

### Payment flow (paid tiers)
1. `POST /api/marketplace/tier/order` → creates Razorpay order, returns `{ order_id, amount, key_id }`
2. Frontend opens Razorpay checkout SDK
3. `POST /api/marketplace/tier/upgrade` → receives `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`; verifies HMAC; upgrades tier

Free tier (`indie`) skips steps 1–2 and calls `/tier/upgrade` directly with no payment fields.

### Token reset
`marketplace_token_reset_background_task` fires on the 1st of each month and resets `token_used_this_cycle = 0` for all `CompanyAgentTier` rows.

---

## Unified Campaigns & Submissions

### Campaign types (system-seeded, not tenant-scoped)
`customer_acquisition`, `talent_acquisition`, `franchise_development`, `vendor_sourcing`, `partnership_outreach`, `general_lead_gen`

### RBAC
| Role | Campaign scope | Write |
|---|---|---|
| SuperAdmin / Admin / Manager | All | Yes |
| outlet_staff | All | Yes |
| recruiter | talent_acquisition only | Yes |
| franchise_lead | franchise_development only | Yes |
| analyst | All | Read-only, PII redacted on sensitive class |

`get_campaign_type_scope(role)` returns the SQL `IN (...)` filter for restricted roles.

### Stage engine
- Effective stage set: `lifecycle_stages_override` on the campaign takes precedence over `campaign_type.default_stage_set`
- Stage keys are never hardcoded — use `_find_terminal_stage_key(stage_set, "won"/"lost")`
- `GET /api/submissions/stuck` — overdue submissions with SLA breach metadata

---

## Customer Portal

Next.js App Router at `customer-portal/`.

### Auth (`/api/portal/customer/auth`)
Passwordless. Lookup is case-insensitive (`func.lower(Customer.email) == email.lower()`). Returns JWT with `type: "customer"` claim stored as `portal_token` in localStorage.

### Routes implemented
- `GET /api/portal/customer/me` — profile + active membership
- `GET /api/portal/customer/bookings` — paginated booking history

### Known gap
- Booking cards display `booking.notes` as the service name. Fix: join to `services` table and return `service.name`.

---

## Background Tasks

All run as `asyncio.create_task` in the FastAPI lifespan context (`server.py`).

| Task | Frequency | Purpose |
|---|---|---|
| `trial_check_background_task` | Hourly | Auto-downgrade expired trials to free |
| `media_cleanup_background_task` | Periodic | Delete orphaned media assets |
| `acquisition_scheduler_background_task` | Periodic | WhatsApp campaign scheduling |
| `petpooja_polling_background_task` | Periodic | Petpooja menu sync |
| `membership_expiry_background_task` | Hourly | Mark expired memberships |
| `membership_amortization_background_task` | Monthly | Deferred revenue amortization |
| `marketplace_token_reset_background_task` | Monthly (1st) | Reset per-cycle token usage |

Tasks are fire-and-forget with internal exception handling. Failures are logged but do not crash the server.

---

## Key Integration Credentials (`.env`)

```
POSTGRES_URL=postgresql+asyncpg://localhost:5432/riserve_db
JWT_SECRET_KEY=
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
LITELLM_API_KEY=          # or OPENAI_API_KEY / GOOGLE_API_KEY
CORS_ORIGINS=http://localhost:3001,http://localhost:3002
```

---

## Pagination Contract

All list endpoints that were paginated follow this response shape:
```json
{ "items": [...], "total": 120, "page": 1, "pages": 6 }
```
Frontend reads `response.data.items || response.data || []` for backwards safety.

Paginated: `GET /api/bookings`, `GET /api/invoices`, `GET /api/transactions`, `GET /api/portal/customer/bookings`

**Not yet paginated:** Bills (`GET /api/books/bills` — hard limit 50), journal entries count query ignores active filters.

---

## Known Remaining Issues (Prioritized)

### Medium — correctness
| # | Issue | Location |
|---|---|---|
| 1 | `mark_invoice_paid` doesn't create an `InvoicePayment` record | `routes/invoices.py:mark_invoice_paid` |
| 2 | POS checkout (`POST /transactions/pos`) never posts to Books | `routes/transactions.py` |
| 3 | `add_items_to_booking` stock deduction doesn't post COGS entry | `routes/bookings.py` |
| 4 | `opening_balance` never carries forward between months | `services/books_ledger.py` |

### Medium — UX / data quality
| # | Issue | Location |
|---|---|---|
| 5 | Customer portal booking cards show `notes` as service name | `customer-portal/src/app/account/page.tsx` |
| 6 | Bills page has no pagination (silent 50-record cap) | `routes/books.py`, `frontend/Books/Bills.js` |
| 7 | Journal entries `total` count ignores active filters | `routes/books.py:list_journal_entries` |

### Low — hygiene
| # | Issue | Location |
|---|---|---|
| 8 | No JWT refresh token — users re-auth every 7 days | `routes/auth.py`, `routes/customer_portal_auth.py` |
| 9 | `Company.enabled_features` not auto-populated on plan upgrade — requires manual backfill | `routes/superadmin.py` or `routes/company.py` |

---

## Dev Utilities

```bash
# Re-seed dev account (Simulated Salon / admin@ridn.com)
cd backend && source venv/bin/activate && python3 restore_dev_account.py

# Seed headquarters data
cd backend && source venv/bin/activate && python3 seed_hq.py

# Run backend tests
cd backend && source venv/bin/activate && python3 -m pytest tests/

# Type-check portal
cd customer-portal && npx tsc --noEmit

# Lint frontend
cd frontend && npm run lint
```
