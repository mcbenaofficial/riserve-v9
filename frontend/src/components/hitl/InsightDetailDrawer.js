import React, { useState, useEffect } from 'react';
import {
  X, CheckCircle2, XCircle, Settings, Coins,
  Sparkles, TrendingUp, Package, CalendarX, Users,
  BrainCircuit, Zap
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  AreaChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { api } from '../../services/api';

const FLOW_CONFIG = {
  quiet_hour_promotion: { icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', accentBar: 'from-amber-500 to-orange-500', label: 'Promotion' },
  inventory_reorder:    { icon: Package,  color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', accentBar: 'from-emerald-500 to-teal-500', label: 'Inventory' },
  dynamic_pricing:      { icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', accentBar: 'from-blue-500 to-cyan-500', label: 'Dynamic Pricing' },
  staffing_suggestion:  { icon: Users,    color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20', accentBar: 'from-violet-500 to-purple-500', label: 'Staffing' },
  no_show_risk:         { icon: CalendarX, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20', accentBar: 'from-rose-500 to-pink-500', label: 'No-Show Risk' },
};

const STATUS_STYLES = {
  approved: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  modified: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  declined: 'text-rose-400 bg-rose-500/10 border-rose-500/25',
  pending:  'text-amber-400 bg-amber-500/10 border-amber-500/25',
};

const SectionLabel = ({ children }) => (
  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
    {children}
  </p>
);

const InsightDetailDrawer = ({ report, onClose, onConfirm }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [visible, setVisible] = useState(false);
  const [modifyMode, setModifyMode] = useState(false);
  const modifyTextareaRef = React.useRef(null);

  const isPast = report.status !== 'pending';
  const data = report.report_json || {};
  const confidence = data.confidence || report.confidence;

  const flowCfg = FLOW_CONFIG[report.flow_type] || {
    icon: BrainCircuit,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    accentBar: 'from-primary to-primary/50',
    label: report.flow_type.replace(/_/g, ' '),
  };
  const FlowIcon = flowCfg.icon;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const handleEnterModify = () => {
    setModifyMode(true);
    setTimeout(() => modifyTextareaRef.current?.focus(), 50);
  };

  const handleAction = async (action) => {
    try {
      setIsSubmitting(true);
      await api.confirmHITLReport({ report_id: report.id, action, reason: reason || undefined });
      onConfirm(report.id, action);
    } catch (err) {
      console.error('Failed to confirm report', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusStyle = STATUS_STYLES[report.status] || 'text-muted-foreground bg-muted border-border';

  const confidenceColor =
    confidence >= 85 ? 'bg-emerald-500' :
    confidence >= 70 ? 'bg-amber-500' :
    'bg-rose-500';

  const confidenceTextColor =
    confidence >= 85 ? 'text-emerald-400' :
    confidence >= 70 ? 'text-amber-400' :
    'text-rose-400';

  const confidenceLabel =
    confidence >= 90 ? 'Very high — data strongly supports this.' :
    confidence >= 75 ? 'High — most signals align.' :
    'Moderate — review carefully before approving.';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[59] transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Centered modal */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`
            pointer-events-auto w-full max-w-[660px] max-h-[88vh] flex flex-col
            bg-card border border-border rounded-3xl shadow-2xl overflow-hidden
            transition-all duration-200 ease-out
            ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}
          `}
        >
          {/* Colored accent bar */}
          <div className={`h-0.5 w-full bg-gradient-to-r ${flowCfg.accentBar} shrink-0`} />

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-border/50 shrink-0">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${flowCfg.bg} ${flowCfg.border}`}>
                  <FlowIcon size={11} className={flowCfg.color} />
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${flowCfg.color}`}>
                    {flowCfg.label}
                  </span>
                </div>
                <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold uppercase tracking-wide ${statusStyle}`}>
                  {report.status}
                </span>
              </div>
              <h2 className="text-[17px] font-bold tracking-tight leading-snug text-foreground">
                {data.recommended_action || 'AI Recommendation'}
              </h2>
              {data.what_this_is && (
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                  {data.what_this_is}
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              aria-label="Close"
              className="w-8 h-8 rounded-lg bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X size={15} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Confidence + AI Reasoning — side by side on wider modal */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">

              {/* Confidence */}
              {confidence && (
                <div className="sm:col-span-2 bg-muted/20 rounded-xl border border-border/50 p-4 flex flex-col justify-between gap-3">
                  <SectionLabel>Confidence</SectionLabel>
                  <div className="flex items-end gap-2">
                    <span className={`text-3xl font-bold tabular-nums tracking-tight ${confidenceTextColor}`}>
                      {confidence}%
                    </span>
                  </div>
                  <div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-1.5">
                      <div
                        className={`h-full ${confidenceColor} rounded-full transition-all duration-700 ease-out`}
                        style={{ width: `${confidence}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{confidenceLabel}</p>
                  </div>
                </div>
              )}

              {/* AI Reasoning */}
              <div className={`${confidence ? 'sm:col-span-3' : 'sm:col-span-5'}`}>
                <SectionLabel>AI Reasoning</SectionLabel>
                <div className="bg-muted/20 rounded-xl border border-border/50 p-4 h-full">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {data.why_recommended || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Chart */}
            {data.chart_data && data.chart_data.length > 0 && (
              <div>
                <SectionLabel>Data Context</SectionLabel>
                <div className="h-[220px] w-full bg-background/50 rounded-xl border border-border/50 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.chart_data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="modalInsightGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.4} />
                      <XAxis
                        dataKey="name"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(v) => data.chart_type === 'currency' ? `₹${v}` : v}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: 'hsl(var(--foreground))',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                        }}
                        cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        name={data.chart_type === 'inventory' ? 'Stock Level' : 'Actual'}
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#modalInsightGrad)"
                        dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                        animationDuration={800}
                      />
                      {data.chart_data[0]?.threshold !== undefined && (
                        <Line
                          type="monotone"
                          dataKey="threshold"
                          name={data.chart_type === 'inventory' ? 'Reorder Level' : 'Threshold'}
                          stroke="#ef4444"
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      )}
                      {data.chart_data[0]?.goal !== undefined && (
                        <Line
                          type="monotone"
                          dataKey="goal"
                          name="Target"
                          stroke="#10b981"
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          dot={false}
                        />
                      )}
                      {(data.chart_data[0]?.threshold !== undefined || data.chart_data[0]?.goal !== undefined) && (
                        <Legend
                          iconSize={8}
                          wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Recommended Action */}
            <div>
              <SectionLabel>Recommended Action</SectionLabel>
              <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap size={13} className="text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  {data.recommended_action || '—'}
                </p>
              </div>
            </div>

            {/* How It Works + Who It Affects */}
            {(data.how_it_works?.length > 0 || data.who_it_affects?.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.how_it_works?.length > 0 && (
                  <div>
                    <SectionLabel>How It Works</SectionLabel>
                    <ol className="space-y-2">
                      {data.how_it_works.map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                          <span className="w-4 h-4 rounded-full bg-muted border border-border/50 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {data.who_it_affects?.length > 0 && (
                  <div>
                    <SectionLabel>Who It Affects</SectionLabel>
                    <ul className="space-y-1.5">
                      {data.who_it_affects.map((role, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border/30">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
                          {role}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* AI Execution Cost */}
            {data.cost_credits !== undefined && (
              <div className="flex items-center justify-between px-4 py-3 bg-muted/20 rounded-xl border border-border/40">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Coins size={13} className="text-primary" />
                  AI Execution Cost
                </div>
                <span className="text-xs font-semibold text-primary">
                  {data.cost_credits > 0 ? `${data.cost_credits} Boost Credits` : 'Free (Included)'}
                </span>
              </div>
            )}

            {/* Resolution info (past) */}
            {isPast && (
              <div className="space-y-3">
                {report.resolution_reason && (
                  <div>
                    <SectionLabel>Resolution Notes</SectionLabel>
                    <div className="px-4 py-3 bg-muted/20 rounded-xl border border-border/40 text-xs text-muted-foreground italic leading-relaxed">
                      "{report.resolution_reason}"
                    </div>
                  </div>
                )}
                {report.resolved_at && (
                  <p className="text-xs text-muted-foreground">
                    Resolved {new Date(report.resolved_at).toLocaleDateString([], { dateStyle: 'long' })}
                    {report.resolved_by && (
                      <span className="text-muted-foreground/70"> · by {report.resolved_by}</span>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Feedback / Modify textarea (pending only) */}
            {!isPast && (
              <div>
                {modifyMode ? (
                  <>
                    <SectionLabel>Describe Your Modification</SectionLabel>
                    <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 overflow-hidden">
                      <textarea
                        ref={modifyTextareaRef}
                        className="w-full h-24 bg-transparent px-4 py-3 text-xs resize-none focus:outline-none text-foreground placeholder:text-muted-foreground/60"
                        placeholder="Describe what you'd like to change — e.g. 'Apply a 15% discount instead of 20%, limit to Friday evenings only.'"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                      <div className="px-4 py-2 border-t border-blue-500/20">
                        <p className="text-[10px] text-blue-400/80">Your notes will be saved with this record and used to improve future recommendations.</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <SectionLabel>Feedback (Optional)</SectionLabel>
                    <textarea
                      className="w-full h-16 bg-background border border-border/60 rounded-xl px-4 py-3 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground/60 transition-colors"
                      placeholder="Help the AI learn — tell it why you approved or declined this action..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action footer — pending only */}
          {!isPast && (
            <div className="px-6 py-4 border-t border-border/50 bg-muted/10 shrink-0">
              {modifyMode ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-muted-foreground hover:text-foreground"
                    onClick={() => { setModifyMode(false); setReason(''); }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="accent"
                    size="sm"
                    className="flex-[2] font-semibold"
                    onClick={() => handleAction('modified')}
                    disabled={isSubmitting || !reason.trim()}
                  >
                    <Settings size={14} className="mr-1.5" />
                    {isSubmitting ? 'Submitting…' : 'Submit Modification'}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20"
                    onClick={() => handleAction('declined')}
                    disabled={isSubmitting}
                  >
                    <XCircle size={14} className="mr-1.5" />
                    Decline
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleEnterModify}
                    disabled={isSubmitting}
                  >
                    <Settings size={14} className="mr-1.5" />
                    Modify
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
                    onClick={() => handleAction('approved')}
                    disabled={isSubmitting}
                  >
                    <CheckCircle2 size={14} className="mr-1.5" />
                    Approve
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default InsightDetailDrawer;
