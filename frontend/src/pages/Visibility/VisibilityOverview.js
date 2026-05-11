import React, { useEffect, useState, useCallback } from 'react';
import { Gauge, TrendingUp, Star, Brain, MapPin, RefreshCw, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react';
import { getVisibilityScore } from '../../services/visibilityApi';

const PRIORITY_CONFIG = {
  high: { cls: 'bg-red-500/15 text-red-400', label: 'High' },
  medium: { cls: 'bg-amber-500/15 text-amber-400', label: 'Medium' },
  low: { cls: 'bg-blue-500/15 text-blue-400', label: 'Low' },
};

const COMPONENT_ICONS = {
  rating: Star,
  velocity: TrendingUp,
  reply_rate: CheckCircle,
  listings: MapPin,
  outlet_profile: Brain,
};

function ScoreRing({ score }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="10" className="text-white/10" />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="text-center z-10">
        <div className="text-3xl font-bold text-white">{score}</div>
        <div className="text-xs text-gray-500">/ 100</div>
      </div>
    </div>
  );
}

function ComponentBar({ label, score, weight, raw, icon: Icon }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-sm text-white">
          <Icon size={13} className="text-gray-500" />
          <span>{label}</span>
          <span className="text-xs text-gray-500">({weight}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{raw}</span>
          <span className="text-sm font-semibold text-white">{score}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

const VisibilityOverview = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getVisibilityScore();
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-[#0D0F17] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Visibility Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Your composite local discoverability score</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 text-sm text-gray-500 hover:text-white hover:bg-white/8 transition-colors duration-200"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-white/8 border-t-transparent animate-spin" />
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Score Card */}
          <div className="lg:col-span-1 bg-[#13161D] border border-white/8 rounded-2xl p-6 flex flex-col items-center gap-4">
            <p className="text-sm font-medium text-gray-500">Visibility Score</p>
            <ScoreRing score={data.score} />
            <div className="w-full grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-white">{data.meta.avg_rating || '—'}</div>
                <div className="text-xs text-gray-500">Avg Rating</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white">{data.meta.total_reviews}</div>
                <div className="text-xs text-gray-500">Reviews</div>
              </div>
              <div>
                <div className="text-lg font-bold text-white">{data.meta.connected_listings}/{4}</div>
                <div className="text-xs text-gray-500">Listings</div>
              </div>
            </div>
          </div>

          {/* Components */}
          <div className="lg:col-span-2 bg-[#13161D] border border-white/8 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Score Breakdown</h2>
            <div className="space-y-4">
              {Object.entries(data.components).map(([key, comp]) => (
                <ComponentBar
                  key={key}
                  label={comp.label}
                  score={comp.score}
                  weight={comp.weight}
                  raw={comp.raw}
                  icon={COMPONENT_ICONS[key] || Gauge}
                />
              ))}
            </div>
          </div>

          {/* Action Items */}
          <div className="lg:col-span-3 bg-[#13161D] border border-white/8 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Recommended Actions</h2>
            {data.actions.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle size={16} />
                All good — no urgent actions right now.
              </div>
            ) : (
              <div className="space-y-2">
                {data.actions.map((action, i) => {
                  const cfg = PRIORITY_CONFIG[action.priority] || PRIORITY_CONFIG.low;
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/8/50 hover:bg-white/8 transition-colors duration-150">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                      <span className="text-sm text-white flex-1">{action.text}</span>
                      <ChevronRight size={14} className="text-gray-500 shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VisibilityOverview;
