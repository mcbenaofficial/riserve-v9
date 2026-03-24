import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ServiceHome({ branding, services }: any) {
  const tagline = branding?.hero_tagline || "Book your glow-up with us";
  const heroImage = branding?.hero_image || "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=1200";

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-700">
      <div className="bg-primary text-primary-foreground text-center py-2.5 text-sm font-bold tracking-wide shadow-sm z-20 relative">
        ✨ Special Offer: 20% off your first booking! Use code GLOW20 ✨
      </div>

      <section className="relative w-full h-[650px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 bg-black">
          <img src={heroImage} alt="Hero" className="w-full h-full object-cover opacity-60" />
        </div>
        <div className="relative z-10 text-center text-white px-4 max-w-4xl">
          <div className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full inline-flex font-bold text-sm mb-8 tracking-widest uppercase shadow-sm border border-white/20">
            Service Mode
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tight mb-8 drop-shadow-xl leading-[1.1]">
            {tagline}
          </h1>
          <p className="text-xl md:text-2xl mb-10 mx-auto drop-shadow-lg font-medium text-white/90">
            Experience premium care and personalized treatments by top-rated professionals.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/services">
                <Button size="lg" className="h-[4.5rem] w-full sm:w-auto text-xl px-12 rounded-2xl font-black shadow-2xl hover:scale-105 transition-transform bg-primary text-primary-foreground border-2 border-primary">
                  Book Now
                </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 md:px-8 container mx-auto">
        <div className="text-center mb-16">
           <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">Popular Services</h2>
           <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">Treat yourself to our most requested services, designed to deliver exceptional results and deep relaxation.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services?.length > 0 ? services.map((s: any, i: number) => (
             <Card key={s.id} className="overflow-hidden border border-border/50 shadow-md hover:shadow-2xl transition-all hover:-translate-y-2 rounded-[2rem] group flex flex-col h-full bg-card">
               <div className="h-64 bg-muted overflow-hidden relative shrink-0">
                 <img src={`https://images.unsplash.com/photo-${"1515377905703-c4788e51af15"}?auto=format&fit=crop&q=80&w=800&sig=${i}`} alt={s.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                 <div className="absolute top-4 right-4 bg-background/95 backdrop-blur text-foreground px-4 py-2 rounded-xl text-base font-black shadow-lg">
                   ₹{s.price}
                 </div>
               </div>
               <CardContent className="p-8 flex flex-col flex-grow">
                 <h3 className="font-bold text-2xl mb-3 leading-tight">{s.name}</h3>
                 <p className="text-muted-foreground font-medium mb-8 flex-grow leading-relaxed line-clamp-3">{s.description || 'A premium service for your ultimate relaxation and rejuvenation.'}</p>
                 <Link href={`/book?service=${s.id}`}>
                    <Button className="w-full rounded-2xl h-14 text-lg font-bold shadow-md hover:-translate-y-1 transition-transform group-hover:bg-primary group-hover:text-primary-foreground">
                       Book Session
                    </Button>
                 </Link>
               </CardContent>
             </Card>
          )) : (
            <div className="col-span-3 text-center py-20 bg-muted/30 rounded-3xl border border-dashed border-border">
                <p className="text-muted-foreground mb-4">No services found in the database.</p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card text-card-foreground py-20 border-t">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
                <h3 className="font-black text-3xl mb-6">{branding?.custom_domain?.split('.')[0].toUpperCase() || 'LUMINA'}</h3>
                <p className="text-muted-foreground text-base max-w-sm mb-8 leading-relaxed font-medium">Experience the ultimate destination for luxury care and wellness. Book your appointments instantly and seamlessly.</p>
            </div>
          </div>
          <div className="pt-8 border-t border-border/40 text-center">
            <div className="inline-block bg-primary/10 px-6 py-3 rounded-full text-primary font-bold shadow-sm mb-6">
               Powered by <span className="font-black">Riserve • Service Mode</span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">© 2026 {branding?.custom_domain || 'Lumina Salon'}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
