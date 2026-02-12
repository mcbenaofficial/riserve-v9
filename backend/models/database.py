"""
Ri'DN Partner Dashboard - PostgreSQL Database Schema
Complete ERD Implementation with all tables
"""

from sqlalchemy import (
    create_engine, Column, String, Integer, Boolean, DateTime, Date, Time,
    Text, Numeric, ForeignKey, JSON, Index, UniqueConstraint, Enum, Table
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime, timezone
import uuid

Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

# ==================== AUTH & USERS ====================

class UserAuth(Base):
    __tablename__ = 'user_auth'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_verified = Column(Boolean, default=False)
    user_type = Column(String(50), default='direct')  # direct, partner_user, partner_invited_user
    email_verified_at = Column(DateTime(timezone=True))
    password_changed_at = Column(DateTime(timezone=True))
    failed_login_count = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True))
    disabled = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime(timezone=True))
    
    # Relationships - use primaryjoin for the one with multiple FKs
    customer_user = relationship("CustomerUser", 
                                 back_populates="user_auth", 
                                 uselist=False,
                                 primaryjoin="UserAuth.id==CustomerUser.user_auth_id")
    partner_users = relationship("PartnerUser", back_populates="user_auth")
    sessions = relationship("UserSession", back_populates="user_auth")
    auth_providers = relationship("UserAuthProvider", back_populates="user_auth")
    otp_requests = relationship("AuthOtpRequest", back_populates="user_auth")


class CustomerUser(Base):
    __tablename__ = 'customer_users'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_auth_id = Column(UUID(as_uuid=False), ForeignKey('user_auth.id'), nullable=False)
    partner_id = Column(UUID(as_uuid=False), ForeignKey('partners.id'))
    partner_visibility_mode = Column(String(20), default='private')  # private, public, internal_only
    first_name = Column(String(100))
    last_name = Column(String(100))
    phone = Column(String(20))
    country = Column(String(100))
    status = Column(String(20), default='active')  # active, disabled
    profile_picture_url = Column(String(500))
    invited_by_user_auth_id = Column(UUID(as_uuid=False), ForeignKey('user_auth.id'))
    invited_at = Column(DateTime(timezone=True))
    accepted_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user_auth = relationship("UserAuth", back_populates="customer_user", foreign_keys=[user_auth_id])
    partner = relationship("Partner", back_populates="customer_users")
    bookings = relationship("Booking", back_populates="customer_user")
    vehicles = relationship("Vehicle", back_populates="customer_user")
    subscriptions = relationship("Subscription", back_populates="customer_user")
    support_tickets = relationship("SupportTicket", back_populates="customer_user")
    user_reviews = relationship("UserReview", back_populates="customer_user")
    outlet_reviews = relationship("OutletReview", back_populates="customer_user")


class PartnerUser(Base):
    __tablename__ = 'partner_users'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_auth_id = Column(UUID(as_uuid=False), ForeignKey('user_auth.id'), nullable=False)
    partner_id = Column(UUID(as_uuid=False), ForeignKey('partners.id'), nullable=False)
    role = Column(String(50), default='staff')  # admin, manager, staff
    designation = Column(String(100))
    status = Column(String(20), default='active')  # active, inactive, blocked
    last_activity_at = Column(DateTime(timezone=True))
    employee_code = Column(String(50))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user_auth = relationship("UserAuth", back_populates="partner_users")
    partner = relationship("Partner", back_populates="partner_users")


class Partner(Base):
    __tablename__ = 'partners'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    parent_partner_id = Column(UUID(as_uuid=False), ForeignKey('partners.id'))
    depth_level = Column(Integer, default=0)
    ancestor_visibility = Column(Integer, default=0)
    descendant_visibility = Column(Integer, default=0)
    name = Column(String(255), nullable=False)
    contact_email = Column(String(255))
    contact_phone = Column(String(20))
    status = Column(String(20), default='active')  # active, inactive, suspended
    address = Column(Text)
    website = Column(String(500))
    billing_contact = Column(String(255))
    logo_url = Column(String(500))
    timezone = Column(String(50), default='UTC')
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    parent_partner = relationship("Partner", remote_side=[id], backref="child_partners")
    customer_users = relationship("CustomerUser", back_populates="partner")
    partner_users = relationship("PartnerUser", back_populates="partner")
    outlets = relationship("Outlet", back_populates="partner")


class UserAuthProvider(Base):
    __tablename__ = 'user_auth_providers'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_auth_id = Column(UUID(as_uuid=False), ForeignKey('user_auth.id'), nullable=False)
    provider = Column(String(50), nullable=False)  # google, apple, github, facebook
    provider_user_id = Column(String(255), nullable=False)
    email_from_provider = Column(String(255))
    profile_json = Column(JSONB)
    linked_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime(timezone=True))
    deleted_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        UniqueConstraint('provider', 'provider_user_id', name='uix_provider_user'),
    )
    
    # Relationships
    user_auth = relationship("UserAuth", back_populates="auth_providers")


class AuthOtpRequest(Base):
    __tablename__ = 'auth_otp_requests'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_auth_id = Column(UUID(as_uuid=False), ForeignKey('user_auth.id'))
    phone_e164 = Column(String(20))
    channel = Column(String(20))  # sms, whatsapp, call
    purpose = Column(String(50))  # login, signup, change_phone, 2fa
    code_hash = Column(String(255))
    attempt_count = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    expires_at = Column(DateTime(timezone=True))
    consumed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user_auth = relationship("UserAuth", back_populates="otp_requests")


# ==================== SESSIONS & ANALYTICS ====================

class UserSession(Base):
    __tablename__ = 'user_sessions'
    
    session_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_auth_id = Column(UUID(as_uuid=False), ForeignKey('user_auth.id'), nullable=False)
    platform_type = Column(String(50))  # mobile_app, web_app, partner_portal, outlet_kiosk
    device_id = Column(String(255))
    device_type = Column(String(50))  # ios, android, web_desktop, web_mobile, tablet
    device_manufacturer = Column(String(100))
    device_model = Column(String(100))
    os_name = Column(String(50))
    os_version = Column(String(50))
    app_version = Column(String(50))
    browser_name = Column(String(50))
    browser_version = Column(String(50))
    partner_id = Column(UUID(as_uuid=False), ForeignKey('partners.id'))
    session_start_time = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    session_end_time = Column(DateTime(timezone=True))
    last_activity_time = Column(DateTime(timezone=True))
    session_status = Column(String(20), default='active')  # active, idle, closed, expired, force_closed
    session_duration_seconds = Column(Integer)
    idle_duration_seconds = Column(Integer)
    ip_address = Column(String(45))
    country_code = Column(String(2))
    region = Column(String(100))
    city = Column(String(100))
    timezone = Column(String(50))
    connection_type = Column(String(20))  # wifi, 4g, 5g, ethernet, unknown
    carrier = Column(String(100))
    entry_point = Column(String(255))
    exit_point = Column(String(255))
    referrer_url = Column(String(500))
    utm_source = Column(String(100))
    utm_medium = Column(String(100))
    utm_campaign = Column(String(100))
    total_events_count = Column(Integer, default=0)
    page_views_count = Column(Integer, default=0)
    booking_events_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    api_calls_count = Column(Integer, default=0)
    crash_occurred = Column(Boolean, default=False)
    avg_page_load_ms = Column(Integer)
    total_data_transferred_kb = Column(Integer)
    termination_reason = Column(String(50))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user_auth = relationship("UserAuth", back_populates="sessions")
    events = relationship("SessionEvent", back_populates="session")


class SessionEvent(Base):
    __tablename__ = 'session_events'
    
    event_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    session_id = Column(UUID(as_uuid=False), ForeignKey('user_sessions.session_id'), nullable=False)
    user_auth_id = Column(UUID(as_uuid=False), ForeignKey('user_auth.id'))
    event_timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    event_type = Column(String(50))  # page_view, button_click, api_call, booking_action, error, navigation, form_submit
    event_category = Column(String(50))  # user_action, system_event, transaction, engagement, performance
    event_name = Column(String(100))
    screen_name = Column(String(255))
    previous_screen = Column(String(255))
    element_id = Column(String(100))
    element_type = Column(String(50))
    element_text = Column(String(255))
    event_properties = Column(JSONB)
    page_load_time_ms = Column(Integer)
    api_response_time_ms = Column(Integer)
    client_timestamp = Column(DateTime(timezone=True))
    error_occurred = Column(Boolean, default=False)
    error_message = Column(Text)
    error_stack_trace = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    session = relationship("UserSession", back_populates="events")


# ==================== OUTLETS & SERVICES ====================

class Outlet(Base):
    __tablename__ = 'outlets'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    outlet_type = Column(String(20), default='direct')  # direct, partner_outlet
    partner_id = Column(UUID(as_uuid=False), ForeignKey('partners.id'))
    name = Column(String(255), nullable=False)
    city = Column(String(100))
    address = Column(Text)
    latitude = Column(Numeric(10, 8))
    longitude = Column(Numeric(11, 8))
    capacity = Column(Integer, default=1)
    machines = Column(Integer, default=1)
    rating = Column(Numeric(2, 1), default=0)
    solar = Column(Boolean, default=False)
    water_recycle = Column(Boolean, default=False)
    status = Column(String(20), default='active')  # active, inactive, maintenance, closed
    open_time = Column(Time)
    close_time = Column(Time)
    timezone = Column(String(50), default='UTC')
    image_url = Column(String(500))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    partner = relationship("Partner", back_populates="outlets")
    bookings = relationship("Booking", back_populates="outlet", foreign_keys="Booking.outlet_id")
    slots = relationship("Slot", back_populates="outlet")
    outlet_services = relationship("OutletService", back_populates="outlet")
    devices = relationship("Device", back_populates="outlet")
    maintenance_records = relationship("MaintenanceRecord", back_populates="outlet")
    inventory_items = relationship("InventoryItem", back_populates="outlet")
    cafe_menu_items = relationship("CafeMenuItem", back_populates="outlet")
    car_wash_types = relationship("CarWashType", back_populates="outlet")
    charger_types = relationship("ChargerType", back_populates="outlet")


class Service(Base):
    __tablename__ = 'services'
    
    service_id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    requires_equipment = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    duration_min = Column(Integer, default=30)
    price = Column(Numeric(10, 2), default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    outlet_services = relationship("OutletService", back_populates="service")
    bookings = relationship("Booking", back_populates="service")


class OutletService(Base):
    __tablename__ = 'outlet_services'
    
    outlet_services_id = Column(Integer, primary_key=True, autoincrement=True)
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'), nullable=False)
    service_id = Column(Integer, ForeignKey('services.service_id'), nullable=False)
    available_slots = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    outlet = relationship("Outlet", back_populates="outlet_services")
    service = relationship("Service", back_populates="outlet_services")


class Slot(Base):
    __tablename__ = 'slots'
    
    slot_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'), nullable=False)
    slot_number = Column(String(50))
    slot_type = Column(String(50))  # Wash Bay, Cafe Table, EV Charger, etc.
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    outlet = relationship("Outlet", back_populates="slots")
    allocations = relationship("SlotAllocation", back_populates="slot")


class SlotAllocation(Base):
    __tablename__ = 'slot_allocations'
    
    allocation_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    slot_id = Column(UUID(as_uuid=False), ForeignKey('slots.slot_id'), nullable=False)
    booking_id = Column(UUID(as_uuid=False), ForeignKey('bookings.booking_id'), nullable=False)
    status = Column(String(20), default='allocated')  # Allocated, Released
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    slot = relationship("Slot", back_populates="allocations")
    booking = relationship("Booking", back_populates="slot_allocations")


# ==================== BOOKINGS & TRANSACTIONS ====================

class Booking(Base):
    __tablename__ = 'bookings'
    
    booking_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    customer_user_id = Column(UUID(as_uuid=False), ForeignKey('customer_users.id'), nullable=False)
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'))
    service_id = Column(Integer, ForeignKey('services.service_id'))
    requested_outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'))
    requested_start = Column(DateTime(timezone=True))
    requested_end = Column(DateTime(timezone=True))
    scheduled_time = Column(DateTime(timezone=True))
    status = Column(String(20), default='scheduled')  # scheduled, completed, cancelled, no_show
    allocated = Column(Boolean, default=False)
    payment_status = Column(String(20), default='pending')  # pending, paid, refunded, failed
    total_amount = Column(Numeric(10, 2), default=0)
    notes = Column(Text)
    customer_name = Column(String(255))  # Denormalized for quick access
    customer_phone = Column(String(20))
    time = Column(String(10))  # Time slot like "10:00"
    date = Column(Date)
    resource_id = Column(String(100))  # Resource/stylist assigned
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    customer_user = relationship("CustomerUser", back_populates="bookings")
    outlet = relationship("Outlet", back_populates="bookings", foreign_keys=[outlet_id])
    service = relationship("Service", back_populates="bookings")
    slot_allocations = relationship("SlotAllocation", back_populates="booking")
    transactions = relationship("Transaction", back_populates="booking")
    refunds = relationship("Refund", back_populates="booking")
    cafe_orders = relationship("CafeOrder", back_populates="booking")
    wash_sessions = relationship("WashSession", back_populates="booking")
    charging_sessions = relationship("ChargingSession", back_populates="booking")


class PaymentMethod(Base):
    __tablename__ = 'payment_methods'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    customer_user_id = Column(UUID(as_uuid=False), ForeignKey('customer_users.id'), nullable=False)
    type = Column(String(50), nullable=False)  # card, UPI, wallet, cod
    provider = Column(String(100))  # Visa, MasterCard, Paytm, PhonePe
    masked_details = Column(String(50))
    token = Column(String(500))
    card_expiry_date = Column(Date)
    verification_status = Column(String(20), default='pending')
    is_default = Column(Boolean, default=False)
    last_used_at = Column(DateTime(timezone=True))
    failure_count = Column(Integer, default=0)
    notes = Column(JSONB)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    transactions = relationship("Transaction", back_populates="payment_method")
    subscriptions = relationship("Subscription", back_populates="payment_method")


class Transaction(Base):
    __tablename__ = 'transactions'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    booking_id = Column(UUID(as_uuid=False), ForeignKey('bookings.booking_id'))
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'))
    customer_user_id = Column(UUID(as_uuid=False), ForeignKey('customer_users.id'))
    payment_method_id = Column(UUID(as_uuid=False), ForeignKey('payment_methods.id'))
    transaction_type = Column(String(20), default='payment')  # payment, refund, adjustment, chargeback
    failure_reason = Column(String(255))
    original_transaction_id = Column(UUID(as_uuid=False), ForeignKey('transactions.id'))
    gross_amount = Column(Numeric(10, 2), default=0)
    discount_amount = Column(Numeric(10, 2), default=0)
    commission_amount = Column(Numeric(10, 2), default=0)
    partner_share = Column(Numeric(10, 2), default=0)
    net_amount = Column(Numeric(10, 2), default=0)
    settlement_status = Column(String(20), default='pending')  # pending, completed, failed, refunded
    gateway_reference = Column(String(255))
    custom_metadata = Column(JSONB)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    booking = relationship("Booking", back_populates="transactions")
    payment_method = relationship("PaymentMethod", back_populates="transactions")
    original_transaction = relationship("Transaction", remote_side=[id])


class Refund(Base):
    __tablename__ = 'refunds'
    
    refund_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    original_transaction_id = Column(UUID(as_uuid=False), ForeignKey('transactions.id'))
    refund_transaction_id = Column(UUID(as_uuid=False), ForeignKey('transactions.id'))
    booking_id = Column(UUID(as_uuid=False), ForeignKey('bookings.booking_id'))
    customer_user_id = Column(UUID(as_uuid=False), ForeignKey('customer_users.id'))
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'))
    requested_amount = Column(Numeric(10, 2))
    approved_amount = Column(Numeric(10, 2))
    refunded_amount = Column(Numeric(10, 2))
    refund_type = Column(String(20))  # full, partial, goodwill, chargeback, adjustment
    refund_reason_code = Column(String(50))
    refund_reason_notes = Column(Text)
    refund_status = Column(String(20), default='requested')  # requested, approved, rejected, processing, completed, failed, reversed
    gateway_reference = Column(String(255))
    requested_by = Column(UUID(as_uuid=False), ForeignKey('user_auth.id'))
    approved_by = Column(UUID(as_uuid=False), ForeignKey('user_auth.id'))
    requested_at = Column(DateTime(timezone=True))
    approved_at = Column(DateTime(timezone=True))
    processed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    booking = relationship("Booking", back_populates="refunds")


# ==================== VEHICLES ====================

class Vehicle(Base):
    __tablename__ = 'vehicles'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    customer_user_id = Column(UUID(as_uuid=False), ForeignKey('customer_users.id'), nullable=False)
    registration_number = Column(String(20))
    make = Column(String(100))
    model = Column(String(100))
    year = Column(Integer)
    color = Column(String(50))
    fuel_type = Column(String(20))  # petrol, diesel, electric, hybrid
    battery_capacity = Column(String(20))
    connector_type = Column(String(20))  # CCS2, CHAdeMO, Type2
    vehicle_status = Column(String(20), default='active')  # active, inactive, servicing, retired
    preferred_outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'))
    remarks = Column(Text)
    vehicle_metadata = Column(JSONB)  # Renamed from 'metadata' to avoid SQLAlchemy conflict
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    customer_user = relationship("CustomerUser", back_populates="vehicles")
    subscriptions = relationship("Subscription", back_populates="vehicle")


# ==================== PROMOTIONS & SUBSCRIPTIONS ====================

class Promotion(Base):
    __tablename__ = 'promotions'
    
    promotion_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    promotion_type = Column(String(20))  # customer_level, outlet_level, booking_level, global
    discount_type = Column(String(20))  # percentage, fixed_amount, fixed_price
    discount_value = Column(Numeric(10, 2))
    valid_from = Column(DateTime(timezone=True))
    valid_to = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    rules = Column(Text)  # JSON-encoded
    is_subscription_package = Column(Boolean, default=False)
    validity_days = Column(Integer)
    package_tier = Column(String(50))  # basic, starter, premium, fleet, VIP
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    coupons = relationship("Coupon", back_populates="promotion")
    subscriptions = relationship("Subscription", back_populates="promotion")
    package_services = relationship("PackageService", back_populates="promotion")


class Coupon(Base):
    __tablename__ = 'coupons'
    
    coupon_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    promotion_id = Column(UUID(as_uuid=False), ForeignKey('promotions.promotion_id'))
    code = Column(String(50))
    coupon_type = Column(String(30))  # customer_level, outlet_level, booking_level, global, subscription_credit
    assigned_customer_id = Column(UUID(as_uuid=False), ForeignKey('customer_users.id'))
    assigned_outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'))
    discount_type = Column(String(20))  # percentage, fixed_amount, fixed_price, prepaid
    discount_value = Column(Numeric(10, 2))
    usage_limit_total = Column(Integer)
    usage_limit_per_customer = Column(Integer)
    active = Column(Boolean, default=True)
    coupon_metadata = Column(Text)  # Renamed from 'metadata' to avoid SQLAlchemy conflict
    valid_from = Column(DateTime(timezone=True))
    valid_to = Column(DateTime(timezone=True))
    subscription_id = Column(UUID(as_uuid=False), ForeignKey('subscriptions.subscription_id'))
    service_id = Column(Integer, ForeignKey('services.service_id'))
    total_redemptions_allowed = Column(Integer)
    redemptions_remaining = Column(Integer)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    promotion = relationship("Promotion", back_populates="coupons")
    redemptions = relationship("CouponRedemption", back_populates="coupon")


class Subscription(Base):
    __tablename__ = 'subscriptions'
    
    subscription_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    customer_user_id = Column(UUID(as_uuid=False), ForeignKey('customer_users.id'), nullable=False)
    promotion_id = Column(UUID(as_uuid=False), ForeignKey('promotions.promotion_id'))
    vehicle_id = Column(UUID(as_uuid=False), ForeignKey('vehicles.id'))
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String(20), default='active')  # active, expired, cancelled, paused
    payment_method_id = Column(UUID(as_uuid=False), ForeignKey('payment_methods.id'))
    transaction_id = Column(UUID(as_uuid=False), ForeignKey('transactions.id'))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    customer_user = relationship("CustomerUser", back_populates="subscriptions")
    promotion = relationship("Promotion", back_populates="subscriptions")
    vehicle = relationship("Vehicle", back_populates="subscriptions")
    payment_method = relationship("PaymentMethod", back_populates="subscriptions")


class PackageService(Base):
    __tablename__ = 'package_services'
    
    package_service_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    promotion_id = Column(UUID(as_uuid=False), ForeignKey('promotions.promotion_id'), nullable=False)
    service_id = Column(Integer, ForeignKey('services.service_id'), nullable=False)
    included_count = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    promotion = relationship("Promotion", back_populates="package_services")


class CouponRedemption(Base):
    __tablename__ = 'coupon_redemptions'
    
    redemption_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    coupon_id = Column(UUID(as_uuid=False), ForeignKey('coupons.coupon_id'))
    promotion_id = Column(UUID(as_uuid=False), ForeignKey('promotions.promotion_id'))
    booking_id = Column(UUID(as_uuid=False), ForeignKey('bookings.booking_id'))
    customer_user_id = Column(UUID(as_uuid=False), ForeignKey('customer_users.id'))
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'))
    pre_discount_amount = Column(Numeric(10, 2))
    discounted_amount = Column(Numeric(10, 2))
    status = Column(String(20), default='redeemed')  # redeemed, voided, failed, expired
    redemption_metadata = Column(Text)  # Renamed from 'metadata' to avoid SQLAlchemy conflict
    redeemed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    coupon = relationship("Coupon", back_populates="redemptions")


# ==================== SUPPORT & REVIEWS ====================

class SupportTicket(Base):
    __tablename__ = 'support_tickets'
    
    ticket_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    ticket_number = Column(String(50), unique=True)
    customer_user_id = Column(UUID(as_uuid=False), ForeignKey('customer_users.id'))
    created_by_partner_user_id = Column(UUID(as_uuid=False), ForeignKey('partner_users.id'))
    ticket_type = Column(String(30))  # booking, application, service, billing, account, subscription, vehicle, other
    ticket_category = Column(String(30))  # technical, operational, complaint, inquiry, feature_request, refund
    subject = Column(String(200))
    description = Column(Text)
    booking_id = Column(UUID(as_uuid=False), ForeignKey('bookings.booking_id'))
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'))
    subscription_id = Column(UUID(as_uuid=False), ForeignKey('subscriptions.subscription_id'))
    vehicle_id = Column(UUID(as_uuid=False), ForeignKey('vehicles.id'))
    status = Column(String(20), default='open')  # open, assigned, in_progress, pending_customer, resolved, closed, reopened
    priority = Column(String(10), default='medium')  # low, medium, high, critical
    assigned_to = Column(UUID(as_uuid=False), ForeignKey('partner_users.id'))
    assigned_at = Column(DateTime(timezone=True))
    first_response_at = Column(DateTime(timezone=True))
    resolved_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))
    resolution_summary = Column(Text)
    satisfaction_rating = Column(Integer)
    customer_feedback = Column(Text)
    feedback_at = Column(DateTime(timezone=True))
    source = Column(String(20))  # mobile_app, web_portal, email, phone, chat, in_person
    attachments = Column(JSONB)
    ticket_metadata = Column(JSONB)  # Renamed from 'metadata' to avoid SQLAlchemy conflict
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    customer_user = relationship("CustomerUser", back_populates="support_tickets")
    messages = relationship("SupportMessage", back_populates="ticket")


class SupportMessage(Base):
    __tablename__ = 'support_messages'
    
    message_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    ticket_id = Column(UUID(as_uuid=False), ForeignKey('support_tickets.ticket_id'), nullable=False)
    sender_user_id = Column(UUID(as_uuid=False))
    sender_type = Column(String(20))  # customer, agent, system
    message_body = Column(Text)
    attachments = Column(JSONB)
    message_type = Column(String(30), default='public')  # public, internal_note, system_notification
    is_resolution = Column(Boolean, default=False)
    previous_status = Column(String(20))
    new_status = Column(String(20))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    ticket = relationship("SupportTicket", back_populates="messages")


class UserReview(Base):
    __tablename__ = 'user_reviews'
    
    review_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    customer_user_id = Column(UUID(as_uuid=False), ForeignKey('customer_users.id'), nullable=False)
    booking_id = Column(UUID(as_uuid=False), ForeignKey('bookings.booking_id'))
    service_id = Column(Integer, ForeignKey('services.service_id'))
    vehicle_id = Column(UUID(as_uuid=False), ForeignKey('vehicles.id'))
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'))
    overall_rating = Column(Numeric(2, 1))
    service_quality_rating = Column(Numeric(2, 1))
    value_for_money_rating = Column(Numeric(2, 1))
    timeliness_rating = Column(Numeric(2, 1))
    review_title = Column(String(100))
    review_body = Column(Text)
    attachments = Column(JSONB)
    is_verified = Column(Boolean, default=False)
    is_published = Column(Boolean, default=False)
    moderation_status = Column(String(20), default='pending')  # pending, approved, rejected, flagged
    moderation_notes = Column(Text)
    is_recommended = Column(Boolean)
    tags = Column(JSONB)
    helpful_count = Column(Integer, default=0)
    not_helpful_count = Column(Integer, default=0)
    responded_by = Column(UUID(as_uuid=False), ForeignKey('partner_users.id'))
    partner_response = Column(Text)
    responded_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    customer_user = relationship("CustomerUser", back_populates="user_reviews")


class OutletReview(Base):
    __tablename__ = 'outlet_reviews'
    
    review_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'), nullable=False)
    customer_user_id = Column(UUID(as_uuid=False), ForeignKey('customer_users.id'), nullable=False)
    booking_id = Column(UUID(as_uuid=False), ForeignKey('bookings.booking_id'))
    overall_rating = Column(Numeric(2, 1))
    cleanliness_rating = Column(Numeric(2, 1))
    staff_behavior_rating = Column(Numeric(2, 1))
    facilities_rating = Column(Numeric(2, 1))
    ambiance_rating = Column(Numeric(2, 1))
    location_accessibility_rating = Column(Numeric(2, 1))
    review_title = Column(String(100))
    review_body = Column(Text)
    attachments = Column(JSONB)
    is_verified = Column(Boolean, default=False)
    is_published = Column(Boolean, default=False)
    moderation_status = Column(String(20), default='pending')
    moderation_notes = Column(Text)
    is_recommended = Column(Boolean)
    tags = Column(JSONB)
    helpful_count = Column(Integer, default=0)
    not_helpful_count = Column(Integer, default=0)
    responded_by = Column(UUID(as_uuid=False), ForeignKey('partner_users.id'))
    outlet_response = Column(Text)
    responded_at = Column(DateTime(timezone=True))
    visit_verified = Column(Boolean, default=False)
    visit_date = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    customer_user = relationship("CustomerUser", back_populates="outlet_reviews")


# ==================== DEVICES & OPERATIONS ====================

class Device(Base):
    __tablename__ = 'devices'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'), nullable=False)
    name = Column(String(255))
    type = Column(String(50))  # POS terminal, EV charger, sensor
    model = Column(String(100))
    manufacturer = Column(String(100))
    status = Column(String(20), default='active')  # active, inactive, error
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    outlet = relationship("Outlet", back_populates="devices")
    analytics = relationship("DeviceAnalytics", back_populates="device")
    events = relationship("DeviceEvent", back_populates="device")


class DeviceAnalytics(Base):
    __tablename__ = 'device_analytics'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    device_id = Column(UUID(as_uuid=False), ForeignKey('devices.id'), nullable=False)
    metric_name = Column(String(100))
    metric_value = Column(Numeric(15, 4))
    metric_unit = Column(String(20))
    recorded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    analytics_metadata = Column(JSONB)  # Renamed from 'metadata' to avoid SQLAlchemy conflict
    
    # Relationships
    device = relationship("Device", back_populates="analytics")


class DeviceEvent(Base):
    __tablename__ = 'device_events'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    device_id = Column(UUID(as_uuid=False), ForeignKey('devices.id'), nullable=False)
    event_type = Column(String(50))
    event_data = Column(JSONB)
    occurred_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    device = relationship("Device", back_populates="events")


class MaintenanceRecord(Base):
    __tablename__ = 'maintenance_records'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'), nullable=False)
    type = Column(String(30))  # preventive, corrective
    notes = Column(Text)
    cost = Column(Numeric(10, 2))
    date = Column(DateTime(timezone=True))
    maintenance_status = Column(String(20), default='pending')  # pending, in_progress, completed, cancelled, verified
    scheduled_date = Column(DateTime(timezone=True))
    completion_date = Column(DateTime(timezone=True))
    part_ids_used = Column(JSONB)
    duration_minutes = Column(Integer)
    is_warranty_job = Column(Boolean, default=False)
    failure_reason = Column(Text)
    downtime_minutes = Column(Integer)
    
    # Relationships
    outlet = relationship("Outlet", back_populates="maintenance_records")


class InventoryItem(Base):
    __tablename__ = 'inventory_items'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'), nullable=False)
    name = Column(String(255), nullable=False)
    sku = Column(String(50))
    category = Column(String(50))  # spare_part, fluid, tool
    qty = Column(Integer, default=0)
    threshold = Column(Integer, default=5)
    reorder_to = Column(Integer)
    unit_cost = Column(Numeric(10, 2))
    last_restocked_at = Column(DateTime(timezone=True))
    expiry_date = Column(DateTime(timezone=True))
    is_active = Column(Boolean, default=True)
    lot_number = Column(String(50))
    condition = Column(String(20), default='new')  # new, used, refurbished, faulty, expired
    status = Column(String(20), default='in_stock')  # in_stock, reserved, in_use, disposed, damaged
    warranty_expiry = Column(DateTime(timezone=True))
    location_id = Column(String(50))
    usage_frequency = Column(Integer, default=0)
    avg_lead_time_days = Column(Integer)
    is_critical_spare = Column(Boolean, default=False)
    custom_fields = Column(JSONB)
    attachments = Column(JSONB)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    outlet = relationship("Outlet", back_populates="inventory_items")


# ==================== SERVICE-SPECIFIC TABLES ====================

class CafeMenuItem(Base):
    __tablename__ = 'cafe_menu_items'
    
    menu_item_id = Column(Integer, primary_key=True, autoincrement=True)
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'), nullable=False)
    item_name = Column(String(255), nullable=False)
    item_type = Column(String(50))  # Beverage, Pastry, Main
    base_price = Column(Numeric(10, 2))
    is_active = Column(Boolean, default=True)
    config = Column(JSONB)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    outlet = relationship("Outlet", back_populates="cafe_menu_items")
    order_items = relationship("CafeOrderItem", back_populates="menu_item")


class CafeOrder(Base):
    __tablename__ = 'cafe_orders'
    
    order_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    booking_id = Column(UUID(as_uuid=False), ForeignKey('bookings.booking_id'))
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'), nullable=False)
    order_status = Column(String(20), default='pending')  # pending, preparing, served, cancelled
    total_amount = Column(Numeric(10, 2), default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    booking = relationship("Booking", back_populates="cafe_orders")
    items = relationship("CafeOrderItem", back_populates="order")


class CafeOrderItem(Base):
    __tablename__ = 'cafe_order_items'
    
    item_id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(UUID(as_uuid=False), ForeignKey('cafe_orders.order_id'), nullable=False)
    menu_item_id = Column(Integer, ForeignKey('cafe_menu_items.menu_item_id'))
    item_name = Column(String(255))
    quantity = Column(Integer, default=1)
    unit_price = Column(Numeric(10, 2))
    total_price = Column(Numeric(10, 2))
    price_at_time = Column(Numeric(10, 2))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    order = relationship("CafeOrder", back_populates="items")
    menu_item = relationship("CafeMenuItem", back_populates="order_items")


class CarWashType(Base):
    __tablename__ = 'car_wash_types'
    
    wash_type_id = Column(Integer, primary_key=True, autoincrement=True)
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'), nullable=False)
    wash_type = Column(String(100), nullable=False)
    description = Column(Text)
    price = Column(Numeric(10, 2))
    is_active = Column(Boolean, default=True)
    config = Column(JSONB)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    outlet = relationship("Outlet", back_populates="car_wash_types")
    wash_sessions = relationship("WashSession", back_populates="wash_type_rel")


class WashSession(Base):
    __tablename__ = 'wash_sessions'
    
    session_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    booking_id = Column(UUID(as_uuid=False), ForeignKey('bookings.booking_id'))
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'), nullable=False)
    wash_type_id = Column(Integer, ForeignKey('car_wash_types.wash_type_id'))
    wash_type = Column(String(100))
    session_status = Column(String(20), default='pending')
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    wash_cost = Column(Numeric(10, 2))
    price_at_time = Column(Numeric(10, 2))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    booking = relationship("Booking", back_populates="wash_sessions")
    wash_type_rel = relationship("CarWashType", back_populates="wash_sessions")


class ChargerType(Base):
    __tablename__ = 'charger_types'
    
    charger_type_id = Column(Integer, primary_key=True, autoincrement=True)
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'), nullable=False)
    connector_type = Column(String(50))  # CCS, Type-2, CHAdeMO
    kw_rating = Column(Integer)
    base_rate = Column(Numeric(10, 4))
    rate_unit = Column(String(20))  # per kWh
    is_active = Column(Boolean, default=True)
    config = Column(JSONB)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    outlet = relationship("Outlet", back_populates="charger_types")
    charging_sessions = relationship("ChargingSession", back_populates="charger_type_rel")


class ChargingSession(Base):
    __tablename__ = 'charging_sessions'
    
    session_id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    booking_id = Column(UUID(as_uuid=False), ForeignKey('bookings.booking_id'))
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'), nullable=False)
    charger_type_id = Column(Integer, ForeignKey('charger_types.charger_type_id'))
    energy_delivered_kwh = Column(Numeric(10, 4))
    session_status = Column(String(20), default='pending')
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    charging_cost = Column(Numeric(10, 2))
    rate_at_time = Column(Numeric(10, 4))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    deleted_at = Column(DateTime(timezone=True))
    
    # Relationships
    booking = relationship("Booking", back_populates="charging_sessions")
    charger_type_rel = relationship("ChargerType", back_populates="charging_sessions")


class SolarEnergyAnalytics(Base):
    __tablename__ = 'solar_energy_analytics'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'), nullable=False)
    device_id = Column(UUID(as_uuid=False), ForeignKey('devices.id'))
    booking_id = Column(UUID(as_uuid=False), ForeignKey('bookings.booking_id'))
    session_id = Column(UUID(as_uuid=False))  # Can reference charging or wash session
    energy_generated_kwh = Column(Numeric(10, 4))
    energy_consumed_kwh = Column(Numeric(10, 4))
    grid_export_kwh = Column(Numeric(10, 4))
    grid_import_kwh = Column(Numeric(10, 4))
    recorded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    solar_metadata = Column(JSONB)  # Renamed from 'metadata' to avoid SQLAlchemy conflict


# ==================== ADDITIONAL TABLES FOR CURRENT APP FEATURES ====================

class DashboardConfig(Base):
    """Dashboard configuration for customizable dashboards"""
    __tablename__ = 'dashboard_configs'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey('user_auth.id'), nullable=False)
    name = Column(String(100), default='Main Dashboard')
    is_default = Column(Boolean, default=True)
    widgets = Column(JSONB, default=[])
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class AIConversation(Base):
    """AI Assistant conversation history"""
    __tablename__ = 'ai_conversations'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey('user_auth.id'), nullable=False)
    title = Column(String(255), default='New Conversation')
    messages = Column(JSONB, default=[])
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class SlotConfig(Base):
    """Slot booking configuration for outlets"""
    __tablename__ = 'slot_configs'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    outlet_id = Column(UUID(as_uuid=False), ForeignKey('outlets.id'), nullable=False, unique=True)
    business_type = Column(String(50), default='car_wash')
    slot_duration_min = Column(Integer, default=30)
    operating_hours_start = Column(String(5), default='08:00')
    operating_hours_end = Column(String(5), default='20:00')
    resources = Column(JSONB, default=[])
    allow_online_booking = Column(Boolean, default=True)
    booking_advance_days = Column(Integer, default=7)
    embed_token = Column(UUID(as_uuid=False), default=generate_uuid, unique=True)
    customer_fields = Column(JSONB, default=[])
    plan = Column(String(20), default='free')  # free, plus
    branding = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class PromotionCustomer(Base):
    """Promotion to customer assignments"""
    __tablename__ = 'promotion_customers'
    
    id = Column(UUID(as_uuid=False), primary_key=True, default=generate_uuid)
    promotion_id = Column(UUID(as_uuid=False), ForeignKey('promotions.promotion_id'), nullable=False)
    customer_user_id = Column(UUID(as_uuid=False), ForeignKey('customer_users.id'), nullable=False)
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True))
    usage_limit = Column(Integer)
    promotion_customer_metadata = Column(Text)  # Renamed from 'metadata' to avoid SQLAlchemy conflict


# Create engine and session factory
def get_engine(database_url: str):
    return create_engine(database_url, echo=False)

def get_session_factory(engine):
    return sessionmaker(bind=engine)

def create_all_tables(engine):
    Base.metadata.create_all(engine)
    
def drop_all_tables(engine):
    Base.metadata.drop_all(engine)
