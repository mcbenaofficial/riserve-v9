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

function qs(params) {
  const str = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  ).toString();
  return str ? '?' + str : '';
}

// Campaign Types
export const getCampaignTypes = () => request('GET', `${BASE}/campaign-types`);

// Campaign Tag Groups
export const getTagGroups = () => request('GET', `${BASE}/campaign-tag-groups`);
export const createTagGroup = (data) => request('POST', `${BASE}/campaign-tag-groups`, data);
export const updateTagGroup = (id, data) => request('PUT', `${BASE}/campaign-tag-groups/${id}`, data);
export const deleteTagGroup = (id) => request('DELETE', `${BASE}/campaign-tag-groups/${id}`);

// Campaigns
export const getCampaigns = (params = {}) =>
  request('GET', `${BASE}/campaigns${qs(params)}`);
export const getCampaign = (id) => request('GET', `${BASE}/campaigns/${id}`);
export const createCampaign = (data) => request('POST', `${BASE}/campaigns`, data);
export const updateCampaign = (id, data) => request('PUT', `${BASE}/campaigns/${id}`, data);
export const deleteCampaign = (id) => request('DELETE', `${BASE}/campaigns/${id}`);
export const activateCampaign = (id) => request('POST', `${BASE}/campaigns/${id}/activate`);
export const pauseCampaign = (id) => request('POST', `${BASE}/campaigns/${id}/pause`);
export const archiveCampaign = (id) => request('POST', `${BASE}/campaigns/${id}/archive`);

// Campaign Templates
export const getCampaignTemplates = (params = {}) =>
  request('GET', `${BASE}/campaign-templates${qs(params)}`);
export const useCampaignTemplate = (templateId, data) =>
  request('POST', `${BASE}/campaign-templates/${templateId}/use`, data);

// Submissions (per-campaign)
export const getSubmissions = (campaignId, params = {}) =>
  request('GET', `${BASE}/campaigns/${campaignId}/submissions${qs(params)}`);
export const createSubmission = (campaignId, data) =>
  request('POST', `${BASE}/campaigns/${campaignId}/submissions`, data);
export const getSubmission = (campaignId, id) =>
  request('GET', `${BASE}/campaigns/${campaignId}/submissions/${id}`);
export const updateSubmission = (campaignId, id, data) =>
  request('PUT', `${BASE}/campaigns/${campaignId}/submissions/${id}`, data);

// Global submissions
export const getAllSubmissions = (params = {}) =>
  request('GET', `${BASE}/submissions${qs(params)}`);

// Submission actions
export const advanceStage = (submissionId, data) =>
  request('POST', `${BASE}/submissions/${submissionId}/advance-stage`, data);
export const addNote = (submissionId, data) =>
  request('POST', `${BASE}/submissions/${submissionId}/notes`, data);
export const getSubmissionEvents = (submissionId) =>
  request('GET', `${BASE}/submissions/${submissionId}/events`);
export const promoteSubmission = (submissionId, data) =>
  request('POST', `${BASE}/submissions/${submissionId}/promote`, data);
export const loseSubmission = (submissionId, data) =>
  request('POST', `${BASE}/submissions/${submissionId}/lose`, data);

export const getStuckSubmissions = (params = {}) =>
  request('GET', `${BASE}/submissions/stuck${qs(params)}`);
