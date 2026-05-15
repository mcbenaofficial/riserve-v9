import React, { useState, useEffect } from 'react';
import {
  X, Bot, CheckCircle2, Zap, BarChart3, Play,
  Loader2, Crown, ChevronRight, Plus, Pause,
} from 'lucide-react';
import { marketplaceApi } from '../../services/marketplaceApi';

const VALUE_METRIC_LABEL = {
  leads_qualified: 'Leads Qualified',
  time_saved_min: 'Minutes Saved',
  revenue_influenced_usd: 'Revenue Influenced',
  tasks_completed: 'Tasks Completed',
};

export default function AgentDetailDrawer({ agent, onClose, onSubscribe, onCancel, canSubscribe, tierKey }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runInput, setRunInput] = useState('');
  const [runResult, setRunResult] = useState(null);
  const [runError, setRunError] = useState(null);

  useEffect(() => {
    if (!agent) return;
    setLoading(true);
    setRunResult(null);
    setRunError(null);
    marketplaceApi.getAgent(agent.slug)
      .then(r => setDetail(r.data))
      .catch(() => setDetail(agent))
      .finally(() => setLoading(false));
  }, [agent?.slug]);

  const handleRun = async () => {
    if (!runInput.trim()) return;
    setRunning(true);
    setRunResult(null);
    setRunError(null);
    try {
      const res = await marketplaceApi.runAgent(agent.slug, { message: runInput });
      setRunResult(res.data);
    } catch (err) {
      setRunError(err.response?.data?.detail || 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  const data = detail || agent;
  const sub = data?.subscription;
  const isActive = sub?.status === 'active';
  const metrics = detail?.metrics;

  if (!agent) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-[60] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={data.accent_color
                ? { background: `linear-gradient(135deg, ${data.accent_color}40, ${data.accent_color}20)` }
                : { background: 'linear-gradient(135deg, #7c3aed33, #2563eb22)' }}
            >
              <Bot size={20} className="text-foreground/70" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{data.name}</h2>
              {data.tagline && <p className="text-xs text-muted-foreground">{data.tagline}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors duration-200">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Metrics row (if subscribed) */}
              {metrics && metrics.total_runs > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Runs', value: metrics.total_runs },
                    { label: 'Success Rate', value: `${metrics.success_rate}%` },
                    { label: VALUE_METRIC_LABEL[data.value_metric_type] || 'Value', value: Math.round(metrics.total_value || 0) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted rounded-xl p-3 text-center border border-border">
                      <p className="text-lg font-bold text-foreground">{value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Description */}
              {data.description && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">About</h3>
                  <p className="text-sm text-foreground/80 leading-relaxed">{data.description}</p>
                </div>
              )}

              {/* Capabilities */}
              {data.capabilities?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Capabilities</h3>
                  <ul className="space-y-2">
                    {data.capabilities.map((cap, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                        <ChevronRight size={14} className="text-accent mt-0.5 shrink-0" />
                        {cap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pricing */}
              <div className="bg-muted rounded-xl p-4 border border-border space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usage & Pricing</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Avg tokens per run</span>
                  <span className="text-foreground font-medium">{data.base_token_estimate?.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Price per 1K tokens</span>
                  <span className="text-foreground font-medium">
                    {data.price_per_1k_tokens > 0 ? `₹${data.price_per_1k_tokens}` : 'Included in plan'}
                  </span>
                </div>
                {data.value_metric_type && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Value metric</span>
                    <span className="text-accent font-medium flex items-center gap-1">
                      <Zap size={12} />
                      {VALUE_METRIC_LABEL[data.value_metric_type] || data.value_metric_type}
                    </span>
                  </div>
                )}
                {data.tier_required !== 'indie' && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Requires tier</span>
                    <span className="flex items-center gap-1 text-amber-400 font-medium">
                      <Crown size={12} />
                      {data.tier_required}+
                    </span>
                  </div>
                )}
              </div>

              {/* Run panel (only when subscribed) */}
              {isActive && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Try it now</h3>
                  <textarea
                    rows={3}
                    value={runInput}
                    onChange={e => setRunInput(e.target.value)}
                    placeholder="Type your request for this agent…"
                    className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <button
                    onClick={handleRun}
                    disabled={running || !runInput.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl accent-gradient-bg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity duration-200"
                  >
                    {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    {running ? 'Running…' : 'Run Agent'}
                  </button>

                  {runResult && (
                    <div className="bg-muted border border-emerald-500/20 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
                        <CheckCircle2 size={13} />
                        Completed in {runResult.duration_ms}ms · {runResult.tokens_used} tokens
                      </div>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{runResult.output}</p>
                      {runResult.value_metric_amount != null && (
                        <div className="flex items-center gap-1.5 text-xs text-accent pt-1">
                          <Zap size={11} />
                          {runResult.value_metric_amount} {VALUE_METRIC_LABEL[runResult.value_metric_type] || 'value'}
                        </div>
                      )}
                    </div>
                  )}

                  {runError && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-sm text-destructive">
                      {runError}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer CTA */}
        <div className="p-5 border-t border-border shrink-0">
          {!isActive && !sub ? (
            <button
              onClick={() => onSubscribe(data)}
              disabled={!canSubscribe}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl accent-gradient-bg text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity duration-200"
            >
              <Plus size={16} />
              {canSubscribe ? 'Add to My Team' : 'Upgrade Tier to Add'}
            </button>
          ) : isActive ? (
            <button
              onClick={() => onCancel(data)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-muted border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 font-medium transition-colors duration-200"
            >
              Remove from Team
            </button>
          ) : (
            <button
              onClick={() => onSubscribe(data)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl accent-gradient-bg text-white font-semibold hover:opacity-90 transition-opacity duration-200"
            >
              <Play size={16} />
              Reactivate
            </button>
          )}
        </div>
      </div>
    </>
  );
}
