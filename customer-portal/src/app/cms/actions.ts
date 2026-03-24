'use server';

import pool from '@/lib/db';
import { revalidatePath } from 'next/cache';

const COMPANY_ID = 'c71d6f4d-11aa-4aba-9f5e-1ebf8a964a32';

export async function updateBranding(formData: FormData): Promise<void> {
  const custom_domain = formData.get('custom_domain') as string;
  const hero_tagline = formData.get('hero_tagline') as string;
  const primary_color = formData.get('primary_color') as string;
  const font_family = formData.get('font_family') as string;
  const license_mode = formData.get('license_mode') as string;
  
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT general_settings FROM company_settings WHERE company_id = $1 LIMIT 1', [COMPANY_ID]);
    const settings = res.rows[0]?.general_settings || {};
    const branding = settings.branding || {};
    
    if (custom_domain) branding.custom_domain = custom_domain;
    if (hero_tagline) branding.hero_tagline = hero_tagline;
    if (primary_color) branding.primary_color = primary_color;
    if (font_family) branding.font_family = font_family;
    if (license_mode) branding.license_mode = license_mode;
    
    settings.branding = branding;
    
    await client.query('UPDATE company_settings SET general_settings = $1 WHERE company_id = $2', [settings, COMPANY_ID]);
  } finally {
    client.release();
  }
  
  // Force recreation of static pages representing the branding
  revalidatePath('/', 'layout');
}
