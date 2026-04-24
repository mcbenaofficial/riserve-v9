import { Suspense } from 'react';
import BookingClient from './BookingClient';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

export default async function DynamicBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ outletId: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { outletId } = await params;
  const { service: initialServiceId } = await searchParams;

  let portalData: any = null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/public/book/${outletId}`, {
      cache: 'no-store',
    });
    if (res.ok) portalData = await res.json();
  } catch (e) {
    console.error('Failed to fetch booking portal data:', e);
  }

  if (!portalData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-gray-800">Portal Not Available</h1>
          <p className="text-gray-500">Unable to load the booking portal. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl font-bold animate-pulse">Loading Booking Portal...</div>
      </div>
    }>
      <BookingClient
        outletId={outletId}
        outlet={portalData.outlet}
        services={portalData.services}
        staff={portalData.staff}
        initialServiceId={initialServiceId}
      />
    </Suspense>
  );
}
