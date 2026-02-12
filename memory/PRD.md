# Ri'Serve - Service Operations SaaS

## Overview
Ri'Serve is a **multi-tenant** standalone service operations SaaS that orchestrates bookings, payments, staff availability, and fulfillment for service-based businesses.

## Tech Stack
- **Frontend**: React, Tailwind CSS, Lucide icons
- **Backend**: FastAPI (Python), modular routers
- **Database**: MongoDB with Motor async driver
- **AI**: OpenAI GPT-5.2, Gemini Nano Banana via Emergent LLM Key

## Recent Updates (Feb 5, 2026)

### Light Mode UI Complete Fix ✅
- Fixed broken CSS classes with duplicate dark: prefixes (e.g., `dark:bg-white dark:bg-[#171C22]`)
- Fixed hover states: Changed `dark:hover:bg-[#ECEFF3] dark:bg-[#1F2630]` to proper `dark:hover:bg-[#1F2630]`
- AdminSlotBooking.js modal - all inputs, labels, borders now properly themed
- AdminOutlets.js - table headers, rows, hover states fixed for light mode
- All Admin Console pages now display correctly in both light and dark modes

### Invoice Now Includes Inventory Items ✅
- InvoiceModal in Bookings.js updated to include `booking.items` array
- Invoice shows: Service row + Product rows with quantity, price, subtotal
- Totals calculation: Service + Products subtotal + GST (18%) = Total
- Products section only displayed if items exist

### Previous Updates (Feb 4-5, 2026)
- **Breaks Configuration**: Block unavailable times from public booking page
- **Dashboard Cleanup**: Removed Service Breakdown widget, reorganized layout
- **White Label Expansion**: 9 new customization options for Plus Plan
- **AI Agent Full-Page**: Animated blob background with state-based animations

## Multi-Tenancy Architecture ✅ NEW (Jan 30, 2026)

### User Hierarchy
```
Super Admin (Platform Owner - Ri'Serve Team)
    └── Company (Tenant)
            └── Admin (Company Owner)
                    ├── Manager (Outlet-level)
                    └── User (Staff)
```

### Super Admin Features
- **Dashboard**: Total companies, users, bookings, plan distribution
- **Company Management**: Create, edit, suspend, activate, deactivate companies
- **Deactivation with Retention**: 60-day data retention, scheduled permanent deletion
- **Reactivation**: Cancel scheduled deletion within retention period
- **Impersonation**: Login as any company admin for support
- **Audit Logs**: Detailed activity tracking
- **Subscription Plans**: Trial, Free, Essential, Pro, Custom

### Subscription Plans
| Plan | Outlets | Bookings/Month | Features |
|------|---------|----------------|----------|
| Trial (30 days) | 3 | 100 | All features |
| Free | 1 | 50 | Basic booking, Slot Manager |
| Essential | 3 | 500 | + Reports, Feedback, AI |
| Pro | Unlimited | Unlimited | + API access, Priority support |
| Custom | Custom | Custom | Enterprise features |

### Public Signup Flow
- `/signup` or `/try` - Self-service trial registration
- Collects: Company name, business type, admin details
- Auto-creates company + admin user
- 30-day trial, auto-downgrades to Free after expiry

### Data Isolation
- All data (bookings, outlets, users, etc.) scoped by `company_id`
- Companies only see their own data

## Core Features

### 1. Customer Satisfaction Rating ✅ NEW
**Post-service feedback collection system**

**Customer-Facing Features:**
- Public feedback page at `/rate/{booking_id}`
- 1-5 star rating with reactive emojis:
  - 1 star: Frown (red)
  - 2 stars: Frown (orange)
  - 3 stars: Meh (yellow)
  - 4 stars: Smile (lime)
  - 5 stars: Heart (green)
- Optional comment field
- Thank you confirmation page

**Admin Features (Admin Console > Customer Feedback):**
- Enable/disable feedback collection
- Auto-send after booking completion
- Email & SMS notification options
- Customizable messages
- Shareable feedback link format

**Analytics:**
- Average rating, satisfaction score, distribution chart
- Recent feedback with comments
- Data displayed in Dashboard and Reports

### 2. Dashboard ✅ UPDATED
- Stats: Total Bookings, Total Revenue, Active Outlets, **Customer Rating**
- **Customer Satisfaction** banner when feedback exists
- Upcoming Bookings with Date & Time
- Recent Transactions
- Quick Actions

### 3. Bookings ✅ UPDATED
- Columns: ID, Customer, **Service** (replaced Vehicle), **Date & Time**, Status, Amount
- Upcoming bookings widget

### 4. Reports ✅ UPDATED
- **Customer Satisfaction** section with:
  - Average rating display
  - Satisfaction score (% of 4-5 star ratings)
  - Rating distribution with emoji indicators
  - Recent feedback comments
- Booking status breakdown
- Service performance
- Revenue overview

### 5. Slot Manager ✅ UPDATED
- **Drag-to-Reschedule**: Drag bookings to new time slots or different resources
- **1-Hour Time Intervals**: Calendar shows hourly markers (8am, 9am, etc.)
- **Dark Mode**: Fixed hover-highlight color for better visibility
- Outlet dropdown **only shows when multiple outlets exist**
- Day/Week/Month calendar views
- Multi-service support
- Drop indicator with time label during drag operations

### 5a. Theme & Hover Colors ✅ UPDATED
- All list/table row hovers use accent color (#5FA8D3) at 10-15% opacity
- Dark mode: `hover:bg-[#5FA8D3]/15` for clear visibility
- Light mode: `hover:bg-[#5FA8D3]/10` for subtle effect
- Applied consistently across: Bookings, Finance, Users, Dashboard, Notifications, Admin panels

### 6. Company Settings
- Business type, name, address
- Operating hours, working days
- Currency, timezone

### 7. Dynamic Outlet Configuration ✅ NEW
**Removed car wash specific fields (machines, bays, solar, recycle)**

**Business Type Templates:**
| Type | Resource Label | Default Capacity | Icon |
|------|---------------|------------------|------|
| Salon | Stylist | 1 | ✂️ |
| Restaurant | Table | 4 | 🍽️ |
| Gym | Station | 10 | 🏋️ |
| Car Wash | Bay | 1 | 🚗 |
| Clinic | Room | 1 | 🏥 |
| Spa | Room | 1 | 💆 |
| Fitness | Class | 20 | 🧘 |
| Coworking | Desk | 1 | 💻 |
| Photography | Studio | 1 | 📸 |
| Custom | Resource | 1 | 📦 |

**Features:**
- Custom resource labels (singular/plural)
- Individual resource naming (e.g., "Stylist 1", "Table A", "Bay 2")
- Per-resource capacity (how many can book same slot)
- Quick add buttons (+1, +2, +3, +5)
- Backward compatible with legacy `capacity` field

### 8. User Management with Roles
| Role | Access |
|------|--------|
| SuperAdmin | Platform-wide - manages all companies and subscriptions |
| Admin | Company-wide - full access within their company |
| Manager | Outlet-level access |
| User | Own bookings only |

## API Endpoints

### Super Admin APIs ✅ UPDATED
- `GET /api/super-admin/dashboard` - Platform overview stats
- `GET /api/super-admin/companies` - List all companies
- `GET /api/super-admin/companies/{id}` - Company details
- `POST /api/super-admin/companies` - Create company
- `PUT /api/super-admin/companies/{id}` - Update company
- `PUT /api/super-admin/companies/{id}/plan` - Change subscription
- `POST /api/super-admin/companies/{id}/suspend` - Suspend company
- `POST /api/super-admin/companies/{id}/activate` - Activate company
- `POST /api/super-admin/companies/{id}/deactivate` - Deactivate with 60-day retention ✅ NEW
- `POST /api/super-admin/companies/{id}/reactivate` - Cancel scheduled deletion ✅ NEW
- `POST /api/super-admin/impersonate/{id}` - Get admin token
- `GET /api/super-admin/audit-logs` - Activity logs
- `GET /api/super-admin/users` - All users across companies
- `GET /api/super-admin/plans` - Subscription plans

### Public APIs
- `POST /api/public/signup` - Trial registration (no auth)

### Feedback APIs
- `GET /api/feedback/config` - Get feedback settings
- `PUT /api/feedback/config` - Update settings
- `POST /api/feedback/submit/{booking_id}` - Submit feedback (public)
- `GET /api/feedback/booking/{booking_id}` - Check feedback status
- `GET /api/feedback` - Get all feedback
- `GET /api/feedback/stats` - Get statistics

## Recent Changes

### January 30, 2026 - Multi-Tenancy Architecture Complete ✅
**New Features:**
- Super Admin role for platform management
- Company/tenant management system
- Subscription plans (Trial, Free, Essential, Pro, Custom)
- Public signup flow with 30-day trial
- Audit logging for all actions
- Impersonation feature for support
- Plan limits enforcement (outlets, bookings/month)
- Auto-downgrade expired trials to Free plan (background task)

**New Pages:**
- `/signup` or `/try` - Public trial registration with auto-login
- Super Admin Dashboard with company management
- Company Detail page with edit, suspend, activate, plan change
- Audit Logs page with filters (company, action, entity type)

**Plan Enforcement:**
- Outlet creation blocked when limit reached
- Booking creation blocked when monthly limit reached
- Clear error messages directing users to upgrade

**Background Tasks:**
- Trial expiry check runs on startup and every hour
- Auto-downgrades expired trials with audit logging

**Credentials:**
- Super Admin: `superadmin@riserve.com` / `superadmin123`
- Demo Admin: `admin@ridn.com` / `admin123`

### January 30, 2026 - Slot Manager Enhancements
**New:**
- Drag-to-reschedule functionality for bookings
- Bookings can be moved to different time slots and resources
- Drop indicator with time label during drag

**Updated:**
- Time intervals changed from 30-min to 1-hour blocks
- Fixed dark mode hover-highlight color
- Backend reschedule API now accepts resource_id parameter

### January 30, 2026 - Customer Feedback Feature
**New:**
- Customer satisfaction rating system (1-5 stars with emojis)
- Feedback configuration in Admin Console
- Feedback statistics in Dashboard and Reports

**Updated:**
- Bookings: Service column instead of Vehicle, Date & Time display
- Slot Manager: Hide outlet dropdown when single outlet
- Reports: Complete redesign with satisfaction metrics
- Dashboard: Customer Rating stat card and satisfaction banner

## Test Credentials
- **Email**: admin@ridn.com (after seed)
- **Password**: admin123

## Backlog
1. ~~P1: Drag-to-Reschedule~~ ✅ COMPLETED
2. ~~P1: Inventory Management~~ ✅ COMPLETED (Feb 4, 2026)
3. ~~P1: Add Items to Booking UI~~ ✅ COMPLETED (Feb 4, 2026)
4. ~~P1: Staff Management Module~~ ✅ COMPLETED (Feb 4, 2026)
5. P1: QR Code generation for public booking link
6. P2: Email/SMS notification integration (actual sending)
7. P3: Payment gateway integration (Stripe)

### February 4, 2026 - Attendance Tracking ✅ NEW
**Added to Staff Management Module:**

**Backend Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/staff/attendance/clock-in` | POST | Clock in a staff member |
| `/api/staff/attendance/clock-out` | POST | Clock out a staff member |
| `/api/staff/attendance` | GET | Get attendance records with filters |
| `/api/staff/attendance/today` | GET | Get today's real-time attendance status |
| `/api/staff/attendance/staff/{id}` | GET | Get staff attendance history by month |
| `/api/staff/attendance/{id}/correct` | PUT | Correct attendance (admin) |
| `/api/staff/attendance/report` | GET | Generate attendance report |

**Features:**
- **Real-time Clock In/Out**: One-click clock in/out for each staff member
- **Today's Attendance Dashboard**: Live summary (Present, Absent, On Leave, Late)
- **Late Detection**: Auto-detects late arrivals based on scheduled shift
- **Early Departure Tracking**: Tracks if staff leaves before shift end
- **Overtime Calculation**: Auto-calculates hours beyond scheduled shift
- **Staff Attendance History**: Monthly view with stats (Days worked, Hours, Late, Early, OT)
- **Attendance Reports**: Generate reports for any date range with staff-wise breakdown

## Recent Changes

### February 2, 2026 - Full-Page AI Agent ✅ NEW
**Implemented:**
- New full-page AI Agent at `/ai-agent` route (integrated within main layout with sidebar)
- **Chat History Sidebar:**
  - "New Chat" button to start fresh conversation
  - Search functionality to filter conversations
  - Conversation list grouped by date (Today, Yesterday, This Week, Older)
  - Click to load previous conversations
  - Delete button on hover
  - Collapsible sidebar toggle
- Personalized greeting with user's first name ("Hey! [Name]")
- Quick action cards with contextual prompts:
  - Analytics Help (teal) - Booking trends analysis
  - Suggestions (rose) - Business improvement ideas
  - Schedule Help (emerald) - Schedule optimization
  - Customer Insights (amber) - Customer analysis
- Animated background with state-based effects:
  - Idle: Subtle floating glow
  - Thinking: Pulsing animation with particles
  - Answering: Green-tinted glow
- Chat interface with message bubbles and typing indicator
- Input area with "Attach file" button and send button
- Navigation via sidebar "AI Agent" button
- Dark/light theme support

### February 4, 2026 - Inventory Management ✅ NEW
**Backend Implementation:**
- Complete Inventory API (`/api/inventory/*`)
- Product CRUD operations
- Stock adjustment tracking with reason codes
- Low stock alerts and notifications
- Inventory settings (centralized vs outlet-specific mode)
- Integration with bookings (add products to bookings)

**Frontend Implementation:**
- AdminInventory component in Admin Console
- Standalone `/inventory` page for direct access
- Stats dashboard: Total Products, Inventory Value, Low Stock, Out of Stock
- Product table with search and category filters
- Add/Edit Product modals
- Stock adjustment modal with reason tracking
- Settings modal for inventory configuration

**Configurable Feature System:**
- `enabled_features` array on company model
- Super Admin can toggle features per company
- Features: inventory, ai_assistant, advanced_reports, multi_location, api_access
- Sidebar and Admin Console show features based on company settings
- Company features API endpoint: `GET /api/company/features`

**Files Added/Modified:**
- `/app/backend/routes/inventory.py` - Complete inventory API
- `/app/frontend/src/components/admin/AdminInventory.js` - Inventory management UI
- `/app/frontend/src/pages/Inventory.js` - Standalone inventory page
- `/app/frontend/src/pages/AdminConsole.js` - Conditionally shows Inventory tab
- `/app/frontend/src/components/Sidebar.js` - Conditionally shows Inventory link with low stock badge
- `/app/frontend/src/pages/SuperAdminCompanies.js` - Feature toggles in edit modal
- `/app/backend/routes/company.py` - Company features endpoint
- `/app/backend/routes/superadmin.py` - Updated CompanyUpdate model
- `/app/frontend/src/components/BookingItemsModal.js` - Modal to add products to bookings
- `/app/frontend/src/pages/Bookings.js` - Added "Add Products" button for each booking

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/inventory/products` | GET | Get all products with filters |
| `/api/inventory/products/{id}` | GET | Get single product |
| `/api/inventory/products` | POST | Create new product |
| `/api/inventory/products/{id}` | PUT | Update product |
| `/api/inventory/products/{id}` | DELETE | Soft delete product |
| `/api/inventory/stock/adjust` | POST | Adjust stock |
| `/api/inventory/alerts` | GET | Get low stock alerts |
| `/api/inventory/settings` | GET/PUT | Inventory configuration |
| `/api/company/features` | GET | Get company enabled features |

### February 4, 2026 - Staff Management Module ✅ NEW
**Backend Implementation (`/app/backend/routes/staff.py`):**
- Complete Staff CRUD with personal info, emergency contact, employment details
- Leave Policy management (annual, sick, casual, custom types)
- Leave Request workflow with approval/rejection
- Shift Template creation (Morning, Evening, Night, custom)
- Staff Scheduling with weekly calendar view
- Holiday Calendar (public, company, optional types)
- Staff statistics endpoint

**Frontend Implementation (`/app/frontend/src/components/admin/AdminStaff.js`):**
- **Stats Dashboard**: Total Staff, On Duty Today, Pending Leaves, On Leave Today, Upcoming Holidays
- **Staff Directory**: Search, add/edit staff with comprehensive form (personal info, address, emergency contact, employment)
- **Leave Policies Tab**: Configure leave types with days/year, accrual, carry-forward, approval settings
- **Leave Requests Tab**: View/approve/reject leave requests with status filters
- **Shift Templates Tab**: Define shifts with timing, break duration, applicable days, color coding
- **Schedules Tab**: Weekly calendar view with drag-to-assign shifts
- **Holidays Tab**: Configure public/company/optional holidays with recurring option

**API Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/staff` | GET/POST | List/create staff |
| `/api/staff/{id}` | GET/PUT/DELETE | Staff CRUD |
| `/api/staff/stats/overview` | GET | Staff statistics |
| `/api/staff/leave/policies` | GET/POST | Leave policies |
| `/api/staff/leave/requests` | GET/POST | Leave requests |
| `/api/staff/shifts/templates` | GET/POST | Shift templates |
| `/api/staff/schedules` | GET/POST | Staff schedules |
| `/api/staff/holidays` | GET/POST | Holiday calendar |

**Files Added:**
- `/app/backend/routes/staff.py` - Complete staff management API
- `/app/frontend/src/components/admin/AdminStaff.js` - Staff management UI

### February 3, 2026 - Dashboard Redesign & Form Fixes ✅ NEW
**Dashboard Widgets Implemented:**
- **Top Stats Row** - 6 gradient stat cards with growth indicators:
  - Total Bookings, Total Revenue, Active Outlets, Avg Rating, Weekly Bookings, Customers
  - Weekly percentage growth/decline indicators
- **Booking Trend** - Area chart (7 days) with gradient fill
- **Service Breakdown** - Donut chart with legend showing service distribution
- **Payments Overview** - Multi-line chart (Held vs Settled vs Total)
- **Total Collected** - Summary card with progress bar
- **Customer Rating** - Card with star rating and satisfaction score
- **Revenue by Outlet** - Horizontal bar chart with tooltips
- **Revenue Trend** - Area chart with gradient
- **Quick Actions** - 4 action buttons
- **Recent Bookings** - List with status indicators

**Form Styling Fixes:**
- Fixed `bg-[#1F2630/50]` syntax error in all modals
- Changed to proper dark theme `bg-[#0B0D10]` background
- Fixed AddBookingModal, AddServiceModal, AddUserModal
- All input fields, selects, and textareas now have dark backgrounds

**Files Modified:**
- `/app/frontend/src/pages/Dashboard.js` - Complete redesign with charts
- `/app/frontend/src/components/AddBookingModal.js` - Fixed input styling
- `/app/frontend/src/components/AddServiceModal.js` - Fixed input styling
- Added `recharts` library for chart visualizations
**Implemented:**
- Floating chat panel that opens without leaving current page
- **Access methods:**
  - "Quick Chat" button in sidebar
  - Floating Action Button (FAB) in bottom-right corner
- **Features:**
  - Minimizable/expandable panel
  - Personalized greeting ("Hi [Name]! Need help?")
  - Suggested quick prompts: "Today's bookings", "Revenue summary", "Top services"
  - AI disclaimer: "AI can make mistakes. Please verify important info."
  - New chat, minimize, and close buttons
  - Full chat functionality with message history
- FAB hidden on AI Agent page (to avoid redundancy)
- Responsive positioning to avoid overlap with other UI elements

**Files Added/Modified:**
- `/app/frontend/src/pages/AIAgent.js` - Full-page component with chat history
- `/app/frontend/src/components/FloatingAIChat.js` - New floating chat component
- `/app/frontend/src/contexts/AssistantContext.js` - Added floating chat state management
- `/app/frontend/src/index.css` - Background animations (float, pulse, particle)
- `/app/frontend/src/App.js` - Added routes, FAB, and floating chat panel
- `/app/frontend/src/components/Sidebar.js` - Added "Quick Chat" button

