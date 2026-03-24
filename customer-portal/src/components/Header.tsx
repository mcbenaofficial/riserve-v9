'use client';

import Link from 'next/link';
import { useBranding } from './BrandingProvider';
import { Globe, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export default function Header({ title }: { title: string }) {
  const branding = useBranding();
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="bg-primary/10 py-1 text-xs text-center border-b flex justify-center items-center gap-2">
         <span className="font-medium text-primary">Preview Mode</span>
         <span className="text-muted-foreground hidden sm:inline">|</span>
         <span className="text-muted-foreground flex items-center gap-1 hidden sm:flex">
            <Globe className="w-3 h-3" /> {branding?.custom_domain || 'yourbusiness.com'} 
         </span>
         <span className="text-muted-foreground hidden sm:inline">|</span>
         <span className="text-muted-foreground font-semibold">Powered by Riserve</span>
      </div>
      <div className="container flex h-16 items-center justify-between mx-auto px-4 md:px-8">
        <div className="flex gap-4 items-center">
            {branding?.logo_url ? (
               <img src={branding.logo_url} alt="Logo" className="w-8 h-8 rounded-full object-cover" />
            ) : null}
            <Link href="/" className="font-bold text-xl tracking-tight">
              {branding?.custom_domain ? branding.custom_domain.split('.')[0].toUpperCase() : title}
            </Link>
        </div>
        
        {/* Desktop Nav */}
        <nav className="hidden md:flex gap-6 items-center font-medium text-sm text-foreground/80">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <Link href="/services" className="hover:text-primary transition-colors">Services</Link>
          <Link href="/team" className="hover:text-primary transition-colors">Team</Link>
          <Link href="/gallery" className="hover:text-primary transition-colors">Gallery</Link>
          <Link href="/about" className="hover:text-primary transition-colors">About</Link>
        </nav>

        <div className="flex items-center gap-4">
           <Button variant="outline" className="hidden sm:flex">Log In</Button>
           <Button className="hidden sm:flex">Book Now</Button>
           
           <Sheet>
             <SheetTrigger asChild>
               <Button variant="ghost" size="icon" className="md:hidden">
                 <Menu className="h-5 w-5" />
               </Button>
             </SheetTrigger>
             <SheetContent side="right">
               <nav className="flex flex-col gap-4 mt-8 font-medium">
                 <Link href="/">Home</Link>
                 <Link href="/services">Services</Link>
                 <Link href="/team">Team</Link>
                 <Link href="/gallery">Gallery</Link>
                 <Link href="/about">About</Link>
                 <Button className="mt-4 w-full">Book Now</Button>
                 <Button variant="outline" className="w-full">Log In</Button>
               </nav>
             </SheetContent>
           </Sheet>
        </div>
      </div>
    </header>
  );
}
