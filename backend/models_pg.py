from sqlalchemy import Boolean, Column, DateTime, Date, ForeignKey, Integer, String, Text, Numeric, Table
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from database_pg import Base

def generate_uuid():
    return str(uuid.uuid4())

# Many-to-Many for User <-> Outlet
user_outlets = Table(
    'user_outlets',
    Base.metadata,
    Column('user_id', String, ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    Column('outlet_id', String, ForeignKey('outlets.id', ondelete='CASCADE'), primary_key=True)
)

# Many-to-Many for Booking <-> Service (since bookings have service_ids array)
booking_services = Table(
    'booking_services',
    Base.metadata,
    Column('booking_id', String, ForeignKey('bookings.id', ondelete='CASCADE'), primary_key=True),
    Column('service_id', String, ForeignKey('services.id', ondelete='CASCADE'), primary_key=True)
)

class Company(Base):
    __tablename__ = "companies"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    business_type = Column(String(100))
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(50))
    address = Column(Text)
    plan = Column(String(50), default="free")
    plan_limits = Column(JSONB, default=dict)
    trial_start = Column(DateTime(timezone=True))
    trial_end = Column(DateTime(timezone=True))
    status = Column(String(50), default="active")  # active, suspended, deactivated
    enabled_features = Column(JSONB, default=list) # e.g. ["inventory", "ai_assistant"]
    is_booking_enabled = Column(Boolean, default=True)
    is_retail_enabled = Column(Boolean, default=False)
    is_workplace_enabled = Column(Boolean, default=False)
    
    deactivated_at = Column(DateTime(timezone=True))
    scheduled_deletion_date = Column(DateTime(timezone=True))
    deactivation_reason = Column(Text)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_by = Column(String) # Super admin who created it

    # Relationships
    users = relationship("User", back_populates="company")
    outlets = relationship("Outlet", back_populates="company")
    customers = relationship("Customer", back_populates="company")
    services = relationship("Service", back_populates="company")
    bookings = relationship("Booking", back_populates="company")
    transactions = relationship("Transaction", back_populates="company")
    hitl_reports = relationship("HITLReport", back_populates="company")
    audit_logs = relationship("AuditLog", back_populates="company")
    dashboard_configs = relationship("DashboardConfig", back_populates="company")
    feedback_configs = relationship("FeedbackConfig", back_populates="company")
    feedback = relationship("Feedback", back_populates="company")
    settings = relationship("CompanySetting", back_populates="company", uselist=False)
    products = relationship("Product", back_populates="company")

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=True) # SuperAdmins don't have company_id
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="User")  # SuperAdmin, Admin, Manager, User
    phone = Column(String(50))
    status = Column(String(50), default="Active")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="users")
    outlets = relationship("Outlet", secondary=user_outlets, back_populates="users")
    staff_profile = relationship("Staff", back_populates="user", uselist=False)
    resources = relationship("Resource", back_populates="user")

class Outlet(Base):
    __tablename__ = "outlets"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50))
    location = Column(Text)
    contact_email = Column(String(255))
    contact_phone = Column(String(50))
    capacity = Column(Integer, default=1)
    status = Column(String(50), default="active")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="outlets")
    users = relationship("User", secondary=user_outlets, back_populates="outlets")
    resources = relationship("Resource", back_populates="outlet")
    staff = relationship("Staff", back_populates="outlet")
    bookings = relationship("Booking", back_populates="outlet")
    transactions = relationship("Transaction", back_populates="outlet")

class Resource(Base):
    """
    Previously embedded array `resources` inside MongoDB Outlet document.
    """
    __tablename__ = "resources"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)  # Mapped user
    name = Column(String(255), nullable=False)
    capacity = Column(Integer, default=1)
    active = Column(Boolean, default=True)

    # Relationships
    outlet = relationship("Outlet", back_populates="resources")
    user = relationship("User", back_populates="resources")
    bookings = relationship("Booking", back_populates="resource")

class Staff(Base):
    __tablename__ = "staff"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='SET NULL'), nullable=True)
    first_name = Column(String(100))
    last_name = Column(String(100))
    email = Column(String(255))
    phone = Column(String(50))
    status = Column(String(50), default="active")
    department = Column(String(100))
    employment_type = Column(String(50))
    skills = Column(JSONB, default=list)
    certifications = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="staff_profile")
    outlet = relationship("Outlet", back_populates="staff")

class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    notes = Column(Text)
    custom_fields = Column(JSONB, default=dict)
    total_revenue = Column(Numeric(10, 2), default=0)
    total_bookings = Column(Integer, default=0)
    last_visit = Column(Date)       # Native date type
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="customers")
    bookings = relationship("Booking", back_populates="customer_rep")

class Service(Base):
    __tablename__ = "services"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    price = Column(Numeric(10, 2), default=0)
    duration = Column(Integer, default=30) # minutes
    description = Column(Text)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="services")
    bookings = relationship("Booking", secondary=booking_services, back_populates="services")

class Booking(Base):
    __tablename__ = "bookings"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id", ondelete='CASCADE'), nullable=False)
    resource_id = Column(String, ForeignKey("resources.id", ondelete='SET NULL'), nullable=True)    
    service_id = Column(String, ForeignKey("services.id", ondelete='SET NULL'), nullable=True) # Primary service
    
    customer = Column(String(255)) # Denormalized name
    customer_name = Column(String(255))
    customer_phone = Column(String(50))
    customer_email = Column(String(255))
    
    time = Column(String(20)) # "10:00"
    date = Column(Date)       # Native date type
    duration = Column(Integer)
    notes = Column(Text)
    custom_fields = Column(JSONB, default=dict)
    
    amount = Column(Numeric(10, 2), default=0)
    service_amount = Column(Numeric(10, 2), default=0)
    items_total = Column(Numeric(10, 2), default=0)
    total_amount = Column(Numeric(10, 2), default=0)
    items = Column(JSONB, default=list) # Array of items added to booking
    
    status = Column(String(50), default="Pending")
    source = Column(String(50), default="app")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="bookings")
    outlet = relationship("Outlet", back_populates="bookings")
    customer_rep = relationship("Customer", back_populates="bookings")
    resource = relationship("Resource", back_populates="bookings")
    primary_service = relationship("Service", foreign_keys=[service_id])
    services = relationship("Service", secondary=booking_services, back_populates="bookings")
    transactions = relationship("Transaction", back_populates="booking")

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    booking_id = Column(String, ForeignKey("bookings.id", ondelete='CASCADE'), nullable=True)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete='SET NULL'), nullable=True)
    
    type = Column(String(100)) # "sale", "pos_sale", etc.
    payment_method = Column(String(100))
    
    total_amount = Column(Numeric(10, 2), default=0)
    gross = Column(Numeric(10, 2), default=0)
    commission = Column(Numeric(10, 2), default=0)
    partner_share = Column(Numeric(10, 2), default=0)
    
    service_revenue = Column(Numeric(10, 2), default=0)
    product_revenue = Column(Numeric(10, 2), default=0)
    product_cost = Column(Numeric(10, 2), default=0)
    
    items = Column(JSONB, default=list) # Array of items for POS
    
    status = Column(String(50), default="Settled")
    created_by = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="transactions")
    outlet = relationship("Outlet", back_populates="transactions")
    booking = relationship("Booking", back_populates="transactions")

class HITLReport(Base):
    __tablename__ = "hitl_reports"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    user_id = Column(String, default="system_agent")
    created_by_agent = Column(Boolean, default=True)
    flow_type = Column(String(100))
    status = Column(String(50), default="pending")  # pending, approved, declined, modified
    report_json = Column(JSONB, default=dict)
    
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    resolution_reason = Column(Text, nullable=True)
    modified_payload = Column(JSONB, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    company = relationship("Company", back_populates="hitl_reports")

class Product(Base):
    __tablename__ = "products"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=True)
    name = Column(String(255), nullable=False)
    sku = Column(String(100))
    category = Column(String(100), default="general")
    description = Column(Text)
    price = Column(Numeric(10, 2), default=0)
    cost = Column(Numeric(10, 2), default=0)
    stock_quantity = Column(Integer, default=0)
    reorder_level = Column(Integer, default=10)
    is_addon = Column(Boolean, default=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="products")

class InventoryLog(Base):
    __tablename__ = "inventory_logs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    product_id = Column(String, ForeignKey("products.id", ondelete='CASCADE'), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    
    action = Column(String(100)) # sale, return, pos_checkout
    quantity = Column(Integer, default=0)
    new_quantity = Column(Integer, default=0)
    reason = Column(String(255))
    reference_id = Column(String) # Could be booking_id
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class InventoryAlert(Base):
    __tablename__ = "inventory_alerts"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=True)
    product_id = Column(String, ForeignKey("products.id", ondelete='CASCADE'), nullable=False)
    
    type = Column(String(100), default="low_stock")
    product_name = Column(String(255))
    current_quantity = Column(Integer, default=0)
    reorder_level = Column(Integer, default=0)
    resolved = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class SlotConfig(Base):
    __tablename__ = "slot_configs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=False)
    # the rest is json
    configuration = Column(JSONB, default=dict)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Promotion(Base):
    __tablename__ = "promotions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    promotion_type = Column(String(100)) # global etc
    discount_type = Column(String(50)) # percentage, fixed
    discount_value = Column(Numeric(10, 2), default=0)
    
    valid_from = Column(DateTime(timezone=True))
    valid_to = Column(DateTime(timezone=True))
    package_tier = Column(String(50), default="all")
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Coupon(Base):
    __tablename__ = "coupons"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    promotion_id = Column(String, ForeignKey("promotions.id", ondelete='CASCADE'), nullable=False)
    code = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class HITLPreference(Base):
    __tablename__ = "hitl_preferences"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    flow_type = Column(String(100), nullable=False)
    
    total_reviews = Column(Integer, default=0)
    approvals = Column(Integer, default=0)
    declines = Column(Integer, default=0)
    modifications = Column(Integer, default=0)
    acceptance_rate = Column(Numeric(5, 4), default=0)
    
    common_reasons = Column(JSONB, default=list) # Array of reason dicts
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class LeaveBalance(Base):
    """
    Tracks staff time off allowance and usage.
    """
    __tablename__ = "leave_balances"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    staff_id = Column(String, ForeignKey("staff.id", ondelete='CASCADE'), nullable=False)
    year = Column(Integer, nullable=False) # e.g. 2024
    
    # Types of leave can be stored in JSON or explicitly mapped. We'll use JSONB for flexibility.
    # Structure: {"annual": {"total": 20, "used": 5, "pending": 2}, "sick": {"total": 10, "used": 1, "pending": 0}}
    balances = Column(JSONB, default=dict)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class OnboardingProgress(Base):
    __tablename__ = "onboarding_progress"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    conversation_id = Column(String, nullable=True)
    
    percentage = Column(Integer, default=0)
    completed_steps = Column(JSONB, default=list)
    pending_steps = Column(JSONB, default=lambda: ["company_profile", "first_outlet", "services"])
    skipped = Column(Boolean, default=False)
    
    completed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class OnboardingConversation(Base):
    __tablename__ = "onboarding_conversations"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    
    messages = Column(JSONB, default=list) # Chat log
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class AIConversation(Base):
    __tablename__ = "ai_conversations"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    title = Column(String(255))
    messages = Column(JSONB, default=list)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100))
    entity_id = Column(String)
    user_id = Column(String)
    user_email = Column(String(255))
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=True)
    details = Column(JSONB, default=dict)
    ip_address = Column(String(50))
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="audit_logs")

class DashboardConfig(Base):
    __tablename__ = "dashboard_configs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=True)
    name = Column(String(255), default="Main Dashboard")
    is_default = Column(Boolean, default=False)
    widgets = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="dashboard_configs")

class FeedbackConfig(Base):
    __tablename__ = "feedback_configs"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    enabled = Column(Boolean, default=True)
    auto_send_after_completion = Column(Boolean, default=True)
    send_via_email = Column(Boolean, default=True)
    send_via_sms = Column(Boolean, default=False)
    email_subject = Column(String(255), default="How was your experience?")
    email_message = Column(Text)
    sms_message = Column(Text)
    thank_you_message = Column(Text)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="feedback_configs")

class Feedback(Base):
    __tablename__ = "feedback"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    booking_id = Column(String, ForeignKey("bookings.id", ondelete='CASCADE'), nullable=True)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='SET NULL'), nullable=True)
    service_id = Column(String, ForeignKey("services.id", ondelete='SET NULL'), nullable=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text)
    customer_name = Column(String(255))
    customer_email = Column(String(255))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="feedback")

class CompanySetting(Base):
    __tablename__ = "company_settings"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False, unique=True)
    inventory_settings = Column(JSONB, default=dict)
    general_settings = Column(JSONB, default=dict)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="settings")

