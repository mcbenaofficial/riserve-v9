import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, ChefHat, Package, XCircle, ArrowLeft, RefreshCw, Loader2, Copy, Check } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_STEPS = [
  { key: 'New', label: 'Order Placed', icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-500' },
  { key: 'Preparing', label: 'Preparing', icon: ChefHat, color: 'text-amber-400', bg: 'bg-amber-500' },
  { key: 'ReadyToCollect', label: 'Ready to Collect', icon: Package, color: 'text-emerald-400', bg: 'bg-emerald-500' },
  { key: 'Completed', label: 'Completed', icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500' },
];

const CustomerOrderConfirmation = () => {
  const { confirmationToken } = useParams();
  const navigate = useNavigate();
  const [orderData, setOrderData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/public/order/${confirmationToken}`);
      setOrderData(res.data);
      setError(null);
    } catch (err) {
      setError('Order not found');
    } finally {
      setLoading(false);
    }
  }, [confirmationToken]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-poll every 5 seconds for live updates
  useEffect(() => {
    if (!orderData) return;
    const order = orderData.order;
    if (order.status === 'Completed' || order.status === 'Cancelled') return;

    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [orderData, fetchStatus]);

  const handleCopyOrderNumber = () => {
    if (orderData?.order?.order_number) {
      navigator.clipboard.writeText(orderData.order.order_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0c29] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-amber-400" />
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="min-h-screen bg-[#0f0c29] flex flex-col items-center justify-center px-6 text-center">
        <XCircle size={48} className="text-red-400 mb-4" />
        <h2 className="text-white text-xl font-bold mb-2">Order Not Found</h2>
        <p className="text-gray-500 text-sm mb-6">The order link may have expired or is invalid.</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition"
        >
          Go Home
        </button>
      </div>
    );
  }

  const order = orderData.order;
  const outletName = orderData.outlet_name;
  const currentStepIndex = STATUS_STEPS.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'Cancelled';
  const isCompleted = order.status === 'Completed';

  const orderTypeLabel = order.order_type === 'dine_in' ? 'Dine In' : order.order_type === 'takeaway' ? 'Takeaway' : 'Delivery';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-white/5 text-gray-400">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-bold text-base">Order Status</h1>
          <p className="text-amber-400/70 text-xs">{outletName}</p>
        </div>
        <button onClick={fetchStatus} className="p-2 rounded-lg hover:bg-white/5 text-gray-400">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex-1 px-5 pb-8 space-y-6 max-w-md mx-auto w-full">
        {/* Success Header */}
        <div className="text-center pt-4 pb-2">
          {isCancelled ? (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 mb-3">
              <XCircle size={32} className="text-red-400" />
            </div>
          ) : isCompleted ? (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-3">
              <CheckCircle size={32} className="text-green-400" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/20 mb-3 animate-pulse">
              <Clock size={32} className="text-amber-400" />
            </div>
          )}
          <h2 className="text-white text-xl font-bold">
            {isCancelled ? 'Order Cancelled' : isCompleted ? 'Order Complete!' : 'Order Confirmed'}
          </h2>
        </div>

        {/* Order Number Card */}
        <div className="p-5 rounded-2xl bg-white/[0.05] border border-white/10 text-center">
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Order Number</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold text-white tracking-widest">{order.order_number}</span>
            <button onClick={handleCopyOrderNumber} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 transition">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-400">
            <span>{order.customer_name}</span>
            <span>•</span>
            <span className="capitalize">{orderTypeLabel}</span>
          </div>
        </div>

        {/* Status Tracker */}
        {!isCancelled && (
          <div className="p-5 rounded-2xl bg-white/[0.05] border border-white/10">
            <h3 className="text-white font-semibold text-sm mb-5">Order Progress</h3>
            <div className="space-y-0">
              {STATUS_STEPS.map((step, index) => {
                const isActive = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const Icon = step.icon;
                return (
                  <div key={step.key} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 ${
                        isActive ? `${step.bg} shadow-lg shadow-${step.bg}/30` : 'bg-white/10'
                      } ${isCurrent ? 'ring-4 ring-white/10 scale-110' : ''}`}>
                        <Icon size={16} className={isActive ? 'text-white' : 'text-gray-600'} />
                      </div>
                      {index < STATUS_STEPS.length - 1 && (
                        <div className={`w-0.5 h-8 my-1 transition-colors duration-500 ${
                          isActive && index < currentStepIndex ? step.bg : 'bg-white/10'
                        }`} />
                      )}
                    </div>
                    <div className="pt-1.5 pb-3">
                      <p className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-gray-600'}`}>
                        {step.label}
                      </p>
                      {isCurrent && !isCompleted && (
                        <p className="text-xs text-amber-400/70 mt-0.5 animate-pulse">In progress...</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order Summary */}
        <div className="p-5 rounded-2xl bg-white/[0.05] border border-white/10">
          <h3 className="text-white font-semibold text-sm mb-4">Order Summary</h3>
          <div className="space-y-2.5">
            {(order.items || []).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <span className="text-amber-400/80 font-mono text-xs">{item.quantity}×</span>
                  {item.name}
                </div>
                <span className="text-gray-400">₹{(item.price * item.quantity).toFixed(0)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-gray-400 text-sm font-medium">Total</span>
            <span className="text-amber-400 font-bold text-lg">₹{parseFloat(order.total_amount).toFixed(0)}</span>
          </div>
        </div>

        {/* Live Update Notice */}
        {!isCompleted && !isCancelled && (
          <div className="flex items-center justify-center gap-2 text-gray-500 text-xs">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live updates enabled
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 text-center">
        <p className="text-gray-600 text-xs">
          Powered by <span className="text-gray-500 font-semibold">Ri'Serve</span>
        </p>
      </div>
    </div>
  );
};

export default CustomerOrderConfirmation;
