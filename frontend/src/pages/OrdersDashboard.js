import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, ChefHat, Package, CheckCircle, XCircle, RefreshCw,
  ArrowRight, Filter, Users, ShoppingBag, UtensilsCrossed, Truck,
  TrendingUp, Loader2, Plus
} from 'lucide-react';
import { api } from '../services/api';

const STATUS_CONFIG = {
  New: { label: 'New', color: 'bg-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10', icon: Clock, next: 'Preparing' },
  Preparing: { label: 'Preparing', color: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10', icon: ChefHat, next: 'ReadyToCollect' },
  ReadyToCollect: { label: 'Ready', color: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: Package, next: 'Completed' },
  Completed: { label: 'Done', color: 'bg-green-500', text: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle },
  Cancelled: { label: 'Cancelled', color: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle },
};

const TYPE_ICONS = { dine_in: UtensilsCrossed, takeaway: ShoppingBag, delivery: Truck };

const OrdersDashboard = ({ theme }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('active');
  const [orders, setOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [activeRes, completedRes, statsRes] = await Promise.all([
        api.getActiveOrders(),
        api.getCompletedOrders(),
        api.getOrderStats(),
      ]);
      setOrders(activeRes.data || []);
      setCompletedOrders(completedRes.data || []);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    setUpdating(orderId);
    try {
      await api.updateOrderStatus(orderId, { status: newStatus });
      await fetchData();
    } catch (err) {
      console.error('Status update failed:', err);
    } finally {
      setUpdating(null);
    }
  };

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-[#171C22]' : 'bg-white';
  const textPrimary = isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]';
  const textSecondary = isDark ? 'text-[#7D8590]' : 'text-[#6B7280]';
  const borderColor = isDark ? 'border-[#1F2630]' : 'border-gray-100';

  const tabs = [
    { id: 'active', label: 'Active Orders', count: orders.length },
    { id: 'kitchen', label: 'Kitchen', count: orders.filter(o => o.status === 'Preparing').length },
    { id: 'pickup', label: 'Pickup', count: orders.filter(o => o.status === 'ReadyToCollect').length },
    { id: 'completed', label: 'Completed', count: completedOrders.length },
  ];

  const displayOrders = activeTab === 'completed'
    ? completedOrders
    : activeTab === 'kitchen'
    ? orders.filter(o => o.status === 'Preparing')
    : activeTab === 'pickup'
    ? orders.filter(o => o.status === 'ReadyToCollect')
    : orders;

  const OrderCard = ({ order }) => {
    const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.New;
    const StatusIcon = statusConfig.icon;
    const TypeIcon = TYPE_ICONS[order.order_type] || UtensilsCrossed;
    const nextStatus = statusConfig.next;

    return (
      <div className={`p-5 rounded-2xl ${bg} border ${borderColor} transition-all hover:shadow-lg`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${textPrimary}`}>{order.order_number}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
                {statusConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-sm ${textSecondary}`}>{order.customer_name}</span>
              <div className={`flex items-center gap-1 ${textSecondary}`}>
                <TypeIcon size={12} />
                <span className="text-xs capitalize">{order.order_type?.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
          <span className={`text-lg font-bold text-emerald-500`}>₹{parseFloat(order.total_amount).toFixed(0)}</span>
        </div>

        <div className={`space-y-1 py-2 px-3 rounded-xl ${isDark ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'} mb-3`}>
          {(order.items || []).map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className={textSecondary}>
                <span className="text-amber-500 font-mono mr-1">{item.quantity}×</span>
                {item.name}
              </span>
              <span className={textSecondary}>₹{(item.price * item.quantity).toFixed(0)}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className={`text-xs ${textSecondary}`}>
            {order.created_at ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
          {nextStatus && (
            <button
              onClick={() => handleStatusUpdate(order.id, nextStatus)}
              disabled={updating === order.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all active:scale-95 ${
                nextStatus === 'Preparing' ? 'bg-amber-500 hover:bg-amber-600' :
                nextStatus === 'ReadyToCollect' ? 'bg-emerald-500 hover:bg-emerald-600' :
                nextStatus === 'Completed' ? 'bg-green-500 hover:bg-green-600' :
                'bg-[#5FA8D3] hover:bg-[#4A95C0]'
              } disabled:opacity-50`}
            >
              {updating === order.id ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              Mark {STATUS_CONFIG[nextStatus]?.label || nextStatus}
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-[#5FA8D3]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>Orders</h1>
          <p className={`text-sm ${textSecondary} mt-0.5`}>Manage restaurant orders in real time</p>
        </div>
        <button onClick={fetchData} className={`p-2.5 rounded-xl ${isDark ? 'hover:bg-[#1F2630]' : 'hover:bg-gray-100'} transition-colors`}>
          <RefreshCw size={18} className={textSecondary} />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Today', value: stats.total_orders_today, icon: TrendingUp, color: 'text-[#5FA8D3]' },
            { label: 'Active', value: stats.active_count, icon: Clock, color: 'text-amber-500' },
            { label: 'Completed', value: stats.by_status?.Completed || 0, icon: CheckCircle, color: 'text-green-500' },
            { label: 'Revenue', value: `₹${(stats.total_revenue_today || 0).toFixed(0)}`, icon: TrendingUp, color: 'text-emerald-500' },
          ].map((s, i) => (
            <div key={i} className={`p-4 rounded-2xl ${bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <s.icon size={16} className={s.color} />
                <span className={`text-xs ${textSecondary}`}>{s.label}</span>
              </div>
              <span className={`text-xl font-bold ${textPrimary}`}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-[#5FA8D3] text-white shadow-lg shadow-[#5FA8D3]/20'
                : `${isDark ? 'bg-[#1F2630] text-[#7D8590] hover:bg-[#2A313C]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-xs ${
                activeTab === tab.id ? 'bg-white/20' : isDark ? 'bg-[#171C22]' : 'bg-white'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {displayOrders.map(order => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>

      {displayOrders.length === 0 && (
        <div className="text-center py-16">
          <Package size={40} className={`mx-auto mb-3 ${textSecondary}`} />
          <p className={`${textSecondary} text-sm`}>
            {activeTab === 'completed' ? 'No completed orders yet' : 'No active orders'}
          </p>
        </div>
      )}
    </div>
  );
};

export default OrdersDashboard;
