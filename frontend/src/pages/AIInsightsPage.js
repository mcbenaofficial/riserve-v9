import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  BrainCircuit, Sparkles, DollarSign, Clock, ArrowUpRight, CheckCircle2
} from 'lucide-react';
import InsightCard from '../components/hitl/InsightCard';
import InsightDetailDrawer from '../components/hitl/InsightDetailDrawer';

// Estimated hours saved per approved flow type
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

  const widgets = [
    {
      label: 'Total Insights',
      value: loading ? '—' : (pendingReports.length + historyReports.length).toLocaleString(),
      icon: BrainCircuit,
      color: 'text-primary',
      bg: 'bg-primary/10',
      sub: 'Derived by AI agents',
    },
    {
      label: 'Value Generated',
      value: loading ? '—' : `$${(summary?.total_value_gained || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      sub: 'Estimated positive impact',
    },
    {
      label: 'Hours Saved',
      value: loading ? '—' : `${hoursSaved.toFixed(1)}h`,
      icon: Clock,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      sub: 'From approved actions',
    },
    {
      label: 'Promotions Created',
      value: loading ? '—' : promotionsCreated.toLocaleString(),
      icon: Sparkles,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      sub: 'Customer-facing campaigns',
    },
  ];

  const handleConfirm = (reportId) => {
    setPendingReports((prev) => prev.filter((r) => r.id !== reportId));
    setSelectedReport(null);
  };

  return (
    <div className="min-h-full bg-background p-6 space-y-8 pb-24 max-w-7xl mx-auto">

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BrainCircuit className="text-primary" size={30} />
          AI Insights
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Executive recommendations from your AI agents — review, approve, and track outcomes.
        </p>
      </div>

      {/* Performance widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {widgets.map((w) => (
          <div
            key={w.label}
            className="bg-card border border-border/50 rounded-xl p-5 relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {w.label}
                </p>
                <h3 className="text-2xl font-bold mt-1 tracking-tight">
                  {w.value}
                </h3>
              </div>
              <div className={`w-10 h-10 rounded-full ${w.bg} flex items-center justify-center ${w.color} shrink-0`}>
                <w.icon size={18} />
              </div>
            </div>
            <p className={`text-xs text-muted-foreground mt-3 flex items-center gap-1`}>
              <ArrowUpRight size={12} className={w.color} />
              {w.sub}
            </p>
            <div className={`absolute -bottom-6 -right-6 w-20 h-20 ${w.bg} rounded-full blur-2xl pointer-events-none`} />
          </div>
        ))}
      </div>

      {/* Tabs + content */}
      <div>
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/50 w-fit">
          {[
            { key: 'new', label: 'New Insights', count: pendingReports.length },
            { key: 'past', label: 'Past Insights', count: historyReports.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-card text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === tab.key
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {loading ? '…' : tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-44 rounded-xl bg-muted/30 animate-pulse border border-border/30" />
              ))}
            </div>
          ) : activeTab === 'new' ? (
            pendingReports.length === 0 ? (
              <EmptyState message="No pending insights. Your agents are watching for opportunities." />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pendingReports.map((r) => (
                  <InsightCard
                    key={r.id}
                    report={r}
                    isPast={false}
                    onReview={() => setSelectedReport(r)}
                  />
                ))}
              </div>
            )
          ) : historyReports.length === 0 ? (
            <EmptyState message="No past insights yet. Approved and declined recommendations will appear here." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {historyReports.map((r) => (
                <InsightCard
                  key={r.id}
                  report={r}
                  isPast={true}
                  onReview={() => setSelectedReport(r)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail drawer */}
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

const EmptyState = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-48 border border-dashed border-border/50 rounded-xl text-center px-6">
    <CheckCircle2 className="w-10 h-10 text-muted-foreground/30 mb-3" />
    <p className="text-muted-foreground text-sm max-w-xs">{message}</p>
  </div>
);

export default AIInsightsPage;
