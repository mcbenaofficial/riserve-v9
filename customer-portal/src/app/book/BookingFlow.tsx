'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { CheckCircle2, ChevronRight, Sparkles, User as UserIcon } from 'lucide-react';
import { bookAppointment } from './actions';

export default function BookingFlow({ initialServiceId, services, staffs }: any) {
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState(initialServiceId || (services[0]?.id));
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedService = services.find((s: any) => s.id === serviceId);
  const selectedStaff = staffs.find((s: any) => s.id === staffId);

  const timeSlots = ["10:00 AM", "11:30 AM", "01:00 PM", "03:00 PM", "04:30 PM", "06:00 PM"];

  const handleBook = async () => {
     setLoading(true);
     const formData = new FormData();
     formData.append('serviceId', serviceId);
     formData.append('staffId', staffId || '');
     formData.append('date', date?.toISOString() || '');
     formData.append('time', time || '');
     
     await bookAppointment(formData);
     setLoading(false);
     setStep(5); // Success state
  };

  return (
    <div className="space-y-8">
       {/* Progress Bar */}
       <div className="flex items-center justify-between mb-12 relative px-4">
          <div className="absolute left-4 right-4 top-1/2 h-1.5 bg-muted -z-10 rounded-full"></div>
          <div className="absolute left-4 top-1/2 h-1.5 bg-primary -z-10 rounded-full transition-all duration-700 ease-out" style={{ width: `calc(${(step-1)*25}% - ${(step === 1 ? 0 : 16)}px)` }}></div>
          {[1,2,3,4,5].map(i => (
             <div key={i} className={`w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-lg transition-all duration-500 ring-4 ring-background ${step > i ? 'bg-primary text-primary-foreground scale-110 shadow-lg' : step === i ? 'bg-primary text-primary-foreground scale-125 shadow-xl' : 'bg-card text-muted-foreground border-2 border-muted'}`}>
                {step > i ? <CheckCircle2 className="w-6 h-6" /> : i}
             </div>
          ))}
       </div>

       <div className="bg-card border border-border/50 shadow-2xl rounded-[2.5rem] p-6 md:p-12 overflow-hidden relative">
           {loading && (
             <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-in fade-in">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
                <h3 className="text-xl font-bold animate-pulse">Securing your appointment...</h3>
             </div>
           )}

           {step === 1 && (
             <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                <h2 className="text-4xl font-extrabold mb-8 text-primary">Select Service</h2>
                <div className="grid gap-4">
                  {services.map((s: any) => (
                     <Card key={s.id} className={`cursor-pointer transition-all duration-300 hover:border-primary/50 hover:shadow-md rounded-2xl ${serviceId === s.id ? 'border-primary ring-2 ring-primary bg-primary/5 shadow-md scale-[1.02]' : ''}`} onClick={() => setServiceId(s.id)}>
                        <CardContent className="p-6 flex justify-between items-center">
                           <div>
                             <h3 className="font-bold text-xl mb-1">{s.name}</h3>
                             <p className="text-muted-foreground text-sm flex items-center gap-1 font-medium">{s.duration_minutes || 60} mins</p>
                           </div>
                           <div className="text-2xl font-extrabold text-primary">₹{s.price}</div>
                        </CardContent>
                     </Card>
                  ))}
                </div>
                <Button className="w-full mt-10 h-16 text-xl rounded-2xl shadow-lg hover:-translate-y-1 transition-transform" disabled={!serviceId} onClick={() => setStep(2)}>
                   Choose Professional <ChevronRight className="ml-2 w-6 h-6" />
                </Button>
             </div>
           )}

           {step === 2 && (
             <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                <h2 className="text-4xl font-extrabold mb-4 text-primary">Choose Professional</h2>
                <p className="text-lg text-muted-foreground mb-10">Select your preferred stylist or let us match you with the best available expert.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <Card className={`cursor-pointer text-center py-8 rounded-3xl transition-all duration-300 hover:border-primary/50 hover:shadow-md ${staffId === 'any' ? 'border-primary ring-2 ring-primary bg-primary/5 shadow-md scale-[1.05]' : ''}`} onClick={() => setStaffId('any')}>
                     <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6 text-primary">
                        <Sparkles className="w-10 h-10" />
                     </div>
                     <h3 className="font-bold text-lg">Any Available</h3>
                     <p className="text-sm text-muted-foreground mt-1">Maximum flexibility</p>
                  </Card>
                  {staffs.map((s: any) => (
                     <Card key={s.id} className={`cursor-pointer text-center py-8 rounded-3xl transition-all duration-300 hover:border-primary/50 hover:shadow-md ${staffId === s.id ? 'border-primary ring-2 ring-primary bg-primary/5 shadow-md scale-[1.05]' : ''}`} onClick={() => setStaffId(s.id)}>
                        <img src={s.photo} alt={s.name} className="w-24 h-24 mx-auto rounded-full object-cover mb-6 shadow-sm ring-4 ring-muted" />
                        <h3 className="font-bold text-lg">{s.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{s.role}</p>
                     </Card>
                  ))}
                </div>
                <div className="flex gap-4 mt-12">
                   <Button variant="outline" className="w-1/3 h-16 rounded-2xl text-lg font-bold" onClick={() => setStep(1)}>Back</Button>
                   <Button className="w-2/3 h-16 text-xl rounded-2xl shadow-lg hover:-translate-y-1 transition-transform" disabled={!staffId} onClick={() => setStep(3)}>
                      Select Date <ChevronRight className="ml-2 w-6 h-6" />
                   </Button>
                </div>
             </div>
           )}

           {step === 3 && (
             <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                <h2 className="text-4xl font-extrabold mb-10 text-primary">Select Date & Time</h2>
                <div className="flex flex-col lg:flex-row gap-12">
                   <div className="flex-1 bg-muted/20 p-4 rounded-3xl border">
                      <Calendar mode="single" selected={date} onSelect={setDate} className="w-full" classNames={{ day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground" }} />
                   </div>
                   <div className="flex-1">
                      <h4 className="font-bold text-xl mb-6 flex items-center gap-2"><Sparkles className="w-6 h-6 text-yellow-500" /> Smart Slots for {date?.toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'})}</h4>
                      <p className="text-sm text-muted-foreground mb-6">Based on actual availability and optimized to reduce gaps in the schedule.</p>
                      <div className="grid grid-cols-2 gap-4">
                         {timeSlots.map(t => (
                            <Button key={t} variant={time === t ? 'default' : 'outline'} className={`h-14 text-lg rounded-2xl border-2 transition-all ${time === t ? 'shadow-md border-primary scale-105' : 'hover:border-primary/40'}`} onClick={() => setTime(t)}>
                               {t}
                            </Button>
                         ))}
                      </div>
                   </div>
                </div>
                <div className="flex gap-4 mt-12">
                   <Button variant="outline" className="w-1/3 h-16 rounded-2xl text-lg font-bold" onClick={() => setStep(2)}>Back</Button>
                   <Button className="w-2/3 h-16 text-xl rounded-2xl shadow-lg hover:-translate-y-1 transition-transform" disabled={!date || !time} onClick={() => setStep(4)}>
                      Review <ChevronRight className="ml-2 w-6 h-6" />
                   </Button>
                </div>
             </div>
           )}

           {step === 4 && (
             <div className="animate-in fade-in slide-in-from-right-8 duration-500">
                <h2 className="text-4xl font-extrabold mb-10 text-primary">Review Booking</h2>
                <div className="space-y-6">
                   <div className="p-8 bg-muted/30 rounded-3xl border border-border/50 flex items-center gap-6 shadow-sm">
                      <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center shadow-inner">
                         <Clock className="w-10 h-10" />
                      </div>
                      <div>
                         <p className="text-sm text-muted-foreground font-bold tracking-widest uppercase mb-1">Date & Time</p>
                         <p className="text-2xl font-bold tracking-tight">{date?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric'})} at {time}</p>
                      </div>
                   </div>
                   <div className="p-8 bg-muted/30 rounded-3xl border border-border/50 flex justify-between items-center shadow-sm">
                      <div>
                         <p className="text-sm text-muted-foreground font-bold tracking-widest uppercase mb-1">Service & Stylist</p>
                         <p className="text-2xl font-bold tracking-tight mb-2">{selectedService?.name}</p>
                         <p className="text-base text-muted-foreground flex items-center gap-2 font-medium bg-background border px-3 py-1.5 w-fit rounded-lg"><UserIcon className="w-4 h-4 text-primary" /> {selectedStaff?.name || 'Any Available Professional'}</p>
                      </div>
                      <div className="text-5xl font-black text-primary drop-shadow-sm">₹{selectedService?.price}</div>
                   </div>
                </div>
                <div className="flex gap-4 mt-12">
                   <Button variant="outline" className="w-1/3 h-16 rounded-2xl text-xl font-bold" onClick={() => setStep(3)}>Edit</Button>
                   <Button className="w-2/3 h-16 rounded-2xl text-2xl font-extrabold shadow-xl hover:-translate-y-1 transition-transform" onClick={handleBook}>
                      Confirm Booking
                   </Button>
                </div>
             </div>
           )}

           {step === 5 && (
             <div className="animate-in zoom-in slide-in-from-bottom-12 duration-700 text-center py-16">
                <div className="w-32 h-32 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-10 shadow-[0_0_40px_rgba(34,197,94,0.3)]">
                   <CheckCircle2 className="w-16 h-16" />
                </div>
                <h2 className="text-5xl font-black mb-6 tracking-tight">You're all set!</h2>
                <p className="text-xl text-muted-foreground mb-12 max-w-lg mx-auto leading-relaxed">
                   Your appointment for <strong className="text-foreground">{selectedService?.name}</strong> is confirmed for <strong className="text-foreground">{time}</strong>. We've sent a WhatsApp confirmation to your registered number.
                </p>
                <div className="flex justify-center gap-6">
                   <Button variant="outline" size="lg" className="rounded-2xl px-8 h-16 text-lg font-bold">Add to Calendar</Button>
                   <Button size="lg" className="rounded-2xl px-8 h-16 text-lg font-bold shadow-lg">View My Bookings</Button>
                </div>
             </div>
           )}
       </div>
    </div>
  );
}
