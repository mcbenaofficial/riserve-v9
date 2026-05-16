import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getHeaders = () => {
  const token = localStorage.getItem('ridn_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const marketplaceApi = {
  // Catalog
  getCategories: () =>
    axios.get(`${API}/marketplace/categories`, { headers: getHeaders() }),
  getAgents: (params = {}) =>
    axios.get(`${API}/marketplace/agents`, { params, headers: getHeaders() }),
  getAgent: (slug) =>
    axios.get(`${API}/marketplace/agents/${slug}`, { headers: getHeaders() }),

  // My Team
  getTier: () =>
    axios.get(`${API}/marketplace/tier`, { headers: getHeaders() }),
  getTeam: () =>
    axios.get(`${API}/marketplace/team`, { headers: getHeaders() }),
  subscribeAgent: (agentId) =>
    axios.post(`${API}/marketplace/team/subscribe`, { agent_id: agentId }, { headers: getHeaders() }),
  pauseAgent: (agentId) =>
    axios.post(`${API}/marketplace/team/${agentId}/pause`, {}, { headers: getHeaders() }),
  cancelAgent: (agentId) =>
    axios.post(`${API}/marketplace/team/${agentId}/cancel`, {}, { headers: getHeaders() }),

  // Onboarding
  getOnboardingOptions: () =>
    axios.get(`${API}/marketplace/onboarding/options`, { headers: getHeaders() }),
  selectOnboardingAgents: (agentIds) =>
    axios.post(`${API}/marketplace/onboarding/select`, { agent_ids: agentIds }, { headers: getHeaders() }),

  // Tier upgrade — two-step for paid tiers: createTierOrder first, then upgradeTier with payment proof
  createTierOrder: (tierKey) =>
    axios.post(`${API}/marketplace/tier/order`, { tier_key: tierKey }, { headers: getHeaders() }),
  upgradeTier: (tierKey, paymentData = {}) =>
    axios.post(`${API}/marketplace/tier/upgrade`, { tier_key: tierKey, ...paymentData }, { headers: getHeaders() }),

  // Execution
  runAgent: (slug, input = {}) =>
    axios.post(`${API}/marketplace/agents/${slug}/run`, { input }, { headers: getHeaders() }),
  getRun: (runId) =>
    axios.get(`${API}/marketplace/runs/${runId}`, { headers: getHeaders() }),

  // Metrics
  getTeamMetrics: () =>
    axios.get(`${API}/marketplace/metrics`, { headers: getHeaders() }),
  getAgentMetrics: (agentId) =>
    axios.get(`${API}/marketplace/metrics/${agentId}`, { headers: getHeaders() }),

  // Corp: custom agents
  createCustomAgent: (data) =>
    axios.post(`${API}/marketplace/custom-agents`, data, { headers: getHeaders() }),
  deleteCustomAgent: (agentId) =>
    axios.delete(`${API}/marketplace/custom-agents/${agentId}`, { headers: getHeaders() }),
};

export const flowsApi = {
  list: () =>
    axios.get(`${API}/flows`, { headers: getHeaders() }),
  create: (data) =>
    axios.post(`${API}/flows`, data, { headers: getHeaders() }),
  get: (id) =>
    axios.get(`${API}/flows/${id}`, { headers: getHeaders() }),
  update: (id, data) =>
    axios.put(`${API}/flows/${id}`, data, { headers: getHeaders() }),
  delete: (id) =>
    axios.delete(`${API}/flows/${id}`, { headers: getHeaders() }),
  publishAsAgent: (id, data) =>
    axios.post(`${API}/flows/${id}/publish-as-agent`, data, { headers: getHeaders() }),
};
