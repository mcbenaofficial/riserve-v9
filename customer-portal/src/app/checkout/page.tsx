'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, CreditCard, Download, Receipt, Sparkles, Smartphone, ShieldCheck, Crown } from 'lucide-react';
import Link from 'next/link';

export default function CheckoutPage() {
   const [step, setStep] = useState(1);
   const [paymentMethod, setPaymentMethod] = useState('');
   const [processing, setProcessing] = useState(false);

   const price = 2499;
   const discount = 499;
   const total = price - discount;

   const handlePay = () => {
      setProcessing(true);
      // Simulate network wait for transaction
      setTimeout(() => {
         setProcessing(false);
         setStep(3);
      }, 2500);
   };

   return (
      <div className="container mx-auto py-16 px-4 md:px-8 max-w-6xl">
         <h1 className="text-5xl font-extrabold tracking-tight mb-12 text-center text-primary">Complete Your Booking</h1>
         
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Left Column: Form / Steps */}
            <div className="lg:col-span-2 space-y-10">
               
               {step === 1 && (
                  <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-500">
                     <div className="bg-primary/5 p-10 border-b border-primary/10">
                        <h2 className="text-3xl font-extrabold flex items-center gap-4">
                           <span className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg shadow-inner">1</span> 
                           Your Details
                        </h2>
                     </div>
                     <CardContent className="p-10 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <div className="space-y-3">
                              <Label className="font-bold text-base">First Name</Label>
                              <Input defaultValue="Priya" className="h-16 text-lg rounded-2xl bg-muted/40 border-0 focus-visible:ring-primary/50 transition-all" />
                           </div>
                           <div className="space-y-3">
                              <Label className="font-bold text-base">Last Name</Label>
                              <Input defaultValue="Sharma" className="h-16 text-lg rounded-2xl bg-muted/40 border-0 focus-visible:ring-primary/50 transition-all" />
                           </div>
                        </div>
                        <div className="space-y-3">
                           <Label className="font-bold text-base">Email Address</Label>
                           <Input type="email" defaultValue="priya@example.com" className="h-16 text-lg rounded-2xl bg-muted/40 border-0 focus-visible:ring-primary/50 transition-all" />
                        </div>
                        <div className="space-y-3">
                           <Label className="font-bold text-base">Phone Number</Label>
                           <Input type="tel" defaultValue="+91 98765 43210" className="h-16 text-lg rounded-2xl bg-muted/40 border-0 focus-visible:ring-primary/50 transition-all" />
                        </div>
                        <Button className="w-full h-16 text-xl rounded-2xl font-extrabold mt-6 shadow-xl hover:-translate-y-1 transition-transform" onClick={() => setStep(2)}>Secure & Continue</Button>
                     </CardContent>
                  </Card>
               )}

               {step === 2 && (
                  <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden animate-in slide-in-from-right-8 duration-500 relative bg-card">
                     {processing && (
                        <div className="absolute inset-0 bg-background/85 backdrop-blur-xl z-50 flex flex-col items-center justify-center">
                           <div className="relative">
                              <ShieldCheck className="w-24 h-24 text-primary animate-pulse mb-6 opacity-20" />
                              <div className="absolute inset-0 w-24 h-24 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                           </div>
                           <h3 className="text-3xl font-extrabold tracking-tight">Processing Payment...</h3>
                           <p className="text-muted-foreground mt-4 font-medium text-lg">Connecting securely to payment gateway.</p>
                        </div>
                     )}
                     <div className="bg-primary/5 p-10 border-b border-primary/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h2 className="text-3xl font-extrabold flex items-center gap-4">
                           <span className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg shadow-inner">2</span> 
                           Payment Method
                        </h2>
                        <Button variant="ghost" className="font-bold rounded-full" onClick={() => setStep(1)}>Edit Details</Button>
                     </div>
                     <CardContent className="p-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                           <Card className={`cursor-pointer border-2 rounded-3xl transition-all duration-300 ${paymentMethod === 'upi' ? 'border-primary bg-primary/5 ring-4 ring-primary/20 shadow-md scale-[1.02]' : 'hover:border-primary/50 border-border/60 hover:shadow-sm'}`} onClick={() => setPaymentMethod('upi')}>
                              <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-5">
                                 <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center shadow-sm">
                                     <Smartphone className="w-8 h-8 text-primary" />
                                 </div>
                                 <div className="font-bold text-xl">UPI / QR</div>
                                 <p className="text-sm text-muted-foreground font-medium">GPay, PhonePe, Paytm</p>
                              </CardContent>
                           </Card>
                           <Card className={`cursor-pointer border-2 rounded-3xl transition-all duration-300 ${paymentMethod === 'card' ? 'border-primary bg-primary/5 ring-4 ring-primary/20 shadow-md scale-[1.02]' : 'hover:border-primary/50 border-border/60 hover:shadow-sm'}`} onClick={() => setPaymentMethod('card')}>
                              <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-5">
                                 <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center shadow-sm">
                                     <CreditCard className="w-8 h-8 text-primary" />
                                 </div>
                                 <div className="font-bold text-xl">Credit Card</div>
                                 <p className="text-sm text-muted-foreground font-medium">Visa, Mastercard, RuPay</p>
                              </CardContent>
                           </Card>
                        </div>
                        
                        {paymentMethod === 'card' && (
                           <div className="space-y-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-muted/20 p-8 rounded-[2rem] border border-border/50">
                              <Input placeholder="Card Number" className="h-16 text-lg rounded-2xl bg-background shadow-sm" />
                              <div className="grid grid-cols-2 gap-6">
                                 <Input placeholder="MM/YY" className="h-16 text-lg rounded-2xl bg-background shadow-sm" />
                                 <Input placeholder="CVV" type="password" className="h-16 text-lg rounded-2xl bg-background shadow-sm" />
                              </div>
                              <Input placeholder="Name on Card" className="h-16 text-lg rounded-2xl bg-background shadow-sm" />
                           </div>
                        )}

                        {paymentMethod === 'upi' && (
                           <div className="text-center py-10 px-6 bg-muted/20 rounded-[2rem] mb-10 border border-border/50 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-inner">
                              <div className="w-56 h-56 bg-white mx-auto border-4 border-muted p-3 rounded-3xl flex items-center justify-center shadow-md">
                                 <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=riserve@okhdfcbank" alt="UPI QR" className="opacity-90" />
                              </div>
                              <p className="mt-8 font-bold text-lg text-foreground/80">Scan with any UPI App or enter ID below</p>
                              <Input placeholder="example@upi" className="max-w-sm mx-auto mt-6 text-center h-16 text-lg rounded-2xl bg-background shadow-sm" />
                           </div>
                        )}

                        <Button className="w-full h-20 text-2xl rounded-2xl font-black shadow-xl hover:-translate-y-1 transition-all" disabled={!paymentMethod} onClick={handlePay}>
                           Pay ₹{total} Safely
                        </Button>
                        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-green-700 dark:text-green-500 font-bold bg-green-100 dark:bg-green-950/30 w-fit mx-auto px-4 py-2 rounded-full">
                           <ShieldCheck className="w-5 h-5" /> PCI DSS Compliant. Fully Encrypted.
                        </div>
                     </CardContent>
                  </Card>
               )}

               {step === 3 && (
                  <Card className="rounded-[3rem] border-0 shadow-2xl overflow-hidden py-20 px-4 animate-in zoom-in-95 duration-700 text-center bg-card">
                     <div className="w-36 h-36 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-10 shadow-[0_0_50px_rgba(34,197,94,0.2)]">
                        <CheckCircle2 className="w-20 h-20" />
                     </div>
                     <h2 className="text-5xl font-black mb-6 text-foreground tracking-tight">Payment Successful!</h2>
                     <p className="text-xl text-muted-foreground mb-12 max-w-md mx-auto leading-relaxed font-medium">Your booking is confirmed and paid. The invoice has been emailed to <strong className="text-foreground">priya@example.com</strong>.</p>
                     
                     <div className="flex flex-col sm:flex-row justify-center gap-6 mb-20 px-8">
                        <Button variant="outline" className="h-16 rounded-2xl px-8 font-bold text-lg shadow-sm border-2"><Receipt className="mr-3 w-6 h-6" /> View Receipt</Button>
                        <Link href="/account">
                           <Button className="h-16 rounded-2xl px-10 font-bold text-lg shadow-lg">Go to Dashboard</Button>
                        </Link>
                     </div>

                     {/* AI Upsell Area */}
                     <div className="mx-4 sm:mx-10 bg-gradient-to-br from-orange-100 to-amber-50 dark:from-orange-950/40 dark:to-orange-900/40 p-10 sm:p-12 rounded-[2.5rem] text-left border-2 border-orange-200 dark:border-orange-800 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500">
                        <div className="absolute -right-10 -top-10 text-[10rem] opacity-5">✨</div>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10">
                           <div className="flex-1">
                              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-black tracking-widest uppercase text-sm mb-4 bg-orange-200 dark:bg-orange-900/50 w-fit px-3 py-1.5 rounded-full shadow-sm">
                                 <Sparkles className="w-4 h-4" /> Recommended for you
                              </div>
                              <h3 className="text-3xl font-extrabold mb-4 text-orange-950 dark:text-orange-50 tracking-tight leading-tight">Add a Premium Hair Spa while you're here?</h3>
                              <p className="text-orange-900/80 dark:text-orange-100/70 mb-8 max-w-md font-medium text-lg leading-relaxed">Based on your past visits, a 45-min deep hydration spa perfectly complements your facial treatment today.</p>
                              <div className="flex gap-4 items-end">
                                 <span className="text-5xl font-black text-orange-600 dark:text-orange-400 drop-shadow-sm">₹499</span>
                                 <span className="line-through text-orange-900/50 dark:text-orange-100/40 font-bold text-xl mb-1.5">₹999</span>
                              </div>
                           </div>
                           <Button size="lg" className="shrink-0 h-16 rounded-2xl px-10 font-extrabold shadow-xl bg-orange-600 hover:bg-orange-700 text-white text-lg w-full md:w-auto hover:-translate-y-1 transition-all">Add to Cart</Button>
                        </div>
                     </div>
                  </Card>
               )}
            </div>

            {/* Right Column: Order Summary */}
            <div className={`hidden lg:block ${step === 3 ? 'opacity-30 pointer-events-none transition-opacity duration-1000' : ''}`}>
               <Card className="rounded-[2.5rem] border-0 shadow-2xl sticky top-28 overflow-hidden bg-card">
                  <div className="bg-muted/40 p-8 border-b border-border/50">
                     <h3 className="text-2xl font-extrabold">Order Summary</h3>
                  </div>
                  <CardContent className="p-8 space-y-8">
                     <div className="flex justify-between items-start gap-4 pb-6 border-b border-border/50">
                        <div>
                           <div className="font-bold text-xl leading-snug mb-1">Signature Hydrating Facial</div>
                           <div className="text-sm font-semibold text-primary bg-primary/10 w-fit px-3 py-1 rounded-lg mt-3">Sat at 2:00 PM</div>
                        </div>
                        <div className="font-bold text-xl">₹{price}</div>
                     </div>
                     <div className="flex justify-between items-center text-green-600 dark:text-green-500 font-bold text-lg">
                        <div className="flex items-center gap-2"><Crown className="w-5 h-5"/> VIP Discount</div>
                        <div>- ₹{discount}</div>
                     </div>
                     <div className="pt-8 flex justify-between items-center text-3xl">
                        <div className="font-black">Total</div>
                        <div className="font-black text-primary drop-shadow-sm">₹{total}</div>
                     </div>
                  </CardContent>
               </Card>
            </div>
         </div>
      </div>
   );
}
