import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Users, Calendar, Timer, BarChart3, LogIn, LogOut, X
} from 'lucide-react';

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

// ============== PAGE HEADER ==============
const PageHeader = ({ icon: Icon, title, description }) => (
  <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630] mb-6">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl accent-gradient-bg flex items-center justify-center shadow-lg">
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">{title}</h1>
        <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">{description}</p>
      </div>
    </div>
  </div>
);

// ============== PAGE EXPORT ==============
const StaffAttendancePage = () => (
  <div className="space-y-6">
    <PageHeader icon={Timer} title="Attendance" description="Track daily clock-ins, clock-outs, and attendance records" />
    <AttendanceTracker onUpdate={() => {}} />
  </div>
);

export default StaffAttendancePage;
