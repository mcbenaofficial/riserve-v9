const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const BASE = `${BACKEND_URL}/api/whatsapp/acquisition`;

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

// Config preflight
export const checkConfig = () =>
  request('GET', `${BASE}/config/status`);

// Subscribers
export const getSubscribers = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.source) qs.set('source', params.source);
  if (params.tag) qs.set('tag', params.tag);
  if (params.active_only !== undefined) qs.set('active_only', params.active_only);
  if (params.limit) qs.set('limit', params.limit);
  if (params.offset) qs.set('offset', params.offset);
  return request('GET', `${BASE}/subscribers?${qs}`);
};

export const addSubscriber = (data) =>
  request('POST', `${BASE}/subscribers`, data);

export const bulkImportSubscribers = (items) =>
  request('POST', `${BASE}/subscribers/bulk`, items);

export const optOutSubscriber = (id) =>
  request('DELETE', `${BASE}/subscribers/${id}`);

export const retagSubscriber = (id, tags) =>
  request('PATCH', `${BASE}/subscribers/${id}/tags`, { tags });

// Segment preview
export const previewSegment = (segment_tags) =>
  request('POST', `${BASE}/segment-preview`, { segment_tags });

// Campaigns
export const getCampaigns = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.limit) qs.set('limit', params.limit);
  if (params.offset) qs.set('offset', params.offset);
  return request('GET', `${BASE}/campaigns?${qs}`);
};

export const createCampaign = (data) =>
  request('POST', `${BASE}/campaigns`, data);

export const updateCampaign = (id, data) =>
  request('PUT', `${BASE}/campaigns/${id}`, data);

export const deleteCampaign = (id) =>
  request('DELETE', `${BASE}/campaigns/${id}`);

export const sendCampaign = (id) =>
  request('POST', `${BASE}/campaigns/${id}/send`);

export const testSendCampaign = (id, phone) =>
  request('POST', `${BASE}/campaigns/${id}/test-send`, { phone });

export const getCampaignStats = (id) =>
  request('GET', `${BASE}/campaigns/${id}/stats`);

// Stats
export const getAcquisitionStats = () =>
  request('GET', `${BASE}/stats`);
