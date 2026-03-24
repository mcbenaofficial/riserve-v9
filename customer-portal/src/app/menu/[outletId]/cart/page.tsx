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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    const raw = sessionStorage.getItem(`cart_${outletId}`);
    if (raw) {
      try {
        setCart(JSON.parse(raw));
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
          items: cart.map((c) => ({
            itemId: c.id,
            name: c.name,
            quantity: c.quantity,
            price: c.price,
          })),
        }),
      });

      if (!res.ok) throw new Error('Order failed');

      const data = await res.json();
      // Clear cart
      sessionStorage.removeItem(`cart_${outletId}`);
      // Redirect to order tracking
      router.push(`/order/${data.confirmation_token}`);
    } catch (e) {
      setError('Failed to place order. Please try again.');
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-8">
        <div className="text-6xl mb-6">🛒</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Your cart is empty</h1>
        <p className="text-gray-400 mb-8">Add some delicious items from the menu</p>
        <Link
          href={`/menu/${outletId}`}
          className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-800 transition-colors"
        >
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href={`/menu/${outletId}`} className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-black text-gray-900">Your Order</h1>
          <span className="text-sm text-gray-400 font-medium">{totalItems} items</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
        {/* Cart Items */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
          {cart.map((item) => (
            <div key={item.id} className="p-4 flex items-center gap-4">
              {/* Veg/Non-veg indicator */}
              <div className={`w-4 h-4 border-2 rounded-sm flex items-center justify-center shrink-0 ${
                item.is_veg ? 'border-green-600' : 'border-red-600'
              }`}>
                <div className={`w-2 h-2 rounded-full ${item.is_veg ? 'bg-green-600' : 'bg-red-600'}`} />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-sm truncate">{item.name}</h3>
                <p className="text-gray-500 text-sm font-medium mt-0.5">₹{item.price}</p>
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-0 rounded-xl overflow-hidden border-2 border-gray-900">
                <button
                  onClick={() => updateQuantity(item.id, -1)}
                  className="w-8 h-8 flex items-center justify-center text-gray-900 text-lg font-bold hover:bg-gray-100 transition-colors"
                >
                  −
                </button>
                <span className="w-8 text-center font-black text-sm">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, 1)}
                  className="w-8 h-8 flex items-center justify-center text-gray-900 text-lg font-bold hover:bg-gray-100 transition-colors"
                >
                  +
                </button>
              </div>

              <span className="font-bold text-gray-900 text-sm w-16 text-right">₹{(item.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
        </div>

        {/* Bill Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider mb-4">Bill Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Item Total</span>
              <span className="font-medium">₹{totalPrice.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Taxes & Charges</span>
              <span className="font-medium">₹{(totalPrice * 0.05).toFixed(0)}</span>
            </div>
            <div className="border-t border-dashed border-gray-200 pt-2 mt-2 flex justify-between text-gray-900 font-black text-base">
              <span>Grand Total</span>
              <span>₹{(totalPrice * 1.05).toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Order Type */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider mb-4">Order Type</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'dine_in', label: '🍽️ Dine-In', desc: 'Eat at the restaurant' },
              { key: 'takeaway', label: '🥡 Takeaway', desc: 'Pick up your order' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setOrderType(t.key)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  orderType === t.key
                    ? 'border-gray-900 bg-gray-50 shadow-sm'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="font-bold text-base">{t.label}</div>
                <div className="text-xs text-gray-400 mt-1">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Customer Details */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider mb-4">Your Details</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-100 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-300 font-medium transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone Number *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-100 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-300 font-medium transition-all"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        {/* Place Order */}
        <button
          onClick={handlePlaceOrder}
          disabled={submitting}
          className="w-full py-5 rounded-2xl bg-gray-900 text-white font-black text-lg shadow-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.01] active:scale-[0.99]"
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
            `Place Order • ₹${(totalPrice * 1.05).toFixed(0)}`
          )}
        </button>

        <p className="text-center text-xs text-gray-400 pb-8">
          By placing this order, you agree to pay at the restaurant
        </p>
      </div>
    </div>
  );
}
