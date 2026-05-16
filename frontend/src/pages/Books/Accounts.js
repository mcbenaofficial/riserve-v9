import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Plus, X, RefreshCw, AlertCircle } from 'lucide-react';
import { booksApi } from '../../services/booksApi';

const TYPE_ORDER = ['asset', 'liability', 'equity', 'income', 'expense'];
const TYPE_LABELS = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  income: 'Income',
  expense: 'Expenses',
};
const TYPE_ACCENT = {
  asset: 'text-blue-600 dark:text-blue-400',
  liability: 'text-red-600 dark:text-red-400',
  equity: 'text-purple-600 dark:text-purple-400',
  income: 'text-green-600 dark:text-green-400',
  expense: 'text-orange-600 dark:text-orange-400',
};

const fmt = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const Accounts = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [ledgerData, setLedgerData] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      const res = await booksApi.getAccounts({ active_only: false });
      setAccounts(res.data || []);
    } catch (e) {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const grouped = TYPE_ORDER.reduce((acc, t) => {
    acc[t] = accounts.filter(a => a.account_type === t && !a.parent_id);
    return acc;
  }, {});

  const toggleExpand = (type) => setExpanded(e => ({ ...e, [type]: !e[type] }));

  const openLedger = async (acct) => {
    setSelectedLedger(acct);
    if (!ledgerData[acct.id]) {
      try {
        const res = await booksApi.getAccountLedger(acct.id, { page_size: 10 });
        setLedgerData(prev => ({ ...prev, [acct.id]: res.data }));
      } catch (e) {}
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={20} className="animate-spin text-foreground/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground/50">{accounts.length} accounts</p>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-all">
          <Plus size={15} /> New Account
        </button>
      </div>

      <div className="space-y-3">
        {TYPE_ORDER.map(type => {
          const items = grouped[type] || [];
          const isOpen = expanded[type] !== false;
          const typeTotal = items.reduce((s, a) => s + (a.balance || 0), 0);

          return (
            <div key={type} className="bg-card border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => toggleExpand(type)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-background/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown size={16} className="text-foreground/40" /> : <ChevronRight size={16} className="text-foreground/40" />}
                  <span className={`font-semibold text-sm ${TYPE_ACCENT[type]}`}>{TYPE_LABELS[type]}</span>
                  <span className="text-xs text-foreground/40">{items.length} accounts</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border">
                  {items.length === 0 && (
                    <p className="px-5 py-4 text-sm text-foreground/40">No {TYPE_LABELS[type].toLowerCase()} accounts.</p>
                  )}
                  {items.map((acct, i) => (
                    <div
                      key={acct.id}
                      className={`flex items-center justify-between px-5 py-3 hover:bg-background/30 cursor-pointer transition-all ${i < items.length - 1 ? 'border-b border-border' : ''}`}
                      onClick={() => openLedger(acct)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-foreground/40 w-10">{acct.code}</span>
                        <div>
                          <span className="text-sm text-foreground">{acct.name}</span>
                          {!acct.is_active && <span className="ml-2 text-xs text-foreground/30">(inactive)</span>}
                          {acct.is_system && <span className="ml-2 text-xs text-foreground/20">system</span>}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-foreground/30" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Account Ledger Drawer */}
      {selectedLedger && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedLedger(null)} />
          <div className="w-full max-w-lg bg-card border-l border-border flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <p className="text-xs font-mono text-foreground/40">{selectedLedger.code}</p>
                <h3 className="font-semibold text-foreground">{selectedLedger.name}</h3>
              </div>
              <button onClick={() => setSelectedLedger(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/20 transition-all">
                <X size={16} className="text-foreground/60" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {!ledgerData[selectedLedger.id] ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw size={16} className="animate-spin text-foreground/40" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-xs text-foreground/40 uppercase border-b border-border pb-2">
                    <span>Date</span>
                    <span className="text-right">Debit</span>
                    <span className="text-right">Credit</span>
                  </div>
                  {(ledgerData[selectedLedger.id].lines || []).map((line, i) => (
                    <div key={i} className="grid grid-cols-3 gap-3 text-sm py-1 border-b border-border/50 last:border-0">
                      <div>
                        <p className="text-foreground/50 text-xs">{line.entry_date}</p>
                        <p className="text-foreground/80 text-xs truncate">{line.description}</p>
                      </div>
                      <p className="text-right font-mono text-foreground">{line.debit > 0 ? fmt(line.debit) : '—'}</p>
                      <p className="text-right font-mono text-foreground">{line.credit > 0 ? fmt(line.credit) : '—'}</p>
                    </div>
                  ))}
                  {(ledgerData[selectedLedger.id].lines || []).length === 0 && (
                    <p className="text-sm text-foreground/40 text-center py-8">No transactions yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      {showCreate && (
        <CreateAccountModal
          accounts={accounts}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
};

const CreateAccountModal = ({ accounts, onClose, onSaved }) => {
  const [form, setForm] = useState({ code: '', name: '', account_type: 'income', account_subtype: '', description: '', parent_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await booksApi.createAccount(form);
      onSaved();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, children }) => (
    <div>
      <label className="text-xs text-foreground/50 block mb-1">{label}</label>
      {children}
    </div>
  );

  const inputClass = "w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">New Account</h3>
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
            <Field label="Code">
              <input className={inputClass} value={form.code} placeholder="e.g. 4050"
                onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            </Field>
            <Field label="Type">
              <select className={inputClass} value={form.account_type}
                onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}>
                {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Name">
            <input className={inputClass} value={form.name} placeholder="e.g. Consulting Revenue"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Description (optional)">
            <input className={inputClass} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-foreground/60 hover:text-foreground transition-all">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.code || !form.name}
            className="px-5 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-all disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Accounts;
