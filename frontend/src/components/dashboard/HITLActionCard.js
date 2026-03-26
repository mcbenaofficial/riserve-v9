import React, { useState } from 'react';
import { 
  Sparkles, TrendingUp, Package, CalendarX, 
  Check, X, Pencil, Clock, ChevronDown, ChevronUp,
  ExternalLink, Zap
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const typeConfig = {
  promotion: { 
    icon: Sparkles, 
    gradient: 'from-amber-500/10 to-orange-500/10', 
    border: 'border-amber-500/20 hover:border-amber-500/40',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    iconColor: 'text-amber-500'
  },
  staffing: { 
    icon: TrendingUp, 
    gradient: 'from-blue-500/10 to-cyan-500/10', 
    border: 'border-blue-500/20 hover:border-blue-500/40',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    iconColor: 'text-blue-500'
  },
  inventory: { 
    icon: Package, 
    gradient: 'from-emerald-500/10 to-teal-500/10', 
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    iconColor: 'text-emerald-500'
  },
  no_show: { 
    icon: CalendarX, 
    gradient: 'from-red-500/10 to-pink-500/10', 
    border: 'border-red-500/20 hover:border-red-500/40',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400',
    iconColor: 'text-red-500'
  },
};

const HITLActionCard = ({ card, onAction, businessMode }) => {
  const [showWhy, setShowWhy] = useState(false);
  const [actionTaken, setActionTaken] = useState(null);
  
  const config = typeConfig[card.type] || typeConfig.promotion;
  const Icon = config.icon;
  
  const handleAction = (action) => {
    setActionTaken(action);
    if (onAction) onAction(card.id, action);
  };

  if (actionTaken) {
    return (
      <Card className={`relative overflow-hidden border ${config.border} transition-all duration-500 opacity-60 scale-[0.98]`}>
        <CardContent className="p-4 flex items-center justify-center gap-2">
          {actionTaken === 'approve' && <Check size={16} className="text-green-500" />}
          {actionTaken === 'reject' && <X size={16} className="text-red-500" />}
          {actionTaken === 'edit' && <Pencil size={16} className="text-blue-500" />}
          {actionTaken === 'defer' && <Clock size={16} className="text-amber-500" />}
          <span className="text-sm text-muted-foreground capitalize">{actionTaken}ed</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`relative overflow-hidden border ${config.border} bg-gradient-to-br ${config.gradient} transition-all duration-300 hover:shadow-lg group`}>
      {/* Urgency indicator */}
      {card.urgency === 'high' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 to-orange-500" />
      )}
      
      <CardContent className="p-4 space-y-3">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`p-2 rounded-lg bg-white/50 dark:bg-white/5 border border-white/20 dark:border-white/10 flex-shrink-0 ${config.iconColor}`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate">{card.title}</h4>
                {card.urgency === 'high' && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-500 bg-red-500/5 flex-shrink-0">
                    <Zap size={8} className="mr-0.5" /> Urgent
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{card.explanation}</p>
            </div>
          </div>
          
          {/* Confidence */}
          <div className={`flex-shrink-0 text-center px-2.5 py-1 rounded-lg ${config.badge}`}>
            <div className="text-sm font-bold">{card.confidence}%</div>
            <div className="text-[9px] opacity-70">confidence</div>
          </div>
        </div>

        {/* Why This? */}
        <button 
          onClick={() => setShowWhy(!showWhy)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showWhy ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          <span>Why this?</span>
        </button>
        
        {showWhy && (
          <div className="text-xs text-muted-foreground bg-white/30 dark:bg-white/5 rounded-lg p-3 border border-white/20 dark:border-white/10 animate-in slide-in-from-top-1">
            {card.whyThis || card.report_json?.detailed_analysis || 'AI analyzed patterns in your booking, revenue, and operational data to surface this recommendation.'}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <Button 
            size="sm" variant="default"
            className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700 text-white border-0 shadow-sm"
            onClick={() => handleAction('approve')}
          >
            <Check size={12} className="mr-1" /> Approve
          </Button>
          <Button 
            size="sm" variant="outline"
            className="h-7 px-3 text-xs border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10"
            onClick={() => handleAction('reject')}
          >
            <X size={12} className="mr-1" /> Reject
          </Button>
          <Button 
            size="sm" variant="outline"
            className="h-7 px-3 text-xs border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
            onClick={() => handleAction('edit')}
          >
            <Pencil size={12} className="mr-1" /> Edit
          </Button>
          <Button 
            size="sm" variant="ghost"
            className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => handleAction('defer')}
          >
            <Clock size={12} className="mr-1" /> Defer
          </Button>
          <div className="flex-1" />
          <Button 
            size="sm" variant="ghost"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ExternalLink size={12} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default HITLActionCard;
