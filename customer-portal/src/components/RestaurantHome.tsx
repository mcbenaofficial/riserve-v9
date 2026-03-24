import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Flame, Leaf } from 'lucide-react';
import Link from 'next/link';

export default function RestaurantHome({ branding }: any) {
  const tagline = branding?.hero_tagline || "Order the finest dishes online.";
  const heroImage = branding?.hero_image || "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=1200";

  return (
    <div className="flex flex-col w-full animate-in fade-in duration-700">
      <section className="relative w-full min-h-[500px] flex text-left items-center justify-start overflow-hidden bg-primary px-4 md:px-16 py-20">
        <div className="absolute right-0 bottom-0 top-0 w-2/3 md:w-1/2 overflow-hidden opacity-30 md:opacity-100">
           <img src={heroImage} className="w-full h-full object-cover object-left mask-image-gradient" />
        </div>
        <div className="relative z-10 max-w-2xl text-primary-foreground">
          <div className="bg-primary-foreground/20 backdrop-blur-md px-4 py-1.5 rounded-full inline-flex font-bold text-sm mb-6 tracking-widest uppercase shadow-sm">
            Restaurant Mode
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 drop-shadow-sm leading-tight">{tagline}</h1>
          <p className="text-xl md:text-2xl mb-12 max-w-xl text-primary-foreground/90 font-medium leading-relaxed">Authentic flavors crafted by masterful chefs. Delivered hot or reserved for dine-in.</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button size="lg" className="h-[4.5rem] px-10 rounded-2xl text-xl font-black bg-white text-primary hover:bg-muted shadow-2xl hover:-translate-y-1 transition-transform">
              Order Online
            </Button>
            <Button size="lg" variant="outline" className="text-xl h-[4.5rem] px-8 rounded-2xl font-bold bg-black/10 text-white border-2 border-white/20 hover:bg-black/30 hover:text-white transition-colors">
              Reserve Table
            </Button>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 md:px-12 container mx-auto">
        <h2 className="text-4xl md:text-5xl font-black mb-16 flex items-center justify-center gap-4 text-center">
           Trending Dishes <Flame className="text-orange-500 w-10 h-10 animate-pulse" />
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
           {[
             {id: 1, name: "Truffle Mushroom Risotto", price: 649, desc: "Creamy arborio rice with black truffle shavings", img: "1624647970868-f9b8417c244c"},
             {id: 2, name: "Wood-Fired Margherita", price: 499, desc: "Classic Napoli style with fresh basil and mozzarella", img: "1574071318508-1cdbab80d002"},
             {id: 3, name: "Spicy Butter Chicken", price: 549, desc: "Rich and creamy Delhi style curry", img: "1604908176997-125f25cc6f3d"},
             {id: 4, name: "Avocado Toast", price: 349, desc: "Sourdough, smashed avocado, poached egg", img: "1525351484163-14dd80d7c358"},
           ].map((d, i) => (
             <Card key={d.id} className="overflow-hidden border border-border/50 shadow-md group hover:shadow-2xl transition-all hover:-translate-y-2 bg-card rounded-[2rem] flex flex-col h-full animate-in slide-in-from-bottom-8" style={{animationDelay: `${i*100}ms`}}>
               <div className="h-56 relative overflow-hidden shrink-0">
                 <img src={`https://images.unsplash.com/photo-${d.img}?auto=format&fit=crop&q=80&w=600`} alt={d.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 delay-100" />
                 <div className="absolute top-4 left-4 bg-white/95 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-black text-green-700 flex items-center gap-1 shadow-md uppercase tracking-wider"><Leaf className="w-3 h-3" /> Veg</div>
               </div>
               <CardContent className="p-6 flex flex-col items-start h-full">
                 <h3 className="font-bold text-2xl leading-tight mb-2 text-foreground">{d.name}</h3>
                 <p className="text-muted-foreground text-sm flex-grow mb-6 leading-relaxed line-clamp-2">{d.desc}</p>
                 <div className="mt-auto flex justify-between items-center w-full pt-4 border-t border-border/40">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Price</span>
                      <span className="font-black text-3xl text-primary leading-none">₹{d.price}</span>
                   </div>
                   <Link href="/checkout">
                     <Button size="icon" className="rounded-2xl h-14 w-14 shadow-xl hover:scale-110 transition-transform group-hover:bg-primary group-hover:text-primary-foreground text-primary-foreground bg-primary">
                        <Plus className="w-7 h-7" />
                     </Button>
                   </Link>
                 </div>
               </CardContent>
             </Card>
           ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card text-card-foreground py-16 border-t mt-auto">
        <div className="container mx-auto px-4 text-center">
            <h3 className="font-black text-3xl mb-8">{branding?.custom_domain?.split('.')[0].toUpperCase() || 'LUMINA'} CAFE</h3>
            <p className="text-muted-foreground font-medium mb-10 max-w-sm mx-auto">Experience culinary excellence delivered to your door.</p>
            <div className="inline-block bg-primary/10 px-6 py-3 rounded-full text-primary font-bold shadow-sm">
               Powered by <span className="font-black">Riserve • Restaurant Mode</span>
            </div>
            <p className="mt-8 text-sm text-muted-foreground/50 font-medium">© 2026 {branding?.custom_domain || 'Lumina Salon'}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
