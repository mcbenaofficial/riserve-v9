const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const BASE = `${BACKEND_URL}/api`;

function headers() {
  const token = localStorage.getItem('ridn_token');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: headers(),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  return res.json();
}

// Social Accounts
export const getAccounts = () => request('GET', `${BASE}/acquisition/accounts`);
export const createAccount = (data) => request('POST', `${BASE}/acquisition/accounts`, data);
export const updateAccount = (id, data) => request('PUT', `${BASE}/acquisition/accounts/${id}`, data);
export const deleteAccount = (id) => request('DELETE', `${BASE}/acquisition/accounts/${id}`);

// Media Assets
export const getMedia = () => request('GET', `${BASE}/acquisition/media`);
export const createMedia = (data) => request('POST', `${BASE}/acquisition/media`, data);
export const updateMedia = (id, data) => request('PUT', `${BASE}/acquisition/media/${id}`, data);
export const deleteMedia = (id) => request('DELETE', `${BASE}/acquisition/media/${id}`);

export const uploadMedia = (file, { kind = 'feed', altText = '', tags = '' } = {}) => {
  const token = localStorage.getItem('ridn_token');
  const form = new FormData();
  form.append('file', file);
  form.append('kind', kind);
  form.append('alt_text', altText);
  form.append('tags', tags);
  return fetch(`${BASE}/acquisition/media/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });
};

// Social Posts
export const getPosts = (params = {}) => {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)));
  return request('GET', `${BASE}/acquisition/posts${qs.toString() ? '?' + qs : ''}`);
};
export const createPost = (data) => request('POST', `${BASE}/acquisition/posts`, data);
export const updatePost = (id, data) => request('PUT', `${BASE}/acquisition/posts/${id}`, data);
export const deletePost = (id) => request('DELETE', `${BASE}/acquisition/posts/${id}`);
export const publishPost = (id) => request('POST', `${BASE}/acquisition/posts/${id}/publish`);

// Post Metrics
export const getPostMetrics = (postId) => request('GET', `${BASE}/acquisition/posts/${postId}/metrics`);
export const recordPostMetrics = (postId, data) => request('POST', `${BASE}/acquisition/posts/${postId}/metrics`, data);

// Attribution Links
export const getLinks = () => request('GET', `${BASE}/acquisition/links`);
export const createLink = (data) => request('POST', `${BASE}/acquisition/links`, data);

// Leads
export const getLeads = (params = {}) => {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)));
  return request('GET', `${BASE}/leads${qs.toString() ? '?' + qs : ''}`);
};
export const getLeadCounts = () => request('GET', `${BASE}/leads/counts`);
export const getLead = (id) => request('GET', `${BASE}/leads/${id}`);
export const createLead = (data) => request('POST', `${BASE}/leads`, data);
export const updateLead = (id, data) => request('PUT', `${BASE}/leads/${id}`, data);
export const deleteLead = (id) => request('DELETE', `${BASE}/leads/${id}`);
export const promoteLead = (id, reason) => request('POST', `${BASE}/leads/${id}/promote`, { reason });
export const blockLead = (id) => request('POST', `${BASE}/leads/${id}/block`);
export const getLeadEvents = (id) => request('GET', `${BASE}/leads/${id}/events`);
export const addLeadEvent = (id, data) => request('POST', `${BASE}/leads/${id}/events`, data);

// Lead Flows
export const getFlows = () => request('GET', `${BASE}/lead-flows`);
export const getFlow = (id) => request('GET', `${BASE}/lead-flows/${id}`);
export const createFlow = (data) => request('POST', `${BASE}/lead-flows`, data);
export const updateFlow = (id, data) => request('PUT', `${BASE}/lead-flows/${id}`, data);
export const deleteFlow = (id) => request('DELETE', `${BASE}/lead-flows/${id}`);
export const toggleFlow = (id) => request('POST', `${BASE}/lead-flows/${id}/toggle`);

// Lead Triggers
export const getTriggers = () => request('GET', `${BASE}/lead-triggers`);
export const createTrigger = (data) => request('POST', `${BASE}/lead-triggers`, data);
export const updateTrigger = (id, data) => request('PUT', `${BASE}/lead-triggers/${id}`, data);
export const deleteTrigger = (id) => request('DELETE', `${BASE}/lead-triggers/${id}`);
export const toggleTrigger = (id) => request('POST', `${BASE}/lead-triggers/${id}/toggle`);
