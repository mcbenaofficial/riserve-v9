import React, { useState, useCallback } from 'react';
import { RefreshCw, Download, AlertCircle, TrendingUp, TrendingDown, Scale, BarChart3, Receipt, FileText } from 'lucide-react';
import { booksApi } from '../../services/booksApi';

const fmt = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtPct = (n) => `${(Number(n) || 0).toFixed(2)}%`;

// ─── Period Picker ────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];
const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const firstOfYear = () => `${new Date().getFullYear()}-04-01`; // Indian FY

const PRESETS_RANGE = [
  { label: 'MTD', from: firstOfMonth, to: today },
  { label: 'YTD', from: firstOfYear, to: today },
  { label: 'Last 30d', from: () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; }, to: today },
  { label: 'Last 90d', from: () => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0]; }, to: today },
];

const inputClass = "px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20";

const RangePicker = ({ from, to, onChange }) => (
  <div className="flex flex-wrap items-center gap-2">
    {PRESETS_RANGE.map(p => (
      <button key={p.label}
        onClick={() => onChange(p.from(), p.to())}
        className="px-3 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground/60 hover:text-foreground hover:bg-card transition-all">
        {p.label}
      </button>
    ))}
    <input type="date" value={from} onChange={e => onChange(e.target.value, to)} className={inputClass} />
    <span className="text-foreground/30 text-sm">→</span>
    <input type="date" value={to} onChange={e => onChange(from, e.target.value)} className={inputClass} />
  </div>
);

const AsOfPicker = ({ asOf, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-sm text-foreground/50">As of</span>
    <input type="date" value={asOf} onChange={e => onChange(e.target.value)} className={inputClass} />
  </div>
);

// ─── CSV Export ───────────────────────────────────────────────────────────────
const downloadCSV = (filename, rows) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ─── Report shell ─────────────────────────────────────────────────────────────
const ReportShell = ({ title, icon: Icon, controls, loading, error, onLoad, csvData, csvName, children }) => (
  <div className="space-y-4">
    <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap gap-3 items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-foreground/60" />
        <span className="font-semibold text-sm text-foreground">{title}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {controls}
        <button onClick={onLoad} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-all disabled:opacity-50">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Run
        </button>
        {csvData?.length > 0 && (
          <button onClick={() => downloadCSV(csvName, csvData)}
            className="flex items-center gap-2 px-3 py-2 border border-border bg-background rounded-xl text-sm text-foreground/60 hover:text-foreground transition-all">
            <Download size={14} /> CSV
          </button>
        )}
      </div>
    </div>
    {error && (
      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
        <AlertCircle size={14} /> {error}
      </div>
    )}
    {children}
  </div>
);

// ─── P&L Report ───────────────────────────────────────────────────────────────
const PLReport = () => {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try { setLoading(true); setError(null);
      const res = await booksApi.getPLReport(from, to);
      setData(res.data);
    } catch (e) { setError('Failed to load P&L'); } finally { setLoading(false); }
  };

  const incomeRows = data?.rows?.filter(r => r.account.account_type === 'income') || [];
  const expenseRows = data?.rows?.filter(r => r.account.account_type === 'expense') || [];
  const csvData = data?.rows?.map(r => ({ code: r.account.code, name: r.account.name, type: r.account.account_type, amount: r.amount })) || [];

  return (
    <ReportShell title="Profit & Loss" icon={TrendingUp}
      controls={<RangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />}
      loading={loading} error={error} onLoad={load} csvData={csvData} csvName={`pl_${from}_${to}.csv`}>
      {data && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border text-xs text-foreground/40 font-medium">
            {data.from_date} — {data.to_date}
          </div>
          <div className="p-5 space-y-6">
            <ReportSection label="Revenue" rows={incomeRows} total={data.total_income} positive />
            <div className="border-t border-border pt-4">
              <ReportSection label="Expenses" rows={expenseRows} total={data.total_expenses} />
            </div>
            <div className="border-t-2 border-foreground/20 pt-4 flex justify-between items-center">
              <span className="font-bold text-foreground">Net Profit</span>
              <span className={`font-bold text-lg font-mono ${data.net_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {fmt(data.net_profit)}
              </span>
            </div>
          </div>
        </div>
      )}
    </ReportShell>
  );
};

const ReportSection = ({ label, rows, total, positive }) => (
  <div>
    <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">{label}</p>
    {rows.map(r => (
      <div key={r.account.id} className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-foreground/30 w-10">{r.account.code}</span>
          <span className="text-sm text-foreground/80">{r.account.name}</span>
        </div>
        <span className="text-sm font-mono text-foreground">{fmt(r.amount)}</span>
      </div>
    ))}
    <div className="flex justify-between items-center pt-2 font-semibold">
      <span className="text-sm text-foreground">Total {label}</span>
      <span className={`text-sm font-mono ${positive ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>{fmt(total)}</span>
    </div>
  </div>
);

// ─── Balance Sheet ────────────────────────────────────────────────────────────
const BalanceSheet = () => {
  const [asOf, setAsOf] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try { setLoading(true); setError(null);
      const res = await booksApi.getBalanceSheet(asOf);
      setData(res.data);
    } catch (e) { setError('Failed to load Balance Sheet'); } finally { setLoading(false); }
  };

  const csvData = data ? [
    ...data.assets.map(a => ({ section: 'Asset', code: a.code, name: a.name, balance: a.balance })),
    ...data.liabilities.map(a => ({ section: 'Liability', code: a.code, name: a.name, balance: a.balance })),
    ...data.equity.map(a => ({ section: 'Equity', code: a.code, name: a.name, balance: a.balance })),
  ] : [];

  return (
    <ReportShell title="Balance Sheet" icon={Scale}
      controls={<AsOfPicker asOf={asOf} onChange={setAsOf} />}
      loading={loading} error={error} onLoad={load} csvData={csvData} csvName={`balance_sheet_${asOf}.csv`}>
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <BSSection label="Assets" rows={data.assets} total={data.total_assets} accent="blue" />
          </div>
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <BSSection label="Liabilities" rows={data.liabilities} total={data.total_liabilities} accent="red" />
            <div className="border-t border-border pt-4">
              <BSSection label="Equity" rows={data.equity} total={data.total_equity} accent="purple" />
            </div>
            <div className="border-t-2 border-foreground/20 pt-3 flex justify-between">
              <span className="font-semibold text-sm text-foreground">Total L + E</span>
              <span className="font-mono font-bold text-foreground">{fmt(data.total_liabilities_and_equity)}</span>
            </div>
          </div>
          {!data.is_balanced && (
            <div className="lg:col-span-2 flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 text-sm">
              <AlertCircle size={14} /> Balance sheet is out of balance — check for missing entries.
            </div>
          )}
        </div>
      )}
    </ReportShell>
  );
};

const ACCENT = { blue: 'text-blue-600 dark:text-blue-400', red: 'text-red-600 dark:text-red-400', purple: 'text-purple-600 dark:text-purple-400', green: 'text-green-600 dark:text-green-400' };

const BSSection = ({ label, rows, total, accent }) => (
  <div>
    <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${ACCENT[accent]}`}>{label}</p>
    {rows.map(r => (
      <div key={r.id} className="flex justify-between items-center py-1 border-b border-border/40 last:border-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-foreground/30 w-10">{r.code}</span>
          <span className="text-sm text-foreground/80">{r.name}</span>
        </div>
        <span className="text-sm font-mono text-foreground">{fmt(r.balance)}</span>
      </div>
    ))}
    <div className="flex justify-between pt-2 font-semibold">
      <span className="text-sm text-foreground">Total {label}</span>
      <span className={`text-sm font-mono ${ACCENT[accent]}`}>{fmt(total)}</span>
    </div>
  </div>
);

// ─── Trial Balance ────────────────────────────────────────────────────────────
const TrialBalance = () => {
  const [asOf, setAsOf] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try { setLoading(true); setError(null);
      const res = await booksApi.getTrialBalance(asOf);
      setData(res.data);
    } catch (e) { setError('Failed to load Trial Balance'); } finally { setLoading(false); }
  };

  return (
    <ReportShell title="Trial Balance" icon={BarChart3}
      controls={<AsOfPicker asOf={asOf} onChange={setAsOf} />}
      loading={loading} error={error} onLoad={load}
      csvData={data?.rows || []} csvName={`trial_balance_${asOf}.csv`}>
      {data && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full min-w-[500px]">
            <thead className="bg-background border-b border-border">
              <tr>
                {['Code', 'Account', 'Debit', 'Credit'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map(r => (
                <tr key={r.id} className="hover:bg-background/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground/40">{r.code}</td>
                  <td className="px-4 py-2.5 text-sm text-foreground">{r.name}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-foreground">{r.total_debit > 0 ? fmt(r.total_debit) : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm text-foreground">{r.total_credit > 0 ? fmt(r.total_credit) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-foreground/20 bg-background">
              <tr>
                <td colSpan={2} className="px-4 py-3 font-bold text-sm text-foreground">Totals</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{fmt(data.total_debit)}</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-foreground">{fmt(data.total_credit)}</td>
              </tr>
            </tfoot>
          </table>
          {!data.is_balanced && (
            <div className="m-4 flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 text-sm">
              <AlertCircle size={14} /> Trial balance is out of balance — check for missing entries.
            </div>
          )}
        </div>
      )}
    </ReportShell>
  );
};

// ─── Tax Summary ──────────────────────────────────────────────────────────────
const TaxSummary = () => {
  const [from, setFrom] = useState(firstOfYear());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try { setLoading(true); setError(null);
      const res = await booksApi.getTaxSummary(from, to);
      setData(res.data);
    } catch (e) { setError('Failed to load Tax Summary'); } finally { setLoading(false); }
  };

  return (
    <ReportShell title="GST Summary" icon={Receipt}
      controls={<RangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />}
      loading={loading} error={error} onLoad={load}
      csvData={data?.months || []} csvName={`gst_summary_${from}_${to}.csv`}>
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'GST Collected (Output)', value: fmt(data.total_output), accent: 'text-green-600 dark:text-green-400' },
              { label: 'GST Paid (Input)', value: fmt(data.total_input), accent: 'text-foreground/70' },
              { label: 'Net GST Payable', value: fmt(data.net_payable), accent: data.net_payable > 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400' },
            ].map(({ label, value, accent }) => (
              <div key={label} className="bg-card border border-border rounded-xl px-5 py-4">
                <p className="text-xs text-foreground/50">{label}</p>
                <p className={`text-xl font-bold font-mono mt-1 ${accent}`}>{value}</p>
              </div>
            ))}
          </div>
          {data.months.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    {['Month', 'GST Collected', 'GST Input', 'Net Payable'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.months.map(m => (
                    <tr key={m.month} className="hover:bg-background/30">
                      <td className="px-4 py-2.5 text-sm font-medium text-foreground">{m.month}</td>
                      <td className="px-4 py-2.5 font-mono text-sm text-green-600 dark:text-green-400">{fmt(m.gst_output)}</td>
                      <td className="px-4 py-2.5 font-mono text-sm text-foreground/70">{fmt(m.gst_input)}</td>
                      <td className={`px-4 py-2.5 font-mono text-sm font-semibold ${m.net_payable > 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{fmt(m.net_payable)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.months.length === 0 && (
            <p className="text-sm text-foreground/40 text-center py-8">No GST transactions found in this period.</p>
          )}
        </div>
      )}
    </ReportShell>
  );
};

// ─── Cash Flow ────────────────────────────────────────────────────────────────
const CashFlow = () => {
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try { setLoading(true); setError(null);
      const res = await booksApi.getCashFlow(from, to);
      setData(res.data);
    } catch (e) { setError('Failed to load Cash Flow'); } finally { setLoading(false); }
  };

  return (
    <ReportShell title="Cash Flow" icon={TrendingUp}
      controls={<RangePicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />}
      loading={loading} error={error} onLoad={load}
      csvData={data ? [...(data.inflows || []).map(r => ({ type: 'inflow', ...r })), ...(data.outflows || []).map(r => ({ type: 'outflow', ...r }))] : []}
      csvName={`cash_flow_${from}_${to}.csv`}>
      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Inflows', value: fmt(data.total_inflows), accent: 'text-green-600 dark:text-green-400' },
              { label: 'Total Outflows', value: fmt(data.total_outflows), accent: 'text-red-500' },
              { label: 'Net Cash Flow', value: fmt(data.net_cash_flow), accent: data.net_cash_flow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500' },
            ].map(({ label, value, accent }) => (
              <div key={label} className="bg-card border border-border rounded-xl px-5 py-4">
                <p className="text-xs text-foreground/50">{label}</p>
                <p className={`text-xl font-bold font-mono mt-1 ${accent}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CashFlowList label="Inflows" rows={data.inflows} accent="green" />
            <CashFlowList label="Outflows" rows={data.outflows} accent="red" />
          </div>
        </div>
      )}
    </ReportShell>
  );
};

const CashFlowList = ({ label, rows, accent }) => (
  <div className="bg-card border border-border rounded-2xl p-5">
    <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${ACCENT[accent]}`}>{label}</p>
    {rows.length === 0 && <p className="text-sm text-foreground/40">No {label.toLowerCase()} recorded.</p>}
    {rows.map((r, i) => (
      <div key={i} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
        <span className="text-sm text-foreground/80">{r.source}</span>
        <span className={`text-sm font-mono font-medium ${ACCENT[accent]}`}>{fmt(r.amount)}</span>
      </div>
    ))}
  </div>
);

// ─── Aged Receivables / Payables ──────────────────────────────────────────────
const BUCKET_LABELS = {
  current: 'Current (not due)',
  '1_30': '1–30 days',
  '31_60': '31–60 days',
  '61_90': '61–90 days',
  over_90: '90+ days',
};
const BUCKET_ACCENTS = { current: 'green', '1_30': 'blue', '31_60': 'amber', '61_90': 'orange', over_90: 'red' };
const BUCKET_STYLES = {
  green: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
  orange: 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400',
  red: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
};

const AgedReport = ({ title, icon: Icon, fetcher, csvName, idLabel, nameLabel }) => {
  const [asOf, setAsOf] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeBucket, setActiveBucket] = useState(null);

  const load = async () => {
    try { setLoading(true); setError(null);
      const res = await fetcher(asOf);
      setData(res.data);
      setActiveBucket(null);
    } catch (e) { setError(`Failed to load ${title}`); } finally { setLoading(false); }
  };

  const allRows = data ? Object.values(data.buckets).flat() : [];
  const csvData = allRows.map(r => ({ ...r }));

  return (
    <ReportShell title={title} icon={Icon}
      controls={<AsOfPicker asOf={asOf} onChange={setAsOf} />}
      loading={loading} error={error} onLoad={load} csvData={csvData} csvName={`${csvName}_${asOf}.csv`}>
      {data && (
        <div className="space-y-4">
          {/* Bucket summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(BUCKET_LABELS).map(([key, label]) => {
              const total = data.totals[key] || 0;
              const count = data.buckets[key]?.length || 0;
              const accent = BUCKET_ACCENTS[key];
              return (
                <button key={key}
                  onClick={() => setActiveBucket(activeBucket === key ? null : key)}
                  className={`text-left rounded-xl border px-4 py-3 transition-all ${activeBucket === key ? BUCKET_STYLES[accent] : 'bg-card border-border hover:bg-background'}`}>
                  <p className="text-xs text-foreground/50 mb-1">{label}</p>
                  <p className="text-base font-bold font-mono text-foreground">{fmt(total)}</p>
                  <p className="text-xs text-foreground/40">{count} item{count !== 1 ? 's' : ''}</p>
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center bg-card border border-border rounded-xl px-5 py-3">
            <span className="font-semibold text-sm text-foreground">Grand Total Outstanding</span>
            <span className="font-mono font-bold text-foreground text-lg">{fmt(data.grand_total)}</span>
          </div>

          {/* Detail table */}
          {activeBucket && data.buckets[activeBucket]?.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <span className="text-sm font-medium text-foreground">{BUCKET_LABELS[activeBucket]}</span>
              </div>
              <table className="w-full min-w-[500px]">
                <thead className="bg-background border-b border-border">
                  <tr>
                    {[idLabel, nameLabel, 'Date', 'Due', 'Total', 'Outstanding', 'Days Overdue'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-foreground/50 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.buckets[activeBucket].map(r => (
                    <tr key={r.id} className="hover:bg-background/30">
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground/50">{r[Object.keys(r).find(k => k.includes('number'))] || r.id.slice(0, 8)}</td>
                      <td className="px-4 py-2.5 text-sm text-foreground">{r.customer_name || r.vendor_name}</td>
                      <td className="px-4 py-2.5 text-sm text-foreground/60">{r.issue_date || r.bill_date}</td>
                      <td className="px-4 py-2.5 text-sm text-foreground/60">{r.due_date || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-sm text-foreground">{fmt(r.total_amount)}</td>
                      <td className="px-4 py-2.5 font-mono text-sm font-semibold text-red-500">{fmt(r.outstanding)}</td>
                      <td className="px-4 py-2.5 text-sm text-foreground/70">{r.days_overdue}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </ReportShell>
  );
};

// ─── Reports Shell ────────────────────────────────────────────────────────────
const REPORT_TABS = [
  { id: 'pl',       label: 'P&L',           icon: TrendingUp },
  { id: 'bs',       label: 'Balance Sheet', icon: Scale },
  { id: 'tb',       label: 'Trial Balance', icon: BarChart3 },
  { id: 'tax',      label: 'GST Summary',   icon: Receipt },
  { id: 'cf',       label: 'Cash Flow',     icon: TrendingDown },
  { id: 'aged-ar',  label: 'Aged AR',       icon: FileText },
  { id: 'aged-ap',  label: 'Aged AP',       icon: FileText },
];

const Reports = () => {
  const [activeReport, setActiveReport] = useState('pl');

  return (
    <div className="space-y-4">
      {/* Report type selector */}
      <div className="flex flex-wrap gap-1 p-1 bg-background border border-border rounded-xl">
        {REPORT_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id}
            onClick={() => setActiveReport(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeReport === id
                ? 'bg-card border border-border text-foreground shadow-sm'
                : 'text-foreground/50 hover:text-foreground'
            }`}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {activeReport === 'pl'      && <PLReport />}
      {activeReport === 'bs'      && <BalanceSheet />}
      {activeReport === 'tb'      && <TrialBalance />}
      {activeReport === 'tax'     && <TaxSummary />}
      {activeReport === 'cf'      && <CashFlow />}
      {activeReport === 'aged-ar' && (
        <AgedReport title="Aged Receivables" icon={FileText}
          fetcher={booksApi.getAgedReceivables} csvName="aged_ar"
          idLabel="Invoice #" nameLabel="Customer" />
      )}
      {activeReport === 'aged-ap' && (
        <AgedReport title="Aged Payables" icon={FileText}
          fetcher={booksApi.getAgedPayables} csvName="aged_ap"
          idLabel="Bill #" nameLabel="Vendor" />
      )}
    </div>
  );
};

export default Reports;
