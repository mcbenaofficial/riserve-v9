import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { FileText, Plus, Edit2, Trash2, X } from 'lucide-react';
import { InputField, SelectField } from './staffUtils';

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
const StaffLeavePoliciesPage = () => (
  <div className="space-y-6">
    <PageHeader icon={FileText} title="Leave Policies" description="Configure leave types and entitlements for your team" />
    <LeavePolicies />
  </div>
);

export default StaffLeavePoliciesPage;
