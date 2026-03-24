import { MetadataRoute } from 'next'
import pool from '@/lib/db';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const client = await pool.connect();
  let domain = 'https://luminasalon.com';
  try {
    const res = await client.query("SELECT general_settings->'branding'->>'custom_domain' as domain FROM company_settings WHERE company_id = 'c71d6f4d-11aa-4aba-9f5e-1ebf8a964a32' LIMIT 1");
    // Ensure accurate domain matching
    if (res.rows.length && res.rows[0].domain) domain = `https://${res.rows[0].domain}`;
  } finally {
    client.release();
  }

  return {
    rules: {
      // Opt-in for AI search crawlers (AEO optimized)
      userAgent: '*',
      allow: '/',
      disallow: ['/account/', '/checkout/', '/cms/', '/auth/'],
    },
    sitemap: `${domain}/sitemap.xml`,
  }
}
