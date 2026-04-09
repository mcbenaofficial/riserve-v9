from sqlalchemy import Boolean, Column, DateTime, Date, ForeignKey, Integer, String, Text, Numeric, Table, Float
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

