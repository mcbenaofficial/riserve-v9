import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, Settings, Coins, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { api } from '../../services/api';

const STATUS_COLORS = {
  approved: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  modified: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  declined: 'text-red-500 bg-red-500/10 border-red-500/20',
  pending: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
};

const InsightDetailDrawer = ({ report, onClose, onConfirm }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [visible, setVisible] = useState(false);

  const isPast = report.status !== 'pending';
  const data = report.report_json || {};
  const confidence = data.confidence || report.confidence;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 280);
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

  const statusColor = STATUS_COLORS[report.status] || 'text-muted-foreground bg-muted border-border';

  const confidenceLabel =
    confidence >= 90 ? 'Very high confidence — data strongly supports this recommendation.' :
    confidence >= 75 ? 'High confidence — most data signals align.' :
    'Moderate confidence — review carefully before approving.';

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-[520px] bg-card border-l border-border z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border/50 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-semibold uppercase tracking-wide">
                {report.flow_type.replace(/_/g, ' ')}
              </span>
              <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold uppercase tracking-wide ${statusColor}`}>
                {report.status}
              </span>
            </div>
            <h2 className="text-lg font-bold tracking-tight leading-snug">
              {data.recommended_action || 'AI Recommendation'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Insight summary */}
          <section>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Insight</h4>
            <p className="text-sm text-foreground leading-relaxed">{data.what_this_is || '—'}</p>
          </section>

          {/* Confidence meter */}
          {confidence && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Confidence Level</h4>
                <span className="text-sm font-bold text-primary">{confidence}%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{confidenceLabel}</p>
            </section>
          )}

          {/* AI Reasoning */}
          <section>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">AI Reasoning</h4>
            <div className="p-4 bg-muted/30 rounded-lg border border-border/50 text-sm text-muted-foreground leading-relaxed">
              {data.why_recommended || '—'}
            </div>
          </section>

          {/* Chart */}
          {data.chart_data && data.chart_data.length > 0 && (
            <section>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Data Context</h4>
              <div className="h-[200px] w-full bg-background rounded-xl border border-border/50 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chart_data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="insightGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
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
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name={data.chart_type === 'inventory' ? 'Stock Level' : 'Actual'}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#insightGrad)"
                      dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      animationDuration={900}
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
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          {/* Recommended action */}
          <section>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Recommended Action</h4>
            <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <ChevronRight size={16} className="text-primary mt-0.5 shrink-0" />
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {data.recommended_action || '—'}
              </p>
            </div>
          </section>

          {/* How it works + Who it affects */}
          {(data.how_it_works?.length > 0 || data.who_it_affects?.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.how_it_works?.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">How It Works</h4>
                  <ol className="space-y-2">
                    {data.how_it_works.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="w-4 h-4 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              {data.who_it_affects?.length > 0 && (
                <section>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Who It Affects</h4>
                  <ul className="space-y-1.5">
                    {data.who_it_affects.map((role, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 px-2.5 py-1.5 rounded border border-border/30">
                        <div className="w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                        {role}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {/* AI credits */}
          {data.cost_credits !== undefined && (
            <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/15">
              <div className="flex items-center gap-2 text-xs text-foreground">
                <Coins size={14} className="text-primary" />
                AI Execution Cost
              </div>
              <span className="text-xs font-bold text-primary">
                {data.cost_credits > 0 ? `${data.cost_credits} Boost Credits` : 'Free (Included)'}
              </span>
            </div>
          )}

          {/* Resolution notes (past only) */}
          {isPast && report.resolution_reason && (
            <section>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Resolution Notes</h4>
              <div className="p-3 bg-muted/20 rounded-lg border border-border/40 text-xs text-muted-foreground italic">
                "{report.resolution_reason}"
              </div>
            </section>
          )}

          {/* Past resolved timestamp */}
          {isPast && report.resolved_at && (
            <p className="text-xs text-muted-foreground">
              Resolved on {new Date(report.resolved_at).toLocaleDateString([], { dateStyle: 'long' })}
              {report.resolved_by && ` by ${report.resolved_by}`}
            </p>
          )}

          {/* Feedback textarea (pending only) */}
          {!isPast && (
            <textarea
              className="w-full h-16 bg-background border border-border rounded-lg p-3 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder-muted-foreground"
              placeholder="Optional: feedback to help the AI learn from your decision..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </div>

        {/* Action footer (pending only) */}
        {!isPast && (
          <div className="p-5 border-t border-border/50 flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-600"
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
              onClick={() => handleAction('modified')}
              disabled={isSubmitting}
            >
              <Settings size={14} className="mr-1.5" />
              Modify
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              onClick={() => handleAction('approved')}
              disabled={isSubmitting}
            >
              <CheckCircle2 size={14} className="mr-1.5" />
              Approve
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

export default InsightDetailDrawer;
