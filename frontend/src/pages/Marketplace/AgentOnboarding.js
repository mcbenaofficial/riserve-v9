import React, { useState, useEffect } from 'react';
import { Bot, CheckCircle2, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { marketplaceApi } from '../../services/marketplaceApi';

export default function AgentOnboarding({ onComplete }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    marketplaceApi.getOnboardingOptions()
      .then(res => {
        if (res.data.onboarding_complete) {
          onComplete();
          return;
        }
        setOptions(res.data.agents || []);
      })
      .catch(err => setError('Failed to load agents'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id) => {
    setSelected(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const handleConfirm = async () => {
    if (selected.length !== 3) return;
    setSubmitting(true);
    setError(null);
    try {
      await marketplaceApi.selectOnboardingAgents(selected);
      onComplete();
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl accent-gradient-bg flex items-center justify-center mx-auto">
          <Sparkles size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Build Your Virtual Team</h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Choose <span className="text-foreground font-semibold">3 free agents</span> to kick off your team.
          You can always add more later by upgrading your plan.
        </p>
      </div>

      {/* Selection counter */}
      <div className="flex items-center justify-center gap-3">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
              selected[i]
                ? 'accent-gradient-bg border-transparent'
                : 'border-border bg-muted'
            }`}
          >
            {selected[i] ? (
              <CheckCircle2 size={16} className="text-white" />
            ) : (
              <span className="text-xs text-muted-foreground font-medium">{i + 1}</span>
            )}
          </div>
        ))}
        <span className="text-sm text-muted-foreground ml-1">{selected.length}/3 selected</span>
      </div>

      {/* Agent options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {options.map(agent => {
          const isSelected = selected.includes(agent.id);
          const isDisabled = !isSelected && selected.length >= 3;
          return (
            <button
              key={agent.id}
              onClick={() => toggle(agent.id)}
              disabled={isDisabled}
              className={`text-left p-4 rounded-2xl border-2 transition-all duration-200 space-y-3 ${
                isSelected
                  ? 'border-accent bg-accent/5'
                  : isDisabled
                  ? 'border-border bg-muted opacity-40 cursor-not-allowed'
                  : 'border-border bg-card hover:border-border/80 hover:shadow-md cursor-pointer'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={agent.accent_color
                    ? { background: `linear-gradient(135deg, ${agent.accent_color}40, ${agent.accent_color}20)` }
                    : { background: 'linear-gradient(135deg, #7c3aed33, #2563eb22)' }}
                >
                  <Bot size={20} className="text-foreground/70" />
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full accent-gradient-bg flex items-center justify-center shrink-0">
                    <CheckCircle2 size={12} className="text-white" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">{agent.name}</h3>
                {agent.tagline && <p className="text-xs text-muted-foreground mt-0.5">{agent.tagline}</p>}
              </div>
              {agent.capabilities?.length > 0 && (
                <ul className="space-y-1">
                  {agent.capabilities.slice(0, 2).map((cap, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-accent shrink-0" />
                      {cap}
                    </li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-center">
          {error}
        </div>
      )}

      <button
        onClick={handleConfirm}
        disabled={selected.length !== 3 || submitting}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl accent-gradient-bg text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity duration-200"
      >
        {submitting ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <>
            Launch My Team
            <ArrowRight size={18} />
          </>
        )}
      </button>
    </div>
  );
}
