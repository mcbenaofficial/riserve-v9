import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, SlidersHorizontal } from 'lucide-react';
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

  // Group agents by category
  const groupedAgents = categories.reduce((acc, cat) => {
    const catAgents = agents.filter(a => a.category_id === cat.id);
    if (catAgents.length > 0) acc.push({ category: cat, agents: catAgents });
    return acc;
  }, []);

  // Ungrouped if category filter active or search active
  const flatView = selectedCategory || search || selectedTier;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents…"
            className="w-full bg-muted border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Agent tier filter */}
        <div className="flex items-center gap-1.5 bg-muted border border-border rounded-xl p-1">
          {AGENT_TIERS.map(t => (
            <button
              key={t.key}
              onClick={() => setSelectedTier(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 ${
                selectedTier === t.key
                  ? 'accent-gradient-bg text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category pill strip */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory('')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-all duration-200 shrink-0 ${
              selectedCategory === ''
                ? 'accent-gradient-bg text-white border-transparent'
                : 'bg-muted border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            All C-Suite
          </button>
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(selectedCategory === cat.key ? '' : cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-all duration-200 shrink-0 ${
                selectedCategory === cat.key
                  ? 'accent-gradient-bg text-white border-transparent'
                  : 'bg-muted border-border text-muted-foreground hover:text-foreground'
              }`}
              style={selectedCategory === cat.key && cat.accent_color
                ? { background: cat.accent_color }
                : {}}
            >
              {cat.name}
              <span className="text-[10px] opacity-60">({cat.agent_count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Capacity notice */}
      {!canSubscribe && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-amber-400">
          You've reached your {tier?.tier_label} tier limit ({tier?.total_agent_limit} agents). Upgrade to add more.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-muted-foreground" />
        </div>
      ) : flatView ? (
        /* Flat grid when filtering */
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
            <div className="col-span-3 text-center py-12 text-muted-foreground">No agents match your filters.</div>
          )}
        </div>
      ) : (
        /* Grouped by C-Suite category */
        <div className="space-y-8">
          {groupedAgents.map(({ category, agents: catAgents }) => (
            <div key={category.id}>
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: category.accent_color || 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
                >
                  {category.key.toUpperCase().slice(0, 3)}
                </div>
                <h2 className="font-semibold text-foreground">{category.name}</h2>
                <span className="text-xs text-muted-foreground">· {catAgents.length} agent{catAgents.length !== 1 ? 's' : ''}</span>
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
