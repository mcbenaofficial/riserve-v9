import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Building2, Users, Calendar, ArrowLeft, Edit2, Save, X,
  Crown, CheckCircle, XCircle, AlertCircle, Clock, Activity,
  Mail, Phone, MapPin, Briefcase, Shield, Eye, UserPlus,
  Pause, Play, Trash2
} from 'lucide-react';
import { api } from '../services/api';

const CompanyDetail = ({ theme }) => {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [plans, setPlans] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchCompany = useCallback(async () => {
    try {
      setLoading(true);
      const [companyRes, plansRes] = await Promise.all([
        api.getCompany(companyId),
        api.getSubscriptionPlans()
      ]);
      setCompany(companyRes.data);
      setPlans(plansRes.data);
      setEditForm({
        name: companyRes.data.name,
        business_type: companyRes.data.business_type,
        email: companyRes.data.email,
        phone: companyRes.data.phone || '',
        address: companyRes.data.address || ''
      });
    } catch (error) {
      console.error('Error fetching company:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.updateCompany(companyId, editForm);
      await fetchCompany();
      setEditing(false);
    } catch (error) {
      console.error('Error updating company:', error);
    } finally {
      setSaving(false);
    }
  };

  const handlePlanChange = async (newPlan) => {
    try {
      setSaving(true);
      await api.changeCompanyPlan(companyId, newPlan);
      await fetchCompany();
      setShowPlanModal(false);
    } catch (error) {
      console.error('Error changing plan:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async () => {
    if (!window.confirm('Are you sure you want to suspend this company?')) return;
    try {
      await api.suspendCompany(companyId);
      await fetchCompany();
    } catch (error) {
      console.error('Error suspending company:', error);
    }
  };

  const handleActivate = async () => {
    try {
      await api.activateCompany(companyId);
      await fetchCompany();
    } catch (error) {
      console.error('Error activating company:', error);
    }
  };

  const handleDeactivate = async () => {
    try {
      setSaving(true);
      await api.deactivateCompany(companyId, deactivateReason);
      await fetchCompany();
      setShowDeactivateModal(false);
      setDeactivateReason('');
    } catch (error) {
      console.error('Error deactivating company:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReactivate = async () => {
    if (!window.confirm('Are you sure you want to reactivate this company? This will cancel the scheduled deletion.')) return;
    try {
      await api.reactivateCompany(companyId);
      await fetchCompany();
    } catch (error) {
      console.error('Error reactivating company:', error);
    }
  };

  const handleImpersonate = async () => {
    try {
      // Store the original Super Admin token BEFORE getting the new one
      const originalToken = localStorage.getItem('ridn_token');
      
      const response = await api.impersonateCompany(companyId);
      
      // Store impersonation data
      localStorage.setItem('ridn_original_token', originalToken);
      localStorage.setItem('ridn_impersonating', 'true');
      localStorage.setItem('ridn_impersonated_company', response.data.company?.name || 'Company');
      
      // Set the new impersonation token
      localStorage.setItem('ridn_token', response.data.token);
      
      window.location.href = '/';
    } catch (error) {
      console.error('Error impersonating:', error);
    }
  };

  const getPlanColor = (plan) => {
    const colors = {
      trial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      free: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      essential: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      pro: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      custom: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    };
    return colors[plan] || colors.free;
  };

  const getStatusIcon = (status) => {
    if (status === 'active') return <CheckCircle size={16} className="text-green-500" />;
    if (status === 'suspended') return <XCircle size={16} className="text-red-500" />;
    if (status === 'deactivated') return <Trash2 size={16} className="text-red-500" />;
    return <AlertCircle size={16} className="text-yellow-500" />;
  };

  const getDaysUntilDeletion = () => {
    if (!company?.scheduled_deletion_date) return null;
    const deletionDate = new Date(company.scheduled_deletion_date);
    const now = new Date();
    const diffTime = deletionDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5FA8D3]"></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <Building2 size={48} className={`mx-auto mb-4 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`} />
        <p className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}>Company not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/super-admin')}
            className={`p-2 rounded-xl ${theme === 'dark' ? 'hover:bg-[#1F2630]' : 'hover:bg-[#F6F7F9]'} transition-colors`}
          >
            <ArrowLeft size={20} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
          </button>
          <div>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
              {company.name}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getPlanColor(company.plan)}`}>
                {company.plan === 'pro' && <Crown size={12} />}
                {company.plan.charAt(0).toUpperCase() + company.plan.slice(1)}
              </span>
              <div className="flex items-center gap-1">
                {getStatusIcon(company.status)}
                <span className={`text-sm capitalize ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  {company.status}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleImpersonate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white transition-colors"
          >
            <Eye size={16} />
            Impersonate
          </button>
          {company.status === 'active' ? (
            <>
              <button
                onClick={handleSuspend}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors"
              >
                <Pause size={16} />
                Suspend
              </button>
              <button
                onClick={() => setShowDeactivateModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                <Trash2 size={16} />
                Deactivate
              </button>
            </>
          ) : company.status === 'suspended' ? (
            <>
              <button
                onClick={handleActivate}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white transition-colors"
              >
                <Play size={16} />
                Activate
              </button>
              <button
                onClick={() => setShowDeactivateModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                <Trash2 size={16} />
                Deactivate
              </button>
            </>
          ) : company.status === 'deactivated' ? (
            <button
              onClick={handleReactivate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white transition-colors"
            >
              <Play size={16} />
              Reactivate
            </button>
          ) : null}
        </div>
      </div>

      {/* Deactivation Warning Banner */}
      {company.status === 'deactivated' && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/20">
              <AlertCircle size={20} className="text-red-500" />
            </div>
            <div className="flex-1">
              <div className={`font-semibold ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                Company Deactivated
              </div>
              <div className={`text-sm ${theme === 'dark' ? 'text-red-300/70' : 'text-red-500/70'}`}>
                {getDaysUntilDeletion() !== null && (
                  <>
                    Data will be permanently deleted in <strong>{getDaysUntilDeletion()} days</strong>
                    {company.scheduled_deletion_date && (
                      <> (on {new Date(company.scheduled_deletion_date).toLocaleDateString()})</>
                    )}
                  </>
                )}
                {company.deactivation_reason && (
                  <span className="block mt-1">Reason: {company.deactivation_reason}</span>
                )}
              </div>
            </div>
            <button
              onClick={handleReactivate}
              className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
            >
              Reactivate Now
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'}`}>
          <div className="flex items-center gap-3 mb-2">
            <Users size={20} className="text-[#5FA8D3]" />
            <span className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Users</span>
          </div>
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            {company.stats?.users || 0}
          </div>
        </div>
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'}`}>
          <div className="flex items-center gap-3 mb-2">
            <Building2 size={20} className="text-purple-500" />
            <span className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Outlets</span>
          </div>
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            {company.stats?.outlets || 0}
            {company.plan_info?.limits?.outlets > 0 && (
              <span className={`text-sm font-normal ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                {' '}/ {company.plan_info.limits.outlets}
              </span>
            )}
          </div>
        </div>
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'}`}>
          <div className="flex items-center gap-3 mb-2">
            <Calendar size={20} className="text-emerald-500" />
            <span className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Total Bookings</span>
          </div>
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            {company.stats?.bookings || 0}
          </div>
        </div>
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'}`}>
          <div className="flex items-center gap-3 mb-2">
            <Clock size={20} className="text-amber-500" />
            <span className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>This Month</span>
          </div>
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            {company.stats?.bookings_this_month || 0}
            {company.plan_info?.limits?.bookings_per_month > 0 && (
              <span className={`text-sm font-normal ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                {' '}/ {company.plan_info.limits.bookings_per_month}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Details */}
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
              Company Details
            </h3>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[#5FA8D3] hover:bg-[#5FA8D3]/10 transition-colors"
              >
                <Edit2 size={14} />
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-[#1F2630]' : 'hover:bg-[#F6F7F9]'}`}
                >
                  <X size={16} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#5FA8D3] text-white hover:bg-[#4A95C0] transition-colors disabled:opacity-50"
                >
                  <Save size={14} />
                  Save
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className={`text-xs font-medium ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                Company Name
              </label>
              {editing ? (
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={`w-full mt-1 px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} border-none outline-none`}
                />
              ) : (
                <div className={`flex items-center gap-2 mt-1 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  <Building2 size={16} className="text-[#5FA8D3]" />
                  {company.name}
                </div>
              )}
            </div>

            <div>
              <label className={`text-xs font-medium ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                Business Type
              </label>
              {editing ? (
                <input
                  type="text"
                  value={editForm.business_type}
                  onChange={(e) => setEditForm({ ...editForm, business_type: e.target.value })}
                  className={`w-full mt-1 px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} border-none outline-none`}
                />
              ) : (
                <div className={`flex items-center gap-2 mt-1 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  <Briefcase size={16} className="text-purple-500" />
                  {company.business_type}
                </div>
              )}
            </div>

            <div>
              <label className={`text-xs font-medium ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                Email
              </label>
              {editing ? (
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className={`w-full mt-1 px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} border-none outline-none`}
                />
              ) : (
                <div className={`flex items-center gap-2 mt-1 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  <Mail size={16} className="text-emerald-500" />
                  {company.email}
                </div>
              )}
            </div>

            <div>
              <label className={`text-xs font-medium ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                Phone
              </label>
              {editing ? (
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className={`w-full mt-1 px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} border-none outline-none`}
                />
              ) : (
                <div className={`flex items-center gap-2 mt-1 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  <Phone size={16} className="text-amber-500" />
                  {company.phone || 'Not set'}
                </div>
              )}
            </div>

            <div>
              <label className={`text-xs font-medium ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                Address
              </label>
              {editing ? (
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className={`w-full mt-1 px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} border-none outline-none`}
                />
              ) : (
                <div className={`flex items-center gap-2 mt-1 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  <MapPin size={16} className="text-red-500" />
                  {company.address || 'Not set'}
                </div>
              )}
            </div>

            <div>
              <label className={`text-xs font-medium ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                Created
              </label>
              <div className={`flex items-center gap-2 mt-1 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                <Clock size={16} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                {new Date(company.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
              Subscription
            </h3>
            <button
              onClick={() => setShowPlanModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[#5FA8D3] hover:bg-[#5FA8D3]/10 transition-colors"
            >
              <Shield size={14} />
              Change Plan
            </button>
          </div>

          <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'} mb-4`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${getPlanColor(company.plan)}`}>
                {company.plan === 'pro' && <Crown size={14} />}
                {company.plan.charAt(0).toUpperCase() + company.plan.slice(1)} Plan
              </span>
            </div>
            
            {company.plan === 'trial' && company.trial_end && (
              <div className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                Trial ends: {new Date(company.trial_end).toLocaleDateString()}
              </div>
            )}
          </div>

          <h4 className={`text-sm font-medium mb-3 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            Plan Limits
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Outlets</span>
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                {company.plan_info?.limits?.outlets === -1 ? 'Unlimited' : company.plan_info?.limits?.outlets}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Bookings/Month</span>
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                {company.plan_info?.limits?.bookings_per_month === -1 ? 'Unlimited' : company.plan_info?.limits?.bookings_per_month}
              </span>
            </div>
          </div>

          <h4 className={`text-sm font-medium mt-6 mb-3 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            Features
          </h4>
          <div className="flex flex-wrap gap-2">
            {company.plan_info?.features?.map((feature) => (
              <span 
                key={feature}
                className={`px-2 py-1 rounded-lg text-xs ${theme === 'dark' ? 'bg-[#1F2630] text-[#7D8590]' : 'bg-[#F6F7F9] text-[#6B7280]'}`}
              >
                {feature.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Licensed Modules */}
      <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            Licensed Modules
          </h3>
          <span className={`text-xs ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
            Click to toggle
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'booking', label: 'Booking', color: 'blue' },
            { id: 'inventory', label: 'Inventory', color: 'purple' },
            { id: 'supplier', label: 'Supplier', color: 'indigo' },
            { id: 'workspace', label: 'Workspace', color: 'teal' },
            { id: 'restaurant_orders', label: 'Restaurant Orders', color: 'amber' },
            { id: 'retail_pos', label: 'Retail POS', color: 'orange' },
            { id: 'customer_360', label: 'Customer 360', color: 'pink' },
            { id: 'finance', label: 'Finance', color: 'emerald' },
            { id: 'flow', label: 'Flow', color: 'cyan' },
            { id: 'smart_analytics', label: 'Smart Analytics', color: 'violet' },
            { id: 'hq_intelligence', label: 'HQ Intelligence', color: 'rose' },
          ].map(mod => {
            const modules = company.licensed_modules || [];
            const isActive = modules.includes(mod.id);
            return (
              <button
                key={mod.id}
                onClick={async () => {
                  const updated = isActive
                    ? modules.filter(m => m !== mod.id)
                    : [...modules, mod.id];
                  try {
                    await api.updateCompanyModules(companyId, updated);
                    await fetchCompany();
                  } catch (error) {
                    console.error('Error updating modules:', error);
                  }
                }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? `bg-${mod.color}-500/20 text-${mod.color}-${theme === 'dark' ? '300' : '600'} border border-${mod.color}-500/30 shadow-sm`
                    : `${theme === 'dark' ? 'bg-[#1F2630] text-[#7D8590] border border-transparent' : 'bg-[#F6F7F9] text-[#6B7280] border border-transparent'} hover:border-gray-300 dark:hover:border-gray-600`
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {isActive && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {mod.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Users Table */}
      <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            Users ({company.users?.length || 0})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>User</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Role</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Status</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9DEE5] dark:divide-[#1F2630]">
              {company.users?.map((user) => (
                <tr key={user.id} className="hover:bg-[#5FA8D3]/10 dark:hover:bg-[#5FA8D3]/15 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
                        <Users size={14} className="text-[#5FA8D3]" />
                      </div>
                      <div>
                        <div className={`font-medium ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{user.name}</div>
                        <div className={`text-xs ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-lg text-xs ${
                      user.role === 'Admin' 
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                        : user.role === 'Manager'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${user.status === 'Active' ? 'text-green-500' : 'text-red-500'}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(!company.users || company.users.length === 0) && (
          <div className="text-center py-8">
            <Users size={32} className={`mx-auto mb-2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`} />
            <p className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}>No users found</p>
          </div>
        )}
      </div>

      {/* Plan Change Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-lg p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                Change Subscription Plan
              </h3>
              <button onClick={() => setShowPlanModal(false)}>
                <X size={20} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
              </button>
            </div>

            <div className="space-y-3">
              {Object.entries(plans).map(([planKey, planData]) => (
                <button
                  key={planKey}
                  onClick={() => handlePlanChange(planKey)}
                  disabled={saving || company.plan === planKey}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    company.plan === planKey
                      ? theme === 'dark' ? 'bg-[#5FA8D3]/20 border-2 border-[#5FA8D3]' : 'bg-[#5FA8D3]/10 border-2 border-[#5FA8D3]'
                      : theme === 'dark' ? 'bg-[#1F2630] hover:bg-[#1F2630]/80' : 'bg-[#F6F7F9] hover:bg-[#ECEFF3]'
                  } ${saving ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-medium ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                      {planData.name}
                    </span>
                    {company.plan === planKey && (
                      <span className="text-xs text-[#5FA8D3]">Current</span>
                    )}
                  </div>
                  <div className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                    {planData.limits.outlets === -1 ? 'Unlimited' : planData.limits.outlets} outlets, {' '}
                    {planData.limits.bookings_per_month === -1 ? 'Unlimited' : planData.limits.bookings_per_month} bookings/mo
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-md p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-red-500/10">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  Deactivate Company
                </h3>
                <p className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  This action can be undone within 60 days
                </p>
              </div>
            </div>

            <div className={`p-4 rounded-xl mb-6 ${theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'}`}>
              <div className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                Warning: Deactivating this company will:
              </div>
              <ul className={`text-sm space-y-1 ${theme === 'dark' ? 'text-red-300/70' : 'text-red-500/70'}`}>
                <li>• Immediately block all user access</li>
                <li>• Disable all bookings and services</li>
                <li>• Schedule permanent data deletion in 60 days</li>
              </ul>
            </div>

            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                Reason for deactivation (optional)
              </label>
              <textarea
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="e.g., Customer requested account closure, Non-payment, Violation of terms..."
                rows={3}
                className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB] placeholder-[#7D8590]' : 'bg-[#F6F7F9] text-[#0E1116] placeholder-[#6B7280]'} border-none outline-none resize-none`}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeactivateModal(false);
                  setDeactivateReason('');
                }}
                className={`flex-1 px-4 py-3 rounded-xl font-medium ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB] hover:bg-[#2A313C]' : 'bg-[#F6F7F9] text-[#0E1116] hover:bg-[#ECEFF3]'} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeactivate}
                disabled={saving}
                className="flex-1 px-4 py-3 rounded-xl font-medium bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'Deactivating...' : 'Deactivate Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyDetail;
