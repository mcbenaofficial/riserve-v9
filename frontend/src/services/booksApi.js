import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getHeaders = () => {
  const token = localStorage.getItem('ridn_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const booksApi = {
  // Settings & Activation
  getSettings: () =>
    axios.get(`${API}/books/settings`, { headers: getHeaders() }),
  activateBooks: () =>
    axios.post(`${API}/books/settings/activate`, {}, { headers: getHeaders() }),
  updateSettings: (data) =>
    axios.put(`${API}/books/settings`, data, { headers: getHeaders() }),

  // Dashboard
  getDashboard: () =>
    axios.get(`${API}/books/dashboard`, { headers: getHeaders() }),

  // Chart of Accounts
  getAccounts: (params = {}) =>
    axios.get(`${API}/books/accounts`, { params, headers: getHeaders() }),
  createAccount: (data) =>
    axios.post(`${API}/books/accounts`, data, { headers: getHeaders() }),
  getAccount: (id) =>
    axios.get(`${API}/books/accounts/${id}`, { headers: getHeaders() }),
  updateAccount: (id, data) =>
    axios.put(`${API}/books/accounts/${id}`, data, { headers: getHeaders() }),
  deactivateAccount: (id) =>
    axios.delete(`${API}/books/accounts/${id}`, { headers: getHeaders() }),
  getAccountLedger: (id, params = {}) =>
    axios.get(`${API}/books/accounts/${id}/ledger`, { params, headers: getHeaders() }),

  // Journal Entries
  getJournalEntries: (params = {}) =>
    axios.get(`${API}/books/journal`, { params, headers: getHeaders() }),
  createJournalEntry: (data) =>
    axios.post(`${API}/books/journal`, data, { headers: getHeaders() }),
  getJournalEntry: (id) =>
    axios.get(`${API}/books/journal/${id}`, { headers: getHeaders() }),
  voidJournalEntry: (id, voidReason) =>
    axios.post(`${API}/books/journal/${id}/void`, { void_reason: voidReason }, { headers: getHeaders() }),

  // Tax Codes
  getTaxCodes: () =>
    axios.get(`${API}/books/tax-codes`, { headers: getHeaders() }),
  createTaxCode: (data) =>
    axios.post(`${API}/books/tax-codes`, data, { headers: getHeaders() }),

  // Bank Accounts
  getBankAccounts: () =>
    axios.get(`${API}/books/bank-accounts`, { headers: getHeaders() }),
  createBankAccount: (data) =>
    axios.post(`${API}/books/bank-accounts`, data, { headers: getHeaders() }),

  // Bills / Expenses
  getBills: (params = {}) =>
    axios.get(`${API}/books/bills`, { params, headers: getHeaders() }),
  createBill: (data) =>
    axios.post(`${API}/books/bills`, data, { headers: getHeaders() }),
  getBill: (id) =>
    axios.get(`${API}/books/bills/${id}`, { headers: getHeaders() }),
  payBill: (id, data) =>
    axios.post(`${API}/books/bills/${id}/pay`, data, { headers: getHeaders() }),
  voidBill: (id) =>
    axios.delete(`${API}/books/bills/${id}`, { headers: getHeaders() }),

  // Reports
  getPLReport: (fromDate, toDate) =>
    axios.get(`${API}/books/reports/pl`, { params: { from_date: fromDate, to_date: toDate }, headers: getHeaders() }),
  getBalanceSheet: (asOf) =>
    axios.get(`${API}/books/reports/balance-sheet`, { params: { as_of: asOf }, headers: getHeaders() }),
  getTrialBalance: (asOf) =>
    axios.get(`${API}/books/reports/trial-balance`, { params: { as_of: asOf }, headers: getHeaders() }),
  getTaxSummary: (fromDate, toDate) =>
    axios.get(`${API}/books/reports/tax-summary`, { params: { from_date: fromDate, to_date: toDate }, headers: getHeaders() }),
  getCashFlow: (fromDate, toDate) =>
    axios.get(`${API}/books/reports/cash-flow`, { params: { from_date: fromDate, to_date: toDate }, headers: getHeaders() }),
  getAgedReceivables: (asOf) =>
    axios.get(`${API}/books/reports/aged-receivables`, { params: { as_of: asOf }, headers: getHeaders() }),
  getAgedPayables: (asOf) =>
    axios.get(`${API}/books/reports/aged-payables`, { params: { as_of: asOf }, headers: getHeaders() }),
};
