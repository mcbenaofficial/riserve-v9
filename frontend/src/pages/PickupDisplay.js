import React, { useState, useEffect, useCallback } from 'react';
import { Package, CheckCircle, RefreshCw, Loader2, QrCode, User } from 'lucide-react';
import { api } from '../services/api';

const PickupDisplay = ({ theme }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getPickupOrders();
      setOrders(res.data || []);
    } catch (err) {
      console.error('Failed to fetch pickup orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleComplete = async (orderId) => {
    setUpdating(orderId);
    try {
      await api.updateOrderStatus(orderId, { status: 'Completed' });
      await fetchData();
    } catch (err) {
      console.error('Failed to complete order:', err);
    } finally {
      setUpdating(null);
    }
  };

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-[#171C22]' : 'bg-white';
  const textPrimary = isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]';
  const textSecondary = isDark ? 'text-[#7D8590]' : 'text-[#6B7280]';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10">
            <Package size={22} className="text-emerald-500" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${textPrimary}`}>Pickup Counter</h1>
            <p className={`text-sm ${textSecondary}`}>{orders.length} order{orders.length !== 1 ? 's' : ''} ready for collection</p>
          </div>
        </div>
        <button onClick={fetchData} className={`p-2.5 rounded-xl ${isDark ? 'hover:bg-[#1F2630]' : 'hover:bg-gray-100'}`}>
          <RefreshCw size={18} className={textSecondary} />
        </button>
      </div>

      {/* Order Cards — large format for counter display */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orders.map(order => (
          <div key={order.id} className={`p-6 rounded-2xl ${bg} border-2 border-emerald-500/30 transition-all hover:border-emerald-500/50 shadow-lg shadow-emerald-500/5`}>
            {/* Large Order Number */}
            <div className="text-center mb-4">
              <span className="text-emerald-500 text-4xl font-black tracking-wider">{order.order_number}</span>
            </div>

            {/* Customer Info */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <User size={16} className={textSecondary} />
              <span className={`text-lg font-semibold ${textPrimary}`}>{order.customer_name}</span>
            </div>

            {/* Items */}
            <div className={`space-y-1 py-3 px-4 rounded-xl ${isDark ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'} mb-4`}>
              {(order.items || []).map((item, i) => (
                <div key={i} className={`flex items-center gap-2 text-sm ${textPrimary}`}>
                  <span className="text-emerald-500 font-mono font-bold">{item.quantity}×</span>
                  <span>{item.name}</span>
                </div>
              ))}
            </div>

            {/* Action */}
            <button
              onClick={() => handleComplete(order.id)}
              disabled={updating === order.id}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-base transition-all active:scale-95 disabled:opacity-50"
            >
              {updating === order.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={18} />}
              Collected
            </button>
          </div>
        ))}
      </div>

      {orders.length === 0 && (
        <div className="text-center py-20">
          <Package size={48} className={`mx-auto mb-3 ${textSecondary}`} />
          <p className={`${textSecondary} text-lg font-medium`}>No orders to collect</p>
          <p className={`${textSecondary} text-sm mt-1`}>Orders will appear here when they're ready</p>
        </div>
      )}
    </div>
  );
};

export default PickupDisplay;
