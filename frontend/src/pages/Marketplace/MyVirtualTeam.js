import React, { useState } from 'react';
import {
  Bot, Zap, CheckCircle2, Pause, Trash2, Play, Loader2,
  TrendingUp, Clock, BarChart3, ChevronRight,
} from 'lucide-react';
import { marketplaceApi } from '../../services/marketplaceApi';

const VALUE_METRIC_LABEL = {
  leads_qualified: 'Leads',
  time_saved_min: 'Min Saved',
  revenue_influenced_usd: 'Revenue',
  tasks_completed: 'Tasks',
};

function MetricPill({ label, value, icon: Icon, accent }) {
  return (
    <div className="flex flex-col items-center text-center min-w-0">
      <span className={`text-base font-bold ${accent || 'text-foreground'}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">{label}</span>
    </div>
  );
}

function AgentTeamCard({ agent, onCancel, onPause, onRun }) {
  const sub = agent.subscription;
  const metrics = agent.metrics || {};
  const isActive = sub?.status === 'active';

  const [running, setRunning] = useState(false);
  const [showRunPanel, setShowRunPanel] = useState(false);
  const [runInput, setRunInput] = useState('');
  const [runResult, setRunResult] = useState(null);
  const [runError, setRunError] = useState(null);

  const handleRun = async () => {
    if (!runInput.trim()) return;
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      const res = await marketplaceApi.runAgent(agent.slug, { message: runInput });
      setRunResult(res.data);
    } catch (err) {
      setRunError(err.response?.data?.detail || 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={agent.accent_color
              ? { background: `linear-gradient(135deg, ${agent.accent_color}40, ${agent.accent_color}20)` }
              : { background: 'linear-gradient(135deg, #7c3aed33, #2563eb22)' }}
          >
            <Bot size={20} className="text-foreground/70" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">{agent.name}</h3>
            {agent.tagline && <p className="text-xs text-muted-foreground line-clamp-1">{agent.tagline}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isActive ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
              <CheckCircle2 size={9} /> Active
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
              <Pause size={9} /> Paused
            </span>
          )}
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-2 bg-muted rounded-xl p-3 border border-border">
        <MetricPill label="Runs" value={metrics.total_runs ?? 0} />
        <MetricPill
          label="Success"
          value={`${metrics.success_rate ?? 0}%`}
          accent={metrics.success_rate >= 80 ? 'text-emerald-400' : 'text-amber-400'}
        />
        <MetricPill
          label={VALUE_METRIC_LABEL[agent.value_metric_type] || 'Value'}
          value={Math.round(metrics.total_value ?? 0)}
          accent="text-accent"
        />
        <MetricPill label="Cost" value={`$${(metrics.total_cost_usd ?? 0).toFixed(2)}`} accent="text-muted-foreground" />
      </div>

      {metrics.last_run_at && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock size={11} />
          Last run {new Date(metrics.last_run_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Quick run panel */}
      {isActive && (
        <div>
          {!showRunPanel ? (
            <button
              onClick={() => setShowRunPanel(true)}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              <Play size={12} />
              Quick run
              <ChevronRight size={12} />
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                rows={2}
                value={runInput}
                onChange={e => setRunInput(e.target.value)}
                placeholder="Type your request…"
                className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRun}
                  disabled={running || !runInput.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg accent-gradient-bg text-white text-xs font-medium disabled:opacity-50 hover:opacity-90 transition-opacity duration-200"
                >
                  {running ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
                  Run
                </button>
                <button onClick={() => { setShowRunPanel(false); setRunResult(null); setRunError(null); }} className="text-xs text-muted-foreground hover:text-foreground px-2">
                  Cancel
                </button>
              </div>
              {runResult && (
                <div className="bg-muted border border-emerald-500/20 rounded-xl p-3 text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                  {runResult.output}
                </div>
              )}
              {runError && (
                <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{runError}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        {isActive && (
          <button
            onClick={() => onPause(agent)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 px-2 py-1"
          >
            <Pause size={12} />
            Pause
          </button>
        )}
        <button
          onClick={() => onCancel(agent)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors duration-200 px-2 py-1 ml-auto"
        >
          <Trash2 size={12} />
          Remove
        </button>
      </div>
    </div>
  );
}

export default function MyVirtualTeam({ teamData, onRefresh }) {
  const tier = teamData?.tier;
  const agents = teamData?.agents || [];

  const handlePause = async (agent) => {
    try {
      await marketplaceApi.pauseAgent(agent.id);
      onRefresh();
    } catch (err) {
      console.error('Pause failed', err);
    }
  };

  const handleCancel = async (agent) => {
    if (!window.confirm(`Remove ${agent.name} from your team?`)) return;
    try {
      await marketplaceApi.cancelAgent(agent.id);
      onRefresh();
    } catch (err) {
      console.error('Cancel failed', err);
    }
  };

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-muted border border-border flex items-center justify-center">
          <Bot size={28} className="text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground">No agents yet</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Browse the Marketplace tab to add agents to your virtual team.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tier usage bar */}
      {tier && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">{tier.tier_label} Plan</h3>
              <p className="text-xs text-muted-foreground">{tier.active_agent_count} of {tier.total_agent_limit} agent slots used</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Tokens this cycle</p>
              <p className="text-sm font-semibold text-foreground">
                {(tier.token_used_this_cycle / 1000).toFixed(1)}K / {(tier.token_allowance_monthly / 1000).toFixed(0)}K
              </p>
            </div>
          </div>
          {/* Slot bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full accent-gradient-bg rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (tier.active_agent_count / tier.total_agent_limit) * 100)}%` }}
            />
          </div>
          {/* Token bar */}
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${tier.token_pct_used > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, tier.token_pct_used)}%` }}
            />
          </div>
        </div>
      )}

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map(agent => (
          <AgentTeamCard
            key={agent.id}
            agent={agent}
            onCancel={handleCancel}
            onPause={handlePause}
          />
        ))}
      </div>
    </div>
  );
}
