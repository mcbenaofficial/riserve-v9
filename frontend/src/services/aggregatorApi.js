const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const BASE = `${BACKEND_URL}/api/aggregators`;

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

// Connections
export const getConnections = (outletId) => {
  const qs = outletId ? `?outlet_id=${outletId}` : '';
  return request('GET', `${BASE}/connections${qs}`);
};
export const createConnection = (data) => request('POST', `${BASE}/connections`, data);
export const updateConnection = (id, data) => request('PUT', `${BASE}/connections/${id}`, data);
export const deleteConnection = (id) => request('DELETE', `${BASE}/connections/${id}`);
export const syncConnection = (id) => request('POST', `${BASE}/connections/${id}/sync`);

// Orders
export const getOrders = (params = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
  );
  return request('GET', `${BASE}/orders${qs.toString() ? '?' + qs : ''}`);
};
export const importOrders = (orders) => request('POST', `${BASE}/orders/import`, { orders });
export const resolveOrder = (id) => request('POST', `${BASE}/orders/${id}/resolve`);
export const resolveOrderManual = (id, customerId) =>
  request('PATCH', `${BASE}/orders/${id}/resolve-manual?customer_id=${customerId}`);
export const markBridgeSent = (id) => request('POST', `${BASE}/orders/${id}/bridge`);

// Attribution
export const getAttribution = (outletId) => {
  const qs = outletId ? `?outlet_id=${outletId}` : '';
  return request('GET', `${BASE}/attribution${qs}`);
};
