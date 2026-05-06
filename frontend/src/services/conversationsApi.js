const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const BASE = `${BACKEND_URL}/api/conversations`;

function headers() {
  const token = localStorage.getItem('ridn_token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
}

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: headers(),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Inboxes
export const getInboxes = () => request('GET', `${BASE}/inboxes`);
export const createInbox = (data) => request('POST', `${BASE}/inboxes`, data);
export const syncTemplates = (inboxId) => request('GET', `${BASE}/inboxes/${inboxId}/templates/sync`);
export const getTemplates = (channel) =>
  request('GET', `${BASE}/templates${channel ? `?channel=${channel}` : ''}`);

// Conversations
export const getConversations = (params = {}) => {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.assignee_id) q.set('assignee_id', params.assignee_id);
  if (params.inbox_id) q.set('inbox_id', params.inbox_id);
  if (params.unread_only) q.set('unread_only', 'true');
  if (params.cursor) q.set('cursor', params.cursor);
  if (params.limit) q.set('limit', params.limit);
  return request('GET', `${BASE}?${q}`);
};
export const getConversation = (id) => request('GET', `${BASE}/${id}`);
export const getMessages = (id, params = {}) => {
  const q = new URLSearchParams();
  if (params.cursor) q.set('cursor', params.cursor);
  if (params.limit) q.set('limit', params.limit);
  return request('GET', `${BASE}/${id}/messages?${q}`);
};
export const sendMessage = (id, data) => request('POST', `${BASE}/${id}/messages`, data);
export const assignConversation = (id, assigneeId) =>
  request('PUT', `${BASE}/${id}/assign`, { assignee_id: assigneeId });
export const setStatus = (id, status, snoozeUntil) =>
  request('PUT', `${BASE}/${id}/status`, { status, snooze_until: snoozeUntil });
export const setLabels = (id, labels) => request('PUT', `${BASE}/${id}/labels`, { labels });
export const clearUnread = (id) => request('PUT', `${BASE}/${id}/unread/clear`);
export const getNotes = (id) => request('GET', `${BASE}/${id}/notes`);
export const postNote = (id, body, mentions = []) =>
  request('POST', `${BASE}/${id}/messages`, { is_note: true, body, mentions });

// Customer identities / consent
export const getIdentities = (customerId) =>
  request('GET', `${BASE}/customers/${customerId}/identities`);
export const getConsent = (customerId) =>
  request('GET', `${BASE}/customers/${customerId}/consent`);

// AI handling state
export const setAiState = (id, state) => request('PUT', `${BASE}/${id}/ai-state`, { state });

// Frequency cap settings
export const getFrequencyCap = () => request('GET', `${BASE}/settings/frequency-cap`);
export const saveFrequencyCap = (data) => request('PUT', `${BASE}/settings/frequency-cap`, data);

// WebSocket factory
export function createInboxSocket(companyId, onMessage) {
  const wsBase = BACKEND_URL.replace(/^http/, 'ws');
  const ws = new WebSocket(`${wsBase}/api/conversations/ws/${companyId}`);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch (_) {}
  };
  ws.onerror = (e) => console.warn('Inbox WS error', e);
  return ws;
}
