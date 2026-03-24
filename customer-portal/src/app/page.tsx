import pool from '@/lib/db';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const COMPANY_ID = '3821aa11-8386-452d-b6be-174ef77d1970';

export default async function HomePage() {
  const client = await pool.connect();
  let company: any = null;
  let outlet: any = null;
  
  try {
    const compRes = await client.query('SELECT id, name, business_type FROM companies WHERE id = $1 LIMIT 1', [COMPANY_ID]);
    company = compRes.rows[0];
    
    if (company) {
      const outRes = await client.query('SELECT id, name, location, portal_logo_url, portal_color_scheme FROM outlets WHERE company_id = $1 LIMIT 1', [COMPANY_ID]);
      outlet = outRes.rows[0];
    }
  } catch(e) {
    console.error(e);
  } finally {
    client.release();
  }

  // If we have a restaurant outlet, redirect directly to the menu
  if (outlet && company?.business_type === 'restaurant') {
    redirect(`/menu/${outlet.id}`);
  }

  // Fallback: show a simple landing if no outlet found
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-5xl font-black tracking-tight">{company?.name || 'Ri\'Serve'}</h1>
        <p className="text-xl text-gray-300">Loading your experience...</p>
        {outlet && (
          <Link 
            href={`/menu/${outlet.id}`}
            className="inline-block bg-white text-gray-900 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-100 transition-colors"
          >
            View Menu
          </Link>
        )}
      </div>
    </div>
  );
}
