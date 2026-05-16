import React, { useState, useEffect, useCallback } from 'react';
import { Store, Users2, BarChart3, Crown, Loader2, TrendingUp, Zap, Activity } from 'lucide-react';
import { marketplaceApi } from '../../services/marketplaceApi';
import AgentBrowser from './AgentBrowser';
import MyVirtualTeam from './MyVirtualTeam';
import AgentOnboarding from './AgentOnboarding';
import TierUpgradeModal from './TierUpgradeModal';

const TABS = [
  { key: 'marketplace', label: 'Marketplace', icon: Store },
  { key: 'team', label: 'My Team', icon: Users2 },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

function AnalyticsView({ teamData, metrics }) {
  const tier = teamData?.tier;
  const agents = teamData?.agents || [];

  const topAgents = [...agents].sort((a, b) => (b.metrics?.total_runs || 0) - (a.metrics?.total_runs || 0)).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Runs', value: metrics?.total_runs ?? 0, icon: Activity, accent: 'text-blue-400', bg: 'from-blue-500/20 to-blue-500/5' },
          { label: 'Success Rate', value: `${metrics?.success_rate ?? 0}%`, icon: TrendingUp, accent: 'text-emerald-400', bg: 'from-emerald-500/20 to-emerald-500/5' },
          { label: 'Total Tokens', value: `${((metrics?.total_tokens ?? 0) / 1000).toFixed(1)}K`, icon: Zap, accent: 'text-purple-400', bg: 'from-purple-500/20 to-purple-500/5' },
          { label: 'Total Cost', value: `$${(metrics?.total_cost_usd ?? 0).toFixed(2)}`, icon: BarChart3, accent: 'text-amber-400', bg: 'from-amber-500/20 to-amber-500/5' },
        ].map(({ label, value, icon: Icon, accent, bg }) => (
          <div key={label} className={`bg-card border border-border rounded-2xl p-5 bg-gradient-to-br ${bg}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
              </div>
              <Icon size={20} className={`${accent} opacity-60`} />
            </div>
          </div>
        ))}
      </div>

      {/* Token budget */}
      {tier && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Token Budget — {tier.tier_label}</h3>
            <span className={`text-sm font-semibold ${tier.token_pct_used > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {tier.token_pct_used}% used
            </span>
          </div>
          <div className="h-2.5 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${tier.token_pct_used > 80 ? 'bg-amber-500' : 'accent-gradient-bg'}`}
              style={{ width: `${Math.min(100, tier.token_pct_used)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{(tier.token_used_this_cycle / 1000).toFixed(1)}K used</span>
            <span>{(tier.token_allowance_monthly / 1000).toFixed(0)}K monthly allowance</span>
          </div>
        </div>
      )}

      {/* Top agents by runs */}
      {topAgents.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Top Agents by Activity</h3>
          <div className="space-y-3">
            {topAgents.map((agent, i) => {
              const m = agent.metrics || {};
              const maxRuns = topAgents[0]?.metrics?.total_runs || 1;
              return (
                <div key={agent.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                      <span className="font-medium text-foreground">{agent.name}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">{m.total_runs || 0} runs</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full accent-gradient-bg rounded-full"
                      style={{ width: `${Math.round(((m.total_runs || 0) / maxRuns) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Marketplace() {
  const [tab, setTab] = useState('marketplace');
  const [teamData, setTeamData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await marketplaceApi.getTeam();
      setTeamData(res.data);
    } catch (err) {
      console.error('Failed to fetch team', err);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await marketplaceApi.getTeamMetrics();
      setMetrics(res.data);
    } catch (err) {
      console.error('Failed to fetch metrics', err);
    }
  }, []);

  const checkOnboarding = useCallback(async () => {
    try {
      const res = await marketplaceApi.getOnboardingOptions();
      setOnboardingComplete(res.data.onboarding_complete);
    } catch {
      setOnboardingComplete(true);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchTeam(), fetchMetrics(), checkOnboarding()])
      .finally(() => setLoading(false));
  }, [fetchTeam, fetchMetrics, checkOnboarding]);

  const handleSubscribe = async (agent) => {
    try {
      await marketplaceApi.subscribeAgent(agent.id);
      fetchTeam();
    } catch (err) {
      const msg = err.response?.data?.detail || '';
      if (msg.includes('limit reached') || msg.includes('Upgrade')) {
        setShowUpgrade(true);
      }
      throw err;
    }
  };

  const handleCancel = async (agent) => {
    await marketplaceApi.cancelAgent(agent.id);
    fetchTeam();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!onboardingComplete) {
    return (
      <AgentOnboarding
        onComplete={() => {
          setOnboardingComplete(true);
          fetchTeam();
        }}
      />
    );
  }

  const tier = teamData?.tier;

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Virtual Team</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI agents that work for you — organised by C-Suite function.
          </p>
        </div>

        {tier && (
          <button
            onClick={() => setShowUpgrade(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-sm text-foreground hover:border-accent transition-colors duration-200 shrink-0"
          >
            <Crown size={14} className="text-amber-400" />
            {tier.tier_label}
            <span className="text-xs text-muted-foreground">
              · {tier.active_agent_count}/{tier.total_agent_limit} agents
            </span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === key
                ? 'accent-gradient-bg text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'marketplace' && (
        <AgentBrowser
          tier={tier}
          onSubscribe={handleSubscribe}
          onCancel={handleCancel}
          onTeamChange={fetchTeam}
        />
      )}
      {tab === 'team' && (
        <MyVirtualTeam teamData={teamData} onRefresh={fetchTeam} />
      )}
      {tab === 'analytics' && (
        <AnalyticsView teamData={teamData} metrics={metrics} />
      )}

      {/* Upgrade modal */}
      {showUpgrade && tier && (
        <TierUpgradeModal
          currentTier={tier}
          upgradeOptions={tier.upgrade_options || []}
          onClose={() => setShowUpgrade(false)}
          onUpgraded={() => { fetchTeam(); fetchMetrics(); }}
        />
      )}
    </div>
  );
}
