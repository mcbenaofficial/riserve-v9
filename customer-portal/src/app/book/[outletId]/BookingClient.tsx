'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, ChevronRight, Sparkles, Clock, User as UserIcon, ArrowLeft, Calendar as CalendarIcon, Loader2 } from 'lucide-react';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

// ── helpers ───────────────────────────────────────────────────────────────────

function cssVars(cs: Record<string, string>) {
  return {
    '--brand-primary': cs.primary || '#1A1A1A',
    '--brand-secondary': cs.secondary || '#F59E0B',
    '--brand-bg': cs.bgColor || '#FAFAFA',
    '--brand-surface': cs.surfaceColor || '#FFFFFF',
    '--brand-text': cs.textColor || '#1A1A1A',
  } as React.CSSProperties;
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── sub-components ────────────────────────────────────────────────────────────

function StepDot({ n, step }: { n: number; step: number }) {
  const done = step > n;
  const active = step === n;
  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-4 ring-white transition-all duration-300
        ${done ? 'scale-110 shadow-md' : active ? 'scale-125 shadow-xl' : 'border-2 border-gray-200 bg-white text-gray-400'}`}
      style={done || active ? { backgroundColor: 'var(--brand-primary)', color: '#fff' } : {}}
    >
      {done ? <CheckCircle2 className="w-5 h-5" /> : n}
    </div>
  );
}

// Simple calendar — renders a 6-row month grid
function MiniCalendar({ selected, onSelect }: { selected: Date; onSelect: (d: Date) => void }) {
  const [viewDate, setViewDate] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--brand-primary)20', backgroundColor: 'var(--brand-surface)' }}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">‹</button>
        <span className="font-bold text-sm">{monthLabel}</span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-xs text-gray-400 font-semibold py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const d = new Date(year, month, day);
          const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const isSelected = selected.getDate() === day && selected.getMonth() === month && selected.getFullYear() === year;
          return (
            <button
              key={i}
              disabled={isPast}
              onClick={() => onSelect(d)}
              className={`py-1.5 rounded-lg text-sm font-medium transition-all
                ${isPast ? 'text-gray-300 cursor-not-allowed' : ''}
                ${isSelected ? 'text-white shadow-md scale-110' : 'hover:opacity-80'}
              `}
              style={isSelected ? { backgroundColor: 'var(--brand-primary)' } : {}}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function BookingClient({ outletId, outlet, services, staff, initialServiceId }: {
  outletId: string;
  outlet: any;
  services: any[];
  staff: any[];
  initialServiceId?: string;
}) {
  const cs = outlet?.portal_color_scheme || {};
  const logoUrl = outlet?.portal_logo_url;
  const outletName = outlet?.name || 'Booking Portal';

  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState<string>(initialServiceId || services[0]?.id || '');
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [time, setTime] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<{ value: string; label: string }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const selectedService = services.find(s => s.id === serviceId);
  const selectedStaff = staff.find(s => s.id === staffId);

  // Fetch available slots whenever date, staff, or service changes (and we're on step 3)
  useEffect(() => {
    if (!outletId || !serviceId) return;
    const duration = selectedService?.duration_minutes || 30;
    const dateStr = date.toISOString().split('T')[0];
    const params = new URLSearchParams({ date: dateStr, duration: String(duration) });
    if (staffId && staffId !== 'any') params.set('resource_id', staffId);

    setSlotsLoading(true);
    setTime(null);
    fetch(`${BACKEND}/api/public/available-slots/${outletId}?${params}`)
      .then(r => r.json())
      .then(data => setTimeSlots(data.slots || []))
      .catch(() => setTimeSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [date, staffId, serviceId, outletId]);

  const handleBook = async () => {
    if (!customerName.trim() || !customerPhone.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND}/api/public/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: outletId,
          service_id: serviceId,
          resource_id: staffId !== 'any' ? staffId : undefined,
          date: date.toISOString().split('T')[0],
          time: time!,
          customer_name: customerName,
          customer_phone: customerPhone,
          notes: notes || undefined,
          total_amount: selectedService?.price,
          total_duration: selectedService?.duration_minutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Booking failed');
      setBookingId(data.booking_id);
      setStep(6);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ ...cssVars(cs), backgroundColor: 'var(--brand-bg)', minHeight: '100vh', fontFamily: cs.fontFamily || 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 border-b" style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-primary)20' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={outletName} className="h-8 w-auto object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: 'var(--brand-primary)' }}>
              {outletName[0]}
            </div>
          )}
          <span className="font-bold text-lg" style={{ color: 'var(--brand-text)' }}>{outletName}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Progress */}
        {step < 6 && (
          <div className="flex items-center justify-between px-2 relative">
            <div className="absolute left-6 right-6 top-5 h-1 rounded-full" style={{ backgroundColor: 'var(--brand-primary)15' }} />
            <div
              className="absolute left-6 top-5 h-1 rounded-full transition-all duration-500"
              style={{ backgroundColor: 'var(--brand-primary)', width: `calc(${(step - 1) * 20}% - 12px)` }}
            />
            {[1, 2, 3, 4, 5].map(n => <StepDot key={n} n={n} step={step} />)}
          </div>
        )}

        <div className="rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden"
          style={{ backgroundColor: 'var(--brand-surface)' }}>
          {loading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-sm"
              style={{ backgroundColor: 'var(--brand-surface)cc' }}>
              <div className="w-14 h-14 border-4 border-t-transparent rounded-full animate-spin mb-4"
                style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />
              <p className="font-bold animate-pulse" style={{ color: 'var(--brand-primary)' }}>Securing your appointment...</p>
            </div>
          )}

          {/* Step 1 — Service */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-6 duration-400 space-y-4">
              <h2 className="text-3xl font-extrabold" style={{ color: 'var(--brand-primary)' }}>Select Service</h2>
              <div className="space-y-3">
                {services.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setServiceId(s.id)}
                    className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 hover:shadow-md
                      ${serviceId === s.id ? 'scale-[1.01]' : ''}`}
                    style={{
                      borderColor: serviceId === s.id ? 'var(--brand-primary)' : 'var(--brand-primary)20',
                      backgroundColor: serviceId === s.id ? 'var(--brand-primary)08' : 'transparent',
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-bold text-base" style={{ color: 'var(--brand-text)' }}>{s.name}</div>
                        <div className="text-sm mt-0.5" style={{ color: 'var(--brand-text)80' }}>{s.duration_minutes} min</div>
                      </div>
                      <div className="text-xl font-extrabold" style={{ color: 'var(--brand-primary)' }}>₹{s.price}</div>
                    </div>
                  </button>
                ))}
              </div>
              <button
                disabled={!serviceId}
                onClick={() => setStep(2)}
                className="w-full py-4 rounded-2xl font-bold text-lg text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-40"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                Choose Professional <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 2 — Staff */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-6 duration-400 space-y-4">
              <h2 className="text-3xl font-extrabold" style={{ color: 'var(--brand-primary)' }}>Choose Professional</h2>
              <p className="text-sm" style={{ color: 'var(--brand-text)80' }}>Select your preferred expert or let us pick the best available.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => setStaffId('any')}
                  className={`py-6 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all
                    ${staffId === 'any' ? 'scale-[1.03]' : ''}`}
                  style={{
                    borderColor: staffId === 'any' ? 'var(--brand-primary)' : 'var(--brand-primary)20',
                    backgroundColor: staffId === 'any' ? 'var(--brand-primary)08' : 'transparent',
                  }}
                >
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--brand-primary)15' }}>
                    <Sparkles className="w-7 h-7" style={{ color: 'var(--brand-primary)' }} />
                  </div>
                  <span className="font-bold text-sm" style={{ color: 'var(--brand-text)' }}>Any Available</span>
                </button>
                {staff.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setStaffId(s.id)}
                    className={`py-6 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all
                      ${staffId === s.id ? 'scale-[1.03]' : ''}`}
                    style={{
                      borderColor: staffId === s.id ? 'var(--brand-primary)' : 'var(--brand-primary)20',
                      backgroundColor: staffId === s.id ? 'var(--brand-primary)08' : 'transparent',
                    }}
                  >
                    <img src={s.photo} alt={s.name} className="w-14 h-14 rounded-full object-cover"
                      style={{ border: '2px solid color-mix(in srgb, var(--brand-primary) 40%, transparent)' }} />
                    <span className="font-bold text-sm" style={{ color: 'var(--brand-text)' }}>{s.name}</span>
                    <span className="text-xs" style={{ color: 'var(--brand-text)60' }}>{s.role}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="flex-none px-6 py-4 rounded-2xl border-2 font-bold text-sm"
                  style={{ borderColor: 'var(--brand-primary)30', color: 'var(--brand-text)' }}>
                  <ArrowLeft className="w-4 h-4 inline mr-1" /> Back
                </button>
                <button
                  disabled={!staffId}
                  onClick={() => setStep(3)}
                  className="flex-1 py-4 rounded-2xl font-bold text-lg text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-40"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  Pick Date & Time <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Date & Time */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-6 duration-400 space-y-4">
              <h2 className="text-3xl font-extrabold" style={{ color: 'var(--brand-primary)' }}>Date & Time</h2>
              <MiniCalendar selected={date} onSelect={d => { setDate(d); setTime(null); }} />
              <div>
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--brand-text)' }}>
                  <CalendarIcon className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} />
                  {formatDate(date)}
                </h4>
                {slotsLoading ? (
                  <div className="flex items-center justify-center py-10 gap-2" style={{ color: 'var(--brand-primary)' }}>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-medium">Checking availability…</span>
                  </div>
                ) : timeSlots.length === 0 ? (
                  <div className="text-center py-10 rounded-2xl border-2 border-dashed" style={{ borderColor: 'var(--brand-primary)20', color: 'var(--brand-text)50' }}>
                    <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">No available slots on this day.</p>
                    <p className="text-xs mt-1">Try selecting a different date or professional.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {timeSlots.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setTime(t.value)}
                        className="py-2.5 rounded-xl border-2 text-sm font-semibold transition-all"
                        style={{
                          borderColor: time === t.value ? 'var(--brand-primary)' : 'var(--brand-primary)20',
                          backgroundColor: time === t.value ? 'var(--brand-primary)' : 'transparent',
                          color: time === t.value ? '#fff' : 'var(--brand-text)',
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-none px-6 py-4 rounded-2xl border-2 font-bold text-sm"
                  style={{ borderColor: 'var(--brand-primary)30', color: 'var(--brand-text)' }}>
                  <ArrowLeft className="w-4 h-4 inline mr-1" /> Back
                </button>
                <button
                  disabled={!time || slotsLoading}
                  onClick={() => setStep(4)}
                  className="flex-1 py-4 rounded-2xl font-bold text-lg text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-40"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  Your Details <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4 — Customer Details */}
          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-right-6 duration-400 space-y-4">
              <h2 className="text-3xl font-extrabold" style={{ color: 'var(--brand-primary)' }}>Your Details</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--brand-text)60' }}>Full Name *</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full px-4 py-3 rounded-xl border-2 text-sm font-medium outline-none transition-all"
                    style={{
                      borderColor: customerName ? 'var(--brand-primary)' : 'var(--brand-primary)20',
                      backgroundColor: 'var(--brand-bg)',
                      color: 'var(--brand-text)',
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--brand-text)60' }}>Mobile Number *</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 rounded-xl border-2 text-sm font-medium outline-none transition-all"
                    style={{
                      borderColor: customerPhone ? 'var(--brand-primary)' : 'var(--brand-primary)20',
                      backgroundColor: 'var(--brand-bg)',
                      color: 'var(--brand-text)',
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--brand-text)60' }}>Special Requests (optional)</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Any notes for our team…"
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border-2 text-sm font-medium outline-none transition-all resize-none"
                    style={{
                      borderColor: 'var(--brand-primary)20',
                      backgroundColor: 'var(--brand-bg)',
                      color: 'var(--brand-text)',
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="flex-none px-6 py-4 rounded-2xl border-2 font-bold text-sm"
                  style={{ borderColor: 'var(--brand-primary)30', color: 'var(--brand-text)' }}>
                  <ArrowLeft className="w-4 h-4 inline mr-1" /> Back
                </button>
                <button
                  disabled={!customerName.trim() || !customerPhone.trim()}
                  onClick={() => setStep(5)}
                  className="flex-1 py-4 rounded-2xl font-bold text-lg text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-40"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  Review <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 5 — Review */}
          {step === 5 && (
            <div className="animate-in fade-in slide-in-from-right-6 duration-400 space-y-4">
              <h2 className="text-3xl font-extrabold" style={{ color: 'var(--brand-primary)' }}>Review Booking</h2>
              <div className="space-y-3">
                {[
                  {
                    icon: <Clock className="w-6 h-6" />,
                    label: 'Date & Time',
                    value: `${formatDate(date)} at ${timeSlots.find(t => t.value === time)?.label || time}`,
                  },
                  {
                    icon: <Sparkles className="w-6 h-6" />,
                    label: 'Service',
                    value: selectedService?.name,
                    sub: selectedService ? `₹${selectedService.price} · ${selectedService.duration_minutes} min` : '',
                  },
                  {
                    icon: <UserIcon className="w-6 h-6" />,
                    label: 'Professional',
                    value: selectedStaff?.name || 'Any Available',
                  },
                  {
                    icon: <UserIcon className="w-6 h-6" />,
                    label: 'Your Info',
                    value: customerName,
                    sub: customerPhone,
                  },
                ].map(row => (
                  <div key={row.label} className="flex items-start gap-4 p-4 rounded-2xl border"
                    style={{ borderColor: 'var(--brand-primary)15', backgroundColor: 'var(--brand-primary)05' }}>
                    <div className="mt-0.5" style={{ color: 'var(--brand-primary)' }}>{row.icon}</div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--brand-text)50' }}>{row.label}</div>
                      <div className="font-bold" style={{ color: 'var(--brand-text)' }}>{row.value}</div>
                      {row.sub && <div className="text-sm mt-0.5" style={{ color: 'var(--brand-text)60' }}>{row.sub}</div>}
                    </div>
                  </div>
                ))}
              </div>
              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">{error}</div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(4)} className="flex-none px-6 py-4 rounded-2xl border-2 font-bold text-sm"
                  style={{ borderColor: 'var(--brand-primary)30', color: 'var(--brand-text)' }}>
                  <ArrowLeft className="w-4 h-4 inline mr-1" /> Edit
                </button>
                <button
                  onClick={handleBook}
                  className="flex-1 py-4 rounded-2xl font-extrabold text-xl text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 shadow-lg"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  Confirm Booking
                </button>
              </div>
            </div>
          )}

          {/* Step 6 — Success */}
          {step === 6 && (
            <div className="animate-in zoom-in slide-in-from-bottom-8 duration-500 text-center py-10 space-y-5">
              <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(34,197,94,0.25)] bg-green-50">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <div>
                <h2 className="text-4xl font-black mb-2" style={{ color: 'var(--brand-text)' }}>You're all set!</h2>
                <p className="text-base" style={{ color: 'var(--brand-text)70' }}>
                  Your appointment for <strong style={{ color: 'var(--brand-primary)' }}>{selectedService?.name}</strong> on{' '}
                  <strong style={{ color: 'var(--brand-primary)' }}>{formatDate(date)}</strong> is confirmed.
                  {bookingId && <span className="block mt-1 text-sm">Booking ID: <code>{bookingId.slice(0, 8).toUpperCase()}</code></span>}
                </p>
              </div>
              <button
                onClick={() => { setStep(1); setStaffId(null); setTime(null); setCustomerName(''); setCustomerPhone(''); setBookingId(null); }}
                className="px-8 py-3 rounded-2xl border-2 font-bold text-sm transition-all hover:shadow-md"
                style={{ borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}
              >
                Book Another Appointment
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
