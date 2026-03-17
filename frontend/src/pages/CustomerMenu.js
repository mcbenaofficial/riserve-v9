import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, ArrowLeft, Search, X, Loader2 } from 'lucide-react';
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

  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cartItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  const filteredItems = useMemo(() => {
    if (!menuData?.items) return [];
    let items = menuData.items;
    if (searchQuery) {
      items = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    } else if (activeCategory) {
      items = items.filter(i => i.category === activeCategory);
    }
    return items;
  }, [menuData, activeCategory, searchQuery]);

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
      <div className="min-h-screen bg-[#0f0c29] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0c29] flex flex-col pb-24">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-[#0f0c29]/95 backdrop-blur-lg border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-bold text-base">{menuData?.outlet?.name || 'Menu'}</h1>
            <p className="text-amber-400/70 text-xs">{menuData?.company?.name}</p>
          </div>
          <div className="relative">
            <button 
              onClick={() => setShowCart(true)}
              className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 relative"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        {!searchQuery && (
          <div className="flex gap-1 px-4 pb-3 overflow-x-auto scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Menu Items */}
      <div className="flex-1 px-4 py-4 space-y-3">
        {filteredItems.map(item => {
          const inCart = cart[item.id]?.quantity || 0;
          const soldOut = !item.available;
          return (
            <div
              key={item.id}
              className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                soldOut
                  ? 'bg-white/[0.02] border-white/5 opacity-50'
                  : 'bg-white/[0.04] border-white/10 hover:border-white/20'
              }`}
            >
              {/* Item Image Placeholder */}
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-amber-600/20 to-orange-600/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">{item.category === 'Coffee' ? '☕' : item.category === 'Tea' ? '🍵' : item.category === 'Smoothies' ? '🥤' : item.category === 'Snacks' ? '🥑' : item.category === 'Mains' ? '🍔' : '🍰'}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-white font-semibold text-sm">{item.name}</h3>
                    {item.description && (
                      <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-amber-400 font-bold text-sm">₹{item.price}</span>
                  {soldOut ? (
                    <span className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-bold">Sold Out</span>
                  ) : inCart > 0 ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-amber-400 hover:bg-white/20 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-white font-bold text-sm w-5 text-center">{inCart}</span>
                      <button
                        onClick={() => addToCart(item)}
                        className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white hover:bg-amber-600 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-400 text-xs font-semibold hover:bg-amber-500/10 transition-colors"
                    >
                      <Plus size={12} />
                      ADD
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filteredItems.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm">No items found</p>
          </div>
        )}
      </div>

      {/* Floating Cart Bar */}
      {cartCount > 0 && !showCart && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-gradient-to-t from-[#0f0c29] via-[#0f0c29] to-transparent pt-8">
          <button
            onClick={() => setShowCart(true)}
            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-xl shadow-amber-500/30 active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-3">
              <ShoppingCart size={18} />
              <span>{cartCount} item{cartCount > 1 ? 's' : ''}</span>
            </div>
            <span className="text-lg">₹{cartTotal.toFixed(0)}</span>
          </button>
        </div>
      )}

      {/* Cart Sheet */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="relative mt-auto bg-[#1a1a2e] rounded-t-3xl max-h-[80vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-white font-bold text-lg">Your Order</h2>
              <button onClick={() => setShowCart(false)} className="p-2 rounded-lg hover:bg-white/5 text-gray-400">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {cartItems.map(item => (
                <div key={item.id} className="flex items-center justify-between py-3 border-b border-white/5">
                  <div className="flex-1">
                    <h4 className="text-white font-medium text-sm">{item.name}</h4>
                    <p className="text-amber-400/70 text-xs mt-0.5">₹{item.price} × {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-gray-300">
                        <Minus size={12} />
                      </button>
                      <span className="text-white font-bold text-sm w-4 text-center">{item.quantity}</span>
                      <button onClick={() => addToCart(item)} className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-white">
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className="text-white font-semibold text-sm w-16 text-right">₹{(item.price * item.quantity).toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Subtotal</span>
                <span className="text-white font-bold text-lg">₹{cartTotal.toFixed(0)}</span>
              </div>
              <button
                onClick={handlePlaceOrder}
                disabled={submitting}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg shadow-amber-500/30 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  `Place Order  •  ₹${cartTotal.toFixed(0)}`
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
