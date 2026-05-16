import React, { useState, useEffect } from 'react';
import { X, Check, Crown, Loader2, Zap, CreditCard } from 'lucide-react';
import { marketplaceApi } from '../../services/marketplaceApi';

const TIER_DETAILS = {
  indie:   { label: 'Indie',   color: '#6b7280', agents: 3,    tokens: '500K',      price: 0 },
  startup: { label: 'Startup', color: '#3b82f6', agents: 10,   tokens: '2M',        price: 2999 },
  studio:  { label: 'Studio',  color: '#8b5cf6', agents: 15,   tokens: '5M',        price: 6999 },
  firm:    { label: 'Firm',    color: '#f59e0b', agents: 28,   tokens: '15M',       price: 14999 },
  corp:    { label: 'Corp',    color: '#ef4444', agents: '∞', tokens: 'Unlimited', price: 29999 },
};

const TIER_FEATURES = {
  startup: ['10 agent slots', '2M tokens/month', 'Standard agents', 'Usage analytics'],
  studio:  ['15 agent slots', '5M tokens/month', 'Advanced agents', 'Priority support'],
  firm:    ['28 agent slots', '15M tokens/month', 'Elite agents', 'Priority support', 'Token overage billing'],
  corp:    ['Unlimited agents', 'Unlimited tokens', 'Custom agents via Flow builder', 'Dedicated support', 'Custom SLA'],
};

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-sdk')) { resolve(true); return; }
    const script = document.createElement('script');
    script.id = 'razorpay-sdk';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function TierUpgradeModal({ currentTier, upgradeOptions, onClose, onUpgraded }) {
  const [selectedTier, setSelectedTier] = useState(upgradeOptions[0]?.tier_key || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const detail = TIER_DETAILS[selectedTier] || {};
  const features = TIER_FEATURES[selectedTier] || [];
  const isFree = (detail.price || 0) === 0;

  const handleUpgrade = async () => {
    if (!selectedTier) return;
    setLoading(true);
    setError(null);

    try {
      if (isFree) {
        // Free tier — direct upgrade, no payment
        await marketplaceApi.upgradeTier(selectedTier);
        onUpgraded();
        onClose();
        return;
      }

      // Paid tier: create Razorpay order first
      const orderRes = await marketplaceApi.createTierOrder(selectedTier);
      const { order_id, amount, key_id } = orderRes.data;

      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded) {
        setError('Could not load payment SDK. Please check your internet connection.');
        setLoading(false);
        return;
      }

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: key_id,
          amount: amount * 100, // paise
          currency: 'INR',
          order_id,
          name: "Ri'Serve Marketplace",
          description: `${detail.label} Plan — ₹${(detail.price || 0).toLocaleString('en-IN')}/mo`,
          handler: async (response) => {
            try {
              await marketplaceApi.upgradeTier(selectedTier, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              onUpgraded();
              onClose();
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
              reject(new Error('dismissed'));
            },
          },
          theme: { color: '#0E1116' },
        });
        rzp.open();
      });
    } catch (err) {
      if (err?.message === 'dismissed') return;
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'object' ? detail.message : (detail || 'Upgrade failed. Please try again.');
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg pointer-events-auto overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-2">
              <Crown size={20} className="text-amber-400" />
              <h2 className="font-bold text-foreground text-lg">Upgrade Your Team</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/20 transition-colors duration-200">
              <X size={18} className="text-muted-foreground" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Current plan */}
            <div className="flex items-center justify-between bg-background rounded-xl px-4 py-3 border border-border">
              <span className="text-sm text-muted-foreground">Current plan</span>
              <span className="text-sm font-semibold text-foreground capitalize">{currentTier?.tier_label}</span>
            </div>

            {/* Tier options */}
            <div className="space-y-2">
              {upgradeOptions.map(opt => {
                const d = TIER_DETAILS[opt.tier_key] || {};
                const isSelected = selectedTier === opt.tier_key;
                return (
                  <button
                    key={opt.tier_key}
                    onClick={() => setSelectedTier(opt.tier_key)}
                    className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between gap-3 ${
                      isSelected ? 'border-accent bg-accent/5' : 'border-border bg-card hover:border-border/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ background: d.color || '#6b7280' }}
                      >
                        {opt.tier_key.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{d.label}</p>
                        <p className="text-xs text-muted-foreground">{d.agents} agents · {d.tokens} tokens/mo</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-foreground text-sm">
                        {d.price === 0 ? 'Free' : `₹${(d.price || 0).toLocaleString('en-IN')}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">/month</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected tier features */}
            {features.length > 0 && (
              <div className="bg-card rounded-xl p-4 border border-border space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What you get</p>
                {features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-foreground/80">
                    <Check size={13} className="text-emerald-400 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <button
              onClick={handleUpgrade}
              disabled={!selectedTier || loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl accent-gradient-bg text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity duration-200"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isFree ? (
                <><Zap size={18} /> Upgrade to {detail.label}</>
              ) : (
                <><CreditCard size={18} /> Pay ₹{(detail.price || 0).toLocaleString('en-IN')} &amp; Upgrade</>
              )}
            </button>
            <p className="text-center text-[11px] text-muted-foreground mt-3">
              {isFree
                ? 'Your team limit unlocks immediately.'
                : 'Secured by Razorpay. Cancel anytime from settings.'}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
