import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import {
  FileText, Plus, Search, Filter, Download, Send, CheckCircle,
  XCircle, AlertCircle, Clock, DollarSign, TrendingUp, RefreshCw,
  ChevronLeft, ChevronRight, Eye, Trash2, MoreVertical, X,
  CreditCard, Building2, User, Calendar, Hash, Percent,
  Printer, Ban, Edit3
} from 'lucide-react';

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  draft:          { label: 'Draft',           color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  sent:           { label: 'Sent',            color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  paid:           { label: 'Paid',            color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  partially_paid: { label: 'Partial',         color: 'bg-teal-500/20 text-teal-400 border-teal-500/30' },
  overdue:        { label: 'Overdue',         color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  cancelled:      { label: 'Cancelled',       color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  void:           { label: 'Void',            color: 'bg-gray-400/20 text-gray-500 border-gray-400/30' },
};

const PAYMENT_TERMS_LABELS = {
  due_on_receipt: 'Due on Receipt',
  net_7: 'Net 7',
  net_15: 'Net 15',
  net_30: 'Net 30',
  net_45: 'Net 45',
  net_60: 'Net 60',
};

const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'upi', 'cheque', 'other'];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function formatCurrency(symbol, amount) {
  return `${symbol}${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const inputCls = `w-full px-4 py-2.5 bg-[#F6F7F9] dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630]
  rounded-xl text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:outline-none focus:border-[#5FA8D3]
  placeholder-[#9CA3AF] transition-colors`;

const labelCls = 'block text-xs font-medium text-[#4B5563] dark:text-[#7D8590] mb-1';

// ─── Empty line item ──────────────────────────────────────────────────────────

const emptyItem = () => ({ description: '', quantity: 1, unit_price: 0, tax_rate: 0, discount: 0, amount: 0 });

function computeItemAmount(item) {
  const base = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
  const discounted = base - (parseFloat(item.discount) || 0);
  return Math.max(0, discounted);
}

function computeTotals(items, settingsTaxRate) {
  const subtotal = items.reduce((s, i) => s + computeItemAmount(i), 0);
  const taxAmount = items.reduce((s, i) => {
    const taxRate = parseFloat(i.tax_rate) || 0;
    return s + computeItemAmount(i) * taxRate / 100;
  }, 0);
  const discountAmount = items.reduce((s, i) => s + (parseFloat(i.discount) || 0), 0);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax_amount: Math.round(taxAmount * 100) / 100,
    discount_amount: Math.round(discountAmount * 100) / 100,
    total_amount: Math.round((subtotal + taxAmount) * 100) / 100,
  };
}

function dueDateFromTerms(terms) {
  const today = new Date();
  const map = { due_on_receipt: 0, net_7: 7, net_15: 15, net_30: 30, net_45: 45, net_60: 60 };
  const days = map[terms] ?? 30;
  today.setDate(today.getDate() + days);
  return today.toISOString().split('T')[0];
}

// ─── Create Invoice Modal ──────────────────────────────────────────────────────

function CreateInvoiceModal({ onClose, onCreated, settings, outlets }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    outlet_id: '',
    issue_date: today,
    payment_terms: settings?.default_payment_terms || 'net_30',
    due_date: dueDateFromTerms(settings?.default_payment_terms || 'net_30'),
    notes: settings?.default_notes || '',
    footer: settings?.default_footer || '',
    currency: settings?.currency || 'INR',
    currency_symbol: settings?.currency_symbol || '₹',
  });
  const [items, setItems] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totals = computeTotals(items);

  const setField = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleTermsChange = (terms) => {
    setField('payment_terms', terms);
    setField('due_date', dueDateFromTerms(terms));
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      next[idx].amount = computeItemAmount(next[idx]);
      return next;
    });
  };

  const addItem = () => setItems(p => [...p, { ...emptyItem(), tax_rate: settings?.default_tax_rate || 0 }]);
  const removeItem = (idx) => setItems(p => p.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!form.customer_name.trim()) { setError('Customer name is required'); return; }
    if (items.length === 0 || items.every(i => !i.description.trim())) {
      setError('Add at least one line item');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        items: items.map(i => ({ ...i, amount: computeItemAmount(i) })),
        ...totals,
      };
      const res = await api.createInvoice(payload);
      onCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0F1117] rounded-3xl border border-[#D9DEE5] dark:border-[#1F2630] w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9DEE5] dark:border-[#1F2630] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center">
              <FileText size={16} className="text-[#222]" />
            </div>
            <h2 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">New Invoice</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] rounded-xl transition-colors">
            <X size={18} className="text-[#4B5563] dark:text-[#7D8590]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {/* Customer + Outlet */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Customer Name *</label>
              <input value={form.customer_name} onChange={e => setField('customer_name', e.target.value)} placeholder="John Smith" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Customer Email</label>
              <input type="email" value={form.customer_email} onChange={e => setField('customer_email', e.target.value)} placeholder="customer@email.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Customer Phone</label>
              <input value={form.customer_phone} onChange={e => setField('customer_phone', e.target.value)} placeholder="+91 98765 43210" className={inputCls} />
            </div>
            {outlets.length > 0 && (
              <div>
                <label className={labelCls}>Outlet (optional)</label>
                <select value={form.outlet_id} onChange={e => setField('outlet_id', e.target.value)} className={inputCls}>
                  <option value="">No specific outlet</option>
                  {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Dates & Terms */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Issue Date</label>
              <input type="date" value={form.issue_date} onChange={e => setField('issue_date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Payment Terms</label>
              <select value={form.payment_terms} onChange={e => handleTermsChange(e.target.value)} className={inputCls}>
                {Object.entries(PAYMENT_TERMS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setField('due_date', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Line Items</label>
              <button onClick={addItem} className="text-xs text-[#5FA8D3] hover:underline font-medium flex items-center gap-1">
                <Plus size={12} /> Add Item
              </button>
            </div>
            <div className="border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F6F7F9] dark:bg-[#0B0D10] text-[#6B7280] dark:text-[#7D8590]">
                    <th className="text-left px-3 py-2 font-medium">Description</th>
                    <th className="text-right px-3 py-2 font-medium w-14">Qty</th>
                    <th className="text-right px-3 py-2 font-medium w-24">Unit Price</th>
                    <th className="text-right px-3 py-2 font-medium w-16">Tax %</th>
                    <th className="text-right px-3 py-2 font-medium w-20">Amount</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9DEE5] dark:divide-[#1F2630]">
                  {items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        <input
                          value={item.description}
                          onChange={e => updateItem(idx, 'description', e.target.value)}
                          placeholder="Service or product description"
                          className="w-full bg-transparent text-[#0E1116] dark:text-[#E6E8EB] outline-none placeholder-[#9CA3AF]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" min={0.01} step={0.01}
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)}
                          className="w-full bg-transparent text-right text-[#0E1116] dark:text-[#E6E8EB] outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" min={0} step={0.01}
                          value={item.unit_price}
                          onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                          className="w-full bg-transparent text-right text-[#0E1116] dark:text-[#E6E8EB] outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" min={0} max={100} step={0.01}
                          value={item.tax_rate}
                          onChange={e => updateItem(idx, 'tax_rate', e.target.value)}
                          className="w-full bg-transparent text-right text-[#0E1116] dark:text-[#E6E8EB] outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-[#0E1116] dark:text-[#E6E8EB]">
                        {form.currency_symbol}{computeItemAmount(item).toFixed(2)}
                      </td>
                      <td className="px-2 py-2">
                        {items.length > 1 && (
                          <button onClick={() => removeItem(idx)} className="text-[#9CA3AF] hover:text-red-400 transition-colors">
                            <X size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Totals */}
            <div className="mt-3 space-y-1 text-sm text-right pr-2">
              <div className="flex justify-end gap-8 text-[#6B7280] dark:text-[#7D8590]">
                <span>Subtotal</span>
                <span className="w-28 text-right">{form.currency_symbol}{totals.subtotal.toFixed(2)}</span>
              </div>
              {totals.tax_amount > 0 && (
                <div className="flex justify-end gap-8 text-[#6B7280] dark:text-[#7D8590]">
                  <span>Tax</span>
                  <span className="w-28 text-right">{form.currency_symbol}{totals.tax_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-end gap-8 font-bold text-[#0E1116] dark:text-[#E6E8EB] border-t border-[#D9DEE5] dark:border-[#1F2630] pt-1 mt-1">
                <span>Total</span>
                <span className="w-28 text-right">{form.currency_symbol}{totals.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Notes</label>
              <textarea rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)}
                placeholder="Thank you for your business!" className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className={labelCls}>Footer / Terms</label>
              <textarea rows={3} value={form.footer} onChange={e => setField('footer', e.target.value)}
                placeholder="Payment terms and conditions…" className={`${inputCls} resize-none`} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#D9DEE5] dark:border-[#1F2630] flex-shrink-0 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] text-sm text-[#4B5563] dark:text-[#7D8590] hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2.5 bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0] text-[#222] font-semibold rounded-xl shadow hover:opacity-90 transition-opacity disabled:opacity-60 text-sm flex items-center gap-2">
            <Plus size={16} />
            {saving ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Record Payment Modal ──────────────────────────────────────────────────────

function RecordPaymentModal({ invoice, onClose, onRecorded }) {
  const outstanding = (invoice.total_amount - invoice.paid_amount).toFixed(2);
  const [form, setForm] = useState({
    amount: outstanding,
    payment_method: 'cash',
    reference: '',
    notes: '',
    paid_at: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const amt = parseFloat(form.amount);
    if (!amt || amt <= 0) { setError('Enter a valid amount'); return; }
    if (amt > parseFloat(outstanding)) { setError(`Amount cannot exceed outstanding balance of ${invoice.currency_symbol}${outstanding}`); return; }
    setSaving(true);
    setError('');
    try {
      const res = await api.recordInvoicePayment(invoice.id, { ...form, amount: amt });
      onRecorded(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0F1117] rounded-3xl border border-[#D9DEE5] dark:border-[#1F2630] w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <h2 className="text-base font-bold text-[#0E1116] dark:text-[#E6E8EB] flex items-center gap-2">
            <CreditCard size={16} className="text-[#5FA8D3]" /> Record Payment
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] rounded-xl transition-colors">
            <X size={16} className="text-[#4B5563]" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl px-4 py-3 text-sm">
            <div className="flex justify-between text-[#6B7280] dark:text-[#7D8590]">
              <span>Invoice</span><span className="font-medium text-[#0E1116] dark:text-[#E6E8EB]">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between text-[#6B7280] dark:text-[#7D8590] mt-1">
              <span>Outstanding</span>
              <span className="font-bold text-[#0E1116] dark:text-[#E6E8EB]">{invoice.currency_symbol}{outstanding}</span>
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <div>
            <label className={labelCls}>Amount ({invoice.currency_symbol})</label>
            <input type="number" min={0.01} step={0.01} value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Payment Method</label>
            <select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))} className={inputCls}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Reference / Transaction ID</label>
            <input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
              placeholder="UPI ref, cheque number, etc." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={form.paid_at} onChange={e => setForm(p => ({ ...p, paid_at: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Notes (optional)</label>
            <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Any additional notes" className={inputCls} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#D9DEE5] dark:border-[#1F2630] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] text-sm text-[#4B5563] dark:text-[#7D8590] hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0] text-[#222] font-semibold rounded-xl shadow hover:opacity-90 transition-opacity disabled:opacity-60 text-sm flex items-center gap-2">
            <CheckCircle size={15} /> {saving ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invoice Detail / Preview Modal ───────────────────────────────────────────

function InvoiceDetailModal({ invoice, onClose, onAction, settings }) {
  const [actionLoading, setActionLoading] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [localInvoice, setLocalInvoice] = useState(invoice);

  const outstanding = localInvoice.total_amount - localInvoice.paid_amount;

  const doAction = async (action, apiFn) => {
    setActionLoading(action);
    try {
      const res = await apiFn();
      setLocalInvoice(res.data);
      onAction(res.data);
    } catch (err) {
      alert(err.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setActionLoading('');
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const companyName = settings?.invoice_company_name || 'Your Company';
    const companyAddress = settings?.invoice_company_address || '';
    const companyEmail = settings?.invoice_company_email || '';
    const companyPhone = settings?.invoice_company_phone || '';
    const gstin = settings?.invoice_company_gstin || '';
    const brandColor = settings?.brand_color || '#5FA8D3';

    printWindow.document.write(`
      <!DOCTYPE html><html><head>
      <title>Invoice ${localInvoice.invoice_number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; padding: 40px; font-size: 14px; }
        .brand-bar { height: 6px; background: ${brandColor}; margin: -40px -40px 36px -40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .company-name { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
        .meta { color: #555; font-size: 12px; line-height: 1.6; }
        .invoice-title { font-size: 28px; font-weight: 300; color: ${brandColor}; text-align: right; }
        .invoice-meta { text-align: right; color: #555; font-size: 12px; margin-top: 6px; }
        .bill-to { margin-bottom: 30px; background: #f9fafb; padding: 16px; border-radius: 8px; }
        .bill-to h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
        .bill-to p { font-size: 14px; line-height: 1.6; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        thead th { border-bottom: 2px solid ${brandColor}; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
        thead th:last-child { text-align: right; }
        tbody td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
        tbody td:last-child { text-align: right; }
        .totals { margin-left: auto; width: 260px; }
        .totals table td { border: none; padding: 5px 12px; }
        .totals .grand-total { font-weight: 700; font-size: 16px; border-top: 2px solid ${brandColor}; color: ${brandColor}; }
        .notes { margin-top: 30px; padding: 16px; background: ${brandColor}10; border-left: 3px solid ${brandColor}; border-radius: 0 8px 8px 0; font-size: 12px; color: #555; }
        .footer { margin-top: 16px; font-size: 11px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
        @media print { body { padding: 20px; } .brand-bar { margin: -20px -20px 28px -20px; } }
      </style></head><body>
      <div class="brand-bar"></div>
      <div class="header">
        <div>
          <div class="company-name">${companyName}</div>
          <div class="meta">${companyAddress}</div>
          <div class="meta">${companyEmail}${companyPhone ? ' · ' + companyPhone : ''}</div>
          ${gstin ? `<div class="meta">GSTIN: ${gstin}</div>` : ''}
        </div>
        <div>
          <div class="invoice-title">INVOICE</div>
          <div class="invoice-meta"><strong>${localInvoice.invoice_number}</strong></div>
          <div class="invoice-meta">Issue Date: ${formatDate(localInvoice.issue_date)}</div>
          ${localInvoice.due_date ? `<div class="invoice-meta">Due Date: ${formatDate(localInvoice.due_date)}</div>` : ''}
        </div>
      </div>
      <div class="bill-to">
        <h4>Bill To</h4>
        <p><strong>${localInvoice.customer_name}</strong></p>
        ${localInvoice.customer_email ? `<p>${localInvoice.customer_email}</p>` : ''}
        ${localInvoice.customer_phone ? `<p>${localInvoice.customer_phone}</p>` : ''}
      </div>
      <table>
        <thead><tr>
          <th>Description</th><th style="text-align:right">Qty</th>
          <th style="text-align:right">Unit Price</th><th style="text-align:right">Tax</th><th style="text-align:right">Amount</th>
        </tr></thead>
        <tbody>
          ${(localInvoice.items || []).map(item => `
            <tr>
              <td>${item.description || ''}</td>
              <td style="text-align:right">${item.quantity}</td>
              <td style="text-align:right">${localInvoice.currency_symbol}${Number(item.unit_price).toFixed(2)}</td>
              <td style="text-align:right">${item.tax_rate || 0}%</td>
              <td style="text-align:right">${localInvoice.currency_symbol}${Number(item.amount || 0).toFixed(2)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="totals">
        <table>
          <tr><td>Subtotal</td><td style="text-align:right">${localInvoice.currency_symbol}${Number(localInvoice.subtotal).toFixed(2)}</td></tr>
          ${localInvoice.tax_amount > 0 ? `<tr><td>${settings?.tax_name || 'Tax'}</td><td style="text-align:right">${localInvoice.currency_symbol}${Number(localInvoice.tax_amount).toFixed(2)}</td></tr>` : ''}
          ${localInvoice.discount_amount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${localInvoice.currency_symbol}${Number(localInvoice.discount_amount).toFixed(2)}</td></tr>` : ''}
          <tr class="grand-total"><td>Total</td><td style="text-align:right">${localInvoice.currency_symbol}${Number(localInvoice.total_amount).toFixed(2)}</td></tr>
          ${localInvoice.paid_amount > 0 ? `<tr><td>Paid</td><td style="text-align:right">${localInvoice.currency_symbol}${Number(localInvoice.paid_amount).toFixed(2)}</td></tr>` : ''}
          ${outstanding > 0 ? `<tr><td><strong>Balance Due</strong></td><td style="text-align:right"><strong>${localInvoice.currency_symbol}${Number(outstanding).toFixed(2)}</strong></td></tr>` : ''}
        </table>
      </div>
      ${localInvoice.notes ? `<div class="notes"><strong>Notes</strong><br>${localInvoice.notes}</div>` : ''}
      ${localInvoice.footer ? `<div class="footer">${localInvoice.footer}</div>` : ''}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0F1117] rounded-3xl border border-[#D9DEE5] dark:border-[#1F2630] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9DEE5] dark:border-[#1F2630] flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-[#0E1116] dark:text-[#E6E8EB]">{localInvoice.invoice_number}</span>
            <StatusBadge status={localInvoice.status} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} title="Print / Download"
              className="p-2 hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] rounded-xl transition-colors text-[#4B5563] dark:text-[#7D8590]">
              <Printer size={16} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] rounded-xl transition-colors">
              <X size={16} className="text-[#4B5563] dark:text-[#7D8590]" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Customer + Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl p-4">
              <p className="text-xs text-[#6B7280] dark:text-[#7D8590] uppercase tracking-wider mb-2">Bill To</p>
              <p className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{localInvoice.customer_name}</p>
              {localInvoice.customer_email && <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">{localInvoice.customer_email}</p>}
              {localInvoice.customer_phone && <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">{localInvoice.customer_phone}</p>}
            </div>
            <div className="bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280] dark:text-[#7D8590]">Issue Date</span>
                <span className="text-[#0E1116] dark:text-[#E6E8EB] font-medium">{formatDate(localInvoice.issue_date)}</span>
              </div>
              {localInvoice.due_date && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280] dark:text-[#7D8590]">Due Date</span>
                  <span className={`font-medium ${localInvoice.status === 'overdue' ? 'text-red-400' : 'text-[#0E1116] dark:text-[#E6E8EB]'}`}>{formatDate(localInvoice.due_date)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280] dark:text-[#7D8590]">Terms</span>
                <span className="text-[#0E1116] dark:text-[#E6E8EB] font-medium">{PAYMENT_TERMS_LABELS[localInvoice.payment_terms] || localInvoice.payment_terms}</span>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F6F7F9] dark:bg-[#0B0D10] text-[#6B7280] dark:text-[#7D8590] text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-2.5 font-medium">Description</th>
                  <th className="text-right px-4 py-2.5 font-medium">Qty</th>
                  <th className="text-right px-4 py-2.5 font-medium">Price</th>
                  <th className="text-right px-4 py-2.5 font-medium">Tax</th>
                  <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9DEE5] dark:divide-[#1F2630]">
                {(localInvoice.items || []).map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-[#0E1116] dark:text-[#E6E8EB]">{item.description}</td>
                    <td className="px-4 py-3 text-right text-[#4B5563] dark:text-[#7D8590]">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-[#4B5563] dark:text-[#7D8590]">{formatCurrency(localInvoice.currency_symbol, item.unit_price)}</td>
                    <td className="px-4 py-3 text-right text-[#4B5563] dark:text-[#7D8590]">{item.tax_rate || 0}%</td>
                    <td className="px-4 py-3 text-right font-medium text-[#0E1116] dark:text-[#E6E8EB]">{formatCurrency(localInvoice.currency_symbol, item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-[#6B7280] dark:text-[#7D8590]">
                <span>Subtotal</span>
                <span>{formatCurrency(localInvoice.currency_symbol, localInvoice.subtotal)}</span>
              </div>
              {localInvoice.tax_amount > 0 && (
                <div className="flex justify-between text-[#6B7280] dark:text-[#7D8590]">
                  <span>{settings?.tax_name || 'Tax'}</span>
                  <span>{formatCurrency(localInvoice.currency_symbol, localInvoice.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-[#0E1116] dark:text-[#E6E8EB] border-t border-[#D9DEE5] dark:border-[#1F2630] pt-2 mt-2">
                <span>Total</span>
                <span>{formatCurrency(localInvoice.currency_symbol, localInvoice.total_amount)}</span>
              </div>
              {localInvoice.paid_amount > 0 && (
                <>
                  <div className="flex justify-between text-green-500">
                    <span>Paid</span>
                    <span>{formatCurrency(localInvoice.currency_symbol, localInvoice.paid_amount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[#0E1116] dark:text-[#E6E8EB]">
                    <span>Balance Due</span>
                    <span className={outstanding > 0 ? 'text-red-400' : 'text-green-400'}>
                      {formatCurrency(localInvoice.currency_symbol, outstanding)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Payment History */}
          {localInvoice.payments?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase tracking-wider mb-2">Payment History</p>
              <div className="space-y-2">
                {localInvoice.payments.map((p, i) => (
                  <div key={i} className="flex justify-between items-center text-sm bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-2">
                    <div>
                      <span className="font-medium text-[#0E1116] dark:text-[#E6E8EB]">{formatCurrency(localInvoice.currency_symbol, p.amount)}</span>
                      <span className="text-[#6B7280] dark:text-[#7D8590] ml-2 text-xs">{p.payment_method.replace('_', ' ')} {p.reference ? `· ${p.reference}` : ''}</span>
                    </div>
                    <span className="text-xs text-[#6B7280] dark:text-[#7D8590]">{formatDate(p.paid_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {localInvoice.notes && (
            <div className="bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl px-4 py-3 text-sm text-[#4B5563] dark:text-[#7D8590]">
              <p className="text-xs font-semibold uppercase tracking-wider mb-1">Notes</p>
              <p>{localInvoice.notes}</p>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="px-6 py-4 border-t border-[#D9DEE5] dark:border-[#1F2630] flex-shrink-0 flex items-center gap-2 flex-wrap">
          {localInvoice.status === 'draft' && (
            <button onClick={() => doAction('send', () => api.sendInvoice(localInvoice.id))}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-colors disabled:opacity-50">
              <Send size={14} /> {actionLoading === 'send' ? 'Sending…' : 'Mark as Sent'}
            </button>
          )}
          {localInvoice.status === 'sent' && (
            <button onClick={() => doAction('send', () => api.sendInvoice(localInvoice.id))}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl hover:bg-blue-500/20 transition-colors disabled:opacity-50">
              <Send size={14} /> Resend
            </button>
          )}
          {!['paid', 'void', 'cancelled'].includes(localInvoice.status) && (
            <>
              <button onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-teal-500/10 border border-teal-500/30 text-teal-400 rounded-xl hover:bg-teal-500/20 transition-colors">
                <CreditCard size={14} /> Record Payment
              </button>
              <button onClick={() => doAction('paid', () => api.markInvoicePaid(localInvoice.id))}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl hover:bg-green-500/20 transition-colors disabled:opacity-50">
                <CheckCircle size={14} /> {actionLoading === 'paid' ? 'Saving…' : 'Mark Fully Paid'}
              </button>
            </>
          )}
          {!['paid', 'void'].includes(localInvoice.status) && (
            <button onClick={() => { if (window.confirm('Cancel this invoice?')) doAction('cancel', () => api.cancelInvoice(localInvoice.id)); }}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-xl hover:bg-orange-500/20 transition-colors disabled:opacity-50">
              <Ban size={14} /> Cancel
            </button>
          )}
          {!['paid'].includes(localInvoice.status) && (
            <button onClick={() => { if (window.confirm('Void this invoice?')) doAction('void', () => api.voidInvoice(localInvoice.id)); }}
              disabled={!!actionLoading}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-red-400 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50">
              <XCircle size={14} /> Void
            </button>
          )}
        </div>
      </div>

      {showPaymentModal && (
        <RecordPaymentModal
          invoice={localInvoice}
          onClose={() => setShowPaymentModal(false)}
          onRecorded={(updated) => { setLocalInvoice(updated); setShowPaymentModal(false); onAction(updated); }}
        />
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const PER_PAGE = 15;

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const [invRes, statsRes, settingsRes, outletsRes] = await Promise.all([
        api.getInvoices(params),
        api.getInvoiceStats(),
        api.getInvoiceSettings(),
        api.getOutlets(),
      ]);
      setInvoices(invRes.data);
      setStats(statsRes.data);
      setSettings(settingsRes.data);
      setOutlets(outletsRes.data || []);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, dateFrom, dateTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const symbol = settings?.currency_symbol || '₹';

  const pageCount = Math.ceil(invoices.length / PER_PAGE);
  const pageItems = invoices.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleCreated = (inv) => {
    setShowCreate(false);
    fetchAll();
    setSelectedInvoice(inv);
  };

  const handleAction = (updated) => {
    setInvoices(prev => prev.map(i => i.id === updated.id ? updated : i));
    if (selectedInvoice?.id === updated.id) setSelectedInvoice(updated);
    fetchAll();
  };

  const handleDelete = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.invoice_number}?`)) return;
    try {
      await api.deleteInvoice(inv.id);
      setInvoices(prev => prev.filter(i => i.id !== inv.id));
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.detail || 'Cannot delete this invoice');
    }
    setOpenMenuId(null);
  };

  const statCards = [
    {
      label: 'Total Invoiced',
      value: formatCurrency(symbol, stats?.total_invoiced || 0),
      icon: FileText,
      color: 'from-[#5FA8D3] to-[#4A95C0]',
      sub: `${(stats?.counts?.sent || 0) + (stats?.counts?.draft || 0)} active`,
    },
    {
      label: 'Collected',
      value: formatCurrency(symbol, stats?.total_paid || 0),
      icon: CheckCircle,
      color: 'from-green-500 to-green-600',
      sub: `${stats?.counts?.paid || 0} paid`,
    },
    {
      label: 'Outstanding',
      value: formatCurrency(symbol, stats?.total_outstanding || 0),
      icon: Clock,
      color: 'from-blue-500 to-blue-600',
      sub: `${(stats?.counts?.sent || 0) + (stats?.counts?.partially_paid || 0)} pending`,
    },
    {
      label: 'Overdue',
      value: formatCurrency(symbol, stats?.total_overdue || 0),
      icon: AlertCircle,
      color: 'from-red-500 to-red-600',
      sub: `${stats?.counts?.overdue || 0} invoices`,
    },
  ];

  const STATUS_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'paid', label: 'Paid' },
    { value: 'partially_paid', label: 'Partial' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="min-h-[calc(100vh-120px)] space-y-6">
      {/* Header */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center shadow-lg">
              <FileText size={22} className="text-[#222]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Invoices</h1>
              <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">
                {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0] text-[#222] font-semibold rounded-xl shadow-lg hover:opacity-90 transition-opacity text-sm"
          >
            <Plus size={18} /> New Invoice
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-[#6B7280] dark:text-[#7D8590] uppercase tracking-wider">{card.label}</p>
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                  <Icon size={14} className="text-white" />
                </div>
              </div>
              <p className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">{card.value}</p>
              <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-1">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] p-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by customer, invoice number…"
              className="w-full pl-9 pr-4 py-2.5 bg-[#F6F7F9] dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-sm text-[#0E1116] dark:text-[#E6E8EB] placeholder-[#9CA3AF] focus:outline-none focus:border-[#5FA8D3]"
            />
          </div>
          {/* Date range */}
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-[#F6F7F9] dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-sm text-[#0E1116] dark:text-[#E6E8EB] focus:outline-none focus:border-[#5FA8D3]" />
          <span className="text-[#9CA3AF] text-sm">to</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="px-3 py-2.5 bg-[#F6F7F9] dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-sm text-[#0E1116] dark:text-[#E6E8EB] focus:outline-none focus:border-[#5FA8D3]" />
          {/* Status filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button key={f.value} onClick={() => { setStatusFilter(f.value); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === f.value
                  ? 'bg-[#5FA8D3] text-[#222]'
                  : 'bg-[#F6F7F9] dark:bg-[#1F2630] text-[#4B5563] dark:text-[#7D8590] hover:bg-[#E5E7EB] dark:hover:bg-[#2A3040]'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw size={20} className="animate-spin text-[#5FA8D3]" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <FileText size={40} className="text-[#D9DEE5] dark:text-[#2A3040]" />
            <p className="text-[#6B7280] dark:text-[#7D8590]">No invoices found</p>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#5FA8D3]/10 border border-[#5FA8D3]/30 text-[#5FA8D3] rounded-xl text-sm font-medium hover:bg-[#5FA8D3]/20 transition-colors">
              <Plus size={14} /> Create your first invoice
            </button>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D9DEE5] dark:border-[#1F2630] bg-[#F6F7F9] dark:bg-[#0B0D10]">
                  {['Invoice #', 'Customer', 'Date', 'Due', 'Amount', 'Paid', 'Status', ''].map(h => (
                    <th key={h} className={`px-5 py-3 text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase tracking-wider ${h === '' || h === 'Amount' || h === 'Paid' ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9DEE5] dark:divide-[#1F2630]">
                {pageItems.map(inv => (
                  <tr key={inv.id} className="hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630]/50 transition-colors cursor-pointer" onClick={() => setSelectedInvoice(inv)}>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-[#5FA8D3] text-sm">{inv.invoice_number}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-sm text-[#0E1116] dark:text-[#E6E8EB]">{inv.customer_name}</p>
                      {inv.customer_email && <p className="text-xs text-[#6B7280] dark:text-[#7D8590]">{inv.customer_email}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#4B5563] dark:text-[#7D8590]">{formatDate(inv.issue_date)}</td>
                    <td className={`px-5 py-3.5 text-sm ${inv.status === 'overdue' ? 'text-red-400 font-medium' : 'text-[#4B5563] dark:text-[#7D8590]'}`}>
                      {formatDate(inv.due_date)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-sm text-[#0E1116] dark:text-[#E6E8EB]">
                      {formatCurrency(inv.currency_symbol, inv.total_amount)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-sm text-[#4B5563] dark:text-[#7D8590]">
                      {inv.paid_amount > 0 ? formatCurrency(inv.currency_symbol, inv.paid_amount) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3.5 relative" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenMenuId(openMenuId === inv.id ? null : inv.id)}
                        className="p-1.5 rounded-lg hover:bg-[#E5E7EB] dark:hover:bg-[#2A3040] text-[#9CA3AF] transition-colors"
                      >
                        <MoreVertical size={15} />
                      </button>
                      {openMenuId === inv.id && (
                        <div className="absolute right-4 top-full mt-1 w-44 bg-white dark:bg-[#0F1117] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl shadow-xl z-20 py-1 text-sm">
                          <button onClick={() => { setSelectedInvoice(inv); setOpenMenuId(null); }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] text-[#0E1116] dark:text-[#E6E8EB] transition-colors">
                            <Eye size={13} /> View Details
                          </button>
                          {inv.status === 'draft' && (
                            <button onClick={async () => { const r = await api.sendInvoice(inv.id); handleAction(r.data); setOpenMenuId(null); }}
                              className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] text-[#0E1116] dark:text-[#E6E8EB] transition-colors">
                              <Send size={13} /> Mark as Sent
                            </button>
                          )}
                          {!['paid', 'void', 'cancelled'].includes(inv.status) && (
                            <button onClick={async () => { const r = await api.markInvoicePaid(inv.id); handleAction(r.data); setOpenMenuId(null); }}
                              className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] text-green-500 transition-colors">
                              <CheckCircle size={13} /> Mark Paid
                            </button>
                          )}
                          {['draft', 'cancelled', 'void'].includes(inv.status) && (
                            <button onClick={() => handleDelete(inv)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-left hover:bg-red-500/10 text-red-400 transition-colors">
                              <Trash2 size={13} /> Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-[#D9DEE5] dark:border-[#1F2630]">
                <p className="text-sm text-[#6B7280] dark:text-[#7D8590]">
                  Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, invoices.length)} of {invoices.length}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-2 rounded-lg border border-[#D9DEE5] dark:border-[#1F2630] text-[#4B5563] dark:text-[#7D8590] hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] disabled:opacity-40 transition-colors">
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-sm text-[#0E1116] dark:text-[#E6E8EB] font-medium">{page} / {pageCount}</span>
                  <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}
                    className="p-2 rounded-lg border border-[#D9DEE5] dark:border-[#1F2630] text-[#4B5563] dark:text-[#7D8590] hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] disabled:opacity-40 transition-colors">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateInvoiceModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
          settings={settings}
          outlets={outlets}
        />
      )}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onAction={handleAction}
          settings={settings}
        />
      )}

      {/* Close dropdown on outside click */}
      {openMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  );
};

export default Invoices;
