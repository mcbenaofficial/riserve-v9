import React from 'react';
import {
  DollarSign, Calendar, TrendingUp, Star, BarChart3, CalendarX,
  ThumbsUp, Repeat, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  Area, AreaChart, Line, LineChart, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';

const KPICard = ({ title, value, icon: Icon, trend, color, subtitle }) => {
  const colorMap = {
    teal:   'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    blue:   'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    red:    'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    amber:  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    cyan:   'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  };
  const c = colorMap[color] || colorMap.teal;

  return (
    <Card className="glass-panel glass-panel-hover border-0 group transition-all hover:scale-[1.02]">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className={`w-9 h-9 rounded-lg ${c} border flex items-center justify-center`}>
            <Icon size={17} />
          </div>
          {trend !== null && trend !== undefined && (
            <span className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              trend > 0 ? 'text-green-600 dark:text-green-400 bg-green-500/10' : 'text-red-500 bg-red-500/10'
            }`}>
              {trend > 0 ? <ArrowUpRight size={10} className="mr-0.5" /> : <ArrowDownRight size={10} className="mr-0.5" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</div>
          <div className="text-xs text-muted-foreground">{title}</div>
        </div>
        {subtitle && <div className="text-[10px] text-muted-foreground/70">{subtitle}</div>}
      </CardContent>
    </Card>
  );
};

const AnalyticsOverview = ({ businessMode, comparisonData, noShowTrend, kpis, narrative }) => {
  const data = comparisonData || [];

  return (
    <div className="space-y-6">
      {/* AI Narrative */}
      <Card className="glass-panel border-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 flex-shrink-0 mt-0.5">
            <Star size={14} className="text-purple-500" />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{narrative}</p>
        </CardContent>
      </Card>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard title="Total Revenue" value={`₹${(kpis.totalRevenue || 0).toLocaleString()}`} icon={DollarSign} trend={kpis.revenueTrend} color="teal" subtitle={kpis.revenueSubtitle} />
        <KPICard title="Total Bookings" value={kpis.totalBookings || 0} icon={Calendar} trend={kpis.bookingsTrend} color="blue" />
        <KPICard title="Avg Ticket" value={`₹${kpis.avgTicket || 0}`} icon={BarChart3} trend={kpis.avgTicketTrend} color="purple" />
        <KPICard title="No-Show Rate" value={`${kpis.noShowRate || 0}%`} icon={CalendarX} trend={kpis.noShowTrend} color="red" />
        <KPICard title="CSAT Score" value={kpis.csatScore || 0} icon={ThumbsUp} trend={kpis.csatTrend} color="amber" />
        <KPICard title="Repeat Rate" value={`${kpis.repeatRate || 0}%`} icon={Repeat} trend={kpis.repeatTrend} color="cyan" />
      </div>

      {/* Revenue Comparison Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 glass-panel glass-panel-hover border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-teal-500" />
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-white">Revenue Comparison</CardTitle>
                <CardDescription>This period vs previous</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="fillCurrent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="fillPrevious" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeOpacity={0.1} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                  <Tooltip contentStyle={{ backgroundColor: '#12161C', border: '1px solid #1F2630', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                  <Legend iconType="circle" />
                  <Area type="monotone" dataKey="current" name="This Period" fill="url(#fillCurrent)" stroke="#0d9488" strokeWidth={2} />
                  <Area type="monotone" dataKey="previous" name="Previous Period" fill="url(#fillPrevious)" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* No-Show Trend */}
        <Card className="glass-panel glass-panel-hover border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CalendarX className="h-4 w-4 text-red-500" />
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-white">No-Show Trend</CardTitle>
                <CardDescription>8-week improvement</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={noShowTrend}>
                  <CartesianGrid vertical={false} strokeOpacity={0.1} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} domain={[0, 'auto']} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#12161C', border: '1px solid #1F2630', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                  <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} name="No-Show %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsOverview;
