import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getHeaders = () => {
  const token = localStorage.getItem('ridn_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const membershipsApi = {
  // Plans
  getPlans: () =>
    axios.get(`${API}/memberships/plans`, { headers: getHeaders() }),
  createPlan: (data) =>
    axios.post(`${API}/memberships/plans`, data, { headers: getHeaders() }),
  updatePlan: (id, data) =>
    axios.put(`${API}/memberships/plans/${id}`, data, { headers: getHeaders() }),
  deletePlan: (id) =>
    axios.delete(`${API}/memberships/plans/${id}`, { headers: getHeaders() }),

  // Members
  getMembers: (params) =>
    axios.get(`${API}/memberships/members`, { params, headers: getHeaders() }),
  enrollMember: (data) =>
    axios.post(`${API}/memberships/members`, data, { headers: getHeaders() }),
  getMember: (id) =>
    axios.get(`${API}/memberships/members/${id}`, { headers: getHeaders() }),
  updateMember: (id, data) =>
    axios.put(`${API}/memberships/members/${id}`, data, { headers: getHeaders() }),
  renewMember: (id, data) =>
    axios.post(`${API}/memberships/members/${id}/renew`, data, { headers: getHeaders() }),
  cancelMember: (id, data) =>
    axios.post(`${API}/memberships/members/${id}/cancel`, data, { headers: getHeaders() }),
  pauseMember: (id) =>
    axios.post(`${API}/memberships/members/${id}/pause`, {}, { headers: getHeaders() }),
  resumeMember: (id) =>
    axios.post(`${API}/memberships/members/${id}/resume`, {}, { headers: getHeaders() }),
  issueCredits: (id, data) =>
    axios.post(`${API}/memberships/members/${id}/credits`, data, { headers: getHeaders() }),

  // Stats & Transactions
  getStats: () =>
    axios.get(`${API}/memberships/stats`, { headers: getHeaders() }),
  getTransactions: (params) =>
    axios.get(`${API}/memberships/transactions`, { params, headers: getHeaders() }),

  // Customers (for enrollment picker)
  searchCustomers: (search) =>
    axios.get(`${API}/customers`, { params: { search }, headers: getHeaders() }),
};

export default membershipsApi;
