import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Calendar, ChevronLeft, ChevronRight, Users, Plus, X } from 'lucide-react';
import { getWeekDates, formatDate } from './staffUtils';

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
const StaffSchedulesPage = () => (
  <div className="space-y-6">
    <PageHeader icon={Calendar} title="Staff Schedules" description="Assign shifts and view weekly staff schedules" />
    <StaffSchedules />
  </div>
);

export default StaffSchedulesPage;
