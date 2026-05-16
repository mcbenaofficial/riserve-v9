import React, { useState, useEffect } from 'react';
import { Search, X, ChevronDown, ChevronRight, RefreshCw, AlertCircle, PlusCircle } from 'lucide-react';
import { booksApi } from '../../services/booksApi';

const SOURCE_LABELS = {
  booking: { label: 'Booking', color: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' },
  membership: { label: 'Membership', color: 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400' },
  marketplace: { label: 'Marketplace', color: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' },
  inventory: { label: 'Inventory', color: 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400' },
  invoice: { label: 'Invoice', color: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400' },
  manual: { label: 'Manual', color: 'bg-card border-border text-foreground/60' },
};

const Ledger = () => {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [entryDetail, setEntryDetail] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [voidingId, setVoidingId] = useState(null);

  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    source_module: '',
    status: '',
  });

  const load = async (p = page) => {
    try {
      setLoading(true);
      const params = { page: p, page_size: 30 };
      if (filters.from_date) params.from_date = filters.from_date;
      if (filters.to_date) params.to_date = filters.to_date;
      if (filters.source_module) params.source_module = filters.source_module;
      if (filters.status) params.status = filters.status;
      const res = await booksApi.getJournalEntries(params);
      setEntries(res.data.entries || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await booksApi.getAccounts();
      setAccounts(res.data || []);
    } catch (e) {}
  };

  useEffect(() => { load(1); setPage(1); }, [filters]);
  useEffect(() => { load(); }, [page]);
  useEffect(() => { loadAccounts(); }, []);

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!entryDetail[id]) {
      try {
        const res = await booksApi.getJournalEntry(id);
        setEntryDetail(prev => ({ ...prev, [id]: res.data }));
      } catch (e) {}
    }
  };

  const handleVoid = async (id) => {
    const reason = window.prompt('Void reason:');
    if (!reason) return;
    try {
      setVoidingId(id);
      await booksApi.voidJournalEntry(id, reason);
      load();
    } catch (e) {
      alert('Failed to void entry');
    } finally {
      setVoidingId(null);
    }
  };

  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-foreground/50">From</label>
          <input type="date" value={filters.from_date}
            onChange={e => setFilters(f => ({ ...f, from_date: e.target.value }))}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-foreground/50">To</label>
          <input type="date" value={filters.to_date}
            onChange={e => setFilters(f => ({ ...f, to_date: e.target.value }))}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-foreground/50">Module</label>
          <select value={filters.source_module}
            onChange={e => setFilters(f => ({ ...f, source_module: e.target.value }))}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20">
            <option value="">All</option>
            {Object.keys(SOURCE_LABELS).map(k => (
              <option key={k} value={k}>{SOURCE_LABELS[k].label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-foreground/50">Status</label>
          <select value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20">
            <option value="">All</option>
            <option value="posted">Posted</option>
            <option value="voided">Voided</option>
          </select>
        </div>
        {(filters.from_date || filters.to_date || filters.source_module || filters.status) && (
          <button onClick={() => setFilters({ from_date: '', to_date: '', source_module: '', status: '' })}
            className="flex items-center gap-1 px-3 py-2 text-sm text-foreground/60 hover:text-foreground border border-border rounded-lg bg-background transition-all">
            <X size={14} /> Clear
          </button>
        )}
        <div className="ml-auto">
          <button onClick={() => setShowNewEntry(true)}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-all">
            <PlusCircle size={15} /> New Entry
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm text-foreground/60">{total} entries</span>
          {loading && <RefreshCw size={14} className="animate-spin text-foreground/40" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-background border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wider w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wider">Entry #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wider">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map(e => {
                const src = SOURCE_LABELS[e.source_module] || SOURCE_LABELS.manual;
                const isExpanded = expandedId === e.id;
                const detail = entryDetail[e.id];
                return (
                  <React.Fragment key={e.id}>
                    <tr
                      className="hover:bg-background/50 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(e.id)}
                    >
                      <td className="px-4 py-3">
                        {isExpanded ? <ChevronDown size={14} className="text-foreground/40" /> : <ChevronRight size={14} className="text-foreground/40" />}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground/60">{e.entry_number}</td>
                      <td className="px-4 py-3 text-sm text-foreground/80">{e.entry_date}</td>
                      <td className="px-4 py-3 text-sm text-foreground max-w-xs truncate">{e.description}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${src.color}`}>{src.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          e.status === 'posted' ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' :
                          e.status === 'voided' ? 'bg-foreground/5 border-border text-foreground/40 line-through' :
                          'bg-card border-border text-foreground/60'
                        }`}>{e.status}</span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 bg-background/30">
                          {!detail ? (
                            <div className="flex items-center gap-2 text-sm text-foreground/40">
                              <RefreshCw size={12} className="animate-spin" /> Loading…
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs text-foreground/40 uppercase">
                                    <th className="text-left pb-1">Account</th>
                                    <th className="text-right pb-1">Debit</th>
                                    <th className="text-right pb-1">Credit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(detail.lines || []).map(l => {
                                    const acct = accounts.find(a => a.id === l.account_id);
                                    return (
                                      <tr key={l.id}>
                                        <td className="py-0.5 text-foreground/80">{acct ? `${acct.code} – ${acct.name}` : l.account_id}</td>
                                        <td className="py-0.5 text-right font-mono">{l.debit > 0 ? `₹${l.debit.toLocaleString('en-IN')}` : '—'}</td>
                                        <td className="py-0.5 text-right font-mono">{l.credit > 0 ? `₹${l.credit.toLocaleString('en-IN')}` : '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              {e.status === 'posted' && e.source_module === 'manual' && (
                                <button
                                  onClick={(ev) => { ev.stopPropagation(); handleVoid(e.id); }}
                                  disabled={voidingId === e.id}
                                  className="text-xs text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                                >
                                  {voidingId === e.id ? 'Voiding…' : 'Void this entry'}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {!loading && entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-foreground/40">
                    No journal entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-background">
            <span className="text-sm text-foreground/50">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 text-sm border border-border rounded-lg bg-card disabled:opacity-40 hover:bg-background transition-all">
                Prev
              </button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 text-sm border border-border rounded-lg bg-card disabled:opacity-40 hover:bg-background transition-all">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Entry Modal */}
      {showNewEntry && (
        <ManualEntryModal
          accounts={accounts}
          onClose={() => setShowNewEntry(false)}
          onSaved={() => { setShowNewEntry(false); load(1); }}
        />
      )}
    </div>
  );
};

const ManualEntryModal = ({ accounts, onClose, onSaved }) => {
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    description: '',
    lines: [
      { account_id: '', debit: '', credit: '', description: '' },
      { account_id: '', debit: '', credit: '', description: '' },
    ],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const totalDebit = form.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const setLine = (i, field, val) => {
    setForm(f => {
      const lines = [...f.lines];
      lines[i] = { ...lines[i], [field]: val };
      return { ...f, lines };
    });
  };

  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { account_id: '', debit: '', credit: '', description: '' }] }));

  const removeLine = (i) => setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    if (!balanced) { setError('Entry is not balanced'); return; }
    try {
      setSaving(true);
      setError(null);
      await booksApi.createJournalEntry({
        entry_date: form.entry_date,
        description: form.description,
        lines: form.lines.map(l => ({
          account_id: l.account_id,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          description: l.description,
        })),
      });
      onSaved();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">New Manual Journal Entry</h3>
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
            <div>
              <label className="text-xs text-foreground/50 block mb-1">Date</label>
              <input type="date" value={form.entry_date}
                onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20" />
            </div>
            <div>
              <label className="text-xs text-foreground/50 block mb-1">Description</label>
              <input type="text" value={form.description} placeholder="e.g. Opening balance adjustment"
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs text-foreground/40 uppercase px-1">
              <span className="col-span-4">Account</span>
              <span className="col-span-3 text-right">Debit</span>
              <span className="col-span-3 text-right">Credit</span>
              <span className="col-span-2"></span>
            </div>
            {form.lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <select value={line.account_id} onChange={e => setLine(i, 'account_id', e.target.value)}
                  className="col-span-4 px-2 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20">
                  <option value="">Select account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
                  ))}
                </select>
                <input type="number" value={line.debit} placeholder="0.00" min="0"
                  onChange={e => setLine(i, 'debit', e.target.value)}
                  className="col-span-3 px-2 py-2 bg-background border border-border rounded-lg text-sm text-foreground text-right focus:outline-none focus:ring-1 focus:ring-foreground/20" />
                <input type="number" value={line.credit} placeholder="0.00" min="0"
                  onChange={e => setLine(i, 'credit', e.target.value)}
                  className="col-span-3 px-2 py-2 bg-background border border-border rounded-lg text-sm text-foreground text-right focus:outline-none focus:ring-1 focus:ring-foreground/20" />
                <button onClick={() => removeLine(i)} disabled={form.lines.length <= 2}
                  className="col-span-2 flex items-center justify-center text-foreground/30 hover:text-red-500 disabled:opacity-20 transition-all">
                  <X size={14} />
                </button>
              </div>
            ))}
            <button onClick={addLine} className="text-xs text-foreground/50 hover:text-foreground transition-all flex items-center gap-1">
              <PlusCircle size={13} /> Add line
            </button>
          </div>

          <div className="flex items-center justify-between pt-2 text-sm font-mono">
            <span className="text-foreground/50">Totals</span>
            <div className="flex gap-8">
              <span className={totalDebit > 0 ? 'text-foreground' : 'text-foreground/30'}>
                Dr ₹{totalDebit.toLocaleString('en-IN')}
              </span>
              <span className={totalCredit > 0 ? 'text-foreground' : 'text-foreground/30'}>
                Cr ₹{totalCredit.toLocaleString('en-IN')}
              </span>
              <span className={balanced ? 'text-green-500' : 'text-red-500'}>
                {balanced ? '✓ Balanced' : '✗ Not balanced'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-foreground/60 hover:text-foreground transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !balanced || !form.description}
            className="px-5 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-all disabled:opacity-50">
            {saving ? 'Saving…' : 'Post Entry'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Ledger;
