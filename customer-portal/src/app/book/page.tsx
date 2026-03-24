import { Suspense } from 'react';
import BookingFlow from './BookingFlow';
import pool from '@/lib/db';

export default async function BookPage({ searchParams }: { searchParams: { service?: string } }) {
  const COMPANY_ID = 'c71d6f4d-11aa-4aba-9f5e-1ebf8a964a32';
  const client = await pool.connect();
  let services = [];
  let staffs = [];
  try {
    const sRes = await client.query('SELECT id, name, price, duration_minutes FROM services WHERE company_id = $1', [COMPANY_ID]);
    services = sRes.rows;
    // Attempt to fetch staff (using users table with specific role)
    const stRes = await client.query("SELECT id, name, role FROM users WHERE company_id = $1 AND role IN ('Admin', 'Staff')", [COMPANY_ID]);
    staffs = stRes.rows.map(s => ({ id: s.id, name: s.name, role: 'Senior Stylist', photo: `https://i.pravatar.cc/150?u=${s.id}` }));
  } catch (e) {
    console.error("error fetching book data", e);
  } finally {
    client.release();
  }

  // Add highly-polished fake staff if the DB comes up empty for demo visuals
  if (staffs.length === 0) {
     staffs = [
       { id: '1', name: 'Alia Bhatt', role: 'Artistic Director', photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200' },
       { id: '2', name: 'Sara Khan', role: 'Senior Stylist', photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200' },
       { id: '3', name: 'Rohan Sharma', role: 'Color Expert', photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=200' }
     ];
  }

  return (
    <div className="container mx-auto py-16 px-4 md:px-8 max-w-5xl">
       <Suspense fallback={<div className="text-center py-32 text-2xl font-bold animate-pulse text-primary">Loading Booking Engine...</div>}>
         <BookingFlow 
            initialServiceId={searchParams.service} 
            services={services}
            staffs={staffs}
         />
       </Suspense>
    </div>
  );
}
