import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, TrendingUp, CheckCircle, XCircle, AlertCircle,
  Building2, RefreshCw, Search, DollarSign, Settings, Eye, EyeOff,
  Save, Send, X, ChevronRight, Plus
} from 'lucide-react';
import { api } from '../services/api';

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------
const StatCard = ({ icon: Icon, label, value, sub, iconBg, theme }) => {
  const isDark = theme === 'dark';
  return (
    <div className={`p-6 rounded-2xl shadow-sm ${isDark ? 'bg-[#171C22]' : 'bg-white'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <Icon size={20} className="text-white" />
        </div>
        {sub && (
          <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-[#1F2630] text-[#7D8590]' : 'bg-[#F6F7F9] text-[#6B7280]'}`}>
            {sub}
          </span>
        )}
      </div>
      <div className={`text-3xl font-bold mb-1 ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{value}</div>
      <div className={`text-sm ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{label}</div>
    </div>
  );
};

const DeliveryBar = ({ rate, theme }) => (
  <div className="flex items-center gap-2">
    <div className={`flex-1 h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0] transition-all"
        style={{ width: `${rate}%` }}
      />
    </div>
    <span className={`text-xs font-medium w-10 text-right ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
      {rate}%
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// Config Drawer — slide-in panel to configure a single company's WA settings
// ---------------------------------------------------------------------------
const CompanyConfigDrawer = ({ company, theme, onClose, onSaved }) => {
  const isDark = theme === 'dark';
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testTrigger, setTestTrigger] = useState('booking_confirmed');
  const [testStatus, setTestStatus] = useState(null); // null | 'sending' | 'ok' | 'err'
  const [saveMsg, setSaveMsg] = useState(null);

  const [form, setForm] = useState({
    enabled: false,
    phone_number_id: '',
    waba_id: '',
    access_token: '',
    display_phone: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getSuperAdminWhatsAppConfig(company.company_id);
        const cfg = res.data;
        setConfig(cfg);
        setForm({
          enabled: cfg.enabled,
          phone_number_id: cfg.phone_number_id || '',
          waba_id: cfg.waba_id || '',
          access_token: '',
          display_phone: cfg.display_phone || '',
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [company.company_id]);

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await api.updateSuperAdminWhatsAppConfig(company.company_id, form);
      setSaveMsg({ ok: true, text: 'Configuration saved.' });
      onSaved();
    } catch (e) {
      setSaveMsg({ ok: false, text: e?.response?.data?.detail || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testPhone.trim()) return;
    setTestStatus('sending');
    try {
      await api.superAdminSendWhatsAppTest(company.company_id, {
        recipient_phone: testPhone,
        trigger: testTrigger,
      });
      setTestStatus('ok');
    } catch {
      setTestStatus('err');
    }
  };

  const TRIGGER_LABELS = {
    booking_confirmed: 'Booking Confirmation',
    booking_reminder: 'Booking Reminder',
    booking_cancelled: 'Booking Cancelled',
    booking_completed: 'Service Completed',
    order_confirmed: 'Order Confirmed',
    order_ready: 'Order Ready for Pickup',
    order_cancelled: 'Order Cancelled',
    payment_receipt: 'Payment Receipt',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed inset-y-0 right-0 w-[480px] z-50 flex flex-col shadow-2xl
        ${isDark ? 'bg-[#0B0D10] border-l border-[#1F2630]' : 'bg-white border-l border-[#D9DEE5]'}`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-[#1F2630]' : 'border-[#D9DEE5]'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <MessageCircle size={18} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className={`font-semibold text-sm ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                {company.company_name}
              </div>
              <div className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                WhatsApp Configuration
              </div>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1F2630] transition-colors`}>
            <X size={18} className={isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5FA8D3]" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Enable toggle */}
            <div className={`flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-[#171C22]' : 'bg-[#F6F7F9]'}`}>
              <div>
                <div className={`text-sm font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  WhatsApp Notifications
                </div>
                <div className={`text-xs mt-0.5 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Enable or disable all WhatsApp messages for this company
                </div>
              </div>
              <button
                onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.enabled ? 'bg-green-500' : isDark ? 'bg-[#1F2630]' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  form.enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Credentials */}
            <div>
              <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                API Credentials
              </h3>
              <div className="space-y-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-[#A9AFB8]' : 'text-[#374151]'}`}>
                    Phone Number ID
                  </label>
                  <input
                    type="text"
                    value={form.phone_number_id}
                    onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))}
                    placeholder="e.g. 123456789012345"
                    className={`w-full px-3 py-2 rounded-xl text-sm border ${
                      isDark
                        ? 'bg-[#171C22] border-[#1F2630] text-[#E6E8EB] placeholder-[#7D8590]'
                        : 'bg-white border-gray-200 text-[#0E1116] placeholder-gray-400'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-[#A9AFB8]' : 'text-[#374151]'}`}>
                    WABA ID
                  </label>
                  <input
                    type="text"
                    value={form.waba_id}
                    onChange={e => setForm(f => ({ ...f, waba_id: e.target.value }))}
                    placeholder="e.g. 987654321098765"
                    className={`w-full px-3 py-2 rounded-xl text-sm border ${
                      isDark
                        ? 'bg-[#171C22] border-[#1F2630] text-[#E6E8EB] placeholder-[#7D8590]'
                        : 'bg-white border-gray-200 text-[#0E1116] placeholder-gray-400'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-[#A9AFB8]' : 'text-[#374151]'}`}>
                    Display Phone Number
                  </label>
                  <input
                    type="text"
                    value={form.display_phone}
                    onChange={e => setForm(f => ({ ...f, display_phone: e.target.value }))}
                    placeholder="+1 555-123-4567"
                    className={`w-full px-3 py-2 rounded-xl text-sm border ${
                      isDark
                        ? 'bg-[#171C22] border-[#1F2630] text-[#E6E8EB] placeholder-[#7D8590]'
                        : 'bg-white border-gray-200 text-[#0E1116] placeholder-gray-400'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-[#A9AFB8]' : 'text-[#374151]'}`}>
                    Access Token
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={form.access_token}
                      onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))}
                      placeholder={config?.access_token_masked || 'Enter token to set or update'}
                      className={`w-full px-3 py-2 pr-9 rounded-xl text-sm border ${
                        isDark
                          ? 'bg-[#171C22] border-[#1F2630] text-[#E6E8EB] placeholder-[#7D8590]'
                          : 'bg-white border-gray-200 text-[#0E1116] placeholder-gray-400'
                      }`}
                    />
                    <button
                      onClick={() => setShowToken(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {config?.access_token_masked && (
                    <p className={`text-xs mt-1 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                      Current: {config.access_token_masked} — leave blank to keep
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Template status summary */}
            {config?.templates?.length > 0 && (
              <div>
                <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Active Templates
                </h3>
                <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-[#1F2630]' : 'border-gray-200'}`}>
                  {config.templates.map((tpl, i) => (
                    <div
                      key={tpl.trigger}
                      className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                        i > 0 ? (isDark ? 'border-t border-[#1F2630]' : 'border-t border-gray-100') : ''
                      } ${isDark ? 'bg-[#171C22]' : 'bg-white'}`}
                    >
                      <span className={isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}>
                        {TRIGGER_LABELS[tpl.trigger] || tpl.trigger}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                          {tpl.template_name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          tpl.active
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                        }`}>
                          {tpl.active ? 'On' : 'Off'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className={`text-xs mt-2 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Template details are managed by the customer in their Admin Console.
                </p>
              </div>
            )}

            {/* Test message */}
            <div>
              <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                Send Test Message
              </h3>
              <div className="space-y-2">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  className={`w-full px-3 py-2 rounded-xl text-sm border ${
                    isDark
                      ? 'bg-[#171C22] border-[#1F2630] text-[#E6E8EB] placeholder-[#7D8590]'
                      : 'bg-white border-gray-200 text-[#0E1116] placeholder-gray-400'
                  }`}
                />
                <div className="flex gap-2">
                  <select
                    value={testTrigger}
                    onChange={e => setTestTrigger(e.target.value)}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm border ${
                      isDark
                        ? 'bg-[#171C22] border-[#1F2630] text-[#E6E8EB]'
                        : 'bg-white border-gray-200 text-[#0E1116]'
                    }`}
                  >
                    {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <button
                    onClick={sendTest}
                    disabled={testStatus === 'sending' || !testPhone.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#222] shadow hover:scale-[1.02] transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
                  >
                    <Send size={14} />
                    {testStatus === 'sending' ? 'Sending…' : 'Test'}
                  </button>
                </div>
                {testStatus === 'ok' && (
                  <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle size={13} /> Message dispatched
                  </p>
                )}
                {testStatus === 'err' && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={13} /> Failed — check credentials and template approval
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${isDark ? 'border-[#1F2630]' : 'border-[#D9DEE5]'} flex items-center justify-between`}>
          <div>
            {saveMsg && (
              <span className={`text-xs ${saveMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {saveMsg.text}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                isDark ? 'text-[#7D8590] hover:bg-[#1F2630]' : 'text-[#6B7280] hover:bg-[#F6F7F9]'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || loading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-[#222] shadow hover:scale-[1.02] transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const SuperAdminPartnerIntegrations = ({ theme = 'light' }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('');
  const [sortBy, setSortBy] = useState('messages_sent');
  const [configTarget, setConfigTarget] = useState(null); // company row being configured

  const isDark = theme === 'dark';

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getSuperAdminWhatsAppStats(days);
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch partner integration stats', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const allCompanies = stats?.per_company || [];

  const filtered = allCompanies
    .filter(c => {
      const matchSearch = !search || c.company_name.toLowerCase().includes(search.toLowerCase());
      const matchEnabled =
        filterEnabled === '' ? true
        : filterEnabled === 'enabled' ? c.wa_enabled
        : filterEnabled === 'configured' ? c.wa_configured
        : !c.wa_configured;
      return matchSearch && matchEnabled;
    })
    .sort((a, b) => {
      if (sortBy === 'messages_sent') return b.messages_sent - a.messages_sent;
      if (sortBy === 'cost') return b.cost_usd - a.cost_usd;
      if (sortBy === 'delivery_rate') return b.delivery_rate - a.delivery_rate;
      return a.company_name.localeCompare(b.company_name);
    });

  const planColor = (plan) => {
    const map = {
      pro: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      essential: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
      trial: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      custom: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    };
    return map[plan] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600">
            <MessageCircle size={24} className="text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
              Partner Integrations
            </h1>
            <p className={`text-sm ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
              Configure and monitor WhatsApp messaging across all customer accounts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className={`px-3 py-2 rounded-xl text-sm border-none outline-none ${isDark ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'}`}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchStats}
            disabled={loading}
            className={`p-2 rounded-xl transition-colors ${isDark ? 'bg-[#1F2630] hover:bg-[#252D38]' : 'bg-[#F6F7F9] hover:bg-[#ECEFF3]'}`}
          >
            <RefreshCw size={18} className={`${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5FA8D3]" />
        </div>
      ) : !stats ? (
        <div className={`p-8 rounded-2xl text-center ${isDark ? 'bg-[#171C22]' : 'bg-white'}`}>
          <AlertCircle size={36} className="mx-auto mb-3 text-gray-400" />
          <p className={isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}>Failed to load stats</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Building2} label="Total Companies" value={stats.companies_total ?? allCompanies.length}
              sub={`${stats.companies_with_wa} configured`} iconBg="bg-[#5FA8D3]" theme={theme} />
            <StatCard icon={MessageCircle} label="Messages Sent" value={stats.total_messages_sent.toLocaleString()}
              sub={`${days}d window`} iconBg="bg-green-500" theme={theme} />
            <StatCard icon={TrendingUp} label="Platform Delivery Rate" value={`${stats.platform_delivery_rate}%`}
              sub={`${stats.total_messages_failed} failed`} iconBg="bg-blue-500" theme={theme} />
            <StatCard icon={DollarSign} label="Est. Total Cost" value={`$${stats.total_cost_usd.toFixed(2)}`}
              sub="~$0.005 / msg" iconBg="bg-amber-500" theme={theme} />
          </div>

          {/* Table */}
          <div className={`rounded-2xl overflow-hidden shadow-sm ${isDark ? 'bg-[#171C22]' : 'bg-white'}`}>
            <div className={`p-5 border-b ${isDark ? 'border-[#1F2630]' : 'border-[#D9DEE5]'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h3 className={`text-base font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  All Companies
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDark ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
                    <Search size={15} className={isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                    <input
                      type="text"
                      placeholder="Search companies…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className={`bg-transparent border-none outline-none text-sm w-36 ${isDark ? 'text-[#E6E8EB] placeholder-[#7D8590]' : 'text-[#0E1116] placeholder-[#6B7280]'}`}
                    />
                  </div>
                  <select
                    value={filterEnabled}
                    onChange={e => setFilterEnabled(e.target.value)}
                    className={`px-3 py-2 rounded-xl text-sm border-none outline-none ${isDark ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'}`}
                  >
                    <option value="">All Companies</option>
                    <option value="enabled">WA Enabled</option>
                    <option value="configured">WA Configured</option>
                    <option value="unconfigured">Not Configured</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className={`px-3 py-2 rounded-xl text-sm border-none outline-none ${isDark ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'}`}
                  >
                    <option value="messages_sent">Sort: Messages</option>
                    <option value="cost">Sort: Cost</option>
                    <option value="delivery_rate">Sort: Delivery</option>
                    <option value="name">Sort: Name</option>
                  </select>
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="p-10 text-center">
                <Building2 size={36} className={`mx-auto mb-3 opacity-30 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`} />
                <p className={isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}>No companies match your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={isDark ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}>
                    <tr>
                      {['Company', 'Plan', 'WA Status', 'Phone', 'Sent', 'Failed', 'Delivery', 'Cost', ''].map(h => (
                        <th key={h} className={`px-5 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-[#1F2630]' : 'divide-[#D9DEE5]'}`}>
                    {filtered.map(row => (
                      <tr key={row.company_id} className={`transition-colors ${isDark ? 'hover:bg-[#1F2630]/50' : 'hover:bg-[#F6F7F9]'}`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
                              <Building2 size={16} className="text-[#5FA8D3]" />
                            </div>
                            <span className={`font-medium text-sm ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                              {row.company_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${planColor(row.company_plan)}`}>
                            {row.company_plan}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {!row.wa_configured ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${isDark ? 'bg-[#1F2630] text-[#7D8590]' : 'bg-gray-100 text-gray-500'}`}>
                              Not Set Up
                            </span>
                          ) : row.wa_enabled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold">
                              <CheckCircle size={11} /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-semibold">
                              <XCircle size={11} /> Disabled
                            </span>
                          )}
                        </td>
                        <td className={`px-5 py-4 text-sm ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                          {row.display_phone || '—'}
                        </td>
                        <td className={`px-5 py-4 text-sm font-medium ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                          {row.messages_sent > 0 ? row.messages_sent.toLocaleString() : <span className={isDark ? 'text-[#7D8590]' : 'text-gray-400'}>—</span>}
                        </td>
                        <td className={`px-5 py-4 text-sm ${row.messages_failed > 0 ? 'text-red-500' : isDark ? 'text-[#7D8590]' : 'text-gray-400'}`}>
                          {row.messages_failed > 0 ? row.messages_failed.toLocaleString() : '—'}
                        </td>
                        <td className="px-5 py-4 w-32">
                          {row.wa_configured
                            ? <DeliveryBar rate={row.delivery_rate} theme={theme} />
                            : <span className={`text-sm ${isDark ? 'text-[#7D8590]' : 'text-gray-400'}`}>—</span>
                          }
                        </td>
                        <td className={`px-5 py-4 text-sm font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                          {row.cost_usd > 0 ? `$${row.cost_usd.toFixed(2)}` : <span className={isDark ? 'text-[#7D8590]' : 'text-gray-400'}>—</span>}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setConfigTarget(row)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] ${
                              row.wa_configured
                                ? `border ${isDark ? 'border-[#1F2630] text-[#E6E8EB] hover:bg-[#1F2630]' : 'border-gray-200 text-[#0E1116] hover:bg-[#F6F7F9]'}`
                                : 'text-white'
                            }`}
                            style={!row.wa_configured ? { background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' } : {}}
                          >
                            {row.wa_configured
                              ? <><Settings size={12} /> Configure</>
                              : <><Plus size={12} /> Set Up</>
                            }
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer totals */}
            {filtered.length > 0 && (
              <div className={`px-5 py-3 border-t flex items-center gap-6 text-xs ${isDark ? 'border-[#1F2630] bg-[#1F2630]' : 'border-[#D9DEE5] bg-[#F6F7F9]'}`}>
                <span className={isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}>{filtered.length} companies</span>
                <span className={isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}>
                  Sent: <strong>{filtered.reduce((s, r) => s + r.messages_sent, 0).toLocaleString()}</strong>
                </span>
                <span className={isDark ? 'text-amber-400' : 'text-amber-600'}>
                  Cost: <strong>${filtered.reduce((s, r) => s + r.cost_usd, 0).toFixed(2)}</strong>
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {/* Config drawer */}
      {configTarget && (
        <CompanyConfigDrawer
          company={configTarget}
          theme={theme}
          onClose={() => setConfigTarget(null)}
          onSaved={() => { fetchStats(); }}
        />
      )}
    </div>
  );
};

export default SuperAdminPartnerIntegrations;
