from fastapi import FastAPI, APIRouter, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from contextlib import asynccontextmanager
import os
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
import uuid

import models_pg
from database_pg import get_db, engine

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Trial expiry check function
async def check_and_downgrade_expired_trials():
    """Check for expired trials and downgrade to free plan"""
    try:
        from routes.dependencies import SUBSCRIPTION_PLANS
        
        async with AsyncSession(engine) as db_session:
            now = datetime.now(timezone.utc)
            
            # Find all companies with expired trials
            stmt = select(models_pg.Company).where(
                models_pg.Company.plan == "trial",
                models_pg.Company.trial_end <= now
            )
            result = await db_session.execute(stmt)
            expired_trials = result.scalars().all()
            
            if expired_trials:
                logger.info(f"Found {len(expired_trials)} expired trials to downgrade")
                
                for company in expired_trials:
                    company.plan = "free"
                    company.plan_limits = SUBSCRIPTION_PLANS["free"]["limits"]
                    
                    # Log the downgrade
                    new_log = models_pg.AuditLog(
                        action="trial_expired",
                        entity_type="company",
                        entity_id=company.id,
                        user_id="system",
                        user_email="system@riserve.com",
                        company_id=company.id,
                        details={"old_plan": "trial", "new_plan": "free"}
                    )
                    db_session.add(new_log)
                    
                    logger.info(f"Downgraded company {company.name} ({company.id}) from trial to free")
                
                await db_session.commit()
            else:
                logger.info("No expired trials found")
            
    except Exception as e:
        logger.error(f"Error checking expired trials: {e}")


# Background task to check trials periodically
async def trial_check_background_task():
    """Run trial check every hour"""
    while True:
        await check_and_downgrade_expired_trials()
        await asyncio.sleep(3600)  # Check every hour


async def sync_slot_config_resources_to_db():
    """Retroactively sync SlotConfig JSONB resources → resources DB table.
    Ensures booking.resource_id FK is satisfied for all existing SlotConfig resources.
    """
    try:
        async with AsyncSession(engine) as db_session:
            result = await db_session.execute(select(models_pg.SlotConfig))
            configs = result.scalars().all()
            synced = 0
            for config in configs:
                conf = config.configuration or {}
                resources = conf.get("resources", [])
                for r in resources:
                    r_id = r.get("id")
                    if not r_id:
                        continue
                    existing = (await db_session.execute(
                        select(models_pg.Resource).where(models_pg.Resource.id == r_id)
                    )).scalar_one_or_none()
                    if not existing:
                        db_session.add(models_pg.Resource(
                            id=r_id,
                            outlet_id=config.outlet_id,
                            name=r.get("name", "Resource"),
                            capacity=r.get("capacity", 1),
                            active=r.get("active", True)
                        ))
                        synced += 1
            if synced:
                await db_session.commit()
                logger.info(f"Startup migration: synced {synced} slot config resources into DB table")
    except Exception as e:
        logger.error(f"Error syncing slot config resources: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Ri'Serve API (PostgreSQL Mode)...")
    
    # Run initial trial check
    await check_and_downgrade_expired_trials()
    
    # Sync SlotConfig JSONB resources → resources DB table (one-time retroactive migration)
    await sync_slot_config_resources_to_db()
    
    # Start background task for periodic checks
    task = asyncio.create_task(trial_check_background_task())
    
    yield
    
    # Shutdown
    task.cancel()
    logger.info("Shutting down Ri'Serve API...")



# Create the main app with lifespan
app = FastAPI(title="Ri'Serve Partner API", lifespan=lifespan)

# Configure CORS
# IMPORTANT: allow_credentials=True is incompatible with allow_origins=['*'].
# When credentials (Authorization header) are used, the browser requires an exact origin match.
_cors_env = os.environ.get('CORS_ORIGINS', '').strip()
_cors_origins = [o.strip() for o in _cors_env.split(',') if o.strip()] if _cors_env else []
# Always include dev origins
_dev_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
]
_allowed_origins = list(set(_cors_origins + _dev_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Import all routers
from routes import (
    auth, public, dashboard, bookings, services, outlets, 
    staff, reports, feedback, assistant, onboarding,
    users, company, inventory, customers, slots, transactions, promotions, hitl, portal, suppliers, analytics, hq
)
from routes.superadmin import router as superadmin

# Include Routers
app.include_router(auth.router, prefix="/api")
app.include_router(public.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(services.router, prefix="/api")
app.include_router(outlets.router, prefix="/api")
app.include_router(staff.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")
app.include_router(assistant.router, prefix="/api")
app.include_router(superadmin, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(company.router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(slots.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(promotions.promotions_bp, prefix="/api")
app.include_router(onboarding.router, prefix="/api")
app.include_router(hitl.router, prefix="/api")
app.include_router(portal.router, prefix="/api")
app.include_router(suppliers.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(hq.router, prefix="/api")

# Special endpoint for resource-bookings
# Moved to using SQLAlchemy
@app.get("/api/resource-bookings/{outlet_id}")
async def get_resource_bookings(
    outlet_id: str, 
    date: str = None, 
    current_user: models_pg.User = Depends(get_db), 
    db: AsyncSession = Depends(get_db)
):
    # This is a bit of a hacky endpoint, but refactoring for Postgres
    from sqlalchemy import select
    stmt = select(models_pg.Booking).where(models_pg.Booking.outlet_id == outlet_id)
    if date:
        stmt = stmt.where(models_pg.Booking.date == date)
    
    result = await db.execute(stmt)
    bookings = result.scalars().all()
    return bookings


# Password hashing for seed
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


# ==================== MAINTENANCE ENDPOINTS ====================
# Note: Seed/Reset endpoints should generally be handled by standalone scripts 
# in production. Refactoring these briefly for development convenience.

@app.post("/api/reset-data")
async def reset_data(db: AsyncSession = Depends(get_db)):
    """Clear app-specific data for a fresh start (keeps users/companies)"""
    await db.execute(delete(models_pg.Transaction))
    await db.execute(delete(models_pg.Booking))
    await db.execute(delete(models_pg.SlotConfig))
    await db.execute(delete(models_pg.DashboardConfig))
    await db.execute(delete(models_pg.AIConversation))
    await db.execute(delete(models_pg.Service))
    await db.execute(delete(models_pg.Outlet))
    await db.execute(delete(models_pg.CompanySetting))
    await db.commit()
    
    return {
        "message": "All transactional data cleared successfully.",
        "cleared": ["transactions", "bookings", "slot_configs", "services", "outlets"]
    }


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Application shutdown.")
