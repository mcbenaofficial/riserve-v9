'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    setError('');

    try {
      const body = mode === 'email' ? { email: value.trim() } : { phone: value.trim() };
      const res = await fetch(`${BACKEND_URL}/api/portal/customer/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Sign in failed. Please check your details.');
        return;
      }
      localStorage.setItem('portal_token', data.token);
      localStorage.setItem('portal_customer', JSON.stringify(data.customer));
      router.push('/account');
    } catch {
      setError('Could not connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-24 px-4 flex justify-center items-center min-h-[80vh]">
      <Card className="w-full max-w-[28rem] shadow-2xl rounded-[2.5rem] border-0">
        <CardHeader className="text-center space-y-3 pt-12 pb-6">
          <CardTitle className="text-5xl font-black tracking-tight text-primary">Welcome Back</CardTitle>
          <CardDescription className="text-lg text-muted-foreground/80 font-medium">
            Sign in with the email or phone you booked with.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-10 pb-12">
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-sm text-destructive font-medium">
              {error}
            </div>
          )}
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Mode toggle */}
            <div className="flex gap-2 p-1 bg-muted/40 rounded-2xl">
              {(['email', 'phone'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setValue(''); setError(''); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all capitalize ${
                    mode === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m === 'email' ? 'Email' : 'Phone'}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="value" className="font-bold text-base tracking-wide">
                {mode === 'email' ? 'Email Address' : 'Phone Number'}
              </Label>
              <Input
                id="value"
                type={mode === 'email' ? 'email' : 'tel'}
                placeholder={mode === 'email' ? 'you@example.com' : '+91 98765 43210'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-16 rounded-2xl text-lg bg-muted/40 border-0 focus-visible:ring-offset-0 focus-visible:ring-primary/50 focus-visible:bg-background transition-all"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-16 text-xl font-extrabold rounded-2xl shadow-lg mt-8 hover:-translate-y-1 hover:shadow-xl transition-all group disabled:opacity-60"
            >
              {loading ? 'Signing in…' : (
                <>Sign In <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span></>
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground font-medium">
            No account?{' '}
            <a href="/book" className="text-primary font-bold hover:underline">Book an appointment</a>
            {' '}— your account is created automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
