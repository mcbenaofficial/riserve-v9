const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const BASE = `${BACKEND_URL}/api/visibility`;

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

// Score
export const getVisibilityScore = (outletId) => {
  const qs = outletId ? `?outlet_id=${outletId}` : '';
  return request('GET', `${BASE}/score${qs}`);
};

// Reviews
export const getReviews = (params = {}) => {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)));
  return request('GET', `${BASE}/reviews${qs.toString() ? '?' + qs : ''}`);
};
export const createReview = (data) => request('POST', `${BASE}/reviews`, data);
export const deleteReview = (id) => request('DELETE', `${BASE}/reviews/${id}`);
export const draftReply = (id) => request('POST', `${BASE}/reviews/${id}/draft`);
export const setReply = (id, data) => request('PATCH', `${BASE}/reviews/${id}/reply`, data);

// Listings
export const getListings = (outletId) => {
  const qs = outletId ? `?outlet_id=${outletId}` : '';
  return request('GET', `${BASE}/listings${qs}`);
};
export const upsertListing = (data) => request('PUT', `${BASE}/listings`, data);

// GEO
export const getGEOQueries = () => request('GET', `${BASE}/geo/queries`);
export const createGEOQuery = (data) => request('POST', `${BASE}/geo/queries`, data);
export const deleteGEOQuery = (id) => request('DELETE', `${BASE}/geo/queries/${id}`);
export const runGEOQuery = (id) => request('POST', `${BASE}/geo/queries/${id}/run`);
export const getGEOChecks = (params = {}) => {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)));
  return request('GET', `${BASE}/geo/checks${qs.toString() ? '?' + qs : ''}`);
};
export const getGEOSummary = () => request('GET', `${BASE}/geo/summary`);

// Knowledge Entries
export const getKnowledgeEntries = (params = {}) => {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null)));
  return request('GET', `${BASE}/knowledge${qs.toString() ? '?' + qs : ''}`);
};
export const createKnowledgeEntry = (data) => request('POST', `${BASE}/knowledge`, data);
export const updateKnowledgeEntry = (id, data) => request('PUT', `${BASE}/knowledge/${id}`, data);
export const deleteKnowledgeEntry = (id) => request('DELETE', `${BASE}/knowledge/${id}`);
