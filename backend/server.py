from fastapi import FastAPI, APIRouter, Depends
from routes.dependencies import get_current_user
from fastapi.staticfiles import StaticFiles
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


async def media_cleanup_background_task():
    """Purge expired media assets from local storage every hour."""
    while True:
        await asyncio.sleep(3600)
        try:
            from services.storage import StorageService
            async with AsyncSession(engine) as db:
                now = datetime.now(timezone.utc)
                result = await db.execute(
                    select(models_pg.MediaAsset).where(
                        models_pg.MediaAsset.expires_at.isnot(None),
                        models_pg.MediaAsset.expires_at < now,
                    )
                )
                assets = result.scalars().all()
                count = 0
                for asset in assets:
                    if asset.storage_path:
                        StorageService.delete(asset.storage_path)
                    await db.delete(asset)
                    count += 1
                if count:
                    await db.commit()
                    logger.info(f"Media cleanup: purged {count} expired asset(s)")
        except Exception as e:
            logger.error(f"Media cleanup error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Ri'Serve API (PostgreSQL Mode)...")

    # Run initial trial check
    await check_and_downgrade_expired_trials()

    # Sync SlotConfig JSONB resources → resources DB table (one-time retroactive migration)
    await sync_slot_config_resources_to_db()

    # Start background tasks
    trial_task = asyncio.create_task(trial_check_background_task())
    media_task = asyncio.create_task(media_cleanup_background_task())
    wa_scheduler_task = asyncio.create_task(acquisition_scheduler_background_task())
    petpooja_task = asyncio.create_task(petpooja_polling_background_task())

    yield

    # Shutdown
    trial_task.cancel()
    media_task.cancel()
    wa_scheduler_task.cancel()
    petpooja_task.cancel()
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
    "http://localhost:3002",
    "http://localhost:3003",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
_allowed_origins = list(set(_cors_origins + _dev_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for serving static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# Import all routers
from routes import (
    auth, public, dashboard, bookings, services, outlets,
    staff, reports, feedback, assistant, onboarding,
    users, company, inventory, customers, slots, transactions, promotions, hitl, portal, suppliers, analytics, hq,
    orders, menu, upload, omni, whatsapp, razorpay, invoices, mobile
)
from routes.stripe_payments import router as stripe_payments_router
from routes.superadmin import router as superadmin
from routes.conversations import router as conversations_router
from routes.webhooks_ingestion import router as webhooks_router
from routes.segments import router as segments_router
from routes.campaigns import router as campaigns_router
from routes.unified_campaigns import router as unified_campaigns_router
from routes.journeys import router as journeys_router
from routes.knowledge import router as knowledge_router
from routes.evals import router as evals_router
from routes.booking_portal import router as booking_portal_router
from routes.acquisition import router as acquisition_router
from routes.leads import router as leads_router
from routes.lead_flows import router as lead_flows_router
from routes.visibility import router as visibility_router
from routes.aggregators import router as aggregators_router
from routes.whatsapp_acquisition import router as wa_acquisition_router, acquisition_scheduler_background_task
from routes.submissions import router as submissions_router
from routes.petpooja import router as petpooja_router, petpooja_polling_background_task

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
app.include_router(orders.router, prefix="/api")
app.include_router(menu.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(omni.router, prefix="/api")
app.include_router(whatsapp.router, prefix="/api")
app.include_router(razorpay.router, prefix="/api")
app.include_router(stripe_payments_router, prefix="/api")
app.include_router(invoices.router, prefix="/api")
app.include_router(mobile.router, prefix="/api")
app.include_router(conversations_router, prefix="/api")
app.include_router(webhooks_router, prefix="/api")
app.include_router(segments_router, prefix="/api")
app.include_router(campaigns_router, prefix="/api")
app.include_router(unified_campaigns_router, prefix="/api")
app.include_router(journeys_router, prefix="/api")
app.include_router(knowledge_router, prefix="/api")
app.include_router(evals_router, prefix="/api")
app.include_router(booking_portal_router)
app.include_router(acquisition_router, prefix="/api")
app.include_router(leads_router, prefix="/api")
app.include_router(lead_flows_router, prefix="/api")
app.include_router(visibility_router, prefix="/api")
app.include_router(aggregators_router, prefix="/api")
app.include_router(wa_acquisition_router, prefix="/api")
app.include_router(submissions_router, prefix="/api")
app.include_router(petpooja_router, prefix="/api")

# Special endpoint for resource-bookings
# Moved to using SQLAlchemy
@app.get("/api/resource-bookings/{outlet_id}")
async def get_resource_bookings(
    outlet_id: str, 
    date: str = None, 
    current_user = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import select
    stmt = select(models_pg.Booking).where(models_pg.Booking.outlet_id == outlet_id)
    if date:
        stmt = stmt.where(models_pg.Booking.date == date)
    
    result = await db.execute(stmt)
    bookings = result.scalars().all()
    return bookings





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
