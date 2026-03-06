import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import {
    Clock, Calendar, CheckCircle, XCircle, AlertCircle,
    Coffee, Briefcase, User, MapPin, ChevronRight, LogIn, LogOut,
    CalendarDays, FileText, Timer, History, DollarSign, TrendingUp,
    Plus, X, ChevronDown, Download, Eye, Loader, RefreshCw,
    Award, Zap, BarChart2, Star
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────
const fmt12 = (iso) => {
    if (!iso) return '--';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};
const fmtDate = (s) => {
    if (!s) return '';
    const d = new Date(s + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};
const elapsed = (clockIn) => {
    const diff = (Date.now() - new Date(clockIn)) / 3600000;
    const h = Math.floor(diff);
    const m = Math.round((diff - h) * 60);
    return `${h}h ${m}m`;
};
const LEAVE_TYPES = [
    { id: 'annual', label: 'Annual Leave', color: 'blue' },
    { id: 'sick', label: 'Sick Leave', color: 'red' },
    { id: 'emergency', label: 'Emergency Leave', color: 'orange' },
    { id: 'maternity', label: 'Maternity/Paternity', color: 'purple' },
    { id: 'unpaid', label: 'Unpaid Leave', color: 'gray' },
];
const LEAVE_COLORS = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};
const STATUS_COLORS = {
    present: 'bg-green-500',
    absent: 'bg-red-400',
    half_day: 'bg-yellow-400',
    leave: 'bg-blue-400',
    not_clocked_in: 'bg-gray-300 dark:bg-gray-600',
};

// ─── StatCard ───────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, subtext, color }) => {
    const colorMap = {
        blue: 'bg-blue-50/80 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        purple: 'bg-purple-50/80 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
        amber: 'bg-amber-50/80 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
        teal: 'bg-teal-50/80 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400',
        green: 'bg-green-50/80 text-green-600 dark:bg-green-900/20 dark:text-green-400',
        rose: 'bg-rose-50/80 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
    };
    return (
        <div className="bg-white dark:bg-[#12161C] p-5 rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
                    <h3 className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{value}</h3>
                </div>
                <div className={`p-2.5 rounded-xl ${colorMap[color] || colorMap.blue}`}>
                    <Icon size={20} />
                </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 font-medium">{subtext}</p>
        </div>
    );
};

// ─── ClockWidget ─────────────────────────────────────────────────────────
const ClockWidget = ({ stats, onClockIn, onClockOut, loading }) => {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setTick(p => p + 1), 30000);
        return () => clearInterval(t);
    }, []);

    const isClockedIn = stats?.is_clocked_in;
    const clockInTime = stats?.clock_in_time;
    const hoursToday = isClockedIn && clockInTime
        ? parseFloat(elapsed(clockInTime))
        : (stats?.hours_today || 0);

    return (
        <div className={`flex items-center gap-3 rounded-2xl p-1.5 border ${isClockedIn
            ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
            : 'bg-white dark:bg-[#12161C] border-[#D9DEE5] dark:border-[#1F2630]'
            } shadow-sm`}>
            <div className={`px-5 py-3 rounded-xl flex items-center gap-3 ${isClockedIn
                ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}>
                <Clock size={18} />
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Status</p>
                    <p className="font-bold text-sm leading-tight">
                        {isClockedIn ? `In · ${elapsed(clockInTime)}` : 'Not clocked in'}
                    </p>
                </div>
            </div>
            <button
                onClick={isClockedIn ? onClockOut : onClockIn}
                disabled={loading}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white text-sm shadow-md transition-all active:scale-95 disabled:opacity-60 ${isClockedIn
                    ? 'bg-gradient-to-r from-rose-500 to-pink-600 hover:opacity-90'
                    : 'bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0] hover:opacity-90'
                    }`}
            >
                {loading ? <Loader size={16} className="animate-spin" /> :
                    isClockedIn ? <><LogOut size={16} />Clock Out</> : <><LogIn size={16} />Clock In</>
                }
            </button>
        </div>
    );
};

// ─── Tabs ────────────────────────────────────────────────────────────────
const TABS = [
    { id: 'today', label: 'Today', icon: Zap },
    { id: 'schedule', label: 'Schedule', icon: CalendarDays },
    { id: 'attendance', label: 'Attendance', icon: History },
    { id: 'leaves', label: 'Leaves', icon: Coffee },
    { id: 'payslips', label: 'Payslips', icon: DollarSign },
];

// ─── LeaveModal ───────────────────────────────────────────────────────────
const LeaveModal = ({ onClose, onSubmit, submitting }) => {
    const [form, setForm] = useState({
        leave_type: 'annual',
        start_date: '',
        end_date: '',
        reason: '',
    });
    const days = form.start_date && form.end_date
        ? Math.max(0, (new Date(form.end_date) - new Date(form.start_date)) / 86400000) + 1
        : 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#12161C] rounded-3xl shadow-2xl w-full max-w-lg border border-[#D9DEE5] dark:border-[#1F2630]">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/5">
                    <h2 className="text-lg font-bold dark:text-white">New Leave Request</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl">
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Leave Type</label>
                        <select
                            value={form.leave_type}
                            onChange={e => setForm(p => ({ ...p, leave_type: e.target.value }))}
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]"
                        >
                            {LEAVE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">From</label>
                            <input type="date" value={form.start_date}
                                onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">To</label>
                            <input type="date" value={form.end_date}
                                onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                                min={form.start_date || new Date().toISOString().split('T')[0]}
                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]" />
                        </div>
                    </div>
                    {days > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-sm font-semibold text-blue-700 dark:text-blue-400 text-center">
                            {days} day{days > 1 ? 's' : ''} of leave requested
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Reason (optional)</label>
                        <textarea
                            value={form.reason}
                            onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                            rows={3}
                            placeholder="Briefly describe your reason..."
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-[#5FA8D3] resize-none"
                        />
                    </div>
                </div>
                <div className="px-6 pb-6 flex gap-3">
                    <button onClick={onClose}
                        className="flex-1 py-3 rounded-xl font-semibold border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-sm">
                        Cancel
                    </button>
                    <button
                        disabled={!form.start_date || !form.end_date || submitting}
                        onClick={() => onSubmit(form)}
                        className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0] text-white hover:opacity-90 disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2">
                        {submitting ? <Loader size={16} className="animate-spin" /> : null}
                        Submit Request
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── PayslipDetailModal ───────────────────────────────────────────────────
const PayslipDetailModal = ({ payslip, onClose }) => {
    if (!payslip) return null;
    const Row = ({ label, value, bold }) => (
        <div className={`flex justify-between py-2.5 border-b border-gray-100 dark:border-white/5 last:border-0 ${bold ? 'font-bold' : ''}`}>
            <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
            <span className={`text-sm dark:text-white ${bold ? 'text-gray-900' : 'text-gray-800'}`}>₹{Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
    );
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#12161C] rounded-3xl shadow-2xl w-full max-w-lg border border-[#D9DEE5] dark:border-[#1F2630] max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-[#12161C] flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/5 z-10">
                    <div>
                        <h2 className="text-lg font-bold dark:text-white">{payslip.pay_period_label}</h2>
                        <p className="text-sm text-gray-500">Pay Slip</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl">
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>
                <div className="p-6 space-y-5">
                    {/* Attendance */}
                    <div className="grid grid-cols-4 gap-3 text-center">
                        {[
                            { label: 'Days Present', val: payslip.attendance?.days_present ?? '--' },
                            { label: 'Days Absent', val: payslip.attendance?.days_absent ?? '--' },
                            { label: 'Leaves', val: payslip.attendance?.leaves_taken ?? '--' },
                            { label: 'Hours', val: payslip.attendance?.hours_worked ? `${payslip.attendance.hours_worked}h` : '--' },
                        ].map(i => (
                            <div key={i.label} className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                                <p className="text-xl font-bold dark:text-white">{i.val}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">{i.label}</p>
                            </div>
                        ))}
                    </div>
                    {/* Earnings */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-[#5FA8D3] mb-2">Earnings</p>
                        <div className="bg-gray-50 dark:bg-white/5 rounded-2xl px-4">
                            <Row label="Basic Salary" value={payslip.earnings?.basic_salary} />
                            <Row label="Allowances" value={payslip.earnings?.allowances} />
                            <Row label="Overtime Pay" value={payslip.earnings?.overtime_pay} />
                            <Row label="Commission" value={payslip.earnings?.commission} />
                            <Row label="Bonus" value={payslip.earnings?.bonus} />
                            <Row label="Gross Pay" value={payslip.earnings?.gross_pay} bold />
                        </div>
                    </div>
                    {/* Deductions */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-rose-500 mb-2">Deductions</p>
                        <div className="bg-gray-50 dark:bg-white/5 rounded-2xl px-4">
                            <Row label="Income Tax" value={payslip.deductions?.tax} />
                            <Row label="Provident Fund" value={payslip.deductions?.provident_fund} />
                            <Row label="Other Deductions" value={payslip.deductions?.other} />
                            <Row label="Total Deductions" value={payslip.deductions?.total} bold />
                        </div>
                    </div>
                    {/* Net Pay */}
                    <div className="bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0] rounded-2xl p-5 text-white text-center">
                        <p className="text-sm opacity-80">Net Pay</p>
                        <p className="text-3xl font-bold mt-1">₹{Number(payslip.net_pay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
const MyWorkspace = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('today');
    const [loading, setLoading] = useState(true);
    const [clockLoading, setClockLoading] = useState(false);
    const [hasStaffProfile, setHasStaffProfile] = useState(true);

    // Data
    const [stats, setStats] = useState(null);
    const [schedule, setSchedule] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [payslips, setPayslips] = useState([]);
    const [payslipDetail, setPayslipDetail] = useState(null);

    // UI state
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [leaveSubmitting, setLeaveSubmitting] = useState(false);
    const [toast, setToast] = useState(null);
    const [tick, setTick] = useState(0);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Live clock tick every minute
    useEffect(() => {
        const t = setInterval(() => setTick(p => p + 1), 60000);
        return () => clearInterval(t);
    }, []);

    const loadStats = useCallback(async () => {
        try {
            const r = await api.portalStats();
            setStats(r.data);
        } catch (e) {
            if (e.response?.status === 404) setHasStaffProfile(false);
        }
    }, []);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            await loadStats();
            const [schRes, attRes, leaveRes, payRes] = await Promise.allSettled([
                api.portalSchedule(14),
                api.portalAttendanceHistory(30),
                api.portalGetLeaves(),
                api.portalGetPayslips(),
            ]);
            if (schRes.status === 'fulfilled') setSchedule(schRes.value.data || []);
            if (attRes.status === 'fulfilled') setAttendance(attRes.value.data || []);
            if (leaveRes.status === 'fulfilled') setLeaves(leaveRes.value.data || []);
            if (payRes.status === 'fulfilled') setPayslips(payRes.value.data || []);
        } finally {
            setLoading(false);
        }
    }, [loadStats]);

    useEffect(() => { if (user) loadAll(); }, [user]);

    const handleClockIn = async () => {
        setClockLoading(true);
        try {
            await api.portalClockIn({});
            await loadStats();
            showToast('You\'re clocked in! Have a great shift 👋');
        } catch (e) {
            showToast(e.response?.data?.detail || 'Clock in failed', 'error');
        } finally { setClockLoading(false); }
    };

    const handleClockOut = async () => {
        setClockLoading(true);
        try {
            const r = await api.portalClockOut({});
            await loadStats();
            showToast(`Clocked out. You worked ${r.data.hours_worked}h today. Great work! 🎉`);
        } catch (e) {
            showToast(e.response?.data?.detail || 'Clock out failed', 'error');
        } finally { setClockLoading(false); }
    };

    const handleSubmitLeave = async (form) => {
        setLeaveSubmitting(true);
        try {
            await api.portalSubmitLeave(form);
            setShowLeaveModal(false);
            showToast('Leave request submitted! You\'ll be notified once reviewed.');
            const r = await api.portalGetLeaves();
            setLeaves(r.data || []);
            await loadStats();
        } catch (e) {
            showToast(e.response?.data?.detail || 'Failed to submit leave', 'error');
        } finally { setLeaveSubmitting(false); }
    };

    const handleCancelLeave = async (id) => {
        if (!window.confirm('Cancel this leave request?')) return;
        try {
            await api.portalCancelLeave(id);
            showToast('Leave request cancelled.');
            const r = await api.portalGetLeaves();
            setLeaves(r.data || []);
        } catch (e) {
            showToast(e.response?.data?.detail || 'Failed to cancel', 'error');
        }
    };

    const openPayslip = async (payslip) => {
        try {
            const r = await api.portalGetPayslip(payslip.id);
            setPayslipDetail(r.data);
        } catch { showToast('Could not load payslip detail', 'error'); }
    };

    const now = new Date();
    const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    if (loading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center">
                    <Loader size={40} className="animate-spin text-[#5FA8D3] mx-auto" />
                    <p className="text-sm text-gray-500 mt-3">Loading your workspace…</p>
                </div>
            </div>
        );
    }

    if (!hasStaffProfile) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center max-w-sm">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <User size={28} className="text-amber-600" />
                    </div>
                    <h2 className="text-xl font-bold dark:text-white mb-2">No Staff Profile Linked</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Your account doesn't have a staff profile yet. Please ask your administrator to link your account to a staff profile.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">

            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-5 py-4 rounded-2xl shadow-2xl text-sm font-semibold flex items-center gap-3 max-w-sm animate-fade-in
                    ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-[#12161C] text-white'}`}>
                    {toast.type === 'error' ? <XCircle size={18} /> : <CheckCircle size={18} className="text-green-400" />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {greeting}, <span className="text-[#5FA8D3]">{user?.name?.split(' ')[0]}</span> 👋
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-sm">{dateStr}</p>
                </div>
                <ClockWidget
                    stats={stats}
                    onClockIn={handleClockIn}
                    onClockOut={handleClockOut}
                    loading={clockLoading}
                />
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={Timer} label="Hours Today" value={stats?.is_clocked_in && stats?.clock_in_time ? elapsed(stats.clock_in_time) : `${stats?.hours_today || 0}h`} subtext="Goal: 8h" color="blue" />
                <StatCard icon={BarChart2} label="Weekly Hours" value={`${stats?.weekly_hours || 0}h`} subtext="This week" color="purple" />
                <StatCard icon={Coffee} label="Leave Balance" value={`${stats?.annual_leave_balance ?? '--'} Days`} subtext="Annual remaining" color="teal" />
                <StatCard icon={FileText} label="Pending Requests" value={stats?.pending_leaves || 0} subtext="Awaiting review" color="amber" />
            </div>

            {/* Tabs */}
            <div className="bg-white dark:bg-[#12161C] rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] p-1.5 flex gap-1 overflow-x-auto">
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${activeTab === tab.id
                                ? 'bg-[#5FA8D3] text-white shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                            }`}>
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white dark:bg-[#12161C] rounded-3xl border border-[#D9DEE5] dark:border-[#1F2630] overflow-hidden">

                {/* TODAY TAB */}
                {activeTab === 'today' && (
                    <div className="p-6 space-y-6">
                        <h3 className="font-bold text-lg dark:text-white">Today's Overview</h3>

                        {/* Clock summary */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] rounded-2xl text-white">
                                <p className="text-xs font-bold uppercase tracking-widest opacity-70">Clock In</p>
                                <p className="text-3xl font-bold mt-1">{fmt12(stats?.clock_in_time) || '--:--'}</p>
                                {stats?.is_clocked_in && stats?.clock_in_time && (
                                    <p className="text-sm mt-2 opacity-80">Working for {elapsed(stats.clock_in_time)}</p>
                                )}
                            </div>
                            <div className="p-5 bg-gradient-to-br from-[#12161C] to-[#1a2133] rounded-2xl text-white">
                                <p className="text-xs font-bold uppercase tracking-widest opacity-70">Clock Out</p>
                                <p className="text-3xl font-bold mt-1">{fmt12(stats?.clock_out_time) || (stats?.is_clocked_in ? 'In progress…' : '--:--')}</p>
                                <p className="text-sm mt-2 opacity-60">Today's shift end</p>
                            </div>
                        </div>

                        {/* Upcoming today */}
                        <div>
                            <h4 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Today's Appointments</h4>
                            {schedule.filter(b => b.date === now.toISOString().split('T')[0]).length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <Calendar size={36} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No appointments scheduled for today</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {schedule.filter(b => b.date === now.toISOString().split('T')[0]).map(b => (
                                        <div key={b.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                            <div className="h-10 w-10 rounded-xl bg-[#5FA8D3]/10 text-[#5FA8D3] flex items-center justify-center font-bold text-sm flex-shrink-0">
                                                {b.time?.slice(0, 5) || '—'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm dark:text-white">{b.service_name}</p>
                                                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                    <User size={11} /> {b.customer_name}
                                                </p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${b.status === 'confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                                }`}>{b.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* SCHEDULE TAB */}
                {activeTab === 'schedule' && (
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg dark:text-white">My Upcoming Schedule</h3>
                            <span className="text-sm text-gray-500">Next 14 days</span>
                        </div>
                        {schedule.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <CalendarDays size={48} className="mx-auto mb-3 opacity-20" />
                                <p className="font-medium">No upcoming appointments</p>
                                <p className="text-xs mt-1">Bookings assigned to you will appear here</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {schedule.map(b => (
                                    <div key={b.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-[#5FA8D3]/30 transition-all group">
                                        <div className="h-12 w-12 rounded-2xl bg-[#5FA8D3]/10 text-[#5FA8D3] flex flex-col items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-bold">{new Date(b.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}</span>
                                            <span className="text-lg font-bold leading-none">{new Date(b.date + 'T00:00:00').getDate()}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm dark:text-white">{b.service_name}</p>
                                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                                <span className="flex items-center gap-1"><Clock size={11} /> {b.time?.slice(0, 5) || '–'}</span>
                                                <span className="flex items-center gap-1"><User size={11} /> {b.customer_name}</span>
                                                {b.duration && <span>{b.duration} min</span>}
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex-shrink-0 ${b.status === 'confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                                : b.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                            }`}>{b.status}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ATTENDANCE TAB */}
                {activeTab === 'attendance' && (
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-bold text-lg dark:text-white">Attendance History</h3>
                            <span className="text-sm text-gray-500">Last 30 days</span>
                        </div>

                        {/* Summary strips */}
                        {attendance.length > 0 && (() => {
                            const present = attendance.filter(r => r.status === 'present').length;
                            const absent = attendance.filter(r => r.status === 'absent').length;
                            const totalH = attendance.reduce((s, r) => s + (r.hours_worked || 0), 0);
                            return (
                                <div className="grid grid-cols-3 gap-3 mb-5">
                                    <div className="bg-green-50 dark:bg-green-900/10 rounded-2xl p-4 text-center">
                                        <p className="text-2xl font-bold text-green-600">{present}</p>
                                        <p className="text-xs text-green-600/70 mt-0.5">Present</p>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-4 text-center">
                                        <p className="text-2xl font-bold text-red-500">{absent}</p>
                                        <p className="text-xs text-red-500/70 mt-0.5">Absent</p>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-4 text-center">
                                        <p className="text-2xl font-bold text-blue-600">{totalH.toFixed(0)}h</p>
                                        <p className="text-xs text-blue-600/70 mt-0.5">Total Hours</p>
                                    </div>
                                </div>
                            );
                        })()}

                        {attendance.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <History size={48} className="mx-auto mb-3 opacity-20" />
                                <p className="font-medium">No attendance records yet</p>
                                <p className="text-xs mt-1">Clock in to start tracking attendance</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {attendance.map(r => (
                                    <div key={r.id || r.date} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                        <div className={`h-3 w-3 rounded-full flex-shrink-0 ${STATUS_COLORS[r.status] || 'bg-gray-300'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm dark:text-white">{fmtDate(r.date)}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {r.clock_in ? `${fmt12(r.clock_in)} → ${r.clock_out ? fmt12(r.clock_out) : 'In progress'}` : 'Not clocked in'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-sm dark:text-white">{r.hours_worked ? `${r.hours_worked}h` : '--'}</p>
                                            <p className={`text-[10px] capitalize font-medium  ${r.status === 'present' ? 'text-green-500'
                                                    : r.status === 'absent' ? 'text-red-500' : 'text-gray-400'
                                                }`}>{r.status.replace('_', ' ')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* LEAVES TAB */}
                {activeTab === 'leaves' && (
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-bold text-lg dark:text-white">Leave Requests</h3>
                            <button
                                onClick={() => setShowLeaveModal(true)}
                                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all">
                                <Plus size={15} /> Request Leave
                            </button>
                        </div>

                        {/* Leave balance cards */}
                        <div className="grid grid-cols-3 gap-3 mb-5">
                            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-4">
                                <p className="text-2xl font-bold text-blue-600">{stats?.annual_leave_balance ?? '--'}</p>
                                <p className="text-xs text-blue-500/80 mt-0.5">Annual remaining</p>
                            </div>
                            <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-2xl p-4">
                                <p className="text-2xl font-bold text-yellow-600">{leaves.filter(l => l.status === 'pending').length}</p>
                                <p className="text-xs text-yellow-500/80 mt-0.5">Pending</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/10 rounded-2xl p-4">
                                <p className="text-2xl font-bold text-green-600">{leaves.filter(l => l.status === 'approved').length}</p>
                                <p className="text-xs text-green-500/80 mt-0.5">Approved</p>
                            </div>
                        </div>

                        {leaves.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <Coffee size={40} className="mx-auto mb-3 opacity-20" />
                                <p className="font-medium">No leave requests</p>
                                <p className="text-xs mt-1">Click "Request Leave" to submit one</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {leaves.map(l => (
                                    <div key={l.id} className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-sm dark:text-white capitalize">
                                                        {LEAVE_TYPES.find(t => t.id === l.leave_type)?.label || l.leave_type}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold capitalize ${LEAVE_COLORS[l.status]}`}>
                                                        {l.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {fmtDate(l.start_date)} → {fmtDate(l.end_date)} · {l.days_requested} day{l.days_requested > 1 ? 's' : ''}
                                                </p>
                                                {l.reason && <p className="text-xs text-gray-400 mt-1 italic">"{l.reason}"</p>}
                                                {l.manager_notes && (
                                                    <p className="text-xs text-gray-500 mt-1.5 bg-white dark:bg-white/5 rounded-lg px-3 py-1.5">
                                                        <span className="font-semibold">Manager note:</span> {l.manager_notes}
                                                    </p>
                                                )}
                                            </div>
                                            {l.status === 'pending' && (
                                                <button onClick={() => handleCancelLeave(l.id)}
                                                    className="text-xs text-red-500 hover:text-red-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0">
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* PAYSLIPS TAB */}
                {activeTab === 'payslips' && (
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-bold text-lg dark:text-white">Payslips</h3>
                        </div>

                        {payslips.length === 0 ? (
                            <div className="text-center py-16 text-gray-400">
                                <DollarSign size={48} className="mx-auto mb-3 opacity-20" />
                                <p className="font-medium">No payslips yet</p>
                                <p className="text-xs mt-1">Your payslips will appear here once published by payroll</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {payslips.map(p => (
                                    <div key={p.id}
                                        className="flex items-center gap-4 p-5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-[#5FA8D3]/30 transition-all cursor-pointer group"
                                        onClick={() => openPayslip(p)}>
                                        <div className="h-12 w-12 rounded-2xl bg-[#5FA8D3]/10 flex items-center justify-center flex-shrink-0">
                                            <FileText size={20} className="text-[#5FA8D3]" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm dark:text-white">{p.pay_period_label}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{p.days_present} days present</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-base dark:text-white">₹{Number(p.net_pay).toLocaleString('en-IN')}</p>
                                            <p className="text-[10px] text-gray-400">Net Pay</p>
                                        </div>
                                        <Eye size={16} className="text-gray-400 group-hover:text-[#5FA8D3] transition-colors flex-shrink-0" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            {showLeaveModal && (
                <LeaveModal
                    onClose={() => setShowLeaveModal(false)}
                    onSubmit={handleSubmitLeave}
                    submitting={leaveSubmitting}
                />
            )}
            {payslipDetail && (
                <PayslipDetailModal
                    payslip={payslipDetail}
                    onClose={() => setPayslipDetail(null)}
                />
            )}
        </div>
    );
};

export default MyWorkspace;
