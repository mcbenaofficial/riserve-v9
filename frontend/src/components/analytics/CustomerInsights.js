import React from 'react';
import {
  Users, UserPlus, Heart, Star, ArrowUpRight, CreditCard
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Bar, BarChart, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend, Funnel, FunnelChart
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';

const CustomerInsights = ({ segments, narrative }) => {
  const { newVsReturning, spendTiers, retentionFunnel, ltvDistribution, metrics } = segments;

  return (
    <div className="space-y-6">
      {/* AI Narrative */}
      <Card className="glass-panel border-0 bg-gradient-to-r from-teal-500/5 to-cyan-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 flex-shrink-0 mt-0.5">
            <Star size={14} className="text-teal-500" />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{narrative}</p>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg LTV', value: `₹${(metrics.avgLTV || 0).toLocaleString()}`, icon: CreditCard, color: 'teal' },
          { label: 'Retention Rate', value: `${metrics.retentionRate}%`, icon: Heart, color: 'pink' },
          { label: 'Churn Rate', value: `${metrics.churnRate}%`, icon: Users, color: 'red' },
          { label: 'Visits/Month', value: metrics.avgVisitsPerMonth, icon: UserPlus, color: 'blue' },
        ].map((stat, i) => (
          <Card key={i} className="glass-panel border-0">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg bg-${stat.color}-500/10 flex items-center justify-center text-${stat.color}-500`}>
                <stat.icon size={17} />
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-white">{stat.value}</div>
                <div className="text-[11px] text-muted-foreground">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* New vs Returning Pie */}
        <Card className="glass-panel glass-panel-hover border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-teal-500" />
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-white">New vs Returning</CardTitle>
                <CardDescription>Customer composition</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={newVsReturning}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={80}
                    paddingAngle={4} dataKey="value"
                    stroke="none"
                  >
                    {newVsReturning.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#12161C', border: '1px solid #1F2630', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                  <Legend iconType="circle" formatter={(val) => <span className="text-xs text-gray-600 dark:text-gray-300">{val}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* LTV Distribution */}
        <Card className="glass-panel glass-panel-hover border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-purple-500" />
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-white">LTV Distribution</CardTitle>
                <CardDescription>Customer lifetime value</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ltvDistribution}>
                  <CartesianGrid vertical={false} strokeOpacity={0.1} />
                  <XAxis dataKey="range" tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 10 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#12161C', border: '1px solid #1F2630', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={28} name="Customers" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Retention Funnel */}
        <Card className="glass-panel glass-panel-hover border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-500" />
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-white">Retention Funnel</CardTitle>
                <CardDescription>Visit frequency drop-off</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {retentionFunnel.map((stage, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-700 dark:text-gray-300">{stage.stage}</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">{stage.value}%</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-400 transition-all duration-700"
                    style={{ width: `${stage.value}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Spend Tiers */}
      <Card className="glass-panel glass-panel-hover border-0">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-500" />
            <div>
              <CardTitle className="text-base text-gray-900 dark:text-white">Spend Tiers</CardTitle>
              <CardDescription>Customer segmentation by spending</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {spendTiers.map((tier, i) => {
              const tierColors = ['bg-amber-500/10 border-amber-500/20', 'bg-teal-500/10 border-teal-500/20', 'bg-blue-500/10 border-blue-500/20', 'bg-gray-100/50 dark:bg-white/5 border-gray-200 dark:border-white/10'];
              return (
                <div key={i} className={`rounded-xl p-4 border ${tierColors[i]} transition-all hover:scale-[1.02]`}>
                  <div className="font-semibold text-sm text-gray-900 dark:text-white mb-2">{tier.tier}</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{tier.count}</div>
                  <div className="text-xs text-muted-foreground">customers</div>
                  <div className="mt-2 text-xs font-semibold text-teal-600 dark:text-teal-400">₹{(tier.spend / 1000).toFixed(0)}k revenue</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerInsights;
