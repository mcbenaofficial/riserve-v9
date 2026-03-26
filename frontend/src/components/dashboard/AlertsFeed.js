import React from 'react';
import { AlertTriangle, Info, CheckCircle2, XCircle, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';

const severityConfig = {
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10', dot: 'bg-amber-500' },
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', dot: 'bg-red-500' },
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', dot: 'bg-blue-500' },
  success: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', dot: 'bg-green-500' },
};

const AlertsFeed = ({ alerts }) => {
  return (
    <Card className="glass-panel glass-panel-hover border-0">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-purple-500" />
          <div>
            <CardTitle className="text-base text-gray-900 dark:text-white">Quick Alerts</CardTitle>
            <CardDescription className="text-gray-500 dark:text-gray-400">{alerts.length} notifications</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert) => {
          const config = severityConfig[alert.severity] || severityConfig.info;
          const Icon = config.icon;

          return (
            <div
              key={alert.id}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg ${config.bg} border border-transparent hover:border-white/10 transition-all cursor-pointer`}
            >
              <Icon size={14} className={`${config.color} mt-0.5 flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-900 dark:text-white leading-relaxed">{alert.message}</p>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">{alert.time}</span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default AlertsFeed;
