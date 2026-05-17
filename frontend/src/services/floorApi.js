import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getHeaders = () => {
  const token = localStorage.getItem('ridn_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const floorApi = {
  // Zones
  getZones: (outletId) =>
    axios.get(`${API}/floor/zones`, { params: { outlet_id: outletId }, headers: getHeaders() }),
  createZone: (data) =>
    axios.post(`${API}/floor/zones`, data, { headers: getHeaders() }),
  updateZone: (id, data) =>
    axios.put(`${API}/floor/zones/${id}`, data, { headers: getHeaders() }),
  deleteZone: (id) =>
    axios.delete(`${API}/floor/zones/${id}`, { headers: getHeaders() }),

  // Tables
  getTables: (params) =>
    axios.get(`${API}/floor/tables`, { params, headers: getHeaders() }),
  createTable: (data) =>
    axios.post(`${API}/floor/tables`, data, { headers: getHeaders() }),
  updateTable: (id, data) =>
    axios.put(`${API}/floor/tables/${id}`, data, { headers: getHeaders() }),
  deleteTable: (id) =>
    axios.delete(`${API}/floor/tables/${id}`, { headers: getHeaders() }),
  regenerateQr: (id) =>
    axios.post(`${API}/floor/tables/${id}/regenerate-qr`, {}, { headers: getHeaders() }),
  getTableLog: (id, params) =>
    axios.get(`${API}/floor/tables/${id}/log`, { params, headers: getHeaders() }),

  // Transitions
  transitionTable: (id, data) =>
    axios.post(`${API}/floor/tables/${id}/transition`, data, { headers: getHeaders() }),

  // Servers
  getServers: (outletId) =>
    axios.get(`${API}/floor/servers`, { params: { outlet_id: outletId }, headers: getHeaders() }),
  createServer: (data) =>
    axios.post(`${API}/floor/servers`, data, { headers: getHeaders() }),
  updateServer: (id, data) =>
    axios.put(`${API}/floor/servers/${id}`, data, { headers: getHeaders() }),
  assignServer: (serverId, tableId) =>
    axios.put(`${API}/floor/servers/${serverId}/assign/${tableId}`, {}, { headers: getHeaders() }),
};

export default floorApi;
