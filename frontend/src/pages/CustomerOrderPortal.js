import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Coffee, MapPin, Phone, ChevronRight, UtensilsCrossed, ShoppingBag, Truck } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ORDER_TYPES = [
  { id: 'dine_in', label: 'Dine In', icon: UtensilsCrossed, desc: 'Eat at the restaurant' },
  { id: 'takeaway', label: 'Takeaway', icon: ShoppingBag, desc: 'Pick up your order' },
  { id: 'delivery', label: 'Home Delivery', icon: Truck, desc: 'Delivered to your door' },
];

const CustomerOrderPortal = () => {
  const { outletId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orderType, setOrderType] = useState('dine_in');
  const [loading, setLoading] = useState(false);

  const outletName = searchParams.get('name') || 'Restaurant';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    navigate(`/order/${outletId}/menu?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&type=${orderType}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] flex flex-col">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent" />
        <div className="relative px-6 pt-12 pb-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30 mb-4">
            <Coffee size={36} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">Welcome</h1>
          <p className="text-amber-200/70 text-sm">Place your order in just a few taps</p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-5 pb-8">
        <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-6">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
              className="w-full px-4 py-3.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all text-base"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Contact Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91-XXXXX-XXXXX"
              className="w-full px-4 py-3.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 transition-all text-base"
            />
          </div>

          {/* Order Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Order Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              {ORDER_TYPES.map((type) => {
                const Icon = type.icon;
                const selected = orderType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setOrderType(type.id)}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 ${
                      selected
                        ? 'bg-amber-500/20 border-amber-400/60 shadow-lg shadow-amber-500/10'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <Icon size={22} className={selected ? 'text-amber-400' : 'text-gray-400'} />
                    <span className={`text-xs font-semibold ${selected ? 'text-amber-300' : 'text-gray-400'}`}>
                      {type.label}
                    </span>
                    {selected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-base shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 active:scale-[0.98]"
          >
            Browse Menu
            <ChevronRight size={18} />
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 text-center">
        <p className="text-gray-500 text-xs">
          Powered by <span className="text-gray-400 font-semibold">Ri'Serve</span>
        </p>
      </div>
    </div>
  );
};

export default CustomerOrderPortal;
