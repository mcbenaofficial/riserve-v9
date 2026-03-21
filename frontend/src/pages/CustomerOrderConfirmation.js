import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, ChefHat, Package, XCircle, ArrowLeft, RefreshCw, Loader2, Copy, Check } from 'lucide-react';
import axios from 'axios';
import { getImageUrl } from '../services/api';

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

  const outletInfo = orderData?.outlet_info || {};
  const scheme = outletInfo.portal_color_scheme || {};
  const useCustomConfig = !!outletInfo.portal_color_scheme;

  const primaryColor = useCustomConfig && scheme.primary ? scheme.primary : '#3b82f6';
  const bgColor = useCustomConfig && scheme.bgColor ? scheme.bgColor : '#0f0c29';
  const textColor = useCustomConfig && scheme.textColor ? scheme.textColor : '#ffffff';
  
  // Custom font loader
  useEffect(() => {
    if (useCustomConfig && scheme.fontFamily) {
      const formattedFontName = scheme.fontFamily.replace(/ /g, '+');
      const href = `https://fonts.googleapis.com/css2?family=${formattedFontName}:wght@300;400;500;600;700&display=swap`;
      if (!document.querySelector(`link[href="${href}"]`)) {
        const link = document.createElement('link');
        link.href = href;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
    }
  }, [useCustomConfig, scheme.fontFamily]);

  const customStyle = useCustomConfig ? {
    backgroundColor: bgColor,
    fontFamily: scheme.fontFamily ? `"${scheme.fontFamily}", sans-serif` : 'inherit',
    color: textColor,
  } : {};

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
  const outletName = outletInfo.name || orderData.outlet_name || 'Restaurant';

  const currentStepIndex = STATUS_STEPS.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'Cancelled';
  const isCompleted = order.status === 'Completed';

  const orderTypeLabel = order.order_type === 'dine_in' ? 'Dine In' : order.order_type === 'takeaway' ? 'Takeaway' : 'Delivery';

  return (
    <div className="min-h-screen flex flex-col" style={useCustomConfig ? customStyle : { background: 'linear-gradient(to bottom right, #0f0c29, #302b63, #24243e)' }}>
      {/* Header */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between gap-3 border-b" style={{ borderColor: useCustomConfig ? textColor + '1A' : 'transparent' }}>
        <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:opacity-70 transition-opacity" style={{ color: useCustomConfig ? textColor : '#9ca3af' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 text-center">
          {outletInfo.portal_logo_url ? (
            <img src={getImageUrl(outletInfo.portal_logo_url)} alt="Logo" className="h-8 object-contain mx-auto" />
          ) : (
             <h1 className="font-bold text-base" style={{ color: useCustomConfig ? textColor : 'white' }}>Order Status</h1>
          )}
        </div>
        <button onClick={fetchStatus} className="p-2 rounded-lg hover:opacity-70 transition-opacity" style={{ color: useCustomConfig ? textColor : '#9ca3af' }}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex-1 px-5 pb-8 space-y-6 max-w-md mx-auto w-full pt-4">
        {/* Success Header */}
        <div className="text-center pt-2 pb-2">
          {isCancelled ? (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3" style={{ backgroundColor: '#ef444420' }}>
              <XCircle size={32} color="#ef4444" />
            </div>
          ) : isCompleted ? (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3" style={{ backgroundColor: '#22c55e20' }}>
              <CheckCircle size={32} color="#22c55e" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 animate-pulse" style={{ backgroundColor: primaryColor + '30' }}>
              <Clock size={32} color={primaryColor} />
            </div>
          )}
          <h2 className="text-xl font-bold" style={{ color: useCustomConfig ? textColor : 'white' }}>
            {isCancelled ? 'Order Cancelled' : isCompleted ? 'Order Complete!' : 'Order Confirmed'}
          </h2>
        </div>

        {/* Order Number Card */}
        <div className="p-5 rounded-2xl border text-center" style={{ backgroundColor: useCustomConfig ? textColor + '05' : 'rgba(255,255,255,0.05)', borderColor: useCustomConfig ? textColor + '1A' : 'rgba(255,255,255,0.1)' }}>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: useCustomConfig ? textColor + '80' : '#6b7280' }}>Order Number</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-bold tracking-widest" style={{ color: useCustomConfig ? textColor : 'white' }}>{order.order_number}</span>
            <button onClick={handleCopyOrderNumber} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity" style={{ color: useCustomConfig ? textColor + '99' : '#9ca3af' }}>
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs" style={{ color: useCustomConfig ? textColor + '99' : '#9ca3af' }}>
            <span>{order.customer_name || 'Guest'}</span>
            <span>•</span>
            <span className="capitalize">{orderTypeLabel}</span>
          </div>
        </div>

        {/* Status Tracker */}
        {!isCancelled && (
          <div className="p-5 rounded-2xl border" style={{ backgroundColor: useCustomConfig ? textColor + '05' : 'rgba(255,255,255,0.05)', borderColor: useCustomConfig ? textColor + '1A' : 'rgba(255,255,255,0.1)' }}>
            <h3 className="font-semibold text-sm mb-5" style={{ color: useCustomConfig ? textColor : 'white' }}>Order Progress</h3>
            <div className="space-y-0">
              {STATUS_STEPS.map((step, index) => {
                const isActive = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const Icon = step.icon;
                const nodeColor = isActive ? primaryColor : (useCustomConfig ? textColor + '20' : 'rgba(255,255,255,0.1)');
                const iconColor = isActive ? bgColor : (useCustomConfig ? textColor + '80' : '#4b5563');

                return (
                  <div key={step.key} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 ${isCurrent ? 'scale-110 shadow-lg' : ''}`}
                           style={{ backgroundColor: nodeColor, boxShadow: isActive ? `0 4px 14px 0 ${primaryColor}40` : 'none' }}>
                        <Icon size={16} color={iconColor} />
                      </div>
                      {index < STATUS_STEPS.length - 1 && (
                        <div className={`w-0.5 h-8 my-1 transition-colors duration-500`} style={{ backgroundColor: isActive && index < currentStepIndex ? primaryColor : (useCustomConfig ? textColor + '20' : 'rgba(255,255,255,0.1)') }} />
                      )}
                    </div>
                    <div className="pt-1.5 pb-3">
                      <p className="text-sm font-semibold transition-colors" style={{ color: isActive ? (useCustomConfig ? textColor : 'white') : (useCustomConfig ? textColor + '80' : '#4b5563') }}>
                        {step.label}
                      </p>
                      {isCurrent && !isCompleted && (
                        <p className="text-xs mt-0.5 animate-pulse" style={{ color: primaryColor }}>In progress...</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order Summary */}
        <div className="p-5 rounded-2xl border" style={{ backgroundColor: useCustomConfig ? textColor + '05' : 'rgba(255,255,255,0.05)', borderColor: useCustomConfig ? textColor + '1A' : 'rgba(255,255,255,0.1)' }}>
          <h3 className="font-semibold text-sm mb-4" style={{ color: useCustomConfig ? textColor : 'white' }}>Order Summary</h3>
          <div className="space-y-2.5">
            {(order.items || []).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2" style={{ color: useCustomConfig ? textColor + 'E6' : '#d1d5db' }}>
                  <span className="font-mono text-xs" style={{ color: primaryColor }}>{item.quantity}×</span>
                  {item.name}
                </div>
                <span className="font-serif" style={{ color: useCustomConfig ? textColor + '99' : '#9ca3af' }}>₹{(item.price * item.quantity).toFixed(0)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: useCustomConfig ? textColor + '1A' : 'rgba(255,255,255,0.1)' }}>
            <span className="text-sm font-medium" style={{ color: useCustomConfig ? textColor + '99' : '#9ca3af' }}>Total</span>
            <span className="font-bold text-lg font-serif" style={{ color: primaryColor }}>₹{parseFloat(order.total_amount).toFixed(0)}</span>
          </div>
        </div>

        {/* Live Update Notice */}
        {!isCompleted && !isCancelled && (
          <div className="flex items-center justify-center gap-2 text-xs" style={{ color: useCustomConfig ? textColor + '80' : '#6b7280' }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }} />
            Live updates enabled
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-6 text-center mt-auto border-t" style={{ borderColor: useCustomConfig ? textColor + '1A' : 'rgba(255,255,255,0.05)' }}>
        <p className="text-xs" style={{ color: useCustomConfig ? textColor + '80' : '#4b5563' }}>
          Powered by <span className="font-semibold" style={{ color: useCustomConfig ? textColor + '99' : '#6b7280' }}>Ri'Serve</span>
        </p>
      </div>
    </div>
  );
};

export default CustomerOrderConfirmation;
