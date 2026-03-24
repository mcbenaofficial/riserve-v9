import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="container mx-auto py-24 px-4 flex justify-center items-center">
      <Card className="w-full max-w-[28rem] shadow-2xl rounded-[2.5rem] border-0">
        <CardHeader className="text-center space-y-3 pt-12 pb-6">
          <CardTitle className="text-5xl font-black tracking-tight text-primary">Welcome Back</CardTitle>
          <CardDescription className="text-lg text-muted-foreground/80 font-medium">Sign in securely to manage your bookings and loyalty points.</CardDescription>
        </CardHeader>
        <CardContent className="px-10 pb-12">
          {/* Action is faked to redirect directly to /account for demo */}
          <form className="space-y-6" action="/account">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-bold text-base tracking-wide">Email Address</Label>
              <Input id="email" type="email" placeholder="you@example.com" className="h-16 rounded-2xl text-lg bg-muted/40 border-0 focus-visible:ring-offset-0 focus-visible:ring-primary/50 focus-visible:bg-background transition-all" required />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                 <Label htmlFor="password" className="font-bold text-base tracking-wide">Password</Label>
                 <Link href="#" className="font-bold text-sm text-primary hover:underline hover:opacity-80 transition-opacity">Forgot password?</Link>
              </div>
              <Input id="password" type="password" className="h-16 rounded-2xl text-lg bg-muted/40 border-0 focus-visible:ring-offset-0 focus-visible:ring-primary/50 focus-visible:bg-background transition-all" required />
            </div>
            
            <Button type="submit" className="w-full h-16 text-xl font-extrabold rounded-2xl shadow-lg mt-8 hover:-translate-y-1 hover:shadow-xl transition-all group">
              Sign In Securely <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
            </Button>
          </form>

          <div className="relative my-10">
             <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/40" /></div>
             <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-4 text-muted-foreground font-black tracking-widest">Or continue with</span></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <Button variant="outline" className="h-16 rounded-2xl text-md font-bold text-foreground/80 hover:text-foreground hover:bg-muted/40 border-border/70"><span className="mr-3 text-xl">✨</span> Magic Link</Button>
             <Button variant="outline" className="h-16 rounded-2xl text-md font-bold text-foreground/80 hover:text-foreground hover:bg-muted/40 border-border/70">
                <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                   <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                   <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                   <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                   <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
             </Button>
          </div>

          <p className="text-center text-sm text-foreground/80 font-medium mt-12 bg-muted/20 py-4 rounded-xl">
            Don't have an account? <Link href="/signup" className="text-primary hover:underline font-black ml-1">Create One</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
