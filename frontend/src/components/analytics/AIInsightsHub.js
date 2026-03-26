import React, { useState } from 'react';
import {
  BrainCircuit, Star, Target, Check, X, Clock, ArrowUpRight,
  Beaker, ChevronDown, ChevronUp, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';

const statusStyles = {
  implemented: { badge: 'bg-green-600 text-white', icon: Check, text: 'text-green-600 dark:text-green-400' },
  rejected:    { badge: 'bg-red-500/80 text-white', icon: X, text: 'text-red-500' },
  deferred:    { badge: 'bg-amber-500/80 text-white', icon: Clock, text: 'text-amber-500' },
  pending:     { badge: 'bg-blue-500/80 text-white', icon: Clock, text: 'text-blue-500' },
};

const impactColors = {
  positive: 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20',
  negative: 'text-red-500 bg-red-500/10 border-red-500/20',
  neutral:  'text-gray-500 bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10',
};

const AIInsightsHub = ({ aiData, narrative }) => {
  const { pastRecommendations, goals } = aiData;
  const [expandedId, setExpandedId] = useState(null);
  const [showSimulator, setShowSimulator] = useState(false);

  const implemented = pastRecommendations.filter(r => r.status === 'implemented');
  const positive = implemented.filter(r => r.impact === 'positive').length;
  const successRate = implemented.length > 0 ? Math.round((positive / implemented.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* AI Narrative */}
      <Card className="glass-panel border-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 flex-shrink-0 mt-0.5">
            <Star size={14} className="text-purple-500" />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{narrative}</p>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-panel border-0">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{pastRecommendations.length}</div>
            <div className="text-xs text-muted-foreground">Total Recommendations</div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-0">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{implemented.length}</div>
            <div className="text-xs text-muted-foreground">Implemented</div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-0">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{successRate}%</div>
            <div className="text-xs text-muted-foreground">Success Rate</div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-0">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">89</div>
            <div className="text-xs text-muted-foreground">Avg Confidence</div>
          </CardContent>
        </Card>
      </div>

      {/* Goals Progress */}
      <Card className="glass-panel glass-panel-hover border-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-teal-500" />
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-white">Monthly Goals</CardTitle>
                <CardDescription>Progress toward targets</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {goals.map((goal, i) => {
            const pctRaw = goal.invert
              ? (goal.target > 0 ? ((goal.target - goal.current + goal.target) / (goal.target * 2)) * 100 : 0)
              : (goal.target > 0 ? (goal.current / goal.target) * 100 : 0);
            const pct = Math.min(Math.round(pctRaw), 100);
            const isGood = goal.invert ? goal.current <= goal.target : goal.current >= goal.target;

            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{goal.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {goal.unit === '₹' ? `₹${(goal.current / 1000).toFixed(0)}k / ₹${(goal.target / 1000).toFixed(0)}k` : `${goal.current}${goal.unit} / ${goal.target}${goal.unit}`}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${isGood ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-teal-500 to-cyan-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Past Recommendations */}
      <Card className="glass-panel glass-panel-hover border-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-purple-500" />
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-white">Recommendation History</CardTitle>
                <CardDescription>Past AI suggestions and their outcomes</CardDescription>
              </div>
            </div>
            <Button
              variant="outline" size="sm"
              className="text-xs bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20 gap-1.5"
              onClick={() => setShowSimulator(!showSimulator)}
            >
              <Beaker size={12} /> What-If Simulator
            </Button>
          </div>
        </CardHeader>

        {/* What-If Simulator */}
        {showSimulator && (
          <div className="mx-5 mb-4 p-4 rounded-xl bg-purple-500/5 border border-purple-500/15">
            <div className="flex items-center gap-2 mb-3">
              <Beaker size={14} className="text-purple-500" />
              <span className="font-semibold text-sm text-gray-900 dark:text-white">What-If Simulator</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Explore the projected impact of different strategies on your key metrics.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: 'Increase prices 10%', revenue: '+₹48k', bookings: '-8%', satisfaction: '-0.2' },
                { label: 'Add Saturday evening slot', revenue: '+₹32k', bookings: '+15%', satisfaction: '+0.1' },
                { label: 'Launch loyalty program', revenue: '+₹22k', bookings: '+22%', satisfaction: '+0.3' },
              ].map((scenario, i) => (
                <div key={i} className="p-3 rounded-lg bg-white/50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 hover:border-purple-500/30 transition-all cursor-pointer group">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white mb-2">{scenario.label}</div>
                  <div className="space-y-1 text-[10px] text-muted-foreground">
                    <div className="flex justify-between"><span>Revenue</span><span className="font-semibold text-green-600">{scenario.revenue}</span></div>
                    <div className="flex justify-between"><span>Bookings</span><span className={`font-semibold ${scenario.bookings.startsWith('+') ? 'text-green-600' : 'text-red-500'}`}>{scenario.bookings}</span></div>
                    <div className="flex justify-between"><span>CSAT</span><span className={`font-semibold ${scenario.satisfaction.startsWith('+') ? 'text-green-600' : 'text-red-500'}`}>{scenario.satisfaction}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <CardContent className="p-0">
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {pastRecommendations.map((rec) => {
              const style = statusStyles[rec.status] || statusStyles.pending;
              const StatusIcon = style.icon;
              const impactColor = impactColors[rec.impact] || impactColors.neutral;
              const isExpanded = expandedId === rec.id;

              return (
                <div key={rec.id} className="px-5 py-3 hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : rec.id)}>
                    <div className={`w-7 h-7 rounded-full ${style.badge} flex items-center justify-center flex-shrink-0`}>
                      <StatusIcon size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{rec.title}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{rec.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{rec.date}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={`text-[10px] border ${impactColor} capitalize`}>{rec.impact}</Badge>
                      <span className="text-xs font-semibold text-muted-foreground">{rec.confidence}%</span>
                      {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 ml-10 p-3 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 text-xs text-muted-foreground">
                      <strong>Outcome:</strong> {rec.outcome}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIInsightsHub;
