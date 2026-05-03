import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  BrainCircuit, Sparkles, DollarSign, Clock,
  TrendingUp, CheckCircle2, Inbox
} from 'lucide-react';
import InsightCard from '../components/hitl/InsightCard';
import InsightDetailDrawer from '../components/hitl/InsightDetailDrawer';

const HOURS_BY_FLOW = {
  quiet_hour_promotion: 3,
  inventory_reorder: 1.5,
  dynamic_pricing: 4,
  staffing_suggestion: 2,
};

const AIInsightsPage = () => {
  const [activeTab, setActiveTab] = useState('new');
  const [pendingReports, setPendingReports] = useState([]);
  const [historyData, setHistoryData] = useState({ summary: null, reports: [] });
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [pendingRes, historyRes] = await Promise.all([
          api.getPendingHITLReports(),
          api.getHITLHistory(),
        ]);
        if (pendingRes.data?.reports) setPendingReports(pendingRes.data.reports);
        if (historyRes.data) {
          setHistoryData({
            summary: historyRes.data.summary || {},
            reports: historyRes.data.reports || [],
          });
        }
      } catch (err) {
        console.error('Error fetching insights', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const { summary, reports: historyReports } = historyData;

  const resolvedReports = historyReports.filter(
    (r) => r.status === 'approved' || r.status === 'modified'
  );

  const hoursSaved = resolvedReports.reduce(
    (acc, r) => acc + (HOURS_BY_FLOW[r.flow_type] || 2),
    0
  );

  const promotionsCreated = resolvedReports.filter((r) =>
    r.flow_type.includes('promotion')
  ).length;

  const stats = [
    {
      label: 'Total Insights',
      value: pendingReports.length + historyReports.length,
      display: (v) => v.toLocaleString(),
      icon: BrainCircuit,
      color: 'text-primary',
      iconBg: 'bg-primary/10',
      sub: 'Derived by AI agents',
      trend: '+' + pendingReports.length + ' pending review',
    },
    {
      label: 'Value Generated',
      value: summary?.total_value_gained || 0,
      display: (v) => `$${v.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      sub: 'Estimated impact',
      trend: 'From approved actions',
    },
    {
      label: 'Hours Saved',
      value: hoursSaved,
      display: (v) => `${v.toFixed(1)}h`,
      icon: Clock,
      color: 'text-blue-400',
      iconBg: 'bg-blue-500/10',
      sub: 'Operational time reclaimed',
      trend: `${resolvedReports.length} actions executed`,
    },
    {
      label: 'Campaigns Launched',
      value: promotionsCreated,
      display: (v) => v.toLocaleString(),
      icon: Sparkles,
      color: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
      sub: 'AI-driven promotions',
      trend: 'Customer-facing campaigns',
    },
  ];

  const handleConfirm = (reportId) => {
    setPendingReports((prev) => prev.filter((r) => r.id !== reportId));
    setSelectedReport(null);
  };

  const tabs = [
    { key: 'new', label: 'New Insights', count: pendingReports.length },
    { key: 'past', label: 'Past Insights', count: historyReports.length },
  ];

  const activeReports = activeTab === 'new' ? pendingReports : historyReports;

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8 pb-24 space-y-8">

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BrainCircuit size={16} className="text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                AI Insights
              </h1>
            </div>
            <p className="text-sm text-muted-foreground ml-[42px]">
              Executive recommendations from your AI agents — review, approve, and track outcomes.
            </p>
          </div>

          {!loading && pendingReports.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {pendingReports.length} awaiting review
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <StatCard key={s.label} stat={s} loading={loading} />
          ))}
        </div>

        {/* Tabs */}
        <div>
          <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border/40 w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
                  ${activeTab === tab.key
                    ? 'bg-card text-foreground shadow-sm border border-border/50'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                {tab.label}
                <span className={`
                  text-xs px-1.5 py-0.5 rounded-full font-semibold min-w-[20px] text-center tabular-nums
                  ${activeTab === tab.key ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}
                `}>
                  {loading ? '·' : tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Card grid */}
          <div className="mt-5">
            {loading ? (
              <SkeletonGrid />
            ) : activeReports.length === 0 ? (
              <EmptyState
                message={
                  activeTab === 'new'
                    ? 'No pending insights. Your agents are monitoring for opportunities.'
                    : 'No past insights yet. Approved and declined recommendations will appear here.'
                }
                isPast={activeTab === 'past'}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeReports.map((r) => (
                  <InsightCard
                    key={r.id}
                    report={r}
                    isPast={activeTab === 'past'}
                    onReview={() => setSelectedReport(r)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selectedReport && (
        <InsightDetailDrawer
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
};

const StatCard = ({ stat, loading }) => (
  <div className="group bg-card border border-border/50 rounded-xl p-5 relative overflow-hidden hover:border-border/80 transition-colors duration-200">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-9 h-9 rounded-lg ${stat.iconBg} flex items-center justify-center ${stat.color} shrink-0`}>
        <stat.icon size={17} />
      </div>
      <TrendingUp size={12} className="text-muted-foreground/40 mt-1" />
    </div>

    <div className="space-y-0.5 mb-3">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {stat.label}
      </p>
      {loading ? (
        <div className="h-8 w-20 bg-muted/40 rounded-md animate-pulse" />
      ) : (
        <p className="text-[26px] font-bold tracking-tight text-foreground tabular-nums leading-none">
          {stat.display(stat.value)}
        </p>
      )}
    </div>

    <p className="text-[11px] text-muted-foreground">{stat.trend}</p>

    {/* Subtle background glow */}
    <div className={`absolute -bottom-4 -right-4 w-16 h-16 ${stat.iconBg} rounded-full blur-xl pointer-events-none opacity-60`} />
  </div>
);

const SkeletonGrid = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {[...Array(6)].map((_, i) => (
      <div
        key={i}
        className="h-[148px] rounded-xl bg-muted/25 border border-border/25 animate-pulse"
        style={{ animationDelay: `${i * 80}ms` }}
      />
    ))}
  </div>
);

const EmptyState = ({ message, isPast }) => (
  <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border/40 rounded-xl text-center px-6 bg-muted/5">
    <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center mb-4">
      {isPast
        ? <CheckCircle2 size={22} className="text-muted-foreground/40" />
        : <Inbox size={22} className="text-muted-foreground/40" />
      }
    </div>
    <p className="text-sm font-medium text-foreground mb-1">
      {isPast ? 'No history yet' : 'All clear'}
    </p>
    <p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed">{message}</p>
  </div>
);

export default AIInsightsPage;
