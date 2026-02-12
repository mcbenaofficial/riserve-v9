import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import {
    Clock, Calendar, CheckCircle, XCircle, AlertCircle,
    Coffee, Briefcase, User, MapPin, ChevronRight, LogIn, LogOut,
    CalendarDays, FileText, Timer, History
} from 'lucide-react';
import { motion } from 'framer-motion';

const MyWorkspace = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('schedule');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        hoursToday: 0,
        weeklyHours: 0,
        pendingLeaves: 0,
        nextShift: null
    });
    const [attendanceStatus, setAttendanceStatus] = useState('absent'); // absent, working, on_break
    const [lastClockIn, setLastClockIn] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Data states
    const [mySchedule, setMySchedule] = useState([]);
    const [attendanceHistory, setAttendanceHistory] = useState([]);
    const [leaveRequests, setLeaveRequests] = useState([]);

    useEffect(() => {
        // Update clock every minute
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (user) {
            fetchWorkspaceData();
        }
    }, [user]);

    const fetchWorkspaceData = async () => {
        setLoading(true);
        try {
            // Parallel data fetching
            const [todayAuthRes, bookingsRes, leavesRes] = await Promise.all([
                api.getTodayAttendance(), // We'll filter this for current user client-side if needed, or backend handles it
                api.getBookings(), // Need to filter for 'my' bookings
                api.getLeaveRequests({ staff_id: user.id }) // Assuming API supports this
            ]);

            // Process Today's Attendance to find MY status
            // Note: In a real app, getTodayAttendance might return all staff. 
            // We need a specific endpoint for "My Status" or filter the list.
            // For now, let's assume we find our record in the daily list.
            const myRecord = todayAuthRes.data.staff?.find(s => s.id === user.id || s.email === user.email);

            if (myRecord) {
                setAttendanceStatus(myRecord.status);
                setLastClockIn(myRecord.clock_in);
                setStats(prev => ({
                    ...prev,
                    hoursToday: myRecord.total_hours || 0
                }));
            }

            // Process Bookings (Mock filter for now as API might return all)
            // In production, backend should support ?staff_id=X
            const myBookings = bookingsRes.data.filter(b =>
                b.resource_id === user.id || b.resource_name === user.name
            ).slice(0, 10); // Next 10
            setMySchedule(myBookings);

            setLeaveRequests(leavesRes.data || []);

        } catch (error) {
            console.error("Failed to load workspace data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleClockAction = async (action) => {
        try {
            if (action === 'in') {
                await api.clockIn({ staff_id: user.id }); // Ensure API handles identifying user
            } else {
                await api.clockOut({ staff_id: user.id });
            }
            // Refresh data
            fetchWorkspaceData();
        } catch (error) {
            console.error(`Failed to clock ${action}`, error);
            alert(`Failed to clock ${action}. Please try again.`);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5FA8D3]"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">
                        Good {currentTime.getHours() < 12 ? 'Morning' : currentTime.getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0]}
                    </h1>
                    <p className="text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                        {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>

                {/* Clock In/Out Widget */}
                <div className="bg-white dark:bg-[#12161C] p-1 rounded-2xl shadow-lg border border-[#D9DEE5] dark:border-[#1F2630] flex items-center">
                    <div className={`px-6 py-3 rounded-xl flex items-center gap-3 transition-all ${attendanceStatus === 'working'
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                        }`}>
                        <Clock size={20} />
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold uppercase tracking-wider">Status</span>
                            <span className="font-bold">{attendanceStatus === 'working' ? 'Clocked In' : 'Checked Out'}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => handleClockAction(attendanceStatus === 'working' ? 'out' : 'in')}
                        className={`ml-2 px-6 py-3 rounded-xl font-bold text-white shadow-md transition-transform active:scale-95 flex items-center gap-2 ${attendanceStatus === 'working'
                            ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700'
                            : 'bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0] hover:from-[#4A95C0] hover:to-[#3b7ea1]'
                            }`}
                    >
                        {attendanceStatus === 'working' ? (
                            <>
                                <LogOut size={18} /> Clock Out
                            </>
                        ) : (
                            <>
                                <LogIn size={18} /> Clock In
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    icon={Timer}
                    label="Hours Today"
                    value={`${stats.hoursToday || 0}h`}
                    subtext="Goal: 8h"
                    color="blue"
                />
                <StatCard
                    icon={Briefcase}
                    label="Weekly Hours"
                    value={`${stats.weeklyHours || 0}h`}
                    subtext="This Week"
                    color="purple"
                />
                <StatCard
                    icon={Calendar}
                    label="Next Shift"
                    value={stats.nextShift || "Tomorrow, 9AM"}
                    subtext="In 14 hours"
                    color="amber"
                />
                <StatCard
                    icon={FileText}
                    label="Leave Balance"
                    value="12 Days"
                    subtext="Annual Leave"
                    color="teal"
                />
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Navigation & Lists */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Tabs */}
                    <div className="bg-white dark:bg-[#12161C] rounded-2xl p-2 border border-[#D9DEE5] dark:border-[#1F2630] flex gap-2">
                        {[
                            { id: 'schedule', label: 'My Schedule', icon: CalendarDays },
                            { id: 'history', label: 'Attendance History', icon: History },
                            { id: 'leaves', label: 'Request Leave', icon: Coffee },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === tab.id
                                    ? 'bg-[#F0F7FF] dark:bg-[#5FA8D3]/10 text-[#5FA8D3]'
                                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5'
                                    }`}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white dark:bg-[#12161C] rounded-3xl border border-[#D9DEE5] dark:border-[#1F2630] overflow-hidden min-h-[400px]">

                        {activeTab === 'schedule' && (
                            <div className="p-6">
                                <h3 className="text-lg font-bold mb-4 dark:text-white">Upcoming Appointments</h3>
                                {mySchedule.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500">
                                        <Calendar size={48} className="mx-auto mb-3 opacity-20" />
                                        <p>No bookings assigned to you yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {mySchedule.map(booking => (
                                            <div key={booking.id} className="flex items-center p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-[#5FA8D3]/30 transition-all">
                                                <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center font-bold text-lg">
                                                    {new Date(booking.date).getDate()}
                                                </div>
                                                <div className="ml-4 flex-1">
                                                    <h4 className="font-semibold dark:text-gray-200">{booking.service_name}</h4>
                                                    <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                                                        <span className="flex items-center gap-1"><Clock size={12} /> {booking.time}</span>
                                                        <span className="flex items-center gap-1"><User size={12} /> {booking.customer_name}</span>
                                                    </div>
                                                </div>
                                                <button className="px-3 py-1.5 text-xs font-semibold bg-white dark:bg-white/10 dark:text-white border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50">
                                                    Details
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="p-6">
                                <h3 className="text-lg font-bold mb-4 dark:text-white">Recent Attendance</h3>
                                <div className="space-y-2">
                                    {[1, 2, 3, 4, 5].map((_, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-white/5 last:border-0">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                                                    <CheckCircle size={14} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium dark:text-gray-200">
                                                        {new Date(Date.now() - i * 86400000).toLocaleDateString()}
                                                    </div>
                                                    <div className="text-xs text-gray-500">9:00 AM - 5:00 PM</div>
                                                </div>
                                            </div>
                                            <div className="text-sm font-bold dark:text-gray-300">8h 0m</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'leaves' && (
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold dark:text-white">Leave Requests</h3>
                                    <button className="px-4 py-2 bg-[#5FA8D3] text-white rounded-xl text-sm font-semibold hover:bg-[#4A95C0]">
                                        + New Request
                                    </button>
                                </div>

                                {leaveRequests.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500">
                                        <p>No active leave requests.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {/* Mock Data for visual structure */}
                                        <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                                            <div className="flex justify-between">
                                                <span className="font-semibold text-gray-800 dark:text-gray-200">Sick Leave</span>
                                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Pending</span>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-1">Feb 20 - Feb 22 (3 Days)</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>

                {/* Right Column: Quick Actions & Notifications */}
                <div className="space-y-6">
                    <div className="bg-[#12161C] text-white rounded-3xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#5FA8D3] rounded-full blur-3xl opacity-20 -mr-10 -mt-10"></div>

                        <h3 className="text-lg font-bold mb-4 relative z-10">Quick Actions</h3>
                        <div className="grid grid-cols-2 gap-3 relative z-10">
                            <button className="p-3 bg-white/10 hover:bg-white/20 rounded-xl backdrop-blur-sm transition-all text-left">
                                <FileText className="mb-2 text-[#5FA8D3]" size={20} />
                                <div className="text-sm font-semibold">Payslip</div>
                            </button>
                            <button className="p-3 bg-white/10 hover:bg-white/20 rounded-xl backdrop-blur-sm transition-all text-left">
                                <User className="mb-2 text-[#5FA8D3]" size={20} />
                                <div className="text-sm font-semibold">Profile</div>
                            </button>
                            <button className="p-3 bg-white/10 hover:bg-white/20 rounded-xl backdrop-blur-sm transition-all text-left">
                                <AlertCircle className="mb-2 text-[#5FA8D3]" size={20} />
                                <div className="text-sm font-semibold">Report Issue</div>
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#12161C] rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
                        <h3 className="text-lg font-bold mb-4 dark:text-white">Announcements</h3>
                        <div className="space-y-4">
                            <div className="pb-4 border-b border-gray-100 dark:border-white/5 last:border-0">
                                <span className="text-xs font-bold text-[#5FA8D3] uppercase">System</span>
                                <p className="text-sm mt-1 text-gray-600 dark:text-gray-300">
                                    Office will be closed on Friday for maintenance.
                                </p>
                                <span className="text-xs text-gray-400 mt-2 block">2 hours ago</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

// Helper Component for Stats
const StatCard = ({ icon: Icon, label, value, subtext, color }) => {
    const colorMap = {
        blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
        amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        teal: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400',
    };

    return (
        <div className="bg-white dark:bg-[#12161C] p-4 rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] shadow-sm">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
                    <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{value}</h3>
                </div>
                <div className={`p-2.5 rounded-xl ${colorMap[color]}`}>
                    <Icon size={20} />
                </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 font-medium">{subtext}</p>
        </div>
    );
};

export default MyWorkspace;
