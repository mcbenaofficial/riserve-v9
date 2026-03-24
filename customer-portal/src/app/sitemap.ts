import { MetadataRoute } from 'next'
import pool from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const COMPANY_ID = 'c71d6f4d-11aa-4aba-9f5e-1ebf8a964a32';
  
  const client = await pool.connect();
  let domain = 'https://luminasalon.com';
  let services: any[] = [];
  try {
    const res = await client.query('SELECT general_settings FROM company_settings WHERE company_id = $1 LIMIT 1', [COMPANY_ID]);
    const branding = res.rows[0]?.general_settings?.branding || {};
    domain = `https://${branding.custom_domain || 'luminasalon.com'}`;
    
    const srvRes = await client.query('SELECT id FROM services WHERE company_id = $1', [COMPANY_ID]);
    services = srvRes.rows;
  } finally {
    client.release();
  }

  const routes = ['', '/about', '/contact', '/services', '/team', '/gallery', '/faq'].map((route) => ({
    url: `${domain}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as any,
    priority: route === '' ? 1 : 0.8,
  }));
  
  const serviceRoutes = services.map((s) => ({
    url: `${domain}/book?service=${s.id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as any,
    priority: 0.9,
  }));

  return [...routes, ...serviceRoutes];
}
