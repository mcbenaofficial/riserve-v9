'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { X, Send, Sparkles, Mic } from 'lucide-react';

export default function AIConcierge() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi Priya! I noticed you usually book a facial around this time. Shall I find a slot with Alia for this weekend?" }
  ]);
  const [input, setInput] = useState('');

  const send = (e: any) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages([...messages, { role: 'user', text: input }]);
    setInput('');
    setTimeout(() => {
       setMessages(prev => [...prev, { role: 'assistant', text: "I've checked Alia's schedule. She has an opening at 2:00 PM this Saturday. Should I lock that in for you? I can process the payment instantly." }]);
    }, 1500);
  };

  return (
    <>
      {!isOpen && (
        <Button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 md:bottom-10 md:right-10 w-20 h-20 rounded-full shadow-[0_0_30px_rgba(212,175,55,0.4)] z-50 animate-bounce flex items-center justify-center p-0 group bg-primary text-primary-foreground border-4 border-background"
        >
          <Sparkles className="w-10 h-10 group-hover:rotate-12 transition-transform" />
          <span className="absolute top-0 right-0 bg-red-500 text-white text-sm font-black w-6 h-6 rounded-full border-2 border-background animate-pulse flex items-center justify-center shadow-lg">1</span>
        </Button>
      )}

      {isOpen && (
        <Card className="fixed bottom-6 right-6 md:bottom-10 md:right-10 w-[90vw] md:w-[420px] h-[650px] shadow-2xl z-50 flex flex-col border border-border/50 rounded-[2.5rem] overflow-hidden animate-in slide-in-from-bottom-12 duration-500 bg-background">
          <CardHeader className="bg-primary text-primary-foreground p-8 flex flex-row items-center justify-between border-b-0 space-y-0 h-32 shrink-0">
             <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-white/20 rounded-[1.5rem] flex items-center justify-center backdrop-blur-md border border-white/30 shadow-inner shrink-0">
                   <Sparkles className="w-8 h-8" />
                </div>
                <div>
                   <CardTitle className="text-3xl font-extrabold tracking-tight mb-1">Riserve AI</CardTitle>
                   <p className="text-sm font-bold text-primary-foreground/90 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,1)]"></span> Virtual Concierge</p>
                </div>
             </div>
             <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="hover:bg-white/20 rounded-full text-white w-12 h-12">
               <X className="w-8 h-8" />
             </Button>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-6 bg-muted/20 space-y-6 flex flex-col pt-8">
             <div className="text-center mb-2">
                <span className="bg-background px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase text-muted-foreground shadow-sm">Today</span>
             </div>
             {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                   <div className={`max-w-[85%] p-5 rounded-3xl text-[15px] leading-relaxed font-medium shadow-md ${m.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border/50 text-foreground rounded-bl-sm'}`}>
                      {m.text}
                      {m.role === 'assistant' && i === 0 && (
                         <div className="mt-5 flex flex-col gap-3">
                            <Button size="sm" variant="secondary" className="w-full justify-start rounded-2xl h-12 px-5 font-bold shadow-sm bg-primary/10 text-primary border-0 hover:bg-primary hover:text-primary-foreground transition-all">Yes, lock in 2:00 PM</Button>
                            <Button size="sm" variant="outline" className="w-full justify-start rounded-2xl h-12 px-5 font-bold border-border bg-background">Show me other times</Button>
                         </div>
                      )}
                   </div>
                </div>
             ))}
          </CardContent>

          <div className="p-5 bg-card border-t border-border/50 shrink-0">
             <form onSubmit={send} className="relative flex items-center">
                <Input 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask your concierge anything..." 
                  className="pr-28 h-16 rounded-[2rem] bg-muted/40 border-0 focus-visible:ring-primary/50 text-base font-medium shadow-inner"
                />
                <div className="absolute right-2 flex gap-1.5">
                   <Button type="button" size="icon" variant="ghost" className="w-12 h-12 rounded-full text-muted-foreground hover:text-primary hover:bg-muted/50"><Mic className="w-6 h-6" /></Button>
                   <Button type="submit" size="icon" className="w-12 h-12 rounded-full shadow-lg hover:scale-105 transition-transform bg-primary text-primary-foreground"><Send className="w-5 h-5 ml-1" /></Button>
                </div>
             </form>
             <p className="text-xs text-center mt-4 text-muted-foreground/80 font-bold flex items-center justify-center gap-1.5 tracking-wide">
                <Sparkles className="w-3 h-3" /> Powered by Riserve AI Marketing Layer
             </p>
          </div>
        </Card>
      )}
    </>
  );
}
