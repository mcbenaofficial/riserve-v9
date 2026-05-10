import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Users, UserPlus, Search, Edit2, Trash2, X, AlertCircle,
  Phone, Mail, MapPin, Briefcase
} from 'lucide-react';
import { InputField, SelectField } from './staffUtils';

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
const StaffDirectoryPage = () => (
  <div className="space-y-6">
    <PageHeader icon={Users} title="Staff Directory" description="Manage your team members and their profiles" />
    <StaffDirectory onUpdate={() => {}} />
  </div>
);

export default StaffDirectoryPage;
