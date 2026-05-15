'use client';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  category_name?: string | null;
  image_url?: string | null;
}
interface SlotConfig {
  slot_duration?: number;
  open_time?: string;
  close_time?: string;
}
interface Outlet {
  id: string;
  name: string;
  location?: string | null;
  portal_logo_url?: string | null;
  portal_color_scheme?: Record<string, string> | null;
  opening_hours?: string | null;
}
interface Company {
  name: string;
  logo_url?: string | null;
}
interface Identity {
  name: string;
  phone: string;
}
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolEvent[];
  imageUrl?: string;
  isStreaming?: boolean;
}
interface ToolEvent {
  id: string;
  name: string;
  args: any;
  result?: any;
  status: 'running' | 'done' | 'error';
}

type Tab = 'book' | 'ai' | 'mybookings';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (/makeup|bridal/.test(n)) return 'Makeup & Bridal';
  if (/manicure|pedicure|nail/.test(n)) return 'Nails';
  if (/facial|clean.?up|hydra/.test(n)) return 'Skincare';
  if (/colour|color|highlight|balayage|root touch/.test(n)) return 'Hair Color';
  if (/keratin|smoothen|hair spa/.test(n)) return 'Hair Treatments';
  return 'Hair Services';
}
const CATEGORY_ORDER = ['Hair Services', 'Hair Color', 'Hair Treatments', 'Skincare', 'Nails', 'Makeup & Bridal'];

const glass = (color: string, opacity = 'CC', blur = '16px'): React.CSSProperties => ({
  backgroundColor: `${color}${opacity}`,
  backdropFilter: `blur(${blur}) saturate(180%)`,
  WebkitBackdropFilter: `blur(${blur}) saturate(180%)`,
});

function hexLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function blobColor(color: string, isDarkBg: boolean): string {
  if (isDarkBg) return color;
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
    if (sat < 0.25) return '#F59E0B';
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
        @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0 } }
        .cursor-blink { animation: blink 1s step-end infinite; display:inline-block; width:2px; height:1em; background:currentColor; margin-left:2px; vertical-align:text-bottom; }
      `}} />
      <div className="absolute -top-1/4 -right-1/4 rounded-full pointer-events-none glass-breath"
        style={{ width: '80vw', height: '80vw', background: blob1, filter: 'blur(80px)', opacity: isDark ? 1 : 0.45 }} />
      <div className="absolute top-1/3 -left-1/4 rounded-full pointer-events-none"
        style={{ width: '65vw', height: '65vw', background: blob2, opacity: isDark ? 0.55 : 0.35, filter: 'blur(70px)' }} />
      <div className="absolute bottom-0 left-1/3 rounded-full pointer-events-none"
        style={{ width: '50vw', height: '50vw', background: blob1, opacity: isDark ? 0.40 : 0.25, filter: 'blur(60px)' }} />
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.045, pointerEvents: 'none' }}>
        <filter id="booking-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#booking-grain)" />
      </svg>
    </div>
  );
};

// ─── Inline markdown renderer ─────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;
    while (remaining.length > 0) {
      const boldIdx = remaining.indexOf('**');
      if (boldIdx === -1) {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
      if (boldIdx > 0) parts.push(<span key={key++}>{remaining.slice(0, boldIdx)}</span>);
      const endBold = remaining.indexOf('**', boldIdx + 2);
      if (endBold === -1) {
        parts.push(<span key={key++}>{remaining.slice(boldIdx)}</span>);
        break;
      }
      parts.push(<strong key={key++}>{remaining.slice(boldIdx + 2, endBold)}</strong>);
      remaining = remaining.slice(endBold + 2);
    }
    return (
      <span key={i}>
        {parts}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    );
  });
}

function formatToolName(name: string): string {
  return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ─── Icons ────────────────────────────────────────────────────────────────────
const CalendarIcon = ({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const SparkleIcon = ({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
  </svg>
);

const ClockIcon = ({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ChevronLeftIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const SendIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const CameraIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const WrenchIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
  </svg>
);

const UserIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const PhoneIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 11 19.79 19.79 0 01.01 2.38 2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
  </svg>
);

const ChevronDownIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ─── Tool Call Card ────────────────────────────────────────────────────────────
function ToolCallCard({ tool, textColor, surfaceColor, primary }: {
  tool: ToolEvent; textColor: string; surfaceColor: string; primary: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const renderResult = () => {
    if (!tool.result) return null;
    if (tool.name === 'create_booking') {
      const r = tool.result;
      return (
        <div className="mt-2 rounded-xl p-3 space-y-1" style={{ backgroundColor: `${primary}15`, border: `1px solid ${primary}30` }}>
          <p className="text-xs font-black" style={{ color: primary }}>Booking Confirmed</p>
          {r.booking_id && <p className="text-xs" style={{ color: textColor, opacity: 0.7 }}>ID: {r.booking_id}</p>}
          {r.date && <p className="text-xs" style={{ color: textColor, opacity: 0.7 }}>Date: {r.date}</p>}
          {r.time && <p className="text-xs" style={{ color: textColor, opacity: 0.7 }}>Time: {r.time}</p>}
          {r.service_name && <p className="text-xs" style={{ color: textColor, opacity: 0.7 }}>Service: {r.service_name}</p>}
        </div>
      );
    }
    if (tool.name === 'get_available_slots') {
      const slots: string[] = Array.isArray(tool.result) ? tool.result : (tool.result?.slots || []);
      return (
        <div className="mt-2">
          <p className="text-xs" style={{ color: textColor, opacity: 0.6 }}>{slots.length} slots found</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {slots.slice(0, 6).map((s, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${primary}20`, color: primary }}>{s}</span>
            ))}
            {slots.length > 6 && <span className="text-xs opacity-50" style={{ color: textColor }}>+{slots.length - 6} more</span>}
          </div>
        </div>
      );
    }
    if (tool.name === 'suggest_hairstyles') {
      const styles: string[] = Array.isArray(tool.result) ? tool.result : (tool.result?.styles || []);
      return (
        <div className="flex flex-wrap gap-1 mt-2">
          {styles.map((s, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${primary}20`, color: primary }}>{s}</span>
          ))}
        </div>
      );
    }
    return (
      <pre className="text-xs mt-2 overflow-auto max-h-32 rounded-lg p-2" style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: textColor, opacity: 0.7 }}>
        {JSON.stringify(tool.result, null, 2)}
      </pre>
    );
  };

  return (
    <div className="mt-1.5 rounded-xl overflow-hidden" style={{ backgroundColor: `${surfaceColor}60`, border: '1px solid rgba(0,0,0,0.07)' }}>
      <button className="w-full flex items-center gap-2 px-3 py-2 text-left" onClick={() => setExpanded(e => !e)}>
        <span className="shrink-0" style={{ color: primary }}><WrenchIcon size={14} /></span>
        <span className="text-xs font-semibold flex-1 truncate" style={{ color: textColor, opacity: 0.75 }}>
          {tool.status === 'running' ? `Running: ${formatToolName(tool.name)}` : formatToolName(tool.name)}
        </span>
        {tool.status === 'running' && (
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: primary, opacity: 0.6, animation: 'blink 1s step-end infinite' }} />
        )}
        {tool.status === 'done' && (
          <span style={{ color: primary, opacity: 0.6 }}><CheckIcon size={13} /></span>
        )}
        <span style={{ color: textColor, opacity: 0.4, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>
          <ChevronDownIcon size={13} />
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          {tool.args && Object.keys(tool.args).length > 0 && (
            <div className="mb-1">
              <p className="text-xs font-bold mb-1" style={{ color: textColor, opacity: 0.45 }}>Args</p>
              <pre className="text-xs overflow-auto max-h-20 rounded-lg p-2" style={{ backgroundColor: 'rgba(0,0,0,0.06)', color: textColor, opacity: 0.65 }}>
                {JSON.stringify(tool.args, null, 2)}
              </pre>
            </div>
          )}
          {renderResult()}
        </div>
      )}
    </div>
  );
}

// ─── BookTab ──────────────────────────────────────────────────────────────────
function BookTab({ outletId, services, colors, isMobile, onSwitchToAI }: {
  outletId: string;
  services: Service[];
  colors: Record<string, string>;
  isMobile: boolean;
  onSwitchToAI: () => void;
}) {
  const primary = colors.primary || '#1A1A1A';
  const textColor = colors.textColor || '#1A1A1A';
  const surfaceColor = colors.surfaceColor || '#FFFFFF';

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [serviceImages, setServiceImages] = useState<Record<string, string>>({});
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState<{ value: string; label: string }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);

  const totalDuration = useMemo(() => selectedServices.reduce((s, svc) => s + svc.duration, 0), [selectedServices]);
  const totalAmount = useMemo(() => selectedServices.reduce((s, svc) => s + svc.price, 0), [selectedServices]);
  const toggleService = (svc: Service) =>
    setSelectedServices(prev => prev.some(s => s.id === svc.id) ? prev.filter(s => s.id !== svc.id) : [...prev, svc]);
  const isSelected = (svc: Service) => selectedServices.some(s => s.id === svc.id);

  const categories = useMemo(() => {
    const cats = new Set(services.map(s => s.category_name || inferCategory(s.name)));
    return ['All', ...CATEGORY_ORDER.filter(c => cats.has(c)), ...Array.from(cats).filter(c => !CATEGORY_ORDER.includes(c))];
  }, [services]);

  const filteredServices = useMemo(() =>
    activeCategoryTab === 'All' ? services : services.filter(s => (s.category_name || inferCategory(s.name)) === activeCategoryTab),
    [services, activeCategoryTab]);

  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    if (step !== 1 || services.length === 0) return;
    services.forEach(svc => {
      if (serviceImages[svc.id]) return;
      fetch(`${BACKEND_URL}/api/public/booking-portal/service-image?service_name=${encodeURIComponent(svc.name)}`)
        .then(r => r.json())
        .then(data => { if (data.url) setServiceImages(prev => ({ ...prev, [svc.id]: data.url })); })
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, services.length]);

  useEffect(() => {
    if (step === 3 && selectedDate && selectedServices.length > 0) {
      setSlotsLoading(true);
      fetch(`${BACKEND_URL}/api/public/available-slots/${outletId}?date=${selectedDate}&duration=${totalDuration}`)
        .then(r => r.json())
        .then(data => {
          const list: { value: string; label: string }[] = Array.isArray(data)
            ? data.map((s: unknown) => typeof s === 'string' ? { value: s, label: s } : s as { value: string; label: string })
            : (data.slots || []);
          setSlots(list);
        })
        .catch(() => setSlots([]))
        .finally(() => setSlotsLoading(false));
    }
  }, [step, selectedDate, totalDuration, outletId]);

  const handleConfirm = async (identity: Identity) => {
    setBooking(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/public/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          date: selectedDate,
          time: selectedTime,
          service_id: selectedServices[0]?.id,
          service_ids: selectedServices.map(s => s.id),
          customer_name: identity.name,
          customer_phone: identity.phone,
          notes,
          total_duration: totalDuration,
          total_amount: totalAmount,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBookingResult(data);
      } else {
        setBookingResult({ error: data.detail || 'Booking failed. Please try again.' });
      }
    } catch {
      setBookingResult({ error: 'Network error. Please try again.' });
    } finally {
      setBooking(false);
    }
  };

  const resetBooking = () => {
    setStep(1);
    setSelectedServices([]);
    setSelectedDate('');
    setSelectedTime('');
    setNotes('');
    setSlots([]);
    setBookingResult(null);
  };

  const containerStyle: React.CSSProperties = isMobile
    ? { flex: 1, overflowY: 'auto', paddingBottom: 'calc(max(12px, env(safe-area-inset-bottom)) + 80px)' }
    : { paddingBottom: 'calc(max(12px, env(safe-area-inset-bottom)) + 80px)' };

  const cardStyle: React.CSSProperties = {
    ...glass(surfaceColor, 'CC', '20px'),
    border: '1px solid rgba(255,255,255,0.28)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.30)',
  };

  const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const calDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calDays.push(d);

  const dateStr = (d: number) => {
    const mm = String(calMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${calYear}-${mm}-${dd}`;
  };

  const isPast = (d: number) => new Date(calYear, calMonth, d) < today;

  if (bookingResult && !bookingResult.error) {
    return (
      <div style={containerStyle} className="px-4 pt-6 w-full max-w-sm mx-auto">
        <div className="rounded-3xl p-6 text-center space-y-4" style={cardStyle}>
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${primary}20` }}>
            <CheckIcon size={28} />
          </div>
          <h2 className="text-xl font-black" style={{ color: textColor }}>Booking Confirmed!</h2>
          <div className="rounded-2xl p-4 space-y-2 text-left" style={{ backgroundColor: `${primary}10` }}>
            {selectedServices.map(s => (
              <div key={s.id} className="flex justify-between">
                <p className="text-sm font-bold" style={{ color: textColor }}>{s.name}</p>
                <p className="text-sm font-bold" style={{ color: primary }}>₹{s.price.toLocaleString('en-IN')}</p>
              </div>
            ))}
            <div className="h-px my-1" style={{ backgroundColor: `${primary}20` }} />
            {selectedDate && <p className="text-sm" style={{ color: textColor, opacity: 0.65 }}>{selectedDate} · {selectedTime}</p>}
            <p className="text-sm" style={{ color: textColor, opacity: 0.65 }}>{totalDuration} min · ₹{totalAmount.toLocaleString('en-IN')}</p>
            {bookingResult.booking_id && (
              <p className="text-xs font-mono" style={{ color: textColor, opacity: 0.45 }}>Ref: {bookingResult.booking_id}</p>
            )}
          </div>
          <button onClick={resetBooking}
            className="w-full py-3.5 rounded-2xl text-white font-black text-base transition-all active:scale-[0.98]"
            style={{ backgroundColor: primary, boxShadow: `0 6px 20px ${primary}40` }}>
            Book Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle} className="px-4 pt-5 space-y-5 w-full max-w-sm mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {([1, 2, 3, 4] as const).map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all"
              style={{
                backgroundColor: step >= s ? primary : 'rgba(0,0,0,0.08)',
                color: step >= s ? 'white' : `${textColor}60`,
              }}>
              {s}
            </div>
            {s < 4 && <div className="w-8 h-0.5" style={{ backgroundColor: step > s ? primary : 'rgba(0,0,0,0.10)' }} />}
          </div>
        ))}
      </div>

      {/* Step 1: Category Tabs + Service Grid */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-black" style={{ color: textColor }}>Choose Services</h2>

          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveCategoryTab(cat)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95"
                style={{
                  backgroundColor: activeCategoryTab === cat ? primary : `${surfaceColor}88`,
                  color: activeCategoryTab === cat ? '#fff' : textColor,
                  border: `1.5px solid ${activeCategoryTab === cat ? primary : 'rgba(255,255,255,0.18)'}`,
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}>
                {cat}
              </button>
            ))}
          </div>

          {/* Service cards */}
          <div className="grid grid-cols-2 gap-3">
            {filteredServices.map(svc => {
              const selected = isSelected(svc);
              const imgUrl = serviceImages[svc.id];
              return (
                <button key={svc.id} onClick={() => toggleService(svc)}
                  className="rounded-2xl text-left transition-all active:scale-[0.97] overflow-hidden relative"
                  style={{
                    ...glass(surfaceColor, selected ? 'EE' : 'AA', '16px'),
                    border: `2px solid ${selected ? primary : 'rgba(255,255,255,0.22)'}`,
                    boxShadow: selected ? `0 4px 20px ${primary}35` : '0 2px 8px rgba(0,0,0,0.06)',
                  }}>
                  {/* Image area */}
                  <div className="w-full relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
                    {imgUrl ? (
                      <img src={imgUrl} alt={svc.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full animate-pulse" style={{ backgroundColor: `${primary}18` }} />
                    )}
                    {selected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-md"
                        style={{ backgroundColor: primary, color: '#fff' }}>
                        <CheckIcon size={11} />
                      </div>
                    )}
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.45) 100%)' }} />
                  </div>
                  {/* Content */}
                  <div className="p-3">
                    <p className="text-sm font-black leading-tight" style={{ color: textColor }}>{svc.name}</p>
                    {svc.description && (
                      <p className="text-xs mt-0.5 leading-snug line-clamp-1" style={{ color: textColor, opacity: 0.5 }}>{svc.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${primary}15`, color: primary }}>
                        {svc.duration}min
                      </span>
                      <span className="text-sm font-black" style={{ color: primary }}>₹{svc.price.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Sticky continue bar */}
          {selectedServices.length > 0 && (
            <div className="sticky bottom-0 pt-2 pb-1">
              <button onClick={() => setStep(2)}
                className="w-full py-3.5 rounded-2xl text-white font-black text-sm transition-all active:scale-[0.98]"
                style={{ backgroundColor: primary, boxShadow: `0 6px 24px ${primary}50` }}>
                {selectedServices.length === 1 ? '1 service' : `${selectedServices.length} services`}
                {' · '}{totalDuration}min{' · '}₹{totalAmount.toLocaleString('en-IN')}{' · '}Continue →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Date Picker */}
      {step === 2 && (
        <div className="space-y-3">
          <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm font-bold" style={{ color: primary }}>
            <ChevronLeftIcon size={16} /> Back
          </button>
          <h2 className="text-lg font-black" style={{ color: textColor }}>Pick a Date</h2>
          <div className="rounded-3xl p-4 space-y-3" style={cardStyle}>
            <div className="flex items-center justify-between">
              <button onClick={() => {
                if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                else setCalMonth(m => m - 1);
              }} className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
                <ChevronLeftIcon size={16} />
              </button>
              <span className="font-black text-base" style={{ color: textColor }}>{MONTHS[calMonth]} {calYear}</span>
              <button onClick={() => {
                if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                else setCalMonth(m => m + 1);
              }} className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95"
                style={{ backgroundColor: 'rgba(0,0,0,0.06)' }}>
                <ChevronRightIcon size={16} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs font-bold py-1" style={{ color: textColor, opacity: 0.4 }}>{d}</div>
              ))}
              {calDays.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} />;
                const ds = dateStr(d);
                const past = isPast(d);
                const selected = selectedDate === ds;
                return (
                  <button key={ds} disabled={past} onClick={() => setSelectedDate(ds)}
                    className="aspect-square rounded-full flex items-center justify-center text-sm font-bold transition-all active:scale-95"
                    style={{
                      backgroundColor: selected ? primary : 'transparent',
                      color: past ? `${textColor}30` : selected ? 'white' : textColor,
                      cursor: past ? 'default' : 'pointer',
                    }}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          {selectedDate && (
            <button onClick={() => setStep(3)}
              className="w-full py-3.5 rounded-2xl text-white font-black text-base transition-all active:scale-[0.98]"
              style={{ backgroundColor: primary, boxShadow: `0 6px 20px ${primary}40` }}>
              Continue
            </button>
          )}
        </div>
      )}

      {/* Step 3: Time Slot Selection */}
      {step === 3 && (
        <div className="space-y-3">
          <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm font-bold" style={{ color: primary }}>
            <ChevronLeftIcon size={16} /> Back
          </button>
          <h2 className="text-lg font-black" style={{ color: textColor }}>Pick a Time</h2>
          <p className="text-sm" style={{ color: textColor, opacity: 0.55 }}>{selectedDate}</p>
          {slotsLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-10 rounded-xl animate-pulse" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }} />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="rounded-2xl p-6 text-center" style={cardStyle}>
              <p className="text-sm font-bold" style={{ color: textColor }}>No slots available</p>
              <p className="text-xs mt-1" style={{ color: textColor, opacity: 0.5 }}>Try a different date</p>
              <button onClick={() => setStep(2)} className="mt-4 text-sm font-black" style={{ color: primary }}>
                Change Date
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map(slot => (
                <button key={slot.value} onClick={() => setSelectedTime(slot.value)}
                  className="h-10 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{
                    backgroundColor: selectedTime === slot.value ? primary : `${surfaceColor}CC`,
                    color: selectedTime === slot.value ? 'white' : textColor,
                    border: `1.5px solid ${selectedTime === slot.value ? primary : 'rgba(255,255,255,0.25)'}`,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                  }}>
                  {slot.label}
                </button>
              ))}
            </div>
          )}
          {selectedTime && (
            <button onClick={() => setStep(4)}
              className="w-full py-3.5 rounded-2xl text-white font-black text-base transition-all active:scale-[0.98]"
              style={{ backgroundColor: primary, boxShadow: `0 6px 20px ${primary}40` }}>
              Continue
            </button>
          )}
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 4 && (
        <ConfirmStep
          selectedServices={selectedServices}
          totalDuration={totalDuration}
          totalAmount={totalAmount}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          notes={notes}
          onNotesChange={setNotes}
          onBack={() => setStep(3)}
          onConfirm={handleConfirm}
          booking={booking}
          error={bookingResult?.error || null}
          colors={colors}
          cardStyle={cardStyle}
          outletId={outletId}
        />
      )}
    </div>
  );
}

// ─── ConfirmStep (reads identity from sessionStorage) ────────────────────────
function ConfirmStep({ selectedServices, totalDuration, totalAmount, selectedDate, selectedTime, notes, onNotesChange, onBack, onConfirm, booking, error, colors, cardStyle, outletId }: {
  selectedServices: Service[];
  totalDuration: number;
  totalAmount: number;
  selectedDate: string;
  selectedTime: string;
  notes: string;
  onNotesChange: (v: string) => void;
  onBack: () => void;
  onConfirm: (identity: Identity) => void;
  booking: boolean;
  error: string | null;
  colors: Record<string, string>;
  cardStyle: React.CSSProperties;
  outletId: string;
}) {
  const primary = colors.primary || '#1A1A1A';
  const textColor = colors.textColor || '#1A1A1A';

  const getIdentity = (): Identity | null => {
    try {
      const raw = sessionStorage.getItem(`booking_identity_${outletId}`);
      if (raw) return JSON.parse(raw);
    } catch { }
    return null;
  };

  const identity = getIdentity();

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-bold" style={{ color: primary }}>
        <ChevronLeftIcon size={16} /> Back
      </button>
      <h2 className="text-lg font-black" style={{ color: textColor }}>Confirm Booking</h2>
      <div className="rounded-2xl p-4 space-y-3" style={cardStyle}>
        {/* Service list */}
        {selectedServices.map((svc, i) => (
          <div key={svc.id}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-black" style={{ color: textColor }}>{svc.name}</p>
                <p className="text-xs mt-0.5" style={{ color: textColor, opacity: 0.5 }}>{svc.duration} min</p>
              </div>
              <span className="text-sm font-black" style={{ color: primary }}>₹{svc.price.toLocaleString('en-IN')}</span>
            </div>
            {i < selectedServices.length - 1 && (
              <div className="mt-3 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            )}
          </div>
        ))}
        <div className="h-px" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }} />
        <div className="flex justify-between">
          <span className="text-sm" style={{ color: textColor, opacity: 0.55 }}>Date & Time</span>
          <span className="text-sm font-bold" style={{ color: textColor }}>{selectedDate} · {selectedTime}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm" style={{ color: textColor, opacity: 0.55 }}>Total Duration</span>
          <span className="text-sm font-bold" style={{ color: textColor }}>{totalDuration} min</span>
        </div>
        <div className="h-px" style={{ backgroundColor: 'rgba(0,0,0,0.07)' }} />
        <div className="flex justify-between">
          <span className="text-sm font-black" style={{ color: textColor }}>Total</span>
          <span className="text-base font-black" style={{ color: primary }}>₹{totalAmount.toLocaleString('en-IN')}</span>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold mb-2 uppercase tracking-wide" style={{ color: textColor, opacity: 0.5 }}>
          Notes (optional)
        </label>
        <textarea value={notes} onChange={e => onNotesChange(e.target.value)}
          placeholder="Any special requests or notes..."
          rows={3}
          className="w-full px-4 py-3 rounded-2xl text-sm resize-none focus:outline-none"
          style={{ border: '1.5px solid rgba(0,0,0,0.10)', color: textColor, backgroundColor: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(10px)' }} />
      </div>
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ backgroundColor: 'rgba(220,38,38,0.10)', color: '#DC2626' }}>
          {error}
        </div>
      )}
      <button
        onClick={() => identity && onConfirm(identity)}
        disabled={booking || !identity}
        className="w-full py-3.5 rounded-2xl text-white font-black text-base transition-all active:scale-[0.98] disabled:opacity-50"
        style={{ backgroundColor: primary, boxShadow: `0 6px 20px ${primary}40` }}>
        {booking ? 'Confirming...' : 'Confirm Booking'}
      </button>
    </div>
  );
}

// ─── AITab ────────────────────────────────────────────────────────────────────
function AITab({ outletId, outlet, colors, isMobile }: {
  outletId: string;
  outlet: Outlet;
  colors: Record<string, string>;
  isMobile: boolean;
  identity: Identity;
}) {
  const primary = colors.primary || '#1A1A1A';
  const textColor = colors.textColor || '#1A1A1A';
  const surfaceColor = colors.surfaceColor || '#FFFFFF';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getIdentity = (): Identity | null => {
    try {
      const raw = sessionStorage.getItem(`booking_identity_${outletId}`);
      if (raw) return JSON.parse(raw);
    } catch { }
    return null;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string, imageDataUrl?: string) => {
    if (!text.trim() && !imageDataUrl) return;
    const identity = getIdentity();

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      imageUrl: imageDataUrl,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setUploadedImage(null);
    setIsStreaming(true);

    const conversationHistory = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    let assistantId = `a-${Date.now()}`;
    let currentToolCallId: string | null = null;

    try {
      const res = await fetch(`${BACKEND_URL}/api/public/booking-portal/chat/${outletId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          identity,
          image_base64: imageDataUrl || null,
        }),
      });

      if (!res.ok || !res.body) {
        setMessages(prev => [...prev, {
          id: assistantId,
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        }]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const updateAssistant = (updater: (msg: ChatMessage) => ChatMessage) => {
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === assistantId);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = updater(next[idx]);
          return next;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          let event: any;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === 'text_start') {
            assistantId = `a-${Date.now()}`;
            setMessages(prev => [...prev, {
              id: assistantId,
              role: 'assistant',
              content: '',
              toolCalls: [],
              isStreaming: true,
            }]);
          } else if (event.type === 'text_delta') {
            updateAssistant(m => ({ ...m, content: m.content + (event.delta || '') }));
          } else if (event.type === 'text_end') {
            updateAssistant(m => ({ ...m, isStreaming: false }));
          } else if (event.type === 'tool_start') {
            currentToolCallId = event.id || `tool-${Date.now()}`;
            const toolEvent: ToolEvent = {
              id: currentToolCallId!,
              name: event.name || 'unknown',
              args: event.args || {},
              status: 'running',
            };
            updateAssistant(m => ({ ...m, toolCalls: [...(m.toolCalls || []), toolEvent] }));
          } else if (event.type === 'tool_result') {
            const tid = event.id || currentToolCallId;
            updateAssistant(m => ({
              ...m,
              toolCalls: (m.toolCalls || []).map(tc =>
                tc.id === tid ? { ...tc, result: event.result, status: 'done' } : tc
              ),
            }));
          } else if (event.type === 'generating_image') {
            updateAssistant(m => ({ ...m, content: m.content + '\n*Generating style preview...*' }));
          } else if (event.type === 'image_generated') {
            updateAssistant(m => ({ ...m, imageUrl: event.url || event.image_url }));
          } else if (event.type === 'done') {
            updateAssistant(m => ({ ...m, isStreaming: false }));
            setIsStreaming(false);
          }
        }
      }
    } catch {
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === assistantId);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], content: 'Sorry, something went wrong. Please try again.', isStreaming: false };
          return next;
        }
        return [...prev, { id: assistantId, role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }];
      });
    } finally {
      setIsStreaming(false);
    }
  }, [messages, outletId]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setUploadedImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = () => {
    if (!isStreaming) sendMessage(input, uploadedImage || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const STARTERS = [
    'Book a haircut for tomorrow',
    'Show me available slots for Saturday',
    uploadedImage ? 'Suggest a hairstyle for me' : 'What services do you offer?',
    'What are your prices?',
  ];

  const containerStyle: React.CSSProperties = isMobile
    ? { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
    : { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' };

  return (
    <div style={containerStyle}>
      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 space-y-4"
        style={{ paddingBottom: '8px' }}>
        {messages.length === 0 && (
          <div className="pt-6 space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${primary}20` }}>
                <SparkleIcon size={26} color={primary} />
              </div>
              <h3 className="text-base font-black" style={{ color: textColor }}>AI Booking Assistant</h3>
              <p className="text-xs mt-1" style={{ color: textColor, opacity: 0.5 }}>
                Chat naturally to book appointments, check availability, or get suggestions.
              </p>
            </div>
            <div className="space-y-2">
              {STARTERS.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)}
                  className="w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all active:scale-[0.98]"
                  style={{
                    ...glass(surfaceColor, 'BB', '14px'),
                    border: i === 2 && uploadedImage ? `1.5px solid ${primary}` : '1px solid rgba(255,255,255,0.25)',
                    color: textColor,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] space-y-1 ${msg.role === 'user' ? '' : ''}`}>
              {msg.role === 'user' ? (
                <div>
                  {msg.imageUrl && (
                    <div className="mb-2 rounded-2xl overflow-hidden">
                      <img src={msg.imageUrl} alt="Uploaded" className="max-w-full rounded-2xl" style={{ maxHeight: '200px', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm font-medium"
                    style={{ backgroundColor: primary, color: 'white' }}>
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
                    style={{ ...glass(surfaceColor, 'CC', '16px'), color: textColor, border: '1px solid rgba(255,255,255,0.25)' }}>
                    {renderMarkdown(msg.content)}
                    {msg.isStreaming && <span className="cursor-blink" />}
                  </div>
                  {msg.imageUrl && (
                    <div className="mt-2 rounded-2xl overflow-hidden">
                      <img src={msg.imageUrl} alt="Generated" className="w-full rounded-2xl" />
                    </div>
                  )}
                  {(msg.toolCalls || []).map(tc => (
                    <ToolCallCard key={tc.id} tool={tc} textColor={textColor} surfaceColor={surfaceColor} primary={primary} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="shrink-0 px-4 pt-2"
        style={{
          paddingBottom: 'calc(max(8px, env(safe-area-inset-bottom)) + 84px)',
          ...glass(surfaceColor, '99', '20px'),
          borderTop: '1px solid rgba(255,255,255,0.20)',
        }}>
        {uploadedImage && (
          <div className="relative inline-block mb-2 mt-2">
            <img src={uploadedImage} alt="To send" className="h-16 w-16 rounded-xl object-cover" />
            <button onClick={() => setUploadedImage(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 text-white text-xs flex items-center justify-center font-bold">
              ×
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 pt-2">
          <input ref={fileInputRef as any} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          <button onClick={() => fileInputRef.current?.click()}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 mb-0.5"
            style={{ backgroundColor: 'rgba(0,0,0,0.07)', color: textColor }}>
            <CameraIcon size={17} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            rows={1}
            className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm focus:outline-none"
            style={{
              backgroundColor: 'rgba(0,0,0,0.05)',
              color: textColor,
              border: '1.5px solid rgba(0,0,0,0.08)',
              lineHeight: '1.5',
              maxHeight: '120px',
              overflow: 'auto',
            }}
          />
          <button onClick={handleSend} disabled={isStreaming || (!input.trim() && !uploadedImage)}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white transition-all active:scale-90 disabled:opacity-40 mb-0.5"
            style={{ backgroundColor: primary }}>
            <SendIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MyBookingsTab ─────────────────────────────────────────────────────────────
function MyBookingsTab({ colors, isMobile, onSwitchToAI, onAIAutoSend }: {
  colors: Record<string, string>;
  isMobile: boolean;
  onSwitchToAI: () => void;
  onAIAutoSend: (message: string) => void;
}) {
  const primary = colors.primary || '#1A1A1A';
  const textColor = colors.textColor || '#1A1A1A';
  const surfaceColor = colors.surfaceColor || '#FFFFFF';

  const containerStyle: React.CSSProperties = isMobile
    ? { flex: 1, overflowY: 'auto', paddingBottom: 'calc(max(12px, env(safe-area-inset-bottom)) + 80px)' }
    : { paddingBottom: 'calc(max(12px, env(safe-area-inset-bottom)) + 80px)' };

  const handleCheckBookings = () => {
    onAIAutoSend('Show my bookings');
    onSwitchToAI();
  };

  return (
    <div style={containerStyle} className="flex flex-col items-center justify-center px-6 pt-16 pb-8 w-full max-w-sm mx-auto text-center">
      <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
        style={{ ...glass(surfaceColor, 'DD', '18px'), border: '1px solid rgba(255,255,255,0.28)' }}>
        <ClockIcon size={36} color={primary} />
      </div>
      <h2 className="text-xl font-black mb-2" style={{ color: textColor }}>My Bookings</h2>
      <p className="text-sm leading-relaxed mb-8" style={{ color: textColor, opacity: 0.55 }}>
        Chat with our AI assistant to view, reschedule, or cancel your bookings.
      </p>
      <button onClick={handleCheckBookings}
        className="w-full py-3.5 rounded-2xl text-white font-black text-base transition-all active:scale-[0.98]"
        style={{ backgroundColor: primary, boxShadow: `0 6px 20px ${primary}40` }}>
        Check My Bookings
      </button>
    </div>
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────
function BottomNav({ tab, onTab, colors }: {
  tab: Tab;
  onTab: (t: Tab) => void;
  colors: Record<string, string>;
}) {
  const primary = colors.primary || '#1A1A1A';
  const textColor = colors.textColor || '#1A1A1A';
  const surfaceColor = colors.surfaceColor || '#FFFFFF';

  const tabs: { id: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
    {
      id: 'book',
      label: 'Book',
      icon: (active) => <CalendarIcon size={22} color={active ? primary : `${textColor}80`} />,
    },
    {
      id: 'ai',
      label: 'AI Chat',
      icon: (active) => <SparkleIcon size={22} color={active ? primary : `${textColor}80`} />,
    },
    {
      id: 'mybookings',
      label: 'My Bookings',
      icon: (active) => <ClockIcon size={22} color={active ? primary : `${textColor}80`} />,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        ...glass(surfaceColor, 'EE', '24px'),
        borderTop: '1px solid rgba(255,255,255,0.25)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
      <div className="flex w-full max-w-sm mx-auto">
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => onTab(t.id)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 transition-all active:scale-95">
              {t.icon(active)}
              <span className="text-xs font-bold"
                style={{ color: active ? primary : `${textColor}70` }}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── FloatingAIButton ─────────────────────────────────────────────────────────
function FloatingAIButton({ onPress, colors }: { onPress: () => void; colors: Record<string, string> }) {
  const primary = colors.primary || '#1A1A1A';
  return (
    <div className="fixed z-30 flex items-center justify-center"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 88px)',
        right: '20px',
      }}>
      <button onClick={onPress}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full text-white font-bold text-sm shadow-lg transition-all active:scale-95"
        style={{ backgroundColor: primary, boxShadow: `0 6px 20px ${primary}50` }}>
        <SparkleIcon size={16} color="white" />
        Try AI Booking
      </button>
    </div>
  );
}

// ─── InlineIdentityGate ───────────────────────────────────────────────────────
function InlineIdentityGate({ outlet, colors, outletId, onIdentity }: {
  outlet: Outlet;
  colors: Record<string, string>;
  outletId: string;
  onIdentity: (identity: Identity) => void;
}) {
  const primary = colors.primary || '#1A1A1A';
  const textColor = colors.textColor || '#1A1A1A';
  const bgColor = colors.bgColor || '#FAFAFA';
  const surfaceColor = colors.surfaceColor || '#FFFFFF';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const logoUrl = outlet.portal_logo_url;
  const logoAdjust = outlet.portal_color_scheme?.logoAdjust || { x: 0, y: 0, scale: 1, fit: 'contain' };

  const handleSubmit = () => {
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 7) { setError('Please enter a valid phone number'); return; }
    const identity: Identity = { name: name.trim(), phone: phone.trim() };
    try { sessionStorage.setItem(`booking_identity_${outletId}`, JSON.stringify(identity)); } catch { }
    onIdentity(identity);
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-y-auto">
      <BgBlobs primary={primary} secondary={colors.secondary || primary} bg={bgColor} />

      {/* Hero banner */}
      <div className="relative flex flex-col items-center justify-center pt-16 pb-10 px-6 text-center"
        style={{ background: `linear-gradient(160deg, ${primary}F5 0%, ${primary}B0 100%)` }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_70%)]" />
        <div className="relative z-10">
          {logoUrl ? (
            <div className="w-24 h-24 rounded-3xl mx-auto mb-4 overflow-hidden shadow-2xl ring-4 ring-white/20">
              <img src={logoUrl.startsWith('/') ? `${BACKEND_URL}${logoUrl}` : logoUrl}
                alt={outlet.name}
                style={{
                  width: '100%', height: '100%',
                  objectFit: logoAdjust.fit || 'contain',
                  transform: `translate(${logoAdjust.x ?? 0}%, ${logoAdjust.y ?? 0}%) scale(${logoAdjust.scale ?? 1})`,
                  transformOrigin: 'center center',
                }} />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-3xl mx-auto mb-4 flex items-center justify-center text-4xl font-black shadow-2xl ring-4 ring-white/20"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)', color: 'white' }}>
              {outlet.name[0]}
            </div>
          )}
          <h1 className="text-3xl font-black text-white tracking-tight mb-1">{outlet.name}</h1>
          <p className="text-white/70 text-base font-medium mt-2">Book your appointment</p>
          {outlet.location && <p className="text-white/55 text-sm mt-1">{outlet.location}</p>}
        </div>
      </div>

      {/* Form card */}
      <div className="flex-1 flex flex-col px-5 -mt-6 pb-8 max-w-sm mx-auto w-full">
        <div className="rounded-3xl p-6 space-y-4 shadow-2xl"
          style={{ ...glass(surfaceColor, '99', '28px'), border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 24px 64px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.35)' }}>
          <div className="text-center mb-2">
            <p className="font-bold text-base" style={{ color: textColor }}>Quick check-in</p>
            <p className="text-xs mt-1" style={{ color: textColor, opacity: 0.5 }}>Required to confirm your booking</p>
          </div>

          <div>
            <label className="block text-xs font-bold mb-2" style={{ color: textColor, opacity: 0.55 }}>Your Name *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40"><UserIcon size={18} /></span>
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
              <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40"><PhoneIcon size={18} /></span>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                className="w-full pl-11 pr-4 py-4 rounded-2xl font-medium focus:outline-none transition-all text-base"
                style={{ ...glass(surfaceColor, 'B0'), border: `1.5px solid ${phone ? primary : 'rgba(255,255,255,0.25)'}`, color: textColor }} />
            </div>
          </div>

          {error && (
            <p className="text-xs font-bold px-1" style={{ color: '#DC2626' }}>{error}</p>
          )}

          <button onClick={handleSubmit}
            className="w-full py-4 rounded-2xl text-white font-black text-base transition-all active:scale-[0.98]"
            style={{ backgroundColor: primary, boxShadow: `0 8px 24px ${primary}50` }}>
            Continue to Booking
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────
export default function BookingClient({ outletId, outlet, company, services, slot_config }: {
  outletId: string;
  outlet: Outlet;
  company: Company;
  services: Service[];
  slot_config: SlotConfig;
}) {
  const isMobile = useIsMobile();

  const scheme = outlet?.portal_color_scheme || {};
  const colors: Record<string, string> = {
    primary: scheme.primary || '#1A1A1A',
    secondary: scheme.secondary || scheme.primary || '#1A1A1A',
    bgColor: scheme.bgColor || '#FAFAFA',
    surfaceColor: scheme.surfaceColor || '#FFFFFF',
    textColor: scheme.textColor || '#1A1A1A',
    fontFamily: scheme.fontFamily || 'Inter',
  };

  const [identity, setIdentity] = useState<Identity | null>(null);
  const [tab, setTab] = useState<Tab>('book');
  const [pendingAIMessage, setPendingAIMessage] = useState<string | null>(null);
  const aiTabRef = useRef<{ sendMessage: (text: string) => void } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`booking_identity_${outletId}`);
      if (raw) setIdentity(JSON.parse(raw));
    } catch { }
  }, [outletId]);

  const handleAIAutoSend = (message: string) => {
    setPendingAIMessage(message);
  };

  const handleSwitchToAI = () => {
    setTab('ai');
  };

  if (!identity) {
    return (
      <InlineIdentityGate
        outlet={outlet}
        colors={colors}
        outletId={outletId}
        onIdentity={setIdentity}
      />
    );
  }

  const fontFamily = colors.fontFamily;

  const shellStyle: React.CSSProperties = isMobile
    ? { position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', fontFamily: `${fontFamily}, system-ui, sans-serif` }
    : { minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: `${fontFamily}, system-ui, sans-serif` };

  const contentStyle: React.CSSProperties = isMobile
    ? { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '100%' }
    : { width: '100%', display: 'flex', flexDirection: 'column' };

  return (
    <div style={shellStyle}>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700;900&display=swap');` }} />
      <BgBlobs primary={colors.primary} secondary={colors.secondary} bg={colors.bgColor} />
      <div className="fixed inset-x-0 top-0 pointer-events-none" style={{
        zIndex: 20, height: 90,
        background: `linear-gradient(to bottom, ${colors.primary}BB 0%, transparent 100%)`,
      }} />

      <div style={contentStyle}>
        {tab === 'book' && (
          <BookTab
            outletId={outletId}
            services={services}
            colors={colors}
            isMobile={isMobile}
            onSwitchToAI={handleSwitchToAI}
          />
        )}
        {tab === 'ai' && (
          <AITabWrapper
            key="ai-tab"
            outletId={outletId}
            outlet={outlet}
            colors={colors}
            isMobile={isMobile}
            identity={identity}
            pendingMessage={pendingAIMessage}
            onPendingConsumed={() => setPendingAIMessage(null)}
          />
        )}
        {tab === 'mybookings' && (
          <MyBookingsTab
            colors={colors}
            isMobile={isMobile}
            onSwitchToAI={handleSwitchToAI}
            onAIAutoSend={handleAIAutoSend}
          />
        )}
      </div>

      {tab === 'book' && <FloatingAIButton onPress={handleSwitchToAI} colors={colors} />}
      <BottomNav tab={tab} onTab={setTab} colors={colors} />
    </div>
  );
}

// ─── AITabWrapper — handles pending message auto-send ─────────────────────────
function AITabWrapper({ outletId, outlet, colors, isMobile, identity, pendingMessage, onPendingConsumed }: {
  outletId: string;
  outlet: Outlet;
  colors: Record<string, string>;
  isMobile: boolean;
  identity: Identity;
  pendingMessage: string | null;
  onPendingConsumed: () => void;
}) {
  const primary = colors.primary || '#1A1A1A';
  const textColor = colors.textColor || '#1A1A1A';
  const surfaceColor = colors.surfaceColor || '#FFFFFF';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingConsumedRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string, imageDataUrl?: string, currentMsgs?: ChatMessage[]) => {
    if (!text.trim() && !imageDataUrl) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      imageUrl: imageDataUrl,
    };

    const baseMessages = currentMsgs || messages;
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setUploadedImage(null);
    setIsStreaming(true);

    const conversationHistory = [...baseMessages, userMsg].map(m => ({ role: m.role, content: m.content }));

    let assistantId = `a-${Date.now()}`;
    let currentToolCallId: string | null = null;

    try {
      const res = await fetch(`${BACKEND_URL}/api/public/booking-portal/chat/${outletId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversationHistory,
          identity,
          image_base64: imageDataUrl || null,
        }),
      });

      if (!res.ok || !res.body) {
        setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const updateAssistant = (updater: (msg: ChatMessage) => ChatMessage) => {
        setMessages(prev => {
          const idx = prev.findIndex(m => m.id === assistantId);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = updater(next[idx]);
          return next;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          let event: any;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === 'text_start') {
            assistantId = `a-${Date.now()}`;
            setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', toolCalls: [], isStreaming: true }]);
          } else if (event.type === 'text_delta') {
            updateAssistant(m => ({ ...m, content: m.content + (event.delta || '') }));
          } else if (event.type === 'text_end') {
            updateAssistant(m => ({ ...m, isStreaming: false }));
          } else if (event.type === 'tool_start') {
            currentToolCallId = event.id || `tool-${Date.now()}`;
            updateAssistant(m => ({
              ...m,
              toolCalls: [...(m.toolCalls || []), { id: currentToolCallId!, name: event.name || 'unknown', args: event.args || {}, status: 'running' }],
            }));
          } else if (event.type === 'tool_result') {
            const tid = event.id || currentToolCallId;
            updateAssistant(m => ({
              ...m,
              toolCalls: (m.toolCalls || []).map(tc => tc.id === tid ? { ...tc, result: event.result, status: 'done' } : tc),
            }));
          } else if (event.type === 'generating_image') {
            updateAssistant(m => ({ ...m, content: m.content + '\n*Generating style preview...*' }));
          } else if (event.type === 'image_generated') {
            updateAssistant(m => ({ ...m, imageUrl: event.url || event.image_url }));
          } else if (event.type === 'done') {
            updateAssistant(m => ({ ...m, isStreaming: false }));
            setIsStreaming(false);
          }
        }
      }
    } catch {
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === assistantId);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], content: 'Sorry, something went wrong. Please try again.', isStreaming: false };
          return next;
        }
        return [...prev, { id: assistantId, role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }];
      });
    } finally {
      setIsStreaming(false);
    }
  }, [messages, outletId, identity]);

  useEffect(() => {
    if (pendingMessage && !pendingConsumedRef.current) {
      pendingConsumedRef.current = true;
      sendMessage(pendingMessage, undefined, []);
      onPendingConsumed();
    }
  }, [pendingMessage]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setUploadedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = () => {
    if (!isStreaming) sendMessage(input, uploadedImage || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const STARTERS = [
    'Book a haircut for tomorrow',
    'Show me available slots for Saturday',
    uploadedImage ? 'Suggest a hairstyle for me' : 'What services do you offer?',
    'What are your prices?',
  ];

  const containerStyle: React.CSSProperties = isMobile
    ? { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }
    : { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' };

  return (
    <div style={containerStyle}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 space-y-4" style={{ paddingBottom: '8px' }}>
        {messages.length === 0 && (
          <div className="pt-6 space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${primary}20` }}>
                <SparkleIcon size={26} color={primary} />
              </div>
              <h3 className="text-base font-black" style={{ color: textColor }}>AI Booking Assistant</h3>
              <p className="text-xs mt-1" style={{ color: textColor, opacity: 0.5 }}>
                Chat naturally to book appointments, check availability, or get suggestions.
              </p>
            </div>
            <div className="space-y-2">
              {STARTERS.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)}
                  className="w-full text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all active:scale-[0.98]"
                  style={{
                    ...glass(surfaceColor, 'BB', '14px'),
                    border: i === 2 && uploadedImage ? `1.5px solid ${primary}` : '1px solid rgba(255,255,255,0.25)',
                    color: textColor,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] space-y-1">
              {msg.role === 'user' ? (
                <div>
                  {msg.imageUrl && (
                    <div className="mb-2 rounded-2xl overflow-hidden">
                      <img src={msg.imageUrl} alt="Uploaded" className="max-w-full rounded-2xl" style={{ maxHeight: '200px', objectFit: 'cover' }} />
                    </div>
                  )}
                  <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm font-medium" style={{ backgroundColor: primary, color: 'white' }}>
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
                    style={{ ...glass(surfaceColor, 'CC', '16px'), color: textColor, border: '1px solid rgba(255,255,255,0.25)' }}>
                    {renderMarkdown(msg.content)}
                    {msg.isStreaming && <span className="cursor-blink" />}
                  </div>
                  {msg.imageUrl && (
                    <div className="mt-2 rounded-2xl overflow-hidden">
                      <img src={msg.imageUrl} alt="Generated" className="w-full rounded-2xl" />
                    </div>
                  )}
                  {(msg.toolCalls || []).map(tc => (
                    <ToolCallCard key={tc.id} tool={tc} textColor={textColor} surfaceColor={surfaceColor} primary={primary} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 px-4 pt-2"
        style={{
          paddingBottom: 'calc(max(8px, env(safe-area-inset-bottom)) + 84px)',
          ...glass(surfaceColor, '99', '20px'),
          borderTop: '1px solid rgba(255,255,255,0.20)',
        }}>
        {uploadedImage && (
          <div className="relative inline-block mb-2 mt-2">
            <img src={uploadedImage} alt="To send" className="h-16 w-16 rounded-xl object-cover" />
            <button onClick={() => setUploadedImage(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-700 text-white text-xs flex items-center justify-center font-bold">
              ×
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 pt-2">
          <input ref={fileInputRef as any} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          <button onClick={() => fileInputRef.current?.click()}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 mb-0.5"
            style={{ backgroundColor: 'rgba(0,0,0,0.07)', color: textColor }}>
            <CameraIcon size={17} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything..."
            rows={1}
            className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm focus:outline-none"
            style={{
              backgroundColor: 'rgba(0,0,0,0.05)',
              color: textColor,
              border: '1.5px solid rgba(0,0,0,0.08)',
              lineHeight: '1.5',
              maxHeight: '120px',
              overflow: 'auto',
            }}
          />
          <button onClick={handleSend} disabled={isStreaming || (!input.trim() && !uploadedImage)}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white transition-all active:scale-90 disabled:opacity-40 mb-0.5"
            style={{ backgroundColor: primary }}>
            <SendIcon size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
