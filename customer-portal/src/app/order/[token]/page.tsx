'use client';
import React, { useEffect, useState, useRef, use } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const STATUS_STEPS = ['New', 'Preparing', 'ReadyToCollect', 'Completed'];
const STATUS_LABELS: Record<string, string> = {
  New: 'Order Placed',
  Preparing: 'Being Prepared',
  ReadyToCollect: 'Ready to Collect!',
  Completed: 'Completed',
};
const STATUS_ICON_SVG: Record<string, React.ReactNode> = {
  New: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  Preparing: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  ReadyToCollect: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  Completed: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};
const STATUS_DESC: Record<string, string> = {
  New: 'We\'ve received your order and it\'s in the queue.',
  Preparing: 'Our kitchen is working on your delicious order!',
  ReadyToCollect: 'Your order is ready! Show your PIN at the counter.',
  Completed: 'Thanks for dining with us. See you again!',
};

export default function OrderTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pinRevealed, setPinRevealed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/public/order/${token}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const newStatus = data.order?.status;
          if (prevStatusRef.current !== null && newStatus !== prevStatusRef.current) {
            const msg =
              newStatus === 'ReadyToCollect' ? 'Your order is ready for pickup!' :
              newStatus === 'Preparing' ? 'Kitchen has started your order!' :
              newStatus === 'Completed' ? 'Order complete — thanks for dining with us!' :
              'Order status updated!';
            setStatusBanner(msg);
            setTimeout(() => setStatusBanner(null), 5000);
          }
          prevStatusRef.current = newStatus ?? null;
          setOrderData(data);
          setLastUpdated(new Date());
        }
      } catch { }
      setLoading(false);
    };
    fetchOrder();
    const interval = setInterval(fetchOrder, 10000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!lastUpdated) return;
    setLiveSeconds(0);
    const t = setInterval(() => setLiveSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [lastUpdated]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#0C0C0E] flex items-center justify-center">
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-3 h-3 rounded-full bg-amber-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-dvh bg-[#0C0C0E] flex items-center justify-center p-8 text-center">
        <div className="space-y-4">
          <svg className="w-16 h-16 opacity-30 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <h1 className="text-2xl font-bold text-white">Order Not Found</h1>
          <p className="text-gray-400">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const order = orderData.order;
  const outletInfo = orderData.outlet_info || {};
  const cs = outletInfo.portal_color_scheme || {};
  const primary = cs.primary || '#F59E0B';
  const bgColor = cs.bgColor || '#0C0C0E';
  const surfaceColor = cs.surfaceColor || '#1A1A1A';
  const textColor = cs.textColor || '#FFFFFF';
  const fontFamily = cs.fontFamily || 'Inter';
  const logoUrl = outletInfo.portal_logo_url;

  const items = order.items || [];
  const status = order.status;
  const stepIdx = STATUS_STEPS.indexOf(status);
  const isReady = status === 'ReadyToCollect';
  const isComplete = status === 'Completed';
  const pickup_pin = order.pickup_pin;

  // Detect if the bg is dark for contrast
  const isDark = bgColor.replace('#', '').match(/^[0-9a-f]{6}$/i)
    ? parseInt(bgColor.slice(1, 3), 16) * 0.299 + parseInt(bgColor.slice(3, 5), 16) * 0.587 + parseInt(bgColor.slice(5, 7), 16) * 0.114 < 128
    : true;

  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const mutedText = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';

  return (
    <div className="min-h-dvh" style={{ backgroundColor: bgColor, fontFamily: `${fontFamily}, system-ui, sans-serif` }}>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700;900&display=swap');@keyframes slowspin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}.status-spin{animation:slowspin 4s linear infinite}` }} />

      {/* Ambient glow */}
      <div className="fixed inset-0 -z-10 overflow-hidden" style={{ backgroundColor: bgColor }}>
        <div className="absolute -top-1/4 -right-1/4 w-[70vw] h-[70vw] rounded-full pointer-events-none"
          style={{ background: primary, opacity: isReady ? 0.25 : 0.12, filter: 'blur(100px)', transition: 'opacity 1s ease' }} />
        <div className="absolute bottom-0 left-0 w-[50vw] h-[50vw] rounded-full pointer-events-none"
          style={{ background: primary, opacity: 0.07, filter: 'blur(80px)' }} />
      </div>

      {/* Status change banner */}
      {statusBanner && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-lg mx-auto">
          <div className="rounded-2xl px-5 py-4 flex items-center gap-3 shadow-2xl"
            style={{
              background: isReady || status === 'Completed'
                ? `linear-gradient(135deg, ${primary}F0, ${primary}C0)`
                : `linear-gradient(135deg, ${primary}DD, ${primary}AA)`,
              boxShadow: `0 8px 32px ${primary}50`,
            }}>
            <svg className="w-5 h-5 text-white shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-white font-bold text-sm flex-1">{statusBanner}</p>
            <button onClick={() => setStatusBanner(null)} className="text-white/70 hover:text-white font-bold text-lg leading-none shrink-0">×</button>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-8 pb-16 space-y-5">
        {/* Header */}
        <div className="text-center pt-4 pb-2">
          {logoUrl ? (
            <img src={logoUrl.startsWith('/') ? `${BACKEND_URL}${logoUrl}` : logoUrl}
              alt="Logo" className="h-12 mx-auto object-contain mb-4 drop-shadow-lg" />
          ) : (
            <div className="w-14 h-14 mb-4 mx-auto opacity-70" style={{ color: primary }}>{STATUS_ICON_SVG[status] || STATUS_ICON_SVG['New']}</div>
          )}
          <h1 className="text-3xl font-black tracking-tight" style={{ color: textColor }}>
            {isComplete ? 'Order Complete!' : isReady ? 'Ready for Pickup!' : 'Order Tracking'}
          </h1>
          <p className="mt-1.5 text-sm font-medium" style={{ color: mutedText }}>
            {orderData.outlet_name} · Order #{order.order_number}
          </p>
          {lastUpdated && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[11px] font-medium" style={{ color: mutedText }}>
                Live · {liveSeconds < 60 ? `${liveSeconds}s ago` : `${Math.floor(liveSeconds / 60)}m ago`}
              </span>
            </div>
          )}
        </div>

        {/* ── PIN Card ── */}
        {pickup_pin && (
          <div className="rounded-3xl overflow-hidden relative"
            style={{
              background: isReady
                ? `linear-gradient(135deg, ${primary}F0, ${primary}C0)`
                : `linear-gradient(135deg, ${primary}30, ${primary}18)`,
              border: `2px solid ${isReady ? primary : `${primary}40`}`,
              boxShadow: isReady ? `0 0 40px ${primary}50, 0 8px 32px rgba(0,0,0,0.3)` : '0 4px 20px rgba(0,0,0,0.2)',
              transition: 'all 0.8s ease',
            }}>
            <div className="px-6 py-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <svg className="w-4 h-4" fill="none" stroke={isReady ? 'white' : primary} strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: isReady ? 'rgba(255,255,255,0.8)' : primary }}>
                  Pickup PIN
                </span>
              </div>
              <p className="text-xs mb-3" style={{ color: isReady ? 'rgba(255,255,255,0.65)' : mutedText }}>
                Share this with the counter to collect your order
              </p>

              {pinRevealed ? (
                <div className="flex items-center justify-center gap-2">
                  {pickup_pin.split('').map((digit: string, i: number) => (
                    <div key={i} className="w-14 h-16 rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg"
                      style={{
                        background: isReady ? 'rgba(255,255,255,0.25)' : cardBg,
                        color: isReady ? 'white' : primary,
                        border: isReady ? '1px solid rgba(255,255,255,0.3)' : `1px solid ${primary}40`,
                        backdropFilter: 'blur(8px)',
                      }}>
                      {digit}
                    </div>
                  ))}
                </div>
              ) : (
                <button onClick={() => setPinRevealed(true)}
                  className="mt-1 px-8 py-3.5 rounded-2xl font-black text-sm transition-all active:scale-95 hover:brightness-110"
                  style={{
                    background: isReady ? 'rgba(255,255,255,0.22)' : `${primary}20`,
                    color: isReady ? 'white' : primary,
                    border: isReady ? '1px solid rgba(255,255,255,0.3)' : `1px solid ${primary}30`,
                    backdropFilter: 'blur(8px)',
                  }}>
                  <svg className="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  Reveal PIN
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Status Hero + Timeline ── */}
        <div className="rounded-3xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          {/* Hero */}
          <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center gap-4">
            {/* Animated icon */}
            <div className="relative flex items-center justify-center">
              {!isComplete && (
                <div className="absolute w-28 h-28 rounded-full animate-pulse"
                  style={{ backgroundColor: primary, opacity: isReady ? 0.20 : 0.08 }} />
              )}
              <div className="w-20 h-20 rounded-full flex items-center justify-center z-10 relative"
                style={{
                  background: isReady
                    ? `linear-gradient(135deg, ${primary}F0, ${primary}C0)`
                    : `linear-gradient(135deg, ${primary}28, ${primary}14)`,
                  border: `2px solid ${isReady ? primary + 'C0' : primary + '40'}`,
                  boxShadow: isReady ? `0 0 40px ${primary}55, 0 8px 24px rgba(0,0,0,0.3)` : 'none',
                  transition: 'all 0.8s ease',
                }}>
                <div className={`w-9 h-9${status === 'Preparing' ? ' status-spin' : ''}`}
                  style={{ color: isReady ? 'white' : primary }}>
                  {STATUS_ICON_SVG[status] || STATUS_ICON_SVG['New']}
                </div>
              </div>
            </div>
            {/* Label + description */}
            <div>
              <p className="font-black text-2xl tracking-tight" style={{ color: textColor }}>
                {STATUS_LABELS[status] || status}
              </p>
              <p className="text-sm mt-1.5 leading-relaxed max-w-[260px] mx-auto" style={{ color: mutedText }}>
                {STATUS_DESC[status] || ''}
              </p>
            </div>
            {/* Segmented progress bar */}
            <div className="w-full space-y-2 pt-1">
              <div className="flex gap-1.5">
                {STATUS_STEPS.map((_, i) => (
                  <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: `${textColor}15` }}>
                    <div className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: i <= stepIdx ? '100%' : '0%', backgroundColor: primary }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] font-semibold"
                  style={{ color: stepIdx === 0 ? primary : mutedText }}>Order Placed</span>
                <span className="text-[10px] font-semibold"
                  style={{ color: stepIdx === STATUS_STEPS.length - 1 ? primary : mutedText }}>Completed</span>
              </div>
            </div>
          </div>

          {/* Timeline toggle */}
          <button onClick={() => setTimelineOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-80"
            style={{ borderTop: `1px solid ${cardBorder}`, color: mutedText }}>
            <span>Order Timeline</span>
            <svg className={`w-4 h-4 transition-transform duration-200${timelineOpen ? ' rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Vertical timeline */}
          {timelineOpen && (
            <div className="px-5 pb-5 pt-2">
              <div className="relative">
                <div className="absolute left-[11px] top-3 bottom-3 w-0.5 rounded-full"
                  style={{ backgroundColor: `${textColor}10` }} />
                <div className="absolute left-[11px] top-3 w-0.5 rounded-full transition-all duration-700"
                  style={{
                    height: stepIdx === 0 ? '0%' : `${(stepIdx / (STATUS_STEPS.length - 1)) * 100}%`,
                    backgroundColor: primary,
                  }} />
                <div className="space-y-0">
                  {STATUS_STEPS.map((step, i) => {
                    const done = i < stepIdx;
                    const current = i === stepIdx;
                    const upcoming = i > stepIdx;
                    return (
                      <div key={step} className="flex items-start gap-4 relative"
                        style={{ paddingBottom: i < STATUS_STEPS.length - 1 ? '20px' : '0' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 mt-0.5"
                          style={{
                            backgroundColor: done || current ? primary : `${textColor}12`,
                            boxShadow: current ? `0 0 0 3px ${primary}30` : 'none',
                            transition: 'all 0.4s ease',
                          }}>
                          {done && (
                            <svg className="w-3 h-3" fill="none" stroke="white" strokeWidth={3} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {current && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <div className="pt-0.5">
                          <p className="text-sm font-bold"
                            style={{ color: upcoming ? mutedText : textColor }}>
                            {STATUS_LABELS[step]}
                          </p>
                          {current && (
                            <p className="text-xs mt-0.5" style={{ color: mutedText }}>
                              {STATUS_DESC[step]}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Order items ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${cardBorder}` }}>
            <h3 className="font-bold text-xs uppercase tracking-wider" style={{ color: mutedText }}>Your Order</h3>
          </div>
          <div className="divide-y" style={{ borderColor: cardBorder }}>
            {items.map((item: any, i: number) => (
              <div key={i} className="px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black px-2 py-1 rounded-lg" style={{ backgroundColor: `${primary}18`, color: primary }}>
                    {item.quantity}×
                  </span>
                  <span className="text-sm font-medium" style={{ color: textColor }}>{item.name}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: textColor }}>₹{(item.price * item.quantity).toFixed(0)}</span>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 flex justify-between font-black text-base"
            style={{ borderTop: `1px solid ${cardBorder}`, color: textColor }}>
            <span>Total</span>
            <span style={{ color: primary }}>₹{order.total_amount?.toFixed(0)}</span>
          </div>
        </div>

        {/* ── Customer info ── */}
        {(() => {
          const notesRaw = order.notes || '';
          const tableMatch = notesRaw.match(/^Table:\s*(.+?)(\n|$)/);
          const tableNum = tableMatch ? tableMatch[1].trim() : null;
          const kitchenNote = tableMatch ? notesRaw.slice(tableMatch[0].length).trim() : notesRaw.trim();
          const infoRows = [
            { label: 'Customer', value: order.customer_name },
            { label: 'Phone', value: order.contact_number || '—' },
            { label: 'Order Type', value: (order.order_type || '').replace('_', ' ') },
            ...(tableNum ? [{ label: 'Table', value: tableNum }] : []),
            { label: 'Payment', value: order.payment_status, highlight: order.payment_status === 'paid' },
          ];
          return (
            <>
              <div className="rounded-2xl p-5 grid grid-cols-2 gap-4" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                {infoRows.map(({ label, value, highlight }) => (
                  <div key={label}>
                    <span className="text-xs font-medium" style={{ color: mutedText }}>{label}</span>
                    <p className="font-bold text-sm mt-0.5 capitalize" style={{ color: (highlight as boolean | undefined) ? '#22c55e' : textColor }}>{value}</p>
                  </div>
                ))}
              </div>
              {kitchenNote && (
                <div className="rounded-2xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  <span className="text-xs font-medium block mb-1" style={{ color: mutedText }}>Kitchen Note</span>
                  <p className="text-sm italic leading-relaxed" style={{ color: textColor, opacity: 0.75 }}>{kitchenNote}</p>
                </div>
              )}
            </>
          );
        })()}

        {/* ── Back to menu / reorder ── */}
        <div className="flex flex-col items-center gap-3 pb-4">
          {isComplete && outletInfo?.id && (
            <a href={`/menu/${order.outlet_id}`}
              className="w-full py-4 rounded-2xl text-white font-black text-base text-center block transition-all active:scale-[0.98]"
              style={{ backgroundColor: primary, boxShadow: `0 8px 28px ${primary}40` }}>
              Order Again
            </a>
          )}
          <a href={`/menu/${order.outlet_id}`}
            className="text-sm font-medium"
            style={{ color: mutedText }}>
            ← Back to Menu
          </a>
        </div>

        <p className="text-center text-xs pb-4" style={{ color: mutedText }}>
          Powered by <span className="font-bold">Ri'Serve</span> · {new Date(order.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
