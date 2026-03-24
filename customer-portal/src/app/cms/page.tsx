import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import pool from '@/lib/db';
import { updateBranding } from './actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function CMSPage() {
  const COMPANY_ID = 'c71d6f4d-11aa-4aba-9f5e-1ebf8a964a32';
  const client = await pool.connect();
  let branding: any = {};
  try {
    const res = await client.query('SELECT general_settings FROM company_settings WHERE company_id = $1 LIMIT 1', [COMPANY_ID]);
    branding = res.rows[0]?.general_settings?.branding || {};
  } finally {
    client.release();
  }

  return (
    <div className="container mx-auto py-16 px-4 max-w-2xl">
      <Card className="rounded-3xl shadow-xl border-0 overflow-hidden">
        <CardHeader className="bg-primary/5 pb-8">
          <CardTitle className="text-3xl font-extrabold">Portal CMS Dashboard</CardTitle>
          <p className="text-muted-foreground mt-2">Instantly update the white-label branding, typography, and domains for your portal. Changes are applied globally via Server Actions.</p>
        </CardHeader>
        <CardContent className="pt-8">
          <form action={updateBranding} className="space-y-8">
            <div className="space-y-3">
              <Label htmlFor="custom_domain" className="font-semibold text-lg">Custom Domain Simulation</Label>
              <Input id="custom_domain" name="custom_domain" defaultValue={branding.custom_domain} className="h-12" />
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="hero_tagline" className="font-semibold text-lg">Hero Banner Tagline</Label>
              <Input id="hero_tagline" name="hero_tagline" defaultValue={branding.hero_tagline} className="h-12" />
            </div>

            <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="primary_color" className="font-semibold text-lg">Primary Brand Color</Label>
                  <div className="flex gap-4 items-center">
                     <Input type="color" name="primary_color" id="primary_color" defaultValue={branding.primary_color || "#D4AF37"} className="w-16 h-16 p-1 cursor-pointer rounded-xl" />
                     <span className="text-muted-foreground text-sm font-mono">{branding.primary_color || "#D4AF37"}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="font_family" className="font-semibold text-lg">Primary Font</Label>
                  <select id="font_family" name="font_family" defaultValue={branding.font_family} className="w-full border rounded-xl px-4 h-16 bg-background">
                    <option value="Inter">Inter (Clean & Modern)</option>
                    <option value="Playfair Display">Playfair (Elegant & Serif)</option>
                    <option value="Roboto">Roboto (Standard)</option>
                    <option value="Outfit">Outfit (Geometric)</option>
                  </select>
                </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border/50">
               <Label htmlFor="license_mode" className="font-extrabold text-xl text-primary">Portal License Mode</Label>
               <p className="text-sm text-muted-foreground mb-4">Phase 7: Switch between different business types dynamically.</p>
               <select id="license_mode" name="license_mode" defaultValue={branding.license_mode || 'service'} className="w-full border-2 border-primary/30 rounded-xl px-4 h-16 bg-primary/5 font-bold text-lg">
                 <option value="service" className="font-bold">Service & Salon (Booking Engine)</option>
                 <option value="restaurant" className="font-bold">Restaurant & Cafe (Menu Ordering)</option>
                 <option value="hybrid" className="font-bold">Hybrid (Services + Restaurant)</option>
               </select>
            </div>

            <div className="pt-4 border-t">
               <Button type="submit" size="lg" className="w-full text-lg h-14 rounded-full font-bold shadow-lg hover:-translate-y-1 transition-transform">
                  Save Changes & Publish
               </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
