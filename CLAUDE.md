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
- **Routes**: ~30 modules in `routes/` organized by domain (`auth`, `bookings`, `slots`, `services`, `outlets`, `staff`, `inventory`, `portal`, `razorpay`, `whatsapp`, `superadmin`, `hitl`, …)
- **Auth**: JWT tokens; roles: Super Admin, Admin, Manager, User — enforced in `routes/dependencies.py`
- **Multi-tenancy**: All data scoped by `company_id`
- **Subscription tiers**: trial (30-day auto-downgrade to free), free, essential, pro, custom — plan limits live in `routes/dependencies.py::SUBSCRIPTION_PLANS`
- **Integrations**: Razorpay (payments), WhatsApp Business API, LiteLLM/OpenAI/Google GenAI, Stripe

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
