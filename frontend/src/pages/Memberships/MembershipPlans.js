import React, { useState, useEffect } from 'react';
import { Crown, Plus, Edit2, Trash2, Users, Check, Star } from 'lucide-react';
import { membershipsApi } from '../../services/membershipsApi';
import CreatePlanModal from './CreatePlanModal';

const COLOR_GRADIENTS = {
  blue: 'from-blue-500 to-indigo-600',
  purple: 'from-purple-500 to-violet-600',
  emerald: 'from-emerald-500 to-green-600',
  amber: 'from-amber-500 to-yellow-500',
  rose: 'from-rose-500 to-pink-600',
  indigo: 'from-indigo-500 to-blue-700',
};

const BENEFIT_ICONS = {
  discount_pct: '🏷️',
  priority_booking: '⚡',
  credit_on_join: '💰',
  free_service_monthly: '🎁',
  custom: '✨',
};

const MembershipPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await membershipsApi.getPlans();
      setPlans(res.data);
    } catch (err) {
      console.error('Failed to fetch plans', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (plan) => {
    if (plan.active_member_count > 0) {
      setError(`Cannot delete "${plan.name}" — it has ${plan.active_member_count} active members.`);
      return;
    }
    if (!window.confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    try {
      setDeletingId(plan.id);
      await membershipsApi.deletePlan(plan.id);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete plan');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Star size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Plans & Benefits</h1>
            <p className="text-sm text-muted-foreground">Configure your membership tiers</p>
          </div>
        </div>
        <button
          onClick={() => { setEditPlan(null); setShowCreate(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-sm font-medium shadow-lg shadow-purple-500/20 transition-all"
        >
          <Plus size={16} />
          New Plan
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">{error}</div>
      )}

      {/* Plans Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Crown size={48} className="text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No plans yet</h3>
          <p className="text-sm text-muted-foreground mb-6">Create your first membership tier to get started</p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-sm font-medium shadow-lg shadow-purple-500/20 transition-all"
          >
            <Plus size={16} /> Create First Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const grad = COLOR_GRADIENTS[plan.color] || COLOR_GRADIENTS.purple;
            return (
              <div key={plan.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:shadow-black/10 transition-all group">
                {/* Color band */}
                <div className={`bg-gradient-to-r ${grad} h-2`} />

                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{plan.slug}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditPlan(plan); setShowCreate(true); }}
                        className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(plan)}
                        disabled={deletingId === plan.id}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Pricing */}
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-2xl font-bold text-foreground">
                      {plan.currency === 'INR' ? '₹' : plan.currency === 'USD' ? '$' : plan.currency}
                      {plan.price_monthly > 0 ? plan.price_monthly : '0'}
                    </span>
                    <span className="text-xs text-muted-foreground">/mo</span>
                    {plan.price_yearly > 0 && (
                      <span className="text-xs text-muted-foreground ml-2">
                        · {plan.currency === 'INR' ? '₹' : '$'}{plan.price_yearly}/yr
                      </span>
                    )}
                  </div>

                  {plan.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{plan.description}</p>
                  )}

                  {/* Benefits */}
                  {plan.benefits && plan.benefits.length > 0 && (
                    <div className="space-y-1.5 mb-4">
                      {plan.benefits.slice(0, 4).map((b, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-foreground">
                          <span>{BENEFIT_ICONS[b.type] || '✨'}</span>
                          <span>{b.label || b.value}</span>
                        </div>
                      ))}
                      {plan.benefits.length > 4 && (
                        <p className="text-xs text-muted-foreground">+{plan.benefits.length - 4} more</p>
                      )}
                    </div>
                  )}

                  {/* Member count */}
                  <div className="flex items-center gap-1.5 pt-3 border-t border-border/50">
                    <Users size={13} className="text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {plan.active_member_count} active member{plan.active_member_count !== 1 ? 's' : ''}
                    </span>
                    {!plan.is_active && (
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground">Inactive</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreatePlanModal
          isOpen={showCreate}
          onClose={() => { setShowCreate(false); setEditPlan(null); }}
          onSaved={fetchPlans}
          editPlan={editPlan}
        />
      )}
    </div>
  );
};

export default MembershipPlans;
