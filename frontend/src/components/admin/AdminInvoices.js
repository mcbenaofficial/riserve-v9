import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  FileText, Save, AlertCircle, CheckCircle, Hash, Percent,
  Building2, Mail, Globe, Phone, MapPin, CreditCard, RefreshCw,
  ToggleLeft, ToggleRight, Info, Eye, Settings, Palette, ShoppingBag
} from 'lucide-react';

const PAYMENT_TERMS_OPTIONS = [
  { value: 'due_on_receipt', label: 'Due on Receipt' },
  { value: 'net_7', label: 'Net 7 (7 days)' },
  { value: 'net_15', label: 'Net 15 (15 days)' },
  { value: 'net_30', label: 'Net 30 (30 days)' },
  { value: 'net_45', label: 'Net 45 (45 days)' },
  { value: 'net_60', label: 'Net 60 (60 days)' },
];

const CURRENCY_OPTIONS = [
  { value: 'INR', symbol: '₹', label: 'INR – Indian Rupee' },
  { value: 'USD', symbol: '$', label: 'USD – US Dollar' },
  { value: 'GBP', symbol: '£', label: 'GBP – British Pound' },
  { value: 'EUR', symbol: '€', label: 'EUR – Euro' },
  { value: 'AED', symbol: 'د.إ', label: 'AED – UAE Dirham' },
  { value: 'SGD', symbol: 'S$', label: 'SGD – Singapore Dollar' },
];

const inputCls = `w-full px-4 py-3 bg-[#F6F7F9] dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630]
  rounded-xl text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:outline-none focus:border-[#5FA8D3]
  placeholder-[#9CA3AF] transition-colors`;

const labelCls = 'block text-sm font-medium text-[#4B5563] dark:text-[#7D8590] mb-1.5';

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] p-6 mb-4">
      <div className="flex items-center gap-2 mb-5">
        <Icon size={18} className="text-[#5FA8D3]" />
        <h3 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB]">{label}</p>
        {description && (
          <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-0.5">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="flex-shrink-0 mt-0.5"
        type="button"
      >
        {checked
          ? <ToggleRight size={28} className="text-[#5FA8D3]" />
          : <ToggleLeft size={28} className="text-[#9CA3AF]" />}
      </button>
    </div>
  );
}

// ─── Live Invoice Preview ──────────────────────────────────────────────────────

function InvoicePreview({ settings }) {
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 30);
  const fmt = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const companyName = settings.invoice_company_name || 'Your Company Name';
  const address = settings.invoice_company_address || '123 Business Street, City, State';
  const email = settings.invoice_company_email || 'billing@yourcompany.com';
  const phone = settings.invoice_company_phone || '';
  const website = settings.invoice_company_website || '';
  const gstin = settings.invoice_company_gstin || '';
  const sym = settings.currency_symbol || '₹';
  const taxLabel = settings.tax_name || 'GST';
  const taxRate = parseFloat(settings.default_tax_rate || 0);
  const brandColor = settings.brand_color || '#5FA8D3';
  const invNum = `${settings.prefix || 'INV'}-${String(settings.next_number || 1).padStart(4, '0')}`;
  const notes = settings.default_notes || 'Thank you for your business!';
  const footer = settings.default_footer || '';

  const sampleItems = [
    { description: 'Consultation Service', quantity: 1, unit_price: 5000, tax_rate: taxRate },
    { description: 'Premium Support Package', quantity: 2, unit_price: 1500, tax_rate: taxRate },
  ];
  const subtotal = sampleItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const taxAmount = sampleItems.reduce((s, i) => s + (i.quantity * i.unit_price * i.tax_rate / 100), 0);
  const total = subtotal + taxAmount;

  return (
    <div className="bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Eye size={15} className="text-[#5FA8D3]" />
        <p className="text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase tracking-wider">
          Live Preview — updates as you edit settings
        </p>
      </div>

      {/* Paper */}
      <div className="bg-white rounded-xl shadow-lg mx-auto max-w-2xl overflow-hidden" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        {/* Brand color bar */}
        <div style={{ height: 6, background: brandColor }} />

        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="text-xl font-bold text-gray-900 mb-1">{companyName}</div>
              <div className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">{address}</div>
              {email && <div className="text-xs text-gray-500 mt-0.5">{email}</div>}
              {phone && <div className="text-xs text-gray-500">{phone}</div>}
              {website && <div className="text-xs text-gray-500">{website}</div>}
              {gstin && <div className="text-xs text-gray-500 mt-1 font-medium">GSTIN: {gstin}</div>}
            </div>
            <div className="text-right">
              <div className="text-3xl font-light mb-1" style={{ color: brandColor }}>INVOICE</div>
              <div className="text-sm font-bold text-gray-800">{invNum}</div>
              <div className="text-xs text-gray-500 mt-1">Issue Date: {fmt(today)}</div>
              <div className="text-xs text-gray-500">Due Date: {fmt(dueDate)}</div>
              <div className="mt-2 inline-block px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: brandColor + '20', color: brandColor }}>
                Draft
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className="mb-6 p-4 rounded-lg" style={{ background: '#f9fafb' }}>
            <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2">Bill To</div>
            <div className="text-sm font-semibold text-gray-800">Rajesh Kumar</div>
            <div className="text-xs text-gray-500">rajesh@example.com</div>
            <div className="text-xs text-gray-500">+91 98765 43210</div>
          </div>

          {/* Line Items */}
          <table className="w-full mb-4 text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${brandColor}` }}>
                <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">Qty</th>
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Unit Price</th>
                {taxRate > 0 && <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-16">{taxLabel} %</th>}
                <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sampleItems.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td className="py-2.5 text-gray-700">{item.description}</td>
                  <td className="py-2.5 text-right text-gray-600">{item.quantity}</td>
                  <td className="py-2.5 text-right text-gray-600">{sym}{item.unit_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  {taxRate > 0 && <td className="py-2.5 text-right text-gray-600">{item.tax_rate}%</td>}
                  <td className="py-2.5 text-right font-medium text-gray-800">{sym}{(item.quantity * item.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-56">
              <div className="flex justify-between text-sm text-gray-500 py-1">
                <span>Subtotal</span>
                <span>{sym}{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {settings.show_tax_breakdown && taxAmount > 0 && (
                <div className="flex justify-between text-sm text-gray-500 py-1">
                  <span>{taxLabel} ({taxRate}%)</span>
                  <span>{sym}{taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-gray-900 py-2 mt-1" style={{ borderTop: `2px solid ${brandColor}` }}>
                <span>Total</span>
                <span style={{ color: brandColor }}>{sym}{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500 py-1">
                <span className="font-medium">Balance Due</span>
                <span className="font-bold text-gray-800">{sym}{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {notes && (
            <div className="p-4 rounded-lg mb-3" style={{ background: brandColor + '10', borderLeft: `3px solid ${brandColor}` }}>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</div>
              <div className="text-xs text-gray-600">{notes}</div>
            </div>
          )}

          {/* Footer */}
          {footer && (
            <div className="text-xs text-gray-400 text-center pt-4" style={{ borderTop: '1px solid #f0f0f0' }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

const AdminInvoices = () => {
  const [activeTab, setActiveTab] = useState('config');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.getInvoiceSettings();
      setSettings(res.data);
    } catch (err) {
      setError('Failed to load invoice settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleCurrencyChange = (value) => {
    const opt = CURRENCY_OPTIONS.find(c => c.value === value);
    setSettings(prev => ({
      ...prev,
      currency: value,
      currency_symbol: opt?.symbol || prev.currency_symbol,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.updateInvoiceSettings(settings);
      setSuccess('Invoice settings saved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const previewInvoiceNumber = settings
    ? `${settings.prefix}-${String(settings.next_number).padStart(4, '0')}`
    : 'INV-0001';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={20} className="animate-spin text-[#5FA8D3]" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Invoice Configuration</h2>
          <p className="text-sm text-[#6B7280] dark:text-[#7D8590] mt-0.5">
            Configure how invoices look and behave across your company
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0] text-[#222] font-semibold rounded-xl shadow hover:opacity-90 transition-opacity disabled:opacity-60 text-sm"
        >
          <Save size={16} />
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] w-fit">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'config'
              ? 'bg-white dark:bg-[#1F2630] text-[#0E1116] dark:text-[#E6E8EB] shadow-sm'
              : 'text-[#6B7280] dark:text-[#7D8590] hover:text-[#0E1116] dark:hover:text-[#E6E8EB]'
          }`}
        >
          <Settings size={14} /> Configuration
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'preview'
              ? 'bg-white dark:bg-[#1F2630] text-[#0E1116] dark:text-[#E6E8EB] shadow-sm'
              : 'text-[#6B7280] dark:text-[#7D8590] hover:text-[#0E1116] dark:hover:text-[#E6E8EB]'
          }`}
        >
          <Eye size={14} /> Invoice Preview
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {activeTab === 'preview' ? (
        <InvoicePreview settings={settings} />
      ) : (
        <>
          {/* Numbering */}
          <SectionCard title="Invoice Numbering" icon={Hash}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Prefix</label>
                <input
                  type="text"
                  value={settings.prefix}
                  onChange={e => handleChange('prefix', e.target.value.toUpperCase())}
                  maxLength={10}
                  placeholder="INV"
                  className={inputCls}
                />
                <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-1">e.g. INV, BILL, REC</p>
              </div>
              <div>
                <label className={labelCls}>Starting Number</label>
                <input
                  type="number"
                  min={1}
                  value={settings.next_number}
                  onChange={e => handleChange('next_number', parseInt(e.target.value) || 1)}
                  className={inputCls}
                />
                <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-1">
                  Next invoice: <span className="font-semibold text-[#5FA8D3]">{previewInvoiceNumber}</span>
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Branding */}
          <SectionCard title="Branding" icon={Palette}>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <label className={labelCls}>Brand / Accent Color</label>
                <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mb-3">
                  Used for the invoice header bar, totals highlight, and section accents
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.brand_color || '#5FA8D3'}
                    onChange={e => handleChange('brand_color', e.target.value)}
                    className="w-12 h-12 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] cursor-pointer bg-transparent p-1"
                  />
                  <input
                    type="text"
                    value={settings.brand_color || '#5FA8D3'}
                    onChange={e => handleChange('brand_color', e.target.value)}
                    maxLength={7}
                    placeholder="#5FA8D3"
                    className={`${inputCls} flex-1`}
                  />
                </div>
              </div>
              <div className="flex-shrink-0">
                <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mb-2">Preview</p>
                <div className="w-32 h-20 rounded-xl overflow-hidden shadow border border-[#D9DEE5] dark:border-[#1F2630]">
                  <div style={{ height: 6, background: settings.brand_color || '#5FA8D3' }} />
                  <div className="p-2 bg-white">
                    <div className="text-xs font-bold text-gray-800 mb-1" style={{ color: settings.brand_color || '#5FA8D3' }}>INVOICE</div>
                    <div className="h-1.5 rounded bg-gray-100 mb-1 w-3/4" />
                    <div className="h-1.5 rounded bg-gray-100 mb-1 w-1/2" />
                    <div className="h-1.5 rounded w-2/3" style={{ background: (settings.brand_color || '#5FA8D3') + '40' }} />
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Currency & Tax */}
          <SectionCard title="Currency & Tax" icon={Percent}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelCls}>Currency</label>
                <select
                  value={settings.currency}
                  onChange={e => handleCurrencyChange(e.target.value)}
                  className={inputCls}
                >
                  {CURRENCY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Currency Symbol</label>
                <input
                  type="text"
                  value={settings.currency_symbol}
                  onChange={e => handleChange('currency_symbol', e.target.value)}
                  maxLength={5}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Tax Label</label>
                <input
                  type="text"
                  value={settings.tax_name}
                  onChange={e => handleChange('tax_name', e.target.value)}
                  placeholder="GST"
                  className={inputCls}
                />
                <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-1">Label shown on invoice (e.g. GST, VAT, Tax)</p>
              </div>
              <div>
                <label className={labelCls}>Default Tax Rate (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={settings.default_tax_rate}
                  onChange={e => handleChange('default_tax_rate', parseFloat(e.target.value) || 0)}
                  className={inputCls}
                />
                <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-1">Applied to new line items by default</p>
              </div>
            </div>
            <div className="border-t border-[#D9DEE5] dark:border-[#1F2630] mt-4 pt-2">
              <Toggle
                checked={settings.show_tax_breakdown}
                onChange={v => handleChange('show_tax_breakdown', v)}
                label="Show tax breakdown on invoice"
                description="Display subtotal, tax amount, and total as separate line items"
              />
            </div>
          </SectionCard>

          {/* Default Terms */}
          <SectionCard title="Payment Defaults" icon={CreditCard}>
            <div className="mb-4">
              <label className={labelCls}>Default Payment Terms</label>
              <select
                value={settings.default_payment_terms}
                onChange={e => handleChange('default_payment_terms', e.target.value)}
                className={inputCls}
              >
                {PAYMENT_TERMS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className={labelCls}>Default Notes</label>
              <textarea
                rows={3}
                value={settings.default_notes || ''}
                onChange={e => handleChange('default_notes', e.target.value)}
                placeholder="e.g. Thank you for your business!"
                className={`${inputCls} resize-none`}
              />
              <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-1">Shown on every invoice below the line items</p>
            </div>
            <div>
              <label className={labelCls}>Default Footer / Terms &amp; Conditions</label>
              <textarea
                rows={3}
                value={settings.default_footer || ''}
                onChange={e => handleChange('default_footer', e.target.value)}
                placeholder="e.g. Payment within 30 days. Late payments subject to 2% monthly interest."
                className={`${inputCls} resize-none`}
              />
            </div>
          </SectionCard>

          {/* Company Details on Invoice */}
          <SectionCard title="Company Details (Invoice Header)" icon={Building2}>
            <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mb-4 flex items-start gap-1.5">
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              Leave blank to use the values from Company Settings. These override only what appears on invoices.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Company Name</label>
                <input
                  type="text"
                  value={settings.invoice_company_name || ''}
                  onChange={e => handleChange('invoice_company_name', e.target.value)}
                  className={inputCls}
                  placeholder="Your company name as it appears on invoices"
                />
              </div>
              <div>
                <label className={labelCls}><Phone size={12} className="inline mr-1" />Phone</label>
                <input
                  type="text"
                  value={settings.invoice_company_phone || ''}
                  onChange={e => handleChange('invoice_company_phone', e.target.value)}
                  className={inputCls}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className={labelCls}><Mail size={12} className="inline mr-1" />Email</label>
                <input
                  type="email"
                  value={settings.invoice_company_email || ''}
                  onChange={e => handleChange('invoice_company_email', e.target.value)}
                  className={inputCls}
                  placeholder="billing@yourcompany.com"
                />
              </div>
              <div>
                <label className={labelCls}><Globe size={12} className="inline mr-1" />Website</label>
                <input
                  type="text"
                  value={settings.invoice_company_website || ''}
                  onChange={e => handleChange('invoice_company_website', e.target.value)}
                  className={inputCls}
                  placeholder="www.yourcompany.com"
                />
              </div>
              <div>
                <label className={labelCls}>GSTIN / Tax ID</label>
                <input
                  type="text"
                  value={settings.invoice_company_gstin || ''}
                  onChange={e => handleChange('invoice_company_gstin', e.target.value)}
                  className={inputCls}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}><MapPin size={12} className="inline mr-1" />Billing Address</label>
                <textarea
                  rows={2}
                  value={settings.invoice_company_address || ''}
                  onChange={e => handleChange('invoice_company_address', e.target.value)}
                  placeholder="123 Business Street, City, State – 400001"
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          </SectionCard>

          {/* Automation */}
          <SectionCard title="Automation" icon={RefreshCw}>
            <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mb-3 flex items-start gap-1.5">
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              Configure when invoices are automatically generated based on your business type.
              Enable only the triggers that match your workflow.
            </p>
            <div className="divide-y divide-[#D9DEE5] dark:divide-[#1F2630]">
              <div className="pb-1">
                <div className="flex items-center gap-1.5 mb-1 pt-2">
                  <FileText size={13} className="text-[#5FA8D3]" />
                  <span className="text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase tracking-wider">Booking-based businesses</span>
                </div>
                <Toggle
                  checked={settings.auto_generate_from_booking}
                  onChange={v => handleChange('auto_generate_from_booking', v)}
                  label="Auto-generate invoice on booking completion"
                  description="Creates an invoice automatically when a booking status changes to Completed"
                />
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-1.5 mb-1 pt-3">
                  <ShoppingBag size={13} className="text-[#5FA8D3]" />
                  <span className="text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase tracking-wider">Restaurant / order-based businesses</span>
                </div>
                <Toggle
                  checked={settings.auto_generate_from_order}
                  onChange={v => handleChange('auto_generate_from_order', v)}
                  label="Auto-generate invoice on order completion"
                  description="Creates an invoice automatically when a restaurant order is marked Completed"
                />
              </div>
              <Toggle
                checked={settings.auto_send_on_generate}
                onChange={v => handleChange('auto_send_on_generate', v)}
                label="Auto-mark invoice as Sent after generation"
                description="Immediately sets status to Sent when an invoice is auto-generated (requires customer email for bookings)"
              />
            </div>
          </SectionCard>

          {/* Email Templates */}
          <SectionCard title="Email Notification Template" icon={Mail}>
            <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mb-4 flex items-start gap-1.5">
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              Available variables: <code className="text-[#5FA8D3]">{`{invoice_number} {company_name} {customer_name} {total_amount} {currency} {due_date}`}</code>
            </p>
            <div className="mb-4">
              <label className={labelCls}>Email Subject</label>
              <input
                type="text"
                value={settings.email_subject || ''}
                onChange={e => handleChange('email_subject', e.target.value)}
                className={inputCls}
                placeholder="Invoice {invoice_number} from {company_name}"
              />
            </div>
            <div>
              <label className={labelCls}>Email Body</label>
              <textarea
                rows={6}
                value={settings.email_body || ''}
                onChange={e => handleChange('email_body', e.target.value)}
                className={`${inputCls} resize-none font-mono text-xs`}
                placeholder="Dear {customer_name},&#10;&#10;Please find invoice {invoice_number} for {currency}{total_amount} attached.&#10;&#10;Due Date: {due_date}&#10;&#10;Thank you,&#10;{company_name}"
              />
            </div>
          </SectionCard>

          {/* Save Button (bottom) */}
          <div className="flex justify-end pb-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0] text-[#222] font-semibold rounded-xl shadow hover:opacity-90 transition-opacity disabled:opacity-60 text-sm"
            >
              <Save size={16} />
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminInvoices;
