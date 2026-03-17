import React, { useState, useEffect, useCallback } from 'react';
import { ChefHat, ArrowRight, RefreshCw, Loader2, Timer, Package } from 'lucide-react';
import { api } from '../services/api';

const KitchenDisplay = ({ theme }) => {
  const [data, setData] = useState({ orders: [], aggregated_items: [] });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getKitchenOrders();
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch kitchen orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleMarkReady = async (orderId) => {
    setUpdating(orderId);
    try {
      await api.updateOrderStatus(orderId, { status: 'ReadyToCollect' });
      await fetchData();
    } catch (err) {
      console.error('Failed to mark ready:', err);
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
        <Loader2 size={28} className="animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10">
            <ChefHat size={22} className="text-amber-500" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${textPrimary}`}>Kitchen Display</h1>
            <p className={`text-sm ${textSecondary}`}>{data.orders.length} order{data.orders.length !== 1 ? 's' : ''} being prepared</p>
          </div>
        </div>
        <button onClick={fetchData} className={`p-2.5 rounded-xl ${isDark ? 'hover:bg-[#1F2630]' : 'hover:bg-gray-100'}`}>
          <RefreshCw size={18} className={textSecondary} />
        </button>
      </div>

      {/* Aggregated Items */}
      {data.aggregated_items.length > 0 && (
        <div className={`p-5 rounded-2xl ${bg}`}>
          <h3 className={`text-sm font-semibold ${textSecondary} uppercase tracking-wider mb-3`}>Items to Prepare</h3>
          <div className="flex flex-wrap gap-2">
            {data.aggregated_items.map((item, i) => (
              <div key={i} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                <span className="text-amber-500 font-bold text-lg">{item.quantity}×</span>
                <span className={`font-medium ${textPrimary}`}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.orders.map(order => {
          const minutes = order.created_at
            ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
            : 0;
          return (
            <div key={order.id} className={`p-5 rounded-2xl ${bg} border-2 border-amber-500/20 transition-all hover:border-amber-500/40`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className={`text-xl font-bold ${textPrimary}`}>{order.order_number}</span>
                  <p className={`text-sm ${textSecondary} mt-0.5`}>{order.customer_name}</p>
                </div>
                <div className="flex items-center gap-1 text-amber-500">
                  <Timer size={14} />
                  <span className="text-sm font-semibold">{minutes}m</span>
                </div>
              </div>

              <div className={`space-y-1.5 py-3 px-3 rounded-xl ${isDark ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'} mb-4`}>
                {(order.items || []).map((item, i) => (
                  <div key={i} className={`flex items-center gap-2 text-base ${textPrimary}`}>
                    <span className="text-amber-500 font-mono font-bold">{item.quantity}×</span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleMarkReady(order.id)}
                disabled={updating === order.id}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all active:scale-95 disabled:opacity-50"
              >
                {updating === order.id ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                Mark Ready
              </button>
            </div>
          );
        })}
      </div>

      {data.orders.length === 0 && (
        <div className="text-center py-20">
          <ChefHat size={48} className={`mx-auto mb-3 ${textSecondary}`} />
          <p className={`${textSecondary} text-lg font-medium`}>Kitchen is clear!</p>
          <p className={`${textSecondary} text-sm mt-1`}>No orders being prepared right now</p>
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;
