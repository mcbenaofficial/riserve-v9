from sqlalchemy import Boolean, Column, DateTime, Date, ForeignKey, Integer, String, Text, Numeric, Table, Float
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from pgvector.sqlalchemy import Vector

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
    licensed_modules = Column(JSONB, default=list)  # e.g. ["booking", "inventory", "restaurant_orders", ...]
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
    service_categories = relationship("ServiceCategory", back_populates="company")
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
    suppliers = relationship("Supplier", back_populates="company")
    menu_categories = relationship("MenuCategory", back_populates="company")
    menu_items = relationship("MenuItem", back_populates="company")
    restaurant_orders = relationship("RestaurantOrder", back_populates="company")
    invoices = relationship("Invoice", back_populates="company")
    invoice_settings = relationship("InvoiceSettings", back_populates="company", uselist=False)

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
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    portal_logo_url = Column(String(255), nullable=True)
    portal_color_scheme = Column(JSONB, nullable=True)
    portal_custom_colors = Column(Boolean, default=False)
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
    attendance_records = relationship("Attendance", back_populates="staff", cascade="all, delete-orphan")
    leave_requests = relationship("LeaveRequest", back_populates="staff", cascade="all, delete-orphan")
    payslips = relationship("Payslip", back_populates="staff", cascade="all, delete-orphan")
    break_logs = relationship("BreakLog", back_populates="staff", cascade="all, delete-orphan")
    tip_records = relationship("TipRecord", back_populates="staff", cascade="all, delete-orphan")
    training_completions = relationship("TrainingCompletion", back_populates="staff", cascade="all, delete-orphan")


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False, index=True)                        # The work date
    clock_in = Column(DateTime(timezone=True), nullable=True)
    clock_out = Column(DateTime(timezone=True), nullable=True)
    hours_worked = Column(Numeric(5, 2), default=0)            # Computed on clock-out
    status = Column(String(50), default="present")             # present, absent, half_day, leave
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    staff = relationship("Staff", back_populates="attendance_records")


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    leave_type = Column(String(50), nullable=False)            # sick, annual, emergency, maternity, unpaid
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    days_requested = Column(Integer, default=1)
    reason = Column(Text, nullable=True)
    status = Column(String(50), default="pending")             # pending, approved, rejected, cancelled
    manager_notes = Column(Text, nullable=True)
    reviewed_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    staff = relationship("Staff", back_populates="leave_requests")


class Payslip(Base):
    __tablename__ = "payslips"

    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    month = Column(Integer, nullable=False)                    # 1-12
    year = Column(Integer, nullable=False)
    pay_period_label = Column(String(50))                      # e.g. "March 2026"
    # Earnings
    basic_salary = Column(Numeric(10, 2), default=0)
    allowances = Column(Numeric(10, 2), default=0)
    overtime_pay = Column(Numeric(10, 2), default=0)
    commission = Column(Numeric(10, 2), default=0)
    bonus = Column(Numeric(10, 2), default=0)
    gross_pay = Column(Numeric(10, 2), default=0)
    # Deductions
    tax = Column(Numeric(10, 2), default=0)
    provident_fund = Column(Numeric(10, 2), default=0)
    other_deductions = Column(Numeric(10, 2), default=0)
    total_deductions = Column(Numeric(10, 2), default=0)
    net_pay = Column(Numeric(10, 2), default=0)
    # Meta
    hours_worked = Column(Numeric(6, 2), default=0)
    days_present = Column(Integer, default=0)
    days_absent = Column(Integer, default=0)
    leaves_taken = Column(Integer, default=0)
    status = Column(String(50), default="draft")               # draft, published
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    staff = relationship("Staff", back_populates="payslips")


class BreakLog(Base):
    __tablename__ = "break_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    break_type = Column(String(50), default="short")   # meal, short, personal
    started_at = Column(DateTime(timezone=True), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    staff = relationship("Staff", back_populates="break_logs")


class TipRecord(Base):
    __tablename__ = "tip_records"

    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False, default=0)
    source_notes = Column(String(255), nullable=True)   # e.g. "Table 3, 7"
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    staff = relationship("Staff", back_populates="tip_records")


class TrainingModule(Base):
    __tablename__ = "training_modules"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)      # Compliance, Service, Safety, Sales, Operations
    description = Column(Text, nullable=True)
    duration_minutes = Column(Integer, default=15)
    is_active = Column(Boolean, default=True)
    # Source material and AI-generated learning assets
    content = Column(Text, nullable=True)
    study_guide = Column(Text, nullable=True)
    flashcards = Column(JSONB, nullable=True)            # [{question, answer}, ...]
    quiz = Column(JSONB, nullable=True)                  # [{question, options, correct_index, explanation}, ...]
    ai_generated = Column(Boolean, default=False)
    # Audio dialogue
    audio_script = Column(Text, nullable=True)
    audio_url = Column(String(500), nullable=True)
    audio_approved = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    completions = relationship("TrainingCompletion", back_populates="module", cascade="all, delete-orphan")


class TrainingCompletion(Base):
    __tablename__ = "training_completions"

    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    module_id = Column(String, ForeignKey("training_modules.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    score = Column(Integer, nullable=True)               # Quiz score 0-100
    quiz_answers = Column(JSONB, nullable=True)          # Submitted answers
    completed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    staff = relationship("Staff", back_populates="training_completions")
    module = relationship("TrainingModule", back_populates="completions")


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
    # aggregator_handles: {"zomato": "user_id", "swiggy": "proxy_phone"}
    aggregator_handles = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="customers")
    bookings = relationship("Booking", back_populates="customer_rep")
    aggregator_orders = relationship("AggregatorOrder", back_populates="resolved_customer", foreign_keys="AggregatorOrder.resolved_customer_id")

class ServiceCategory(Base):
    __tablename__ = "service_categories"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="service_categories")
    services = relationship("Service", back_populates="category", cascade="all, delete-orphan")

class Service(Base):
    __tablename__ = "services"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    category_id = Column(String, ForeignKey("service_categories.id", ondelete='SET NULL'), nullable=True)
    name = Column(String(255), nullable=False)
    price = Column(Numeric(10, 2), default=0)
    duration = Column(Integer, default=30) # minutes
    description = Column(Text)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="services")
    category = relationship("ServiceCategory", back_populates="services")
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
    date = Column(Date, index=True)       # Native date type
    duration = Column(Integer)
    notes = Column(Text)
    custom_fields = Column(JSONB, default=dict)
    
    amount = Column(Numeric(10, 2), default=0)
    service_amount = Column(Numeric(10, 2), default=0)
    items_total = Column(Numeric(10, 2), default=0)
    total_amount = Column(Numeric(10, 2), default=0)
    items = Column(JSONB, default=list) # Array of items added to booking
    
    status = Column(String(50), default="Pending", index=True)
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
    date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
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
    supplier_links = relationship("SupplierProduct", back_populates="product", cascade="all, delete-orphan")

class Supplier(Base):
    __tablename__ = "suppliers"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    address = Column(Text)
    contact_person = Column(String(255))
    notes = Column(Text)
    active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company", back_populates="suppliers")
    product_links = relationship("SupplierProduct", back_populates="supplier", cascade="all, delete-orphan")

class SupplierProduct(Base):
    __tablename__ = "supplier_products"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    supplier_id = Column(String, ForeignKey("suppliers.id", ondelete='CASCADE'), nullable=False)
    product_id = Column(String, ForeignKey("products.id", ondelete='CASCADE'), nullable=False)
    
    lead_time_days = Column(Integer, default=0)
    moq = Column(Integer, default=1) # Minimum order quantity
    unit_cost = Column(Numeric(10, 2), nullable=True) # Optional supplier-specific cost
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    company = relationship("Company")
    supplier = relationship("Supplier", back_populates="product_links")
    product = relationship("Product", back_populates="supplier_links")

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
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

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
    
    # Section A
    compared_to_previous = Column(String(50), nullable=True)
    
    # Section B
    liked_most = Column(JSONB, default=list) # Array of strings
    staff_shoutout = Column(Text, nullable=True)
    
    # Section C
    areas_fell_short = Column(JSONB, default=list) # Array of strings
    shortcomings_details = Column(JSONB, default=dict) # Detailed follow-up responses
    
    # Section D
    escalation_notes = Column(Text, nullable=True)
    escalation_contact_opt_in = Column(Boolean, default=False)
    escalation_contact_number = Column(String(50), nullable=True)
    escalation_contact_time = Column(String(100), nullable=True)
    
    # Section E
    likely_to_visit_again = Column(String(50), nullable=True)
    nps_score = Column(Integer, nullable=True)
    return_incentive = Column(Text, nullable=True)
    
    # Section F / general
    comment = Column(Text)
    suggestions = Column(Text, nullable=True)
    
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


# ─── HQ Intelligence Phase 2 Models ──────────────────────────────────

class PlaybookDeployment(Base):
    """Tracks a playbook deployment (experiment) across one or more outlets."""
    __tablename__ = "playbook_deployments"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    playbook_id = Column(String(100), nullable=False)
    playbook_name = Column(String(255), nullable=False)
    outlet_ids = Column(JSONB, default=list)  # Array of outlet IDs
    parameters = Column(JSONB, default=dict)
    status = Column(String(50), default="active")  # active, paused, completed, cancelled
    deployed_by = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    deployed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)
    experiment_id = Column(String(100), nullable=False)
    baseline_metrics = Column(JSONB, default=dict)  # Snapshot at deploy time
    current_metrics = Column(JSONB, default=dict)   # Latest measurement
    notes = Column(Text, nullable=True)

    results = relationship("PlaybookResult", back_populates="deployment", cascade="all, delete-orphan")


class PlaybookResult(Base):
    """Per-outlet result tracking for a playbook deployment."""
    __tablename__ = "playbook_results"

    id = Column(String, primary_key=True, default=generate_uuid)
    deployment_id = Column(String, ForeignKey("playbook_deployments.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=False)
    outlet_name = Column(String(255))
    before_metrics = Column(JSONB, default=dict)
    after_metrics = Column(JSONB, default=dict)
    improvement_pct = Column(Numeric(10, 2), nullable=True)
    status = Column(String(50), default="monitoring")  # monitoring, improved, declined, no_change
    measured_at = Column(DateTime(timezone=True), nullable=True)

    deployment = relationship("PlaybookDeployment", back_populates="results")


class HQAlert(Base):
    """Persistent alerts generated by the HQ Intelligence system."""
    __tablename__ = "hq_alerts"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=True)
    outlet_name = Column(String(255))
    category = Column(String(100))  # Revenue, Customer, Ops, People, Risk
    severity = Column(String(50))   # critical, high, medium, low
    title = Column(String(500), nullable=False)
    message = Column(Text)
    status = Column(String(50), default="open", index=True)  # open, acknowledged, resolved, dismissed
    assigned_to = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    resolved_by = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    source = Column(String(50), default="system")  # system, briefing, insight, manual
    data = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ─── Phase 3 Models ──────────────────────────────────────────────────

class HQGoal(Base):
    """KPI target per outlet — tracked against live data."""
    __tablename__ = "hq_goals"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=False)
    outlet_name = Column(String(255))
    metric = Column(String(100), nullable=False)  # revenue, utilization, nps, rating, churn_rate
    target_value = Column(Numeric(14, 2), nullable=False)
    current_value = Column(Numeric(14, 2), nullable=True)
    period = Column(String(50), default="monthly")  # weekly, monthly, quarterly
    deadline = Column(Date, nullable=True)
    status = Column(String(50), default="on_track")  # on_track, at_risk, behind, exceeded
    progress_pct = Column(Numeric(6, 2), default=0)
    created_by = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


# ─── HQ Intelligence Phase 4 Models ──────────────────────────────────

class CustomKPI(Base):
    """User-defined composite KPI with formula, thresholds, and alerting."""
    __tablename__ = "custom_kpis"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    formula = Column(JSONB, nullable=False)  # {"type":"ratio","numerator":"revenue_30d","denominator":"staff_count"}
    unit = Column(String(50), default="")
    thresholds = Column(JSONB, default=lambda: {"green": 80, "yellow": 50, "red": 0})
    alert_enabled = Column(Boolean, default=False)
    values = Column(JSONB, default=dict)  # {outlet_id: computed_value, ...}
    created_by = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class ABExperiment(Base):
    """A/B experiment with control and test outlet groups."""
    __tablename__ = "ab_experiments"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    playbook_id = Column(String(100), nullable=False)
    playbook_name = Column(String(255), nullable=False)
    test_outlet_ids = Column(JSONB, default=list)
    control_outlet_ids = Column(JSONB, default=list)
    metric = Column(String(100), nullable=False)  # revenue, nps, utilization, bookings, etc.
    baseline_test = Column(JSONB, default=dict)
    baseline_control = Column(JSONB, default=dict)
    current_test = Column(JSONB, default=dict)
    current_control = Column(JSONB, default=dict)
    status = Column(String(50), default="running")  # running, concluded, cancelled
    significance = Column(Numeric(5, 4), nullable=True)  # 0.0000 - 1.0000
    lift_pct = Column(Numeric(10, 2), nullable=True)
    result = Column(String(50), default="pending")  # pending, winner_test, winner_control, inconclusive
    min_duration_days = Column(Integer, default=14)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    concluded_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)


class AgentRule(Base):
    """Automation rule: trigger condition → action, with optional approval."""
    __tablename__ = "agent_rules"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    trigger = Column(JSONB, nullable=False)  # {"metric":"churn_rate","condition":"gt","value":15}
    action = Column(JSONB, nullable=False)   # {"type":"deploy_playbook","playbook_id":"vip_recovery"}
    scope = Column(String(50), default="all_outlets")  # all_outlets, specific_outlets
    outlet_ids = Column(JSONB, default=list)  # only if scope=specific_outlets
    requires_approval = Column(Boolean, default=True)
    enabled = Column(Boolean, default=True)
    cooldown_hours = Column(Integer, default=24)
    last_triggered_at = Column(DateTime(timezone=True), nullable=True)
    execution_count = Column(Integer, default=0)
    created_by = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    executions = relationship("AgentExecution", back_populates="rule", cascade="all, delete-orphan")


class AgentExecution(Base):
    """Log entry for a triggered agent rule execution."""
    __tablename__ = "agent_executions"

    id = Column(String, primary_key=True, default=generate_uuid)
    rule_id = Column(String, ForeignKey("agent_rules.id", ondelete='CASCADE'), nullable=False)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=True)
    outlet_name = Column(String(255))
    trigger_data = Column(JSONB, default=dict)  # metric values at trigger time
    action_data = Column(JSONB, default=dict)   # action details
    status = Column(String(50), default="pending_approval")  # pending_approval, approved, executed, rejected
    approved_by = Column(String, ForeignKey("users.id", ondelete='SET NULL'), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    executed_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    result = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    rule = relationship("AgentRule", back_populates="executions")
class ChurnPrediction(Base):
    """Per-customer churn risk computed from booking/spend patterns."""
    __tablename__ = "churn_predictions"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id", ondelete='CASCADE'), nullable=False)
    customer_name = Column(String(255))
    risk_score = Column(Numeric(5, 2), nullable=False)  # 0–100
    risk_level = Column(String(50))  # low, medium, high, critical
    factors = Column(JSONB, default=dict)  # {days_since_last_visit, frequency_decay, spend_trend, ...}
    predicted_churn_date = Column(Date, nullable=True)
    recommended_action = Column(Text, nullable=True)
    last_computed = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class DemandForecast(Base):
    """Daily demand prediction per outlet."""
    __tablename__ = "demand_forecasts"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=False)
    date = Column(Date, nullable=False)
    predicted_bookings = Column(Integer, nullable=False)
    predicted_revenue = Column(Numeric(14, 2), nullable=True)
    actual_bookings = Column(Integer, nullable=True)
    actual_revenue = Column(Numeric(14, 2), nullable=True)
    confidence = Column(Numeric(5, 2), default=0)
    model_version = Column(String(50), default="v1-heuristic")
    computed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class BriefingSchedule(Base):
    """User preferences for automated briefing delivery."""
    __tablename__ = "briefing_schedules"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete='CASCADE'), nullable=False)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    frequency = Column(String(50), default="daily")  # daily, weekly
    delivery_time = Column(String(10), default="08:00")  # HH:MM
    channels = Column(JSONB, default=lambda: {"in_app": True, "email": False})
    enabled = Column(Boolean, default=True)
    last_sent = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


# ─── Restaurant Orders & Menu ─────────────────────────────────────────

class MenuCategory(Base):
    """User-defined menu categories with optional icons and display ordering."""
    __tablename__ = "menu_categories"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=True)
    name = Column(String(100), nullable=False)
    icon = Column(Text, nullable=True)  # emoji char or /uploads/... URL
    display_order = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    company = relationship("Company", back_populates="menu_categories")


class MenuItem(Base):
    """Menu items for restaurant/café outlets."""
    __tablename__ = "menu_items"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=True)
    category = Column(String(100), default="General")  # Coffee, Snacks, Mains, etc.
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), default=0)
    image_url = Column(Text, nullable=True) # Legacy single image
    image_urls = Column(JSONB, default=list) # Array of image paths
    icon = Column(Text, nullable=True)  # emoji char or /uploads/... URL (fallback when no photo)
    inventory_product_id = Column(String, ForeignKey("products.id", ondelete='SET NULL'), nullable=True)
    inventory_linked = Column(Boolean, default=False)
    available = Column(Boolean, default=True)
    is_veg = Column(Boolean, default=True)
    nutritional_value = Column(Text, nullable=True)
    is_bestseller = Column(Boolean, default=False)
    tags = Column(JSONB, default=list)  # e.g. ["Spicy", "New", "Chef's Pick"]
    display_order = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    company = relationship("Company", back_populates="menu_items")
    inventory_product = relationship("Product", foreign_keys=[inventory_product_id])


class RestaurantOrder(Base):
    """Customer order from the public ordering portal or POS."""
    __tablename__ = "restaurant_orders"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='CASCADE'), nullable=False)
    order_number = Column(String(20), nullable=False)  # Short human-readable, e.g. "KC-0042"
    customer_name = Column(String(255), nullable=False)
    contact_number = Column(String(50), nullable=True)
    order_type = Column(String(50), default="dine_in")  # dine_in, takeaway, delivery
    items = Column(JSONB, default=list)  # [{itemId, name, quantity, price, inventoryLinked}]
    total_amount = Column(Numeric(10, 2), default=0)
    status = Column(String(50), default="New", index=True)  # New, Preparing, ReadyToCollect, Completed, Cancelled
    payment_status = Column(String(50), default="pending")  # pending, paid, failed
    payment_ref = Column(String(255), nullable=True)
    otp = Column(String(10), nullable=True)  # For home delivery verification
    pickup_pin = Column(String(6), nullable=True)  # 4-digit PIN shown to customer for collection
    confirmation_token = Column(String(100), nullable=False, unique=True)  # UUID for QR / status link
    whatsapp_status = Column(String(50), nullable=True)  # sent, delivered, failed
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    company = relationship("Company", back_populates="restaurant_orders")


class WhatsAppConfig(Base):
    """Per-company WhatsApp Business API configuration and template settings"""
    __tablename__ = "whatsapp_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, unique=True)
    enabled = Column(Boolean, default=False)
    phone_number_id = Column(String(255), nullable=True)       # Meta Phone Number ID
    waba_id = Column(String(255), nullable=True)               # WhatsApp Business Account ID
    access_token_enc = Column(Text, nullable=True)             # Encrypted access token
    display_phone = Column(String(50), nullable=True)          # e.g. +1 555-123-4567
    # Per-trigger template mapping (JSONB): { "booking_confirmed": { "template_name": "booking_conf_v1", "active": true }, ... }
    templates = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    company = relationship("Company", backref="whatsapp_config", uselist=False)


class WhatsAppMessageLog(Base):
    """Audit log of every WhatsApp message dispatched through the platform"""
    __tablename__ = "whatsapp_message_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False)
    trigger = Column(String(100), nullable=False)              # e.g. booking_confirmed
    template_name = Column(String(255), nullable=True)
    recipient_phone = Column(String(50), nullable=False)
    recipient_name = Column(String(255), nullable=True)
    wa_message_id = Column(String(255), nullable=True)         # ID returned by Meta API
    status = Column(String(50), nullable=False, default="queued")  # queued, sent, delivered, failed
    error_message = Column(Text, nullable=True)
    cost_usd = Column(Float, nullable=True)                    # estimated cost per message
    sent_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    company = relationship("Company", backref="whatsapp_logs")


class RazorpayConfig(Base):
    """Per-company Razorpay Route configuration — linked account + bank details"""
    __tablename__ = "razorpay_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id = Column(String(36), ForeignKey("companies.id"), nullable=False, unique=True)
    enabled = Column(Boolean, default=False)

    # ── Primary details (entered by company admin) ──────────────────────────
    linked_account_name = Column(String(255), nullable=True)
    contact_number      = Column(String(50),  nullable=True)
    email               = Column(String(255), nullable=True)

    # ── Bank details (entered by company admin, stored encrypted in prod) ───
    bank_account_number = Column(String(255), nullable=True)   # encrypt in prod
    bank_account_type   = Column(String(50),  nullable=True)   # savings | current
    ifsc_code           = Column(String(20),  nullable=True)
    beneficiary_name    = Column(String(255), nullable=True)

    # ── Razorpay API identifiers (set after linked account creation) ─────────
    razorpay_account_id    = Column(String(100), nullable=True)  # acc_xxxx
    razorpay_stakeholder_id = Column(String(100), nullable=True) # sth_xxxx
    account_status         = Column(String(50), nullable=True, default="draft")
    # draft | pending_verification | active | suspended | rejected

    penny_test_status = Column(String(50), nullable=True, default="pending")
    # pending | initiated | verified | failed

    # ── Platform fee (set by super admin, shown read-only to company) ────────
    platform_fee_pct  = Column(Float, nullable=False, default=1.75)  # % of service amount
    # GST on platform fee is always 18% (Indian statutory rate)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    company = relationship("Company", backref="razorpay_config", uselist=False)


# ─── Invoices ─────────────────────────────────────────────────────────────────

class InvoiceSettings(Base):
    """Per-company invoice configuration and defaults."""
    __tablename__ = "invoice_settings"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False, unique=True)

    prefix = Column(String(20), default="INV")
    next_number = Column(Integer, default=1)
    default_payment_terms = Column(String(50), default="net_30")  # due_on_receipt, net_7, net_15, net_30, net_45, net_60
    tax_name = Column(String(50), default="GST")
    default_tax_rate = Column(Numeric(5, 2), default=0)
    show_tax_breakdown = Column(Boolean, default=True)
    default_notes = Column(Text, nullable=True)
    default_footer = Column(Text, nullable=True)
    auto_generate_from_booking = Column(Boolean, default=False)
    auto_generate_from_order = Column(Boolean, default=False)
    auto_send_on_generate = Column(Boolean, default=False)
    brand_color = Column(String(20), default="#5FA8D3")
    email_subject = Column(String(255), default="Invoice {invoice_number} from {company_name}")
    email_body = Column(Text, default="Dear {customer_name},\n\nPlease find your invoice {invoice_number} attached.\n\nAmount Due: {currency}{total_amount}\nDue Date: {due_date}\n\nThank you for your business.\n\n{company_name}")
    # Company details override for invoice header
    invoice_company_name = Column(String(255), nullable=True)
    invoice_company_address = Column(Text, nullable=True)
    invoice_company_phone = Column(String(50), nullable=True)
    invoice_company_email = Column(String(255), nullable=True)
    invoice_company_website = Column(String(255), nullable=True)
    invoice_company_gstin = Column(String(50), nullable=True)
    currency = Column(String(10), default="INR")
    currency_symbol = Column(String(5), default="₹")

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    company = relationship("Company", back_populates="invoice_settings")


class Invoice(Base):
    """Customer-facing invoice document."""
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='SET NULL'), nullable=True)
    booking_id = Column(String, ForeignKey("bookings.id", ondelete='SET NULL'), nullable=True)
    order_id = Column(String, ForeignKey("restaurant_orders.id", ondelete='SET NULL'), nullable=True)

    invoice_number = Column(String(50), nullable=False, index=True)
    status = Column(String(50), default="draft", index=True)
    # draft | sent | paid | partially_paid | overdue | cancelled | void

    # Customer snapshot (denormalized for portability)
    customer_id = Column(String, ForeignKey("customers.id", ondelete='SET NULL'), nullable=True)
    customer_name = Column(String(255), nullable=False)
    customer_email = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    billing_address = Column(JSONB, nullable=True)  # {line1, line2, city, state, zip, country}

    # Line items: [{description, quantity, unit_price, tax_rate, discount, amount}]
    items = Column(JSONB, default=list)

    # Financials
    subtotal = Column(Numeric(14, 2), default=0)
    discount_amount = Column(Numeric(14, 2), default=0)
    tax_amount = Column(Numeric(14, 2), default=0)
    total_amount = Column(Numeric(14, 2), default=0)
    paid_amount = Column(Numeric(14, 2), default=0)
    currency = Column(String(10), default="INR")
    currency_symbol = Column(String(5), default="₹")

    # Dates & terms
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=True)
    payment_terms = Column(String(50), default="net_30")
    notes = Column(Text, nullable=True)
    footer = Column(Text, nullable=True)

    # Tracking
    sent_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    company = relationship("Company", back_populates="invoices")
    payments = relationship("InvoicePayment", back_populates="invoice", cascade="all, delete-orphan")


class InvoicePayment(Base):
    """Records partial or full payments against an invoice."""
    __tablename__ = "invoice_payments"

    id = Column(String, primary_key=True, default=generate_uuid)
    invoice_id = Column(String, ForeignKey("invoices.id", ondelete='CASCADE'), nullable=False)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False)

    amount = Column(Numeric(14, 2), nullable=False)
    payment_method = Column(String(50), default="cash")  # cash, card, bank_transfer, upi, cheque, other
    reference = Column(String(255), nullable=True)  # transaction ref, cheque number, etc.
    notes = Column(Text, nullable=True)
    paid_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    invoice = relationship("Invoice", back_populates="payments")


# ── Mobile Staff App Models ──────────────────────────────────────────────────

class StaffTask(Base):
    __tablename__ = "staff_tasks"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True)
    assigned_to = Column(String, ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), default="general")  # opening, closing, cleaning, prep, general
    priority = Column(String(20), default="normal")   # low, normal, high
    status = Column(String(20), default="pending")    # pending, in_progress, done
    due_date = Column(Date, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class StaffMessage(Base):
    __tablename__ = "staff_messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True)
    sender_id = Column(String, ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)
    sender_name = Column(String(255))
    channel = Column(String(50), default="general")   # general, section-a, managers, etc.
    content = Column(Text, nullable=False)
    message_type = Column(String(20), default="text") # text, system
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class StaffIncident(Base):
    __tablename__ = "staff_incidents"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True)
    reported_by = Column(String, ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)
    reporter_name = Column(String(255))
    incident_type = Column(String(50), nullable=False)  # complaint, accident, theft, quality, other
    severity = Column(String(20), default="medium")     # low, medium, high, critical
    description = Column(Text, nullable=False)
    table_ref = Column(String(50), nullable=True)       # table number if applicable
    customer_ref = Column(String(255), nullable=True)
    status = Column(String(20), default="open")         # open, under_review, resolved
    manager_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class ShiftNote(Base):
    __tablename__ = "shift_notes"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete="CASCADE"), nullable=True)
    author_id = Column(String, ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)
    author_name = Column(String(255))
    content = Column(Text, nullable=False)
    tags = Column(JSONB, default=list)  # ["vip", "pending", "urgent"]
    shift_date = Column(Date, nullable=False)
    shift_type = Column(String(20), default="day")  # morning, day, evening, night
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ============================================================
# MARKETING & CONVERSATIONS MODULE
# ============================================================

class MktInbox(Base):
    """A connected channel account (e.g. 'Riserve R WhatsApp')."""
    __tablename__ = "mkt_inboxes"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    channel = Column(String(50), nullable=False)  # whatsapp | instagram | facebook | telegram | email | sms
    credentials_ref = Column(Text)               # JSON blob with phone_number_id + access_token (never raw in prod)
    webhook_secret = Column(String(255))
    is_active = Column(Boolean, default=True)
    auto_assignment_rule = Column(String(50), default="round_robin")  # round_robin | load_based | manual
    business_hours = Column(JSONB, default=dict)
    feature_flags = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class MktCustomerIdentity(Base):
    """Links a Customer to one channel-specific handle."""
    __tablename__ = "mkt_customer_identities"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    channel = Column(String(50), nullable=False)       # whatsapp | instagram | ...
    external_id = Column(String(500), nullable=False)  # phone number, IG handle, PSID, etc.
    verified = Column(Boolean, default=False)
    source = Column(String(100))  # inbound_message | manual | import
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    # Unique constraint: one external_id per channel per company
    __table_args__ = (
        __import__('sqlalchemy').UniqueConstraint('company_id', 'channel', 'external_id',
                                                  name='uq_mkt_identity_company_channel_external'),
    )


class MktConsentLedger(Base):
    """Append-only opt-in / opt-out history. Never update rows — always insert."""
    __tablename__ = "mkt_consent_ledger"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    channel = Column(String(50), nullable=False)
    purpose = Column(String(50), nullable=False)   # transactional | marketing
    status = Column(String(20), nullable=False)    # granted | revoked
    source = Column(String(100))                   # inbound_stop | manual | import | checkout_opt_in
    evidence = Column(JSONB, default=dict)
    occurred_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MktConversation(Base):
    """One conversation thread, scoped to a single channel."""
    __tablename__ = "mkt_conversations"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    inbox_id = Column(String, ForeignKey("mkt_inboxes.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    customer_identity_id = Column(String, ForeignKey("mkt_customer_identities.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), default="open", index=True)  # open | pending | resolved | snoozed
    assignee_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    last_message_at = Column(DateTime(timezone=True), index=True)
    last_customer_message_at = Column(DateTime(timezone=True))
    unread_count = Column(Integer, default=0)
    labels = Column(JSONB, default=list)
    snooze_until = Column(DateTime(timezone=True), nullable=True)
    # AI agent state: "ai_handling" | "escalated" | "human_takeover" | null
    ai_handling_state = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class MktMessage(Base):
    """A single message in a conversation."""
    __tablename__ = "mkt_messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(String, ForeignKey("mkt_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    direction = Column(String(10), nullable=False)       # in | out
    sender_type = Column(String(20), nullable=False)     # customer | agent | bot | system
    sender_id = Column(String(255))
    content_type = Column(String(50), default="text")   # text | image | audio | video | document | template
    content_text = Column(Text)
    attachments = Column(JSONB, default=list)
    raw = Column(JSONB, default=dict)                    # channel-specific raw payload
    channel_message_id = Column(String(500))
    delivery_status = Column(String(20), default="sent")  # queued | sent | delivered | read | failed
    error_code = Column(String(100))
    sent_at = Column(DateTime(timezone=True))
    delivered_at = Column(DateTime(timezone=True))
    read_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MktInternalNote(Base):
    """Agent-only notes on a conversation (not sent to the customer)."""
    __tablename__ = "mkt_internal_notes"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    conversation_id = Column(String, ForeignKey("mkt_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    body = Column(Text, nullable=False)
    mentions = Column(JSONB, default=list)  # list of user IDs @mentioned
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class MktTemplate(Base):
    """Versioned message templates, per channel."""
    __tablename__ = "mkt_templates"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    channel = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    locale = Column(String(20), default="en")
    body = Column(Text, nullable=False)
    variables = Column(JSONB, default=dict)            # variable schema / sample values
    provider_status = Column(String(20))               # APPROVED | PENDING | REJECTED (WhatsApp)
    provider_template_id = Column(String(255))
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class MktFrequencyCapConfig(Base):
    """Per-company frequency cap + quiet-hours settings for marketing sends."""
    __tablename__ = "mkt_frequency_cap_configs"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True)
    max_per_day = Column(Integer, default=3)
    max_per_week = Column(Integer, default=10)
    quiet_hours_start = Column(String(5), default="22:00")   # HH:MM local time
    quiet_hours_end = Column(String(5), default="08:00")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class MktMessageSendCount(Base):
    """Daily per-customer per-channel marketing send counter for frequency cap enforcement."""
    __tablename__ = "mkt_message_send_counts"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    channel = Column(String(50), nullable=False)
    date = Column(Date, nullable=False)
    count = Column(Integer, default=0)
    __table_args__ = (
        __import__('sqlalchemy').UniqueConstraint('company_id', 'customer_id', 'channel', 'date',
                                                  name='uq_mkt_send_count_day'),
    )


class MktWebhookRawEvent(Base):
    """Raw inbound webhook payloads before processing (audit trail + retry safety)."""
    __tablename__ = "mkt_webhook_raw_events"

    id = Column(String, primary_key=True, default=generate_uuid)
    channel = Column(String(50), nullable=False)
    inbox_id = Column(String(255))
    payload = Column(JSONB, nullable=False)
    received_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    processed = Column(Boolean, default=False)
    processed_at = Column(DateTime(timezone=True))
    error = Column(Text)


class MktSegment(Base):
    __tablename__ = "mkt_segments"
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    rules = Column(JSONB, default=list)
    estimated_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class MktCampaign(Base):
    __tablename__ = "mkt_campaigns"
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    segment_id = Column(String, ForeignKey("mkt_segments.id", ondelete="SET NULL"), nullable=True)
    inbox_id = Column(String, ForeignKey("mkt_inboxes.id", ondelete="SET NULL"), nullable=True)
    template_id = Column(String, ForeignKey("mkt_templates.id", ondelete="SET NULL"), nullable=True)
    content_type = Column(String(20), default="freeform")
    content = Column(JSONB, default=dict)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), default="draft", index=True)
    stats = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class MktCampaignRecipient(Base):
    __tablename__ = "mkt_campaign_recipients"
    id = Column(String, primary_key=True, default=generate_uuid)
    campaign_id = Column(String, ForeignKey("mkt_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    identity_id = Column(String, ForeignKey("mkt_customer_identities.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), default="pending")
    sent_at = Column(DateTime(timezone=True), nullable=True)
    error = Column(Text)

class MktJourney(Base):
    __tablename__ = "mkt_journeys"
    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    trigger_type = Column(String(50), nullable=False)
    trigger_config = Column(JSONB, default=dict)
    dag = Column(JSONB, default=dict)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class MktJourneyEnrollment(Base):
    __tablename__ = "mkt_journey_enrollments"
    id = Column(String, primary_key=True, default=generate_uuid)
    journey_id = Column(String, ForeignKey("mkt_journeys.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    current_node_id = Column(String(255))
    status = Column(String(20), default="active")
    enrolled_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)

class MktJourneyStepLog(Base):
    __tablename__ = "mkt_journey_step_logs"
    id = Column(String, primary_key=True, default=generate_uuid)
    enrollment_id = Column(String, ForeignKey("mkt_journey_enrollments.id", ondelete="CASCADE"), nullable=False, index=True)
    node_id = Column(String(255), nullable=False)
    executed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    result = Column(JSONB, default=dict)


# ─── Agentic Marketing Layer ──────────────────────────────────────────────────

class KnowledgeSource(Base):
    __tablename__ = "knowledge_sources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False)
    type = Column(String(50), nullable=False)
    source_ref = Column(Text, nullable=True)
    status = Column(String(50), default="pending")
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    chunks = relationship("KnowledgeChunk", back_populates="source", cascade="all, delete-orphan")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    source_id = Column(String(36), ForeignKey("knowledge_sources.id", ondelete="CASCADE"), nullable=True)
    tenant_id = Column(String(36), nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536), nullable=True)
    chunk_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    source = relationship("KnowledgeSource", back_populates="chunks")


class BrandVoiceProfile(Base):
    __tablename__ = "brand_voice_profiles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False, unique=True)
    tone = Column(String(100), default="warm")
    do_phrases = Column(JSONB, default=list)
    dont_phrases = Column(JSONB, default=list)
    required_disclosures = Column(JSONB, default=list)
    example_messages = Column(JSONB, default=list)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AgentConfig(Base):
    __tablename__ = "agents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False)
    agent_name = Column(String(100), nullable=False)
    version = Column(String(50), default="v1")
    system_prompt_id = Column(String(200), nullable=True)
    model = Column(String(200), nullable=True)
    allowed_tools = Column(JSONB, default=list)
    autonomy_level = Column(String(10), default="L1")
    confidence_threshold = Column(Float, default=0.75)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    runs = relationship("AgentRun", back_populates="agent")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False)
    agent_id = Column(String(36), ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    started_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    finished_at = Column(DateTime(timezone=True), nullable=True)
    trigger_type = Column(String(100), nullable=True)
    trigger_payload = Column(JSONB, nullable=True)
    conversation_id = Column(String(36), ForeignKey("mkt_conversations.id", ondelete="SET NULL"), nullable=True)
    campaign_id = Column(String(36), nullable=True)
    total_tokens_in = Column(Integer, default=0)
    total_tokens_out = Column(Integer, default=0)
    total_cost_usd = Column(Numeric(10, 6), default=0)
    final_state = Column(String(50), default="running")
    confidence_score = Column(Float, nullable=True)
    escalation_reason = Column(Text, nullable=True)

    agent = relationship("AgentConfig", back_populates="runs")
    steps = relationship("AgentStep", back_populates="run", cascade="all, delete-orphan")
    tool_calls = relationship("ToolCallLog", back_populates="run")
    policy_violations = relationship("PolicyViolation", back_populates="run")
    escalations = relationship("Escalation", back_populates="run")


class AgentStep(Base):
    __tablename__ = "agent_steps"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    agent_run_id = Column(String(36), ForeignKey("agent_runs.id", ondelete="CASCADE"), nullable=False)
    step_index = Column(Integer, nullable=False)
    kind = Column(String(50), nullable=False)
    input = Column("input", JSONB, nullable=True)
    output = Column("output", JSONB, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    run = relationship("AgentRun", back_populates="steps")


class ToolCallLog(Base):
    __tablename__ = "tool_call_log"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    agent_run_id = Column(String(36), ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True)
    tenant_id = Column(String(36), nullable=False)
    tool_name = Column(String(200), nullable=False)
    scopes = Column(JSONB, nullable=True)
    input = Column("input", JSONB, nullable=True)
    output = Column("output", JSONB, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    idempotency_key = Column(String(200), nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    run = relationship("AgentRun", back_populates="tool_calls")


class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(String(200), primary_key=True)
    agent_name = Column(String(100), nullable=False)
    version = Column(String(50), nullable=False)
    body = Column(Text, nullable=False)
    created_by = Column(String(36), nullable=True)
    is_active = Column(Boolean, default=True)
    evaluation_score = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    eval_runs = relationship("EvalRun", back_populates="prompt")


class EvalRun(Base):
    __tablename__ = "eval_runs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    prompt_id = Column(String(200), ForeignKey("prompts.id", ondelete="SET NULL"), nullable=True)
    dataset_id = Column(String(200), nullable=True)
    score = Column(JSONB, nullable=True)
    regressions = Column(JSONB, nullable=True)
    run_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    prompt = relationship("Prompt", back_populates="eval_runs")


class PolicyViolation(Base):
    __tablename__ = "policy_violations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False)
    agent_run_id = Column(String(36), ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True)
    kind = Column(String(100), nullable=True)
    severity = Column(String(50), nullable=True)
    blocked = Column(Boolean, default=False)
    payload = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    run = relationship("AgentRun", back_populates="policy_violations")


class Escalation(Base):
    __tablename__ = "escalations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False)
    conversation_id = Column(String(36), ForeignKey("mkt_conversations.id", ondelete="SET NULL"), nullable=True)
    agent_run_id = Column(String(36), ForeignKey("agent_runs.id", ondelete="SET NULL"), nullable=True)
    reason = Column(Text, nullable=True)
    opened_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    closed_at = Column(DateTime(timezone=True), nullable=True)
    human_resolved_by = Column(String(36), nullable=True)
    post_mortem = Column(JSONB, nullable=True)

    run = relationship("AgentRun", back_populates="escalations")


class AgentCostDaily(Base):
    __tablename__ = "agent_cost_daily"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False)
    agent_name = Column(String(100), nullable=False)
    date = Column(Date, nullable=False)
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    cost_usd = Column(Numeric(10, 6), default=0)


# ---------------------------------------------------------------------------
# Acquisition Module — Instagram Publishing & Lead Capture
# ---------------------------------------------------------------------------

class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False, index=True)
    platform = Column(String(50), nullable=False)  # instagram|facebook|linkedin|tiktok|youtube
    external_id = Column(String(200), nullable=False)
    handle = Column(String(200), nullable=True)
    display_name = Column(String(200), nullable=True)
    access_token_ref = Column(Text, nullable=True)
    refresh_token_ref = Column(Text, nullable=True)
    scopes = Column(JSONB, default=list)
    connected_by = Column(String(36), nullable=True)
    status = Column(String(50), default="active")  # active|expired|revoked
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    posts = relationship("SocialPost", back_populates="account")


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False, index=True)
    kind = Column(String(50), nullable=False)  # image|video
    storage_url = Column(Text, nullable=False)
    storage_path = Column(Text, nullable=True)       # relative path for deletion
    storage_backend = Column(String(20), default='local')  # local|s3
    thumbnail_url = Column(Text, nullable=True)
    file_size = Column(Integer, nullable=True)        # bytes
    mime_type = Column(String(100), nullable=True)
    duration_seconds = Column(Float, nullable=True)
    dimensions = Column(JSONB, nullable=True)
    alt_text = Column(Text, nullable=True)
    tags = Column(JSONB, default=list)
    used_in_post_ids = Column(JSONB, default=list)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SocialPost(Base):
    __tablename__ = "social_posts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False, index=True)
    social_account_id = Column(String(36), ForeignKey("social_accounts.id", ondelete="CASCADE"), nullable=False)
    kind = Column(String(50), nullable=False)  # feed|reel|story|carousel
    status = Column(String(50), default="draft")  # draft|scheduled|publishing|published|failed|archived
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    caption = Column(Text, nullable=True)
    hashtags = Column(JSONB, default=list)
    media_asset_ids = Column(JSONB, default=list)
    external_post_id = Column(String(200), nullable=True)
    external_permalink = Column(Text, nullable=True)
    paid_partnership = Column(JSONB, nullable=True)
    publish_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    account = relationship("SocialAccount", back_populates="posts")
    metrics = relationship("PostMetric", back_populates="post")


class PostMetric(Base):
    __tablename__ = "post_metrics"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    social_post_id = Column(String(36), ForeignKey("social_posts.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(String(36), nullable=False)
    captured_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    impressions = Column(Integer, default=0)
    reach = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    saves = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    video_views = Column(Integer, default=0)
    video_completion_rate = Column(Float, nullable=True)
    profile_visits = Column(Integer, default=0)
    follows_attributed = Column(Integer, default=0)

    post = relationship("SocialPost", back_populates="metrics")


class LeadTrigger(Base):
    __tablename__ = "lead_triggers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    source_post_id = Column(String(36), nullable=True)
    trigger_type = Column(String(100), nullable=False)  # comment_keyword|story_reply|story_mention|dm_keyword|dm_default|referral_link
    match_rules = Column(JSONB, default=dict)
    flow_id = Column(String(36), ForeignKey("lead_flows.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True)
    daily_cap = Column(Integer, nullable=True)
    hourly_cap = Column(Integer, nullable=True)
    applies_to = Column(String(50), default="all_posts")  # specific_post|all_posts|specific_stories
    specific_post_ids = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    flow = relationship("LeadFlow", back_populates="triggers")


class LeadFlow(Base):
    __tablename__ = "lead_flows"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    version = Column(Integer, default=1)
    graph = Column(JSONB, default=dict)
    is_active = Column(Boolean, default=True)
    lead_magnet = Column(JSONB, nullable=True)
    qualification_threshold = Column(Integer, default=50)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    triggers = relationship("LeadTrigger", back_populates="flow")
    leads = relationship("Lead", back_populates="current_flow")


class Lead(Base):
    __tablename__ = "leads"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False, index=True)
    source_platform = Column(String(50), nullable=False, default="instagram")
    source_account_id = Column(String(36), ForeignKey("social_accounts.id", ondelete="SET NULL"), nullable=True)
    source_handle = Column(String(200), nullable=True)
    source_external_user_id = Column(String(200), nullable=True)
    source_post_id = Column(String(36), nullable=True)
    source_trigger_id = Column(String(36), ForeignKey("lead_triggers.id", ondelete="SET NULL"), nullable=True)
    captured_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    status = Column(String(50), default="new")  # new|engaging|qualified|converted|lost|blocked
    score = Column(Integer, default=0)
    score_breakdown = Column(JSONB, default=dict)
    current_flow_id = Column(String(36), ForeignKey("lead_flows.id", ondelete="SET NULL"), nullable=True)
    current_node_id = Column(String(200), nullable=True)
    flow_state = Column(JSONB, default=dict)
    owner_type = Column(String(50), default="bot")  # bot|human|none
    owner_id = Column(String(36), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    attributes = Column(JSONB, default=dict)
    captured_phone = Column(String(50), nullable=True)
    captured_email = Column(String(200), nullable=True)
    captured_name = Column(String(200), nullable=True)
    phone_verified = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)
    promoted_to_customer_id = Column(String(36), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    promoted_at = Column(DateTime(timezone=True), nullable=True)
    conversation_id = Column(String(36), ForeignKey("mkt_conversations.id", ondelete="SET NULL"), nullable=True)

    current_flow = relationship("LeadFlow", back_populates="leads")
    events = relationship("LeadEvent", back_populates="lead")


class LeadEvent(Base):
    __tablename__ = "lead_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(String(36), nullable=False)
    kind = Column(String(100), nullable=False)
    payload = Column(JSONB, default=dict)
    occurred_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    lead = relationship("Lead", back_populates="events")


class LeadQualificationRule(Base):
    __tablename__ = "lead_qualification_rules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False, index=True)
    rule = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AttributionLink(Base):
    __tablename__ = "attribution_links"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    tenant_id = Column(String(36), nullable=False, index=True)
    slug = Column(String(100), nullable=False, unique=True)
    target_url = Column(Text, nullable=False)
    source_post_id = Column(String(36), nullable=True)
    source_lead_flow_id = Column(String(36), ForeignKey("lead_flows.id", ondelete="SET NULL"), nullable=True)
    total_clicks = Column(Integer, default=0)
    unique_clicks = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Review(Base):
    __tablename__ = "reviews"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False, index=True)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='SET NULL'), nullable=True, index=True)
    source = Column(String(50), default='manual')  # google, zomato, justdial, tripadvisor, manual
    source_review_id = Column(String(255), nullable=True)
    author_name = Column(String(255), nullable=True)
    author_avatar_url = Column(String(500), nullable=True)
    rating = Column(Integer, nullable=False)
    content = Column(Text, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True, default=lambda: datetime.now(timezone.utc))
    reply_content = Column(Text, nullable=True)
    reply_status = Column(String(50), default='none')  # none, drafted, approved, published
    ai_draft = Column(Text, nullable=True)
    sentiment = Column(String(20), nullable=True)  # positive, neutral, negative
    topics = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ListingProfile(Base):
    __tablename__ = "listing_profiles"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False, index=True)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='SET NULL'), nullable=True, index=True)
    platform = Column(String(50), nullable=False)  # google, zomato, justdial, tripadvisor
    status = Column(String(50), default='not_connected')  # connected, not_connected, pending
    listing_url = Column(String(500), nullable=True)
    external_id = Column(String(255), nullable=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    meta = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class GEOQuery(Base):
    __tablename__ = "geo_queries"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False, index=True)
    query_text = Column(Text, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class GEOCheck(Base):
    __tablename__ = "geo_checks"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False, index=True)
    query_id = Column(String, ForeignKey("geo_queries.id", ondelete='CASCADE'), nullable=False, index=True)
    platform = Column(String(50), nullable=False)  # chatgpt, perplexity, google_ai
    simulated_response = Column(Text, nullable=True)
    cited = Column(Boolean, default=False)
    citation_excerpt = Column(Text, nullable=True)
    competitors_cited = Column(JSONB, default=list)
    checked_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class KnowledgeEntry(Base):
    __tablename__ = "knowledge_entries"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False, index=True)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='SET NULL'), nullable=True, index=True)
    category = Column(String(50), nullable=False)  # faq, highlight
    title = Column(Text, nullable=False)   # question text for FAQ, item name for highlights
    body = Column(Text, nullable=True)     # answer for FAQ, description for highlights
    sort_order = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AggregatorConnection(Base):
    __tablename__ = "aggregator_connections"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False, index=True)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='SET NULL'), nullable=True, index=True)
    platform = Column(String(50), nullable=False)  # zomato, swiggy, justdial, practo, urban_company, tripadvisor
    status = Column(String(50), default='manual')  # active, manual, inactive, error
    # api_key stored here until secrets management is wired
    api_key = Column(String(500), nullable=True)
    meta = Column(JSONB, default=dict)      # platform-specific config
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    order_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    orders = relationship("AggregatorOrder", back_populates="connection", cascade="all, delete-orphan")


class AggregatorOrder(Base):
    __tablename__ = "aggregator_orders"

    id = Column(String, primary_key=True, default=generate_uuid)
    company_id = Column(String, ForeignKey("companies.id", ondelete='CASCADE'), nullable=False, index=True)
    outlet_id = Column(String, ForeignKey("outlets.id", ondelete='SET NULL'), nullable=True, index=True)
    connection_id = Column(String, ForeignKey("aggregator_connections.id", ondelete='SET NULL'), nullable=True, index=True)
    platform = Column(String(50), nullable=False, index=True)
    external_order_id = Column(String(200), nullable=False)
    external_customer_id = Column(String(200), nullable=True)
    customer_name = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=True)   # may be masked/proxy
    customer_email = Column(String(255), nullable=True)
    amount = Column(Numeric(10, 2), nullable=True)
    items = Column(JSONB, default=list)     # [{name, quantity, price}]
    status = Column(String(50), default='delivered')  # placed, confirmed, delivered, cancelled
    ordered_at = Column(DateTime(timezone=True), nullable=True)
    # Customer identity resolution
    resolved_customer_id = Column(String, ForeignKey("customers.id", ondelete='SET NULL'), nullable=True, index=True)
    resolution_confidence = Column(Numeric(3, 2), nullable=True)  # 0.00–1.00
    first_party_bridge_sent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    connection = relationship("AggregatorConnection", back_populates="orders")
    resolved_customer = relationship("Customer", back_populates="aggregator_orders", foreign_keys=[resolved_customer_id])

