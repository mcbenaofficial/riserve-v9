import React from 'react';
import { Sparkles, TrendingUp, Package, CalendarX, Clock, CheckCircle2, XCircle, Settings } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

const FLOW_CONFIG = {
  quiet_hour_promotion: {
    icon: Sparkles,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    gradient: 'from-amber-500/5',
    label: 'Promotion',
  },
  inventory_reorder: {
    icon: Package,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    gradient: 'from-emerald-500/5',
    label: 'Inventory',
  },
  dynamic_pricing: {
    icon: TrendingUp,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    gradient: 'from-blue-500/5',
    label: 'Pricing',
  },
  staffing_suggestion: {
    icon: TrendingUp,
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    gradient: 'from-purple-500/5',
    label: 'Staffing',
  },
  no_show_risk: {
    icon: CalendarX,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    gradient: 'from-red-500/5',
    label: 'No-Show',
  },
};

const STATUS_CONFIG = {
  approved: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2 },
  modified: { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Settings },
  declined: { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: XCircle },
};

const InsightCard = ({ report, isPast, onReview }) => {
  const config = FLOW_CONFIG[report.flow_type] || {
    icon: Sparkles,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/20',
    gradient: 'from-primary/5',
    label: report.flow_type.replace(/_/g, ' '),
  };
  const Icon = config.icon;
  const data = report.report_json || {};
  const confidence = data.confidence || report.confidence;
  const statusCfg = isPast ? STATUS_CONFIG[report.status] : null;
  const StatusIcon = statusCfg?.icon;

  const timeLabel = isPast
    ? new Date(report.resolved_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`group flex flex-col p-5 rounded-xl border ${config.border} bg-gradient-to-br ${config.gradient} to-transparent bg-card hover:shadow-md transition-all cursor-pointer relative overflow-hidden`}
      onClick={onReview}
    >
      {/* Urgency bar */}
      {!isPast && report.urgency === 'high' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-orange-500" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center ${config.color} flex-shrink-0`}>
            <Icon size={15} />
          </div>
          <span className={`text-xs font-semibold uppercase tracking-wide ${config.color}`}>
            {config.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {statusCfg && StatusIcon && (
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
              <StatusIcon size={10} />
              {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
            </span>
          )}
          {confidence && (
            <div className={`text-center px-2 py-0.5 rounded-lg ${config.bg} ${config.color}`}>
              <div className="text-xs font-bold">{confidence}%</div>
              <div className="text-[9px] opacity-70 leading-none">conf.</div>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-foreground text-sm leading-snug mb-1.5 line-clamp-2">
        {data.recommended_action || 'Optimization Recommended'}
      </h3>

      {/* Summary */}
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1">
        {data.what_this_is || data.why_recommended || ''}
      </p>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock size={11} />
          {timeLabel}
        </span>
        <Button
          size="sm"
          variant="outline"
          className={`h-7 px-3 text-xs border ${config.border} ${config.color} ${config.bg} hover:opacity-80`}
          onClick={(e) => { e.stopPropagation(); onReview(); }}
        >
          {isPast ? 'View Details' : 'Review'}
        </Button>
      </div>
    </div>
  );
};

export default InsightCard;
