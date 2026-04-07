SHELL := /bin/bash
.PHONY: all start stop backend frontend portal db install install-backend install-frontend install-portal logs help

BACKEND_DIR  := backend
FRONTEND_DIR := frontend
PORTAL_DIR   := customer-portal

# PIDs stored here for graceful stop
PID_DIR := .pids
BACKEND_PID  := $(PID_DIR)/backend.pid
FRONTEND_PID := $(PID_DIR)/frontend.pid
PORTAL_PID   := $(PID_DIR)/portal.pid

# ── Start everything ──────────────────────────────────────────────────────────
all: start

start:
	@mkdir -p $(CURDIR)/$(PID_DIR)
	@echo "Starting PostgreSQL..."
	@brew services start postgresql@18 2>/dev/null || brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || \
	 echo "  PostgreSQL already running or managed externally"
	@echo ""
	@echo "Starting Backend (port 8000)..."
	@cd $(CURDIR)/$(BACKEND_DIR) && source venv/bin/activate && \
	 uvicorn server:app --host 0.0.0.0 --port 8000 --reload \
	 > $(CURDIR)/$(PID_DIR)/backend.log 2>&1 & echo $$! > $(CURDIR)/$(PID_DIR)/backend.pid
	@echo ""
	@echo "Starting Frontend (port 3001)..."
	@cd $(CURDIR)/$(FRONTEND_DIR) && PORT=3001 npm start \
	 > $(CURDIR)/$(PID_DIR)/frontend.log 2>&1 & echo $$! > $(CURDIR)/$(PID_DIR)/frontend.pid
	@echo ""
	@echo "Starting Customer Portal (port 3002)..."
	@cd $(CURDIR)/$(PORTAL_DIR) && PORT=3002 npm run dev \
	 > $(CURDIR)/$(PID_DIR)/portal.log 2>&1 & echo $$! > $(CURDIR)/$(PID_DIR)/portal.pid
	@echo ""
	@echo "All services started."
	@echo "  Backend:         http://localhost:8000"
	@echo "  Frontend:        http://localhost:3001"
	@echo "  Customer Portal: http://localhost:3002"
	@echo ""
	@echo "Run 'make logs' to tail all logs, or 'make stop' to stop everything."

# ── Individual services ───────────────────────────────────────────────────────
backend: $(PID_DIR)
	@echo "Starting Backend (port 8000)..."
	@cd $(BACKEND_DIR) && source venv/bin/activate && \
	 uvicorn server:app --host 0.0.0.0 --port 8000 --reload

frontend:
	@echo "Starting Frontend (port 3001)..."
	@cd $(FRONTEND_DIR) && PORT=3001 npm start

portal:
	@echo "Starting Customer Portal (port 3002)..."
	@cd $(PORTAL_DIR) && PORT=3002 npm run dev

db:
	@echo "Starting PostgreSQL..."
	@brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null

# ── Stop ──────────────────────────────────────────────────────────────────────
stop:
	@echo "Stopping services..."
	@if [ -f $(PID_DIR)/backend.pid ];  then kill $$(cat $(PID_DIR)/backend.pid)  2>/dev/null && rm $(PID_DIR)/backend.pid;  fi
	@if [ -f $(PID_DIR)/frontend.pid ]; then kill $$(cat $(PID_DIR)/frontend.pid) 2>/dev/null && rm $(PID_DIR)/frontend.pid; fi
	@if [ -f $(PID_DIR)/portal.pid ];   then kill $$(cat $(PID_DIR)/portal.pid)   2>/dev/null && rm $(PID_DIR)/portal.pid;   fi
	@# Also kill any stragglers by port
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3002 | xargs kill -9 2>/dev/null || true
	@echo "Done."

# ── Logs ──────────────────────────────────────────────────────────────────────
logs:
	@tail -f $(PID_DIR)/backend.log $(PID_DIR)/frontend.log $(PID_DIR)/portal.log 2>/dev/null || \
	 echo "No log files found — run 'make start' first."

logs-backend:
	@tail -f $(PID_DIR)/backend.log

logs-frontend:
	@tail -f $(PID_DIR)/frontend.log

logs-portal:
	@tail -f $(PID_DIR)/portal.log

# ── Install dependencies ──────────────────────────────────────────────────────
install: install-backend install-frontend install-portal

install-backend:
	@echo "Installing backend dependencies..."
	@cd $(BACKEND_DIR) && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt

install-frontend:
	@echo "Installing frontend dependencies..."
	@cd $(FRONTEND_DIR) && npm install

install-portal:
	@echo "Installing customer portal dependencies..."
	@cd $(PORTAL_DIR) && npm install

# ── DB helpers ────────────────────────────────────────────────────────────────
db-migrate:
	@cd $(BACKEND_DIR) && source venv/bin/activate && alembic upgrade head

db-reset:
	@echo "WARNING: This will drop and recreate the database."
	@read -p "Continue? [y/N] " ans && [ "$$ans" = "y" ] || exit 1
	@dropdb riserve_db 2>/dev/null || true
	@createdb riserve_db
	@cd $(BACKEND_DIR) && source venv/bin/activate && alembic upgrade head

# ── Help ──────────────────────────────────────────────────────────────────────
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "  start            Start DB + backend + frontend + portal (background)"
	@echo "  stop             Stop all running services"
	@echo "  logs             Tail logs from all services"
	@echo "  logs-backend     Tail backend log only"
	@echo "  logs-frontend    Tail frontend log only"
	@echo "  logs-portal      Tail portal log only"
	@echo ""
	@echo "  backend          Run backend in foreground"
	@echo "  frontend         Run frontend in foreground"
	@echo "  portal           Run portal in foreground"
	@echo "  db               Start PostgreSQL via brew services"
	@echo ""
	@echo "  install          Install all dependencies"
	@echo "  install-backend  Set up Python venv + pip install"
	@echo "  install-frontend npm install for admin frontend"
	@echo "  install-portal   npm install for customer portal"
	@echo ""
	@echo "  db-migrate       Run alembic migrations"
	@echo "  db-reset         Drop + recreate DB and re-run migrations"
