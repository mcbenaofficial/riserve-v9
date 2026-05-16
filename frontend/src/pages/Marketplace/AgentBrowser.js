import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, ChevronRight, AlertCircle } from 'lucide-react';
import { marketplaceApi } from '../../services/marketplaceApi';
import AgentCard from './AgentCard';
import AgentDetailDrawer from './AgentDetailDrawer';

const AGENT_TIERS = [
  { key: '', label: 'All' },
  { key: 'basic', label: 'Basic' },
  { key: 'standard', label: 'Standard' },
  { key: 'advanced', label: 'Advanced' },
  { key: 'elite', label: 'Elite' },
];

// Short label shown in the pill strip
const CAT_SHORT = {
  ceo: 'CEO', cfo: 'CFO', coo: 'COO', cro: 'CRO', cmo: 'CMO',
  chro: 'CHRO', cto: 'CTO', cpo: 'CPO', clo: 'CLO', cco: 'CCO',
};

export default function AgentBrowser({ tier, onSubscribe, onCancel, onTeamChange }) {
  const [categories, setCategories] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTier, setSelectedTier] = useState('');
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);

  const activeCount = tier?.active_agent_count ?? 0;
  const canSubscribe = activeCount < (tier?.total_agent_limit ?? 3);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, agentRes] = await Promise.all([
        marketplaceApi.getCategories(),
        marketplaceApi.getAgents({
          category: selectedCategory || undefined,
          agent_tier: selectedTier || undefined,
          search: search || undefined,
        }),
      ]);
      setCategories(catRes.data);
      setAgents(agentRes.data);
    } catch (err) {
      console.error('Failed to load marketplace', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedTier, search]);

  useEffect(() => {
    const t = setTimeout(fetchData, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchData]);

  const handleSubscribe = async (agent) => {
    await onSubscribe(agent);
    fetchData();
    onTeamChange();
  };

  const handleCancel = async (agent) => {
    await onCancel(agent);
    fetchData();
    onTeamChange();
  };

  const groupedAgents = categories.reduce((acc, cat) => {
    const catAgents = agents.filter(a => a.category_id === cat.id);
    if (catAgents.length > 0) acc.push({ category: cat, agents: catAgents });
    return acc;
  }, []);

  const flatView = selectedCategory || search || selectedTier;

  return (
    <div className="space-y-5">

      {/* ── Row 1: Search + Tier filter ─────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents…"
            className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Tier pills */}
        <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1 shrink-0">
          {AGENT_TIERS.map(t => (
            <button
              key={t.key}
              onClick={() => setSelectedTier(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                selectedTier === t.key
                  ? 'accent-gradient-bg text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Row 2: C-Suite category pills ───────────────────────────── */}
      {categories.length > 0 && (
        <div className="relative">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {/* All pill */}
            <button
              onClick={() => setSelectedCategory('')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0 border ${
                selectedCategory === ''
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              All
            </button>

            {categories.map(cat => {
              const isActive = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(isActive ? '' : cat.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 shrink-0 border ${
                    isActive
                      ? 'text-white border-transparent'
                      : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20'
                  }`}
                  style={isActive
                    ? { background: cat.accent_color || '#7c3aed' }
                    : {}}
                >
                  <span className="font-semibold">{CAT_SHORT[cat.key] || cat.key.toUpperCase()}</span>
                  <span className="opacity-50 font-normal">· {cat.agent_count}</span>
                </button>
              );
            })}
          </div>

          {/* Right fade to hint scrollability */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        </div>
      )}

      {/* ── Capacity notice ──────────────────────────────────────────── */}
      {!canSubscribe && (
        <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <AlertCircle size={14} />
            {tier?.tier_label} tier limit reached ({tier?.total_agent_limit} agents).
          </div>
          <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
            Upgrade to add more <ChevronRight size={13} />
          </span>
        </div>
      )}

      {/* ── Agent grid ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={26} className="animate-spin text-muted-foreground" />
        </div>
      ) : flatView ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onSelect={setSelectedAgent}
              onSubscribe={handleSubscribe}
              onCancel={handleCancel}
              canSubscribe={canSubscribe}
            />
          ))}
          {agents.length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted-foreground text-sm">
              No agents match your filters.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedAgents.map(({ category, agents: catAgents }) => (
            <div key={category.id}>
              {/* Section header */}
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  style={{ background: category.accent_color || '#7c3aed' }}
                >
                  {CAT_SHORT[category.key] || category.key.toUpperCase().slice(0, 3)}
                </div>
                <div>
                  <h2 className="font-semibold text-foreground text-sm leading-tight">{category.name}</h2>
                </div>
                <span className="text-xs text-muted-foreground ml-1">
                  {catAgents.length} agent{catAgents.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {catAgents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onSelect={setSelectedAgent}
                    onSubscribe={handleSubscribe}
                    onCancel={handleCancel}
                    canSubscribe={canSubscribe}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {selectedAgent && (
        <AgentDetailDrawer
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onSubscribe={async (a) => { await handleSubscribe(a); setSelectedAgent(null); }}
          onCancel={async (a) => { await handleCancel(a); setSelectedAgent(null); }}
          canSubscribe={canSubscribe}
          tierKey={tier?.tier_key}
        />
      )}
    </div>
  );
}
