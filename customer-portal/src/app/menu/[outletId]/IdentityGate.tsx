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
  const bgColor = config.bgColor || '#FAFAFA';
  const textColor = config.textColor || '#1A1A1A';
  const fontFamily = config.fontFamily || 'Inter';
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

  useEffect(() => {
    // Check if customer already identified this session
    const stored = sessionStorage.getItem(`customer_${outletId}`);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.name && data.phone) {
          setIdentified(true);
          return;
        }
      } catch {}
    }
    // If identity gate not required, skip
    if (!requireIdentity) {
      setIdentified(true);
    }
    setWhatsappOptIn(defaultWhatsapp);
  }, [outletId, requireIdentity, defaultWhatsapp]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter your name'); return; }
    if (!phone.trim()) { setError('Please enter your phone number'); return; }

    // Validate phone (basic)
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.length < 10) { setError('Please enter a valid phone number'); return; }

    // Store in session
    sessionStorage.setItem(`customer_${outletId}`, JSON.stringify({
      name: name.trim(),
      phone: phone.trim(),
      whatsappOptIn,
      timestamp: Date.now()
    }));

    setError('');
    setIdentified(true);
  };

  if (identified) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: bgColor, fontFamily: `${fontFamily}, system-ui, sans-serif` }}>
      <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap');`}} />

      <div className="w-full max-w-md">
        {/* Logo + Name */}
        <div className="text-center mb-8">
          {outlet?.portal_logo_url && (
            <img
              src={outlet.portal_logo_url.startsWith('/') ? `${BACKEND}${outlet.portal_logo_url}` : outlet.portal_logo_url}
              alt="Logo"
              className="w-20 h-20 mx-auto object-contain mb-4"
            />
          )}
          <h1 className="text-3xl font-black tracking-tight mb-1" style={{ color: textColor }}>
            {company?.name || 'Welcome'}
          </h1>
          <p className="text-sm font-medium opacity-50" style={{ color: textColor }}>
            {outlet?.location || 'Please identify yourself to continue'}
          </p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-5">
          <div className="text-center mb-2">
            <h2 className="text-lg font-bold" style={{ color: textColor }}>Let us know who you are</h2>
            <p className="text-xs text-gray-400 mt-1">This helps us serve you better</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="Enter your name"
              className="w-full px-4 py-4 rounded-2xl bg-gray-50 border border-gray-100 text-gray-900 focus:outline-none focus:ring-2 focus:border-gray-300 font-medium text-base transition-all"
              style={{ focusRingColor: primaryColor + '40' } as any}
              autoFocus
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Mobile Number <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <div className="px-4 py-4 rounded-2xl bg-gray-50 border border-gray-100 text-gray-600 font-semibold text-sm flex items-center shrink-0">
                🇮🇳 +91
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(''); }}
                placeholder="98765 43210"
                className="w-full px-4 py-4 rounded-2xl bg-gray-50 border border-gray-100 text-gray-900 focus:outline-none focus:ring-2 focus:border-gray-300 font-medium text-base transition-all"
              />
            </div>
          </div>

          {/* WhatsApp Opt-in */}
          <label className="flex items-start gap-3 cursor-pointer select-none p-3 rounded-xl bg-green-50 border border-green-100 hover:bg-green-100/50 transition-colors">
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(e) => setWhatsappOptIn(e.target.checked)}
              className="w-5 h-5 rounded border-green-300 text-green-600 focus:ring-green-500 mt-0.5 shrink-0"
            />
            <div>
              <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-green-600 shrink-0" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
                </svg>
                Receive updates via WhatsApp
              </span>
              <span className="text-[11px] text-gray-500 mt-0.5 block">Order status, booking confirmations & reminders</span>
            </div>
          </label>

          {/* Error */}
          {error && (
            <div className="text-red-600 text-sm font-medium bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-4 rounded-2xl text-white font-black text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all"
            style={{ backgroundColor: primaryColor }}
          >
            Continue
          </button>

          <p className="text-center text-[10px] text-gray-400">
            Powered by <span className="font-semibold">Ri'Serve</span>
          </p>
        </form>
      </div>
    </div>
  );
}
