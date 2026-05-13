import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, ChevronRight, Save, CheckCircle,
  AlertCircle, Clock, ExternalLink, RefreshCw, Zap, Globe, Info
} from 'lucide-react';
import { api } from '../../services/api';

// ── Connect account status map ────────────────────────────────────────────
const CONNECT_STATUS = {
  not_started: { label: 'Not Connected',      color: 'text-gray-500',                              bg: 'bg-gray-100 dark:bg-gray-800' },
  pending:     { label: 'Onboarding Pending',  color: 'text-yellow-600 dark:text-yellow-400',       bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  active:      { label: 'Active',              color: 'text-green-600 dark:text-green-400',         bg: 'bg-green-100 dark:bg-green-900/30' },
  restricted:  { label: 'Restricted',          color: 'text-red-600 dark:text-red-400',             bg: 'bg-red-100 dark:bg-red-900/30' },
};

// ── Shared field components ───────────────────────────────────────────────
const FieldGroup = ({ label, required, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-[#A9AFB8] mb-1.5">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-gray-500 dark:text-[#7D8590] mt-1">{hint}</p>}
  </div>
);

const TextInput = ({ value, onChange, placeholder, type = 'text', readOnly }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    readOnly={readOnly}
    className={`w-full px-4 py-2.5 rounded-xl text-sm border border-gray-200 dark:border-[#1F2630]
      bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] placeholder-gray-400 dark:placeholder-[#7D8590]
      focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]/40
      ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
  />
);

// ── Fee breakdown ─────────────────────────────────────────────────────────
const FeeBreakdown = ({ data }) => {
  if (!data) return null;
  const rows = [
    { label: 'Service amount',                                     value: data.service_amount,   bold: false },
    { label: `Platform fee (${data.platform_fee_pct}%)`,          value: -data.platform_fee,    bold: false },
    { label: 'Stripe fee (2.9% + $0.30)',                         value: -data.stripe_fee_total, bold: false, dim: true },
    { label: 'Merchant receives',                                  value: data.merchant_receives, bold: true  },
  ];

  return (
    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-sm space-y-2">
      <div className="text-xs font-semibold text-gray-500 dark:text-[#7D8590] uppercase tracking-wider mb-3">
        Fee Breakdown
      </div>
      {rows.map(r => (
        <div key={r.label} className={`flex items-center justify-between ${r.dim ? 'opacity-60' : ''}`}>
          <span className={`${r.dim ? 'italic' : ''} text-gray-600 dark:text-[#A9AFB8]`}>{r.label}</span>
          <span className={`font-mono font-medium ${
            r.bold        ? 'text-green-600 dark:text-green-400' :
            r.value < 0   ? 'text-red-500' :
                            'text-gray-900 dark:text-[#E6E8EB]'
          }`}>
            ${Math.abs(r.value).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── StatusDot ─────────────────────────────────────────────────────────────
const StatusDot = ({ enabled }) => (
  <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
    enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'
  }`}>
    {enabled ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
    {enabled ? 'Yes' : 'No'}
  </span>
);

// ── Tab bar ───────────────────────────────────────────────────────────────
const TABS = [
  { id: 1, label: 'Setup' },
  { id: 2, label: 'Connect Status' },
  { id: 3, label: 'Fee Preview' },
];

// ── Main component ────────────────────────────────────────────────────────
const AdminStripe = ({ onBack }) => {
  const [config, setConfig]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [activeTab, setActiveTab] = useState(1);
  const [msg, setMsg]             = useState(null);  // { ok: bool, text: str }

  // Setup tab form
  const [form, setForm] = useState({ email: '', business_name: '' });
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fee preview tab
  const [previewAmt, setPreviewAmt]     = useState('');
  const [feeData, setFeeData]           = useState(null);
  const [feeLoading, setFeeLoading]     = useState(false);

  // Status tab
  const [statusSyncing, setStatusSyncing] = useState(false);
  const [dashLoading, setDashLoading]     = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.getStripeConfig();
      setConfig(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  // ── Setup tab actions ─────────────────────────────────────────────
  const connectAccount = async () => {
    if (!form.email || !form.business_name) {
      setMsg({ ok: false, text: 'Email and business name are required.' });
      return;
    }
    setConnecting(true);
    setMsg(null);
    try {
      const res = await api.createStripeConnectAccount(form);
      const { onboarding_url } = res.data;
      await fetchConfig();
      setMsg({ ok: true, text: 'Stripe Connect account created. Opening onboarding…' });
      if (onboarding_url) window.open(onboarding_url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.detail || 'Failed to create Connect account.' });
    } finally {
      setConnecting(false);
    }
  };

  const refreshOnboarding = async () => {
    setRefreshing(true);
    setMsg(null);
    try {
      const res = await api.refreshStripeOnboardingLink();
      const { onboarding_url } = res.data;
      setMsg({ ok: true, text: 'Onboarding link refreshed. Opening…' });
      if (onboarding_url) window.open(onboarding_url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.detail || 'Failed to refresh onboarding link.' });
    } finally {
      setRefreshing(false);
    }
  };

  const saveEnabled = async (enabled) => {
    setSaving(true);
    setMsg(null);
    try {
      await api.updateStripeConfig({ enabled });
      await fetchConfig();
      setMsg({ ok: true, text: 'Saved.' });
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.detail || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Status tab actions ────────────────────────────────────────────
  const syncStatus = async () => {
    setStatusSyncing(true);
    setMsg(null);
    try {
      await api.refreshStripeAccountStatus();
      await fetchConfig();
      setMsg({ ok: true, text: 'Status refreshed.' });
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.detail || 'Status sync failed.' });
    } finally {
      setStatusSyncing(false);
    }
  };

  const openDashboard = async () => {
    setDashLoading(true);
    setMsg(null);
    try {
      const res = await api.getStripeDashboardLink();
      if (res.data.url) window.open(res.data.url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setMsg({ ok: false, text: e?.response?.data?.detail || 'Failed to get dashboard link.' });
    } finally {
      setDashLoading(false);
    }
  };

  // ── Fee preview ───────────────────────────────────────────────────
  const fetchFeePreview = useCallback(async (amt) => {
    const n = parseFloat(amt);
    if (!n || isNaN(n) || n <= 0) { setFeeData(null); return; }
    setFeeLoading(true);
    try {
      const res = await api.getStripeFeePreview(n);
      setFeeData(res.data);
    } catch (e) {
      setFeeData(null);
    } finally {
      setFeeLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchFeePreview(previewAmt), 400);
    return () => clearTimeout(t);
  }, [previewAmt, fetchFeePreview]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5FA8D3]" />
      </div>
    );
  }

  const connectStatus = CONNECT_STATUS[config?.connect_account_status || 'not_started'];
  const hasAccount    = !!config?.connect_account_id;
  const isActive      = config?.connect_charges_enabled;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white/50 dark:bg-white/5 border border-transparent dark:border-[#1F2630] hover:bg-gray-100 dark:hover:bg-[#1F2630] text-gray-600 dark:text-[#7D8590] transition-colors"
          >
            <ChevronRight size={20} className="rotate-180" />
          </button>
        )}
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <CreditCard size={20} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">Stripe Connect</h2>
          <p className="text-sm text-gray-600 dark:text-[#7D8590]">
            Collect customer payments via Stripe Express — platform-managed splits
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setMsg(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? 'bg-white dark:bg-[#1F2630] text-gray-900 dark:text-[#E6E8EB] shadow-sm'
                : 'text-gray-600 dark:text-[#7D8590] hover:text-gray-900 dark:hover:text-[#E6E8EB]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Global message */}
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
          msg.ok
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
        }`}>
          {msg.ok ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {msg.text}
        </div>
      )}

      {/* ── Tab 1: Setup ── */}
      {activeTab === 1 && (
        <div className="space-y-4">
          {/* Platform key info */}
          <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#E6E8EB]">Platform Configuration</h3>
            <FieldGroup label="Stripe Publishable Key" hint="Platform key managed by Ri'Serve — not editable here.">
              <TextInput
                value={config?.publishable_key || '(not configured)'}
                readOnly
              />
            </FieldGroup>
            <div className="flex items-start gap-2 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40">
              <Info size={15} className="text-indigo-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                Platform fee: <strong>{config?.platform_fee_pct ?? 1.5}%</strong> — set by your service provider.
                Stripe charges an additional 2.9% + $0.30 per transaction.
              </p>
            </div>
          </div>

          {/* Connect account section */}
          <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-6 space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#E6E8EB]">Connect Express Account</h3>

            {!hasAccount ? (
              /* No account yet — show creation form */
              <>
                <p className="text-sm text-gray-600 dark:text-[#7D8590]">
                  Create a Stripe Express account to start accepting payments. You'll be redirected to
                  Stripe to complete KYC and bank onboarding.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FieldGroup label="Business Email" required>
                    <TextInput
                      type="email"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="business@example.com"
                    />
                  </FieldGroup>
                  <FieldGroup label="Business Name" required>
                    <TextInput
                      value={form.business_name}
                      onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                      placeholder="Your business name"
                    />
                  </FieldGroup>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={connectAccount}
                    disabled={connecting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#222] shadow hover:scale-[1.02] transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
                  >
                    <Zap size={15} />
                    {connecting ? 'Connecting…' : 'Connect Stripe Account'}
                  </button>
                </div>
              </>
            ) : !isActive ? (
              /* Account exists but not yet active */
              <>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30">
                  <Clock size={15} className="text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Onboarding in progress. Complete the Stripe setup to enable payments.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-[#7D8590]">Connect Account ID: </span>
                    <span className="font-mono text-gray-900 dark:text-[#E6E8EB]">{config.connect_account_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-[#7D8590]">Status: </span>
                    <span className={`font-semibold ${connectStatus.color}`}>{connectStatus.label}</span>
                  </div>
                </div>
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={refreshOnboarding}
                    disabled={refreshing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#222] shadow hover:scale-[1.02] transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
                  >
                    <ExternalLink size={14} />
                    {refreshing ? 'Loading…' : 'Continue Onboarding'}
                  </button>
                  <button
                    onClick={syncStatus}
                    disabled={statusSyncing}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-[#1F2630] text-gray-700 dark:text-[#E6E8EB] hover:bg-gray-50 dark:hover:bg-[#1F2630] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={statusSyncing ? 'animate-spin' : ''} />
                    Check Status
                  </button>
                </div>
              </>
            ) : (
              /* Active */
              <>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30">
                  <CheckCircle size={15} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Your Stripe Connect account is active and accepting payments.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-[#7D8590]">Connect Account ID: </span>
                    <span className="font-mono text-gray-900 dark:text-[#E6E8EB]">{config.connect_account_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-[#7D8590]">Status: </span>
                    <span className={`font-semibold ${connectStatus.color}`}>{connectStatus.label}</span>
                  </div>
                </div>

                {/* Enabled toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-[#1F2630]">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-[#E6E8EB]">Enable Stripe payments</div>
                    <div className="text-xs text-gray-500 dark:text-[#7D8590]">Allow customers to pay via Stripe</div>
                  </div>
                  <button
                    onClick={() => saveEnabled(!config?.enabled)}
                    disabled={saving}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      config?.enabled ? 'bg-[#5FA8D3]' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      config?.enabled ? 'translate-x-5' : ''
                    }`} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 2: Connect Status ── */}
      {activeTab === 2 && (
        <div className="space-y-4">
          {/* Status banner */}
          {isActive ? (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 text-sm text-green-700 dark:text-green-300 font-medium">
              <CheckCircle size={16} />
              Your Stripe Connect account is active — payments are live.
            </div>
          ) : hasAccount ? (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 text-sm text-yellow-700 dark:text-yellow-300 font-medium">
              <AlertCircle size={16} />
              Complete Stripe onboarding to enable payments.
            </div>
          ) : (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-[#1F2630] text-sm text-gray-600 dark:text-[#7D8590]">
              <Globe size={16} />
              No Connect account created yet. Go to Setup to get started.
            </div>
          )}

          {/* Status card */}
          <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-6 space-y-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#E6E8EB]">Account Details</h3>

            {/* 3-column grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 dark:text-[#7D8590]">Connect Account ID</span>
                <span className="font-mono text-sm text-gray-900 dark:text-[#E6E8EB] break-all">
                  {config?.connect_account_id || '—'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 dark:text-[#7D8590]">Charges Enabled</span>
                <StatusDot enabled={config?.connect_charges_enabled} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 dark:text-[#7D8590]">Payouts Enabled</span>
                <StatusDot enabled={config?.connect_payouts_enabled} />
              </div>
            </div>

            {/* Details submitted + overall status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 dark:text-[#7D8590]">Details Submitted</span>
                <StatusDot enabled={config?.connect_details_submitted} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 dark:text-[#7D8590]">Overall Status</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold w-fit ${connectStatus.bg} ${connectStatus.color}`}>
                  {connectStatus.label}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap pt-2">
              <button
                onClick={syncStatus}
                disabled={statusSyncing}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-[#1F2630] text-gray-700 dark:text-[#E6E8EB] hover:bg-gray-50 dark:hover:bg-[#1F2630] transition-colors disabled:opacity-50"
              >
                <RefreshCw size={14} className={statusSyncing ? 'animate-spin' : ''} />
                Refresh Status
              </button>
              {isActive && (
                <button
                  onClick={openDashboard}
                  disabled={dashLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#222] shadow hover:scale-[1.02] transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
                >
                  <ExternalLink size={14} />
                  {dashLoading ? 'Opening…' : 'Open Stripe Dashboard'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Fee Preview ── */}
      {activeTab === 3 && (
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-[#E6E8EB]">Fee Preview</h3>
          <p className="text-sm text-gray-600 dark:text-[#7D8590]">
            Enter a service amount to see exactly how fees are split.
          </p>

          <div className="flex gap-3 items-center">
            <div className="relative flex-1 max-w-[220px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={previewAmt}
                onChange={e => setPreviewAmt(e.target.value)}
                placeholder="e.g. 100.00"
                className="w-full pl-7 pr-4 py-2.5 rounded-xl text-sm border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]/40"
              />
            </div>
            {feeLoading && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#5FA8D3]" />
            )}
          </div>

          {feeData && <FeeBreakdown data={feeData} />}

          <div className="flex items-start gap-2 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40">
            <Info size={14} className="text-indigo-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              Stripe charges 2.9% + $0.30 per transaction. International cards may incur additional fees.
              Platform fee ({config?.platform_fee_pct ?? 1.5}%) is deducted as an application fee before transfer.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStripe;
