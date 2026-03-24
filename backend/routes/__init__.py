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
from .hq import router as hq_router
from .onboarding import router as onboarding_router
from .hitl import router as hitl_router
from .promotions import promotions_bp as promotions_router
from .suppliers import router as suppliers_router
from .analytics import router as analytics_router
from .orders import router as orders_router
from .menu import router as menu_router
from .upload import router as upload_router
from .omni import router as omni_router

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
    "transactions_router",
    "hq_router",
    "onboarding_router",
    "hitl_router",
    "promotions_router",
    "suppliers_router",
    "analytics_router",
    "orders_router",
    "menu_router",
    "upload_router",
    "omni_router",
]
