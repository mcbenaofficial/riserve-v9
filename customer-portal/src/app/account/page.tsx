'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Crown, Clock, MapPin, LogOut, RefreshCw } from 'lucide-react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  total_bookings: number;
  total_revenue: number;
  membership: {
    id: string;
    status: string;
    credits_balance: number;
    expires_at: string | null;
    plan_name: string | null;
  } | null;
}

interface Booking {
  id: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  amount: number;
  notes: string;
}

const STATUS_STYLES: Record<string, string> = {
  Completed: 'bg-green-500/10 text-green-700 dark:text-green-400',
  Pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  Cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
  Confirmed: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
};

function apiFetch(path: string, token: string) {
  return fetch(`${BACKEND_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
}

export default function AccountPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const token = typeof window !== 'undefined' ? localStorage.getItem('portal_token') : null;

  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    loadProfile();
  }, []);

  useEffect(() => {
    if (token && customer) loadBookings();
  }, [page, customer]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/portal/customer/me', token!);
      if (res.status === 401) { localStorage.removeItem('portal_token'); router.replace('/login'); return; }
      const data = await res.json();
      setCustomer(data);
    } catch {
      setError('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    try {
      const res = await apiFetch(`/api/portal/customer/bookings?page=${page}&page_size=5`, token!);
      const data = await res.json();
      setBookings(data.items || []);
      setTotalBookings(data.total || 0);
      setPages(data.pages || 1);
    } catch {}
  };

  const signOut = () => {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_customer');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="container mx-auto py-24 flex justify-center items-center">
        <RefreshCw className="animate-spin text-muted-foreground w-8 h-8" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="container mx-auto py-24 text-center">
        <p className="text-muted-foreground mb-4">{error || 'Could not load your account.'}</p>
        <Button onClick={() => router.push('/login')}>Sign In Again</Button>
      </div>
    );
  }

  const initials = customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const hasMembership = !!customer.membership && customer.membership.status === 'active';

  const upcomingBookings = bookings.filter(b => b.status === 'Pending' || b.status === 'Confirmed');
  const pastBookings = bookings.filter(b => b.status === 'Completed' || b.status === 'Cancelled');

  return (
    <div className="container mx-auto py-16 px-4 md:px-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-16 gap-8">
        <div className="flex items-center gap-6">
          <div className="w-28 h-28 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-black text-4xl shadow-xl border-[6px] border-background relative">
            {initials}
            {hasMembership && (
              <div className="absolute -bottom-2 -right-2 bg-yellow-500 rounded-full p-2 border-2 border-background shadow-sm">
                <Crown className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-1">{customer.name}</h1>
            <p className="text-muted-foreground font-medium text-sm">
              {customer.email || customer.phone}
              {hasMembership && (
                <span className="ml-3 inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400 font-bold">
                  <Crown className="w-3.5 h-3.5" /> {customer.membership!.plan_name || 'Member'}
                </span>
              )}
            </p>
          </div>
        </div>
        <Button onClick={signOut} variant="outline" className="rounded-2xl h-12 px-6 font-bold flex items-center gap-2">
          <LogOut className="w-4 h-4" /> Sign Out
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
        {/* Credits / Membership */}
        <Card className="col-span-1 border-0 shadow-lg rounded-3xl overflow-hidden relative group bg-card">
          <div className="absolute top-0 right-0 bg-yellow-500/10 w-48 h-48 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <CardHeader className="pb-4">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground/80">
              {hasMembership ? 'Credits Balance' : 'Total Bookings'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-6xl font-black text-foreground mb-4 tracking-tighter">
              {hasMembership
                ? customer.membership!.credits_balance.toLocaleString()
                : customer.total_bookings}
            </div>
            <p className="text-sm text-foreground/70 font-semibold">
              {hasMembership
                ? `${customer.membership!.plan_name} — ${customer.membership!.status}`
                : `₹${customer.total_revenue.toLocaleString('en-IN')} total spent`}
            </p>
            {hasMembership && customer.membership!.expires_at && (
              <p className="text-xs text-muted-foreground mt-2">
                Expires {new Date(customer.membership!.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Stats card */}
        <Card className="col-span-1 lg:col-span-2 border-0 shadow-lg rounded-3xl bg-card">
          <CardContent className="p-8 grid grid-cols-2 gap-6 h-full items-center">
            {[
              { label: 'Total Visits', value: customer.total_bookings },
              { label: 'Total Spent', value: `₹${customer.total_revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
              { label: 'Upcoming', value: upcomingBookings.length },
              { label: 'Membership', value: hasMembership ? 'Active' : 'None' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 mb-1">{label}</p>
                <p className="text-3xl font-black text-foreground">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Appointments */}
      {upcomingBookings.length > 0 && (
        <>
          <h2 className="text-3xl font-extrabold mb-6 tracking-tight">Upcoming Appointments</h2>
          <div className="space-y-4 mb-16">
            {upcomingBookings.map(b => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        </>
      )}

      {/* Booking History */}
      <h2 className="text-3xl font-extrabold mb-6 tracking-tight">Booking History</h2>
      {bookings.length === 0 ? (
        <Card className="border-0 shadow-md rounded-3xl">
          <CardContent className="p-12 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-semibold">No bookings yet.</p>
            <Button className="mt-6 rounded-2xl" onClick={() => router.push('/book')}>Book Your First Appointment</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 mb-8">
          {bookings.map(b => (
            <BookingCard key={b.id} booking={b} compact />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 mb-20">
          <Button variant="outline" className="rounded-2xl" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Previous</Button>
          <span className="text-sm text-muted-foreground font-semibold">{page} / {pages}</span>
          <Button variant="outline" className="rounded-2xl" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next →</Button>
        </div>
      )}
    </div>
  );
}

function BookingCard({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const dateObj = booking.date ? new Date(booking.date + 'T00:00:00') : null;
  const month = dateObj?.toLocaleString('en-IN', { month: 'short' });
  const day = dateObj?.getDate();
  const statusClass = STATUS_STYLES[booking.status] || 'bg-muted text-muted-foreground';

  if (compact) {
    return (
      <Card className="border-0 shadow-sm rounded-2xl overflow-hidden bg-card">
        <CardContent className="p-5 flex items-center gap-5">
          <div className="bg-muted text-foreground w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 font-black text-center">
            <span className="text-[10px] uppercase tracking-wider opacity-60">{month}</span>
            <span className="text-xl">{day}</span>
          </div>
          <div className="flex-1">
            <p className="font-bold text-foreground">{booking.time || 'Time TBD'}</p>
            <p className="text-sm text-muted-foreground">{booking.notes || 'Appointment'} · {booking.duration ? `${booking.duration} min` : ''}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-bold text-foreground">₹{(booking.amount || 0).toLocaleString('en-IN')}</span>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusClass}`}>{booking.status}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md rounded-[2rem] overflow-hidden mb-4 bg-card">
      <CardContent className="p-8 md:p-10 flex flex-col md:flex-row items-center gap-8">
        <div className="bg-primary text-primary-foreground w-24 h-24 rounded-[1.5rem] flex flex-col items-center justify-center shrink-0 shadow-lg">
          <span className="text-xs font-black uppercase tracking-widest opacity-80 mb-1">{month}</span>
          <span className="text-3xl font-black">{day}</span>
        </div>
        <div className="flex-grow text-center md:text-left">
          <p className="text-2xl font-bold mb-2">{booking.notes || 'Appointment'}</p>
          <p className="text-muted-foreground font-semibold text-sm flex items-center justify-center md:justify-start gap-4">
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary" />{booking.time || 'TBD'}</span>
            {booking.duration && <span>{booking.duration} min</span>}
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 shrink-0">
          <span className="text-xl font-black">₹{(booking.amount || 0).toLocaleString('en-IN')}</span>
          <span className={`text-xs font-bold px-4 py-2 rounded-full ${statusClass}`}>{booking.status}</span>
        </div>
      </CardContent>
    </Card>
  );
}
