import React from 'react';
import {
  Package, Star, AlertTriangle, TrendingUp, RotateCcw
} from 'lucide-react';
import {
  Line, LineChart, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';

const urgencyStyles = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-600 text-white' },
  high:     { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-600 text-white' },
  medium:   { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-600 dark:text-blue-400', badge: 'bg-blue-600 text-white' },
  low:      { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-600 dark:text-green-400', badge: 'bg-green-600 text-white' },
};

const PIE_COLORS = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'];

const InventoryAnalytics = ({ inventoryData, narrative }) => {
  const { stockTurnover, reorderSuggestions, categoryBreakdown } = inventoryData;

  return (
    <div className="space-y-6">
      {/* AI Narrative */}
      <Card className="glass-panel border-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0 mt-0.5">
            <Star size={14} className="text-emerald-500" />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{narrative}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Turnover Trend */}
        <Card className="lg:col-span-2 glass-panel glass-panel-hover border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-teal-500" />
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-white">Stock Turnover Trend</CardTitle>
                <CardDescription>Inventory efficiency over 6 months</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stockTurnover}>
                  <CartesianGrid vertical={false} strokeOpacity={0.1} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={v => `${v}x`} />
                  <Tooltip contentStyle={{ backgroundColor: '#12161C', border: '1px solid #1F2630', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                  <Line type="monotone" dataKey="turnover" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 4, fill: '#0d9488' }} name="Turnover Rate" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown Pie */}
        <Card className="glass-panel glass-panel-hover border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-purple-500" />
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-white">By Category</CardTitle>
                <CardDescription>Stock value distribution</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={75}
                    paddingAngle={3} dataKey="value"
                    stroke="none"
                  >
                    {categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#12161C', border: '1px solid #1F2630', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                  <Legend
                    iconType="circle"
                    formatter={(val) => <span className="text-[10px] text-gray-600 dark:text-gray-300">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reorder Suggestions Table */}
      <Card className="glass-panel glass-panel-hover border-0">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <div>
              <CardTitle className="text-base text-gray-900 dark:text-white">Reorder Suggestions</CardTitle>
              <CardDescription>AI-generated restocking recommendations</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5">
                  <th className="text-left p-3 pl-5 text-muted-foreground font-medium">Product</th>
                  <th className="text-center p-3 text-muted-foreground font-medium">Current Stock</th>
                  <th className="text-center p-3 text-muted-foreground font-medium">Reorder Point</th>
                  <th className="text-center p-3 text-muted-foreground font-medium">Daily Usage</th>
                  <th className="text-center p-3 text-muted-foreground font-medium">Days Left</th>
                  <th className="text-center p-3 pr-5 text-muted-foreground font-medium">Urgency</th>
                </tr>
              </thead>
              <tbody>
                {reorderSuggestions.map((item, i) => {
                  const style = urgencyStyles[item.urgency] || urgencyStyles.medium;
                  return (
                    <tr key={i} className={`border-b border-gray-50 dark:border-white/[0.02] hover:bg-black/[0.01] dark:hover:bg-white/[0.02] transition-colors`}>
                      <td className="p-3 pl-5 font-medium text-gray-900 dark:text-white">{item.product}</td>
                      <td className={`p-3 text-center font-semibold ${item.stock < item.reorderPoint ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>{item.stock}</td>
                      <td className="p-3 text-center text-gray-500">{item.reorderPoint}</td>
                      <td className="p-3 text-center text-gray-700 dark:text-gray-300">{item.dailyUsage}/day</td>
                      <td className={`p-3 text-center font-semibold ${item.daysLeft <= 3 ? 'text-red-500' : item.daysLeft <= 5 ? 'text-amber-500' : 'text-gray-700 dark:text-gray-300'}`}>
                        {item.daysLeft.toFixed(1)}d
                      </td>
                      <td className="p-3 pr-5 text-center">
                        <Badge className={`text-[10px] ${style.badge} capitalize`}>{item.urgency}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryAnalytics;
