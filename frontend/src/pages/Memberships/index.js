import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown, Users, TrendingUp, AlertCircle, Plus, UserPlus,
  ArrowRight, CheckCircle2, XCircle, Clock, BarChart3
} from 'lucide-react';
import { membershipsApi } from '../../services/membershipsApi';
import EnrollMemberModal from './EnrollMemberModal';

const Memberships = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEnroll, setShowEnroll] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await membershipsApi.getStats();
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch membership stats', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats
    ? [
        {
          label: 'Total Members',
          value: stats.total_members,
          icon: Users,
          gradient: 'from-blue-500 to-indigo-600',
          sub: `${stats.active_members} active`,
        },
        {
          label: 'Active Members',
          value: stats.active_members,
          icon: CheckCircle2,
          gradient: 'from-emerald-500 to-green-600',
          sub: `${stats.new_this_month} joined this month`,
        },
        {
          label: 'Expiring Soon',
          value: stats.expiring_soon,
          icon: AlertCircle,
          gradient: 'from-amber-500 to-orange-500',
          sub: 'within 7 days',
        },
        {
          label: 'New This Month',
          value: stats.new_this_month,
          icon: TrendingUp,
          gradient: 'from-purple-500 to-violet-600',
          sub: `${stats.cancelled_members} cancelled total`,
        },
      ]
    : [];

  const STATUS_ICON = {
    active: <CheckCircle2 size={14} className="text-emerald-400" />,
    expired: <Clock size={14} className="text-amber-400" />,
    cancelled: <XCircle size={14} className="text-red-400" />,
    paused: <Clock size={14} className="text-blue-400" />,
  };

  const STATUS_CLASS = {
    active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
    expired: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
    cancelled: 'text-red-400 bg-red-500/10 border-red-500/25',
    paused: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Crown size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Memberships</h1>
            <p className="text-sm text-muted-foreground">Manage tiers, members, and benefits</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/memberships/plans')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
          >
            <BarChart3 size={16} />
            Manage Plans
          </button>
          <button
            onClick={() => setShowEnroll(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-sm font-medium shadow-lg shadow-purple-500/20 transition-all"
          >
            <UserPlus size={16} />
            Enroll Member
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-5 text-white shadow-lg`}
            >
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-medium text-white/80">{card.label}</p>
                <card.icon size={18} className="text-white/70" />
              </div>
              <p className="text-3xl font-bold">{card.value}</p>
              <p className="text-xs text-white/70 mt-1">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members by Plan */}
        {stats && stats.members_by_plan.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Members by Plan</h2>
            <div className="space-y-3">
              {stats.members_by_plan.map((row) => {
                const maxCount = Math.max(...stats.members_by_plan.map(r => r.count), 1);
                const pct = Math.round((row.count / maxCount) * 100);
                return (
                  <div key={row.plan_name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-foreground">{row.plan_name}</span>
                      <span className="text-sm font-semibold text-foreground">{row.count}</span>
                    </div>
                    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Enrollments */}
        {stats && (
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Recent Enrollments</h2>
              <button
                onClick={() => navigate('/memberships/members')}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-2">
              {stats.recent_enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No enrollments yet</p>
              ) : (
                stats.recent_enrollments.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{m.plan_name}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${STATUS_CLASS[m.status] || STATUS_CLASS.active}`}>
                      {STATUS_ICON[m.status]}
                      {m.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showEnroll && (
        <EnrollMemberModal
          isOpen={showEnroll}
          onClose={() => setShowEnroll(false)}
          onEnrolled={() => { setShowEnroll(false); fetchStats(); }}
        />
      )}
    </div>
  );
};

export default Memberships;
