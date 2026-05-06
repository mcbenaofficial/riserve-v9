const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const BASE = `${BACKEND_URL}/api/marketing`;

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

// Segments
export const getSegments = () => request('GET', `${BASE}/segments`);
export const createSegment = (data) => request('POST', `${BASE}/segments`, data);
export const updateSegment = (id, data) => request('PUT', `${BASE}/segments/${id}`, data);
export const deleteSegment = (id) => request('DELETE', `${BASE}/segments/${id}`);
export const previewSegmentRules = (rules) => request('POST', `${BASE}/segments/preview-rules`, { rules });
export const previewSegment = (id) => request('POST', `${BASE}/segments/${id}/preview`);

// Campaigns
export const getCampaigns = () => request('GET', `${BASE}/campaigns`);
export const createCampaign = (data) => request('POST', `${BASE}/campaigns`, data);
export const updateCampaign = (id, data) => request('PUT', `${BASE}/campaigns/${id}`, data);
export const deleteCampaign = (id) => request('DELETE', `${BASE}/campaigns/${id}`);
export const launchCampaign = (id) => request('POST', `${BASE}/campaigns/${id}/launch`);
export const getCampaignStats = (id) => request('GET', `${BASE}/campaigns/${id}/stats`);
export const getCampaignRecipients = (id) => request('GET', `${BASE}/campaigns/${id}/recipients`);

// Journeys
export const getJourneys = () => request('GET', `${BASE}/journeys`);
export const createJourney = (data) => request('POST', `${BASE}/journeys`, data);
export const updateJourney = (id, data) => request('PUT', `${BASE}/journeys/${id}`, data);
export const deleteJourney = (id) => request('DELETE', `${BASE}/journeys/${id}`);
export const toggleJourney = (id) => request('PUT', `${BASE}/journeys/${id}/toggle`);
export const enrollCustomer = (journeyId, customerId) => request('POST', `${BASE}/journeys/${journeyId}/enroll/${customerId}`);
export const getEnrollments = (journeyId) => request('GET', `${BASE}/journeys/${journeyId}/enrollments`);

// Knowledge Base
const KB = `${BACKEND_URL}/api/knowledge`;
export const getKnowledgeSources = () => request('GET', `${KB}/sources`);
export const createKnowledgeSource = (data) => request('POST', `${KB}/sources`, data);
export const ingestContent = (sourceId, items) => request('POST', `${KB}/sources/${sourceId}/ingest`, items);

// Brand Voice
export const getBrandVoice = () => request('GET', `${KB}/brand-voice`);
export const saveBrandVoice = (data) => request('PUT', `${KB}/brand-voice`, data);

// Agent Config
export const getAgentConfigs = () => request('GET', `${KB}/agent-config`);
export const createAgentConfig = (data) => request('POST', `${KB}/agent-config`, data);
export const updateAgentConfig = (id, data) => request('PUT', `${KB}/agent-config/${id}`, data);
export const deleteAgentConfig = (id) => request('DELETE', `${KB}/agent-config/${id}`);
