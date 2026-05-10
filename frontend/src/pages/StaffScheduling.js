import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, ArrowRight, Check, X, TrendingUp, Users, DollarSign,
  Clock, Loader2, Brain, Zap
} from 'lucide-react';

const StaffScheduling = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isApplied, setIsApplied] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem('ridn_token');
        const response = await fetch(
          `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/analytics/staff-scheduling`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.ok) setData(await response.json());
      } catch (err) {
        console.error('Failed to fetch staff scheduling data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const getHeatmapColor = (value) => {
    if (value >= 100) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (value >= 85)  return 'bg-red-500/15 text-red-400 border-red-500/20';
    if (value >= 70)  return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (value >= 50)  return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';
  };

  const getProgressColor = (utilization) => {
    if (utilization >= 75) return 'bg-emerald-500';
    if (utilization >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl accent-gradient-bg flex items-center justify-center">
            <Brain size={22} className="text-white animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Running CPO Agent Analysis…</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl accent-gradient-bg flex items-center justify-center flex-shrink-0">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">AI Workforce Insights</h1>
            <p className="text-sm text-muted-foreground mt-0.5">CPO Agent · AI-driven analysis of booking patterns and staff utilization</p>
          </div>
        </div>
      </div>

      {/* Pipeline Flow */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Analysis Pipeline</p>
        <div className="flex items-center gap-3">
          {data.pipeline_steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div className="flex-1 flex items-center gap-3 bg-muted/50 rounded-xl p-3.5">
                <div className="w-6 h-6 rounded-full accent-gradient-bg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                  {idx + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.subtitle}</p>
                </div>
              </div>
              {idx < data.pipeline_steps.length - 1 && (
                <ArrowRight size={16} className="text-muted-foreground flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Alert Banner */}
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-4 border-l-4 border-l-amber-500">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-amber-500">{data.alert.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{data.alert.message}</p>
          </div>
        </div>
        <button
          onClick={() => {
            document.getElementById('recommendations-panel')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="whitespace-nowrap px-4 py-2 accent-gradient-bg text-white text-sm font-semibold rounded-xl transition-opacity hover:opacity-90 flex-shrink-0"
        >
          View Recommendations
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label={data.kpi_metrics.idle_time_label}
          value={data.kpi_metrics.idle_time}
          icon={Clock}
          variant="negative"
        />
        <KpiCard
          label={data.kpi_metrics.overbooking_label}
          value={data.kpi_metrics.overbooking}
          icon={AlertTriangle}
          variant="negative"
        />
        <KpiCard
          label="Payroll Savings Potential"
          value={data.kpi_metrics.savings_potential}
          icon={DollarSign}
          variant="positive"
        />
        <KpiCard
          label="Monthly Wage Savings"
          value={data.kpi_metrics.monthly_savings}
          icon={TrendingUp}
          variant="positive"
        />
      </div>

      {/* Utilization Heatmap */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-foreground">Weekly Utilization Heatmap</h3>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40 inline-block" />Under</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/40 inline-block" />Optimal</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500/40 inline-block" />Over</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-5">Booking density by day and time slot. Red = overbooked, Amber = optimal, Green = underutilized.</p>

        <div className="w-full overflow-x-auto">
          {/* Header */}
          <div className="flex w-full mb-1.5">
            <div className="w-20 flex-shrink-0" />
            <div className="flex-1 grid grid-cols-7 gap-1">
              {data.heatmap.days.map(day => (
                <div key={day} className="text-xs font-semibold text-muted-foreground text-center py-1">{day}</div>
              ))}
            </div>
          </div>
          {/* Rows */}
          {data.heatmap.time_slots.map((time, rowIdx) => (
            <div key={time} className="flex w-full mb-1">
              <div className="w-20 flex-shrink-0 text-xs text-muted-foreground pr-3 flex items-center justify-end tabular-nums">
                {time}
              </div>
              <div className="flex-1 grid grid-cols-7 gap-1">
                {data.heatmap.data.map((col, colIdx) => {
                  const val = col[rowIdx];
                  return (
                    <div
                      key={`${rowIdx}-${colIdx}`}
                      className={`h-10 flex items-center justify-center text-xs font-bold border rounded-lg ${getHeatmapColor(val)}`}
                    >
                      {val}%
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stylist Utilization Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <Users size={16} className="text-muted-foreground" />
          <h3 className="text-base font-semibold text-foreground">Stylist Utilization — {data.outlet_name}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stylist</th>
                <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Utilization</th>
                <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Idle hrs/wk</th>
                <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Peak Slot</th>
                <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.stylists.map((stylist, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors duration-150">
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-foreground">{stylist.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stylist.role}</p>
                  </td>
                  <td className="px-6 py-4 w-40">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-foreground">{stylist.utilization}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getProgressColor(stylist.utilization)}`}
                        style={{ width: `${stylist.utilization}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground font-medium">{stylist.idle} hrs</td>
                  <td className={`px-6 py-4 text-sm font-semibold ${stylist.peakColor}`}>{stylist.peak}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={stylist.status} />
                  </td>
                  <td className="px-6 py-4">
                    {stylist.actionType === 'primary' ? (
                      <button className="px-3 py-1.5 accent-gradient-bg text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity">
                        {stylist.actionText}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">{stylist.actionText}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CPO Agent Recommendations */}
      <div id="recommendations-panel" className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-10">

        {/* Recommendations */}
        <div className="col-span-full bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl accent-gradient-bg flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">CPO Agent Recommendations</h3>
              <p className="text-xs text-muted-foreground">AI-generated schedule optimizations</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {data.recommendations.map(rec => (
              <div key={rec.id} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={11} strokeWidth={3} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{rec.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{rec.description}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setIsApplied(true)}
            disabled={isApplied}
            className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              isApplied
                ? 'bg-emerald-500/15 text-emerald-500 cursor-default'
                : 'accent-gradient-bg text-white hover:opacity-90'
            }`}
          >
            {isApplied ? '✓ Recommendations Applied' : 'Apply All Recommendations'}
          </button>
        </div>

        {/* Current State */}
        <div className="bg-card border border-border rounded-2xl p-6 border-l-4 border-l-red-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center">
              <X size={16} strokeWidth={2.5} className="text-red-500" />
            </div>
            <h3 className="text-sm font-bold text-red-500">Current State</h3>
          </div>
          <ul className="space-y-3">
            {data.comparison_current.map((item, i) => (
              <li key={i} className="flex gap-3 items-start">
                <X size={14} strokeWidth={2.5} className="text-red-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Optimized State */}
        <div className="bg-card border border-border rounded-2xl p-6 border-l-4 border-l-emerald-500">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Check size={16} strokeWidth={2.5} className="text-emerald-500" />
            </div>
            <h3 className="text-sm font-bold text-emerald-500">Optimised State (CPO Agent)</h3>
          </div>
          <ul className="space-y-3">
            {data.comparison_optimized.map((item, i) => (
              <li key={i} className="flex gap-3 items-start">
                <Check size={14} strokeWidth={2.5} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};

const KpiCard = ({ label, value, icon: Icon, variant }) => {
  const isPositive = variant === 'positive';
  return (
    <div className={`rounded-2xl p-5 text-white ${
      isPositive
        ? 'bg-gradient-to-br from-emerald-500 to-green-600 dark:from-emerald-700 dark:to-green-800'
        : 'bg-gradient-to-br from-pink-500 to-rose-600'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-xs text-white/80 mt-1.5 font-medium leading-snug">{label}</p>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const lower = (status || '').toLowerCase();
  if (lower === 'overloaded' || lower === 'critical')
    return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">{status}</span>;
  if (lower === 'optimal' || lower === 'active')
    return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">{status}</span>;
  if (lower === 'underutilized' || lower === 'idle')
    return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{status}</span>;
  return <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-muted text-muted-foreground">{status}</span>;
};

export default StaffScheduling;
