import Link from 'next/link';
import { UtensilsCrossed, CalendarCheck, ArrowRight } from 'lucide-react';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export default async function PortalLandingPage({
  params,
}: {
  params: Promise<{ outletId: string }>;
}) {
  const { outletId } = await params;

  let outlet: any = null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/public/outlet/${outletId}`, { cache: 'no-store' });
    if (res.ok) outlet = await res.json();
  } catch (e) {
    console.error('Failed to fetch outlet:', e);
  }

  const cs = outlet?.portal_color_scheme || {};
  const logoUrl = outlet?.portal_logo_url;
  const outletName = outlet?.name || 'Welcome';
  const primary = cs.primary || '#1A1A1A';
  const secondary = cs.secondary || '#F59E0B';
  const bgColor = cs.bgColor || '#FAFAFA';
  const surfaceColor = cs.surfaceColor || '#FFFFFF';
  const textColor = cs.textColor || '#1A1A1A';
  const fontFamily = cs.fontFamily || 'Inter, sans-serif';
  const heroImage = cs.heroImage || '';

  // Determine which portals are active
  const portalType = cs.portalType || 'both';
  const showOrder = portalType === 'order' || portalType === 'both';
  const showBooking = portalType === 'booking' || portalType === 'both';

  // If only one portal type, redirect directly
  if (portalType === 'order') {
    const { redirect } = await import('next/navigation');
    redirect(`/menu/${outletId}`);
  }
  if (portalType === 'booking') {
    const { redirect } = await import('next/navigation');
    redirect(`/book/${outletId}`);
  }

  return (
    <div style={{ backgroundColor: bgColor, minHeight: '100vh', fontFamily }}>
      {/* Hero */}
      <div
        className="relative flex flex-col items-center justify-center text-center px-6 py-20 overflow-hidden"
        style={{ minHeight: '45vh', backgroundColor: primary }}
      >
        {heroImage && (
          <img
            src={heroImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
        )}
        <div className="relative z-10 space-y-4">
          {logoUrl ? (
            <img src={logoUrl} alt={outletName} className="h-16 mx-auto object-contain drop-shadow-lg" />
          ) : (
            <div
              className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center text-3xl font-black shadow-xl"
              style={{ backgroundColor: surfaceColor, color: primary }}
            >
              {outletName[0]}
            </div>
          )}
          <h1 className="text-4xl font-black text-white drop-shadow-md">{outletName}</h1>
          <p className="text-white/75 text-lg font-medium">How can we help you today?</p>
        </div>
      </div>

      {/* Portal Cards */}
      <div className="max-w-xl mx-auto px-4 -mt-8 pb-12 space-y-4">
        {showOrder && (
          <Link
            href={`/menu/${outletId}`}
            className="group block rounded-3xl p-6 shadow-xl border-2 transition-all hover:-translate-y-1 hover:shadow-2xl"
            style={{ backgroundColor: surfaceColor, borderColor: `${primary}20` }}
          >
            <div className="flex items-center gap-5">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center flex-none shadow-md"
                style={{ backgroundColor: primary }}
              >
                <UtensilsCrossed className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-extrabold text-xl" style={{ color: textColor }}>Order Now</div>
                <div className="text-sm mt-0.5" style={{ color: `${textColor}70` }}>Browse our menu and place your order</div>
              </div>
              <ArrowRight
                className="w-6 h-6 flex-none transition-transform group-hover:translate-x-1"
                style={{ color: primary }}
              />
            </div>
          </Link>
        )}

        {showBooking && (
          <Link
            href={`/book/${outletId}`}
            className="group block rounded-3xl p-6 shadow-xl border-2 transition-all hover:-translate-y-1 hover:shadow-2xl"
            style={{ backgroundColor: surfaceColor, borderColor: `${secondary}40` }}
          >
            <div className="flex items-center gap-5">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center flex-none shadow-md"
                style={{ backgroundColor: secondary }}
              >
                <CalendarCheck className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-extrabold text-xl" style={{ color: textColor }}>Book Appointment</div>
                <div className="text-sm mt-0.5" style={{ color: `${textColor}70` }}>Schedule a session with our team</div>
              </div>
              <ArrowRight
                className="w-6 h-6 flex-none transition-transform group-hover:translate-x-1"
                style={{ color: secondary }}
              />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
