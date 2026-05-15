import React from 'react';
import { Bot, Zap, CheckCircle2, Plus, Pause, Crown } from 'lucide-react';

const TIER_COLORS = {
  basic:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  standard: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  advanced: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  elite:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  custom:   'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

const TIER_REQUIRED_LABEL = {
  indie:   'Free',
  startup: 'Startup',
  studio:  'Studio',
  firm:    'Firm',
  corp:    'Corp',
};

export default function AgentCard({ agent, onSelect, onSubscribe, onCancel, canSubscribe }) {
  const sub = agent.subscription;
  const isActive = sub?.status === 'active';
  const isPaused = sub?.status === 'paused';
  const tierColor = TIER_COLORS[agent.agent_tier] || TIER_COLORS.basic;
  const accentStyle = agent.accent_color
    ? { background: `linear-gradient(135deg, ${agent.accent_color}22, ${agent.accent_color}08)`, borderColor: `${agent.accent_color}30` }
    : {};

  return (
    <div
      onClick={() => onSelect(agent)}
      className="relative bg-card border border-border rounded-2xl p-5 cursor-pointer hover:border-border/80 hover:shadow-lg transition-all duration-200 group flex flex-col gap-3"
      style={accentStyle}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={
              agent.accent_color
                ? { background: `linear-gradient(135deg, ${agent.accent_color}40, ${agent.accent_color}20)` }
                : { background: 'linear-gradient(135deg, #7c3aed33, #2563eb22)' }
            }
          >
            <Bot size={22} className="text-foreground/70" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm leading-tight group-hover:text-accent transition-colors duration-200">
              {agent.name}
            </h3>
            {agent.tagline && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{agent.tagline}</p>
            )}
          </div>
        </div>

        {/* Status badge */}
        {isActive && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 shrink-0">
            <CheckCircle2 size={10} />
            Active
          </span>
        )}
        {isPaused && (
          <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5 shrink-0">
            <Pause size={10} />
            Paused
          </span>
        )}
      </div>

      {/* Description */}
      {agent.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{agent.description}</p>
      )}

      {/* Capabilities pills */}
      {agent.capabilities?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {agent.capabilities.slice(0, 3).map((cap, i) => (
            <span key={i} className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5 border border-border">
              {cap}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{agent.capabilities.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${tierColor}`}>
            {agent.agent_tier}
          </span>
          {agent.tier_required !== 'indie' && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Crown size={9} />
              {TIER_REQUIRED_LABEL[agent.tier_required]}+
            </span>
          )}
        </div>

        {!isActive && !isPaused && (
          <button
            onClick={(e) => { e.stopPropagation(); onSubscribe(agent); }}
            disabled={!canSubscribe}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg accent-gradient-bg text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity duration-200"
          >
            <Plus size={12} />
            Add
          </button>
        )}
        {(isActive || isPaused) && (
          <button
            onClick={(e) => { e.stopPropagation(); onCancel(agent); }}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors duration-200 px-2 py-1"
          >
            Remove
          </button>
        )}
      </div>

      {/* Value metric hint */}
      {agent.value_metric_type && (
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Zap size={12} className="text-accent" />
        </div>
      )}
    </div>
  );
}
