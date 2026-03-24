import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Crown, Clock, MapPin, Search } from 'lucide-react';
import Link from 'next/link';

export default function AccountPage() {
  return (
    <div className="container mx-auto py-16 px-4 md:px-8 max-w-6xl">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-16 gap-8">
         <div className="flex items-center gap-6">
            <div className="w-28 h-28 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-4xl shadow-xl border-[6px] border-background relative">
               PS
               <div className="absolute -bottom-2 -right-2 bg-yellow-500 rounded-full p-2 border-2 border-background shadow-sm">
                  <Crown className="w-5 h-5 text-white" />
               </div>
            </div>
            <div>
               <h1 className="text-5xl font-black tracking-tight mb-2">Priya Sharma</h1>
               <p className="text-muted-foreground font-bold tracking-wide flex items-center gap-2 uppercase text-sm">VIP Member Status</p>
            </div>
         </div>
         <Button className="rounded-2xl shadow-sm h-14 px-8 text-lg font-bold hover:scale-105 transition-transform" variant="outline">Edit Profile</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
        {/* Loyalty Points */}
        <Card className="col-span-1 border-0 shadow-lg rounded-3xl overflow-hidden relative group bg-card">
           <div className="absolute top-0 right-0 bg-yellow-500/10 w-48 h-48 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
           <CardHeader className="pb-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground/80">Loyalty Points</CardTitle>
           </CardHeader>
           <CardContent>
              <div className="text-6xl font-black text-foreground mb-6 tracking-tighter">1,450</div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-4 shadow-inner">
                 <div className="h-full bg-yellow-500 w-[60%] shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
              </div>
              <p className="text-sm text-foreground/80 font-semibold leading-relaxed">Book 2 more sessions to unlock Platinum Tier & 20% off all services.</p>
           </CardContent>
        </Card>

        {/* AI Notification Banner */}
        <Card className="col-span-1 lg:col-span-2 border-0 shadow-2xl rounded-3xl overflow-hidden bg-primary text-primary-foreground relative">
           <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent"></div>
           <CardContent className="p-10 flex flex-col justify-center h-full relative z-10">
              <div className="flex items-start gap-6">
                 <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center shrink-0 shadow-xl border border-white/10">
                    <span className="text-3xl">✨</span>
                 </div>
                 <div>
                    <h3 className="font-extrabold text-3xl mb-3 tracking-tight">Welcome back, Priya!</h3>
                    <p className="text-primary-foreground/90 font-medium text-lg mb-8 leading-relaxed max-w-lg">Your favorite stylist <strong className="text-white font-black">Alia Bhatt</strong> has an open slot this Saturday at 2:00 PM for your usual Signature Facial.</p>
                    <Button variant="secondary" className="rounded-2xl font-black h-14 px-8 text-lg shadow-xl hover:scale-105 transition-transform">
                       Book My Usual Now
                    </Button>
                 </div>
              </div>
           </CardContent>
        </Card>
      </div>

      <h2 className="text-3xl font-extrabold mb-8 tracking-tight">Upcoming Appointments</h2>
      <Card className="border-0 shadow-md rounded-[2rem] overflow-hidden mb-20 bg-muted/10">
        <CardContent className="p-0">
           <div className="p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 bg-card hover:bg-muted/10 transition-colors">
              <div className="bg-primary text-primary-foreground w-28 h-28 rounded-[1.5rem] flex flex-col items-center justify-center shrink-0 shadow-lg">
                 <span className="text-xs font-black uppercase tracking-widest opacity-80 mb-1">Oct</span>
                 <span className="text-4xl font-black">24</span>
              </div>
              <div className="flex-grow text-center md:text-left">
                 <h3 className="text-3xl font-bold mb-3 tracking-tight">Signature Hydrating Facial</h3>
                 <p className="text-muted-foreground font-semibold text-sm flex flex-col md:flex-row items-center justify-center md:justify-start gap-4 md:gap-6 bg-muted/30 w-fit px-4 py-2 rounded-xl mx-auto md:mx-0">
                    <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> 2:30 PM - 3:30 PM</span>
                    <span className="hidden md:inline text-muted-foreground/30">|</span>
                    <span className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Lumina Salon, Anna Nagar</span>
                 </p>
              </div>
              <div className="flex flex-col gap-4 shrink-0 w-full md:w-40 mt-6 md:mt-0">
                 <Button className="w-full rounded-2xl font-bold text-lg h-14 shadow-lg hover:-translate-y-1 transition-transform">Check In</Button>
                 <Button variant="outline" className="w-full rounded-2xl font-bold text-md h-14 bg-background">Reschedule</Button>
              </div>
           </div>
        </CardContent>
      </Card>

      <h2 className="text-3xl font-extrabold mb-8 tracking-tight">Past Visits</h2>
      <Card className="border-0 shadow-sm rounded-[2rem] overflow-hidden bg-muted/20">
         <CardContent className="p-16 text-center">
            <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-bold text-lg">No past visits recorded.</p>
         </CardContent>
      </Card>
    </div>
  );
}
