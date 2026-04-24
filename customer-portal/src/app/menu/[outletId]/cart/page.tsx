'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  is_veg: boolean;
  image_url: string | null;
}

export default function CartPage({ params }: { params: Promise<{ outletId: string }> }) {
  const { outletId } = use(params);
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orderType, setOrderType] = useState('dine_in');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Color scheme from menu page (saved in sessionStorage)
  const [colors, setColors] = useState<Record<string, string>>({});
  const primaryColor = colors.primary || '#1A1A1A';
  const secondaryColor = colors.secondary || colors.primary || '#F59E0B';
  const bgColor = colors.bgColor || '#FAFAFA';
  const surfaceColor = colors.surfaceColor || '#FFFFFF';
  const textColor = colors.textColor || '#1A1A1A';
  const fontFamily = colors.fontFamily || 'Inter';

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    // Load color scheme
    const rawColors = sessionStorage.getItem(`colors_${outletId}`);
    if (rawColors) {
      try { setColors(JSON.parse(rawColors)); } catch {}
    }
    // Load cart
    const raw = sessionStorage.getItem(`cart_${outletId}`);
    if (raw) {
      try { setCart(JSON.parse(raw)); } catch {}
    }
    // Pre-fill from identity gate
    const identity = sessionStorage.getItem(`customer_${outletId}`);
    if (identity) {
      try {
        const data = JSON.parse(identity);
        if (data.name) setName(data.name);
        if (data.phone) setPhone(data.phone);
        if (typeof data.whatsappOptIn === 'boolean') setWhatsappOptIn(data.whatsappOptIn);
      } catch {}
    }
  }, [outletId]);

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      const updated = prev.map((c) => (c.id === itemId ? { ...c, quantity: c.quantity + delta } : c)).filter((c) => c.quantity > 0);
      sessionStorage.setItem(`cart_${outletId}`, JSON.stringify(updated));
      return updated;
    });
  };

  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);
  const totalPrice = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    if (cart.length === 0) { setError('Your cart is empty'); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND}/api/public/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          customer_name: name,
          contact_number: phone,
          order_type: orderType,
          whatsapp_opt_in: whatsappOptIn,
          items: cart.map((c) => ({ itemId: c.id, name: c.name, quantity: c.quantity, price: c.price })),
        }),
      });
      if (!res.ok) throw new Error('Order failed');
      const data = await res.json();
      sessionStorage.removeItem(`cart_${outletId}`);
      router.push(`/order/${data.confirmation_token}`);
    } catch {
      setError('Failed to place order. Please try again.');
      setSubmitting(false);
    }
  };

  // Glass surface style helper
  const glassCard = {
    backgroundColor: `${surfaceColor}D8`,
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: `1px solid rgba(255,255,255,0.28)`,
    boxShadow: `0 4px 24px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.5)`,
  } as React.CSSProperties;

  const glassInput = {
    background: `${surfaceColor}B0`,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: `1px solid rgba(255,255,255,0.25)`,
    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.05)',
  } as React.CSSProperties;

  if (cart.length === 0) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-8"
        style={{ fontFamily: `${fontFamily}, system-ui, sans-serif` }}
      >
        {/* Background */}
        <div className="fixed inset-0 -z-10" style={{ backgroundColor: bgColor }}>
          <div className="absolute -top-[20%] -right-[10%] rounded-full" style={{ width: '60vw', height: '60vw', background: primaryColor, opacity: 0.12, filter: 'blur(90px)' }} />
          <div className="absolute bottom-[5%] left-[10%] rounded-full" style={{ width: '45vw', height: '45vw', background: secondaryColor, opacity: 0.09, filter: 'blur(80px)' }} />
        </div>
        <div className="text-6xl mb-6" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}>🛒</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: textColor }}>Your cart is empty</h1>
        <p className="mb-8" style={{ color: textColor, opacity: 0.45 }}>Add some delicious items from the menu</p>
        <Link
          href={`/menu/${outletId}`}
          className="px-8 py-4 rounded-2xl font-bold text-lg text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ backgroundColor: primaryColor, boxShadow: `0 8px 24px ${primaryColor}40` }}
        >
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ fontFamily: `${fontFamily}, system-ui, sans-serif` }}
    >
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700;900&display=swap');` }} />

      {/* ── Fixed glass background layer ── */}
      <div className="fixed inset-0 -z-10 overflow-hidden" style={{ backgroundColor: bgColor }}>
        <div className="absolute -top-[20%] -right-[10%] rounded-full" style={{ width: '65vw', height: '65vw', background: primaryColor, opacity: 0.13, filter: 'blur(90px)' }} />
        <div className="absolute top-[35%] -left-[15%] rounded-full" style={{ width: '55vw', height: '55vw', background: secondaryColor, opacity: 0.09, filter: 'blur(100px)' }} />
        <div className="absolute bottom-[5%] right-[20%] rounded-full" style={{ width: '40vw', height: '40vw', background: primaryColor, opacity: 0.07, filter: 'blur(80px)' }} />
      </div>

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-40"
        style={{
          backgroundColor: `${surfaceColor}E8`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid rgba(255,255,255,0.22)`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}
      >
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href={`/menu/${outletId}`}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-[1.05] active:scale-[0.95]"
            style={{
              ...glassCard,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg className="w-5 h-5" style={{ color: textColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-black" style={{ color: textColor }}>Your Order</h1>
          <span className="text-sm font-medium" style={{ color: textColor, opacity: 0.45 }}>{totalItems} items</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4 pb-10">

        {/* ── Cart Items ── */}
        <div className="rounded-2xl overflow-hidden" style={glassCard}>
          {cart.map((item, idx) => (
            <div
              key={item.id}
              className="p-4 flex items-center gap-4"
              style={{ borderBottom: idx < cart.length - 1 ? `1px solid rgba(255,255,255,0.15)` : 'none' }}
            >
              {/* Veg/Non-veg indicator */}
              <div className={`w-4 h-4 border-2 rounded-sm flex items-center justify-center shrink-0 ${item.is_veg ? 'border-green-500' : 'border-red-500'}`}
                style={{ background: 'rgba(255,255,255,0.9)' }}>
                <div className={`w-2 h-2 rounded-full ${item.is_veg ? 'bg-green-500' : 'bg-red-500'}`} />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm truncate" style={{ color: textColor }}>{item.name}</h3>
                <p className="text-sm font-medium mt-0.5" style={{ color: secondaryColor }}>₹{item.price}</p>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center rounded-xl overflow-hidden shadow-md" style={{ backgroundColor: primaryColor }}>
                <button
                  onClick={() => updateQuantity(item.id, -1)}
                  className="w-8 h-8 flex items-center justify-center text-white text-lg font-bold hover:bg-black/15 transition-colors"
                >−</button>
                <span className="w-8 text-center text-white font-black text-sm">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, 1)}
                  className="w-8 h-8 flex items-center justify-center text-white text-lg font-bold hover:bg-black/15 transition-colors"
                >+</button>
              </div>

              <span className="font-bold text-sm w-16 text-right" style={{ color: textColor }}>₹{(item.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
        </div>

        {/* ── Bill Summary ── */}
        <div className="rounded-2xl p-5" style={glassCard}>
          <h3 className="font-bold text-xs uppercase tracking-wider mb-4" style={{ color: textColor, opacity: 0.5 }}>Bill Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between" style={{ color: textColor }}>
              <span style={{ opacity: 0.65 }}>Item Total</span>
              <span className="font-medium">₹{totalPrice.toFixed(0)}</span>
            </div>
            <div className="flex justify-between" style={{ color: textColor }}>
              <span style={{ opacity: 0.65 }}>Taxes & Charges</span>
              <span className="font-medium">₹{(totalPrice * 0.05).toFixed(0)}</span>
            </div>
            <div
              className="pt-3 mt-2 flex justify-between font-black text-base"
              style={{ borderTop: `1px solid rgba(255,255,255,0.25)`, color: textColor }}
            >
              <span>Grand Total</span>
              <span style={{ color: secondaryColor }}>₹{(totalPrice * 1.05).toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* ── Order Type ── */}
        <div className="rounded-2xl p-5" style={glassCard}>
          <h3 className="font-bold text-xs uppercase tracking-wider mb-4" style={{ color: textColor, opacity: 0.5 }}>Order Type</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'dine_in', label: '🍽️ Dine-In', desc: 'Eat at the restaurant' },
              { key: 'takeaway', label: '🥡 Takeaway', desc: 'Pick up your order' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setOrderType(t.key)}
                className="p-4 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={
                  orderType === t.key
                    ? {
                        backgroundColor: `${primaryColor}18`,
                        border: `2px solid ${primaryColor}`,
                        boxShadow: `0 4px 16px ${primaryColor}20`,
                      }
                    : {
                        background: 'rgba(128,128,128,0.08)',
                        border: `2px solid rgba(255,255,255,0.18)`,
                      }
                }
              >
                <div className="font-bold text-base" style={{ color: orderType === t.key ? primaryColor : textColor }}>{t.label}</div>
                <div className="text-xs mt-1" style={{ color: textColor, opacity: 0.45 }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Customer Details ── */}
        <div className="rounded-2xl p-5" style={glassCard}>
          <h3 className="font-bold text-xs uppercase tracking-wider mb-4" style={{ color: textColor, opacity: 0.5 }}>Your Details</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: textColor, opacity: 0.55 }}>Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3.5 rounded-xl font-medium transition-all focus:outline-none"
                style={{ ...glassInput, color: textColor }}
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: textColor, opacity: 0.55 }}>Phone Number *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-3.5 rounded-xl font-medium transition-all focus:outline-none"
                style={{ ...glassInput, color: textColor }}
              />
            </div>
          </div>
        </div>

        {/* ── WhatsApp Opt-In ── */}
        <div className="rounded-2xl p-5" style={glassCard}>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(e) => setWhatsappOptIn(e.target.checked)}
              className="w-5 h-5 rounded border-green-300 text-green-500 focus:ring-green-400 mt-0.5 shrink-0"
            />
            <div>
              <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: textColor }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-500 shrink-0" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
                </svg>
                Receive updates on WhatsApp
              </span>
              <span className="text-[11px] mt-0.5 block" style={{ color: textColor, opacity: 0.45 }}>Order status, delivery updates &amp; receipts</span>
            </div>
          </label>
        </div>

        {/* Error */}
        {error && (
          <div
            className="px-4 py-3 rounded-xl text-sm font-medium"
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#ef4444',
            }}
          >
            {error}
          </div>
        )}

        {/* ── Place Order ── */}
        <button
          onClick={handlePlaceOrder}
          disabled={submitting}
          className="w-full py-5 rounded-2xl text-white font-black text-lg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: `${primaryColor}F2`,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: `0 8px 32px ${primaryColor}40, inset 0 1px 0 rgba(255,255,255,0.2)`,
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Placing Order...
            </span>
          ) : (
            `Place Order · ₹${(totalPrice * 1.05).toFixed(0)}`
          )}
        </button>

        <p className="text-center text-xs pb-8" style={{ color: textColor, opacity: 0.3 }}>
          By placing this order, you agree to pay at the restaurant
        </p>
      </div>
    </div>
  );
}
