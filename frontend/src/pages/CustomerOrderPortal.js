import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Coffee, ChevronRight, UtensilsCrossed, ShoppingBag, Truck, Loader2 } from 'lucide-react';
import { api, getImageUrl } from '../services/api';

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
  const [loading, setLoading] = useState(true);
  const [outletInfo, setOutletInfo] = useState(null);

  const outletName = outletInfo?.name || searchParams.get('name') || 'Restaurant';

  useEffect(() => {
    const fetchOutletInfo = async () => {
      try {
        const res = await api.getPublicOutletInfo(outletId);
        setOutletInfo(res.data);
      } catch (err) {
        console.error('Failed to fetch outlet info', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOutletInfo();
  }, [outletId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    navigate(`/order/${outletId}/menu?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}&type=${orderType}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-800" />
      </div>
    );
  }

  const scheme = outletInfo?.portal_color_scheme || {};
  const useCustomConfig = outletInfo?.portal_custom_colors;
  const primaryColor = useCustomConfig && scheme.primary ? scheme.primary : '#1a1a1a';
  const bgColor = useCustomConfig && scheme.bgColor ? scheme.bgColor : '#FAFAFA';
  const textColor = useCustomConfig && scheme.textColor ? scheme.textColor : '#1a1a1a';
  const fontFamily = useCustomConfig && scheme.fontFamily ? scheme.fontFamily : 'Inter';
  
  const customStyle = { 
    '--theme-primary': primaryColor,
    backgroundColor: bgColor,
    color: textColor,
    fontFamily: fontFamily
  };

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-500" style={customStyle}>
      {/* Import Dynamic Font */}
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap');`}} />

      {/* Header */}
      <div className="relative pt-16 pb-12 px-6 flex flex-col items-center justify-center text-center opacity-90 border-b border-black/5" style={{ backgroundColor: bgColor }}>
        {outletInfo?.portal_logo_url ? (
          <img src={getImageUrl(outletInfo.portal_logo_url)} alt={outletName} className="h-16 mb-6 object-contain" />
        ) : (
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 text-gray-800 mb-6 drop-shadow-sm">
            <Coffee size={28} />
          </div>
        )}
        <h1 className="text-2xl font-light tracking-wide mb-2" style={{ color: textColor }}>{outletName}</h1>
        <p className="text-gray-400 text-sm tracking-widest uppercase">Welcome</p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pt-10 pb-12 opacity-95" style={{ backgroundColor: bgColor }}>
        <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-8">
          <div className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
                className="w-full px-0 py-3 bg-transparent border-0 border-b border-black/20 focus:outline-none focus:ring-0 transition-colors text-lg"
                style={{ color: textColor, borderColor: primaryColor + '40' }}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-2">
                Contact Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91-XXXXX-XXXXX"
                className="w-full px-0 py-3 bg-transparent border-0 border-b border-black/20 focus:outline-none focus:ring-0 transition-colors text-lg"
                style={{ color: textColor, borderColor: primaryColor + '40' }}
              />
            </div>
          </div>

          {/* Order Type */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-4">
              Dining Preference
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
                    className={`relative flex flex-col items-center gap-3 p-4 border transition-all duration-300 ${
                      selected
                        ? 'bg-white shadow-sm border-gray-900'
                        : 'bg-white border-transparent hover:border-gray-200'
                    }`}
                    style={selected && outletInfo?.portal_custom_colors ? { borderColor: primaryColor } : {}}
                  >
                    <Icon size={20} className={selected ? 'text-gray-900' : 'text-gray-400'} style={selected && outletInfo?.portal_custom_colors ? { color: primaryColor } : {}} />
                    <span className={`text-[10px] uppercase tracking-wider font-semibold ${selected ? 'text-gray-900' : 'text-gray-400'}`} style={selected && outletInfo?.portal_custom_colors ? { color: primaryColor } : {}}>
                      {type.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-8">
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gray-900 text-white text-sm font-medium tracking-widest uppercase hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
              style={outletInfo?.portal_custom_colors ? { backgroundColor: primaryColor } : {}}
            >
              Browse Menu
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="pb-8 pt-4 text-center">
        <p className="text-gray-300 text-[10px] tracking-widest uppercase">
          Powered by <span className="font-semibold text-gray-400">Ri'Serve</span>
        </p>
      </div>
    </div>
  );
};

export default CustomerOrderPortal;
