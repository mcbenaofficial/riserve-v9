import { Button } from '@/components/ui/button';
import pool from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, PlusCircle } from 'lucide-react';
import Link from 'next/link';

export default async function ServicesPage() {
  const COMPANY_ID = 'c71d6f4d-11aa-4aba-9f5e-1ebf8a964a32';
  
  const client = await pool.connect();
  let services: any[] = [];
  try {
    const srvRes = await client.query('SELECT * FROM services WHERE company_id = $1', [COMPANY_ID]);
    services = srvRes.rows;
  } catch(e) {
    console.error("error fetching services", e);
  } finally {
    client.release();
  }

  // Predefined salon image IDs for demo
  const photos = ["1560066984-138dadb4c035", "1515377905703-c4788e51af15", "1600880292203-757bb62b4baf", "1522337660859-02fbefca4702"];

  return (
    <div className="container mx-auto py-20 px-4 md:px-8">
      <div className="text-center mb-20">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 text-primary">Discover Our Services</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Explore our premium catalog. Book the perfect treatment tailored specifically for your needs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {services.length > 0 ? services.map((s, i) => (
             <Card key={s.id} className="overflow-hidden border border-border shadow-lg hover:shadow-2xl transition-all rounded-[2rem] flex flex-col group">
               <div className="h-72 bg-muted relative overflow-hidden">
                 <img src={`https://images.unsplash.com/photo-${photos[i % photos.length]}?auto=format&fit=crop&q=80&w=800`} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
                 <div className="absolute top-4 right-4 bg-background/95 backdrop-blur text-foreground px-4 py-2 rounded-full text-base font-extrabold shadow-xl flex items-center gap-2">
                   ₹{s.price}
                 </div>
               </div>
               <CardContent className="p-8 flex flex-col flex-grow bg-card">
                 <h3 className="font-bold text-2xl leading-tight mb-4">{s.name}</h3>
                 
                 <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-6 bg-primary/10 w-fit px-4 py-1.5 rounded-full">
                    <Clock className="w-4 h-4" />
                    {s.duration_minutes || 60} mins
                 </div>

                 <p className="text-muted-foreground text-sm mb-6 flex-grow leading-relaxed">
                   {s.description || 'Experience ultimate care with our signature treatment, designed specifically for deep relaxation and visible rejuvenation.'}
                 </p>

                 {s.price > 1000 && (
                   <div className="mb-6 p-4 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900 flex items-start gap-3">
                     <span className="text-xl">🌟</span>
                     <div>
                       <h4 className="text-xs font-bold text-orange-800 dark:text-orange-400 mb-1">Premium Resource Required</h4>
                       <p className="text-xs text-orange-700/80 dark:text-orange-300/80">Uses premium mask — only 2 left in stock currently.</p>
                     </div>
                   </div>
                 )}
                 
                 <Link href={`/book?service=${s.id}`} className="w-full mt-auto">
                    <Button className="w-full rounded-2xl h-14 text-lg font-bold shadow-md hover:-translate-y-1 transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                      Select & Book Now
                    </Button>
                 </Link>
               </CardContent>
             </Card>
          )) : (
            <div className="col-span-1 md:col-span-3 text-center py-32 bg-muted/20 rounded-[3rem] border-2 border-dashed border-border">
                <div className="text-6xl mb-6 opacity-40">✂️</div>
                <h3 className="text-2xl font-bold mb-2">No Services Yet</h3>
                <p className="text-muted-foreground">Our menu is currently being updated. Please check back later.</p>
            </div>
          )}
      </div>
    </div>
  );
}
