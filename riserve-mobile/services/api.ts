import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = "http://localhost:8000/api";

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const login = (email: string, password: string) =>
  api.post("/auth/login", { email, password });

// Mobile profile & attendance
export const myProfile = () => api.get("/mobile/me/profile");
export const myAttendanceToday = () => api.get("/mobile/me/attendance-today");
export const clockIn = (outlet_id?: string) =>
  api.post("/staff/attendance/clock-in", { outlet_id });
export const clockOut = (attendance_id: string) =>
  api.post("/staff/attendance/clock-out", { attendance_id });

// Tasks
export const getTasks = (params?: { outlet_id?: string; status?: string }) =>
  api.get("/mobile/tasks", { params });
export const createTask = (body: object) => api.post("/mobile/tasks", body);
export const updateTask = (id: string, body: object) =>
  api.put(`/mobile/tasks/${id}`, body);

// Messages
export const getMessages = (channel: string, outlet_id?: string) =>
  api.get("/mobile/messages", { params: { channel, outlet_id } });
export const sendMessage = (body: object) => api.post("/mobile/messages", body);

// Incidents
export const getIncidents = (params?: object) =>
  api.get("/mobile/incidents", { params });
export const reportIncident = (body: object) =>
  api.post("/mobile/incidents", body);

// Shift notes
export const getShiftNotes = (params?: object) =>
  api.get("/mobile/shift-notes", { params });
export const createShiftNote = (body: object) =>
  api.post("/mobile/shift-notes", body);

// Orders (restaurant)
export const getActiveOrders = () => api.get("/orders/active");
export const getKitchenFeed = () => api.get("/orders/kitchen");
export const updateOrderStatus = (id: string, status: string) =>
  api.put(`/orders/${id}/status`, { status });

// Inventory alerts
export const getInventoryAlerts = () =>
  api.get("/inventory/alerts");

// Leave
export const getLeaveRequests = () => api.get("/staff/leave/requests");
export const requestLeave = (body: object) =>
  api.post("/staff/leave/requests", body);

// Payslips
export const getPayslips = (staff_id: string) =>
  api.get(`/staff/${staff_id}/payslips`);

// Bookings (salon appointments)
export const getBookings = (params?: object) =>
  api.get("/bookings", { params });

// Salon module
export const getSalonAppointments = () => api.get("/mobile/salon/appointments");
export const getSalonRooms = () => api.get("/mobile/salon/rooms");
export const getSalonClients = () => api.get("/mobile/salon/clients");
export const getSalonUpsell = () => api.get("/mobile/salon/upsell");

// Me: notifications, payslips, leaves
export const getNotifications = () => api.get("/mobile/me/notifications");
export const getMyPayslips = () => api.get("/mobile/me/payslips");
export const getMyLeaves = () => api.get("/mobile/me/leaves");
export const getMySchedule = () => api.get("/mobile/me/schedule");
export const getMyBreaks = () => api.get("/mobile/me/breaks");
export const startBreak = (break_type: string) => api.post("/mobile/me/breaks/start", { break_type });
export const endBreak = (breakId: string) => api.post(`/mobile/me/breaks/${breakId}/end`);
export const getMyTips = () => api.get("/mobile/me/tips");
export const getMyTraining = () => api.get("/mobile/me/training");
export const completeTrainingModule = (moduleId: string) => api.post(`/mobile/me/training/${moduleId}/complete`);
export const uncompleteTrainingModule = (moduleId: string) => api.delete(`/mobile/me/training/${moduleId}/complete`);

export default api;
