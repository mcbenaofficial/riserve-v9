'use client';
import { useState, useEffect } from 'react';

interface IdentityGateProps {
  outletId: string;
  outlet: any;
  company: any;
  children: React.ReactNode;
}

export default function IdentityGate({ outletId, outlet, company, children }: IdentityGateProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [identified, setIdentified] = useState(false);
  const [error, setError] = useState('');

  const config = outlet?.portal_color_scheme || {};
  const requireIdentity = config.requireIdentity !== false;
  const defaultWhatsapp = config.whatsappOptIn !== false;
  const primaryColor = config.primary || '#1A1A1A';
  const secondaryColor = config.secondary || config.primary || '#F59E0B';
  const fontFamily = config.fontFamily || 'Inter';
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    const stored = sessionStorage.getItem(`customer_${outletId}`);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.name && data.phone) { setIdentified(true); return; }
      } catch {}
    }
    if (!requireIdentity) setIdentified(true);
    setWhatsappOptIn(defaultWhatsapp);
  }, [outletId, requireIdentity, defaultWhatsapp]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.length < 10) { setError('Please enter a valid phone number'); return; }
    sessionStorage.setItem(`customer_${outletId}`, JSON.stringify({
      name: name.trim(), phone: phone.trim(), whatsappOptIn, timestamp: Date.now()
    }));
    setError('');
    setIdentified(true);
  };

  if (identified) return <>{children}</>;

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden"
      style={{ fontFamily: `${fontFamily}, system-ui, sans-serif` }}
    >
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700;900&display=swap');` }} />

      {/* Full-page gradient background */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}DD 55%, ${primaryColor}AA 100%)` }}
      />

      {/* Decorative blobs */}
      <div
        className="absolute -top-48 -right-32 w-[560px] h-[560px] rounded-full pointer-events-none"
        style={{ background: secondaryColor, opacity: 0.28, filter: 'blur(90px)' }}
      />
      <div
        className="absolute -bottom-32 -left-32 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ background: 'rgba(255,255,255,1)', opacity: 0.08, filter: 'blur(80px)' }}
      />
      <div
        className="absolute top-1/2 left-1/3 w-[260px] h-[260px] rounded-full pointer-events-none"
        style={{ background: secondaryColor, opacity: 0.12, filter: 'blur(100px)' }}
      />

      {/* Noise grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }}
      />

      <div className="relative w-full max-w-md z-10">
        {/* Logo + Name */}
        <div className="text-center mb-8">
          {outlet?.portal_logo_url && (
            <img
              src={outlet.portal_logo_url.startsWith('/') ? `${BACKEND}${outlet.portal_logo_url}` : outlet.portal_logo_url}
              alt="Logo"
              className="w-24 h-24 mx-auto object-contain mb-5"
              style={{ filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.45))' }}
            />
          )}
          <h1 className="text-4xl font-black tracking-tight mb-1.5 text-white" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
            {company?.name || 'Welcome'}
          </h1>
          <p className="text-sm font-medium text-white/55">
            {outlet?.location || 'Please identify yourself to continue'}
          </p>
        </div>

        {/* Glass Form Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl p-8 space-y-5"
          style={{
            background: 'rgba(255,255,255,0.11)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.22)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.28)',
          }}
        >
          <div className="text-center mb-1">
            <h2 className="text-lg font-bold text-white">Let us know who you are</h2>
            <p className="text-xs text-white/45 mt-1">This helps us serve you better</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold text-white/55 uppercase tracking-wider mb-2">
              Full Name <span className="text-red-300">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="Enter your name"
              autoFocus
              className="w-full px-4 py-4 rounded-2xl text-white placeholder-white/35 font-medium text-base transition-all focus:outline-none"
              style={{
                background: 'rgba(255,255,255,0.10)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.18)',
                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.12)',
              }}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[11px] font-bold text-white/55 uppercase tracking-wider mb-2">
              Mobile Number <span className="text-red-300">*</span>
            </label>
            <div className="flex gap-2">
              <div
                className="px-4 py-4 rounded-2xl text-white/75 font-semibold text-sm flex items-center shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                🇮🇳 +91
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(''); }}
                placeholder="98765 43210"
                className="w-full px-4 py-4 rounded-2xl text-white placeholder-white/35 font-medium text-base transition-all focus:outline-none"
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.12)',
                }}
              />
            </div>
          </div>

          {/* WhatsApp Opt-in */}
          <label
            className="flex items-start gap-3 cursor-pointer select-none p-4 rounded-2xl transition-colors"
            style={{
              background: 'rgba(34,197,94,0.14)',
              border: '1px solid rgba(34,197,94,0.28)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
          >
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(e) => setWhatsappOptIn(e.target.checked)}
              className="w-5 h-5 rounded border-green-300 text-green-500 focus:ring-green-400 mt-0.5 shrink-0"
            />
            <div>
              <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-400 shrink-0" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
                </svg>
                Receive updates via WhatsApp
              </span>
              <span className="text-[11px] text-white/45 mt-0.5 block">Order status, booking confirmations & reminders</span>
            </div>
          </label>

          {/* Error */}
          {error && (
            <div
              className="text-red-200 text-sm font-medium px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-4 rounded-2xl font-black text-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'rgba(255,255,255,0.96)',
              color: primaryColor,
              boxShadow: `0 8px 32px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,1)`,
            }}
          >
            Continue →
          </button>

          <p className="text-center text-[10px] text-white/28">
            Powered by <span className="font-semibold">Ri'Serve</span>
          </p>
        </form>
      </div>
    </div>
  );
}
