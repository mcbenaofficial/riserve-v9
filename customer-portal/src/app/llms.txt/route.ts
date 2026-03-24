import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  const COMPANY_ID = 'c71d6f4d-11aa-4aba-9f5e-1ebf8a964a32';
  const client = await pool.connect();
  let text = "# Lumina Salon Chennai\n\n";
  try {
    const res = await client.query('SELECT * FROM company_settings WHERE company_id = $1 LIMIT 1', [COMPANY_ID]);
    const settings = res.rows[0]?.general_settings || {};
    text += `Domain: ${settings.branding?.custom_domain || 'luminasalon.com'}\n`;
    text += `Tagline: ${settings.branding?.hero_tagline || 'Book your glow-up'}\n\n`;
    
    text += "## About Us\nWe are a premium salon located in Anna Nagar, Chennai offering luxury hair, skin, and wellness treatments.\n\n";
    
    text += "## Services\n";
    const srvRes = await client.query('SELECT name, price, description FROM services WHERE company_id = $1', [COMPANY_ID]);
    srvRes.rows.forEach(s => {
      text += `- **${s.name}** (₹${s.price}): ${s.description}\n`;
    });
    
    text += "\n## How to Book\n";
    text += "Customers can book instantly online by visiting /services and selecting a professional and time slot. We accept UPI, Cards, and Wallets.\n";
  } catch (e) {
    console.error("LLMs text rendering error", e);
  } finally {
    client.release();
  }

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
