# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ri'Serve** — a multi-tenant service operations SaaS with three services:
- **Backend** (FastAPI, port 8000) — REST API + async background tasks
- **Frontend** (React/CRA, port 3001) — admin dashboard
- **Customer Portal** (Next.js, port 3002) — end-customer booking/menu/order interface

## Commands

### All services (background, with logs in `.pids/`)
```bash
make install      # Install all dependencies (backend venv + pip, frontend npm, portal npm)
make start        # Start PostgreSQL + all three services
make stop         # Stop all services (kills by PID and by port)
make logs         # Tail all logs
make logs-backend / logs-frontend / logs-portal
```

### Individual services (foreground)
```bash
make backend      # cd backend && uvicorn server:app --reload (port 8000)
make frontend     # cd frontend && PORT=3001 npm start
make portal       # cd customer-portal && PORT=3002 npm run dev
```

### Database
```bash
make db           # Start PostgreSQL via brew services
make db-migrate   # alembic upgrade head
make db-reset     # Drop, recreate, and re-migrate (interactive confirm)
```

### Backend tests
```bash
cd backend && source venv/bin/activate && python3 -m pytest tests/
```

### Frontend / portal checks
```bash
cd frontend && npm run lint
cd customer-portal && npm run lint
cd customer-portal && npx tsc --noEmit   # type check
```

## Architecture

### Backend (`backend/`)
- **Entry point**: `server.py` — mounts routers, configures CORS, starts background trial-expiry task (runs hourly via asyncio loop)
- **ORM**: `models_pg.py` (SQLAlchemy async models), `database_pg.py` (async engine + session)
- **Migrations**: Alembic in `alembic/`
- **Routes**: ~50 modules in `routes/` organized by domain (`auth`, `bookings`, `slots`, `services`, `outlets`, `staff`, `inventory`, `portal`, `razorpay`, `whatsapp`, `superadmin`, `hitl`, `unified_campaigns`, `submissions`, …)
- **Auth**: JWT tokens; roles: SuperAdmin, Admin, Manager, User, outlet_staff, recruiter, franchise_lead, analyst — enforced in `routes/dependencies.py`
- **Multi-tenancy**: All data scoped by `company_id` (called `tenant_id` in campaign tables)
- **Subscription tiers**: trial (30-day auto-downgrade to free), free, essential, pro, custom — plan limits live in `routes/dependencies.py::SUBSCRIPTION_PLANS`
- **Integrations**: Razorpay (payments), WhatsApp Business API, LiteLLM/OpenAI/Google GenAI, Stripe

### Acquisition / Campaign module

The unified campaign model lives across two route files and a set of DB tables introduced in migration `j3k4l5m6n7o8`.

**Tables** (all tenant-scoped except `campaign_types` and built-in `campaign_templates`):
| Table | Purpose |
|---|---|
| `campaign_types` | System-seeded reference: 6 motions (customer_acquisition, talent_acquisition, franchise_development, vendor_sourcing, partnership_outreach, general_lead_gen) |
| `campaigns` | Tenant campaigns: form_schema, audience_spec, lifecycle_stages_override, retention_class, caps, schedule |
| `campaign_templates` | Built-in (tenant_id NULL) + tenant-custom templates |
| `submissions` | Lead/applicant records; denormalised PII fields (common_name/phone/email/city/pincode) + JSONB responses |
| `submission_events` | Append-only audit log (stage changes, notes, promotions) |
| `submission_attachments_vault` | File attachments with sensitivity class and access log count |
| `campaign_tag_groups` | Tenant-defined label groups for campaigns |

**Route files**:
- `routes/unified_campaigns.py` — campaign CRUD, type/template/tag-group management, lifecycle actions (activate/pause/archive)
- `routes/submissions.py` — submission CRUD, stage transitions, notes, promotion, stuck-record endpoint

**Stage engine** (`routes/submissions.py`):
- `_get_stage_set(campaign, campaign_type)` — resolves effective stage set (lifecycle_stages_override takes precedence over campaign_type.default_stage_set)
- `_validate_transition(stage_set, from_stage, to_stage)` — checks defined transitions; if no transitions defined, allows any move
- `_is_terminal(stage_set, stage_key)` — checks `is_terminal` flag
- `_find_terminal_stage_key(stage_set, outcome)` — finds terminal stage by outcome (`"won"` / `"lost"`) so stage keys are never hardcoded
- `_get_stage_sla_hours(stage_set, stage_key)` — per-stage SLA for stuck-record detection
- `GET /submissions/stuck` — returns overdue submissions with `sla_hours`, `elapsed_hours`, `sla_breached_by_hours` extra fields

**RBAC** (defined in `routes/dependencies.py`):
| Role | Campaign type scope | Write? |
|---|---|---|
| SuperAdmin / Admin / Manager | All | Yes |
| outlet_staff | All | Yes |
| recruiter | talent_acquisition only | Yes |
| franchise_lead | franchise_development only | Yes |
| analyst | All | Read-only |

- `require_submissions_read` / `require_submissions_write` — FastAPI dependency guards
- `get_campaign_type_scope(role)` — returns `List[str]` or `None` (unrestricted); applied as SQL `WHERE campaign_types.key IN (...)` on list endpoints
- `redact_sensitive_submission(user, sub_dict)` — nulls PII fields for non-Admin roles when `retention_class_snapshot == "sensitive"`

**Retention classes**: standard (24mo), extended (36mo), sensitive (12mo, PII-redacted for non-admins), regulated (60mo, legal disclosure required)

**Meta Special Ad Categories**: `campaign_types.meta_ad_category` is `none | employment | credit_or_employment | housing`. When non-none, the Audience builder UI locks age range to 18–65 and shows a policy banner. `requires_legal_disclosure = true` on talent_acquisition and franchise_development — wizard warns if disclosure_footer is empty.

**Frontend pages** (`frontend/src/pages/Acquisition/`):
- `CampaignsList.js` — grid view with status/type filters and per-card action menu
- `CampaignWizard.js` — 6-step wizard (Basics → Form → Audience → Creative → Pipeline → Review); form step has drag-and-drop field editor with live Web/WhatsApp/Instagram channel preview
- `SubmissionsView.js` — submission list/detail for a campaign
- `LeadsPipeline.js` — kanban-style pipeline board
- `ContentStudio.js` / `WhatsAppAcquisition.js` / `AggregatorChannels.js` / `TriggersFlows.js` — channel-specific tooling

**Frontend API service**: `frontend/src/services/campaignsApi.js`

### Frontend (`frontend/`)
- React 19 + React Router 7 + Tailwind 3 + Radix UI
- State via React Context (`src/contexts/`)
- API calls via axios (`src/services/`)
- Webpack customized through Craco (`craco.config.js`)

### Customer Portal (`customer-portal/`)
- **Next.js App Router** — read `node_modules/next/dist/docs/` before writing portal code; this version has breaking changes from older Next.js
- TypeScript 5, Tailwind CSS 4, Base UI + Shadcn UI
- Routes: `book/`, `menu/[outletId]/`, `order/`, `services/`

### Data flow
```
Frontend / Portal  →  HTTP/REST  →  Backend (FastAPI)  →  PostgreSQL (asyncpg)
```

## Environment

Backend loads `.env` from `backend/.env`. Minimum required:
- `POSTGRES_URL` — defaults to `postgresql+asyncpg://localhost:5432/riserve_db`
- `SECRET_KEY` — JWT signing key
- `CORS_ORIGINS` — comma-separated allowed origins (dev defaults: localhost 3000/3001/3002)

## Seed / dev data

```bash
cd backend && source venv/bin/activate && python3 seed_hq.py
cd backend && source venv/bin/activate && python3 restore_dev_account.py
```
