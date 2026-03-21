import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, ArrowLeft, Search, X, Loader2, Star } from 'lucide-react';
import { getImageUrl } from '../services/api';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CustomerMenu = () => {
  const { outletId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const customerName = searchParams.get('name') || 'Guest';
  const contactNumber = searchParams.get('phone') || '';
  const orderType = searchParams.get('type') || 'dine_in';

  const [menuData, setMenuData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({});
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vegOnly, setVegOnly] = useState(false);

  useEffect(() => {
    // Enforce entry gate
    const rawName = searchParams.get('name');
    const rawPhone = searchParams.get('phone');
    if (!rawName || !rawPhone) {
      navigate(`/order/${outletId}`, { replace: true });
    }
  }, [searchParams, outletId, navigate]);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await axios.get(`${API}/public/menu/${outletId}`);
        setMenuData(res.data);
        const cats = Object.keys(res.data.categories || {});
        if (cats.length > 0) setActiveCategory(cats[0]);
      } catch (err) {
        console.error('Failed to fetch menu:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [outletId]);

  const addToCart = (item) => {
    setCart(prev => ({
      ...prev,
      [item.id]: {
        ...item,
        quantity: (prev[item.id]?.quantity || 0) + 1
      }
    }));
  };

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const updated = { ...prev };
      if (updated[itemId]?.quantity > 1) {
        updated[itemId] = { ...updated[itemId], quantity: updated[itemId].quantity - 1 };
      } else {
        delete updated[itemId];
      }
      return updated;
    });
  };

  const bestSellers = useMemo(() => {
    if (!menuData?.items) return [];
    let items = menuData.items.filter(i => i.available);
    if (vegOnly) items = items.filter(i => i.is_veg !== false);
    return items.slice(0, 5);
  }, [menuData, vegOnly]);

  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cartItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  const filteredItems = useMemo(() => {
    if (!menuData?.items) return [];
    let items = menuData.items;
    if (vegOnly) items = items.filter(i => i.is_veg !== false);

    if (searchQuery) {
      items = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    } else if (activeCategory) {
      items = items.filter(i => i.category === activeCategory);
    }
    return items;
  }, [menuData, activeCategory, searchQuery, vegOnly]);

  const categories = menuData?.categories ? Object.keys(menuData.categories) : [];

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/public/order`, {
        outlet_id: outletId,
        customer_name: customerName,
        contact_number: contactNumber,
        order_type: orderType,
        items: cartItems.map(i => ({
          itemId: i.id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
      });
      const token = res.data.confirmation_token;
      navigate(`/order/status/${token}`);
    } catch (err) {
      console.error('Order failed:', err);
      alert('Failed to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-gray-800" />
      </div>
    );
  }

  const scheme = menuData?.outlet?.portal_color_scheme || {};
  const useCustomConfig = menuData?.outlet?.portal_custom_colors;
  const primaryColor = useCustomConfig && scheme.primary ? scheme.primary : '#1a1a1a';
  const bgColor = useCustomConfig && scheme.bgColor ? scheme.bgColor : '#FAFAFA';
  const textColor = useCustomConfig && scheme.textColor ? scheme.textColor : '#1a1a1a';
  const fontFamily = useCustomConfig && scheme.fontFamily ? scheme.fontFamily : 'Inter';
  const heroImage = useCustomConfig && scheme.heroImage ? scheme.heroImage : null;
  
  const customStyle = { 
    '--theme-primary': primaryColor,
    backgroundColor: bgColor,
    color: textColor,
    fontFamily: fontFamily
  };

  return (
    <div className="min-h-screen flex flex-col pb-24 font-sans transition-colors duration-500" style={customStyle}>
      {/* Import Dynamic Font */}
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap');`}} />

      {/* Top Bar */}
      <div className="sticky top-0 z-30 backdrop-blur-md shadow-sm border-b border-black/5" style={{ backgroundColor: bgColor + 'F2' }}>
        <div className="flex items-center gap-4 px-4 py-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-50 text-gray-600 transition-colors">
            <ArrowLeft size={20} strokeWidth={1.5} />
          </button>
          
          <div className="flex-1 flex justify-center items-center">
            {menuData?.outlet?.portal_logo_url ? (
              <img src={getImageUrl(menuData.outlet.portal_logo_url)} alt="Logo" className="h-8 object-contain" />
            ) : (
              <h1 className="font-light tracking-wide text-lg" style={{ color: textColor }}>{menuData?.outlet?.name || 'Menu'}</h1>
            )}
          </div>

          <div className="relative">
            <button 
              onClick={() => setShowCart(true)}
              className="p-2 -mr-2 rounded-full hover:bg-gray-50 text-gray-800 relative transition-colors"
            >
              <ShoppingCart size={20} strokeWidth={1.5} />
              {cartCount > 0 && (
                <span 
                  className="absolute 0 top-0 right-0 w-4 h-4 rounded-full text-[9px] font-bold text-white flex items-center justify-center border-2 border-white"
                  style={useCustomConfig ? { backgroundColor: primaryColor } : { backgroundColor: '#1a1a1a' }}
                >
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="px-5 pb-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: textColor, opacity: 0.5 }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dishes..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none transition-all shadow-sm"
                style={{
                  backgroundColor: textColor + '0A',
                  color: textColor,
                  borderColor: useCustomConfig && searchQuery ? primaryColor : textColor + '1A',
                  '::placeholder': { color: textColor + '80' }
                }}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:opacity-100 transition-opacity"
                  style={{ color: textColor, opacity: 0.5 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Veg Switch */}
            <button
              onClick={() => setVegOnly(!vegOnly)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap"
              style={{
                backgroundColor: vegOnly ? '#22c55e' : textColor + '05',
                color: vegOnly ? '#fff' : textColor,
                borderColor: vegOnly ? '#22c55e' : textColor + '1A'
              }}
            >
              <div className={`w-3 h-3 rounded-full border-2 ${vegOnly ? 'border-white flex items-center justify-center' : ''}`} style={!vegOnly ? { borderColor: '#22c55e' } : {}}>
                {vegOnly && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              Veg Only
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        {!searchQuery && (
          <div className="flex gap-2 px-5 pb-4 overflow-x-auto pb-2">
            {categories.map(cat => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                    isActive
                      ? 'border-transparent shadow-sm'
                      : 'hover:opacity-80'
                  }`}
                  style={isActive 
                    ? { backgroundColor: primaryColor, color: bgColor } 
                    : { backgroundColor: textColor + '0A', borderColor: textColor + '1A', color: textColor }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 px-5 py-6 space-y-8">
        {/* Best Sellers Section */}
        {!searchQuery && bestSellers.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-amber-400 fill-amber-400" />
              <h2 className="text-sm font-semibold tracking-widest uppercase" style={{ color: textColor }}>Our Signatures</h2>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-4 px-5 -mx-5 pb-4">
              {bestSellers.map(item => {
                const inCart = cart[item.id]?.quantity || 0;
                return (
                  <div key={`bs-${item.id}`} className="min-w-[200px] w-[200px] rounded-2xl p-3 border shadow-sm flex flex-col gap-3 shrink-0" style={{ backgroundColor: bgColor, borderColor: textColor + '1A' }}>
                    <div className="w-full h-32 rounded-xl flex items-center justify-center overflow-hidden" style={{ backgroundColor: textColor + '08' }}>
                      {item.image_url ? (
                        <img src={getImageUrl(item.image_url)} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl text-gray-300">🍽️</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-sm truncate" style={{ color: textColor }}>{item.name}</h3>
                      <p className="text-sm font-semibold mt-1 font-serif" style={{ color: textColor }}>₹{item.price}</p>
                    </div>
                    <div className="mt-auto pt-2">
                       {inCart > 0 ? (
                        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-1 border border-gray-100">
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="w-8 h-8 rounded-md bg-white flex items-center justify-center text-gray-600 shadow-sm"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-gray-900 font-semibold text-sm">{inCart}</span>
                          <button
                            onClick={() => addToCart(item)}
                            className="w-8 h-8 rounded-md text-white flex items-center justify-center shadow-sm"
                            style={{ backgroundColor: primaryColor }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(item)}
                          className="w-full py-2 rounded-lg border text-xs font-semibold uppercase tracking-wide transition-colors"
                          style={{ borderColor: primaryColor + '40', color: primaryColor, backgroundColor: primaryColor + '0A' }}
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Menu Items */}
        <div className="space-y-4">
          {!searchQuery && (
            <h2 className="text-sm font-semibold tracking-widest uppercase" style={{ color: textColor }}>{activeCategory}</h2>
          )}
        {filteredItems.map(item => {
          const inCart = cart[item.id]?.quantity || 0;
          const soldOut = !item.available;
          return (
            <div
              key={item.id}
              className={`flex items-start gap-4 p-4 rounded-2xl border shadow-sm transition-all ${
                soldOut ? 'opacity-50' : ''
              }`}
              style={{ backgroundColor: textColor + '05', borderColor: textColor + '11' }}
            >
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="font-medium text-sm" style={{ color: textColor }}>{item.name}</h3>
                {item.description && (
                  <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed opacity-70" style={{ color: textColor }}>{item.description}</p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-semibold text-sm font-serif" style={{ color: textColor }}>₹{item.price}</span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="w-24 h-24 rounded-xl flex items-center justify-center overflow-hidden" style={{ backgroundColor: textColor + '08', border: `1px solid ${textColor}1A` }}>
                  {item.image_url ? (
                    <img src={getImageUrl(item.image_url)} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl text-gray-300">🍽️</span>
                  )}
                </div>

                <div className="-mt-7">
                  {soldOut ? (
                    <span className="block px-3 py-1.5 rounded-lg bg-gray-100 text-gray-400 text-[10px] font-bold uppercase tracking-wider border border-gray-200">
                      Sold Out
                    </span>
                  ) : inCart > 0 ? (
                    <div className="flex items-center justify-between rounded-lg p-1 border shadow-sm w-[90px]" style={{ backgroundColor: bgColor, borderColor: textColor + '1A' }}>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-7 h-7 flex items-center justify-center hover:opacity-70"
                        style={{ color: textColor }}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-semibold text-sm" style={{ color: textColor }}>{inCart}</span>
                      <button
                        onClick={() => addToCart(item)}
                        className="w-7 h-7 flex items-center justify-center hover:opacity-70"
                        style={{ color: textColor }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="w-[90px] py-2 rounded-lg border text-xs font-semibold shadow-sm uppercase tracking-wide transition-colors"
                      style={{ borderColor: primaryColor + '40', color: primaryColor, backgroundColor: bgColor }}
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm italic">No items found</p>
          </div>
        )}
        </div>
      </div>

      {/* Floating Cart Bar */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-5 pt-12" style={{ background: `linear-gradient(to top, ${bgColor}, ${bgColor}E6, transparent)` }}>
          <button
            onClick={() => setShowCart(true)}
            className="w-full flex items-center justify-between px-6 py-4 rounded-2xl font-bold shadow-xl active:scale-[0.99] transition-transform"
            style={{ backgroundColor: primaryColor, color: bgColor, boxShadow: `0 10px 15px -3px ${primaryColor}40` }}
          >
            <div className="flex items-center gap-3">
              <span className="bg-white/20 px-3 py-1 rounded-lg text-sm">{cartCount}</span>
              <span className="font-medium text-sm tracking-wide">View Cart</span>
            </div>
            <span className="text-base font-serif tracking-tight">₹{cartTotal.toFixed(0)}</span>
          </button>
        </div>
      )}

      {/* Cart Sheet */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setShowCart(false)} />
          <div className="relative mt-auto rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up shadow-2xl" style={{ backgroundColor: bgColor }}>
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: textColor + '1A' }}>
              <h2 className="font-semibold text-lg tracking-tight" style={{ color: textColor }}>Your Order</h2>
              <button onClick={() => setShowCart(false)} className="p-2 -mr-2 rounded-full hover:opacity-70 transition-opacity" style={{ color: textColor }}>
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {cartItems.map(item => (
                <div key={item.id} className="flex items-start justify-between py-3 border-b last:border-0" style={{ borderColor: textColor + '0A' }}>
                  <div className="flex-1 pr-4">
                    <h4 className="font-medium text-sm" style={{ color: textColor }}>{item.name}</h4>
                    <p className="text-xs mt-1 opacity-70" style={{ color: textColor }}>₹{item.price}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="font-semibold text-sm font-serif" style={{ color: textColor }}>₹{(item.price * item.quantity).toFixed(0)}</span>
                    <div className="flex items-center justify-between rounded-lg p-1 border" style={{ borderColor: textColor + '1A' }}>
                      <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 flex items-center justify-center hover:opacity-70" style={{ color: textColor }}>
                        <Minus size={12} />
                      </button>
                      <span className="font-semibold text-sm w-6 text-center" style={{ color: textColor }}>{item.quantity}</span>
                      <button onClick={() => addToCart(item)} className="w-7 h-7 flex items-center justify-center rounded-md shadow-sm hover:opacity-90" style={{ backgroundColor: primaryColor, color: bgColor }}>
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-6 border-t space-y-4" style={{ backgroundColor: textColor + '05', borderColor: textColor + '1A' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium uppercase tracking-wider opacity-70" style={{ color: textColor }}>Subtotal</span>
                <span className="font-bold text-xl font-serif" style={{ color: textColor }}>₹{cartTotal.toFixed(0)}</span>
              </div>
              <button
                onClick={handlePlaceOrder}
                disabled={submitting}
                className="w-full py-4 rounded-xl font-semibold text-sm tracking-wide shadow-lg disabled:opacity-50 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: primaryColor, color: bgColor, boxShadow: `0 10px 15px -3px ${primaryColor}40` }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Place Order'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerMenu;
