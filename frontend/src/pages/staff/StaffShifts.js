import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Clock, Plus, Edit2, Trash2, X } from 'lucide-react';
import { InputField } from './staffUtils';

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
const StaffShiftsPage = () => (
  <div className="space-y-6">
    <PageHeader icon={Clock} title="Shift Templates" description="Create and manage reusable shift templates" />
    <ShiftTemplates />
  </div>
);

export default StaffShiftsPage;
