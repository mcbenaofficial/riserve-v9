import React, { useState } from 'react';
import {
  Flame, TrendingUp, Target, Star, Info
} from 'lucide-react';
import {
  Area, AreaChart, Line, LineChart, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TrendsForecasting = ({ businessMode, heatmapData, forecastData, narrative }) => {
  const [forecastRange, setForecastRange] = useState('7d');

  // ── Demand Heatmap ────────────────────────────────────────────────
  const maxVal = Math.max(...(heatmapData || []).flatMap(row => DAYS.map(d => row[d] || 0)));

  const getHeatColor = (val) => {
    if (maxVal === 0) return 'bg-gray-100 dark:bg-white/5';
    const intensity = val / maxVal;
    if (intensity >= 0.8) return 'bg-teal-600 text-white';
    if (intensity >= 0.6) return 'bg-teal-500 text-white';
    if (intensity >= 0.4) return 'bg-teal-400/60 text-teal-900 dark:text-teal-100';
    if (intensity >= 0.2) return 'bg-teal-300/40 text-teal-800 dark:text-teal-200';
    return 'bg-teal-100/40 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300';
  };

  return (
    <div className="space-y-6">
      {/* AI Narrative */}
      <Card className="glass-panel border-0 bg-gradient-to-r from-orange-500/5 to-red-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 flex-shrink-0 mt-0.5">
            <Star size={14} className="text-orange-500" />
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{narrative}</p>
        </CardContent>
      </Card>

      {/* Demand Heatmap */}
      <Card className="glass-panel glass-panel-hover border-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-white">Demand Heatmap</CardTitle>
                <CardDescription>{businessMode === 'salon' ? 'Bookings' : 'Covers'} by day & hour</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <div className="w-3 h-3 rounded-sm bg-teal-100/40 dark:bg-teal-500/10" /> Low
              <div className="w-3 h-3 rounded-sm bg-teal-400/60 ml-1" /> Med
              <div className="w-3 h-3 rounded-sm bg-teal-600 ml-1" /> High
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left text-muted-foreground font-medium py-2 pr-3 w-16">Hour</th>
                  {DAYS.map(d => (
                    <th key={d} className="text-center text-muted-foreground font-medium py-2 px-1 w-14">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(heatmapData || []).map((row, i) => (
                  <tr key={i}>
                    <td className="text-muted-foreground font-mono py-1 pr-3">{row.hour}</td>
                    {DAYS.map(d => (
                      <td key={d} className="py-1 px-1">
                        <div className={`w-full h-8 rounded-md flex items-center justify-center font-semibold text-[11px] transition-all hover:scale-110 cursor-default ${getHeatColor(row[d] || 0)}`}>
                          {row[d] || 0}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Forecast Chart */}
      <Card className="glass-panel glass-panel-hover border-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-white">Revenue Forecast</CardTitle>
                <CardDescription>AI-predicted revenue with confidence band</CardDescription>
              </div>
            </div>
            <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-lg p-0.5 border border-gray-200 dark:border-white/10">
              {['7d', '30d'].map(r => (
                <button
                  key={r}
                  onClick={() => setForecastRange(r)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    forecastRange === r
                      ? 'bg-white dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {r === '7d' ? '7 Day' : '30 Day'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData}>
                <defs>
                  <linearGradient id="fillForecastBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeOpacity={0.1} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#12161C', border: '1px solid #1F2630', borderRadius: 8, fontSize: 12, color: '#fff' }} />
                <Legend iconType="circle" />
                {/* Confidence band (upper as area, lower as area) */}
                <Area type="monotone" dataKey="upper" name="Upper Bound" stroke="none" fill="url(#fillForecastBand)" dot={false} />
                <Area type="monotone" dataKey="lower" name="Lower Bound" stroke="none" fill="transparent" dot={false} />
                {/* Forecast line */}
                <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#3b82f6' }} />
                {/* Actual line */}
                <Line type="monotone" dataKey="actual" name="Actual" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 4, fill: '#0d9488' }} connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Info size={12} />
            <span>Shaded area represents 90% confidence interval. Dashed line = AI forecast.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrendsForecasting;
