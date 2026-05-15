import React, { useState, useEffect, useRef } from 'react';
import { X, UserPlus, Search, Check, ChevronRight } from 'lucide-react';
import { membershipsApi } from '../../services/membershipsApi';

const STEPS = ['Customer', 'Plan', 'Details'];

const COLOR_DOTS = {
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  indigo: 'bg-indigo-500',
};

const EnrollMemberModal = ({ isOpen, onClose, onEnrolled }) => {
  const [step, setStep] = useState(0);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [form, setForm] = useState({ renewal_mode: 'manual', expires_at: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchTimeout = useRef(null);

  useEffect(() => {
    if (isOpen) {
      membershipsApi.getPlans().then((r) => setPlans(r.data)).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    if (!customerSearch.trim()) { setCustomers([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await membershipsApi.searchCustomers(customerSearch);
        setCustomers(res.data?.customers || res.data || []);
        setSearchError('');
      } catch { setCustomers([]); setSearchError('Could not load customers. Check your plan includes CRM access.'); }
      finally { setSearchLoading(false); }
    }, 300);
  }, [customerSearch]);

  if (!isOpen) return null;

  const reset = () => {
    setStep(0); setCustomerSearch(''); setCustomers([]);
    setSelectedCustomer(null); setSelectedPlan(null);
    setForm({ renewal_mode: 'manual', expires_at: '', notes: '' });
    setError('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleEnroll = async () => {
    if (!selectedCustomer || !selectedPlan) return;
    setLoading(true);
    setError('');
    try {
      await membershipsApi.enrollMember({
        customer_id: selectedCustomer.id,
        plan_id: selectedPlan.id,
        renewal_mode: form.renewal_mode,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        notes: form.notes || null,
      });
      reset();
      onEnrolled();
    } catch (err) {
      setError(err.response?.data?.detail || 'Enrollment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59]" onClick={handleClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg max-h-[88vh] flex flex-col bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <UserPlus size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Enroll Member</h2>
                <p className="text-xs text-muted-foreground">Step {step + 1} of 3 — {STEPS[step]}</p>
              </div>
            </div>
            <button onClick={handleClose} className="p-2 rounded-xl hover:bg-muted/30 text-muted-foreground transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-0 px-6 py-3 border-b border-border/30">
            {STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div className={`flex items-center gap-2 text-xs font-medium transition-colors ${i === step ? 'text-foreground' : i < step ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i === step ? 'bg-purple-500 text-white' : i < step ? 'bg-emerald-500 text-white' : 'bg-muted/30 text-muted-foreground'}`}>
                    {i < step ? <Check size={10} /> : i + 1}
                  </div>
                  {s}
                </div>
                {i < STEPS.length - 1 && <ChevronRight size={12} className="mx-2 text-muted-foreground/40 flex-shrink-0" />}
              </React.Fragment>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">{error}</div>
            )}

            {/* Step 0: Customer */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search by name, email, or phone..."
                    className="w-full pl-9 pr-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-purple-500/40 outline-none text-sm transition-all"
                    autoFocus
                  />
                </div>
                {searchLoading && <p className="text-xs text-muted-foreground text-center">Searching...</p>}
                {searchError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm">{searchError}</div>
                )}
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {customers.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCustomer(c)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${selectedCustomer?.id === c.id ? 'bg-purple-500/10 border border-purple-500/30' : 'hover:bg-muted/20 border border-transparent'}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {(c.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.email || c.phone}</p>
                      </div>
                      {selectedCustomer?.id === c.id && <Check size={16} className="text-purple-400 flex-shrink-0" />}
                    </button>
                  ))}
                  {!searchLoading && customerSearch && customers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No customers found</p>
                  )}
                  {!customerSearch && (
                    <p className="text-sm text-muted-foreground text-center py-6">Type to search customers</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 1: Plan */}
            {step === 1 && (
              <div className="space-y-3">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl text-left border transition-all ${selectedPlan?.id === plan.id ? 'border-purple-500/40 bg-purple-500/5' : 'border-border hover:bg-muted/20'}`}
                  >
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${COLOR_DOTS[plan.color] || 'bg-purple-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {plan.price_monthly > 0 ? `₹${plan.price_monthly}/mo` : 'Free'}
                        {plan.benefits?.length > 0 && ` · ${plan.benefits.length} benefit${plan.benefits.length !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    {selectedPlan?.id === plan.id && <Check size={16} className="text-purple-400 flex-shrink-0" />}
                  </button>
                ))}
                {plans.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No plans created yet. Create a plan first.</p>
                )}
              </div>
            )}

            {/* Step 2: Details */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/10 border border-border/50 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Summary</p>
                  <p className="text-sm font-medium text-foreground">{selectedCustomer?.name}</p>
                  <p className="text-xs text-muted-foreground">→ {selectedPlan?.name} plan</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Renewal Mode</label>
                  <div className="flex gap-2">
                    {['manual', 'auto'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, renewal_mode: mode }))}
                        className={`flex-1 py-2.5 rounded-xl border text-sm font-medium capitalize transition-all ${form.renewal_mode === mode ? 'border-purple-500/40 bg-purple-500/10 text-purple-400' : 'border-border text-muted-foreground hover:bg-muted/20'}`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Expiry Date (optional)</label>
                  <input
                    type="date"
                    value={form.expires_at}
                    onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground focus:ring-2 focus:ring-purple-500/40 outline-none text-sm transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Notes (optional)</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Any notes about this membership..."
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-purple-500/40 outline-none text-sm resize-none transition-all"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border/50 flex gap-3">
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted/30 transition-colors">
                Back
              </button>
            ) : (
              <button onClick={handleClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted/30 transition-colors">
                Cancel
              </button>
            )}
            {step < 2 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={(step === 0 && !selectedCustomer) || (step === 1 && !selectedPlan)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-sm font-semibold shadow-lg shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleEnroll}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-sm font-semibold shadow-lg shadow-purple-500/20 disabled:opacity-50 transition-all"
              >
                {loading ? 'Enrolling...' : 'Enroll Member'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default EnrollMemberModal;
