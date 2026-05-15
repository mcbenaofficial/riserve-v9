import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Crown } from 'lucide-react';
import { membershipsApi } from '../../services/membershipsApi';

const BENEFIT_TYPES = [
  { value: 'discount_pct', label: 'Discount %' },
  { value: 'priority_booking', label: 'Priority Booking' },
  { value: 'credit_on_join', label: 'Credits on Join' },
  { value: 'free_service_monthly', label: 'Free Service (Monthly)' },
  { value: 'custom', label: 'Custom Perk' },
];

const PLAN_COLORS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'emerald', label: 'Emerald', class: 'bg-emerald-500' },
  { value: 'amber', label: 'Gold', class: 'bg-amber-500' },
  { value: 'rose', label: 'Rose', class: 'bg-rose-500' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
];

const defaultBenefit = () => ({ type: 'discount_pct', value: '', label: '' });

const CreatePlanModal = ({ isOpen, onClose, onSaved, editPlan = null }) => {
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    price_monthly: '',
    price_yearly: '',
    currency: 'INR',
    color: 'purple',
    sort_order: 0,
    benefits: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editPlan) {
      setForm({
        name: editPlan.name || '',
        slug: editPlan.slug || '',
        description: editPlan.description || '',
        price_monthly: editPlan.price_monthly || '',
        price_yearly: editPlan.price_yearly || '',
        currency: editPlan.currency || 'INR',
        color: editPlan.color || 'purple',
        sort_order: editPlan.sort_order || 0,
        benefits: editPlan.benefits || [],
      });
    }
  }, [editPlan]);

  if (!isOpen) return null;

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleNameChange = (val) => {
    set('name', val);
    if (!editPlan) {
      set('slug', val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    }
  };

  const addBenefit = () => set('benefits', [...form.benefits, defaultBenefit()]);
  const removeBenefit = (i) => set('benefits', form.benefits.filter((_, idx) => idx !== i));
  const updateBenefit = (i, key, val) => {
    const updated = [...form.benefits];
    updated[i] = { ...updated[i], [key]: val };
    set('benefits', updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        price_monthly: parseFloat(form.price_monthly) || 0,
        price_yearly: parseFloat(form.price_yearly) || 0,
        sort_order: parseInt(form.sort_order) || 0,
      };
      if (editPlan) {
        await membershipsApi.updatePlan(editPlan.id, payload);
      } else {
        await membershipsApi.createPlan(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-2xl max-h-[88vh] flex flex-col bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Crown size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{editPlan ? 'Edit Plan' : 'Create Plan'}</h2>
                <p className="text-xs text-muted-foreground">Define membership tier and benefits</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted/30 text-muted-foreground transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">{error}</div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Plan Name</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Gold, Premium, Basic"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-purple-500/40 outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Slug</label>
                <input
                  required
                  type="text"
                  value={form.slug}
                  onChange={(e) => set('slug', e.target.value)}
                  placeholder="gold"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-purple-500/40 outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => set('currency', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:ring-2 focus:ring-purple-500/40 outline-none text-sm transition-all"
                >
                  <option value="INR">INR ₹</option>
                  <option value="USD">USD $</option>
                  <option value="EUR">EUR €</option>
                  <option value="GBP">GBP £</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Monthly Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price_monthly}
                  onChange={(e) => set('price_monthly', e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-purple-500/40 outline-none text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Yearly Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price_yearly}
                  onChange={(e) => set('price_yearly', e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-purple-500/40 outline-none text-sm transition-all"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="What does this membership include?"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-purple-500/40 outline-none text-sm transition-all resize-none"
                />
              </div>

              {/* Color picker */}
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Plan Color</label>
                <div className="flex items-center gap-2">
                  {PLAN_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => set('color', c.value)}
                      className={`w-8 h-8 rounded-full ${c.class} transition-all ${form.color === c.value ? 'ring-2 ring-offset-2 ring-offset-card ring-white scale-110' : 'opacity-60 hover:opacity-100'}`}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Benefits */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Benefits</label>
                <button
                  type="button"
                  onClick={addBenefit}
                  className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <Plus size={14} /> Add benefit
                </button>
              </div>
              <div className="space-y-2">
                {form.benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={b.type}
                      onChange={(e) => updateBenefit(i, 'type', e.target.value)}
                      className="px-3 py-2 rounded-xl bg-background border border-border text-foreground text-sm focus:ring-2 focus:ring-purple-500/40 outline-none transition-all"
                    >
                      {BENEFIT_TYPES.map((bt) => (
                        <option key={bt.value} value={bt.value}>{bt.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={b.value}
                      onChange={(e) => updateBenefit(i, 'value', e.target.value)}
                      placeholder="Value (e.g. 10%)"
                      className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground text-sm focus:ring-2 focus:ring-purple-500/40 outline-none transition-all"
                    />
                    <input
                      type="text"
                      value={b.label}
                      onChange={(e) => updateBenefit(i, 'label', e.target.value)}
                      placeholder="Label"
                      className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground text-sm focus:ring-2 focus:ring-purple-500/40 outline-none transition-all"
                    />
                    <button type="button" onClick={() => removeBenefit(i)} className="p-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {form.benefits.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3 border border-dashed border-border rounded-xl">
                    No benefits added yet. Click "Add benefit" to start.
                  </p>
                )}
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border/50 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted/30 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-sm font-semibold shadow-lg shadow-purple-500/20 disabled:opacity-50 transition-all"
            >
              {loading ? 'Saving...' : editPlan ? 'Save Changes' : 'Create Plan'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreatePlanModal;
