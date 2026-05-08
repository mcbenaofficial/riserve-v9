'use client';
import React, { useEffect, useState, useRef, use } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const STATUS_STEPS = ['New', 'Preparing', 'ReadyToCollect', 'Completed'];
const STATUS_LABELS: Record<string, string> = {
  New: 'Order Placed',
  Preparing: 'Being Prepared',
  ReadyToCollect: 'Ready for Pickup',
  Completed: 'Order Complete',
};
const STATUS_ICON_SVG: Record<string, React.ReactNode> = {
  New: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  Preparing: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  ReadyToCollect: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  Completed: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};
const STATUS_DESC: Record<string, string> = {
  New: "We've received your order and it's in the queue.",
  Preparing: 'The kitchen is crafting your order with care.',
  ReadyToCollect: 'Your order is ready. Show your PIN at the counter.',
  Completed: 'Thank you for dining with us. See you again soon.',
};

const CSS = (font: string) => `
  @import url('https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@300;400;500;600;700;900&display=swap');
  @keyframes slowspin  { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
  @keyframes breathe   { 0%,100% { opacity:.12; transform:scale(1) } 50% { opacity:.22; transform:scale(1.06) } }
  @keyframes breatheHi { 0%,100% { opacity:.20; transform:scale(1) } 50% { opacity:.35; transform:scale(1.08) } }
  @keyframes floatUp   { 0%,100% { transform:translateY(0)   } 50% { transform:translateY(-7px) } }
  @keyframes fadeSlide { from { opacity:0; transform:translateY(-10px) } to { opacity:1; transform:translateY(0) } }
  .status-spin  { animation: slowspin  4s linear infinite }
  .status-breathe    { animation: breathe   4s ease-in-out infinite }
  .status-breathe-hi { animation: breatheHi 3.5s ease-in-out infinite }
  .status-float { animation: floatUp   3.2s ease-in-out infinite }
  .anim-fade    { animation: fadeSlide .35s ease both }
`;

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
              newStatus === 'Preparing'      ? 'The kitchen has started your order!' :
              newStatus === 'Completed'      ? 'Order complete — thank you for dining with us!' :
              'Order status updated.';
            setStatusBanner(msg);
            setTimeout(() => setStatusBanner(null), 5500);
          }
          prevStatusRef.current = newStatus ?? null;
          setOrderData(data);
          setLastUpdated(new Date());
        }
      } catch { /* network errors silently ignored */ }
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
      <div className="min-h-dvh bg-[#0A0A0C] flex items-center justify-center">
        <div className="flex gap-2.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2.5 h-2.5 rounded-full bg-amber-400"
              style={{ animation: `breathe 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
        <style dangerouslySetInnerHTML={{ __html: CSS('Inter') }} />
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-dvh bg-[#0A0A0C] flex items-center justify-center p-8 text-center">
        <style dangerouslySetInnerHTML={{ __html: CSS('Inter') }} />
        <div className="space-y-4">
          <svg className="w-14 h-14 opacity-25 mx-auto" fill="none" stroke="white" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-xl font-bold text-white">Order Not Found</h1>
          <p className="text-sm text-white/40">This link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const order       = orderData.order;
  const outletInfo  = orderData.outlet_info || {};
  const cs          = outletInfo.portal_color_scheme || {};
  const primary     = cs.primary     || '#F59E0B';
  const bgColor     = cs.bgColor     || '#0A0A0C';
  const textColor   = cs.textColor   || '#FFFFFF';
  const fontFamily  = cs.fontFamily  || 'Inter';
  const logoUrl     = outletInfo.portal_logo_url;

  const items     = order.items || [];
  const status    = order.status;
  const stepIdx   = STATUS_STEPS.indexOf(status);
  const isReady   = status === 'ReadyToCollect';
  const isComplete = status === 'Completed';
  const pickup_pin = order.pickup_pin;

  const lum = bgColor.replace('#', '').match(/^[0-9a-f]{6}$/i)
    ? parseInt(bgColor.slice(1, 3), 16) * 0.299
    + parseInt(bgColor.slice(3, 5), 16) * 0.587
    + parseInt(bgColor.slice(5, 7), 16) * 0.114
    : 0;
  const isDark = lum < 128;

  // Glass surfaces — the core of the liquid glass language
  const glass = {
    background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.68)',
    backdropFilter: 'blur(32px) saturate(180%)',
    WebkitBackdropFilter: 'blur(32px) saturate(180%)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.72)'}`,
    boxShadow: isDark
      ? '0 8px 48px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.15)'
      : '0 8px 32px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.95)',
  } as React.CSSProperties;

  const glassDim = {
    ...glass,
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.50)',
    boxShadow: isDark
      ? '0 4px 24px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.10)'
      : '0 4px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.85)',
  } as React.CSSProperties;

  const dividerColor  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const mutedText     = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.42)';
  const subtleText    = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)';

  return (
    <div className="min-h-dvh relative" style={{ backgroundColor: bgColor, fontFamily: `${fontFamily}, system-ui, sans-serif`, color: textColor }}>
      <style dangerouslySetInnerHTML={{ __html: CSS(fontFamily) }} />

      {/* ── Atmospheric background: orbs + grain ─────────────────────── */}
      <div className="fixed inset-0 overflow-hidden" aria-hidden="true" style={{ zIndex: 0, backgroundColor: bgColor }}>
        {/* Primary orb — top right, breathes with status */}
        <div className={isReady ? 'status-breathe-hi' : 'status-breathe'}
          style={{
            position: 'absolute', top: '-20%', right: '-15%',
            width: '75vw', height: '75vw', borderRadius: '50%',
            background: primary, filter: 'blur(90px)',
          }} />
        {/* Secondary orb — bottom left */}
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-20%',
          width: '60vw', height: '60vw', borderRadius: '50%',
          background: primary, opacity: 0.07, filter: 'blur(80px)',
        }} />
        {/* Accent orb — centre, warm white */}
        <div style={{
          position: 'absolute', top: '35%', left: '30%',
          width: '40vw', height: '40vw', borderRadius: '50%',
          background: `rgba(255,255,255,0.06)`, filter: 'blur(60px)',
        }} />
        {/* Subtle orb — bottom right edge */}
        <div style={{
          position: 'absolute', bottom: '10%', right: '-10%',
          width: '30vw', height: '30vw', borderRadius: '50%',
          background: primary, opacity: 0.05, filter: 'blur(50px)',
        }} />
        {/* Film grain — baked into the blurred background so glass cards inherit it */}
        <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.045 }}>
          <filter id="grain-f">
            <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-f)" />
        </svg>
      </div>

      {/* ── Status change toast ──────────────────────────────────────── */}
      {statusBanner && (
        <div className="fixed top-4 left-4 right-4 anim-fade" style={{ zIndex: 60, maxWidth: '32rem', margin: '0 auto' }}>
          <div className="rounded-[20px] px-5 py-4 flex items-center gap-3"
            style={{
              background: `linear-gradient(135deg, ${primary}F2, ${primary}CC)`,
              boxShadow: `0 12px 40px ${primary}45, 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.25)`,
              backdropFilter: 'blur(24px)',
            }}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="white" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-white font-semibold text-sm flex-1 leading-snug">{statusBanner}</p>
            <button onClick={() => setStatusBanner(null)} aria-label="Dismiss"
              className="text-white/60 hover:text-white transition-colors text-xl leading-none shrink-0 font-light">×</button>
          </div>
        </div>
      )}

      {/* ── Page content ─────────────────────────────────────────────── */}
      <div className="relative max-w-lg mx-auto px-4 pt-10 pb-20 space-y-4" style={{ zIndex: 10 }}>

        {/* Header */}
        <header className="text-center pb-2">
          {logoUrl ? (
            <img
              src={logoUrl.startsWith('/') ? `${BACKEND_URL}${logoUrl}` : logoUrl}
              alt="Restaurant logo" className="h-11 mx-auto object-contain mb-5"
              style={{ filter: isDark ? 'brightness(1) drop-shadow(0 2px 12px rgba(0,0,0,0.5))' : 'none' }}
            />
          ) : (
            <div className="w-12 h-12 mb-4 mx-auto" style={{ color: primary, opacity: 0.7 }} aria-hidden="true">
              {STATUS_ICON_SVG[status] || STATUS_ICON_SVG['New']}
            </div>
          )}
          <h1 className="text-[28px] font-black tracking-tight leading-tight" style={{ color: textColor }}>
            {isComplete ? 'Order Complete' : isReady ? 'Ready for Pickup' : 'Your Order'}
          </h1>
          <p className="mt-1 text-sm" style={{ color: mutedText }}>
            {orderData.outlet_name}
            <span style={{ color: subtleText }}> · </span>
            Order #{order.order_number}
          </p>
          {lastUpdated && (
            <div className="inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded-full"
              style={{ ...glassDim, borderRadius: 999 }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium" style={{ color: mutedText }}>
                Live · {liveSeconds < 60 ? `${liveSeconds}s ago` : `${Math.floor(liveSeconds / 60)}m ago`}
              </span>
            </div>
          )}
        </header>

        {/* ── PIN Card ── */}
        {pickup_pin && (
          <div className="rounded-[28px] overflow-hidden relative"
            style={{
              background: isReady
                ? `linear-gradient(145deg, ${primary}E8, ${primary}B0)`
                : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.65)'),
              backdropFilter: 'blur(32px) saturate(180%)',
              WebkitBackdropFilter: 'blur(32px) saturate(180%)',
              border: `1px solid ${isReady ? `${primary}80` : (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.75)')}`,
              boxShadow: isReady
                ? `0 0 60px ${primary}40, 0 16px 48px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.30)`
                : (isDark
                    ? '0 8px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.14)'
                    : '0 8px 32px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.95)'),
              transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)',
            }}>
            {/* Glass sphere specular */}
            {isReady && (
              <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)' }} />
            )}
            <div className="px-6 py-7 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                  stroke={isReady ? 'rgba(255,255,255,0.8)' : primary} strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-[0.15em]"
                  style={{ color: isReady ? 'rgba(255,255,255,0.75)' : primary }}>Pickup PIN</span>
              </div>
              <p className="text-xs mb-4 mt-1" style={{ color: isReady ? 'rgba(255,255,255,0.55)' : mutedText }}>
                Show this code at the counter to collect your order
              </p>
              {pinRevealed ? (
                <div className="flex items-center justify-center gap-2">
                  {pickup_pin.split('').map((digit: string, i: number) => (
                    <div key={i}
                      className="w-14 h-[60px] rounded-2xl flex items-center justify-center text-3xl font-black"
                      style={{
                        background: isReady ? 'rgba(255,255,255,0.22)' : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)'),
                        color: isReady ? 'white' : primary,
                        border: isReady ? '1px solid rgba(255,255,255,0.28)' : `1px solid ${primary}35`,
                        backdropFilter: 'blur(12px)',
                        boxShadow: isReady ? 'inset 0 1px 0 rgba(255,255,255,0.3)' : 'none',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                      {digit}
                    </div>
                  ))}
                </div>
              ) : (
                <button onClick={() => setPinRevealed(true)}
                  className="px-8 py-3 rounded-2xl text-sm font-bold transition-all active:scale-95"
                  style={{
                    background: isReady ? 'rgba(255,255,255,0.20)' : `${primary}18`,
                    color: isReady ? 'white' : primary,
                    border: isReady ? '1px solid rgba(255,255,255,0.28)' : `1px solid ${primary}30`,
                    backdropFilter: 'blur(12px)',
                    boxShadow: isReady ? 'inset 0 1px 0 rgba(255,255,255,0.25)' : 'none',
                  }}>
                  <svg className="w-3.5 h-3.5 inline mr-1.5 -mt-px" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Reveal PIN
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Status Hero + Timeline ── */}
        <div className="rounded-[28px] overflow-hidden" style={glass}>
          {/* Specular top highlight */}
          <div className="absolute top-0 left-6 right-6 h-px pointer-events-none"
            style={{ background: isDark ? 'linear-gradient(90deg,transparent,rgba(255,255,255,0.20),transparent)' : 'linear-gradient(90deg,transparent,rgba(255,255,255,0.95),transparent)' }} />

          <div className="px-6 pt-9 pb-7 flex flex-col items-center text-center gap-5">
            {/* Glass sphere icon */}
            <div className={`relative flex items-center justify-center${isReady ? ' status-float' : ''}`}>
              {/* Outer breathing ring */}
              {!isComplete && (
                <div className={isReady ? 'status-breathe-hi' : 'status-breathe'}
                  style={{
                    position: 'absolute',
                    width: '7.5rem', height: '7.5rem', borderRadius: '50%',
                    background: primary,
                  }} />
              )}
              {/* Glass sphere */}
              <div className="relative flex items-center justify-center"
                style={{
                  width: '5.5rem', height: '5.5rem', borderRadius: '50%',
                  background: isReady
                    ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.38) 0%, transparent 55%), linear-gradient(145deg, ${primary}F0, ${primary}A8)`
                    : (isDark
                        ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.18) 0%, transparent 55%), linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))`
                        : `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.85) 0%, transparent 55%), linear-gradient(145deg, rgba(255,255,255,0.75), rgba(255,255,255,0.45))`),
                  border: `1px solid ${isReady ? `${primary}70` : (isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.80)')}`,
                  boxShadow: isReady
                    ? `0 0 48px ${primary}50, 0 12px 32px rgba(0,0,0,0.28), inset 0 2px 4px rgba(255,255,255,0.35)`
                    : (isDark
                        ? '0 8px 32px rgba(0,0,0,0.28), inset 0 2px 4px rgba(255,255,255,0.18)'
                        : '0 8px 24px rgba(0,0,0,0.08), inset 0 2px 4px rgba(255,255,255,0.95)'),
                  transition: 'all 0.9s cubic-bezier(0.4,0,0.2,1)',
                }}>
                <div className={`w-8 h-8${status === 'Preparing' ? ' status-spin' : ''}`}
                  style={{ color: isReady ? 'white' : (isDark ? `${primary}` : primary) }}>
                  {STATUS_ICON_SVG[status] || STATUS_ICON_SVG['New']}
                </div>
              </div>
            </div>

            {/* Status text */}
            <div className="space-y-1.5">
              <p className="text-2xl font-black tracking-tight" style={{ color: textColor }}>
                {STATUS_LABELS[status] || status}
              </p>
              <p className="text-sm leading-relaxed max-w-[240px] mx-auto" style={{ color: mutedText }}>
                {STATUS_DESC[status] || ''}
              </p>
            </div>

            {/* Segmented progress bar */}
            <div className="w-full space-y-2">
              <div className="flex gap-1.5">
                {STATUS_STEPS.map((_, i) => (
                  <div key={i} className="flex-1 h-[3px] rounded-full overflow-hidden"
                    style={{ background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }}>
                    <div className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: i <= stepIdx ? '100%' : '0%',
                        background: i <= stepIdx
                          ? (isReady ? `linear-gradient(90deg, ${primary}CC, ${primary})` : primary)
                          : 'transparent',
                        boxShadow: i <= stepIdx && isReady ? `0 0 8px ${primary}80` : 'none',
                      }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] font-semibold" style={{ color: stepIdx === 0 ? primary : subtleText }}>
                  Placed
                </span>
                <span className="text-[10px] font-semibold" style={{ color: isComplete ? primary : subtleText }}>
                  Complete
                </span>
              </div>
            </div>
          </div>

          {/* Timeline toggle */}
          <button onClick={() => setTimelineOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 transition-opacity hover:opacity-70 active:opacity-50"
            style={{ borderTop: `1px solid ${dividerColor}`, color: mutedText }}>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em]">Order Timeline</span>
            <svg className={`w-3.5 h-3.5 transition-transform duration-200${timelineOpen ? ' rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Vertical timeline */}
          {timelineOpen && (
            <div className="px-6 pb-6 pt-1">
              <div className="relative">
                {/* Rail */}
                <div className="absolute left-[10px] top-3 bottom-3 w-px"
                  style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />
                {/* Progress fill */}
                <div className="absolute left-[10px] top-3 w-px transition-all duration-700"
                  style={{
                    height: stepIdx === 0 ? '0%' : `${(stepIdx / (STATUS_STEPS.length - 1)) * 100}%`,
                    background: primary,
                  }} />
                <div>
                  {STATUS_STEPS.map((step, i) => {
                    const done     = i < stepIdx;
                    const current  = i === stepIdx;
                    const upcoming = i > stepIdx;
                    return (
                      <div key={step} className="flex items-start gap-4 relative"
                        style={{ paddingBottom: i < STATUS_STEPS.length - 1 ? '18px' : 0 }}>
                        {/* Dot */}
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 mt-0.5"
                          style={{
                            background: done || current
                              ? primary
                              : (isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)'),
                            boxShadow: current ? `0 0 0 3px ${isDark ? bgColor : '#fff'}, 0 0 0 5px ${primary}50` : 'none',
                            transition: 'all 0.4s ease',
                          }}>
                          {done && (
                            <svg className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth={3} viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {current && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        {/* Text */}
                        <div className="pt-px">
                          <p className="text-sm font-semibold" style={{ color: upcoming ? subtleText : textColor }}>
                            {STATUS_LABELS[step]}
                          </p>
                          {current && (
                            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: mutedText }}>
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
        <div className="rounded-[24px] overflow-hidden" style={glass}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${dividerColor}` }}>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: mutedText }}>
              Your Order
            </h2>
          </div>
          <div>
            {items.map((item: any, i: number) => (
              <div key={i} className="px-5 py-3.5 flex items-center justify-between"
                style={{
                  borderBottom: i < items.length - 1 ? `1px solid ${dividerColor}` : 'none',
                }}>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-lg"
                    style={{ background: `${primary}18`, color: primary }}>
                    {item.quantity}×
                  </span>
                  <span className="text-sm font-medium" style={{ color: textColor }}>{item.name}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: textColor, fontVariantNumeric: 'tabular-nums' }}>
                  ₹{(item.price * item.quantity).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 flex justify-between items-center"
            style={{ borderTop: `1px solid ${dividerColor}` }}>
            <span className="font-bold text-sm" style={{ color: mutedText }}>Total</span>
            <span className="font-black text-lg" style={{ color: primary, fontVariantNumeric: 'tabular-nums' }}>
              ₹{order.total_amount?.toFixed(0)}
            </span>
          </div>
        </div>

        {/* ── Customer info ── */}
        {(() => {
          const notesRaw    = order.notes || '';
          const tableMatch  = notesRaw.match(/^Table:\s*(.+?)(\n|$)/);
          const tableNum    = tableMatch ? tableMatch[1].trim() : null;
          const kitchenNote = tableMatch ? notesRaw.slice(tableMatch[0].length).trim() : notesRaw.trim();
          const infoRows    = [
            { label: 'Customer',   value: order.customer_name },
            { label: 'Phone',      value: order.contact_number || '—' },
            { label: 'Order Type', value: (order.order_type || '').replace('_', ' ') },
            ...(tableNum ? [{ label: 'Table', value: tableNum }] : []),
            { label: 'Payment',    value: order.payment_status, highlight: order.payment_status === 'paid' },
          ];
          return (
            <>
              <div className="rounded-[24px] p-5 grid grid-cols-2 gap-5" style={glassDim}>
                {infoRows.map(({ label, value, highlight }) => (
                  <div key={label}>
                    <span className="text-[11px] font-medium block mb-0.5" style={{ color: subtleText }}>{label}</span>
                    <p className="font-semibold text-sm capitalize"
                      style={{ color: (highlight as boolean | undefined) ? '#34d399' : textColor }}>{value}</p>
                  </div>
                ))}
              </div>
              {kitchenNote && (
                <div className="rounded-[24px] p-5" style={glassDim}>
                  <span className="text-[11px] font-medium block mb-1.5" style={{ color: subtleText }}>Kitchen Note</span>
                  <p className="text-sm leading-relaxed" style={{ color: textColor, opacity: 0.7 }}>{kitchenNote}</p>
                </div>
              )}
            </>
          );
        })()}

        {/* ── CTA ── */}
        <div className="flex flex-col items-center gap-3 pt-1 pb-2">
          {isComplete && (
            <a href={`/menu/${order.outlet_id}`}
              className="w-full py-4 rounded-2xl font-black text-base text-center block transition-all active:scale-[0.97]"
              style={{
                background: `linear-gradient(135deg, ${primary}F0, ${primary}C0)`,
                color: 'white',
                boxShadow: `0 12px 36px ${primary}40, 0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.25)`,
              }}>
              Order Again
            </a>
          )}
          <a href={`/menu/${order.outlet_id}`}
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: mutedText }}>
            ← Back to Menu
          </a>
        </div>

        <p className="text-center text-[11px] pb-2" style={{ color: subtleText }}>
          Powered by <span className="font-semibold" style={{ color: mutedText }}>Ri'Serve</span>
          <span style={{ opacity: 0.4 }}> · </span>
          {new Date(order.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
