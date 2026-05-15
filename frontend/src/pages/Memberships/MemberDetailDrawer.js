import React, { useState, useEffect } from 'react';
import {
  X, Crown, CheckCircle2, XCircle, Clock, PauseCircle, PlayCircle,
  RefreshCw, Coins, Calendar, User, CreditCard, ScrollText, ChevronDown
} from 'lucide-react';
import { membershipsApi } from '../../services/membershipsApi';

const STATUS_CONFIG = {
  active: { icon: CheckCircle2, class: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', label: 'Active' },
  expired: { icon: Clock, class: 'text-amber-400 bg-amber-500/10 border-amber-500/25', label: 'Expired' },
  cancelled: { icon: XCircle, class: 'text-red-400 bg-red-500/10 border-red-500/25', label: 'Cancelled' },
  paused: { icon: PauseCircle, class: 'text-blue-400 bg-blue-500/10 border-blue-500/25', label: 'Paused' },
};

const EVENT_LABELS = {
  enrolled: '🎉 Enrolled',
  renewed: '🔄 Renewed',
  expired: '⏰ Expired',
  cancelled: '❌ Cancelled',
  paused: '⏸️ Paused',
  resumed: '▶️ Resumed',
  plan_changed: '🔀 Plan Changed',
  benefit_used: '⚡ Benefit Used',
};

const MemberDetailDrawer = ({ membership, onClose, onUpdated }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [showCreditsForm, setShowCreditsForm] = useState(false);
  const [showRenewForm, setShowRenewForm] = useState(false);
  const [creditsForm, setCreditsForm] = useState({ amount: '', description: '' });
  const [renewForm, setRenewForm] = useState({ expires_at: '' });
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (membership) fetchDetail();
  }, [membership]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await membershipsApi.getMember(membership.id);
      setDetail(res.data);
    } catch (err) {
      setError('Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  const doAction = async (action, payload = {}) => {
    setActionLoading(action);
    setError('');
    try {
      if (action === 'cancel') await membershipsApi.cancelMember(detail.id, payload);
      else if (action === 'pause') await membershipsApi.pauseMember(detail.id);
      else if (action === 'resume') await membershipsApi.resumeMember(detail.id);
      else if (action === 'renew') await membershipsApi.renewMember(detail.id, payload);
      else if (action === 'credits') await membershipsApi.issueCredits(detail.id, payload);
      await fetchDetail();
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.detail || 'Action failed');
    } finally {
      setActionLoading('');
    }
  };

  if (!membership) return null;

  const status = detail?.status || membership.status;
  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const StatusIcon = sc.icon;

  const fmt = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-xl max-h-[90vh] flex flex-col bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border/50">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/20">
                  {(detail?.customer_name || membership.customer_name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{detail?.customer_name || membership.customer_name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${sc.class}`}>
                      <StatusIcon size={11} />
                      {sc.label}
                    </span>
                    {(detail?.plan_name || membership.plan_name) && (
                      <span className="text-xs text-muted-foreground">{detail?.plan_name || membership.plan_name}</span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted/30 text-muted-foreground transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-4">
              {['overview', 'transactions', 'timeline'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${activeTab === tab ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">{error}</div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-muted/20 animate-pulse" />
                ))}
              </div>
            ) : detail ? (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Key info grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { icon: Crown, label: 'Plan', value: detail.plan_name || '—' },
                        { icon: CreditCard, label: 'Credits', value: `${detail.credits_balance?.toFixed(2) || '0.00'} cr` },
                        { icon: Calendar, label: 'Enrolled', value: fmt(detail.enrolled_at) },
                        { icon: Clock, label: 'Expires', value: fmt(detail.expires_at) },
                        { icon: User, label: 'Email', value: detail.customer_email || '—' },
                        { icon: User, label: 'Phone', value: detail.customer_phone || '—' },
                      ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/10 border border-border/50">
                          <Icon size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
                            <p className="text-sm font-medium text-foreground truncate">{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {detail.notes && (
                      <div className="p-3 rounded-xl bg-muted/10 border border-border/50">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Notes</p>
                        <p className="text-sm text-foreground">{detail.notes}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Actions</p>
                      <div className="space-y-2">
                        {/* Renew */}
                        <button
                          onClick={() => setShowRenewForm(!showRenewForm)}
                          className="w-full flex items-center gap-2 p-3 rounded-xl border border-border hover:bg-muted/20 text-foreground text-sm font-medium transition-all"
                        >
                          <RefreshCw size={14} className="text-blue-400" />
                          Renew Membership
                          <ChevronDown size={14} className={`ml-auto text-muted-foreground transition-transform ${showRenewForm ? 'rotate-180' : ''}`} />
                        </button>
                        {showRenewForm && (
                          <div className="px-3 pb-3 space-y-2 border border-border rounded-xl">
                            <div className="pt-3">
                              <label className="block text-xs text-muted-foreground mb-1">New expiry date</label>
                              <input
                                type="date"
                                value={renewForm.expires_at}
                                onChange={(e) => setRenewForm({ expires_at: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-purple-500/40 outline-none transition-all"
                              />
                            </div>
                            <button
                              disabled={!renewForm.expires_at || actionLoading === 'renew'}
                              onClick={() => doAction('renew', { expires_at: new Date(renewForm.expires_at).toISOString() })}
                              className="w-full py-2 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400 text-sm font-medium hover:bg-blue-500/20 disabled:opacity-40 transition-all"
                            >
                              {actionLoading === 'renew' ? 'Renewing...' : 'Confirm Renew'}
                            </button>
                          </div>
                        )}

                        {/* Issue Credits */}
                        <button
                          onClick={() => setShowCreditsForm(!showCreditsForm)}
                          className="w-full flex items-center gap-2 p-3 rounded-xl border border-border hover:bg-muted/20 text-foreground text-sm font-medium transition-all"
                        >
                          <Coins size={14} className="text-amber-400" />
                          Issue / Deduct Credits
                          <ChevronDown size={14} className={`ml-auto text-muted-foreground transition-transform ${showCreditsForm ? 'rotate-180' : ''}`} />
                        </button>
                        {showCreditsForm && (
                          <div className="px-3 pb-3 space-y-2 border border-border rounded-xl">
                            <div className="pt-3 grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">Amount (- to deduct)</label>
                                <input
                                  type="number"
                                  value={creditsForm.amount}
                                  onChange={(e) => setCreditsForm((f) => ({ ...f, amount: e.target.value }))}
                                  placeholder="e.g. 100 or -50"
                                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-purple-500/40 outline-none transition-all"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-muted-foreground mb-1">Description</label>
                                <input
                                  type="text"
                                  value={creditsForm.description}
                                  onChange={(e) => setCreditsForm((f) => ({ ...f, description: e.target.value }))}
                                  placeholder="Welcome bonus"
                                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-purple-500/40 outline-none transition-all"
                                />
                              </div>
                            </div>
                            <button
                              disabled={!creditsForm.amount || !creditsForm.description || actionLoading === 'credits'}
                              onClick={() => doAction('credits', { amount: parseFloat(creditsForm.amount), description: creditsForm.description })}
                              className="w-full py-2 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-40 transition-all"
                            >
                              {actionLoading === 'credits' ? 'Processing...' : 'Apply Credits'}
                            </button>
                          </div>
                        )}

                        {/* Pause / Resume */}
                        {detail.status === 'active' && (
                          <button
                            onClick={() => doAction('pause')}
                            disabled={actionLoading === 'pause'}
                            className="w-full flex items-center gap-2 p-3 rounded-xl border border-border hover:bg-muted/20 text-muted-foreground text-sm font-medium transition-all disabled:opacity-50"
                          >
                            <PauseCircle size={14} className="text-blue-400" />
                            {actionLoading === 'pause' ? 'Pausing...' : 'Pause Membership'}
                          </button>
                        )}
                        {detail.status === 'paused' && (
                          <button
                            onClick={() => doAction('resume')}
                            disabled={actionLoading === 'resume'}
                            className="w-full flex items-center gap-2 p-3 rounded-xl border border-border hover:bg-muted/20 text-foreground text-sm font-medium transition-all disabled:opacity-50"
                          >
                            <PlayCircle size={14} className="text-emerald-400" />
                            {actionLoading === 'resume' ? 'Resuming...' : 'Resume Membership'}
                          </button>
                        )}

                        {/* Cancel */}
                        {detail.status !== 'cancelled' && (
                          <button
                            onClick={() => { if (window.confirm('Cancel this membership?')) doAction('cancel', {}); }}
                            disabled={actionLoading === 'cancel'}
                            className="w-full flex items-center gap-2 p-3 rounded-xl border border-red-500/20 hover:bg-red-500/5 text-red-400 text-sm font-medium transition-all disabled:opacity-50"
                          >
                            <XCircle size={14} />
                            {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel Membership'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Transactions Tab */}
                {activeTab === 'transactions' && (
                  <div className="space-y-2">
                    {(!detail.transactions || detail.transactions.length === 0) ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
                    ) : (
                      detail.transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/10 border border-border/50">
                          <div className="flex items-center gap-2.5">
                            <CreditCard size={14} className="text-muted-foreground flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-foreground">{tx.description}</p>
                              <p className="text-xs text-muted-foreground">{tx.transaction_type} · {fmt(tx.created_at)}</p>
                            </div>
                          </div>
                          <span className={`text-sm font-semibold ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {tx.amount >= 0 ? '+' : '-'}{Math.abs(tx.amount).toFixed(2)} cr
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Timeline Tab */}
                {activeTab === 'timeline' && (
                  <div className="space-y-3">
                    {(!detail.events || detail.events.length === 0) ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No events yet</p>
                    ) : (
                      detail.events.map((ev) => (
                        <div key={ev.id} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                            <div className="w-px flex-1 bg-border/50 mt-1" />
                          </div>
                          <div className="pb-3 flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{EVENT_LABELS[ev.event_type] || ev.event_type}</p>
                            <p className="text-xs text-muted-foreground">{fmt(ev.created_at)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border/50">
            <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted/30 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default MemberDetailDrawer;
