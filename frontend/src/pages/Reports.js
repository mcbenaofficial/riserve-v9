import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  TrendingUp, Calendar, DollarSign, Star, Users, Clock, 
  ArrowUpRight, ArrowDownRight, Store, Wrench, Heart, Smile, Meh, Frown,
  BarChart3, PieChart, MessageSquare
} from 'lucide-react';

const Reports = () => {
  const [reports, setReports] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [services, setServices] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30days');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [reportsRes, bookingsRes, transactionsRes, servicesRes, outletsRes, feedbackRes] = await Promise.all([
        api.getReports(),
        api.getBookings(),
        api.getTransactions(),
        api.getServices(),
        api.getOutlets(),
        api.getFeedbackStats().catch(() => ({ data: null }))
      ]);
      setReports(reportsRes.data);
      setBookings(bookingsRes.data);
      setTransactions(transactionsRes.data);
      setServices(servicesRes.data);
      setOutlets(outletsRes.data);
      setFeedbackStats(feedbackRes.data);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const completedBookings = bookings.filter(b => b.status === 'Completed');
  const pendingBookings = bookings.filter(b => b.status === 'Pending' || b.status === 'In Progress');
  const cancelledBookings = bookings.filter(b => b.status === 'Cancelled');
  
  const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
  const avgBookingValue = completedBookings.length > 0 ? totalRevenue / completedBookings.length : 0;
  
  // Service breakdown
  const serviceBreakdown = services.map(service => {
    const serviceBookings = bookings.filter(b => b.service_id === service.id);
    const completed = serviceBookings.filter(b => b.status === 'Completed');
    return {
      ...service,
      totalBookings: serviceBookings.length,
      completedBookings: completed.length,
      revenue: completed.reduce((sum, b) => sum + (b.amount || 0), 0)
    };
  }).sort((a, b) => b.totalBookings - a.totalBookings);

  // Status breakdown
  const statusBreakdown = [
    { status: 'Completed', count: completedBookings.length, color: 'bg-green-500' },
    { status: 'Pending', count: pendingBookings.length, color: 'bg-blue-500' },
    { status: 'Cancelled', count: cancelledBookings.length, color: 'bg-red-500' }
  ];

  const getEmoji = (rating) => {
    switch (rating) {
      case 1: return { icon: Frown, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' };
      case 2: return { icon: Frown, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' };
      case 3: return { icon: Meh, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' };
      case 4: return { icon: Smile, color: 'text-lime-500', bg: 'bg-lime-100 dark:bg-lime-900/30' };
      case 5: return { icon: Heart, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' };
      default: return { icon: Star, color: 'text-gray-400', bg: 'bg-gray-100' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-[#4B5563] dark:text-[#7D8590]">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Reports & Analytics</h1>
          <p className="text-[#6B7280] dark:text-[#7D8590] mt-1">Business performance overview</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-[#0E1116] dark:text-[#E6E8EB]"
        >
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
          <option value="90days">Last 90 Days</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Bookings"
          value={bookings.length}
          icon={Calendar}
          color="from-blue-500 to-indigo-500"
          subtitle={`${pendingBookings.length} pending`}
        />
        <MetricCard
          title="Total Revenue"
          value={`₹${totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          color="from-green-500 to-emerald-500"
          subtitle={`Avg: ₹${avgBookingValue.toFixed(0)}`}
        />
        <MetricCard
          title="Completion Rate"
          value={`${bookings.length > 0 ? ((completedBookings.length / bookings.length) * 100).toFixed(0) : 0}%`}
          icon={TrendingUp}
          color="from-purple-500 to-pink-500"
          subtitle={`${completedBookings.length} completed`}
        />
        <MetricCard
          title="Customer Rating"
          value={feedbackStats?.average_rating || '—'}
          icon={Star}
          color="from-amber-500 to-orange-500"
          subtitle={feedbackStats ? `${feedbackStats.total_responses} reviews` : 'No reviews'}
        />
      </div>

      {/* Customer Satisfaction Section */}
      {feedbackStats && feedbackStats.total_responses > 0 && (
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Star size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Customer Satisfaction</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#7D8590]">{feedbackStats.total_responses} responses collected</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Average Rating Display */}
            <div className="text-center p-6 bg-[#F6F7F9] dark:bg-[#12161C] rounded-2xl">
              <div className="text-5xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-2">
                {feedbackStats.average_rating}
              </div>
              <div className="flex justify-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={24}
                    className={star <= Math.round(feedbackStats.average_rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                  />
                ))}
              </div>
              <div className="text-sm text-[#6B7280] dark:text-[#7D8590]">Average Rating</div>
            </div>

            {/* Satisfaction Score */}
            <div className="text-center p-6 bg-[#F6F7F9] dark:bg-[#12161C] rounded-2xl">
              <div className="text-5xl font-bold text-green-500 mb-2">
                {feedbackStats.satisfaction_score}%
              </div>
              <div className="text-sm text-[#6B7280] dark:text-[#7D8590] mb-2">Satisfaction Score</div>
              <div className="text-xs text-[#6B7280] dark:text-[#7D8590]">4 & 5 star ratings</div>
            </div>

            {/* Rating Distribution */}
            <div className="p-4 bg-[#F6F7F9] dark:bg-[#12161C] rounded-2xl">
              <div className="text-sm font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-3">Distribution</div>
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = feedbackStats.rating_distribution?.[rating] || 0;
                const percent = feedbackStats.total_responses > 0 ? (count / feedbackStats.total_responses) * 100 : 0;
                const emoji = getEmoji(rating);
                const EmojiIcon = emoji.icon;
                
                return (
                  <div key={rating} className="flex items-center gap-2 mb-2">
                    <EmojiIcon size={16} className={emoji.color} />
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-[#1F2630] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          rating >= 4 ? 'bg-green-500' : rating === 3 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#6B7280] w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Feedback */}
          {feedbackStats.recent_feedback && feedbackStats.recent_feedback.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase tracking-wider mb-3">
                Recent Feedback
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {feedbackStats.recent_feedback.slice(0, 4).map((fb) => {
                  const emoji = getEmoji(fb.rating);
                  const EmojiIcon = emoji.icon;
                  
                  return (
                    <div key={fb.id} className="flex items-start gap-3 p-3 bg-[#F6F7F9] dark:bg-[#12161C] rounded-xl">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${emoji.bg}`}>
                        <EmojiIcon size={18} className={emoji.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#0E1116] dark:text-[#E6E8EB] text-sm">
                            {fb.customer_name || 'Customer'}
                          </span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={12}
                                className={star <= fb.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                              />
                            ))}
                          </div>
                        </div>
                        {fb.comment && (
                          <p className="text-xs text-[#4B5563] dark:text-[#A9AFB8] mt-1 truncate">
                            "{fb.comment}"
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Booking Status & Service Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking Status */}
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
              <PieChart size={20} className="text-white" />
            </div>
            <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Booking Status</h3>
          </div>

          <div className="space-y-4">
            {statusBreakdown.map((item) => {
              const percent = bookings.length > 0 ? (item.count / bookings.length) * 100 : 0;
              return (
                <div key={item.status}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8]">{item.status}</span>
                    <span className="text-sm font-bold text-[#0E1116] dark:text-[#E6E8EB]">
                      {item.count} ({percent.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-[#1F2630] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-[#D9DEE5] dark:border-[#1F2630]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6B7280] dark:text-[#7D8590]">Total Bookings</span>
              <span className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">{bookings.length}</span>
            </div>
          </div>
        </div>

        {/* Service Performance */}
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <BarChart3 size={20} className="text-white" />
            </div>
            <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Service Performance</h3>
          </div>

          {serviceBreakdown.length > 0 ? (
            <div className="space-y-3">
              {serviceBreakdown.slice(0, 5).map((service, index) => (
                <div key={service.id} className="flex items-center gap-4 p-3 bg-[#F6F7F9] dark:bg-[#12161C] rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-[#5FA8D3]/20 flex items-center justify-center font-bold text-[#5FA8D3] text-sm">
                    #{index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[#0E1116] dark:text-[#E6E8EB] text-sm truncate">
                      {service.name}
                    </div>
                    <div className="text-xs text-[#6B7280] dark:text-[#7D8590]">
                      {service.totalBookings} bookings • ₹{service.revenue.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#0E1116] dark:text-[#E6E8EB]">
                      {service.completedBookings}
                    </div>
                    <div className="text-xs text-[#6B7280]">completed</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[#6B7280] dark:text-[#7D8590]">
              <Wrench size={48} className="mx-auto mb-4 opacity-30" />
              <p>No service data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Revenue Overview */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <DollarSign size={20} className="text-white" />
          </div>
          <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Revenue Overview</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-[#F6F7F9] dark:bg-[#12161C] rounded-xl">
            <div className="text-sm text-[#6B7280] dark:text-[#7D8590]">Gross Revenue</div>
            <div className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">
              ₹{totalRevenue.toLocaleString()}
            </div>
          </div>
          <div className="p-4 bg-[#F6F7F9] dark:bg-[#12161C] rounded-xl">
            <div className="text-sm text-[#6B7280] dark:text-[#7D8590]">Avg. Booking Value</div>
            <div className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">
              ₹{avgBookingValue.toFixed(0)}
            </div>
          </div>
          <div className="p-4 bg-[#F6F7F9] dark:bg-[#12161C] rounded-xl">
            <div className="text-sm text-[#6B7280] dark:text-[#7D8590]">Commission (15%)</div>
            <div className="text-2xl font-bold text-amber-500">
              ₹{(totalRevenue * 0.15).toLocaleString()}
            </div>
          </div>
          <div className="p-4 bg-[#F6F7F9] dark:bg-[#12161C] rounded-xl">
            <div className="text-sm text-[#6B7280] dark:text-[#7D8590]">Net Earnings</div>
            <div className="text-2xl font-bold text-green-500">
              ₹{(totalRevenue * 0.85).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${color}`}>
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-white/80">{title}</div>
        <div className="text-2xl font-bold text-white mt-1">{value}</div>
        {subtitle && <div className="text-xs text-white/60 mt-1">{subtitle}</div>}
      </div>
      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
        <Icon size={20} className="text-white" />
      </div>
    </div>
  </div>
);

export default Reports;
