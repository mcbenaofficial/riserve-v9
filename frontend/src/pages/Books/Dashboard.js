import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, BookOpen, ArrowRight, RefreshCw } from 'lucide-react';
import { booksApi } from '../../services/booksApi';

const fmt = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const Dashboard = ({ onActivate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await booksApi.getDashboard();
      setData(res.data);
      if (res.data?.activated) onActivate?.();
    } catch (e) {
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleActivate = async () => {
    try {
      setActivating(true);
      await booksApi.activateBooks();
      await load();
      onActivate?.();
    } catch (e) {
      setError('Activation failed');
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={20} className="animate-spin text-[#7D8590]" />
      </div>
    );
  }

  if (!data?.activated) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center">
          <BookOpen size={28} className="text-foreground/60" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Activate Books</h2>
          <p className="text-sm text-foreground/60 max-w-md">
            Books gives you a full double-entry ledger, P&L reports, expense tracking, and automatic journal entries from your bookings, memberships, and marketplace.
          </p>
        </div>
        <button
          onClick={handleActivate}
          disabled={activating}
          className="px-6 py-3 bg-foreground text-background rounded-xl font-semibold text-sm hover:bg-foreground/90 transition-all disabled:opacity-50"
        >
          {activating ? 'Activating…' : 'Activate Books — it\'s free'}
        </button>
        <p className="text-xs text-foreground/40">Seeds your Chart of Accounts with 20 accounts and 6 GST tax codes.</p>
      </div>
    );
  }

  const { pl_summary, bills_outstanding, account_balances, recent_entries } = data;

  const incomeAccounts = account_balances?.filter(a => a.account_type === 'income') || [];
  const expenseAccounts = account_balances?.filter(a => a.account_type === 'expense') || [];
  const assetAccounts = account_balances?.filter(a => a.account_type === 'asset') || [];
  const liabilityAccounts = account_balances?.filter(a => a.account_type === 'liability') || [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* P&L Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="MTD Revenue"
          value={fmt(pl_summary?.revenue)}
          icon={TrendingUp}
          accent="green"
        />
        <MetricCard
          label="MTD Expenses"
          value={fmt(pl_summary?.expenses)}
          icon={TrendingDown}
          accent="red"
        />
        <MetricCard
          label="Net Profit"
          value={fmt(pl_summary?.net_profit)}
          icon={DollarSign}
          accent={(pl_summary?.net_profit || 0) >= 0 ? 'blue' : 'red'}
        />
      </div>

      {/* Alerts */}
      {bills_outstanding?.count > 0 && (
        <div className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-amber-500" />
            <span className="text-sm font-medium text-foreground">
              {bills_outstanding.count} unpaid bill{bills_outstanding.count !== 1 ? 's' : ''} —{' '}
              <span className="text-amber-600 dark:text-amber-400">{fmt(bills_outstanding.total)} outstanding</span>
            </span>
          </div>
          <ArrowRight size={16} className="text-foreground/40" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Balances */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground text-sm">Account Balances</h3>
          {[
            { label: 'Assets', items: assetAccounts, sign: 1 },
            { label: 'Liabilities', items: liabilityAccounts, sign: -1 },
          ].map(({ label, items, sign }) =>
            items.length > 0 ? (
              <div key={label}>
                <p className="text-xs font-medium text-foreground/50 uppercase tracking-wider mb-2">{label}</p>
                <div className="space-y-1">
                  {items.slice(0, 4).map((a) => (
                    <div key={a.id} className="flex justify-between items-center py-1">
                      <span className="text-sm text-foreground/80">{a.name}</span>
                      <span className={`text-sm font-mono font-medium ${(a.balance * sign) >= 0 ? 'text-foreground' : 'text-red-500'}`}>
                        {fmt(a.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>

        {/* Recent Journal Entries */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h3 className="font-semibold text-foreground text-sm">Recent Journal Entries</h3>
          {recent_entries?.length === 0 && (
            <p className="text-sm text-foreground/50 py-4 text-center">No entries yet. Entries will appear here as payments come in.</p>
          )}
          <div className="space-y-2">
            {(recent_entries || []).map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-foreground/60 text-xs">{e.entry_number}</p>
                  <p className="text-sm text-foreground truncate">{e.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    e.source_module === 'booking' ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' :
                    e.source_module === 'membership' ? 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400' :
                    e.source_module === 'marketplace' ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400' :
                    'bg-card border-border text-foreground/60'
                  }`}>
                    {e.source_module || 'manual'}
                  </span>
                  <span className="text-xs text-foreground/40">{e.entry_date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ACCENT_CLASSES = {
  green: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
  red: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
};

const MetricCard = ({ label, value, icon: Icon, accent }) => (
  <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${ACCENT_CLASSES[accent]}`}>
      <Icon size={20} />
    </div>
    <div>
      <p className="text-xs text-foreground/50 font-medium">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  </div>
);

export default Dashboard;
