import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';

const OccupancyGauge = ({ used, total, label, unit, breakdown }) => {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const available = total - used;

  const data = [
    { name: 'Occupied', value: used },
    { name: 'Available', value: available },
  ];

  const getColor = () => {
    if (pct >= 90) return { occupied: '#ef4444', available: '#fecaca' };
    if (pct >= 70) return { occupied: '#0d9488', available: '#99f6e4' };
    return { occupied: '#3b82f6', available: '#dbeafe' };
  };

  const colors = getColor();

  return (
    <Card className="glass-panel glass-panel-hover border-0 relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base text-gray-900 dark:text-white">{label}</CardTitle>
            <CardDescription className="text-gray-500 dark:text-gray-400">Real-time occupancy</CardDescription>
          </div>
          <div className={`text-2xl font-bold ${pct >= 90 ? 'text-red-500' : pct >= 70 ? 'text-teal-500' : 'text-blue-500'}`}>
            {pct}%
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Gauge */}
          <div className="relative w-32 h-20 flex-shrink-0">
            <ResponsiveContainer width="100%" height={80}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="100%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={50}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  <Cell fill={colors.occupied} />
                  <Cell fill={colors.available} className="opacity-20 dark:opacity-10" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
              <span className="text-lg font-bold text-gray-900 dark:text-white">{used}</span>
              <span className="text-xs text-muted-foreground">/{total}</span>
            </div>
          </div>

          {/* Breakdown Grid */}
          {breakdown && (
            <div className="flex-1 grid grid-cols-3 gap-1.5 max-h-[100px] overflow-hidden">
              {breakdown.slice(0, 9).map((item, i) => (
                <div
                  key={i}
                  className={`rounded-md px-1.5 py-1 text-center text-[10px] font-medium transition-all cursor-default ${
                    item.status === 'occupied'
                      ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
                      : 'bg-gray-100 dark:bg-white/5 text-muted-foreground border border-transparent'
                  }`}
                  title={item.status === 'occupied' ? `${item.client} – ${item.service} (until ${item.endsAt})` : 'Available'}
                >
                  {item.name.replace('Chair ', 'C').replace('Table ', 'T')}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.occupied }} />
            <span>Occupied ({used})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span>Available ({available})</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OccupancyGauge;
