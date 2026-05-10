import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Gift, Plus, Edit2, Trash2, X } from 'lucide-react';
import { InputField, SelectField } from './staffUtils';

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
const StaffHolidaysPage = () => (
  <div className="space-y-6">
    <PageHeader icon={Gift} title="Holidays" description="Manage public holidays and office closures" />
    <Holidays />
  </div>
);

export default StaffHolidaysPage;
