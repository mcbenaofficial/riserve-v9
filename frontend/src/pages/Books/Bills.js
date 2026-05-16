import React, { useState, useEffect } from 'react';
import { Plus, X, RefreshCw, AlertCircle, ChevronDown, Search } from 'lucide-react';
import { booksApi } from '../../services/booksApi';

const STATUS_STYLES = {
  unpaid:  'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
  partial: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
  paid:    'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
  void:    'bg-foreground/5 border-border text-foreground/30',
};

const fmt = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const Bills = () => {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [payingBill, setPayingBill] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const res = await booksApi.getBills(params);
      setBills(res.data || []);
    } catch (e) {
      setError('Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleVoid = async (id) => {
    if (!window.confirm('Void this bill?')) return;
    try {
      await booksApi.voidBill(id);
      load();
    } catch (e) {
      alert('Failed to void bill');
    }
  };

  const filtered = bills.filter(b =>
    !search || b.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
    (b.bill_number || '').toLowerCase().includes(search.toLowerCase())
  );

  const totals = filtered.reduce((acc, b) => ({
    total: acc.total + Number(b.total_amount || 0),
    outstanding: acc.outstanding + Math.max(0, Number(b.total_amount || 0) - Number(b.paid_amount || 0)),
  }), { total: 0, outstanding: 0 });

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Bills', value: fmt(totals.total) },
          { label: 'Outstanding', value: fmt(totals.outstanding), accent: totals.outstanding > 0 },
          { label: 'Unpaid', value: filtered.filter(b => b.status === 'unpaid').length },
          { label: 'Partial', value: filtered.filter(b => b.status === 'partial').length },
        ].map(({ label, value, accent }) => (
          <div key={label} className="bg-card border border-border rounded-xl px-4 py-3">
            <p className="text-xs text-foreground/50">{label}</p>
            <p className={`text-lg font-bold ${accent ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vendor or bill #…"
            className="w-full pl-8 pr-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
        >
          <option value="">All statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="void">Void</option>
        </select>
        {loading && <RefreshCw size={14} className="animate-spin text-foreground/40" />}
        <div className="ml-auto">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-all"
          >
            <Plus size={15} /> New Bill
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-background border-b border-border">
              <tr>
                {['Bill #', 'Vendor', 'Category', 'Date', 'Due', 'Amount', 'Paid', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(b => (
                <tr key={b.id} className="hover:bg-background/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-foreground/60">{b.bill_number}</td>
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{b.vendor_name}</td>
                  <td className="px-4 py-3 text-sm text-foreground/60 capitalize">{b.category || '—'}</td>
                  <td className="px-4 py-3 text-sm text-foreground/70">{b.bill_date}</td>
                  <td className={`px-4 py-3 text-sm ${b.due_date && new Date(b.due_date) < new Date() && b.status !== 'paid' ? 'text-red-500 font-medium' : 'text-foreground/70'}`}>
                    {b.due_date || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono font-medium text-foreground">{fmt(b.total_amount)}</td>
                  <td className="px-4 py-3 text-sm font-mono text-foreground/60">{fmt(b.paid_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[b.status] || STATUS_STYLES.void}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <BillActions bill={b} onPay={() => setPayingBill(b)} onVoid={() => handleVoid(b.id)} />
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-foreground/40">
                    No bills found. Add vendor bills and expenses to track your outgoings.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateBillModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
      {payingBill && (
        <PayBillModal
          bill={payingBill}
          onClose={() => setPayingBill(null)}
          onSaved={() => { setPayingBill(null); load(); }}
        />
      )}
    </div>
  );
};

const BillActions = ({ bill, onPay, onVoid }) => {
  const [open, setOpen] = useState(false);
  if (bill.status === 'paid' || bill.status === 'void') return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-foreground/60 hover:text-foreground border border-border rounded-lg bg-background transition-all"
      >
        Actions <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-xl min-w-32 py-1">
            <button
              onClick={() => { setOpen(false); onPay(); }}
              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-background transition-all"
            >
              Record payment
            </button>
            <button
              onClick={() => { setOpen(false); onVoid(); }}
              className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-background transition-all"
            >
              Void bill
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const CATEGORIES = ['rent', 'utilities', 'salary', 'marketing', 'inventory', 'software', 'maintenance', 'travel', 'misc'];

const CreateBillModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({
    vendor_name: '',
    bill_date: new Date().toISOString().split('T')[0],
    due_date: '',
    total_amount: '',
    category: '',
    description: '',
    subtotal: '',
    tax_amount: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!form.vendor_name || !form.total_amount) {
      setError('Vendor name and total amount are required');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await booksApi.createBill({
        ...form,
        total_amount: parseFloat(form.total_amount),
        subtotal: parseFloat(form.subtotal) || parseFloat(form.total_amount),
        tax_amount: parseFloat(form.tax_amount) || 0,
        due_date: form.due_date || null,
      });
      onSaved();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create bill');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20";
  const Field = ({ label, children }) => (
    <div><label className="text-xs text-foreground/50 block mb-1">{label}</label>{children}</div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">New Vendor Bill</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/20 transition-all">
            <X size={16} className="text-foreground/60" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Vendor Name *">
                <input className={inputClass} value={form.vendor_name} placeholder="e.g. Indus Realty"
                  onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} />
              </Field>
            </div>
            <Field label="Bill Date *">
              <input type="date" className={inputClass} value={form.bill_date}
                onChange={e => setForm(f => ({ ...f, bill_date: e.target.value }))} />
            </Field>
            <Field label="Due Date">
              <input type="date" className={inputClass} value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </Field>
            <Field label="Total Amount (₹) *">
              <input type="number" className={inputClass} value={form.total_amount} placeholder="0.00"
                onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
            </Field>
            <Field label="Tax Amount (₹)">
              <input type="number" className={inputClass} value={form.tax_amount} placeholder="0.00"
                onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))} />
            </Field>
            <Field label="Category">
              <select className={inputClass} value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="Description / Notes">
                <textarea className={`${inputClass} resize-none`} rows={2} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </Field>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-foreground/60 hover:text-foreground transition-all">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-all disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Bill'}
          </button>
        </div>
      </div>
    </div>
  );
};

const PayBillModal = ({ bill, onClose, onSaved }) => {
  const outstanding = Math.max(0, Number(bill.total_amount) - Number(bill.paid_amount));
  const [form, setForm] = useState({
    paid_amount: outstanding.toFixed(2),
    payment_method: 'bank_transfer',
    payment_reference: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await booksApi.payBill(bill.id, {
        paid_amount: parseFloat(form.paid_amount),
        payment_method: form.payment_method,
        payment_reference: form.payment_reference,
      });
      onSaved();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Record Payment</h3>
            <p className="text-xs text-foreground/50 mt-0.5">{bill.vendor_name} — {bill.bill_number}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/20 transition-all">
            <X size={16} className="text-foreground/60" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div className="flex justify-between text-sm text-foreground/60 bg-background border border-border rounded-xl px-4 py-3">
            <span>Outstanding</span>
            <span className="font-mono font-semibold text-foreground">{fmt(outstanding)}</span>
          </div>
          <div>
            <label className="text-xs text-foreground/50 block mb-1">Amount Paying (₹)</label>
            <input type="number" className={inputClass} value={form.paid_amount}
              onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-foreground/50 block mb-1">Payment Method</label>
            <select className={inputClass} value={form.payment_method}
              onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-foreground/50 block mb-1">Reference / UTR (optional)</label>
            <input className={inputClass} value={form.payment_reference} placeholder="e.g. UTR12345"
              onChange={e => setForm(f => ({ ...f, payment_reference: e.target.value }))} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-foreground/60 hover:text-foreground transition-all">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.paid_amount}
            className="px-5 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-all disabled:opacity-50">
            {saving ? 'Saving…' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Bills;
