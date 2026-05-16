import React, { useState, useEffect } from 'react';
import { Save, Plus, X, RefreshCw, AlertCircle, Landmark, Receipt } from 'lucide-react';
import { booksApi } from '../../services/booksApi';

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [taxCodes, setTaxCodes] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);
  const [showAddTax, setShowAddTax] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [settingsRes, taxRes, bankRes] = await Promise.all([
        booksApi.getSettings(),
        booksApi.getTaxCodes().catch(() => ({ data: [] })),
        booksApi.getBankAccounts().catch(() => ({ data: [] })),
      ]);
      const s = settingsRes.data;
      setSettings(s);
      if (s?.activated) {
        setForm({
          fiscal_year_start_month: s.fiscal_year_start_month ?? 4,
          gstin: s.gstin ?? '',
          pan: s.pan ?? '',
          tax_scheme: s.tax_scheme ?? 'GST',
          auto_post_bookings: s.auto_post_bookings ?? true,
          auto_post_memberships: s.auto_post_memberships ?? true,
          auto_post_marketplace: s.auto_post_marketplace ?? true,
          auto_post_inventory: s.auto_post_inventory ?? true,
        });
      }
      setTaxCodes(taxRes.data || []);
      setBankAccounts(bankRes.data || []);
    } catch (e) {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await booksApi.updateSettings(form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20";
  const Field = ({ label, children }) => (
    <div><label className="text-xs text-foreground/50 block mb-1">{label}</label>{children}</div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={20} className="animate-spin text-foreground/40" />
    </div>
  );

  if (!settings?.activated) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
      <p className="text-sm text-foreground/50">Activate Books from the Dashboard tab to configure settings.</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
          <AlertCircle size={14} /> {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-600 dark:text-green-400 text-sm">
          Settings saved.
        </div>
      )}

      {/* Company Tax Info */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <Receipt size={15} /> Tax & Compliance
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="GSTIN">
            <input className={inputClass} value={form.gstin || ''} placeholder="22AAAAA0000A1Z5"
              onChange={e => setForm(f => ({ ...f, gstin: e.target.value }))} />
          </Field>
          <Field label="PAN">
            <input className={inputClass} value={form.pan || ''} placeholder="AAAAA0000A"
              onChange={e => setForm(f => ({ ...f, pan: e.target.value }))} />
          </Field>
          <Field label="Tax Scheme">
            <select className={inputClass} value={form.tax_scheme || 'GST'}
              onChange={e => setForm(f => ({ ...f, tax_scheme: e.target.value }))}>
              <option value="GST">GST (India)</option>
              <option value="VAT">VAT</option>
              <option value="none">None</option>
            </select>
          </Field>
          <Field label="Financial Year Start Month">
            <select className={inputClass} value={form.fiscal_year_start_month || 4}
              onChange={e => setForm(f => ({ ...f, fiscal_year_start_month: parseInt(e.target.value) }))}>
              {[['April (India)', 4], ['January', 1], ['July', 7], ['October', 10]].map(([label, val]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* Auto-Posting Toggles */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold text-foreground text-sm">Auto-Posting</h3>
        <p className="text-xs text-foreground/50">When enabled, financial events from these modules automatically create journal entries in your ledger.</p>
        {[
          ['auto_post_bookings', 'Bookings', 'Posts when a booking is marked Completed'],
          ['auto_post_memberships', 'Memberships', 'Posts on enrollment and renewal'],
          ['auto_post_marketplace', 'Marketplace', 'Posts on agent tier billing'],
          ['auto_post_inventory', 'Inventory', 'Posts on stock purchases and COGS'],
        ].map(([key, label, desc]) => (
          <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-foreground/40">{desc}</p>
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
              className={`w-10 h-5 rounded-full relative transition-all ${form[key] ? 'bg-foreground' : 'bg-border'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-background shadow transition-all ${form[key] ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </section>

      {/* Tax Codes */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Tax Codes</h3>
          <button onClick={() => setShowAddTax(true)}
            className="flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground border border-border px-3 py-1.5 rounded-lg bg-background transition-all">
            <Plus size={12} /> Add
          </button>
        </div>
        <div className="space-y-1">
          {taxCodes.map(tc => (
            <div key={tc.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono bg-background border border-border px-2 py-0.5 rounded">{tc.code}</span>
                <span className="text-sm text-foreground">{tc.name}</span>
                {tc.is_system && <span className="text-xs text-foreground/30">system</span>}
              </div>
              <span className="text-sm font-mono text-foreground/60">{tc.rate}%</span>
            </div>
          ))}
        </div>
      </section>

      {/* Bank Accounts */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Landmark size={15} /> Bank Accounts
          </h3>
          <button onClick={() => setShowAddBank(true)}
            className="flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground border border-border px-3 py-1.5 rounded-lg bg-background transition-all">
            <Plus size={12} /> Add
          </button>
        </div>
        {bankAccounts.length === 0 && (
          <p className="text-sm text-foreground/40">No bank accounts added yet.</p>
        )}
        {bankAccounts.map(ba => (
          <div key={ba.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
            <div>
              <p className="text-sm font-medium text-foreground">{ba.account_name}</p>
              <p className="text-xs text-foreground/40">{ba.bank_name || ba.account_type} {ba.account_number_last4 ? `••••${ba.account_number_last4}` : ''}</p>
            </div>
            <span className="text-sm font-mono text-foreground">₹{(ba.current_balance || 0).toLocaleString('en-IN')}</span>
          </div>
        ))}
      </section>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-all disabled:opacity-50">
          <Save size={15} /> {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {showAddBank && (
        <AddBankModal
          onClose={() => setShowAddBank(false)}
          onSaved={() => { setShowAddBank(false); load(); }}
        />
      )}
      {showAddTax && (
        <AddTaxModal
          onClose={() => setShowAddTax(false)}
          onSaved={() => { setShowAddTax(false); load(); }}
        />
      )}
    </div>
  );
};

const AddBankModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ account_name: '', account_type: 'bank', bank_name: '', account_number_last4: '', opening_balance: 0 });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await booksApi.createBankAccount(form);
      onSaved();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Add Bank Account</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/20 transition-all">
            <X size={16} className="text-foreground/60" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {[
            ['Account Name', 'account_name', 'text', 'e.g. HDFC Current Account'],
            ['Bank Name', 'bank_name', 'text', 'e.g. HDFC Bank'],
            ['Last 4 Digits', 'account_number_last4', 'text', '1234'],
            ['Opening Balance (₹)', 'opening_balance', 'number', '0'],
          ].map(([label, key, type, placeholder]) => (
            <div key={key}>
              <label className="text-xs text-foreground/50 block mb-1">{label}</label>
              <input type={type} className={inputClass} value={form[key]} placeholder={placeholder}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="text-xs text-foreground/50 block mb-1">Type</label>
            <select className={inputClass} value={form.account_type}
              onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="wallet">Wallet</option>
              <option value="credit_card">Credit Card</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-foreground/60 hover:text-foreground transition-all">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.account_name}
            className="px-5 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-all disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AddTaxModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', code: '', rate: '', tax_type: 'gst', component_cgst: '', component_sgst: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await booksApi.createTaxCode(form);
      onSaved();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Add Tax Code</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/20 transition-all">
            <X size={16} className="text-foreground/60" />
          </button>
        </div>
        <div className="p-6 space-y-3">
          {[
            ['Code', 'code', 'GST28'],
            ['Name', 'name', 'GST 28%'],
            ['Rate (%)', 'rate', '28'],
          ].map(([label, key, placeholder]) => (
            <div key={key}>
              <label className="text-xs text-foreground/50 block mb-1">{label}</label>
              <input type="text" className={inputClass} value={form[key]} placeholder={placeholder}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-foreground/60 hover:text-foreground transition-all">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.code || !form.name}
            className="px-5 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-all disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Tax Code'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
