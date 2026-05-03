import React from 'react';
import {
  Sparkles, TrendingUp, Package, CalendarX,
  Clock, CheckCircle2, XCircle, Settings, Users, ArrowRight
} from 'lucide-react';
import { Button } from '../ui/button';

const FLOW_CONFIG = {
  quiet_hour_promotion: {
    icon: Sparkles,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    hoverBorder: 'hover:border-amber-500/50',
    gradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    label: 'Promotion',
    accentColor: '#f59e0b',
  },
  inventory_reorder: {
    icon: Package,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    hoverBorder: 'hover:border-emerald-500/50',
    gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    label: 'Inventory',
    accentColor: '#10b981',
  },
  dynamic_pricing: {
    icon: TrendingUp,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    hoverBorder: 'hover:border-blue-500/50',
    gradient: 'from-blue-500/10 via-blue-500/5 to-transparent',
    label: 'Dynamic Pricing',
    accentColor: '#3b82f6',
  },
  staffing_suggestion: {
    icon: Users,
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    hoverBorder: 'hover:border-violet-500/50',
    gradient: 'from-violet-500/10 via-violet-500/5 to-transparent',
    label: 'Staffing',
    accentColor: '#8b5cf6',
  },
  no_show_risk: {
    icon: CalendarX,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    hoverBorder: 'hover:border-rose-500/50',
    gradient: 'from-rose-500/10 via-rose-500/5 to-transparent',
    label: 'No-Show Risk',
    accentColor: '#f43f5e',
  },
};

const STATUS_CONFIG = {
  approved: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: CheckCircle2,
    label: 'Approved',
  },
  modified: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    icon: Settings,
    label: 'Modified',
  },
  declined: {
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    icon: XCircle,
    label: 'Declined',
  },
};

const InsightCard = ({ report, isPast, onReview }) => {
  const config = FLOW_CONFIG[report.flow_type] || {
    icon: Sparkles,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    hoverBorder: 'hover:border-primary/50',
    gradient: 'from-primary/10 via-primary/5 to-transparent',
    label: report.flow_type.replace(/_/g, ' '),
    accentColor: 'hsl(var(--primary))',
  };
  const Icon = config.icon;
  const data = report.report_json || {};
  const confidence = data.confidence || report.confidence;
  const statusCfg = isPast ? STATUS_CONFIG[report.status] : null;
  const StatusIcon = statusCfg?.icon;

  const timeLabel = isPast
    ? new Date(report.resolved_at).toLocaleDateString([], {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : new Date(report.created_at).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit',
      });

  const confidenceColor =
    confidence >= 85 ? 'text-emerald-400' :
    confidence >= 70 ? 'text-amber-400' :
    'text-rose-400';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onReview}
      onKeyDown={(e) => e.key === 'Enter' && onReview()}
      className={`
        group relative flex flex-col rounded-xl border bg-card cursor-pointer
        bg-gradient-to-b ${config.gradient}
        ${config.border} ${config.hoverBorder}
        hover:shadow-lg transition-all duration-200
        overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary/50
      `}
    >
      {/* Urgency accent bar */}
      {!isPast && report.urgency === 'high' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500" />
      )}

      <div className="p-5 flex flex-col flex-1 gap-3">
        {/* Top row: type pill + status/confidence */}
        <div className="flex items-center justify-between gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg} ${config.border} border`}>
            <Icon size={12} className={config.color} />
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${config.color}`}>
              {config.label}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {statusCfg && StatusIcon && (
              <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                <StatusIcon size={10} />
                {statusCfg.label}
              </span>
            )}
            {confidence && (
              <span className={`text-xs font-bold tabular-nums ${confidenceColor}`}>
                {confidence}%
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2 tracking-tight">
          {data.recommended_action || 'Optimization Recommended'}
        </h3>

        {/* Summary */}
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1">
          {data.what_this_is || data.why_recommended || ''}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-border/40">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={11} />
            {timeLabel}
          </span>
          <span className={`flex items-center gap-1 text-xs font-medium ${config.color} opacity-0 group-hover:opacity-100 transition-opacity duration-150`}>
            {isPast ? 'View Details' : 'Review'}
            <ArrowRight size={11} />
          </span>
        </div>
      </div>
    </div>
  );
};

export default InsightCard;
