import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Filter, UserPlus, CheckCircle2, XCircle,
  Clock, PauseCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { membershipsApi } from '../../services/membershipsApi';
import MemberDetailDrawer from './MemberDetailDrawer';
import EnrollMemberModal from './EnrollMemberModal';

const STATUS_CONFIG = {
  active: { icon: CheckCircle2, class: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
  expired: { icon: Clock, class: 'text-amber-400 bg-amber-500/10 border-amber-500/25' },
  cancelled: { icon: XCircle, class: 'text-red-400 bg-red-500/10 border-red-500/25' },
  paused: { icon: PauseCircle, class: 'text-blue-400 bg-blue-500/10 border-blue-500/25' },
};

const STATUSES = ['', 'active', 'expired', 'cancelled', 'paused'];

const MemberDirectory = () => {
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showEnroll, setShowEnroll] = useState(false);
  const perPage = 20;

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (planFilter) params.plan_id = planFilter;
      const res = await membershipsApi.getMembers(params);
      setMembers(res.data.members || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch members', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, planFilter]);

  useEffect(() => {
    membershipsApi.getPlans().then((r) => setPlans(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, planFilter]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const totalPages = Math.ceil(total / perPage);
  const fmt = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Member Directory</h1>
            <p className="text-sm text-muted-foreground">{total} member{total !== 1 ? 's' : ''} total</p>
          </div>
        </div>
        <button
          onClick={() => setShowEnroll(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-sm font-medium shadow-lg shadow-purple-500/20 transition-all"
        >
          <UserPlus size={16} />
          Enroll Member
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-purple-500/40 outline-none text-sm transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-purple-500/40 outline-none transition-all"
          >
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-purple-500/40 outline-none transition-all"
          >
            <option value="">All Plans</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plan</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enrolled</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expires</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Credits</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-muted/20 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-muted-foreground text-sm">
                    {search || statusFilter || planFilter
                      ? 'No members match your filters'
                      : 'No members enrolled yet'}
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const sc = STATUS_CONFIG[m.status] || STATUS_CONFIG.active;
                  const StatusIcon = sc.icon;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedMember(m)}
                      className="border-b border-border/30 hover:bg-muted/10 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(m.customer_name || '?').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{m.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{m.customer_email || m.customer_phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-foreground">{m.plan_name || '—'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${sc.class}`}>
                          <StatusIcon size={11} />
                          {m.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{fmt(m.enrolled_at)}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{fmt(m.expires_at)}</td>
                      <td className="px-5 py-4 text-sm text-foreground">₹{(m.credits_balance || 0).toFixed(2)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-border hover:bg-muted/20 text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-foreground px-2">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-border hover:bg-muted/20 text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedMember && (
        <MemberDetailDrawer
          membership={selectedMember}
          onClose={() => setSelectedMember(null)}
          onUpdated={fetchMembers}
        />
      )}

      {showEnroll && (
        <EnrollMemberModal
          isOpen={showEnroll}
          onClose={() => setShowEnroll(false)}
          onEnrolled={() => { setShowEnroll(false); fetchMembers(); }}
        />
      )}
    </div>
  );
};

export default MemberDirectory;
