import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Users, UserPlus, Calendar, Clock, Gift, Settings, Search, Filter,
  Plus, Edit2, Trash2, X, Check, AlertCircle, ChevronRight, ChevronLeft,
  Phone, Mail, MapPin, Briefcase, CalendarDays, FileText, UserCheck,
  LogIn, LogOut, Timer, AlertTriangle, BarChart3, Download
} from 'lucide-react';

const AdminStaff = () => {
  const [activeTab, setActiveTab] = useState('directory');
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.getStaffStats();
      setStats(res.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'directory', label: 'Staff Directory', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: Timer },
    { id: 'leave-policies', label: 'Leave Policies', icon: FileText },
    { id: 'leave-requests', label: 'Leave Requests', icon: CalendarDays, badge: stats.pending_leaves },
    { id: 'shifts', label: 'Shift Templates', icon: Clock },
    { id: 'schedules', label: 'Schedules', icon: Calendar },
    { id: 'holidays', label: 'Holidays', icon: Gift },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard label="Total Staff" value={stats.total_staff || 0} icon={Users} color="blue" />
        <StatCard label="Clocked In" value={stats.clocked_in_today || 0} icon={LogIn} color="green" />
        <StatCard label="Working Now" value={stats.currently_working || 0} icon={Timer} color="teal" />
        <StatCard label="Late Today" value={stats.late_today || 0} icon={AlertTriangle} color="amber" />
        <StatCard label="On Leave" value={stats.on_leave_today || 0} icon={Calendar} color="rose" />
        <StatCard label="Pending Leaves" value={stats.pending_leaves || 0} icon={CalendarDays} color="orange" />
        <StatCard label="Scheduled" value={stats.today_schedules || 0} icon={UserCheck} color="indigo" />
        <StatCard label="Holidays" value={stats.upcoming_holidays || 0} icon={Gift} color="purple" />
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-[#171C22] rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] overflow-hidden">
        <div className="flex overflow-x-auto border-b border-[#D9DEE5] dark:border-[#1F2630]">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap transition-all relative ${
                  activeTab === tab.id
                    ? 'text-[#5FA8D3] border-b-2 border-[#5FA8D3] bg-[#5FA8D3]/5'
                    : 'text-[#6B7280] dark:text-[#7D8590] hover:text-[#0E1116] dark:hover:text-[#E6E8EB] hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630]'
                }`}
              >
                <Icon size={18} />
                {tab.label}
                {tab.badge > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === 'directory' && <StaffDirectory onUpdate={fetchStats} />}
          {activeTab === 'attendance' && <AttendanceTracker onUpdate={fetchStats} />}
          {activeTab === 'leave-policies' && <LeavePolicies />}
          {activeTab === 'leave-requests' && <LeaveRequests onUpdate={fetchStats} />}
          {activeTab === 'shifts' && <ShiftTemplates />}
          {activeTab === 'schedules' && <StaffSchedules />}
          {activeTab === 'holidays' && <Holidays />}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color }) => {
  const colors = {
    blue: 'from-blue-500/20 to-blue-600/10 text-blue-600 dark:text-blue-400',
    green: 'from-green-500/20 to-green-600/10 text-green-600 dark:text-green-400',
    teal: 'from-teal-500/20 to-teal-600/10 text-teal-600 dark:text-teal-400',
    amber: 'from-amber-500/20 to-amber-600/10 text-amber-600 dark:text-amber-400',
    orange: 'from-orange-500/20 to-orange-600/10 text-orange-600 dark:text-orange-400',
    rose: 'from-rose-500/20 to-rose-600/10 text-rose-600 dark:text-rose-400',
    purple: 'from-purple-500/20 to-purple-600/10 text-purple-600 dark:text-purple-400',
    indigo: 'from-indigo-500/20 to-indigo-600/10 text-indigo-600 dark:text-indigo-400',
  };

  return (
    <div className={`p-3 rounded-xl bg-gradient-to-br ${colors[color]} border border-[#D9DEE5] dark:border-[#1F2630]`}>
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <div>
          <div className="text-xl font-bold">{value}</div>
          <div className="text-[10px] opacity-80 leading-tight">{label}</div>
        </div>
      </div>
    </div>
  );
};

// ============== ATTENDANCE TRACKER ==============
const AttendanceTracker = ({ onUpdate }) => {
  const [todayData, setTodayData] = useState({ staff: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [clockingId, setClockingId] = useState(null);

  useEffect(() => {
    fetchTodayAttendance();
    const interval = setInterval(fetchTodayAttendance, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchTodayAttendance = async () => {
    try {
      const res = await api.getTodayAttendance();
      setTodayData(res.data);
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async (staffId) => {
    setClockingId(staffId);
    try {
      await api.clockIn({ staff_id: staffId });
      fetchTodayAttendance();
      onUpdate();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to clock in');
    } finally {
      setClockingId(null);
    }
  };

  const handleClockOut = async (staffId) => {
    setClockingId(staffId);
    try {
      await api.clockOut({ staff_id: staffId });
      fetchTodayAttendance();
      onUpdate();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to clock out');
    } finally {
      setClockingId(null);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'working': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'completed': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'on_leave': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
      case 'absent': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const summary = todayData.summary || {};

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-3 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl text-center">
          <div className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">{summary.total || 0}</div>
          <div className="text-xs text-[#6B7280]">Total Staff</div>
        </div>
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
          <div className="text-2xl font-bold text-green-600">{summary.present || 0}</div>
          <div className="text-xs text-green-600">Present</div>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
          <div className="text-2xl font-bold text-red-600">{summary.absent || 0}</div>
          <div className="text-xs text-red-600">Absent</div>
        </div>
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-center">
          <div className="text-2xl font-bold text-purple-600">{summary.on_leave || 0}</div>
          <div className="text-xs text-purple-600">On Leave</div>
        </div>
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-center">
          <div className="text-2xl font-bold text-amber-600">{summary.late || 0}</div>
          <div className="text-xs text-amber-600">Late</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">
          Today's Attendance - {new Date().toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}
        </h4>
        <button
          onClick={() => setShowReportModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#5FA8D3] text-white rounded-xl font-medium hover:bg-[#4A95C0]"
        >
          <BarChart3 size={18} />
          Reports
        </button>
      </div>

      {/* Staff List */}
      {loading ? (
        <div className="text-center py-8 text-[#6B7280]">Loading...</div>
      ) : todayData.staff?.length === 0 ? (
        <div className="text-center py-12 text-[#6B7280]">
          <Users size={48} className="mx-auto mb-4 opacity-50" />
          <p>No staff members found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D9DEE5] dark:border-[#1F2630]">
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6B7280]">Employee</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-[#6B7280]">Status</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-[#6B7280]">Clock In</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-[#6B7280]">Clock Out</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-[#6B7280]">Hours</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-[#6B7280]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {todayData.staff.map(s => (
                <tr key={s.id} className="border-b border-[#D9DEE5] dark:border-[#1F2630] hover:bg-[#F6F7F9] dark:hover:bg-[#0B0D10]/50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#5FA8D3] flex items-center justify-center text-white font-bold">
                        {s.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-[#0E1116] dark:text-[#E6E8EB]">{s.full_name}</div>
                        <div className="text-xs text-[#6B7280]">{s.employee_id} • {s.designation}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(s.status)}`}>
                      {s.status === 'working' ? 'Working' : 
                       s.status === 'completed' ? 'Completed' :
                       s.status === 'on_leave' ? 'On Leave' : 'Absent'}
                    </span>
                    {s.is_late && (
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700">
                        Late {s.late_minutes}m
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center text-sm text-[#0E1116] dark:text-[#E6E8EB]">
                    {formatTime(s.clock_in)}
                  </td>
                  <td className="py-3 px-4 text-center text-sm text-[#0E1116] dark:text-[#E6E8EB]">
                    {formatTime(s.clock_out)}
                  </td>
                  <td className="py-3 px-4 text-center text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB]">
                    {s.total_hours ? `${s.total_hours}h` : '--'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {s.status === 'absent' && (
                        <button
                          onClick={() => handleClockIn(s.id)}
                          disabled={clockingId === s.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 disabled:opacity-50"
                        >
                          <LogIn size={14} />
                          Clock In
                        </button>
                      )}
                      {s.status === 'working' && (
                        <button
                          onClick={() => handleClockOut(s.id)}
                          disabled={clockingId === s.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 disabled:opacity-50"
                        >
                          <LogOut size={14} />
                          Clock Out
                        </button>
                      )}
                      <button
                        onClick={() => { setSelectedStaff(s); setShowHistoryModal(true); }}
                        className="p-1.5 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg"
                        title="View History"
                      >
                        <Calendar size={14} className="text-[#6B7280]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedStaff && (
        <AttendanceHistoryModal
          staff={selectedStaff}
          onClose={() => { setShowHistoryModal(false); setSelectedStaff(null); }}
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <AttendanceReportModal
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
};

// ============== ATTENDANCE HISTORY MODAL ==============
const AttendanceHistoryModal = ({ staff, onClose }) => {
  const [history, setHistory] = useState({ records: [], stats: {} });
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchHistory();
  }, [month, year]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.getStaffAttendanceHistory(staff.id, { month, year });
      setHistory(res.data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = history.stats || {};

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#171C22] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex items-center justify-between p-5 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <div>
            <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Attendance History</h3>
            <p className="text-sm text-[#6B7280]">{staff.full_name} ({staff.employee_id})</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg">
            <X size={20} className="text-[#6B7280]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#0B0D10] text-[#0E1116] dark:text-[#E6E8EB]"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleDateString('en', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#0B0D10] text-[#0E1116] dark:text-[#E6E8EB]"
            >
              {[2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <div className="p-2 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-lg text-center">
              <div className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">{stats.total_days_worked || 0}</div>
              <div className="text-[10px] text-[#6B7280]">Days Worked</div>
            </div>
            <div className="p-2 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-lg text-center">
              <div className="text-lg font-bold text-[#5FA8D3]">{stats.total_hours || 0}h</div>
              <div className="text-[10px] text-[#6B7280]">Total Hours</div>
            </div>
            <div className="p-2 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-lg text-center">
              <div className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">{stats.average_hours || 0}h</div>
              <div className="text-[10px] text-[#6B7280]">Avg/Day</div>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-center">
              <div className="text-lg font-bold text-amber-600">{stats.late_days || 0}</div>
              <div className="text-[10px] text-amber-600">Late Days</div>
            </div>
            <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-center">
              <div className="text-lg font-bold text-rose-600">{stats.early_departures || 0}</div>
              <div className="text-[10px] text-rose-600">Early Out</div>
            </div>
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
              <div className="text-lg font-bold text-green-600">{stats.overtime_hours || 0}h</div>
              <div className="text-[10px] text-green-600">Overtime</div>
            </div>
          </div>

          {/* Records */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="text-center py-4 text-[#6B7280]">Loading...</div>
            ) : history.records?.length === 0 ? (
              <div className="text-center py-4 text-[#6B7280]">No attendance records for this month</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-[#171C22]">
                  <tr className="border-b border-[#D9DEE5] dark:border-[#1F2630]">
                    <th className="text-left py-2 text-[#6B7280]">Date</th>
                    <th className="text-center py-2 text-[#6B7280]">In</th>
                    <th className="text-center py-2 text-[#6B7280]">Out</th>
                    <th className="text-center py-2 text-[#6B7280]">Hours</th>
                    <th className="text-center py-2 text-[#6B7280]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.records.map((r, i) => (
                    <tr key={i} className="border-b border-[#D9DEE5]/50 dark:border-[#1F2630]/50">
                      <td className="py-2 text-[#0E1116] dark:text-[#E6E8EB]">
                        {new Date(r.date).toLocaleDateString('en', { weekday: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-2 text-center text-[#0E1116] dark:text-[#E6E8EB]">
                        {r.clock_in ? new Date(r.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="py-2 text-center text-[#0E1116] dark:text-[#E6E8EB]">
                        {r.clock_out ? new Date(r.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="py-2 text-center font-medium text-[#5FA8D3]">
                        {r.total_hours ? `${r.total_hours}h` : '--'}
                      </td>
                      <td className="py-2 text-center">
                        {r.is_late && <span className="text-[10px] px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded">Late</span>}
                        {r.early_departure && <span className="text-[10px] px-1 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded ml-1">Early</span>}
                        {r.overtime_hours > 0 && <span className="text-[10px] px-1 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 rounded ml-1">OT</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============== ATTENDANCE REPORT MODAL ==============
const AttendanceReportModal = ({ onClose }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.getAttendanceReport({ start_date: startDate, end_date: endDate });
      setReport(res.data);
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const summary = report?.summary || {};

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#171C22] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex items-center justify-between p-5 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <div className="flex items-center gap-3">
            <BarChart3 size={24} className="text-[#5FA8D3]" />
            <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Attendance Report</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg">
            <X size={20} className="text-[#6B7280]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Date Range */}
          <div className="flex items-center gap-4">
            <div>
              <label className="text-xs text-[#6B7280] block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#0B0D10] text-[#0E1116] dark:text-[#E6E8EB]"
              />
            </div>
            <div>
              <label className="text-xs text-[#6B7280] block mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#0B0D10] text-[#0E1116] dark:text-[#E6E8EB]"
              />
            </div>
            <button
              onClick={fetchReport}
              disabled={loading}
              className="px-4 py-2 bg-[#5FA8D3] text-white rounded-xl font-medium hover:bg-[#4A95C0] disabled:opacity-50 mt-5"
            >
              {loading ? 'Loading...' : 'Generate'}
            </button>
          </div>

          {/* Summary */}
          {report && (
            <div className="grid grid-cols-5 gap-3">
              <div className="p-3 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl text-center">
                <div className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">{summary.total_staff}</div>
                <div className="text-xs text-[#6B7280]">Staff</div>
              </div>
              <div className="p-3 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl text-center">
                <div className="text-xl font-bold text-[#5FA8D3]">{summary.total_records}</div>
                <div className="text-xs text-[#6B7280]">Records</div>
              </div>
              <div className="p-3 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl text-center">
                <div className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">{summary.total_hours}h</div>
                <div className="text-xs text-[#6B7280]">Total Hours</div>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-center">
                <div className="text-xl font-bold text-amber-600">{summary.total_late_instances}</div>
                <div className="text-xs text-amber-600">Late</div>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                <div className="text-xl font-bold text-green-600">{summary.total_overtime}h</div>
                <div className="text-xs text-green-600">Overtime</div>
              </div>
            </div>
          )}

          {/* Staff Reports */}
          {report && (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-[#171C22]">
                  <tr className="border-b border-[#D9DEE5] dark:border-[#1F2630]">
                    <th className="text-left py-2 text-[#6B7280]">Employee</th>
                    <th className="text-center py-2 text-[#6B7280]">Days</th>
                    <th className="text-center py-2 text-[#6B7280]">Hours</th>
                    <th className="text-center py-2 text-[#6B7280]">Late</th>
                    <th className="text-center py-2 text-[#6B7280]">Early Out</th>
                    <th className="text-center py-2 text-[#6B7280]">Overtime</th>
                  </tr>
                </thead>
                <tbody>
                  {report.staff_reports?.map((r, i) => (
                    <tr key={i} className="border-b border-[#D9DEE5]/50 dark:border-[#1F2630]/50">
                      <td className="py-2">
                        <div className="font-medium text-[#0E1116] dark:text-[#E6E8EB]">{r.staff_name}</div>
                        <div className="text-xs text-[#6B7280]">{r.employee_id}</div>
                      </td>
                      <td className="py-2 text-center text-[#0E1116] dark:text-[#E6E8EB]">{r.days_worked}</td>
                      <td className="py-2 text-center font-medium text-[#5FA8D3]">{r.total_hours}h</td>
                      <td className="py-2 text-center">
                        {r.late_days > 0 ? (
                          <span className="text-amber-600">{r.late_days}</span>
                        ) : (
                          <span className="text-[#6B7280]">0</span>
                        )}
                      </td>
                      <td className="py-2 text-center">
                        {r.early_departures > 0 ? (
                          <span className="text-rose-600">{r.early_departures}</span>
                        ) : (
                          <span className="text-[#6B7280]">0</span>
                        )}
                      </td>
                      <td className="py-2 text-center">
                        {r.overtime_hours > 0 ? (
                          <span className="text-green-600">{r.overtime_hours}h</span>
                        ) : (
                          <span className="text-[#6B7280]">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============== STAFF DIRECTORY ==============
const StaffDirectory = ({ onUpdate }) => {
  const [staff, setStaff] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [staffRes, outletsRes] = await Promise.all([
        api.getStaff(),
        api.getOutlets()
      ]);
      setStaff(staffRes.data || []);
      setOutlets(outletsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = staff.filter(s =>
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.employee_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this staff member?')) return;
    try {
      await api.deleteStaff(id);
      fetchData();
      onUpdate();
    } catch (error) {
      console.error('Failed to delete staff:', error);
    }
  };

  const getOutletName = (id) => outlets.find(o => o.id === id)?.name || 'All Outlets';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Search staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#0B0D10] text-[#0E1116] dark:text-[#E6E8EB]"
          />
        </div>
        <button
          onClick={() => { setEditingStaff(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#5FA8D3] text-white rounded-xl font-medium hover:bg-[#4A95C0] transition-all"
        >
          <UserPlus size={18} />
          Add Staff
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-[#6B7280]">Loading...</div>
      ) : filteredStaff.length === 0 ? (
        <div className="text-center py-12 text-[#6B7280]">
          <Users size={48} className="mx-auto mb-4 opacity-50" />
          <p>No staff members found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredStaff.map(s => (
            <div key={s.id} className="p-4 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl border border-[#D9DEE5] dark:border-[#1F2630]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#5FA8D3] flex items-center justify-center text-white font-bold text-lg">
                    {s.first_name?.[0]}{s.last_name?.[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{s.full_name}</div>
                    <div className="text-sm text-[#6B7280] dark:text-[#7D8590]">{s.designation} • {s.employee_id}</div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-[#6B7280]">
                      <span className="flex items-center gap-1"><Mail size={12} /> {s.email}</span>
                      <span className="flex items-center gap-1"><Phone size={12} /> {s.phone}</span>
                      <span className="flex items-center gap-1"><MapPin size={12} /> {getOutletName(s.outlet_id)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    s.employment_type === 'full_time' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                    s.employment_type === 'part_time' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                    'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
                  }`}>
                    {s.employment_type?.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => { setEditingStaff(s); setShowModal(true); }}
                    className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg"
                  >
                    <Edit2 size={16} className="text-[#6B7280]" />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <StaffModal
          staff={editingStaff}
          outlets={outlets}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchData(); onUpdate(); }}
        />
      )}
    </div>
  );
};

// ============== STAFF MODAL ==============
const StaffModal = ({ staff, outlets, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    first_name: staff?.first_name || '',
    last_name: staff?.last_name || '',
    email: staff?.email || '',
    phone: staff?.phone || '',
    date_of_birth: staff?.date_of_birth || '',
    gender: staff?.gender || '',
    address: staff?.address || '',
    city: staff?.city || '',
    state: staff?.state || '',
    postal_code: staff?.postal_code || '',
    emergency_contact_name: staff?.emergency_contact?.name || '',
    emergency_contact_phone: staff?.emergency_contact?.phone || '',
    emergency_contact_relation: staff?.emergency_contact?.relation || '',
    department: staff?.department || '',
    designation: staff?.designation || '',
    employment_type: staff?.employment_type || 'full_time',
    join_date: staff?.join_date || new Date().toISOString().split('T')[0],
    outlet_id: staff?.outlet_id || '',
    hourly_rate: staff?.hourly_rate || '',
    monthly_salary: staff?.monthly_salary || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.email || !form.designation) {
      setError('Please fill required fields');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (staff) {
        await api.updateStaff(staff.id, form);
      } else {
        await api.createStaff(form);
      }
      onSuccess();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        // Pydantic validation errors - extract messages
        setError(detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Failed to save staff member');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#171C22] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex items-center justify-between p-5 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">
            {staff ? 'Edit Staff Member' : 'Add Staff Member'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg">
            <X size={20} className="text-[#6B7280]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto max-h-[70vh] space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Personal Information */}
          <div>
            <h4 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-3 flex items-center gap-2">
              <Users size={16} /> Personal Information
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="First Name *" value={form.first_name} onChange={(v) => setForm({...form, first_name: v})} />
              <InputField label="Last Name *" value={form.last_name} onChange={(v) => setForm({...form, last_name: v})} />
              <InputField label="Email *" type="email" value={form.email} onChange={(v) => setForm({...form, email: v})} />
              <InputField label="Phone" value={form.phone} onChange={(v) => setForm({...form, phone: v})} />
              <InputField label="Date of Birth" type="date" value={form.date_of_birth} onChange={(v) => setForm({...form, date_of_birth: v})} />
              <SelectField label="Gender" value={form.gender} onChange={(v) => setForm({...form, gender: v})} options={[
                { value: '', label: 'Select...' },
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' },
              ]} />
            </div>
          </div>

          {/* Address */}
          <div>
            <h4 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-3 flex items-center gap-2">
              <MapPin size={16} /> Address
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <InputField label="Street Address" value={form.address} onChange={(v) => setForm({...form, address: v})} />
              </div>
              <InputField label="City" value={form.city} onChange={(v) => setForm({...form, city: v})} />
              <InputField label="State" value={form.state} onChange={(v) => setForm({...form, state: v})} />
              <InputField label="Postal Code" value={form.postal_code} onChange={(v) => setForm({...form, postal_code: v})} />
            </div>
          </div>

          {/* Emergency Contact */}
          <div>
            <h4 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-3 flex items-center gap-2">
              <Phone size={16} /> Emergency Contact
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Name" value={form.emergency_contact_name} onChange={(v) => setForm({...form, emergency_contact_name: v})} />
              <InputField label="Phone" value={form.emergency_contact_phone} onChange={(v) => setForm({...form, emergency_contact_phone: v})} />
              <InputField label="Relation" value={form.emergency_contact_relation} onChange={(v) => setForm({...form, emergency_contact_relation: v})} />
            </div>
          </div>

          {/* Employment Info */}
          <div>
            <h4 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-3 flex items-center gap-2">
              <Briefcase size={16} /> Employment Details
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Designation *" value={form.designation} onChange={(v) => setForm({...form, designation: v})} placeholder="e.g., Stylist, Manager" />
              <InputField label="Department" value={form.department} onChange={(v) => setForm({...form, department: v})} placeholder="e.g., Sales, Operations" />
              <SelectField label="Employment Type" value={form.employment_type} onChange={(v) => setForm({...form, employment_type: v})} options={[
                { value: 'full_time', label: 'Full Time' },
                { value: 'part_time', label: 'Part Time' },
                { value: 'contract', label: 'Contract' },
                { value: 'intern', label: 'Intern' },
              ]} />
              <InputField label="Join Date" type="date" value={form.join_date} onChange={(v) => setForm({...form, join_date: v})} />
              <SelectField label="Primary Outlet" value={form.outlet_id} onChange={(v) => setForm({...form, outlet_id: v})} options={[
                { value: '', label: 'All Outlets' },
                ...outlets.map(o => ({ value: o.id, label: o.name }))
              ]} />
              <InputField label="Monthly Salary" type="number" value={form.monthly_salary} onChange={(v) => setForm({...form, monthly_salary: v})} placeholder="₹" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#D9DEE5] dark:border-[#1F2630]">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#6B7280] hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630]">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-[#5FA8D3] text-white rounded-xl font-medium hover:bg-[#4A95C0] disabled:opacity-50">
              {saving ? 'Saving...' : staff ? 'Update' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============== LEAVE POLICIES ==============
const LeavePolicies = () => {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const res = await api.getLeavePolicies();
      setPolicies(res.data || []);
    } catch (error) {
      console.error('Failed to fetch policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this leave policy?')) return;
    try {
      await api.deleteLeavePolicy(id);
      fetchPolicies();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-[#6B7280] dark:text-[#7D8590]">
          Configure leave types available to your staff
        </p>
        <button
          onClick={() => { setEditingPolicy(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#5FA8D3] text-white rounded-xl font-medium hover:bg-[#4A95C0]"
        >
          <Plus size={18} />
          Add Policy
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-[#6B7280]">Loading...</div>
      ) : policies.length === 0 ? (
        <div className="text-center py-12 text-[#6B7280]">
          <FileText size={48} className="mx-auto mb-4 opacity-50" />
          <p>No leave policies configured</p>
          <p className="text-sm mt-1">Add policies like Annual Leave, Sick Leave, etc.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {policies.map(p => (
            <div key={p.id} className="flex items-center justify-between p-4 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl border border-[#D9DEE5] dark:border-[#1F2630]">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${p.paid ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700'}`}>
                  {p.code}
                </div>
                <div>
                  <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{p.name}</div>
                  <div className="text-sm text-[#6B7280]">
                    {p.days_per_year} days/year • {p.accrual_type} accrual
                    {p.carry_forward && ` • Carry forward up to ${p.max_carry_forward_days} days`}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs ${p.requires_approval ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>
                  {p.requires_approval ? 'Requires Approval' : 'Auto-Approved'}
                </span>
                <button onClick={() => { setEditingPolicy(p); setShowModal(true); }} className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg">
                  <Edit2 size={16} className="text-[#6B7280]" />
                </button>
                <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg">
                  <Trash2 size={16} className="text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <LeavePolicyModal
          policy={editingPolicy}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchPolicies(); }}
        />
      )}
    </div>
  );
};

// ============== LEAVE POLICY MODAL ==============
const LeavePolicyModal = ({ policy, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    name: policy?.name || '',
    code: policy?.code || '',
    description: policy?.description || '',
    days_per_year: policy?.days_per_year || 12,
    accrual_type: policy?.accrual_type || 'yearly',
    carry_forward: policy?.carry_forward || false,
    max_carry_forward_days: policy?.max_carry_forward_days || 0,
    requires_approval: policy?.requires_approval ?? true,
    min_notice_days: policy?.min_notice_days || 0,
    max_consecutive_days: policy?.max_consecutive_days || 0,
    paid: policy?.paid ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (policy) {
        await api.updateLeavePolicy(policy.id, form);
      } else {
        await api.createLeavePolicy(form);
      }
      onSuccess();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#171C22] rounded-2xl shadow-2xl max-w-lg w-full border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex items-center justify-between p-5 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">
            {policy ? 'Edit Leave Policy' : 'Add Leave Policy'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg">
            <X size={20} className="text-[#6B7280]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Policy Name *" value={form.name} onChange={(v) => setForm({...form, name: v})} placeholder="e.g., Annual Leave" />
            <InputField label="Code *" value={form.code} onChange={(v) => setForm({...form, code: v.toUpperCase()})} placeholder="e.g., AL" maxLength={5} />
          </div>
          <InputField label="Description" value={form.description} onChange={(v) => setForm({...form, description: v})} />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Days per Year" type="number" value={form.days_per_year} onChange={(v) => setForm({...form, days_per_year: parseFloat(v)})} />
            <SelectField label="Accrual Type" value={form.accrual_type} onChange={(v) => setForm({...form, accrual_type: v})} options={[
              { value: 'yearly', label: 'Yearly (all at once)' },
              { value: 'monthly', label: 'Monthly (gradual)' },
              { value: 'none', label: 'No accrual' },
            ]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Min Notice Days" type="number" value={form.min_notice_days} onChange={(v) => setForm({...form, min_notice_days: parseInt(v)})} />
            <InputField label="Max Consecutive Days" type="number" value={form.max_consecutive_days} onChange={(v) => setForm({...form, max_consecutive_days: parseInt(v)})} placeholder="0 = unlimited" />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.requires_approval} onChange={(e) => setForm({...form, requires_approval: e.target.checked})} className="w-4 h-4 rounded" />
              <span className="text-sm text-[#0E1116] dark:text-[#E6E8EB]">Requires Approval</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.paid} onChange={(e) => setForm({...form, paid: e.target.checked})} className="w-4 h-4 rounded" />
              <span className="text-sm text-[#0E1116] dark:text-[#E6E8EB]">Paid Leave</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.carry_forward} onChange={(e) => setForm({...form, carry_forward: e.target.checked})} className="w-4 h-4 rounded" />
              <span className="text-sm text-[#0E1116] dark:text-[#E6E8EB]">Allow Carry Forward</span>
            </label>
          </div>
          {form.carry_forward && (
            <InputField label="Max Carry Forward Days" type="number" value={form.max_carry_forward_days} onChange={(v) => setForm({...form, max_carry_forward_days: parseFloat(v)})} />
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#6B7280]">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-[#5FA8D3] text-white rounded-xl font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============== LEAVE REQUESTS ==============
const LeaveRequests = ({ onUpdate }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    try {
      const res = await api.getLeaveRequests({ status: statusFilter || undefined });
      setRequests(res.data || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, status) => {
    try {
      await api.updateLeaveRequest(id, { status });
      fetchRequests();
      onUpdate();
    } catch (error) {
      console.error('Failed to update:', error);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'rejected': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'pending': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {['pending', 'approved', 'rejected', ''].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              statusFilter === s
                ? 'bg-[#5FA8D3] text-white'
                : 'bg-[#F6F7F9] dark:bg-[#1F2630] text-[#6B7280] hover:bg-[#ECEFF3] dark:hover:bg-[#2A313C]'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-[#6B7280]">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-[#6B7280]">
          <CalendarDays size={48} className="mx-auto mb-4 opacity-50" />
          <p>No {statusFilter} leave requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="p-4 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl border border-[#D9DEE5] dark:border-[#1F2630]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{r.staff_name}</div>
                  <div className="text-sm text-[#6B7280]">
                    {r.leave_type_name} • {r.days} day(s)
                  </div>
                  <div className="text-sm text-[#6B7280] mt-1">
                    {r.start_date} to {r.end_date}
                  </div>
                  {r.reason && <div className="text-sm text-[#6B7280] mt-1 italic">"{r.reason}"</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(r.status)}`}>
                    {r.status}
                  </span>
                  {r.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleAction(r.id, 'approved')}
                        className="p-2 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 rounded-lg"
                      >
                        <Check size={16} className="text-green-600" />
                      </button>
                      <button
                        onClick={() => handleAction(r.id, 'rejected')}
                        className="p-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 rounded-lg"
                      >
                        <X size={16} className="text-red-600" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============== SHIFT TEMPLATES ==============
const ShiftTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await api.getShiftTemplates();
      setTemplates(res.data || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this shift template?')) return;
    try {
      await api.deleteShiftTemplate(id);
      fetchTemplates();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-[#6B7280] dark:text-[#7D8590]">
          Define shift timings for your business
        </p>
        <button
          onClick={() => { setEditingTemplate(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#5FA8D3] text-white rounded-xl font-medium hover:bg-[#4A95C0]"
        >
          <Plus size={18} />
          Add Shift
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-[#6B7280]">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-[#6B7280]">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p>No shift templates configured</p>
          <p className="text-sm mt-1">Add shifts like Morning, Evening, Night</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map(t => (
            <div key={t.id} className="p-4 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl border border-[#D9DEE5] dark:border-[#1F2630]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.color }} />
                  <div>
                    <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{t.name}</div>
                    <div className="text-xs text-[#6B7280]">{t.code}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditingTemplate(t); setShowModal(true); }} className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg">
                    <Edit2 size={14} className="text-[#6B7280]" />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg">
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-[#0E1116] dark:text-[#E6E8EB]">
                {t.start_time} - {t.end_time}
                <span className="text-[#6B7280] ml-2">({t.break_duration_minutes} min break)</span>
              </div>
              <div className="flex gap-1 mt-2">
                {[0,1,2,3,4,5,6].map(d => (
                  <span key={d} className={`px-2 py-0.5 rounded text-xs ${
                    t.applicable_days?.includes(d) 
                      ? 'bg-[#5FA8D3]/20 text-[#5FA8D3]' 
                      : 'bg-[#ECEFF3] dark:bg-[#1F2630] text-[#6B7280]'
                  }`}>
                    {dayNames[d]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ShiftTemplateModal
          template={editingTemplate}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchTemplates(); }}
        />
      )}
    </div>
  );
};

// ============== SHIFT TEMPLATE MODAL ==============
const ShiftTemplateModal = ({ template, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    name: template?.name || '',
    code: template?.code || '',
    start_time: template?.start_time || '09:00',
    end_time: template?.end_time || '17:00',
    break_duration_minutes: template?.break_duration_minutes || 60,
    color: template?.color || '#5FA8D3',
    applicable_days: template?.applicable_days || [0,1,2,3,4],
  });
  const [saving, setSaving] = useState(false);

  const toggleDay = (day) => {
    setForm(prev => ({
      ...prev,
      applicable_days: prev.applicable_days.includes(day)
        ? prev.applicable_days.filter(d => d !== day)
        : [...prev.applicable_days, day].sort()
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (template) {
        await api.updateShiftTemplate(template.id, form);
      } else {
        await api.createShiftTemplate(form);
      }
      onSuccess();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const colors = ['#5FA8D3', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#171C22] rounded-2xl shadow-2xl max-w-md w-full border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex items-center justify-between p-5 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">
            {template ? 'Edit Shift Template' : 'Add Shift Template'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg">
            <X size={20} className="text-[#6B7280]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Shift Name *" value={form.name} onChange={(v) => setForm({...form, name: v})} placeholder="e.g., Morning" />
            <InputField label="Code *" value={form.code} onChange={(v) => setForm({...form, code: v.toUpperCase()})} placeholder="e.g., MOR" maxLength={5} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Start Time" type="time" value={form.start_time} onChange={(v) => setForm({...form, start_time: v})} />
            <InputField label="End Time" type="time" value={form.end_time} onChange={(v) => setForm({...form, end_time: v})} />
          </div>
          <InputField label="Break Duration (minutes)" type="number" value={form.break_duration_minutes} onChange={(v) => setForm({...form, break_duration_minutes: parseInt(v)})} />
          
          <div>
            <label className="block text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB] mb-2">Color</label>
            <div className="flex gap-2">
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({...form, color: c})}
                  className={`w-8 h-8 rounded-full border-2 ${form.color === c ? 'border-[#0E1116] dark:border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB] mb-2">Applicable Days</label>
            <div className="flex flex-wrap gap-2">
              {dayNames.map((day, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    form.applicable_days.includes(i)
                      ? 'bg-[#5FA8D3] text-white'
                      : 'bg-[#F6F7F9] dark:bg-[#1F2630] text-[#6B7280]'
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#6B7280]">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-[#5FA8D3] text-white rounded-xl font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============== STAFF SCHEDULES ==============
const StaffSchedules = () => {
  const [schedules, setSchedules] = useState([]);
  const [staff, setStaff] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(getWeekDates(new Date()));
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    fetchData();
  }, [currentWeek]);

  const fetchData = async () => {
    try {
      const [schedRes, staffRes, tempRes] = await Promise.all([
        api.getStaffSchedules({ start_date: currentWeek[0], end_date: currentWeek[6] }),
        api.getStaff(),
        api.getShiftTemplates()
      ]);
      setSchedules(schedRes.data || []);
      setStaff(staffRes.data || []);
      setTemplates(tempRes.data || []);
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (id) => {
    try {
      await api.deleteStaffSchedule(id);
      fetchData();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const prevWeek = () => {
    const d = new Date(currentWeek[0]);
    d.setDate(d.getDate() - 7);
    setCurrentWeek(getWeekDates(d));
  };

  const nextWeek = () => {
    const d = new Date(currentWeek[0]);
    d.setDate(d.getDate() + 7);
    setCurrentWeek(getWeekDates(d));
  };

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevWeek} className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg">
          <ChevronLeft size={20} className="text-[#6B7280]" />
        </button>
        <div className="text-center">
          <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">
            {formatDate(currentWeek[0])} - {formatDate(currentWeek[6])}
          </div>
        </div>
        <button onClick={nextWeek} className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg">
          <ChevronRight size={20} className="text-[#6B7280]" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-[#6B7280]">Loading...</div>
      ) : staff.length === 0 ? (
        <div className="text-center py-12 text-[#6B7280]">
          <Users size={48} className="mx-auto mb-4 opacity-50" />
          <p>Add staff members first to create schedules</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D9DEE5] dark:border-[#1F2630]">
                <th className="text-left py-3 px-4 text-sm font-medium text-[#6B7280] w-48">Staff</th>
                {currentWeek.map((date, i) => (
                  <th key={date} className="text-center py-3 px-2 text-sm font-medium text-[#6B7280] min-w-[100px]">
                    <div>{dayNames[i]}</div>
                    <div className="text-xs">{date.split('-').slice(1).join('/')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} className="border-b border-[#D9DEE5] dark:border-[#1F2630] hover:bg-[#F6F7F9] dark:hover:bg-[#0B0D10]/50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-[#0E1116] dark:text-[#E6E8EB] text-sm">{s.full_name}</div>
                    <div className="text-xs text-[#6B7280]">{s.designation}</div>
                  </td>
                  {currentWeek.map(date => {
                    const schedule = schedules.find(sc => sc.staff_id === s.id && sc.date === date);
                    return (
                      <td key={date} className="py-2 px-2 text-center">
                        {schedule ? (
                          <div
                            className="px-2 py-1 rounded-lg text-xs font-medium cursor-pointer group relative"
                            style={{ backgroundColor: `${schedule.shift_color}20`, color: schedule.shift_color }}
                            onClick={() => handleDeleteSchedule(schedule.id)}
                          >
                            {schedule.shift_name}
                            <div className="text-[10px] opacity-70">{schedule.shift_start}-{schedule.shift_end}</div>
                            <div className="absolute inset-0 bg-red-500/80 text-white rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs transition-opacity">
                              Remove
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setSelectedDate({ staffId: s.id, date }); setShowAssignModal(true); }}
                            className="w-full py-2 border-2 border-dashed border-[#D9DEE5] dark:border-[#1F2630] rounded-lg text-[#6B7280] hover:border-[#5FA8D3] hover:text-[#5FA8D3] transition-all"
                          >
                            <Plus size={14} className="mx-auto" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAssignModal && selectedDate && (
        <AssignShiftModal
          staffId={selectedDate.staffId}
          date={selectedDate.date}
          templates={templates}
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => { setShowAssignModal(false); fetchData(); }}
        />
      )}
    </div>
  );
};

// ============== ASSIGN SHIFT MODAL ==============
const AssignShiftModal = ({ staffId, date, templates, onClose, onSuccess }) => {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAssign = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      await api.createStaffSchedule({
        staff_id: staffId,
        shift_template_id: selectedTemplate,
        date: date
      });
      onSuccess();
    } catch (error) {
      console.error('Failed to assign:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#171C22] rounded-2xl shadow-2xl max-w-sm w-full border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex items-center justify-between p-5 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Assign Shift</h3>
          <button onClick={onClose} className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg">
            <X size={20} className="text-[#6B7280]" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-sm text-[#6B7280] text-center">{date}</div>
          <div className="space-y-2">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={`w-full p-3 rounded-xl border text-left transition-all ${
                  selectedTemplate === t.id
                    ? 'border-[#5FA8D3] bg-[#5FA8D3]/10'
                    : 'border-[#D9DEE5] dark:border-[#1F2630] hover:border-[#5FA8D3]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                  <div>
                    <div className="font-medium text-[#0E1116] dark:text-[#E6E8EB]">{t.name}</div>
                    <div className="text-xs text-[#6B7280]">{t.start_time} - {t.end_time}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={handleAssign}
            disabled={!selectedTemplate || saving}
            className="w-full py-2.5 bg-[#5FA8D3] text-white rounded-xl font-medium disabled:opacity-50"
          >
            {saving ? 'Assigning...' : 'Assign Shift'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============== HOLIDAYS ==============
const Holidays = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const res = await api.getHolidays({ year: new Date().getFullYear() });
      setHolidays(res.data || []);
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this holiday?')) return;
    try {
      await api.deleteHoliday(id);
      fetchHolidays();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const getTypeStyle = (type) => {
    switch (type) {
      case 'public': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'company': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'optional': return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-[#6B7280] dark:text-[#7D8590]">
          Configure holidays for {new Date().getFullYear()}
        </p>
        <button
          onClick={() => { setEditingHoliday(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#5FA8D3] text-white rounded-xl font-medium hover:bg-[#4A95C0]"
        >
          <Plus size={18} />
          Add Holiday
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-[#6B7280]">Loading...</div>
      ) : holidays.length === 0 ? (
        <div className="text-center py-12 text-[#6B7280]">
          <Gift size={48} className="mx-auto mb-4 opacity-50" />
          <p>No holidays configured</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {holidays.map(h => (
            <div key={h.id} className="flex items-center justify-between p-4 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl border border-[#D9DEE5] dark:border-[#1F2630]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#5FA8D3]/10 flex flex-col items-center justify-center">
                  <div className="text-xs text-[#5FA8D3] font-medium">{new Date(h.date).toLocaleDateString('en', { month: 'short' })}</div>
                  <div className="text-lg font-bold text-[#5FA8D3]">{new Date(h.date).getDate()}</div>
                </div>
                <div>
                  <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{h.name}</div>
                  <div className="text-sm text-[#6B7280]">
                    {new Date(h.date).toLocaleDateString('en', { weekday: 'long' })}
                    {h.recurring && ' • Recurring'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeStyle(h.holiday_type)}`}>
                  {h.holiday_type}
                </span>
                <button onClick={() => { setEditingHoliday(h); setShowModal(true); }} className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg">
                  <Edit2 size={16} className="text-[#6B7280]" />
                </button>
                <button onClick={() => handleDelete(h.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg">
                  <Trash2 size={16} className="text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <HolidayModal
          holiday={editingHoliday}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchHolidays(); }}
        />
      )}
    </div>
  );
};

// ============== HOLIDAY MODAL ==============
const HolidayModal = ({ holiday, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    name: holiday?.name || '',
    date: holiday?.date || new Date().toISOString().split('T')[0],
    holiday_type: holiday?.holiday_type || 'public',
    recurring: holiday?.recurring || false,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (holiday) {
        await api.updateHoliday(holiday.id, form);
      } else {
        await api.createHoliday(form);
      }
      onSuccess();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#171C22] rounded-2xl shadow-2xl max-w-md w-full border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex items-center justify-between p-5 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">
            {holiday ? 'Edit Holiday' : 'Add Holiday'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg">
            <X size={20} className="text-[#6B7280]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <InputField label="Holiday Name *" value={form.name} onChange={(v) => setForm({...form, name: v})} placeholder="e.g., Independence Day" />
          <InputField label="Date *" type="date" value={form.date} onChange={(v) => setForm({...form, date: v})} />
          <SelectField label="Type" value={form.holiday_type} onChange={(v) => setForm({...form, holiday_type: v})} options={[
            { value: 'public', label: 'Public Holiday' },
            { value: 'company', label: 'Company Holiday' },
            { value: 'optional', label: 'Optional Holiday' },
          ]} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({...form, recurring: e.target.checked})} className="w-4 h-4 rounded" />
            <span className="text-sm text-[#0E1116] dark:text-[#E6E8EB]">Recurring (repeats every year)</span>
          </label>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#6B7280]">Cancel</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-[#5FA8D3] text-white rounded-xl font-medium disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============== HELPER COMPONENTS ==============
const InputField = ({ label, type = 'text', value, onChange, placeholder, maxLength }) => (
  <div>
    <label className="block text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB] mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full px-3 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#0B0D10] text-[#0E1116] dark:text-[#E6E8EB] placeholder:text-[#6B7280]"
    />
  </div>
);

const SelectField = ({ label, value, onChange, options }) => (
  <div>
    <label className="block text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB] mb-1">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#0B0D10] text-[#0E1116] dark:text-[#E6E8EB]"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

// ============== HELPER FUNCTIONS ==============
function getWeekDates(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export default AdminStaff;
