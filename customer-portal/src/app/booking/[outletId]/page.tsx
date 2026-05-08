import BookingClient from './BookingClient';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export default async function BookingPage({ params }: { params: Promise<{ outletId: string }> }) {
  const { outletId } = await params;

  let portalData: any = null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/public/booking-portal/${outletId}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      portalData = await res.json();
    }
  } catch (e) {
    console.error('Failed to fetch booking portal:', e);
  }

  if (!portalData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-800">Booking Not Available</h1>
          <p className="text-gray-500">Unable to load the booking portal. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <BookingClient
      outletId={outletId}
      outlet={portalData.outlet}
      company={portalData.company}
      services={portalData.services}
      slot_config={portalData.slot_config}
    />
  );
}
