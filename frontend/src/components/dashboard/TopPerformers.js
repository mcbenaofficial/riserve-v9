import React from 'react';
import { Trophy, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';

const TopPerformers = ({ performers, businessMode }) => {
  const maxValue = Math.max(...performers.map(p => p.revenue));

  return (
    <Card className="glass-panel glass-panel-hover border-0">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <div>
            <CardTitle className="text-base text-gray-900 dark:text-white">
              {businessMode === 'salon' ? 'Top Services' : 'Best Sellers'}
            </CardTitle>
            <CardDescription className="text-gray-500 dark:text-gray-400">This month's leaders</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {performers.map((item, index) => {
          const pct = maxValue > 0 ? (item.revenue / maxValue) * 100 : 0;
          const rankColors = [
            'from-amber-500 to-yellow-400',
            'from-gray-400 to-gray-300',
            'from-amber-700 to-amber-600',
            'from-teal-500 to-teal-400',
            'from-blue-500 to-blue-400',
          ];
          
          return (
            <div key={index} className="group">
              <div className="flex items-center gap-3">
                {/* Rank */}
                <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${rankColors[index] || 'from-gray-500 to-gray-400'} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <span className="text-[10px] font-bold text-white">{index + 1}</span>
                </div>
                
                {/* Name + Bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</span>
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                      {item.value} {item.metric}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Revenue */}
                <div className="text-xs font-semibold text-gray-900 dark:text-white flex-shrink-0 w-16 text-right">
                  ₹{(item.revenue / 1000).toFixed(0)}k
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default TopPerformers;
