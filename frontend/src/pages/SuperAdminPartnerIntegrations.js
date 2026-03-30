import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, CreditCard, TrendingUp, CheckCircle, XCircle,
  AlertCircle, Building2, RefreshCw, Search, DollarSign,
  Settings, Eye, EyeOff, Save, Send, X, Plus, Zap, Info
} from 'lucide-react';
import { api } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, iconBg, theme }) => {
  const isDark = theme === 'dark';
  return (
    <div className={`p-6 rounded-2xl shadow-sm ${isDark ? 'bg-[#171C22]' : 'bg-white'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${iconBg}`}><Icon size={20} className="text-white" /></div>
        {sub && <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-[#1F2630] text-[#7D8590]' : 'bg-[#F6F7F9] text-[#6B7280]'}`}>{sub}</span>}
      </div>
      <div className={`text-3xl font-bold mb-1 ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{value}</div>
      <div className={`text-sm ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{label}</div>
    </div>
  );
};

const DeliveryBar = ({ rate, theme }) => (
  <div className="flex items-center gap-2">
    <div className={`flex-1 h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
      <div className="h-full rounded-full bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0]" style={{ width: `${rate}%` }} />
    </div>
    <span className={`text-xs font-medium w-10 text-right ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{rate}%</span>
  </div>
);

const planColor = (plan) => {
  const map = {
    pro: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    essential: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    trial: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    custom: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  };
  return map[plan] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
};

const DrawerField = ({ label, value, onChange, placeholder, type = 'text', readOnly, isDark }) => (
  <div>
    <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-[#A9AFB8]' : 'text-[#374151]'}`}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`w-full px-3 py-2 rounded-xl text-sm border
        ${isDark ? 'bg-[#171C22] border-[#1F2630] text-[#E6E8EB] placeholder-[#7D8590]' : 'bg-white border-gray-200 text-[#0E1116] placeholder-gray-400'}
        ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
    />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp config drawer (unchanged logic, rewritten with shared DrawerField)
// ─────────────────────────────────────────────────────────────────────────────
const TRIGGER_LABELS = {
  booking_confirmed: 'Booking Confirmation', booking_reminder: 'Booking Reminder',
  booking_cancelled: 'Booking Cancelled',    booking_completed: 'Service Completed',
  order_confirmed:   'Order Confirmed',       order_ready:       'Order Ready for Pickup',
  order_cancelled:   'Order Cancelled',       payment_receipt:   'Payment Receipt',
};

const WaDrawer = ({ company, theme, onClose, onSaved }) => {
  const isDark = theme === 'dark';
  const [config, setConfig]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testTrigger, setTestTrigger] = useState('booking_confirmed');
  const [testStatus, setTestStatus]   = useState(null);
  const [saveMsg, setSaveMsg]         = useState(null);
  const [form, setForm] = useState({ enabled: false, phone_number_id: '', waba_id: '', access_token: '', display_phone: '' });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getSuperAdminWhatsAppConfig(company.company_id);
        const cfg = res.data;
        setConfig(cfg);
        setForm({ enabled: cfg.enabled, phone_number_id: cfg.phone_number_id || '', waba_id: cfg.waba_id || '', access_token: '', display_phone: cfg.display_phone || '' });
      } finally { setLoading(false); }
    })();
  }, [company.company_id]);

  const save = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      await api.updateSuperAdminWhatsAppConfig(company.company_id, form);
      setSaveMsg({ ok: true, text: 'Saved.' }); onSaved();
    } catch (e) { setSaveMsg({ ok: false, text: e?.response?.data?.detail || 'Save failed.' }); }
    finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!testPhone.trim()) return;
    setTestStatus('sending');
    try { await api.superAdminSendWhatsAppTest(company.company_id, { recipient_phone: testPhone, trigger: testTrigger }); setTestStatus('ok'); }
    catch { setTestStatus('err'); }
  };

  return (
    <DrawerShell title="WhatsApp Configuration" company={company} theme={theme} onClose={onClose}
      icon={<MessageCircle size={18} className="text-green-600 dark:text-green-400" />}
      iconBg="bg-green-100 dark:bg-green-900/30"
      loading={loading} saving={saving} saveMsg={saveMsg} onSave={save}>
      {/* Toggle */}
      <ToggleRow label="WhatsApp Notifications" desc="Enable or disable all WA messages for this company"
        enabled={form.enabled} onChange={() => setForm(f => ({ ...f, enabled: !f.enabled }))} isDark={isDark} />

      <SectionHeader label="API Credentials" isDark={isDark} />
      <DrawerField label="Phone Number ID" value={form.phone_number_id} onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))} placeholder="123456789012345" isDark={isDark} />
      <DrawerField label="WABA ID" value={form.waba_id} onChange={e => setForm(f => ({ ...f, waba_id: e.target.value }))} placeholder="987654321098765" isDark={isDark} />
      <DrawerField label="Display Phone" value={form.display_phone} onChange={e => setForm(f => ({ ...f, display_phone: e.target.value }))} placeholder="+91 98765 43210" isDark={isDark} />
      <div>
        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-[#A9AFB8]' : 'text-[#374151]'}`}>Access Token</label>
        <div className="relative">
          <input type={showToken ? 'text' : 'password'} value={form.access_token}
            onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))}
            placeholder={config?.access_token_masked || 'Enter to update'}
            className={`w-full px-3 py-2 pr-9 rounded-xl text-sm border ${isDark ? 'bg-[#171C22] border-[#1F2630] text-[#E6E8EB] placeholder-[#7D8590]' : 'bg-white border-gray-200 text-[#0E1116] placeholder-gray-400'}`} />
          <button onClick={() => setShowToken(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {config?.access_token_masked && <p className={`text-xs mt-1 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Current: {config.access_token_masked}</p>}
      </div>

      {/* Template summary */}
      {config?.templates?.length > 0 && (
        <>
          <SectionHeader label="Active Templates" isDark={isDark} />
          <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-[#1F2630]' : 'border-gray-200'}`}>
            {config.templates.map((tpl, i) => (
              <div key={tpl.trigger} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i > 0 ? (isDark ? 'border-t border-[#1F2630]' : 'border-t border-gray-100') : ''} ${isDark ? 'bg-[#171C22]' : 'bg-white'}`}>
                <span className={isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}>{TRIGGER_LABELS[tpl.trigger] || tpl.trigger}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tpl.active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{tpl.active ? 'On' : 'Off'}</span>
              </div>
            ))}
          </div>
          <p className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Templates are managed by the customer in their Admin Console.</p>
        </>
      )}

      <SectionHeader label="Send Test Message" isDark={isDark} />
      <input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+91 98765 43210"
        className={`w-full px-3 py-2 rounded-xl text-sm border ${isDark ? 'bg-[#171C22] border-[#1F2630] text-[#E6E8EB] placeholder-[#7D8590]' : 'bg-white border-gray-200 text-[#0E1116] placeholder-gray-400'}`} />
      <div className="flex gap-2">
        <select value={testTrigger} onChange={e => setTestTrigger(e.target.value)}
          className={`flex-1 px-3 py-2 rounded-xl text-sm border ${isDark ? 'bg-[#171C22] border-[#1F2630] text-[#E6E8EB]' : 'bg-white border-gray-200 text-[#0E1116]'}`}>
          {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={sendTest} disabled={testStatus === 'sending' || !testPhone.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#222] shadow disabled:opacity-50 hover:scale-[1.02] transition-all"
          style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}>
          <Send size={14} />{testStatus === 'sending' ? '…' : 'Test'}
        </button>
      </div>
      {testStatus === 'ok'  && <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle size={12} />Dispatched</p>}
      {testStatus === 'err' && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />Failed — check credentials</p>}
    </DrawerShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay config drawer
// ─────────────────────────────────────────────────────────────────────────────
const ACCT_STATUS = {
  draft:                { label: 'Not Submitted',       color: 'text-gray-500' },
  pending_verification: { label: 'Pending Verification', color: 'text-yellow-600 dark:text-yellow-400' },
  active:               { label: 'Active',               color: 'text-green-600 dark:text-green-400' },
  suspended:            { label: 'Suspended',            color: 'text-red-500' },
  rejected:             { label: 'Rejected',             color: 'text-red-500' },
};

const RpDrawer = ({ company, theme, onClose, onSaved }) => {
  const isDark = theme === 'dark';
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [creating, setCreating]   = useState(false);
  const [saveMsg, setSaveMsg]     = useState(null);
  const [form, setForm] = useState({
    enabled: false, platform_fee_pct: 1.75,
    linked_account_name: '', contact_number: '', email: '',
    bank_account_number: '', bank_account_type: 'savings', ifsc_code: '', beneficiary_name: '',
  });
  const [accountId,    setAccountId]    = useState(null);
  const [accountStatus, setAccountStatus] = useState('draft');
  const [pennyStatus,  setPennyStatus]  = useState('pending');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getSuperAdminRazorpayConfig(company.company_id);
        const cfg = res.data;
        setForm({
          enabled:             cfg.enabled,
          platform_fee_pct:    cfg.platform_fee_pct ?? 1.75,
          linked_account_name: cfg.linked_account_name || '',
          contact_number:      cfg.contact_number || '',
          email:               cfg.email || '',
          bank_account_number: cfg.bank_account_number || '',
          bank_account_type:   cfg.bank_account_type || 'savings',
          ifsc_code:           cfg.ifsc_code || '',
          beneficiary_name:    cfg.beneficiary_name || '',
        });
        setAccountId(cfg.razorpay_account_id);
        setAccountStatus(cfg.account_status || 'draft');
        setPennyStatus(cfg.penny_test_status || 'pending');
      } finally { setLoading(false); }
    })();
  }, [company.company_id]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      await api.updateSuperAdminRazorpayConfig(company.company_id, form);
      setSaveMsg({ ok: true, text: 'Saved.' }); onSaved();
    } catch (e) { setSaveMsg({ ok: false, text: e?.response?.data?.detail || 'Save failed.' }); }
    finally { setSaving(false); }
  };

  const createAccount = async () => {
    setCreating(true); setSaveMsg(null);
    try {
      // Save first, then provision
      await api.updateSuperAdminRazorpayConfig(company.company_id, form);
      const res = await api.superAdminCreateRazorpayAccount(company.company_id);
      setAccountId(res.data.account_id);
      setAccountStatus('pending_verification');
      setPennyStatus('initiated');
      setSaveMsg({ ok: true, text: `Linked account created: ${res.data.account_id}` });
      onSaved();
    } catch (e) { setSaveMsg({ ok: false, text: e?.response?.data?.detail || 'Account creation failed.' }); }
    finally { setCreating(false); }
  };

  const acctCfg = ACCT_STATUS[accountStatus] || ACCT_STATUS.draft;

  return (
    <DrawerShell title="Razorpay Route" company={company} theme={theme} onClose={onClose}
      icon={<CreditCard size={18} className="text-indigo-600 dark:text-indigo-400" />}
      iconBg="bg-indigo-100 dark:bg-indigo-900/30"
      loading={loading} saving={saving} saveMsg={saveMsg} onSave={save}
      extraFooter={
        <button onClick={createAccount} disabled={creating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow transition-all hover:scale-[1.02] disabled:opacity-50">
          <Zap size={14} />{creating ? 'Submitting…' : accountId ? 'Re-provision' : 'Create Linked Account'}
        </button>
      }>

      {/* Toggle + account status */}
      <ToggleRow label="Razorpay Enabled" desc="Enable payment routing for this company"
        enabled={form.enabled} onChange={() => setForm(f => ({ ...f, enabled: !f.enabled }))} isDark={isDark} />

      {accountId && (
        <div className={`p-3 rounded-xl space-y-2 ${isDark ? 'bg-[#171C22]' : 'bg-[#F6F7F9]'}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500 dark:text-[#7D8590]">Razorpay Account</div>
              <div className="font-mono text-sm text-gray-900 dark:text-[#E6E8EB]">{accountId}</div>
            </div>
            <span className={`text-xs font-semibold ${acctCfg.color}`}>{acctCfg.label}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-[#7D8590]">Penny Test</span>
            <span className={`text-xs font-semibold capitalize ${
              pennyStatus === 'completed' ? 'text-green-600 dark:text-green-400' :
              pennyStatus === 'initiated' ? 'text-blue-600 dark:text-blue-400' :
              pennyStatus === 'failed'    ? 'text-red-600 dark:text-red-400' :
                                           'text-gray-500 dark:text-[#7D8590]'
            }`}>{pennyStatus}</span>
          </div>
        </div>
      )}

      <SectionHeader label="Platform Fee" isDark={isDark} />
      <div>
        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-[#A9AFB8]' : 'text-[#374151]'}`}>
          Platform Fee % <span className="font-normal text-gray-400">(GST 18% applied on top)</span>
        </label>
        <div className="flex items-center gap-3">
          <input type="number" step="0.01" min="0" max="10"
            value={form.platform_fee_pct}
            onChange={e => setForm(f => ({ ...f, platform_fee_pct: parseFloat(e.target.value) || 0 }))}
            className={`w-28 px-3 py-2 rounded-xl text-sm border ${isDark ? 'bg-[#171C22] border-[#1F2630] text-[#E6E8EB]' : 'bg-white border-gray-200 text-[#0E1116]'}`} />
          <span className={`text-sm ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>% of service amount</span>
        </div>
        <p className={`text-xs mt-1 flex items-center gap-1 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
          <Info size={11} /> Total platform deduction = {form.platform_fee_pct}% + {(form.platform_fee_pct * 0.18).toFixed(3)}% GST = {(form.platform_fee_pct * 1.18).toFixed(3)}%
        </p>
      </div>

      <SectionHeader label="Primary Details" isDark={isDark} />
      <DrawerField label="Linked Account Name *" value={form.linked_account_name} onChange={set('linked_account_name')} placeholder="Business or proprietor name" isDark={isDark} />
      <DrawerField label="Contact Number *" value={form.contact_number} onChange={set('contact_number')} placeholder="+91 98765 43210" type="tel" isDark={isDark} />
      <DrawerField label="Email Address *" value={form.email} onChange={set('email')} placeholder="business@example.com" type="email" isDark={isDark} />

      <SectionHeader label="Bank Details" isDark={isDark} />
      <DrawerField label="Account Number *" value={form.bank_account_number} onChange={set('bank_account_number')} placeholder="0123456789012" isDark={isDark} />
      <div>
        <label className={`block text-xs font-medium mb-1 ${isDark ? 'text-[#A9AFB8]' : 'text-[#374151]'}`}>Account Type</label>
        <select value={form.bank_account_type} onChange={set('bank_account_type')}
          className={`w-full px-3 py-2 rounded-xl text-sm border ${isDark ? 'bg-[#171C22] border-[#1F2630] text-[#E6E8EB]' : 'bg-white border-gray-200 text-[#0E1116]'}`}>
          <option value="savings">Savings</option>
          <option value="current">Current</option>
        </select>
      </div>
      <DrawerField label="IFSC Code *" value={form.ifsc_code} onChange={set('ifsc_code')} placeholder="HDFC0001234" isDark={isDark} />
      <DrawerField label="Beneficiary Name *" value={form.beneficiary_name} onChange={set('beneficiary_name')} placeholder="Name as on bank account" isDark={isDark} />
    </DrawerShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared Drawer shell (title bar + scrollable body + footer)
// ─────────────────────────────────────────────────────────────────────────────
const DrawerShell = ({ title, company, theme, onClose, icon, iconBg, loading, saving, saveMsg, onSave, children, extraFooter }) => {
  const isDark = theme === 'dark';
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className={`fixed inset-y-0 right-0 w-[480px] z-50 flex flex-col shadow-2xl
        ${isDark ? 'bg-[#0B0D10] border-l border-[#1F2630]' : 'bg-white border-l border-[#D9DEE5]'}`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-[#1F2630]' : 'border-[#D9DEE5]'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>{icon}</div>
            <div>
              <div className={`font-semibold text-sm ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{company.company_name}</div>
              <div className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{title}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1F2630]">
            <X size={18} className={isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5FA8D3]" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">{children}</div>
        )}

        <div className={`px-6 py-4 border-t ${isDark ? 'border-[#1F2630]' : 'border-[#D9DEE5]'} flex items-center justify-between`}>
          <div>{saveMsg && <span className={`text-xs ${saveMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{saveMsg.text}</span>}</div>
          <div className="flex items-center gap-2">
            {extraFooter}
            <button onClick={onClose} className={`px-4 py-2 rounded-xl text-sm font-medium ${isDark ? 'text-[#7D8590] hover:bg-[#1F2630]' : 'text-[#6B7280] hover:bg-[#F6F7F9]'}`}>Cancel</button>
            <button onClick={onSave} disabled={saving || loading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-[#222] shadow hover:scale-[1.02] transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}>
              <Save size={14} />{saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const ToggleRow = ({ label, desc, enabled, onChange, isDark }) => (
  <div className={`flex items-center justify-between p-4 rounded-xl ${isDark ? 'bg-[#171C22]' : 'bg-[#F6F7F9]'}`}>
    <div>
      <div className={`text-sm font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{label}</div>
      {desc && <div className={`text-xs mt-0.5 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{desc}</div>}
    </div>
    <button onClick={onChange} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-green-500' : isDark ? 'bg-[#1F2630]' : 'bg-gray-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  </div>
);

const SectionHeader = ({ label, isDark }) => (
  <div className={`text-xs font-semibold uppercase tracking-wider pt-2 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{label}</div>
);

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp company table
// ─────────────────────────────────────────────────────────────────────────────
const WaTab = ({ theme }) => {
  const isDark = theme === 'dark';
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [days, setDays]           = useState(30);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState('');
  const [sortBy, setSortBy]       = useState('messages_sent');
  const [drawer, setDrawer]       = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try { const r = await api.getSuperAdminWhatsAppStats(days); setStats(r.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const rows = (stats?.per_company || [])
    .filter(c => (!search || c.company_name.toLowerCase().includes(search.toLowerCase()))
      && (filter === '' || (filter === 'enabled' ? c.wa_enabled : filter === 'configured' ? c.wa_configured : !c.wa_configured)))
    .sort((a, b) => sortBy === 'messages_sent' ? b.messages_sent - a.messages_sent : sortBy === 'cost' ? b.cost_usd - a.cost_usd : a.company_name.localeCompare(b.company_name));

  return (
    <div className="space-y-4">
      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Building2} label="Companies with WA" value={stats.companies_with_wa ?? 0} sub={`${stats.companies_wa_enabled ?? 0} enabled`} iconBg="bg-[#5FA8D3]" theme={theme} />
          <StatCard icon={MessageCircle} label="Messages Sent" value={(stats.total_messages_sent ?? 0).toLocaleString()} sub={`${days}d`} iconBg="bg-green-500" theme={theme} />
          <StatCard icon={TrendingUp} label="Delivery Rate" value={`${stats.platform_delivery_rate ?? 0}%`} sub={`${stats.total_messages_failed ?? 0} failed`} iconBg="bg-blue-500" theme={theme} />
          <StatCard icon={DollarSign} label="Est. Cost" value={`$${(stats.total_cost_usd ?? 0).toFixed(2)}`} iconBg="bg-amber-500" theme={theme} />
        </div>
      )}

      {/* Table */}
      <CompanyTable
        rows={rows} loading={loading} theme={theme}
        search={search} onSearch={setSearch}
        filter={filter} onFilter={setFilter} filterOptions={[
          { value: '', label: 'All Companies' }, { value: 'enabled', label: 'WA Enabled' },
          { value: 'configured', label: 'WA Configured' }, { value: 'unconfigured', label: 'Not Configured' },
        ]}
        sortBy={sortBy} onSort={setSortBy} sortOptions={[
          { value: 'messages_sent', label: 'Sort: Messages' }, { value: 'cost', label: 'Sort: Cost' },
          { value: 'name', label: 'Sort: Name' },
        ]}
        days={days} onDaysChange={setDays} onRefresh={fetchStats}
        onConfigure={row => setDrawer(row)}
        columns={[
          { key: 'status', label: 'WA Status', render: row => !row.wa_configured
            ? <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-[#1F2630] text-[#7D8590]' : 'bg-gray-100 text-gray-500'}`}>Not Set Up</span>
            : row.wa_enabled
              ? <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold"><CheckCircle size={11}/>Active</span>
              : <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-semibold"><XCircle size={11}/>Disabled</span>
          },
          { key: 'phone', label: 'Phone', render: row => <span className={`text-sm ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{row.display_phone || '—'}</span> },
          { key: 'sent', label: 'Sent', render: row => <span className={`text-sm font-medium ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{row.messages_sent > 0 ? row.messages_sent.toLocaleString() : '—'}</span> },
          { key: 'failed', label: 'Failed', render: row => <span className={`text-sm ${row.messages_failed > 0 ? 'text-red-500' : isDark ? 'text-[#7D8590]' : 'text-gray-400'}`}>{row.messages_failed > 0 ? row.messages_failed.toLocaleString() : '—'}</span> },
          { key: 'delivery', label: 'Delivery', render: row => row.wa_configured ? <DeliveryBar rate={row.delivery_rate} theme={theme} /> : <span className={`text-sm ${isDark ? 'text-[#7D8590]' : 'text-gray-400'}`}>—</span> },
          { key: 'cost', label: 'Cost', render: row => <span className={`text-sm font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{row.cost_usd > 0 ? `$${row.cost_usd.toFixed(2)}` : '—'}</span> },
        ]}
        isConfigured={row => row.wa_configured}
      />

      {drawer && <WaDrawer company={drawer} theme={theme} onClose={() => setDrawer(null)} onSaved={fetchStats} />}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay company table
// ─────────────────────────────────────────────────────────────────────────────
const RP_STATUS_BADGE = {
  draft:                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full text-xs font-semibold">Not Submitted</span>,
  pending_verification: <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-semibold"><AlertCircle size={11}/>Pending</span>,
  active:               <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold"><CheckCircle size={11}/>Active</span>,
  suspended:            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-semibold"><XCircle size={11}/>Suspended</span>,
  rejected:             <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-semibold"><XCircle size={11}/>Rejected</span>,
};

const RpTab = ({ theme }) => {
  const isDark = theme === 'dark';
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [drawer, setDrawer] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try { const r = await api.getSuperAdminRazorpayStats(); setStats(r.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const rows = (stats?.per_company || [])
    .filter(c => (!search || c.company_name.toLowerCase().includes(search.toLowerCase()))
      && (filter === '' || (filter === 'active' ? c.account_status === 'active' : filter === 'configured' ? c.rp_configured : !c.rp_configured)))
    .sort((a, b) => a.company_name.localeCompare(b.company_name));

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={Building2}  label="Total Companies"       value={stats.companies_total ?? 0}      iconBg="bg-[#5FA8D3]" theme={theme} />
          <StatCard icon={CreditCard} label="Razorpay Configured"   value={stats.companies_configured ?? 0} sub={`${stats.companies_active ?? 0} active`} iconBg="bg-indigo-500" theme={theme} />
          <StatCard icon={CheckCircle} label="Linked Accounts Live" value={stats.companies_active ?? 0}     iconBg="bg-green-500" theme={theme} />
        </div>
      )}

      <CompanyTable
        rows={rows} loading={loading} theme={theme}
        search={search} onSearch={setSearch}
        filter={filter} onFilter={setFilter} filterOptions={[
          { value: '', label: 'All Companies' }, { value: 'active', label: 'Active' },
          { value: 'configured', label: 'Configured' }, { value: 'unconfigured', label: 'Not Configured' },
        ]}
        sortBy={sortBy} onSort={setSortBy} sortOptions={[{ value: 'name', label: 'Sort: Name' }]}
        onRefresh={fetchStats}
        onConfigure={row => setDrawer(row)}
        columns={[
          { key: 'status', label: 'Account Status', render: row => RP_STATUS_BADGE[row.account_status] || RP_STATUS_BADGE.draft },
          { key: 'acct_id', label: 'Razorpay Account', render: row => <span className={`font-mono text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{row.razorpay_account_id || '—'}</span> },
          { key: 'name', label: 'Linked Name', render: row => <span className={`text-sm ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{row.linked_account_name || '—'}</span> },
          { key: 'penny', label: 'Penny Test', render: row => {
            const p = row.penny_test_status;
            const cls = p === 'verified' ? 'text-green-600 dark:text-green-400' : p === 'failed' ? 'text-red-500' : 'text-gray-500 dark:text-[#7D8590]';
            return <span className={`text-xs capitalize font-medium ${cls}`}>{p || 'pending'}</span>;
          }},
          { key: 'fee', label: 'Platform Fee', render: row => <span className={`text-sm font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{row.platform_fee_pct ?? 1.75}% + GST</span> },
        ]}
        isConfigured={row => row.rp_configured}
      />

      {drawer && <RpDrawer company={drawer} theme={theme} onClose={() => setDrawer(null)} onSaved={fetchStats} />}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Reusable company table
// ─────────────────────────────────────────────────────────────────────────────
const CompanyTable = ({ rows, loading, theme, search, onSearch, filter, onFilter, filterOptions, sortBy, onSort, sortOptions, days, onDaysChange, onRefresh, columns, onConfigure, isConfigured }) => {
  const isDark = theme === 'dark';
  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm ${isDark ? 'bg-[#171C22]' : 'bg-white'}`}>
      <div className={`p-5 border-b ${isDark ? 'border-[#1F2630]' : 'border-[#D9DEE5]'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className={`text-base font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>All Companies</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDark ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
              <Search size={14} className={isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
              <input type="text" placeholder="Search…" value={search} onChange={e => onSearch(e.target.value)}
                className={`bg-transparent border-none outline-none text-sm w-32 ${isDark ? 'text-[#E6E8EB] placeholder-[#7D8590]' : 'text-[#0E1116] placeholder-[#6B7280]'}`} />
            </div>
            <select value={filter} onChange={e => onFilter(e.target.value)}
              className={`px-3 py-2 rounded-xl text-sm border-none outline-none ${isDark ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'}`}>
              {filterOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {sortOptions && <select value={sortBy} onChange={e => onSort(e.target.value)}
              className={`px-3 py-2 rounded-xl text-sm border-none outline-none ${isDark ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'}`}>
              {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>}
            {days !== undefined && <select value={days} onChange={e => onDaysChange(Number(e.target.value))}
              className={`px-3 py-2 rounded-xl text-sm border-none outline-none ${isDark ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'}`}>
              <option value={7}>7d</option><option value={30}>30d</option><option value={90}>90d</option>
            </select>}
            <button onClick={onRefresh} disabled={loading} className={`p-2 rounded-xl ${isDark ? 'bg-[#1F2630] hover:bg-[#252D38]' : 'bg-[#F6F7F9] hover:bg-[#ECEFF3]'}`}>
              <RefreshCw size={16} className={`${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-36">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#5FA8D3]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center">
          <Building2 size={32} className={`mx-auto mb-3 opacity-30 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`} />
          <p className={isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}>No companies match your filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={isDark ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}>
              <tr>
                {['Company', 'Plan', ...columns.map(c => c.label), ''].map(h => (
                  <th key={h} className={`px-5 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-[#1F2630]' : 'divide-[#D9DEE5]'}`}>
              {rows.map(row => (
                <tr key={row.company_id} className={`transition-colors ${isDark ? 'hover:bg-[#1F2630]/50' : 'hover:bg-[#F6F7F9]'}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
                        <Building2 size={15} className="text-[#5FA8D3]" />
                      </div>
                      <span className={`font-medium text-sm ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{row.company_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${planColor(row.company_plan)}`}>{row.company_plan}</span>
                  </td>
                  {columns.map(col => (
                    <td key={col.key} className="px-5 py-4">{col.render(row)}</td>
                  ))}
                  <td className="px-5 py-4">
                    <button onClick={() => onConfigure(row)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] ${
                        isConfigured(row)
                          ? `border ${isDark ? 'border-[#1F2630] text-[#E6E8EB] hover:bg-[#1F2630]' : 'border-gray-200 text-[#0E1116] hover:bg-[#F6F7F9]'}`
                          : 'text-white'
                      }`}
                      style={!isConfigured(row) ? { background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' } : {}}>
                      {isConfigured(row) ? <><Settings size={12}/> Configure</> : <><Plus size={12}/> Set Up</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
const SuperAdminPartnerIntegrations = ({ theme = 'light' }) => {
  const [activeService, setActiveService] = useState('whatsapp');
  const isDark = theme === 'dark';

  const services = [
    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'razorpay', label: 'Razorpay Route', icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0]">
          <Settings size={24} className="text-white" />
        </div>
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>Partner Integrations</h1>
          <p className={`text-sm ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
            Configure and monitor integrations across all customer accounts
          </p>
        </div>
      </div>

      {/* Service tabs */}
      <div className={`flex gap-1 p-1 rounded-xl w-fit ${isDark ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
        {services.map(s => {
          const Icon = s.icon;
          return (
            <button key={s.id} onClick={() => setActiveService(s.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeService === s.id
                  ? `${isDark ? 'bg-[#0B0D10] text-[#E6E8EB]' : 'bg-white text-[#0E1116]'} shadow-sm`
                  : `${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`
              }`}>
              <Icon size={16} />{s.label}
            </button>
          );
        })}
      </div>

      {activeService === 'whatsapp' && <WaTab theme={theme} />}
      {activeService === 'razorpay' && <RpTab theme={theme} />}
    </div>
  );
};

export default SuperAdminPartnerIntegrations;
