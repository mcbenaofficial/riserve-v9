# Ri'Serve Partner Dashboard - API Routes
from .auth import router as auth_router
from .outlets import router as outlets_router
from .services import router as services_router
from .bookings import router as bookings_router
from .transactions import router as transactions_router
from .users import router as users_router
from .reports import router as reports_router
from .slots import router as slots_router
from .dashboard import router as dashboard_router
from .assistant import router as assistant_router
from .public import router as public_router
from .company import router as company_router
from .feedback import router as feedback_router
from .customers import router as customers_router
from .inventory import router as inventory_router
from .staff import router as staff_router
from .portal import router as portal_router

__all__ = [
    "auth_router",
    "outlets_router",
    "services_router",
    "bookings_router",
    "users_router",
    "reports_router",
    "dashboard_router",
    "assistant_router",
    "public_router",
    "company_router",
    "feedback_router",
    "inventory_router",
    "staff_router",
    "portal_router",
    "customers_router",
    "slots_router",
    "transactions_router"
]
