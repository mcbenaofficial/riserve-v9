import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getHeaders = () => {
  const token = localStorage.getItem('ridn_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const api = {
  // Outlets
  getOutlets: () => axios.get(`${API}/outlets`, { headers: getHeaders() }),
  createOutlet: (data) => axios.post(`${API}/outlets`, data, { headers: getHeaders() }),
  updateOutlet: (id, data) => axios.put(`${API}/outlets/${id}`, data, { headers: getHeaders() }),
  deleteOutlet: (id) => axios.delete(`${API}/outlets/${id}`, { headers: getHeaders() }),

  // Services
  getServices: () => axios.get(`${API}/services`, { headers: getHeaders() }),
  createService: (data) => axios.post(`${API}/services`, data, { headers: getHeaders() }),
  updateService: (id, data) => axios.put(`${API}/services/${id}`, data, { headers: getHeaders() }),
  deleteService: (id) => axios.delete(`${API}/services/${id}`, { headers: getHeaders() }),

  // Bookings
  getBookings: () => axios.get(`${API}/bookings`, { headers: getHeaders() }),
  createBooking: (data) => axios.post(`${API}/bookings`, data, { headers: getHeaders() }),
  updateBooking: (id, status) => axios.put(`${API}/bookings/${id}?status=${status}`, {}, { headers: getHeaders() }),
  rescheduleBooking: (id, time, date, resource_id) => axios.put(`${API}/bookings/${id}/reschedule`, { time, date, resource_id }, { headers: getHeaders() }),

  // Transactions
  getTransactions: () => axios.get(`${API}/transactions`, { headers: getHeaders() }),
  getTransactionByBooking: (bookingId) => axios.get(`${API}/transactions/booking/${bookingId}`, { headers: getHeaders() }),
  processPOSCheckout: (data) => axios.post(`${API}/transactions/pos`, data, { headers: getHeaders() }),

  // Users
  getUsers: () => axios.get(`${API}/users`, { headers: getHeaders() }),
  createUser: (data) => axios.post(`${API}/users`, data, { headers: getHeaders() }),
  updateUser: (id, data) => axios.put(`${API}/users/${id}`, data, { headers: getHeaders() }),

  // Customers
  getCustomers: (params) => axios.get(`${API}/customers`, { params, headers: getHeaders() }),
  createCustomer: (data) => axios.post(`${API}/customers`, data, { headers: getHeaders() }),
  getCustomer: (id) => axios.get(`${API}/customers/${id}`, { headers: getHeaders() }),
  updateCustomer: (id, data) => axios.put(`${API}/customers/${id}`, data, { headers: getHeaders() }),
  getCustomerBookings: (id) => axios.get(`${API}/customers/${id}/bookings`, { headers: getHeaders() }),

  // Profile Settings
  updateProfile: (data) => axios.put(`${API}/auth/profile`, data, { headers: getHeaders() }),
  changePassword: (data) => axios.post(`${API}/auth/change-password`, data, { headers: getHeaders() }),

  // Reports
  getReports: () => axios.get(`${API}/reports`, { headers: getHeaders() }),

  // Company Settings
  getCompanySettings: () => axios.get(`${API}/company`, { headers: getHeaders() }),
  updateCompanySettings: (data) => axios.put(`${API}/company`, data, { headers: getHeaders() }),
  getBusinessTypes: () => axios.get(`${API}/company/business-types`, { headers: getHeaders() }),
  getBookingFieldsConfig: () => axios.get(`${API}/company/booking-fields`, { headers: getHeaders() }),
  updateBookingFieldsConfig: (data) => axios.put(`${API}/company/booking-fields`, data, { headers: getHeaders() }),
  getCompanyFeatures: () => axios.get(`${API}/company/features`, { headers: getHeaders() }),

  // Slot Configuration
  getSlotConfigs: () => axios.get(`${API}/slot-configs`, { headers: getHeaders() }),
  getSlotConfigByOutlet: (outletId) => axios.get(`${API}/slot-configs/${outletId}`, { headers: getHeaders() }),
  createSlotConfig: (data) => axios.post(`${API}/slot-configs`, data, { headers: getHeaders() }),
  updateSlotConfig: (id, data) => axios.put(`${API}/slot-configs/${id}`, data, { headers: getHeaders() }),
  deleteSlotConfig: (id) => axios.delete(`${API}/slot-configs/${id}`, { headers: getHeaders() }),

  // Resource Bookings
  getResourceBookings: (outletId, date, startDate, endDate) => {
    let url = `${API}/bookings/resource-bookings/${outletId}`;
    const params = [];
    if (date) params.push(`date=${date}`);
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return axios.get(url, { headers: getHeaders() });
  },

  // Public Booking (no auth)
  getPublicBookingInfo: (token) => axios.get(`${API}/public/slot-config/${token}`),
  createPublicBooking: (token, data) => axios.post(`${API}/public/book`, { ...data, outlet_id: data.outlet_id }),

  // Public Signup (no auth)
  signup: (data) => axios.post(`${API}/public/signup`, data),

  // Dashboard Configuration
  getDashboardConfigs: () => axios.get(`${API}/dashboard-configs`, { headers: getHeaders() }),
  createDashboardConfig: (data) => axios.post(`${API}/dashboard-configs`, data, { headers: getHeaders() }),
  updateDashboardConfig: (id, data) => axios.put(`${API}/dashboard-configs/${id}`, data, { headers: getHeaders() }),
  deleteDashboardConfig: (id) => axios.delete(`${API}/dashboard-configs/${id}`, { headers: getHeaders() }),

  // AI Assistant
  getConversations: () => axios.get(`${API}/assistant/conversations`, { headers: getHeaders() }),
  getConversation: (id) => axios.get(`${API}/assistant/conversations/${id}`, { headers: getHeaders() }),
  deleteConversation: (id) => axios.delete(`${API}/assistant/conversations/${id}`, { headers: getHeaders() }),
  sendChatMessage: (message, conversationId) => axios.post(`${API}/assistant/chat`, { message, conversation_id: conversationId }, { headers: getHeaders() }),
  generateImage: (prompt, conversationId) => axios.post(`${API}/assistant/generate-image`, { prompt, conversation_id: conversationId }, { headers: getHeaders() }),

  // Customer Feedback
  getFeedbackConfig: () => axios.get(`${API}/feedback/config`, { headers: getHeaders() }),
  updateFeedbackConfig: (data) => axios.put(`${API}/feedback/config`, data, { headers: getHeaders() }),
  getAllFeedback: () => axios.get(`${API}/feedback`, { headers: getHeaders() }),
  getFeedbackStats: () => axios.get(`${API}/feedback/stats`, { headers: getHeaders() }),
  getFeedbackForBooking: (bookingId) => axios.get(`${API}/feedback/booking/${bookingId}`),
  submitFeedback: (bookingId, data) => axios.post(`${API}/feedback/submit/${bookingId}`, data),
  getFeedbackLink: (bookingId) => axios.get(`${API}/feedback/link/${bookingId}`, { headers: getHeaders() }),

  // Super Admin APIs
  getSuperAdminDashboard: () => axios.get(`${API}/super-admin/dashboard`, { headers: getHeaders() }),
  getCompanies: (params) => axios.get(`${API}/super-admin/companies`, { headers: getHeaders(), params }),
  getCompany: (id) => axios.get(`${API}/super-admin/companies/${id}`, { headers: getHeaders() }),
  createCompany: (data) => axios.post(`${API}/super-admin/companies`, data, { headers: getHeaders() }),
  updateCompany: (id, data) => axios.put(`${API}/super-admin/companies/${id}`, data, { headers: getHeaders() }),
  updateCompanyFeatures: (id, features) => axios.put(`${API}/super-admin/companies/${id}`, { enabled_features: features }, { headers: getHeaders() }),
  changeCompanyPlan: (id, plan, customLimits) => axios.put(`${API}/super-admin/companies/${id}/plan`, { plan, custom_limits: customLimits }, { headers: getHeaders() }),
  suspendCompany: (id) => axios.post(`${API}/super-admin/companies/${id}/suspend`, {}, { headers: getHeaders() }),
  activateCompany: (id) => axios.post(`${API}/super-admin/companies/${id}/activate`, {}, { headers: getHeaders() }),
  deactivateCompany: (id, reason) => axios.post(`${API}/super-admin/companies/${id}/deactivate`, { reason }, { headers: getHeaders() }),
  reactivateCompany: (id) => axios.post(`${API}/super-admin/companies/${id}/reactivate`, {}, { headers: getHeaders() }),
  impersonateCompany: (id) => axios.post(`${API}/super-admin/impersonate/${id}`, {}, { headers: getHeaders() }),
  getAuditLogs: (params) => axios.get(`${API}/super-admin/audit-logs`, { headers: getHeaders(), params }),
  getAllUsers: (params) => axios.get(`${API}/super-admin/users`, { headers: getHeaders(), params }),
  getSubscriptionPlans: () => axios.get(`${API}/super-admin/plans`, { headers: getHeaders() }),

  // Promotions
  getPromotions: () => axios.get(`${API}/promotions`, { headers: getHeaders() }),
  createPromotion: (data) => axios.post(`${API}/promotions`, data, { headers: getHeaders() }),
  updatePromotion: (id, data) => axios.put(`${API}/promotions/${id}`, data, { headers: getHeaders() }),
  generateCoupons: (id, data) => axios.post(`${API}/promotions/${id}/coupons`, data, { headers: getHeaders() }),

  // Inventory Management
  getProducts: (params) => axios.get(`${API}/inventory/products`, { headers: getHeaders(), params }),
  getProduct: (id) => axios.get(`${API}/inventory/products/${id}`, { headers: getHeaders() }),
  createProduct: (data) => axios.post(`${API}/inventory/products`, data, { headers: getHeaders() }),
  updateProduct: (id, data) => axios.put(`${API}/inventory/products/${id}`, data, { headers: getHeaders() }),
  deleteProduct: (id) => axios.delete(`${API}/inventory/products/${id}`, { headers: getHeaders() }),
  adjustStock: (data) => axios.post(`${API}/inventory/stock/adjust`, data, { headers: getHeaders() }),
  getLowStockProducts: (outletId) => axios.get(`${API}/inventory/low-stock${outletId ? `?outlet_id=${outletId}` : ''}`, { headers: getHeaders() }),
  getInventoryAlerts: () => axios.get(`${API}/inventory/alerts`, { headers: getHeaders() }),
  resolveInventoryAlert: (id) => axios.put(`${API}/inventory/alerts/${id}/resolve`, {}, { headers: getHeaders() }),
  getInventorySettings: () => axios.get(`${API}/inventory/settings`, { headers: getHeaders() }),
  updateInventorySettings: (data) => axios.put(`${API}/inventory/settings`, data, { headers: getHeaders() }),
  getInventoryHistory: (productId) => axios.get(`${API}/inventory/history${productId ? `?product_id=${productId}` : ''}`, { headers: getHeaders() }),
  getProductCategories: () => axios.get(`${API}/inventory/categories`, { headers: getHeaders() }),
  getInventoryStats: () => axios.get(`${API}/inventory/stats`, { headers: getHeaders() }),

  // Staff Management
  getStaffList: (params) => axios.get(`${API}/staff`, { params, headers: getHeaders() }),
  getStaffMember: (id) => axios.get(`${API}/staff/${id}`, { headers: getHeaders() }),
  createStaff: (data) => axios.post(`${API}/staff`, data, { headers: getHeaders() }),
  updateStaff: (id, data) => axios.put(`${API}/staff/${id}`, data, { headers: getHeaders() }),
  deleteStaff: (id) => axios.delete(`${API}/staff/${id}`, { headers: getHeaders() }),
  getStaffStats: () => axios.get(`${API}/staff/stats/overview`, { headers: getHeaders() }),

  // Leave Management
  getLeavePolicies: () => axios.get(`${API}/staff/leave/policies`, { headers: getHeaders() }),
  createLeavePolicy: (data) => axios.post(`${API}/staff/leave/policies`, data, { headers: getHeaders() }),
  updateLeavePolicy: (id, data) => axios.put(`${API}/staff/leave/policies/${id}`, data, { headers: getHeaders() }),
  deleteLeavePolicy: (id) => axios.delete(`${API}/staff/leave/policies/${id}`, { headers: getHeaders() }),
  getLeaveRequests: (params) => axios.get(`${API}/staff/leave/requests`, { params, headers: getHeaders() }),
  createLeaveRequest: (staffId, data) => axios.post(`${API}/staff/leave/requests?staff_id=${staffId}`, data, { headers: getHeaders() }),
  updateLeaveRequest: (id, data) => axios.put(`${API}/staff/leave/requests/${id}`, data, { headers: getHeaders() }),
  getLeaveBalances: (staffId) => axios.get(`${API}/staff/leave/balances/${staffId}`, { headers: getHeaders() }),

  // Shift Management
  getShiftTemplates: () => axios.get(`${API}/staff/shifts/templates`, { headers: getHeaders() }),
  createShiftTemplate: (data) => axios.post(`${API}/staff/shifts/templates`, data, { headers: getHeaders() }),
  updateShiftTemplate: (id, data) => axios.put(`${API}/staff/shifts/templates/${id}`, data, { headers: getHeaders() }),
  deleteShiftTemplate: (id) => axios.delete(`${API}/staff/shifts/templates/${id}`, { headers: getHeaders() }),
  getStaffSchedules: (params) => axios.get(`${API}/staff/schedules`, { params, headers: getHeaders() }),
  createStaffSchedule: (data) => axios.post(`${API}/staff/schedules`, data, { headers: getHeaders() }),
  createBulkSchedules: (data) => axios.post(`${API}/staff/schedules/bulk`, data, { headers: getHeaders() }),
  deleteStaffSchedule: (id) => axios.delete(`${API}/staff/schedules/${id}`, { headers: getHeaders() }),

  // Holiday Management
  getHolidays: (params) => axios.get(`${API}/staff/holidays`, { params, headers: getHeaders() }),
  createHoliday: (data) => axios.post(`${API}/staff/holidays`, data, { headers: getHeaders() }),
  updateHoliday: (id, data) => axios.put(`${API}/staff/holidays/${id}`, data, { headers: getHeaders() }),
  deleteHoliday: (id) => axios.delete(`${API}/staff/holidays/${id}`, { headers: getHeaders() }),

  // Attendance Management
  clockIn: (data) => axios.post(`${API}/staff/attendance/clock-in`, data, { headers: getHeaders() }),
  clockOut: (data) => axios.post(`${API}/staff/attendance/clock-out`, data, { headers: getHeaders() }),
  getAttendanceRecords: (params) => axios.get(`${API}/staff/attendance`, { params, headers: getHeaders() }),
  getTodayAttendance: () => axios.get(`${API}/staff/attendance/today`, { headers: getHeaders() }),
  getStaffAttendanceHistory: (staffId, params) => axios.get(`${API}/staff/attendance/staff/${staffId}`, { params, headers: getHeaders() }),
  correctAttendance: (id, data) => axios.put(`${API}/staff/attendance/${id}/correct`, data, { headers: getHeaders() }),
  getAttendanceReport: (params) => axios.get(`${API}/staff/attendance/report`, { params, headers: getHeaders() }),

  // Booking Items (Add products to bookings)
  getBooking: (id) => axios.get(`${API}/bookings/${id}`, { headers: getHeaders() }),
  addItemsToBooking: (bookingId, data) => axios.post(`${API}/bookings/${bookingId}/items`, data, { headers: getHeaders() }),
  removeItemFromBooking: (bookingId, productId) => axios.delete(`${API}/bookings/${bookingId}/items/${productId}`, { headers: getHeaders() }),

  // System
  seedData: () => axios.post(`${API}/seed`, {}, { headers: getHeaders() }),
  resetData: () => axios.post(`${API}/reset-data`, {}, { headers: getHeaders() }),
  freshStart: () => axios.post(`${API}/fresh-start`, {}, { headers: getHeaders() }),

  // User Roles
  getUserRoles: () => Promise.resolve({
    data: {
      roles: [
        { id: 'SuperAdmin', name: 'Super Admin', description: 'Platform owner - manages all companies, users, subscriptions, and system settings' },
        { id: 'Admin', name: 'Admin', description: 'Company admin - can manage all settings, users, outlets, and data within their company' },
        { id: 'Manager', name: 'Manager', description: 'Outlet level access - can manage bookings and operations for assigned outlets' },
        { id: 'User', name: 'User', description: 'Limited access - can only view and manage bookings/orders assigned to them' }
      ]
    }
  }),

  // Onboarding
  getOnboardingProgress: () => axios.get(`${API}/onboarding/progress`, { headers: getHeaders() }),
  skipOnboarding: () => axios.post(`${API}/onboarding/skip`, {}, { headers: getHeaders() }),
  onboardingChat: (message, conversationId, stream = true) => axios.post(`${API}/onboarding/chat`, { message, conversation_id: conversationId, stream }, { headers: getHeaders() }),

  // Human-in-the-Loop (HITL)
  generateHITLReport: (data) => axios.post(`${API}/hitl/generate-report`, data, { headers: getHeaders() }),
  getPendingHITLReports: () => axios.get(`${API}/hitl/pending`, { headers: getHeaders() }),
  getHITLHistory: () => axios.get(`${API}/hitl/history`, { headers: getHeaders() }),
  confirmHITLReport: (data) => axios.post(`${API}/hitl/confirm`, data, { headers: getHeaders() }),
  getHITLPreferences: () => axios.get(`${API}/hitl/preferences`, { headers: getHeaders() }),
  analyzeSchedule: (data) => axios.post(`${API}/hitl/analyze-schedule`, data || {}, { headers: getHeaders() }),
  analyzeInventory: () => axios.post(`${API}/hitl/analyze-inventory`, {}, { headers: getHeaders() }),
};
