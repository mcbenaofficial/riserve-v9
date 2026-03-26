import React from 'react';
import {
  Users, Clock, Star, TrendingUp, TrendingDown, BarChart3, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
  Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';

const OperationsAnalytics = ({ businessMode, opsData, narrative }) => {
  const { staffUtilization, profitability, avgTime } = opsData;
  const maxUtil = 100;

  return (
    <div className="space-y-6">
      {/* AI Narrative */}
      <Card className="glass-panel border-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 flex-shrink-0 mt-0.5">
            <Star size={14} className="text-blue-500" />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{narrative}</p>
        </CardContent>
      </Card>

      {/* Avg Treatment/Turn Time + Quick Stat */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-panel border-0 col-span-1">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Clock size={22} className="text-indigo-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{avgTime.value}</div>
              <div className="text-xs text-muted-foreground">{avgTime.label}</div>
              <span className={`flex items-center text-[10px] font-bold mt-1 ${avgTime.trend < 0 ? 'text-green-600' : 'text-red-500'}`}>
                {avgTime.trend < 0 ? <ArrowDownRight size={10} className="mr-0.5" /> : <ArrowUpRight size={10} className="mr-0.5" />}
                {Math.abs(avgTime.trend)}% vs last month
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel border-0 col-span-2">
          <CardContent className="p-5">
            <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Users size={14} className="text-blue-500" />
              {businessMode === 'salon' ? 'Staff Utilization' : 'Team Performance'}
            </div>
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={staffUtilization} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid horizontal={false} strokeOpacity={0.05} />
                  <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={65} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                  <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#12161C', border: '1px solid #1F2630', borderRadius: 8, fontSize: 12, color: '#fff' }} formatter={v => [`${v}%`, 'Utilization']} />
                  <Bar dataKey="utilization" radius={[0, 4, 4, 0]} barSize={14}>
                    {staffUtilization.map((entry, i) => {
                      const color = entry.utilization >= 90 ? '#ef4444' : entry.utilization >= 75 ? '#0d9488' : '#3b82f6';
                      return <Cell key={i} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profitability: Top + Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Profitable */}
        <Card className="glass-panel glass-panel-hover border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-white">
                  Most Profitable {businessMode === 'salon' ? 'Services' : 'Items'}
                </CardTitle>
                <CardDescription>Highest contribution margin</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {profitability.top.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 text-xs font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.count} {businessMode === 'salon' ? 'bookings' : 'orders'}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-green-600 dark:text-green-400">{item.margin}%</div>
                  <div className="text-[10px] text-muted-foreground">₹{(item.revenue / 1000).toFixed(0)}k rev</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Least Profitable */}
        <Card className="glass-panel glass-panel-hover border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-white">
                  Least Profitable {businessMode === 'salon' ? 'Services' : 'Items'}
                </CardTitle>
                <CardDescription>Lowest contribution margin</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {profitability.bottom.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                <div className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 text-xs font-bold flex-shrink-0">
                  {profitability.top.length + i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.count} {businessMode === 'salon' ? 'bookings' : 'orders'}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-red-500">{item.margin}%</div>
                  <div className="text-[10px] text-muted-foreground">₹{(item.revenue / 1000).toFixed(0)}k rev</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Staff Detail Table */}
      <Card className="glass-panel glass-panel-hover border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-900 dark:text-white">
            {businessMode === 'salon' ? 'Staff Performance Detail' : 'Team Performance Detail'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5">
                  <th className="text-left text-muted-foreground font-medium p-3 pl-5">Name</th>
                  <th className="text-center text-muted-foreground font-medium p-3">Utilization</th>
                  <th className="text-center text-muted-foreground font-medium p-3">{businessMode === 'salon' ? 'Bookings' : 'Orders'}</th>
                  <th className="text-right text-muted-foreground font-medium p-3 pr-5">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {staffUtilization.map((staff, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-white/[0.02] hover:bg-black/[0.01] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 pl-5 font-medium text-gray-900 dark:text-white">{staff.name}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${staff.utilization >= 90 ? 'bg-red-500' : staff.utilization >= 75 ? 'bg-teal-500' : 'bg-blue-500'}`}
                            style={{ width: `${staff.utilization}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold">{staff.utilization}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-center text-gray-700 dark:text-gray-300">{staff.bookings}</td>
                    <td className="p-3 pr-5 text-right font-semibold text-gray-900 dark:text-white">₹{(staff.revenue / 1000).toFixed(0)}k</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OperationsAnalytics;
