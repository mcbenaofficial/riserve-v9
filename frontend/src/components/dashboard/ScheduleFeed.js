import React from 'react';
import { Check, MessageSquare, RefreshCw, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const statusStyles = {
  'confirmed': { dot: 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]', badge: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
  'in-progress': { dot: 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.4)]', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  'seated': { dot: 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.4)]', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  'pending': { dot: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  'preparing': { dot: 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.4)]', badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
};

const ScheduleFeed = ({ schedule, businessMode }) => {
  return (
    <Card className="glass-panel glass-panel-hover border-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-teal-500" />
            <div>
              <CardTitle className="text-base text-gray-900 dark:text-white">
                {businessMode === 'salon' ? "Today's Schedule" : 'Live Orders & Reservations'}
              </CardTitle>
              <CardDescription className="text-gray-500 dark:text-gray-400">
                {schedule.length} upcoming
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-100 dark:divide-white/5">
          {schedule.map((item) => {
            const style = statusStyles[item.status] || statusStyles.pending;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group"
              >
                {/* Time */}
                <div className="w-16 flex-shrink-0 text-xs font-mono text-muted-foreground">
                  {item.time}
                </div>
                
                {/* Status Dot */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.client}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${style.badge} capitalize`}>
                      {item.status.replace('-', ' ')}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.service} • {item.staff}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-sm font-semibold text-gray-900 dark:text-white flex-shrink-0">
                  ₹{item.amount?.toLocaleString()}
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  {item.status === 'pending' && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-500 hover:bg-green-500/10" title="Confirm">
                      <Check size={12} />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-blue-500 hover:bg-blue-500/10" title="Message">
                    <MessageSquare size={12} />
                  </Button>
                  {businessMode === 'salon' && (
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-amber-500 hover:bg-amber-500/10" title="Reschedule">
                      <RefreshCw size={12} />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleFeed;
