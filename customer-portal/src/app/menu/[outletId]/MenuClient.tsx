'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  image_urls: string[];
  icon: string | null;
  available: boolean;
  is_veg: boolean;
  is_bestseller?: boolean;
  tags?: string[];
  order_count?: number;
  nutritional_value?: string | null;
}
interface CategoryInfo { name: string; icon: string | null; display_order: number; }
interface CartItem extends MenuItem { quantity: number; specialInstructions?: string; }
interface Identity { name: string; phone: string; whatsappOptIn: boolean; }
interface AISuggestion { item_name: string; reason: string; }

type Tab = 'menu' | 'ai' | 'cart';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

function useIsMobile() {
  const [mobile, setMobile] = useState(true); // SSR-safe default
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

const MOOD_CHIPS = [
  { label: 'Comfort Food' },
  { label: 'Light Bites' },
  { label: 'Something Spicy' },
  { label: 'Sweet Treats' },
  { label: 'Healthy' },
  { label: 'Quick & Easy' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolveImg(item: MenuItem, catIcon?: string | null): string | null {
  const src = item.image_urls?.[0] || item.image_url || item.icon || catIcon || null;
  if (!src) return null;
  if (src.startsWith('http')) return src;
  if (src.startsWith('/')) return `${BACKEND_URL}${src}`;
  return null;
}

function resolveEmoji(item: MenuItem, catIcon?: string | null): string | null {
  const candidates = [item.icon, catIcon];
  for (const c of candidates) {
    if (c && !c.startsWith('/') && !c.startsWith('http')) return c;
  }
  return null;
}

const glass = (color: string, opacity = 'CC', blur = '16px'): React.CSSProperties => ({
  backgroundColor: `${color}${opacity}`,
  backdropFilter: `blur(${blur}) saturate(180%)`,
  WebkitBackdropFilter: `blur(${blur}) saturate(180%)`,
});

function isOpenNow(openingHours?: string | null): boolean | null {
  if (!openingHours) return null;
  // Basic check: try to parse "8 AM – 10 PM" style
  const match = openingHours.match(/(\d+)\s*(AM|PM)\s*[–\-]\s*(\d+)\s*(AM|PM)/i);
  if (!match) return null;
  let open = parseInt(match[1]);
  const openMer = match[2].toUpperCase();
  let close = parseInt(match[3]);
  const closeMer = match[4].toUpperCase();
  if (openMer === 'PM' && open !== 12) open += 12;
  if (openMer === 'AM' && open === 12) open = 0;
  if (closeMer === 'PM' && close !== 12) close += 12;
  if (closeMer === 'AM' && close === 12) close = 0;
  const now = new Date().getHours();
  return now >= open && now < close;
}

// ─── Veg Badge ────────────────────────────────────────────────────────────────
const VegBadge = ({ isVeg, size = 'md' }: { isVeg: boolean; size?: 'sm' | 'md' }) => {
  const s = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const d = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  return (
    <div className={`${s} border-2 rounded-sm flex items-center justify-center shrink-0 ${isVeg ? 'border-green-500' : 'border-red-500'}`}
      style={{ background: 'rgba(255,255,255,0.9)' }}>
      <div className={`${d} rounded-full ${isVeg ? 'bg-green-500' : 'bg-red-500'}`} />
    </div>
  );
};

// ─── Item Image Box ───────────────────────────────────────────────────────────
const ItemImage = ({ item, catIcon, size = 'md', className = '' }: {
  item: MenuItem; catIcon?: string | null; size?: 'sm' | 'md' | 'lg' | 'hero'; className?: string;
}) => {
  const img = resolveImg(item, catIcon);
  const emoji = resolveEmoji(item, catIcon);
  const dims = size === 'hero' ? 'w-full h-56' : size === 'lg' ? 'w-24 h-24' : size === 'md' ? 'w-[90px] h-[90px]' : 'w-12 h-12';
  const rounded = size === 'hero' ? 'rounded-none' : 'rounded-2xl';
  const emojiSize = size === 'hero' ? 'text-8xl' : size === 'lg' ? 'text-5xl' : size === 'md' ? 'text-4xl' : 'text-2xl';
  return (
    <div className={`${dims} ${rounded} overflow-hidden shrink-0 ${className}`}
      style={{ background: 'rgba(128,128,128,0.10)' }}>
      {img ? <img src={img} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
        : emoji ? <div className={`w-full h-full flex items-center justify-center ${emojiSize}`}>{emoji}</div>
        : <div className="w-full h-full flex items-center justify-center opacity-15">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 1.567-3 3.5V20m3-12c1.657 0 3 1.567 3 3.5V20M9 20h6M5 8a7 7 0 0114 0" /></svg>
          </div>}
    </div>
  );
};

// ─── BG Blobs ─────────────────────────────────────────────────────────────────
function hexLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// For light themes, boost blob saturation so they're visible against light bg
function blobColor(color: string, isDarkBg: boolean): string {
  if (isDarkBg) return color;
  // Parse and boost saturation via HSL
  try {
    const h = color.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let hue = 0, sat = 0;
    const lum = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      sat = lum > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) hue = ((b - r) / d + 2) / 6;
      else hue = ((r - g) / d + 4) / 6;
    }
    // If near-neutral (low saturation), shift to a warm amber
    if (sat < 0.25) return '#F59E0B';
    // Otherwise boost saturation and use a lighter value
    const boostedSat = Math.min(1, sat * 2.5);
    const boostedLum = 0.55;
    const hDeg = Math.round(hue * 360);
    return `hsl(${hDeg}, ${Math.round(boostedSat * 100)}%, ${Math.round(boostedLum * 100)}%)`;
  } catch { return color; }
}

const BgBlobs = ({ primary, secondary, bg }: { primary: string; secondary: string; bg: string }) => {
  const isDark = hexLuminance(bg) < 0.3;
  const blob1 = blobColor(primary, isDark);
  const blob2 = blobColor(secondary, isDark);
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" style={{ backgroundColor: bg }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes glassBreath { 0%,100% { opacity:.55; transform:scale(1) } 50% { opacity:.80; transform:scale(1.06) } }
        @keyframes glassFloat  { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-7px) } }
        .glass-breath { animation: glassBreath 4s ease-in-out infinite }
        .glass-float  { animation: glassFloat 3.2s ease-in-out infinite }
      `}} />
      <div className="absolute -top-1/4 -right-1/4 rounded-full pointer-events-none glass-breath"
        style={{ width: '80vw', height: '80vw', background: blob1, filter: 'blur(80px)', opacity: isDark ? 1 : 0.45 }} />
      <div className="absolute top-1/3 -left-1/4 rounded-full pointer-events-none"
        style={{ width: '65vw', height: '65vw', background: blob2, opacity: isDark ? 0.55 : 0.35, filter: 'blur(70px)' }} />
      <div className="absolute bottom-0 left-1/3 rounded-full pointer-events-none"
        style={{ width: '50vw', height: '50vw', background: blob1, opacity: isDark ? 0.40 : 0.25, filter: 'blur(60px)' }} />
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.045, pointerEvents: 'none' }}>
        <filter id="menu-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#menu-grain)" />
      </svg>
    </div>
  );
};

// ─── Item Detail Bottom Sheet ─────────────────────────────────────────────────
function ItemDetailSheet({ item, qty, catIcon, onAdd, onRemove, onClose, colors }: {
  item: MenuItem; qty: number; catIcon?: string | null;
  onAdd: (item: MenuItem, instructions: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  colors: Record<string, string>;
}) {
  const [instructions, setInstructions] = useState('');
  const [showNutrition, setShowNutrition] = useState(false);
  const primary = colors.primary || '#1A1A1A';
  const secondary = colors.secondary || primary;
  const textColor = colors.textColor || '#1A1A1A';
  const surfaceColor = colors.surfaceColor || '#FFFFFF';

  const img = resolveImg(item, catIcon);
  const emoji = resolveEmoji(item, catIcon);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[92dvh] flex flex-col rounded-t-3xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: `${surfaceColor}AA`, backdropFilter: 'blur(32px) saturate(180%)', WebkitBackdropFilter: 'blur(32px) saturate(180%)' }}>

        {/* Hero image */}
        <div className="relative w-full h-56 shrink-0 bg-gray-100">
          {img
            ? <img src={img} alt={item.name} className="w-full h-full object-cover" />
            : emoji
            ? <div className="w-full h-full flex items-center justify-center text-8xl">{emoji}</div>
            : <div className="w-full h-full flex items-center justify-center opacity-15">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 1.567-3 3.5V20m3-12c1.657 0 3 1.567 3 3.5V20M9 20h6M5 8a7 7 0 0114 0" /></svg>
              </div>}
          {/* gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          {/* close button */}
          <button onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-sm text-white font-bold text-lg">
            ×
          </button>
          {/* Veg badge */}
          <div className="absolute bottom-4 left-4"><VegBadge isVeg={item.is_veg} /></div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pt-5 pb-6 space-y-4">
          {/* Tags */}
          {(item.is_bestseller || (item.tags && item.tags.length > 0)) && (
            <div className="flex gap-2 flex-wrap">
              {item.is_bestseller && (
                <span className="text-xs font-black px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200">Bestseller</span>
              )}
              {item.tags?.map(tag => (
                <span key={tag} className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
                  style={{ backgroundColor: primary }}>{tag}</span>
              ))}
            </div>
          )}

          {/* Name + price */}
          <div>
            <h2 className="text-2xl font-black leading-tight" style={{ color: textColor }}>{item.name}</h2>
            <p className="text-xl font-black mt-1.5" style={{ color: secondary }}>₹{item.price}</p>
          </div>

          {/* Description */}
          {item.description && (
            <p className="text-sm leading-relaxed" style={{ color: textColor, opacity: 0.6 }}>{item.description}</p>
          )}

          {/* Nutritional info */}
          {item.nutritional_value && (
            <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <button onClick={() => setShowNutrition(!showNutrition)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold"
                style={{ color: textColor, backgroundColor: 'rgba(0,0,0,0.03)' }}>
                <span>Nutritional Info</span>
                <svg className={`w-4 h-4 transition-transform ${showNutrition ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showNutrition && (
                <div className="px-4 py-3 text-xs leading-relaxed" style={{ color: textColor, opacity: 0.65 }}>
                  {item.nutritional_value}
                </div>
              )}
            </div>
          )}

          {/* Special instructions */}
          <div>
            <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: textColor, opacity: 0.5 }}>
              Special Instructions
            </label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
              placeholder="e.g. No onions, extra spicy, less oil…"
              rows={2}
              className="w-full px-4 py-3 rounded-2xl text-sm resize-none focus:outline-none"
              style={{ border: `1.5px solid rgba(0,0,0,0.12)`, color: textColor, backgroundColor: 'rgba(0,0,0,0.03)' }} />
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-5 pb-8 pt-3 flex items-center gap-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
          {qty > 0 ? (
            <>
              <div className="flex items-center rounded-2xl overflow-hidden shadow-lg" style={{ backgroundColor: primary }}>
                <button onClick={() => onRemove(item.id)} className="w-12 h-12 flex items-center justify-center text-white font-bold hover:bg-black/15 text-xl">−</button>
                <span className="w-10 text-center text-white font-black text-lg">{qty}</span>
                <button onClick={() => onAdd(item, instructions)} className="w-12 h-12 flex items-center justify-center text-white font-bold hover:bg-black/15 text-xl">+</button>
              </div>
              <button onClick={() => { onAdd(item, instructions); onClose(); }}
                className="flex-1 h-12 rounded-2xl text-white font-black text-base transition-all active:scale-[0.98]"
                style={{ backgroundColor: primary, boxShadow: `0 6px 20px ${primary}40` }}>
                Update · ₹{(item.price * qty).toFixed(0)}
              </button>
            </>
          ) : (
            <button onClick={() => { onAdd(item, instructions); onClose(); }}
              className="w-full h-12 rounded-2xl text-white font-black text-base transition-all active:scale-[0.98]"
              style={{ backgroundColor: primary, boxShadow: `0 6px 20px ${primary}40` }}>
              Add to Cart · ₹{item.price}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════ IDENTITY GATE ════════════════════════════════
function IdentityGate({ onSubmit, canSkip, colors, logoUrl, restaurantName, outletLocation }: {
  onSubmit: (identity: Identity) => void;
  canSkip: boolean;
  colors: Record<string, string>;
  logoUrl: string | null;
  restaurantName: string;
  outletLocation: string;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [error, setError] = useState('');

  const primary = colors.primary || '#1A1A1A';
  const textColor = colors.textColor || '#1A1A1A';
  const bgColor = colors.bgColor || '#FAFAFA';
  const surfaceColor = colors.surfaceColor || '#FFFFFF';
  const fontFamily = colors.fontFamily || 'Inter';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const handleSubmit = () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 7) { setError('Please enter a valid phone number'); return; }
    onSubmit({ name: name.trim(), phone: phone.trim(), whatsappOptIn });
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-y-auto" style={{ fontFamily: `${fontFamily}, system-ui, sans-serif` }}>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700;900&display=swap');` }} />
      <BgBlobs primary={primary} secondary={colors.secondary || primary} bg={bgColor} />

      <div className="relative flex flex-col items-center justify-center pt-16 pb-10 px-6 text-center"
        style={{ background: `linear-gradient(160deg, ${primary}F5 0%, ${primary}B0 100%)` }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_70%)]" />
        <div className="relative z-10">
          {logoUrl ? (
            <div className="w-24 h-24 rounded-3xl mx-auto mb-4 overflow-hidden shadow-2xl ring-4 ring-white/20">
              <img src={logoUrl.startsWith('/') ? `${BACKEND_URL}${logoUrl}` : logoUrl}
                alt={restaurantName} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-3xl mx-auto mb-4 flex items-center justify-center text-4xl font-black shadow-2xl ring-4 ring-white/20"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)', color: 'white' }}>
              {restaurantName[0]}
            </div>
          )}
          <p className="text-white/70 text-base font-medium mb-1">{greeting}!</p>
          <h1 className="text-3xl font-black text-white tracking-tight mb-1">{restaurantName}</h1>
          {outletLocation && <p className="text-white/55 text-sm">{outletLocation}</p>}
        </div>
      </div>

      <div className="flex-1 flex flex-col px-5 -mt-6 pb-8 max-w-sm mx-auto w-full">
        <div className="rounded-3xl p-6 space-y-4 shadow-2xl"
          style={{ ...glass(surfaceColor, '99', '28px'), border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 24px 64px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.35)' }}>
          <div className="text-center mb-5">
            <p className="font-bold text-base" style={{ color: textColor }}>Quick check-in</p>
            <p className="text-xs mt-1" style={{ color: textColor, opacity: 0.5 }}>So we can personalise your experience</p>
          </div>

          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: textColor, opacity: 0.55 }}>Your Name *</label>
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'rgba(0,0,0,0.35)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Enter your name" autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full pl-11 pr-4 py-4 rounded-2xl font-medium focus:outline-none transition-all text-base"
                style={{ ...glass(surfaceColor, 'B0'), border: `1.5px solid ${name ? primary : 'rgba(255,255,255,0.25)'}`, color: textColor }} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: textColor, opacity: 0.55 }}>Phone Number *</label>
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'rgba(0,0,0,0.35)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210" inputMode="tel"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full pl-11 pr-4 py-4 rounded-2xl font-medium focus:outline-none transition-all text-base"
                style={{ ...glass(surfaceColor, 'B0'), border: `1.5px solid ${phone ? primary : 'rgba(255,255,255,0.25)'}`, color: textColor }} />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
            <button type="button" onClick={() => setWhatsappOptIn(!whatsappOptIn)}
              className={`relative w-11 h-6 rounded-full transition-all duration-300 shrink-0 ${whatsappOptIn ? 'bg-green-500' : 'bg-gray-300'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${whatsappOptIn ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
            <span className="text-xs font-medium" style={{ color: textColor, opacity: 0.7 }}>Get order updates on WhatsApp</span>
          </label>

          {error && (
            <div className="px-3 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
              {error}
            </div>
          )}

          <button onClick={handleSubmit}
            className="w-full py-4 rounded-2xl text-white font-black text-base transition-all active:scale-[0.98] hover:brightness-110 mt-2"
            style={{ backgroundColor: primary, boxShadow: `0 8px 28px ${primary}50` }}>
            Let's Go →
          </button>

          {canSkip && (
            <button onClick={() => onSubmit({ name: 'Guest', phone: '', whatsappOptIn: false })}
              className="w-full py-2 text-sm font-medium text-center"
              style={{ color: textColor, opacity: 0.4 }}>
              Continue as guest
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════ BOTTOM NAV ═══════════════════════════════════
function BottomNav({ activeTab, onTabChange, cartCount, primary, surface, text }: {
  activeTab: Tab; onTabChange: (t: Tab) => void; cartCount: number;
  primary: string; surface: string; text: string;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex items-end justify-center px-4"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      <div className="w-full max-w-md flex items-center justify-around rounded-3xl px-2 py-2 shadow-2xl"
        style={{ ...glass(surface, '88', '28px'), border: '1px solid rgba(255,255,255,0.22)', boxShadow: `0 -2px 32px rgba(0,0,0,0.18), 0 8px 40px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.28)` }}>

        <button onClick={() => onTabChange('menu')}
          className="flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all active:scale-95"
          style={{ background: activeTab === 'menu' ? `${primary}18` : 'transparent' }}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={activeTab === 'menu' ? 2.5 : 1.8} viewBox="0 0 24 24"
            style={{ color: activeTab === 'menu' ? primary : `${text}50` }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
          </svg>
          <span className="text-[10px] font-bold" style={{ color: activeTab === 'menu' ? primary : `${text}50` }}>Menu</span>
        </button>

        <button onClick={() => onTabChange('ai')} className="flex flex-col items-center -mt-5 transition-all active:scale-95">
          <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shadow-xl"
            style={{
              background: activeTab === 'ai' ? primary : `linear-gradient(135deg, ${primary}EE, ${primary}AA)`,
              boxShadow: activeTab === 'ai' ? `0 8px 30px ${primary}60, 0 0 0 4px ${primary}20` : `0 8px 24px ${primary}40`,
            }}>
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
            <span className="text-white text-[9px] font-black tracking-wide mt-0.5">AI Pick</span>
          </div>
        </button>

        <button onClick={() => onTabChange('cart')}
          className="flex flex-col items-center gap-1 px-5 py-2 rounded-2xl transition-all active:scale-95 relative"
          style={{ background: activeTab === 'cart' ? `${primary}18` : 'transparent' }}>
          <div className="relative">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={activeTab === 'cart' ? 2.5 : 1.8} viewBox="0 0 24 24"
              style={{ color: activeTab === 'cart' ? primary : `${text}50` }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            {cartCount > 0 && (
              <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center"
                style={{ backgroundColor: primary }}>
                {cartCount > 9 ? '9+' : cartCount}
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold" style={{ color: activeTab === 'cart' ? primary : `${text}50` }}>Cart</span>
        </button>
      </div>
    </div>
  );
}

// ─── Floating Cart Pill ───────────────────────────────────────────────────────
function FloatingCartPill({ cart, primary, surface, text, onViewCart }: {
  cart: CartItem[]; primary: string; surface: string; text: string;
  onViewCart: () => void;
}) {
  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);
  const totalPrice = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  if (totalItems === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none"
      style={{ paddingBottom: 'calc(max(12px, env(safe-area-inset-bottom)) + 72px)' }}>
      <button onClick={onViewCart}
        className="pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl transition-all active:scale-[0.97] hover:brightness-105"
        style={{
          backgroundColor: primary,
          boxShadow: `0 8px 32px ${primary}50, 0 2px 8px rgba(0,0,0,0.2)`,
        }}>
        <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-white/20 font-black text-white text-sm">
          {totalItems}
        </div>
        <span className="text-white font-black text-sm">
          {totalItems} item{totalItems > 1 ? 's' : ''} · ₹{totalPrice.toFixed(0)}
        </span>
        <div className="flex items-center gap-1 text-white/90 font-bold text-sm">
          View Cart
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    </div>
  );
}

// ─── Zomato-Style Item Card ───────────────────────────────────────────────────
function ZomatoCard({ item, qty, catIcon, onAdd, onRemove, onTap, primary, secondary, textColor, surfaceColor }: {
  item: MenuItem; qty: number; catIcon?: string | null;
  onAdd: () => void; onRemove: () => void; onTap: () => void;
  primary: string; secondary: string; textColor: string; surfaceColor: string;
}) {
  const img = resolveImg(item, catIcon);
  const emoji = resolveEmoji(item, catIcon);
  const hasImage = !!(img || emoji);

  return (
    <div className="flex gap-3 py-4 px-1" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
      {/* Left: info */}
      <div className="flex-1 flex flex-col gap-1.5 min-w-0" onClick={onTap}>
        {/* Veg badge + name */}
        <div className="flex items-start gap-2">
          <VegBadge isVeg={item.is_veg} size="sm" />
          {item.is_bestseller && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 shrink-0">Bestseller</span>
          )}
        </div>
        <h3 className="font-bold text-sm leading-snug" style={{ color: textColor }}>{item.name}</h3>
        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {item.tags.map(tag => (
              <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: `${primary}CC` }}>{tag}</span>
            ))}
          </div>
        )}
        {/* Description */}
        {item.description && (
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: textColor, opacity: 0.5 }}>{item.description}</p>
        )}
        {/* Order count */}
        {item.order_count != null && item.order_count > 5 && (
          <p className="text-[10px] font-bold" style={{ color: primary, opacity: 0.75 }}>Ordered {item.order_count}× this week</p>
        )}
        {/* Price */}
        <p className="font-black text-base mt-1" style={{ color: textColor }}>₹{item.price}</p>
      </div>

      {/* Right: image + add button */}
      {hasImage && (
        <div className="shrink-0 flex flex-col items-center gap-2 w-[90px]">
          <div className="w-[90px] h-[90px] rounded-2xl overflow-hidden cursor-pointer" onClick={onTap}
            style={{ background: 'rgba(128,128,128,0.10)' }}>
            {img
              ? <img src={img} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
              : <div className="w-full h-full flex items-center justify-center text-4xl">{emoji}</div>}
          </div>
          {/* Add/qty control */}
          {qty === 0 ? (
            <button onClick={onAdd}
              className="w-[80px] py-1.5 rounded-xl font-black text-xs border-2 transition-all active:scale-95"
              style={{ borderColor: primary, color: primary, backgroundColor: `${primary}10` }}>
              ADD
            </button>
          ) : (
            <div className="flex items-center rounded-xl overflow-hidden h-8 shadow" style={{ backgroundColor: primary }}>
              <button onClick={onRemove} className="w-8 h-8 flex items-center justify-center text-white font-bold hover:bg-black/15">−</button>
              <span className="w-7 text-center text-white font-black text-sm">{qty}</span>
              <button onClick={onAdd} className="w-8 h-8 flex items-center justify-center text-white font-bold hover:bg-black/15">+</button>
            </div>
          )}
        </div>
      )}

      {/* No image: add button inline */}
      {!hasImage && (
        <div className="shrink-0 self-center">
          {qty === 0 ? (
            <button onClick={onAdd}
              className="px-4 py-1.5 rounded-xl font-black text-xs border-2 transition-all active:scale-95"
              style={{ borderColor: primary, color: primary, backgroundColor: `${primary}10` }}>
              ADD
            </button>
          ) : (
            <div className="flex items-center rounded-xl overflow-hidden shadow" style={{ backgroundColor: primary }}>
              <button onClick={onRemove} className="w-8 h-8 flex items-center justify-center text-white font-bold hover:bg-black/15">−</button>
              <span className="w-7 text-center text-white font-black text-sm">{qty}</span>
              <button onClick={onAdd} className="w-8 h-8 flex items-center justify-center text-white font-bold hover:bg-black/15">+</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Grid Tile ────────────────────────────────────────────────────────────────
function GridTile({ item, qty, catIcon, onAdd, onRemove, onTap, primary, secondary, textColor, surfaceColor }: {
  item: MenuItem; qty: number; catIcon?: string | null;
  onAdd: () => void; onRemove: () => void; onTap: () => void;
  primary: string; secondary: string; textColor: string; surfaceColor: string;
}) {
  const img = resolveImg(item, catIcon);
  const emoji = resolveEmoji(item, catIcon);
  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer"
      style={{ ...glass(surfaceColor, '90'), border: '1px solid rgba(255,255,255,0.18)' }} onClick={onTap}>
      <div className="aspect-square relative overflow-hidden" style={{ background: 'rgba(128,128,128,0.10)' }}>
        {img ? <img src={img} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
          : emoji ? <div className="w-full h-full flex items-center justify-center text-6xl">{emoji}</div>
          : <div className="w-full h-full flex items-center justify-center opacity-15">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 1.567-3 3.5V20m3-12c1.657 0 3 1.567 3 3.5V20M9 20h6M5 8a7 7 0 0114 0" /></svg>
            </div>}
        <div className="absolute top-2 left-2"><VegBadge isVeg={item.is_veg} /></div>
        {item.is_bestseller && (
          <div className="absolute top-2 right-2 text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/90 text-white">Best</div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-bold text-sm truncate" style={{ color: textColor }}>{item.name}</h3>
        <div className="flex items-center justify-between mt-2">
          <p className="font-black text-sm" style={{ color: secondary }}>₹{item.price}</p>
          <div onClick={e => e.stopPropagation()}>
            {qty === 0 ? (
              <button onClick={onAdd}
                className="px-2.5 py-1 rounded-lg font-black text-xs border-2 transition-all active:scale-95"
                style={{ borderColor: primary, color: primary }}>+</button>
            ) : (
              <div className="flex items-center rounded-xl overflow-hidden" style={{ backgroundColor: primary }}>
                <button onClick={onRemove} className="w-7 h-7 flex items-center justify-center text-white font-bold text-base">−</button>
                <span className="w-5 text-center text-white font-black text-xs">{qty}</span>
                <button onClick={onAdd} className="w-7 h-7 flex items-center justify-center text-white font-bold text-base">+</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Compact Row ──────────────────────────────────────────────────────────────
function CompactRow({ item, qty, catIcon, onAdd, onRemove, onTap, primary, secondary, textColor, surfaceColor }: {
  item: MenuItem; qty: number; catIcon?: string | null;
  onAdd: () => void; onRemove: () => void; onTap: () => void;
  primary: string; secondary: string; textColor: string; surfaceColor: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 cursor-pointer transition-colors hover:bg-black/5"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }} onClick={onTap}>
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <VegBadge isVeg={item.is_veg} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-sm truncate" style={{ color: textColor }}>{item.name}</h3>
            {item.is_bestseller && <span className="text-[9px] font-black text-amber-600 shrink-0">Best</span>}
          </div>
          {item.description && <p className="text-[11px] truncate mt-0.5" style={{ color: textColor, opacity: 0.45 }}>{item.description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2.5 shrink-0 ml-3" onClick={e => e.stopPropagation()}>
        <span className="font-black text-sm" style={{ color: secondary }}>₹{item.price}</span>
        {qty === 0 ? (
          <button onClick={onAdd}
            className="px-3 py-1.5 rounded-xl font-bold text-xs border-2 transition-all active:scale-95"
            style={{ borderColor: primary, color: primary }}>ADD</button>
        ) : (
          <div className="flex items-center rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: primary }}>
            <button onClick={onRemove} className="w-7 h-7 flex items-center justify-center text-white font-bold">−</button>
            <span className="w-6 text-center text-white font-black text-xs">{qty}</span>
            <button onClick={onAdd} className="w-7 h-7 flex items-center justify-center text-white font-bold">+</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Accordion Category ───────────────────────────────────────────────────────
function AccordionCategory({ cat, catIcon, items, getQty, addToCart, removeFromCart, onItemTap, primary, secondary, textColor, bgColor, surfaceColor, defaultOpen }: any) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        ...(open ? glass(surfaceColor, '88', '16px') : glass(bgColor, '60', '8px')),
        border: `1px solid ${open ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)'}`,
        boxShadow: open ? `0 8px 32px ${primary}15, inset 0 1px 0 rgba(255,255,255,0.22)` : 'none',
      }}>
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 transition-all"
        style={{ background: open ? `${primary}0D` : 'transparent' }}>
        <div className="flex items-center gap-3">
          {catIcon ? (
            catIcon.startsWith('/') || catIcon.startsWith('http')
              ? <img src={catIcon.startsWith('/') ? `${BACKEND_URL}${catIcon}` : catIcon} alt="" className="w-6 h-6 rounded object-cover" />
              : <span className="text-xl leading-none">{catIcon}</span>
          ) : <span className="w-1.5 h-6 rounded-full" style={{ backgroundColor: open ? primary : `${textColor}30` }} />}
          <h2 className="font-black text-base" style={{ color: open ? primary : textColor }}>{cat}</h2>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${primary}18`, color: primary }}>
            {items.length}
          </span>
        </div>
        <svg className={`w-5 h-5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: open ? primary : `${textColor}50` }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          {items.map((item: MenuItem) => {
            const qty = getQty(item.id);
            return (
              <CompactRow key={item.id} item={item} qty={qty} catIcon={catIcon}
                onAdd={() => addToCart(item)} onRemove={() => removeFromCart(item.id)}
                onTap={() => onItemTap(item, catIcon)}
                primary={primary} secondary={secondary} textColor={textColor} surfaceColor={surfaceColor} />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════ MENU TAB ════════════════════════════════════
function MenuTab({ outlet, company, categories, category_info, allItems, getQty, addToCart, removeFromCart, colors, menuLayout, isMobile }: {
  outlet: any; company: any;
  categories: Record<string, MenuItem[]>; category_info?: CategoryInfo[];
  allItems: MenuItem[]; getQty: (id: string) => number;
  addToCart: (item: MenuItem, instructions?: string) => void; removeFromCart: (id: string) => void;
  colors: Record<string, string>; menuLayout: string; isMobile: boolean;
}) {
  const [search, setSearch] = useState('');
  const [vegFilter, setVegFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
  const [activeCategory, setActiveCategory] = useState(Object.keys(categories)[0] || '');
  const [selectedItem, setSelectedItem] = useState<{ item: MenuItem; catIcon?: string | null } | null>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const categoryStripRef = useRef<HTMLDivElement>(null);
  const catBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isProgrammaticScroll = useRef(false);

  const primary = colors.primary || '#1A1A1A';
  const secondary = colors.secondary || primary;
  const textColor = colors.textColor || '#1A1A1A';
  const surfaceColor = colors.surfaceColor || '#FFFFFF';
  const bgColor = colors.bgColor || '#FAFAFA';
  const fontFamily = colors.fontFamily || 'Inter';

  const coverImageUrl = outlet?.cover_image_url
    ? (outlet.cover_image_url.startsWith('/') ? `${BACKEND_URL}${outlet.cover_image_url}` : outlet.cover_image_url)
    : null;
  const logoUrl = outlet?.portal_logo_url
    ? (outlet.portal_logo_url.startsWith('/') ? `${BACKEND_URL}${outlet.portal_logo_url}` : outlet.portal_logo_url)
    : null;
  const restaurantName = company?.name || 'Restaurant';
  const cuisineType = outlet?.cuisine_type || '';
  const openingHours = outlet?.opening_hours || '';
  const openStatus = isOpenNow(openingHours);

  const catIconMap: Record<string, string | null> = {};
  if (category_info) { for (const ci of category_info) catIconMap[ci.name] = ci.icon; }

  const filteredCategories: Record<string, MenuItem[]> = {};
  for (const [cat, catItems] of Object.entries(categories)) {
    const filtered = (catItems as MenuItem[]).filter(item => {
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase()) || item.description?.toLowerCase().includes(search.toLowerCase());
      const matchVeg = vegFilter === 'all' || (vegFilter === 'veg' && item.is_veg) || (vegFilter === 'nonveg' && !item.is_veg);
      return matchSearch && matchVeg && item.available;
    });
    if (filtered.length > 0) filteredCategories[cat] = filtered;
  }
  const catNames = Object.keys(filteredCategories);

  // Top items by order_count for "Most Ordered" strip
  const mostOrdered = [...allItems]
    .filter(i => i.available && (i.order_count ?? 0) > 0)
    .sort((a, b) => (b.order_count ?? 0) - (a.order_count ?? 0))
    .slice(0, 8);

  // Scroll-spy: on mobile use the internal scroll div as root; on desktop use the viewport
  useEffect(() => {
    if (menuLayout === 'accordion') return;
    const container = isMobile ? scrollContainerRef.current : null;
    if (isMobile && !container) return;
    const observer = new IntersectionObserver(
      entries => {
        if (isProgrammaticScroll.current) return;
        for (const e of entries) {
          if (e.isIntersecting) {
            const cat = e.target.getAttribute('data-category') || '';
            setActiveCategory(cat);
            const btn = catBtnRefs.current[cat];
            btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
      },
      { root: container, rootMargin: '-80px 0px -50% 0px', threshold: 0.1 }
    );
    for (const ref of Object.values(categoryRefs.current)) { if (ref) observer.observe(ref); }
    return () => observer.disconnect();
  }, [filteredCategories, menuLayout, isMobile]);

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    const target = categoryRefs.current[cat];
    if (!target) return;
    const stripHeight = categoryStripRef.current?.offsetHeight ?? 48;
    isProgrammaticScroll.current = true;
    if (isMobile) {
      const container = scrollContainerRef.current;
      if (!container) return;
      container.scrollTo({ top: target.offsetTop - stripHeight - 8, behavior: 'smooth' });
    } else {
      const targetTop = window.scrollY + target.getBoundingClientRect().top - stripHeight - 8;
      window.scrollTo({ top: targetTop, behavior: 'smooth' });
    }
    setTimeout(() => { isProgrammaticScroll.current = false; }, 700);
  };

  return (
    <div ref={scrollContainerRef} className={isMobile ? 'flex-1 overflow-y-auto' : 'w-full'} style={{ fontFamily: `${fontFamily}, system-ui, sans-serif`, paddingBottom: isMobile ? 'calc(max(12px, env(safe-area-inset-bottom)) + 140px)' : '120px' }}>

      {/* ── Hero ── */}
      <div className="relative w-full" style={{ minHeight: coverImageUrl ? 220 : 140 }}>
        {coverImageUrl ? (
          <>
            <img src={coverImageUrl} alt={restaurantName} className="w-full object-cover" style={{ height: 220 }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
          </>
        ) : (
          <div className="w-full" style={{ height: 140, background: `linear-gradient(135deg, ${primary}EE, ${primary}99)` }}>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_70%)]" />
          </div>
        )}

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 flex items-end gap-3">
          {logoUrl && (
            <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 shadow-xl ring-2 ring-white/30 mb-1">
              <img src={logoUrl} alt={restaurantName} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-white leading-tight drop-shadow-sm">{restaurantName}</h1>
            {cuisineType && (
              <p className="text-white/70 text-xs font-medium mt-0.5">{cuisineType}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {openingHours && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/30 text-white/90 backdrop-blur-sm flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {openingHours}
                </span>
              )}
              {openStatus !== null && (
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${openStatus ? 'bg-green-500/90 text-white' : 'bg-red-500/80 text-white'}`}>
                  {openStatus ? '● Open' : '● Closed'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Search + diet filter ── */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: `${textColor}50` }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search dishes…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl font-medium focus:outline-none text-sm transition-all"
            style={{ backgroundColor: surfaceColor, border: `1.5px solid ${search ? primary : 'rgba(0,0,0,0.1)'}`, color: textColor }} />
        </div>
        <div className="flex gap-2" style={{ scrollbarWidth: 'none' }}>
          {(['all', 'veg', 'nonveg'] as const).map(f => (
            <button key={f} onClick={() => setVegFilter(f)}
              className="whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0"
              style={vegFilter === f
                ? { backgroundColor: primary, color: 'white', boxShadow: `0 4px 14px ${primary}40` }
                : { backgroundColor: surfaceColor, color: textColor, border: `1.5px solid rgba(0,0,0,0.1)` }}>
              {f === 'all' ? 'All' : f === 'veg' ? 'Veg' : 'Non-Veg'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sticky category strip ── */}
      {menuLayout !== 'accordion' && catNames.length > 0 && (
        <div ref={categoryStripRef}
          className="sticky top-0 z-30 flex gap-2 px-4 py-3 overflow-x-auto"
          style={{ scrollbarWidth: 'none', backgroundColor: `${surfaceColor}80`, backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          {catNames.map(cat => {
            const icon = catIconMap[cat];
            const isActive = activeCategory === cat;
            return (
              <button key={cat} ref={el => { catBtnRefs.current[cat] = el; }}
                onClick={() => scrollToCategory(cat)}
                className="whitespace-nowrap flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all"
                style={isActive
                  ? { backgroundColor: primary, color: 'white', boxShadow: `0 3px 10px ${primary}40` }
                  : { backgroundColor: 'transparent', color: textColor, border: `1.5px solid rgba(0,0,0,0.1)` }}>
                {icon && (icon.startsWith('/') || icon.startsWith('http')
                  ? <img src={icon.startsWith('/') ? `${BACKEND_URL}${icon}` : icon} alt="" className="w-3.5 h-3.5 rounded object-cover" />
                  : <span className="text-sm leading-none">{icon}</span>)}
                {cat}
                {search && (
                  <span className="text-[10px] font-black opacity-70">
                    {filteredCategories[cat]?.length ?? 0}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Most Ordered strip ── */}
      {!search && mostOrdered.length >= 3 && (
        <div className="px-4 pt-5 pb-2">
          <h2 className="text-base font-black mb-3 flex items-center gap-2" style={{ color: textColor }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#f59e0b' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            Most Ordered
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {mostOrdered.map(item => {
              const img = resolveImg(item, catIconMap[item.category]);
              const emoji = resolveEmoji(item, catIconMap[item.category]);
              const qty = getQty(item.id);
              return (
                <div key={item.id} className="shrink-0 w-36 rounded-2xl overflow-hidden cursor-pointer"
                  style={{ ...glass(surfaceColor, '88'), border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 4px 16px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.20)' }}
                  onClick={() => setSelectedItem({ item, catIcon: catIconMap[item.category] })}>
                  <div className="w-full h-28 relative" style={{ background: 'rgba(128,128,128,0.10)' }}>
                    {img
                      ? <img src={img} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                      : emoji
                      ? <div className="w-full h-full flex items-center justify-center text-5xl">{emoji}</div>
                      : <div className="w-full h-full flex items-center justify-center opacity-15">
                          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 1.567-3 3.5V20m3-12c1.657 0 3 1.567 3 3.5V20M9 20h6M5 8a7 7 0 0114 0" /></svg>
                        </div>}
                    {item.order_count && item.order_count > 0 && (
                      <div className="absolute bottom-1.5 left-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: `${primary}E0` }}>
                        {item.order_count}× ordered
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="font-bold text-xs truncate" style={{ color: textColor }}>{item.name}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="font-black text-xs" style={{ color: secondary }}>₹{item.price}</p>
                      <button onClick={e => { e.stopPropagation(); qty === 0 ? addToCart(item) : removeFromCart(item.id); }}
                        className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-sm transition-all"
                        style={qty > 0
                          ? { backgroundColor: primary, color: 'white' }
                          : { border: `2px solid ${primary}`, color: primary }}>
                        {qty > 0 ? qty : '+'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Category sections ── */}
      <div className="px-4 pt-4 space-y-6">
        {catNames.length === 0 && (
          <div className="text-center py-20">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-25" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <p className="font-bold" style={{ color: textColor, opacity: 0.4 }}>No items found</p>
          </div>
        )}

        {menuLayout === 'accordion' ? (
          <div className="space-y-3">
            {catNames.map((cat, idx) => (
              <AccordionCategory key={cat} cat={cat} catIcon={catIconMap[cat] ?? null}
                items={filteredCategories[cat]} getQty={getQty} addToCart={addToCart} removeFromCart={removeFromCart}
                onItemTap={(item: MenuItem, ci: string | null) => setSelectedItem({ item, catIcon: ci })}
                primary={primary} secondary={secondary} textColor={textColor} bgColor={bgColor}
                surfaceColor={surfaceColor} defaultOpen={idx === 0} />
            ))}
          </div>
        ) : menuLayout === 'grid' ? (
          catNames.map(cat => (
            <div key={cat} ref={el => { categoryRefs.current[cat] = el; }} data-category={cat} className="scroll-mt-16">
              <h2 className="text-base font-black mb-3 flex items-center gap-2" style={{ color: textColor }}>
                {catIconMap[cat] && (catIconMap[cat]!.startsWith('/') || catIconMap[cat]!.startsWith('http')
                  ? <img src={catIconMap[cat]!.startsWith('/') ? `${BACKEND_URL}${catIconMap[cat]}` : catIconMap[cat]!} alt="" className="w-5 h-5 rounded object-cover" />
                  : <span className="text-lg">{catIconMap[cat]}</span>)}
                {cat}
                <span className="text-sm font-medium" style={{ color: textColor, opacity: 0.35 }}>({filteredCategories[cat].length})</span>
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {filteredCategories[cat].map(item => (
                  <GridTile key={item.id} item={item} qty={getQty(item.id)} catIcon={catIconMap[cat] ?? null}
                    onAdd={() => addToCart(item)} onRemove={() => removeFromCart(item.id)}
                    onTap={() => setSelectedItem({ item, catIcon: catIconMap[cat] })}
                    primary={primary} secondary={secondary} textColor={textColor} surfaceColor={surfaceColor} />
                ))}
              </div>
            </div>
          ))
        ) : menuLayout === 'compact' ? (
          catNames.map(cat => (
            <div key={cat} ref={el => { categoryRefs.current[cat] = el; }} data-category={cat} className="scroll-mt-16">
              <h2 className="text-base font-black mb-2 flex items-center gap-2" style={{ color: textColor }}>
                {catIconMap[cat] && (catIconMap[cat]!.startsWith('/') || catIconMap[cat]!.startsWith('http')
                  ? <img src={catIconMap[cat]!.startsWith('/') ? `${BACKEND_URL}${catIconMap[cat]}` : catIconMap[cat]!} alt="" className="w-5 h-5 rounded object-cover" />
                  : <span>{catIconMap[cat]}</span>)}
                {cat}
              </h2>
              <div className="rounded-2xl overflow-hidden" style={{ ...glass(surfaceColor, '88'), border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 4px 24px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.18)' }}>
                {filteredCategories[cat].map(item => (
                  <CompactRow key={item.id} item={item} qty={getQty(item.id)} catIcon={catIconMap[cat] ?? null}
                    onAdd={() => addToCart(item)} onRemove={() => removeFromCart(item.id)}
                    onTap={() => setSelectedItem({ item, catIcon: catIconMap[cat] })}
                    primary={primary} secondary={secondary} textColor={textColor} surfaceColor={surfaceColor} />
                ))}
              </div>
            </div>
          ))
        ) : (
          // Default: Zomato-style classic
          catNames.map(cat => (
            <div key={cat} ref={el => { categoryRefs.current[cat] = el; }} data-category={cat} className="scroll-mt-16">
              <div className="rounded-2xl overflow-hidden" style={{ ...glass(surfaceColor, '88'), border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 4px 24px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.18)' }}>
                {/* Category header */}
                <div className="flex items-center gap-2 px-4 py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  {catIconMap[cat] && (catIconMap[cat]!.startsWith('/') || catIconMap[cat]!.startsWith('http')
                    ? <img src={catIconMap[cat]!.startsWith('/') ? `${BACKEND_URL}${catIconMap[cat]}` : catIconMap[cat]!} alt="" className="w-5 h-5 rounded object-cover" />
                    : <span className="text-base">{catIconMap[cat]}</span>)}
                  <h2 className="font-black text-sm uppercase tracking-wide" style={{ color: textColor }}>{cat}</h2>
                  <span className="text-xs font-bold ml-auto" style={{ color: textColor, opacity: 0.4 }}>
                    {filteredCategories[cat].length} items
                  </span>
                </div>
                {/* Items */}
                <div className="px-4">
                  {filteredCategories[cat].map(item => (
                    <ZomatoCard key={item.id} item={item} qty={getQty(item.id)} catIcon={catIconMap[cat] ?? null}
                      onAdd={() => addToCart(item)} onRemove={() => removeFromCart(item.id)}
                      onTap={() => setSelectedItem({ item, catIcon: catIconMap[cat] })}
                      primary={primary} secondary={secondary} textColor={textColor} surfaceColor={surfaceColor} />
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Item detail sheet */}
      {selectedItem && (
        <ItemDetailSheet
          item={selectedItem.item}
          qty={getQty(selectedItem.item.id)}
          catIcon={selectedItem.catIcon}
          onAdd={(item, instructions) => addToCart(item, instructions)}
          onRemove={removeFromCart}
          onClose={() => setSelectedItem(null)}
          colors={colors}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════ AI TAB ══════════════════════════════════════
function AITab({ outletId, allItems, getQty, addToCart, removeFromCart, colors, isMobile }: {
  outletId: string; allItems: MenuItem[]; getQty: (id: string) => number;
  addToCart: (item: MenuItem) => void; removeFromCart: (id: string) => void;
  colors: Record<string, string>; isMobile: boolean;
}) {
  const [selectedMood, setSelectedMood] = useState('');
  const [customText, setCustomText] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<(MenuItem & { reason: string })[]>([]);
  const [tried, setTried] = useState(false);

  const primary = colors.primary || '#1A1A1A';
  const secondary = colors.secondary || primary;
  const textColor = colors.textColor || '#1A1A1A';
  const surfaceColor = colors.surfaceColor || '#FFFFFF';

  const suggest = useCallback(async (preference: string) => {
    if (!preference.trim()) return;
    setLoading(true);
    setSuggestions([]);
    setTried(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/public/menu/ai/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: outletId, preference }),
      });
      if (res.ok) {
        const data = await res.json();
        const aiSuggestions: AISuggestion[] = data.suggestions || [];
        const matched = aiSuggestions.map((s: AISuggestion) => {
          const item = allItems.find(i => i.name.toLowerCase() === s.item_name.toLowerCase() && i.available);
          return item ? { ...item, reason: s.reason } : null;
        }).filter(Boolean) as (MenuItem & { reason: string })[];
        if (matched.length > 0) { setSuggestions(matched); setLoading(false); return; }
      }
    } catch { /* fall through */ }

    // Client-side fallback
    const lower = preference.toLowerCase();
    const scored = allItems.filter(i => i.available).map(item => {
      let score = 0;
      if (lower.includes('veg') || lower.includes('healthy')) score += item.is_veg ? 3 : -1;
      if (lower.includes('spicy')) score += (item.description?.toLowerCase().includes('spicy') ? 3 : 0);
      if (lower.includes('sweet') || lower.includes('dessert')) score += (item.category.toLowerCase().includes('dessert') ? 4 : 0);
      if (lower.includes('light')) score += (item.price < 200 ? 2 : 0);
      if (lower.includes('comfort') || lower.includes('filling')) score += (item.price > 150 ? 2 : 0);
      score += item.is_bestseller ? 2 : 0;
      score += (item.order_count ?? 0) * 0.1;
      score += Math.random() * 0.5;
      return { item, score };
    }).sort((a, b) => b.score - a.score).slice(0, 4);
    setSuggestions(scored.map(({ item }) => ({ ...item, reason: 'A great match for your mood!' })));
    setLoading(false);
  }, [outletId, allItems]);

  return (
    <div className={isMobile ? 'flex-1 overflow-y-auto px-4 pt-4' : 'w-full px-4 pt-4'} style={{ paddingBottom: isMobile ? 'calc(max(12px, env(safe-area-inset-bottom)) + 140px)' : '120px' }}>
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center glass-float"
          style={{ background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35) 0%, transparent 55%), linear-gradient(145deg, ${primary}F0, ${primary}A8)`, boxShadow: `0 8px 32px ${primary}50, inset 0 1px 0 rgba(255,255,255,0.32)` }}>
          <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black" style={{ color: textColor }}>AI Dish Suggestions</h2>
        <p className="text-sm mt-1" style={{ color: textColor, opacity: 0.5 }}>Tell us your mood — we'll find the perfect dish</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        {MOOD_CHIPS.map(chip => (
          <button key={chip.label} onClick={() => { setSelectedMood(chip.label); setCustomText(''); suggest(chip.label); }}
            className="py-3 px-2 rounded-2xl transition-all active:scale-95 font-semibold text-xs"
            style={selectedMood === chip.label
              ? { backgroundColor: primary, color: 'white', boxShadow: `0 6px 20px ${primary}40` }
              : { backgroundColor: surfaceColor, color: textColor, border: '1px solid rgba(0,0,0,0.1)' }}>
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-6">
        <input type="text" value={customText} onChange={e => setCustomText(e.target.value)}
          placeholder="Or describe what you feel like…"
          onKeyDown={e => { if (e.key === 'Enter' && customText.trim()) { setSelectedMood(''); suggest(customText); } }}
          className="flex-1 px-4 py-3.5 rounded-2xl font-medium focus:outline-none text-sm"
          style={{ backgroundColor: surfaceColor, border: '1px solid rgba(0,0,0,0.1)', color: textColor }} />
        <button onClick={() => { if (customText.trim()) { setSelectedMood(''); suggest(customText); } }}
          className="px-5 py-3.5 rounded-2xl font-bold text-white text-sm shrink-0 transition-all active:scale-95"
          style={{ backgroundColor: primary }}>Go</button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-3 h-3 rounded-full animate-bounce" style={{ backgroundColor: primary, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-sm font-medium" style={{ color: textColor, opacity: 0.5 }}>Finding the perfect dishes…</p>
        </div>
      )}

      {!loading && suggestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: textColor, opacity: 0.4 }}>Suggested for you</p>
          {suggestions.map(item => {
            const qty = getQty(item.id);
            const img = resolveImg(item);
            const emoji = resolveEmoji(item);
            return (
              <div key={item.id} className="rounded-2xl overflow-hidden"
                style={{ ...glass(surfaceColor, '88'), border: `1.5px solid ${primary}50`, boxShadow: `0 4px 20px ${primary}25, inset 0 1px 0 rgba(255,255,255,0.22)` }}>
                {img && <img src={img} alt={item.name} className="w-full h-36 object-cover" loading="lazy" />}
                {!img && emoji && <div className="w-full h-24 flex items-center justify-center text-6xl" style={{ backgroundColor: `${primary}10` }}>{emoji}</div>}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <VegBadge isVeg={item.is_veg} size="sm" />
                        <h3 className="font-bold text-sm" style={{ color: textColor }}>{item.name}</h3>
                      </div>
                      <p className="text-xs italic leading-relaxed" style={{ color: primary, opacity: 0.85 }}>{item.reason}</p>
                    </div>
                    <span className="font-black text-base shrink-0" style={{ color: secondary }}>₹{item.price}</span>
                  </div>
                  <div className="flex justify-end mt-3">
                    {qty === 0 ? (
                      <button onClick={() => addToCart(item)}
                        className="px-5 py-2 rounded-xl font-black text-sm border-2 transition-all active:scale-95"
                        style={{ borderColor: primary, color: primary }}>ADD</button>
                    ) : (
                      <div className="flex items-center rounded-xl overflow-hidden shadow" style={{ backgroundColor: primary }}>
                        <button onClick={() => removeFromCart(item.id)} className="w-9 h-9 flex items-center justify-center text-white font-bold text-lg">−</button>
                        <span className="w-8 text-center text-white font-black">{qty}</span>
                        <button onClick={() => addToCart(item)} className="w-9 h-9 flex items-center justify-center text-white font-bold text-lg">+</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && tried && suggestions.length === 0 && (
        <div className="text-center py-10">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-25" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <p className="font-bold" style={{ color: textColor }}>No matches found</p>
          <p className="text-sm mt-1" style={{ color: textColor, opacity: 0.45 }}>Try another mood or browse the full menu</p>
        </div>
      )}
      {!loading && !tried && (
        <div className="text-center py-10">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-25" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
          <p className="font-medium text-sm" style={{ color: textColor, opacity: 0.45 }}>Select a mood above or type your craving</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════ CART TAB ════════════════════════════════════
function CartTab({ cart, outletId, identity, onUpdateQuantity, allItems, addToCart, colors, isMobile }: {
  cart: CartItem[]; outletId: string; identity: Identity | null;
  onUpdateQuantity: (id: string, delta: number) => void;
  allItems: MenuItem[]; addToCart: (item: MenuItem) => void;
  colors: Record<string, string>; isMobile: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(identity?.name || '');
  const [phone, setPhone] = useState(identity?.phone || '');
  const [orderType, setOrderType] = useState('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(identity?.whatsappOptIn ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState<{ token: string; orderNumber: string } | null>(null);

  const primary = colors.primary || '#1A1A1A';
  const secondary = colors.secondary || primary;
  const textColor = colors.textColor || '#1A1A1A';
  const surfaceColor = colors.surfaceColor || '#FFFFFF';

  // Upsell: items from categories not already in cart
  const cartCategories = new Set(cart.map(c => c.category));
  const upsellItems = allItems
    .filter(i => i.available && !cartCategories.has(i.category) && !cart.find(c => c.id === i.id))
    .sort((a, b) => (b.order_count ?? 0) - (a.order_count ?? 0))
    .slice(0, 5);

  const totalPrice = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const tax = totalPrice * 0.05;
  const grandTotal = totalPrice + tax;

  // Success splash auto-redirect
  useEffect(() => {
    if (!orderSuccess) return;
    const t = setTimeout(() => { router.push(`/order/${orderSuccess.token}`); }, 1800);
    return () => clearTimeout(t);
  }, [orderSuccess, router]);

  const cardStyle: React.CSSProperties = {
    backgroundColor: `${surfaceColor}88`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: 20,
    boxShadow: '0 4px 24px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.20)',
  };
  const inputStyle: React.CSSProperties = {
    backgroundColor: 'rgba(0,0,0,0.04)',
    border: '1.5px solid rgba(0,0,0,0.10)',
    color: textColor,
  };

  const handleOrder = async () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!phone.trim()) { setError('Please enter your phone'); return; }
    if (cart.length === 0) { setError('Your cart is empty'); return; }
    setError('');
    setSubmitting(true);
    const noteParts: string[] = [];
    if (orderType === 'dine_in' && tableNumber.trim()) noteParts.push(`Table: ${tableNumber.trim()}`);
    if (orderNote.trim()) noteParts.push(orderNote.trim());
    const notes = noteParts.length > 0 ? noteParts.join('\n') : undefined;
    try {
      const res = await fetch(`${BACKEND_URL}/api/public/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          customer_name: name,
          contact_number: phone,
          order_type: orderType,
          whatsapp_opt_in: whatsappOptIn,
          notes,
          items: cart.map(c => ({ itemId: c.id, name: c.name, quantity: c.quantity, price: c.price, specialInstructions: c.specialInstructions })),
        }),
      });
      if (!res.ok) throw new Error('Order failed');
      const data = await res.json();
      sessionStorage.removeItem(`cart_${outletId}`);
      setOrderSuccess({ token: data.confirmation_token, orderNumber: data.order_number });
    } catch {
      setError('Failed to place order. Please try again.');
      setSubmitting(false);
    }
  };

  // ── Success splash ────────────────────────────────────────────────────────
  if (orderSuccess) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center"
        style={{ backgroundColor: surfaceColor }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 glass-float"
          style={{ background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35) 0%, transparent 55%), linear-gradient(135deg, ${primary}EE, ${primary}AA)`, boxShadow: `0 12px 48px ${primary}55, inset 0 1px 0 rgba(255,255,255,0.38)` }}>
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-black mb-2" style={{ color: textColor }}>Order Placed!</h2>
        <p className="text-sm font-medium mb-1" style={{ color: textColor, opacity: 0.55 }}>{orderSuccess.orderNumber}</p>
        <p className="text-xs" style={{ color: textColor, opacity: 0.35 }}>Taking you to order tracking…</p>
        <div className="flex gap-1.5 mt-8">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: primary, animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-32 text-center">
        <svg className="w-14 h-14 mb-4 opacity-25" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
        <h2 className="text-xl font-bold mb-2" style={{ color: textColor }}>Your cart is empty</h2>
        <p className="text-sm" style={{ color: textColor, opacity: 0.45 }}>Add delicious items from the menu or let AI suggest something!</p>
      </div>
    );
  }

  return (
    <div className={isMobile ? 'flex-1 overflow-y-auto px-4 pt-4 space-y-4' : 'w-full px-4 pt-4 space-y-4'} style={{ paddingBottom: isMobile ? 'calc(max(12px, env(safe-area-inset-bottom)) + 140px)' : '120px' }}>
      <h2 className="text-xl font-black" style={{ color: textColor }}>Your Order</h2>

      {/* Cart items */}
      <div style={cardStyle}>
        {cart.map((item, idx) => (
          <div key={item.id} className="p-4 flex items-center gap-3"
            style={{ borderBottom: idx < cart.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none' }}>
            <VegBadge isVeg={item.is_veg} size="sm" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm truncate" style={{ color: textColor }}>{item.name}</h3>
              {item.specialInstructions && (
                <p className="text-[11px] truncate mt-0.5 italic" style={{ color: textColor, opacity: 0.5 }}>{item.specialInstructions}</p>
              )}
              <p className="text-sm font-medium mt-0.5" style={{ color: secondary }}>₹{item.price}</p>
            </div>
            <div className="flex items-center rounded-xl overflow-hidden" style={{ backgroundColor: primary }}>
              <button onClick={() => onUpdateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-white text-lg font-bold hover:bg-black/15">−</button>
              <span className="w-8 text-center text-white font-black text-sm">{item.quantity}</span>
              <button onClick={() => onUpdateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-white text-lg font-bold hover:bg-black/15">+</button>
            </div>
            <span className="font-bold text-sm w-14 text-right" style={{ color: textColor }}>₹{(item.price * item.quantity).toFixed(0)}</span>
          </div>
        ))}
      </div>

      {/* Bill details */}
      <div className="p-5 space-y-2" style={cardStyle}>
        <h3 className="font-bold text-xs uppercase tracking-wider mb-3" style={{ color: textColor, opacity: 0.45 }}>Bill Details</h3>
        <div className="flex justify-between text-sm" style={{ color: textColor }}>
          <span style={{ opacity: 0.65 }}>Item Total</span><span className="font-medium">₹{totalPrice.toFixed(0)}</span>
        </div>
        <div className="flex justify-between text-sm" style={{ color: textColor }}>
          <span style={{ opacity: 0.65 }}>Taxes & Charges (5%)</span><span className="font-medium">₹{tax.toFixed(0)}</span>
        </div>
        <div className="pt-3 mt-1 flex justify-between font-black text-base"
          style={{ borderTop: '1px solid rgba(0,0,0,0.08)', color: textColor }}>
          <span>Grand Total</span>
          <span style={{ color: secondary }}>₹{grandTotal.toFixed(0)}</span>
        </div>
      </div>

      {/* Complete your meal — upsell strip */}
      {upsellItems.length > 0 && (
        <div style={cardStyle}>
          <div className="px-4 py-3.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <h3 className="font-bold text-xs uppercase tracking-wider" style={{ color: textColor, opacity: 0.45 }}>Complete Your Meal</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 py-3.5 pb-4" style={{ scrollbarWidth: 'none' }}>
            {upsellItems.map(item => {
              const img = resolveImg(item);
              return (
                <div key={item.id} className="shrink-0 flex items-center gap-2.5 p-2.5 rounded-2xl min-w-[200px]"
                  style={{ border: '1px solid rgba(0,0,0,0.08)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                  {img ? (
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                      <img src={img} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 opacity-20"
                      style={{ backgroundColor: `${primary}18` }}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 1.567-3 3.5V20m3-12c1.657 0 3 1.567 3 3.5V20M9 20h6M5 8a7 7 0 0114 0" /></svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs truncate" style={{ color: textColor }}>{item.name}</p>
                    <p className="text-xs font-black mt-0.5" style={{ color: secondary }}>₹{item.price}</p>
                  </div>
                  <button onClick={() => addToCart(item)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm border-2 shrink-0 transition-all active:scale-95"
                    style={{ borderColor: primary, color: primary }}>+</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Order type */}
      <div className="p-5" style={cardStyle}>
        <h3 className="font-bold text-xs uppercase tracking-wider mb-3" style={{ color: textColor, opacity: 0.45 }}>Order Type</h3>
        <div className="grid grid-cols-2 gap-3">
          {[{ key: 'dine_in', label: 'Dine-In', desc: 'Eat at the table' }, { key: 'takeaway', label: 'Takeaway', desc: 'Collect & go' }].map(t => (
            <button key={t.key} onClick={() => setOrderType(t.key)}
              className="p-4 rounded-xl text-left transition-all active:scale-[0.98]"
              style={orderType === t.key
                ? { backgroundColor: `${primary}15`, border: `2px solid ${primary}`, boxShadow: `0 4px 16px ${primary}20` }
                : { backgroundColor: 'rgba(0,0,0,0.03)', border: '2px solid rgba(0,0,0,0.08)' }}>
              <div className="font-bold text-sm" style={{ color: orderType === t.key ? primary : textColor }}>{t.label}</div>
              <div className="text-xs mt-1" style={{ color: textColor, opacity: 0.45 }}>{t.desc}</div>
            </button>
          ))}
        </div>
        {orderType === 'dine_in' && (
          <div className="mt-3">
            <label className="block text-xs font-bold mb-1.5" style={{ color: textColor, opacity: 0.55 }}>
              Table Number <span style={{ fontWeight: 400, opacity: 0.45 }}>(optional)</span>
            </label>
            <input type="text" value={tableNumber} onChange={e => setTableNumber(e.target.value)}
              placeholder="e.g. 7" inputMode="numeric"
              className="w-full px-4 py-3 rounded-xl font-medium focus:outline-none text-sm"
              style={inputStyle} />
          </div>
        )}
      </div>

      {/* Customer details */}
      <div className="p-5 space-y-4" style={cardStyle}>
        <h3 className="font-bold text-xs uppercase tracking-wider" style={{ color: textColor, opacity: 0.45 }}>Your Details</h3>
        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: textColor, opacity: 0.55 }}>Full Name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
            className="w-full px-4 py-3.5 rounded-xl font-medium focus:outline-none text-sm"
            style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: textColor, opacity: 0.55 }}>Phone Number *</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" inputMode="tel"
            className="w-full px-4 py-3.5 rounded-xl font-medium focus:outline-none text-sm"
            style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: textColor, opacity: 0.55 }}>
            Kitchen Note <span style={{ fontWeight: 400, opacity: 0.45 }}>(optional)</span>
          </label>
          <textarea value={orderNote} onChange={e => setOrderNote(e.target.value)}
            placeholder="Any instructions for the entire order…"
            rows={2}
            className="w-full px-4 py-3 rounded-xl font-medium focus:outline-none text-sm resize-none"
            style={{ ...inputStyle, display: 'block' }} />
        </div>
      </div>

      {/* WhatsApp opt-in */}
      <div className="p-5" style={cardStyle}>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button type="button" onClick={() => setWhatsappOptIn(!whatsappOptIn)}
            className={`relative w-11 h-6 rounded-full transition-all duration-300 shrink-0 ${whatsappOptIn ? 'bg-green-500' : 'bg-gray-300'}`}>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${whatsappOptIn ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
          <div>
            <span className="text-sm font-semibold block" style={{ color: textColor }}>Get updates on WhatsApp</span>
            <span className="text-[11px]" style={{ color: textColor, opacity: 0.45 }}>Order status & receipt</span>
          </div>
        </label>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
          {error}
        </div>
      )}

      <button onClick={handleOrder} disabled={submitting}
        className="w-full py-5 rounded-2xl text-white font-black text-lg transition-all active:scale-[0.99] disabled:opacity-50"
        style={{ backgroundColor: primary, boxShadow: `0 8px 32px ${primary}40` }}>
        {submitting ? (
          <span className="flex items-center justify-center gap-3">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Placing Order…
          </span>
        ) : `Place Order · ₹${grandTotal.toFixed(0)}`}
      </button>

      <p className="text-center text-xs pb-4" style={{ color: textColor, opacity: 0.28 }}>By placing this order, you agree to pay at the restaurant</p>
    </div>
  );
}

// ═══════════════════════════ MAIN COMPONENT ═══════════════════════════════════
export default function MenuClient({ outletId, outlet, company, categories, category_info, items }: {
  outletId: string; outlet: any; company: any;
  categories: Record<string, MenuItem[]>; category_info?: CategoryInfo[]; items: MenuItem[];
}) {
  const isMobile = useIsMobile();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [showGate, setShowGate] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('menu');
  const [cart, setCart] = useState<CartItem[]>([]);

  const colors = outlet?.portal_color_scheme || {};
  const primary = colors.primary || '#1A1A1A';
  const secondary = colors.secondary || primary;
  const bgColor = colors.bgColor || '#FAFAFA';
  const surfaceColor = colors.surfaceColor || '#FFFFFF';
  const textColor = colors.textColor || '#1A1A1A';
  const fontFamily = colors.fontFamily || 'Inter';
  const menuLayout = colors.menuLayout || 'classic';
  const requireIdentity = colors.requireIdentity !== false;
  const logoUrl = outlet?.portal_logo_url || null;
  const restaurantName = company?.name || 'Restaurant';
  const outletLocation = outlet?.location || '';

  useEffect(() => {
    const storedId = sessionStorage.getItem(`customer_${outletId}`);
    if (storedId) {
      try { setIdentity(JSON.parse(storedId)); } catch { }
    } else if (requireIdentity) {
      setShowGate(true);
    }
    const storedCart = sessionStorage.getItem(`cart_${outletId}`);
    if (storedCart) { try { setCart(JSON.parse(storedCart)); } catch { } }
  }, [outletId]);

  useEffect(() => {
    sessionStorage.setItem(`cart_${outletId}`, JSON.stringify(cart));
  }, [cart, outletId]);

  const handleIdentitySubmit = (id: Identity) => {
    setIdentity(id);
    sessionStorage.setItem(`customer_${outletId}`, JSON.stringify(id));
    setShowGate(false);
  };

  const addToCart = (item: MenuItem, instructions?: string) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id);
      return ex ? prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
        : [...prev, { ...item, quantity: 1, specialInstructions: instructions }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === itemId);
      if (!ex) return prev;
      return ex.quantity <= 1 ? prev.filter(c => c.id !== itemId)
        : prev.map(c => c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c);
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(c => c.id === itemId ? { ...c, quantity: c.quantity + delta } : c).filter(c => c.quantity > 0));
  };

  const getQty = (itemId: string) => cart.find(c => c.id === itemId)?.quantity || 0;
  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);

  if (showGate) {
    return (
      <IdentityGate
        onSubmit={handleIdentitySubmit}
        canSkip={!requireIdentity}
        colors={colors}
        logoUrl={logoUrl}
        restaurantName={restaurantName}
        outletLocation={outletLocation}
      />
    );
  }

  const shellClass = isMobile
    ? 'fixed inset-0 flex flex-col'
    : 'min-h-screen flex flex-col';

  const contentClass = isMobile
    ? 'flex-1 flex flex-col overflow-hidden w-full max-w-sm mx-auto'
    : 'w-full max-w-sm mx-auto flex flex-col';

  return (
    <div className={shellClass} style={{ fontFamily: `${fontFamily}, system-ui, sans-serif`, backgroundColor: bgColor }}>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700;900&display=swap');` }} />
      <BgBlobs primary={primary} secondary={secondary} bg={bgColor} />

      <div className={contentClass}>
        {activeTab === 'menu' && (
          <MenuTab
            outlet={outlet} company={company}
            categories={categories} category_info={category_info} allItems={items}
            getQty={getQty} addToCart={addToCart} removeFromCart={removeFromCart}
            colors={colors} menuLayout={menuLayout} isMobile={isMobile}
          />
        )}
        {activeTab === 'ai' && (
          <AITab
            outletId={outletId} allItems={items} getQty={getQty}
            addToCart={addToCart} removeFromCart={removeFromCart} colors={colors} isMobile={isMobile}
          />
        )}
        {activeTab === 'cart' && (
          <CartTab
            cart={cart} outletId={outletId} identity={identity}
            onUpdateQuantity={updateQuantity}
            allItems={items} addToCart={addToCart}
            colors={colors} isMobile={isMobile}
          />
        )}
      </div>

      {activeTab !== 'cart' && (
        <FloatingCartPill
          cart={cart} primary={primary} surface={surfaceColor} text={textColor}
          onViewCart={() => setActiveTab('cart')}
        />
      )}

      <BottomNav
        activeTab={activeTab} onTabChange={setActiveTab}
        cartCount={totalItems} primary={primary} surface={surfaceColor} text={textColor}
      />
    </div>
  );
}
