import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, ChevronRight, ChevronLeft, Save, CheckCircle,
  AlertCircle, Clock, ExternalLink, RefreshCw, Zap, Info
} from 'lucide-react';
import { api } from '../../services/api';

// ── Status helpers ────────────────────────────────────────────────────────
const ACCOUNT_STATUS = {
  draft:                { label: 'Not Submitted',       color: 'text-gray-500',                          bg: 'bg-gray-100 dark:bg-gray-800' },
  pending_verification: { label: 'Pending Verification', color: 'text-yellow-600 dark:text-yellow-400',  bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  active:               { label: 'Active',               color: 'text-green-600 dark:text-green-400',    bg: 'bg-green-100 dark:bg-green-900/30' },
  suspended:            { label: 'Suspended',            color: 'text-red-600 dark:text-red-400',        bg: 'bg-red-100 dark:bg-red-900/30' },
  rejected:             { label: 'Rejected',             color: 'text-red-600 dark:text-red-400',        bg: 'bg-red-100 dark:bg-red-900/30' },
};

const PENNY_STATUS = {
  pending:   { label: 'Not Initiated', icon: Clock,         color: 'text-gray-500' },
  initiated: { label: 'Initiated',     icon: Clock,         color: 'text-yellow-600 dark:text-yellow-400' },
  verified:  { label: 'Verified',      icon: CheckCircle,   color: 'text-green-600 dark:text-green-400' },
  failed:    { label: 'Failed',        icon: AlertCircle,   color: 'text-red-500' },
};

const FieldGroup = ({ label, required, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-[#A9AFB8] mb-1.5">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
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

// ── Fee breakdown display ─────────────────────────────────────────────────
const FeeBreakdown = ({ amount, platformFeePct }) => {
  if (!amount || isNaN(amount)) return null;

  const n           = parseFloat(amount);
  const platformFee = parseFloat((n * platformFeePct / 100).toFixed(2));
  const platformGst = parseFloat((platformFee * 0.18).toFixed(2));
  const pgFeeEst    = parseFloat((n * 0.02).toFixed(2));
  const transferEst = parseFloat(((n - platformFee - platformGst) * 0.0025).toFixed(2));
  const merchant    = parseFloat((n - platformFee - platformGst).toFixed(2));

  const rows = [
    { label: 'Service amount',           value: n,            note: '' },
    { label: `Platform fee (${platformFeePct}%)`, value: -platformFee, note: '' },
    { label: 'GST on platform fee (18%)', value: -platformGst, note: '' },
    { label: 'Merchant receives',        value: merchant,     bold: true },
    { label: `PG fee ~2% (Razorpay)`,   value: -pgFeeEst,    note: 'deducted from settlement', dim: true },
    { label: 'Transfer fee ~0.25%',      value: -transferEst, note: 'deducted by Razorpay', dim: true },
  ];

  return (
    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 text-sm space-y-2">
      <div className="text-xs font-semibold text-gray-500 dark:text-[#7D8590] uppercase tracking-wider mb-3">
        Fee Breakdown
      </div>
      {rows.map(r => (
        <div key={r.label} className={`flex items-center justify-between ${r.dim ? 'opacity-50' : ''}`}>
          <span className={`${r.dim ? 'italic' : ''} text-gray-600 dark:text-[#A9AFB8]`}>
            {r.label}
            {r.note && <span className="text-xs ml-1 text-gray-400">({r.note})</span>}
          </span>
          <span className={`font-mono font-medium ${
            r.bold ? 'text-green-600 dark:text-green-400' :
            r.value < 0 ? 'text-red-500' : 'text-gray-900 dark:text-[#E6E8EB]'
          }`}>
            ₹{Math.abs(r.value).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────
const AdminRazorpay = ({ onBack }) => {
  const [config, setConfig]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [creating, setCreating]   = useState(false);
  const [step, setStep]           = useState(1);   // 1 = primary, 2 = bank, 3 = status
  const [saveMsg, setSaveMsg]     = useState(null);
  const [previewAmt, setPreviewAmt] = useState('');

  const [form, setForm] = useState({
    enabled: false,
    linked_account_name: '',
    contact_number: '',
    email: '',
    bank_account_number: '',
    bank_account_type: 'savings',
    ifsc_code: '',
    beneficiary_name: '',
  });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.getRazorpayConfig();
      const cfg = res.data;
      setConfig(cfg);
      setForm({
        enabled:              cfg.enabled || false,
        linked_account_name:  cfg.linked_account_name || '',
        contact_number:       cfg.contact_number || '',
        email:                cfg.email || '',
        bank_account_number:  cfg.bank_account_number || '',
        bank_account_type:    cfg.bank_account_type || 'savings',
        ifsc_code:            cfg.ifsc_code || '',
        beneficiary_name:     cfg.beneficiary_name || '',
      });
      // Jump to status step if account already created
      if (cfg.razorpay_account_id) setStep(3);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await api.updateRazorpayConfig(form);
      setSaveMsg({ ok: true, text: 'Saved successfully.' });
      await fetchConfig();
    } catch (e) {
      setSaveMsg({ ok: false, text: e?.response?.data?.detail || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const createAccount = async () => {
    setCreating(true);
    setSaveMsg(null);
    try {
      await api.createRazorpayAccount();
      setSaveMsg({ ok: true, text: 'Linked account submitted to Razorpay.' });
      await fetchConfig();
      setStep(3);
    } catch (e) {
      setSaveMsg({ ok: false, text: e?.response?.data?.detail || 'Account creation failed.' });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5FA8D3]" />
      </div>
    );
  }

  const acctStatus  = ACCOUNT_STATUS[config?.account_status || 'draft'];
  const pennyStatus = PENNY_STATUS[config?.penny_test_status || 'pending'];
  const PennyIcon   = pennyStatus.icon;

  const steps = [
    { id: 1, label: 'Primary Details' },
    { id: 2, label: 'Bank Details' },
    { id: 3, label: 'Status & Activation' },
  ];

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
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">Razorpay Route</h2>
          <p className="text-sm text-gray-600 dark:text-[#7D8590]">
            Collect payments and auto-split to your linked bank account
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <button
              onClick={() => setStep(s.id)}
              className="flex items-center gap-2"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s.id
                  ? 'bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] text-white shadow-md'
                  : step > s.id
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 dark:bg-[#1F2630] text-gray-500 dark:text-[#7D8590]'
              }`}>
                {step > s.id ? <CheckCircle size={14} /> : s.id}
              </div>
              <span className={`text-sm font-medium ${
                step === s.id ? 'text-[#5FA8D3]' : 'text-gray-500 dark:text-[#7D8590]'
              }`}>
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${step > s.id ? 'bg-green-400' : 'bg-gray-200 dark:bg-[#1F2630]'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step 1: Primary Details ── */}
      {step === 1 && (
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-[#E6E8EB]">Primary Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup label="Linked Account Name" required>
              <TextInput
                value={form.linked_account_name}
                onChange={set('linked_account_name')}
                placeholder="Business or proprietor name"
              />
            </FieldGroup>
            <FieldGroup label="Contact Number" required>
              <TextInput
                value={form.contact_number}
                onChange={set('contact_number')}
                placeholder="+91 98765 43210"
                type="tel"
              />
            </FieldGroup>
            <FieldGroup label="Email Address" required>
              <TextInput
                value={form.email}
                onChange={set('email')}
                placeholder="business@example.com"
                type="email"
              />
              <p className="text-xs text-gray-500 dark:text-[#7D8590] mt-1">
                Used for Razorpay dashboard access
              </p>
            </FieldGroup>
          </div>
          <div className="flex items-center justify-between pt-2">
            {saveMsg && (
              <span className={`text-sm ${saveMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {saveMsg.text}
              </span>
            )}
            <div className="flex gap-3 ml-auto">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#222] shadow hover:scale-[1.02] transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
              >
                <Save size={15} />{saving ? 'Saving…' : 'Save & Continue'}
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-[#1F2630] text-gray-700 dark:text-[#E6E8EB] hover:bg-gray-50 dark:hover:bg-[#1F2630] transition-colors"
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Bank Details ── */}
      {step === 2 && (
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-[#E6E8EB]">Bank Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldGroup label="Account Number" required>
              <TextInput
                value={form.bank_account_number}
                onChange={set('bank_account_number')}
                placeholder="e.g. 0123456789012"
              />
            </FieldGroup>
            <FieldGroup label="Account Type" required>
              <select
                value={form.bank_account_type}
                onChange={set('bank_account_type')}
                className="w-full px-4 py-2.5 rounded-xl text-sm border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB]"
              >
                <option value="savings">Savings</option>
                <option value="current">Current</option>
              </select>
            </FieldGroup>
            <FieldGroup label="IFSC Code" required>
              <TextInput
                value={form.ifsc_code}
                onChange={set('ifsc_code')}
                placeholder="e.g. HDFC0001234"
              />
            </FieldGroup>
            <FieldGroup label="Beneficiary Name" required>
              <TextInput
                value={form.beneficiary_name}
                onChange={set('beneficiary_name')}
                placeholder="Name as on bank account"
              />
            </FieldGroup>
          </div>

          {/* Platform fee (read-only) */}
          <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-indigo-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Platform Fees</div>
                <div className="text-sm text-indigo-600 dark:text-indigo-400 mt-0.5">
                  Platform fee: <strong>{config?.platform_fee_pct ?? 1.75}%</strong> + GST (18%) — configured by your service provider
                </div>
              </div>
            </div>
          </div>

          {/* Fee preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#A9AFB8] mb-1.5">
              Fee Preview
            </label>
            <div className="flex gap-3 items-center mb-3">
              <div className="relative flex-1 max-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                <input
                  type="number"
                  value={previewAmt}
                  onChange={e => setPreviewAmt(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full pl-7 pr-4 py-2.5 rounded-xl text-sm border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB]"
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-[#7D8590]">Enter a service amount to see the breakdown</span>
            </div>
            <FeeBreakdown amount={previewAmt} platformFeePct={config?.platform_fee_pct ?? 1.75} />
          </div>

          <div className="flex items-center justify-between pt-2">
            {saveMsg && (
              <span className={`text-sm ${saveMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {saveMsg.text}
              </span>
            )}
            <div className="flex gap-3 ml-auto">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-[#1F2630] text-gray-700 dark:text-[#E6E8EB] hover:bg-gray-50 dark:hover:bg-[#1F2630] transition-colors"
              >
                <ChevronLeft size={15} /> Back
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#222] shadow hover:scale-[1.02] transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
              >
                <Save size={15} />{saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={createAccount}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                <Zap size={15} />{creating ? 'Submitting…' : 'Submit to Razorpay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Status ── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Account status card */}
          <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#E6E8EB] mb-4">Account Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 dark:text-[#7D8590]">Razorpay Account ID</span>
                <span className="font-mono text-sm text-gray-900 dark:text-[#E6E8EB]">
                  {config?.razorpay_account_id || '—'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 dark:text-[#7D8590]">Account Status</span>
                <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${acctStatus.color}`}>
                  <span className={`w-2 h-2 rounded-full ${acctStatus.bg.replace('bg-', 'bg-').split(' ')[0]}`} />
                  {acctStatus.label}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-gray-500 dark:text-[#7D8590]">Penny Test</span>
                <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${pennyStatus.color}`}>
                  <PennyIcon size={14} />
                  {pennyStatus.label}
                </span>
              </div>
            </div>

            {config?.account_status === 'pending_verification' && (
              <div className="mt-4 flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Your linked account is under review. Razorpay will verify your bank details via a penny test (small deposit + deduction). This typically takes 1–2 business days.
                </p>
              </div>
            )}
            {config?.account_status === 'active' && (
              <div className="mt-4 flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <CheckCircle size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your linked account is active. Payment routing is live — customers can now pay and funds will be transferred automatically.
                </p>
              </div>
            )}
          </div>

          {/* Connected account summary */}
          <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-[#E6E8EB]">Account Summary</h3>
              <button onClick={() => setStep(1)} className="text-sm text-[#5FA8D3] hover:underline flex items-center gap-1">
                Edit details <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Name', config?.linked_account_name],
                ['Email', config?.email],
                ['Contact', config?.contact_number],
                ['Bank Account', config?.bank_account_number || '—'],
                ['IFSC', config?.ifsc_code],
                ['Beneficiary', config?.beneficiary_name],
                ['Account Type', config?.bank_account_type],
                ['Platform Fee', `${config?.platform_fee_pct ?? 1.75}% + 18% GST`],
              ].map(([label, val]) => (
                <div key={label}>
                  <span className="text-gray-500 dark:text-[#7D8590]">{label}: </span>
                  <span className="font-medium text-gray-900 dark:text-[#E6E8EB]">{val || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchConfig}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 dark:border-[#1F2630] text-gray-700 dark:text-[#E6E8EB] hover:bg-gray-50 dark:hover:bg-[#1F2630] transition-colors"
            >
              <RefreshCw size={14} /> Refresh Status
            </button>
            <a
              href="https://dashboard.razorpay.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            >
              <ExternalLink size={14} /> Razorpay Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRazorpay;
