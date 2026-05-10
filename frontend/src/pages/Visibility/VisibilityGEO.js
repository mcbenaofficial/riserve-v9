import React, { useEffect, useState, useCallback } from 'react';
import {
  Brain, Search, Plus, Trash2, Play, RefreshCw,
  AlertCircle, ChevronDown, ChevronRight, CheckCircle, XCircle,
  BarChart2, Users, Loader2, X
} from 'lucide-react';
import {
  getGEOQueries, createGEOQuery, deleteGEOQuery,
  runGEOQuery, getGEOChecks, getGEOSummary
} from '../../services/visibilityApi';

const PLATFORMS = [
  { id: 'chatgpt', label: 'ChatGPT', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { id: 'perplexity', label: 'Perplexity', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  { id: 'google_ai', label: 'Google AI', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
];

function PlatformBadge({ platform }) {
  const cfg = PLATFORMS.find(p => p.id === platform);
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg?.color || 'bg-muted text-muted-foreground'}`}>
      {cfg?.label || platform}
    </span>
  );
}

function CitationRate({ rate, size = 'md' }) {
  const color = rate >= 66 ? 'text-emerald-600 dark:text-emerald-400'
    : rate >= 33 ? 'text-amber-500'
    : 'text-red-500';
  const textSize = size === 'lg' ? 'text-3xl' : 'text-xl';
  return (
    <span className={`font-bold ${textSize} ${color}`}>{rate}%</span>
  );
}

function QueryCard({ query, onDelete, onRun, latestChecks }) {
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const checks = latestChecks[query.id] || [];
  const citedCount = checks.filter(c => c.cited).length;
  const rate = checks.length > 0 ? Math.round((citedCount / checks.length) * 100) : null;

  const handleRun = async () => {
    setRunning(true);
    try {
      await onRun(query.id);
      setExpanded(true);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Search size={15} className="text-muted-foreground shrink-0" />
        <span className="text-sm text-foreground flex-1 font-medium">{query.query_text}</span>

        <div className="flex items-center gap-3 shrink-0">
          {rate !== null && (
            <div className="text-right">
              <CitationRate rate={rate} size="sm" />
              <div className="text-xs text-muted-foreground">cited</div>
            </div>
          )}

          {checks.length > 0 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}

          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 disabled:opacity-50"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {running ? 'Running…' : 'Run'}
          </button>

          <button
            onClick={() => onDelete(query.id)}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors duration-150"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && checks.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {checks.map(check => (
            <div key={check.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <PlatformBadge platform={check.platform} />
                <div className="flex items-center gap-1.5">
                  {check.cited
                    ? <CheckCircle size={13} className="text-emerald-500" />
                    : <XCircle size={13} className="text-red-400" />}
                  <span className={`text-xs font-medium ${check.cited ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {check.cited ? 'Cited' : 'Not cited'}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    {new Date(check.checked_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              </div>

              {check.simulated_response && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 bg-muted/50 rounded-lg p-2.5">
                  {check.simulated_response}
                </p>
              )}

              {check.cited && check.citation_excerpt && (
                <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2.5">
                  <CheckCircle size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 italic">"{check.citation_excerpt}"</p>
                </div>
              )}

              {check.competitors_cited?.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">Also cited:</span>
                  {check.competitors_cited.map((comp, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{comp}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddQueryModal({ onSave, onClose }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const SUGGESTIONS = [
    'best salons near me',
    'top-rated spa in [your area]',
    'where to get a haircut in [your area]',
    'best restaurant for dinner in [your area]',
    'highly rated coffee shop near me',
  ];

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onSave(text.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg z-[60]">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-semibold text-foreground">Add GEO Query</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors duration-150">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Search Query</label>
            <input
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="e.g. best salons in Indiranagar Bangalore"
              className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">Suggestions</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setText(s)}
                  className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Each run sends this query to ChatGPT, Perplexity, and Google AI simultaneously and records whether your business is cited.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white accent-gradient-bg hover:opacity-90 transition-opacity duration-150 disabled:opacity-50"
          >
            <Plus size={14} />
            {saving ? 'Adding…' : 'Add Query'}
          </button>
        </div>
      </div>
    </div>
  );
}

const VisibilityGEO = () => {
  const [queries, setQueries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [latestChecks, setLatestChecks] = useState({}); // query_id → [checks]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [runningAll, setRunningAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [qs, sum, checks] = await Promise.all([
        getGEOQueries(),
        getGEOSummary(),
        getGEOChecks(),
      ]);
      setQueries(qs);
      setSummary(sum);

      // Group most-recent checks per query per platform
      const grouped = {};
      // Sort newest-first so we take the first match
      const sorted = [...checks].sort((a, b) => new Date(b.checked_at) - new Date(a.checked_at));
      const seen = new Set();
      for (const c of sorted) {
        const key = `${c.query_id}:${c.platform}`;
        if (!seen.has(key)) {
          seen.add(key);
          if (!grouped[c.query_id]) grouped[c.query_id] = [];
          grouped[c.query_id].push(c);
        }
      }
      setLatestChecks(grouped);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAddQuery = async (queryText) => {
    const created = await createGEOQuery({ query_text: queryText });
    setQueries(prev => [...prev, created]);
  };

  const handleDeleteQuery = async (id) => {
    await deleteGEOQuery(id);
    setQueries(prev => prev.filter(q => q.id !== id));
    setLatestChecks(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const handleRunQuery = async (id) => {
    const newChecks = await runGEOQuery(id);
    // Replace latest checks for this query
    const grouped = {};
    for (const c of newChecks) {
      if (!grouped[c.query_id]) grouped[c.query_id] = [];
      grouped[c.query_id].push(c);
    }
    setLatestChecks(prev => ({ ...prev, ...grouped }));
    // Refresh summary
    const sum = await getGEOSummary();
    setSummary(sum);
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    try {
      for (const q of queries) {
        await handleRunQuery(q.id);
      }
    } finally {
      setRunningAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI & Search</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your citation share across ChatGPT, Perplexity, and Google AI</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-200"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {queries.length > 0 && (
            <button
              onClick={handleRunAll}
              disabled={runningAll}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-200 disabled:opacity-50"
            >
              {runningAll ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Run All
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white accent-gradient-bg hover:opacity-90 transition-opacity duration-150"
          >
            <Plus size={14} />
            Add Query
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Summary Stats */}
      {summary && summary.total_checks > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Overall + Per-platform */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Citation Share</h2>
              <span className="text-xs text-muted-foreground">{summary.total_checks} checks run</span>
            </div>
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <div className="p-2.5 rounded-xl accent-gradient-bg">
                <Brain size={18} className="text-white" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Overall citation rate</div>
                <CitationRate rate={summary.overall_citation_rate} size="lg" />
              </div>
            </div>
            <div className="space-y-3">
              {PLATFORMS.map(p => {
                const stats = summary.by_platform[p.id] || { checks: 0, cited: 0, rate: 0 };
                return (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-1">
                      <PlatformBadge platform={p.id} />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{stats.cited}/{stats.checks} checks</span>
                        <CitationRate rate={stats.rate} size="sm" />
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${stats.rate >= 66 ? 'bg-emerald-500' : stats.rate >= 33 ? 'bg-amber-500' : 'bg-red-400'}`}
                        style={{ width: `${stats.rate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Competitors */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Competitors in AI Results</h2>
            </div>
            {summary.top_competitors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No competitor mentions found yet.</p>
            ) : (
              <div className="space-y-2">
                {summary.top_competitors.map((comp, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                      <span className="text-sm text-foreground">{comp.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{comp.mentions} mention{comp.mentions !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Query list */}
      {loading && queries.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-border border-t-transparent animate-spin" />
        </div>
      ) : queries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 rounded-2xl accent-gradient-bg mb-4">
            <Brain size={28} className="text-white" />
          </div>
          <p className="text-foreground font-medium">No queries yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Add the search queries your customers use. Ri'Serve will simulate how ChatGPT, Perplexity, and Google AI respond — and track whether your business is cited.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white accent-gradient-bg hover:opacity-90 transition-opacity duration-150"
          >
            <Plus size={14} />
            Add First Query
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Tracked Queries</h2>
          {queries.map(q => (
            <QueryCard
              key={q.id}
              query={q}
              onDelete={handleDeleteQuery}
              onRun={handleRunQuery}
              latestChecks={latestChecks}
            />
          ))}
        </div>
      )}

      {showAdd && <AddQueryModal onSave={handleAddQuery} onClose={() => setShowAdd(false)} />}
    </div>
  );
};

export default VisibilityGEO;
