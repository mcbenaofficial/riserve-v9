import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, Search, Plus, Crown, Eye, Edit2, Power,
  CheckCircle, XCircle, AlertCircle, Filter, X, Save,
  Mail, Phone, MapPin, Briefcase, Calendar, Shield, Package, Sparkles, BarChart3, Globe, Code
} from 'lucide-react';
import { api } from '../services/api';

const SuperAdminCompanies = ({ theme }) => {
  const [companies, setCompanies] = useState([]);
  const [planDistribution, setPlanDistribution] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Deactivate modal state
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivatingCompany, setDeactivatingCompany] = useState(null);
  
  // Add Company modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    business_type: '',
    email: '',
    phone: '',
    address: '',
    plan: 'trial',
    admin_name: '',
    admin_email: '',
    admin_password: ''
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashboardRes, companiesRes] = await Promise.all([
        api.getSuperAdminDashboard(),
        api.getCompanies()
      ]);
      setPlanDistribution(dashboardRes.data.plan_distribution || {});
      setCompanies(companiesRes.data);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = !searchQuery || 
      company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      company.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = !filterPlan || company.plan === filterPlan;
    const matchesStatus = !filterStatus || company.status === filterStatus;
    return matchesSearch && matchesPlan && matchesStatus;
  });

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
    if (status === 'active') return <CheckCircle size={14} className="text-green-500" />;
    if (status === 'suspended' || status === 'deactivated') return <XCircle size={14} className="text-red-500" />;
    return <AlertCircle size={14} className="text-yellow-500" />;
  };

  const getStatusColor = (status) => {
    if (status === 'active') return 'text-green-500';
    if (status === 'suspended') return 'text-orange-500';
    if (status === 'deactivated') return 'text-red-500';
    return 'text-gray-500';
  };

  // Edit handlers
  const handleEditClick = (company) => {
    setEditingCompany(company);
    setEditForm({
      name: company.name,
      business_type: company.business_type,
      email: company.email,
      phone: company.phone || '',
      address: company.address || '',
      plan: company.plan,
      enabled_features: company.enabled_features || []
    });
    setShowEditModal(true);
  };

  const handleFeatureToggle = (featureId) => {
    setEditForm(prev => {
      const features = prev.enabled_features || [];
      if (features.includes(featureId)) {
        return { ...prev, enabled_features: features.filter(f => f !== featureId) };
      } else {
        return { ...prev, enabled_features: [...features, featureId] };
      }
    });
  };

  const availableFeatures = [
    { id: 'inventory', name: 'Inventory Management', icon: Package, description: 'Track products and stock levels' },
    { id: 'ai_assistant', name: 'AI Assistant', icon: Sparkles, description: 'AI-powered insights' },
    { id: 'advanced_reports', name: 'Advanced Reports', icon: BarChart3, description: 'Detailed analytics' },
    { id: 'multi_location', name: 'Multi-Location', icon: Globe, description: 'Multiple outlets' },
    { id: 'api_access', name: 'API Access', icon: Code, description: 'REST API integration' }
  ];

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      
      // Update company details including features
      await api.updateCompany(editingCompany.id, {
        name: editForm.name,
        business_type: editForm.business_type,
        email: editForm.email,
        phone: editForm.phone,
        address: editForm.address,
        enabled_features: editForm.enabled_features
      });
      
      // Update plan if changed
      if (editForm.plan !== editingCompany.plan) {
        await api.changeCompanyPlan(editingCompany.id, editForm.plan);
      }
      
      await fetchData();
      setShowEditModal(false);
      setEditingCompany(null);
    } catch (error) {
      console.error('Error updating company:', error);
    } finally {
      setSaving(false);
    }
  };

  // Deactivate/Activate handlers
  const handleDeactivateClick = (company) => {
    setDeactivatingCompany(company);
    setShowDeactivateModal(true);
  };

  const handleConfirmDeactivate = async () => {
    try {
      setSaving(true);
      if (deactivatingCompany.status === 'active') {
        await api.deactivateCompany(deactivatingCompany.id);
      } else {
        await api.activateCompany(deactivatingCompany.id);
      }
      await fetchData();
      setShowDeactivateModal(false);
      setDeactivatingCompany(null);
    } catch (error) {
      console.error('Error toggling company status:', error);
    } finally {
      setSaving(false);
    }
  };

  // Add Company handler
  const handleCreateCompany = async () => {
    try {
      setSaving(true);
      await api.createCompany(addForm);
      await fetchData();
      setShowAddModal(false);
      setAddForm({
        name: '',
        business_type: '',
        email: '',
        phone: '',
        address: '',
        plan: 'trial',
        admin_name: '',
        admin_email: '',
        admin_password: ''
      });
    } catch (error) {
      console.error('Error creating company:', error);
      alert(error.response?.data?.detail || 'Error creating company');
    } finally {
      setSaving(false);
    }
  };

  const totalCompanies = companies.length;
  const plans = ['trial', 'free', 'essential', 'pro', 'custom'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5FA8D3]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0]">
            <Building2 size={24} className="text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
              Companies
            </h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
              Manage all registered companies
            </p>
          </div>
        </div>
        <button 
          className="flex items-center gap-2 px-4 py-2 bg-[#5FA8D3] hover:bg-[#4A95C0] text-white rounded-xl transition-colors"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={18} />
          Add Company
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-sm`}>
          <div className={`text-3xl font-bold mb-1 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            {totalCompanies}
          </div>
          <div className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
            Total Companies
          </div>
        </div>

        {Object.entries(planDistribution).map(([plan, count]) => (
          <div 
            key={plan}
            className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-sm`}
          >
            <div className={`text-3xl font-bold mb-1 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
              {count}
            </div>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getPlanColor(plan)}`}>
              {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </span>
          </div>
        ))}
      </div>

      {/* Companies Table */}
      <div className={`rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-sm overflow-hidden`}>
        {/* Filters */}
        <div className="p-6 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                Filter Companies
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
                <Search size={16} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`bg-transparent border-none outline-none text-sm w-48 ${theme === 'dark' ? 'text-[#E6E8EB] placeholder-[#7D8590]' : 'text-[#0E1116] placeholder-[#6B7280]'}`}
                />
              </div>
              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
                className={`px-3 py-2 rounded-xl text-sm ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} border-none outline-none`}
              >
                <option value="">All Plans</option>
                <option value="trial">Trial</option>
                <option value="free">Free</option>
                <option value="essential">Essential</option>
                <option value="pro">Pro</option>
                <option value="custom">Custom</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`px-3 py-2 rounded-xl text-sm ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} border-none outline-none`}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="deactivated">Deactivated</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Company
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Business Type
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Plan
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Status
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Users
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Bookings
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Created
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9DEE5] dark:divide-[#1F2630]">
              {filteredCompanies.map((company) => (
                <tr key={company.id} className="hover:bg-[#5FA8D3]/10 dark:hover:bg-[#5FA8D3]/15 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
                        <Building2 size={18} className="text-[#5FA8D3]" />
                      </div>
                      <div>
                        <div className={`font-medium ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                          {company.name}
                        </div>
                        <div className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                          {company.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-sm ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                    {company.business_type}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getPlanColor(company.plan)}`}>
                      {company.plan === 'pro' && <Crown size={12} />}
                      {company.plan.charAt(0).toUpperCase() + company.plan.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(company.status)}
                      <span className={`text-sm capitalize ${getStatusColor(company.status)}`}>
                        {company.status}
                      </span>
                    </div>
                    {company.status === 'deactivated' && company.deletion_scheduled && (
                      <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                        Deletes: {new Date(company.deletion_scheduled).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                    {company.user_count || 0}
                  </td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                    {company.booking_count || 0}
                  </td>
                  <td className={`px-6 py-4 text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                    {new Date(company.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button 
                        className={`p-2 rounded-lg hover:bg-[#5FA8D3]/10 transition-colors`}
                        title="View Details"
                        onClick={() => window.location.href = `/super-admin/companies/${company.id}`}
                      >
                        <Eye size={16} className="text-[#5FA8D3]" />
                      </button>
                      <button 
                        className={`p-2 rounded-lg hover:bg-[#5FA8D3]/10 transition-colors`}
                        title="Edit Company"
                        onClick={() => handleEditClick(company)}
                      >
                        <Edit2 size={16} className="text-purple-500" />
                      </button>
                      <button 
                        className={`p-2 rounded-lg hover:bg-[#5FA8D3]/10 transition-colors`}
                        title={company.status === 'active' ? 'Deactivate' : 'Activate'}
                        onClick={() => handleDeactivateClick(company)}
                      >
                        <Power size={16} className={company.status === 'active' ? 'text-orange-500' : 'text-green-500'} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCompanies.length === 0 && (
          <div className="p-8 text-center">
            <Building2 size={48} className={`mx-auto mb-4 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`} />
            <p className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}>
              No companies found
            </p>
          </div>
        )}
      </div>

      {/* Edit Company Modal */}
      {showEditModal && editingCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-lg rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-xl`}>
            <div className="p-6 border-b border-[#D9DEE5] dark:border-[#1F2630]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Edit2 size={20} className="text-[#5FA8D3]" />
                  <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                    Edit Company
                  </h3>
                </div>
                <button onClick={() => setShowEditModal(false)}>
                  <X size={20} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Company Name */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  <Building2 size={14} className="inline mr-2" />
                  Company Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} border-none outline-none`}
                />
              </div>

              {/* Business Type */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  <Briefcase size={14} className="inline mr-2" />
                  Business Type
                </label>
                <input
                  type="text"
                  value={editForm.business_type}
                  onChange={(e) => setEditForm({ ...editForm, business_type: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} border-none outline-none`}
                />
              </div>

              {/* Email */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  <Mail size={14} className="inline mr-2" />
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} border-none outline-none`}
                />
              </div>

              {/* Phone */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  <Phone size={14} className="inline mr-2" />
                  Phone
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} border-none outline-none`}
                />
              </div>

              {/* Address */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  <MapPin size={14} className="inline mr-2" />
                  Address
                </label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} border-none outline-none`}
                />
              </div>

              {/* Plan */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  <Shield size={14} className="inline mr-2" />
                  Subscription Plan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {plans.map((plan) => (
                    <button
                      key={plan}
                      onClick={() => setEditForm({ ...editForm, plan })}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        editForm.plan === plan
                          ? 'bg-[#5FA8D3] text-white'
                          : theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB] hover:bg-[#1F2630]/80' : 'bg-[#F6F7F9] text-[#0E1116] hover:bg-[#ECEFF3]'
                      }`}
                    >
                      {plan === 'pro' && <Crown size={12} className="inline mr-1" />}
                      {plan.charAt(0).toUpperCase() + plan.slice(1)}
                    </button>
                  ))}
                </div>
                {editForm.plan !== editingCompany.plan && (
                  <p className={`mt-2 text-xs ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>
                    Plan will be changed from {editingCompany.plan} to {editForm.plan}
                  </p>
                )}
              </div>

              {/* Enabled Features */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  <Package size={14} className="inline mr-2" />
                  Enabled Features
                </label>
                <div className="space-y-2">
                  {availableFeatures.map((feature) => {
                    const IconComponent = feature.icon;
                    const isEnabled = (editForm.enabled_features || []).includes(feature.id);
                    return (
                      <div
                        key={feature.id}
                        onClick={() => handleFeatureToggle(feature.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                          isEnabled
                            ? 'bg-[#5FA8D3]/20 border border-[#5FA8D3]/40'
                            : theme === 'dark' ? 'bg-[#1F2630] hover:bg-[#1F2630]/80' : 'bg-[#F6F7F9] hover:bg-[#ECEFF3]'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isEnabled ? 'bg-[#5FA8D3]' : theme === 'dark' ? 'bg-[#2A313C]' : 'bg-[#D9DEE5]'
                        }`}>
                          <IconComponent size={16} className={isEnabled ? 'text-white' : theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                        </div>
                        <div className="flex-1">
                          <div className={`text-sm font-medium ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                            {feature.name}
                          </div>
                          <div className={`text-xs ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                            {feature.description}
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isEnabled ? 'bg-[#5FA8D3] border-[#5FA8D3]' : theme === 'dark' ? 'border-[#7D8590]' : 'border-[#6B7280]'
                        }`}>
                          {isEnabled && <CheckCircle size={12} className="text-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#D9DEE5] dark:border-[#1F2630] flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className={`px-4 py-2 rounded-xl ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5FA8D3] hover:bg-[#4A95C0] text-white transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {showDeactivateModal && deactivatingCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-xl`}>
            <div className="p-6">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                deactivatingCompany.status === 'active' 
                  ? 'bg-orange-100 dark:bg-orange-900/30' 
                  : 'bg-green-100 dark:bg-green-900/30'
              }`}>
                <Power size={32} className={deactivatingCompany.status === 'active' ? 'text-orange-500' : 'text-green-500'} />
              </div>
              
              <h3 className={`text-xl font-bold text-center mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                {deactivatingCompany.status === 'active' ? 'Deactivate Company?' : 'Reactivate Company?'}
              </h3>
              
              <p className={`text-center mb-4 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                <strong>{deactivatingCompany.name}</strong>
              </p>

              {deactivatingCompany.status === 'active' ? (
                <div className={`p-4 rounded-xl mb-4 ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
                    <div className={`text-sm ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                      <p className="font-medium mb-2">This will:</p>
                      <ul className="space-y-1 list-disc list-inside text-sm">
                        <li>Block all users from accessing the platform</li>
                        <li>Retain all data for <strong>60 days</strong></li>
                        <li>Schedule automatic deletion after 60 days</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`p-4 rounded-xl mb-4 ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
                  <div className="flex items-start gap-3">
                    <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                    <div className={`text-sm ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                      <p className="font-medium mb-2">This will:</p>
                      <ul className="space-y-1 list-disc list-inside text-sm">
                        <li>Restore access for all users</li>
                        <li>Cancel scheduled data deletion</li>
                        <li>Reactivate all company features</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeactivateModal(false)}
                  className={`flex-1 px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeactivate}
                  disabled={saving}
                  className={`flex-1 px-4 py-3 rounded-xl text-white transition-colors disabled:opacity-50 ${
                    deactivatingCompany.status === 'active'
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {saving ? 'Processing...' : deactivatingCompany.status === 'active' ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-xl`}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-[#5FA8D3]/20' : 'bg-[#5FA8D3]/10'}`}>
                    <Building2 size={24} className="text-[#5FA8D3]" />
                  </div>
                  <div>
                    <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                      Add New Company
                    </h3>
                    <p className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                      Create a new company with an admin user
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowAddModal(false)}>
                  <X size={24} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                </button>
              </div>

              {/* Company Details Section */}
              <div className={`p-4 rounded-xl mb-4 ${theme === 'dark' ? 'bg-[#1F2630]/50' : 'bg-[#F6F7F9]'}`}>
                <h4 className={`text-sm font-semibold mb-4 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  Company Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      placeholder="e.g., Elegant Spa"
                      className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#0B0D10] text-[#E6E8EB] placeholder-[#7D8590]' : 'bg-white text-[#0E1116] placeholder-[#6B7280]'} border border-[#D9DEE5] dark:border-[#1F2630] outline-none focus:border-[#5FA8D3]`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                      Business Type *
                    </label>
                    <input
                      type="text"
                      value={addForm.business_type}
                      onChange={(e) => setAddForm({ ...addForm, business_type: e.target.value })}
                      placeholder="e.g., Salon, Clinic, Gym"
                      className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#0B0D10] text-[#E6E8EB] placeholder-[#7D8590]' : 'bg-white text-[#0E1116] placeholder-[#6B7280]'} border border-[#D9DEE5] dark:border-[#1F2630] outline-none focus:border-[#5FA8D3]`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                      Company Email *
                    </label>
                    <input
                      type="email"
                      value={addForm.email}
                      onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                      placeholder="company@example.com"
                      className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#0B0D10] text-[#E6E8EB] placeholder-[#7D8590]' : 'bg-white text-[#0E1116] placeholder-[#6B7280]'} border border-[#D9DEE5] dark:border-[#1F2630] outline-none focus:border-[#5FA8D3]`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={addForm.phone}
                      onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                      placeholder="+1 234 567 8900"
                      className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#0B0D10] text-[#E6E8EB] placeholder-[#7D8590]' : 'bg-white text-[#0E1116] placeholder-[#6B7280]'} border border-[#D9DEE5] dark:border-[#1F2630] outline-none focus:border-[#5FA8D3]`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                      Address
                    </label>
                    <input
                      type="text"
                      value={addForm.address}
                      onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                      placeholder="123 Business Street, City"
                      className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#0B0D10] text-[#E6E8EB] placeholder-[#7D8590]' : 'bg-white text-[#0E1116] placeholder-[#6B7280]'} border border-[#D9DEE5] dark:border-[#1F2630] outline-none focus:border-[#5FA8D3]`}
                    />
                  </div>
                </div>
              </div>

              {/* Subscription Plan Section */}
              <div className={`p-4 rounded-xl mb-4 ${theme === 'dark' ? 'bg-[#1F2630]/50' : 'bg-[#F6F7F9]'}`}>
                <h4 className={`text-sm font-semibold mb-4 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  Subscription Plan
                </h4>
                <div className="grid grid-cols-5 gap-2">
                  {plans.map((plan) => (
                    <button
                      key={plan}
                      onClick={() => setAddForm({ ...addForm, plan })}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        addForm.plan === plan
                          ? 'bg-[#5FA8D3] text-white'
                          : theme === 'dark' ? 'bg-[#0B0D10] text-[#E6E8EB] hover:bg-[#1F2630]' : 'bg-white text-[#0E1116] hover:bg-[#ECEFF3]'
                      }`}
                    >
                      {plan.charAt(0).toUpperCase() + plan.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Admin User Section */}
              <div className={`p-4 rounded-xl mb-6 ${theme === 'dark' ? 'bg-[#1F2630]/50' : 'bg-[#F6F7F9]'}`}>
                <h4 className={`text-sm font-semibold mb-4 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  Admin User (Company Owner)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                      Admin Name *
                    </label>
                    <input
                      type="text"
                      value={addForm.admin_name}
                      onChange={(e) => setAddForm({ ...addForm, admin_name: e.target.value })}
                      placeholder="John Smith"
                      className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#0B0D10] text-[#E6E8EB] placeholder-[#7D8590]' : 'bg-white text-[#0E1116] placeholder-[#6B7280]'} border border-[#D9DEE5] dark:border-[#1F2630] outline-none focus:border-[#5FA8D3]`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                      Admin Email *
                    </label>
                    <input
                      type="email"
                      value={addForm.admin_email}
                      onChange={(e) => setAddForm({ ...addForm, admin_email: e.target.value })}
                      placeholder="admin@example.com"
                      className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#0B0D10] text-[#E6E8EB] placeholder-[#7D8590]' : 'bg-white text-[#0E1116] placeholder-[#6B7280]'} border border-[#D9DEE5] dark:border-[#1F2630] outline-none focus:border-[#5FA8D3]`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                      Admin Password *
                    </label>
                    <input
                      type="password"
                      value={addForm.admin_password}
                      onChange={(e) => setAddForm({ ...addForm, admin_password: e.target.value })}
                      placeholder="Minimum 6 characters"
                      className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-[#0B0D10] text-[#E6E8EB] placeholder-[#7D8590]' : 'bg-white text-[#0E1116] placeholder-[#6B7280]'} border border-[#D9DEE5] dark:border-[#1F2630] outline-none focus:border-[#5FA8D3]`}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className={`flex-1 px-4 py-3 rounded-xl font-medium ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB] hover:bg-[#2A313C]' : 'bg-[#F6F7F9] text-[#0E1116] hover:bg-[#ECEFF3]'} transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCompany}
                  disabled={saving || !addForm.name || !addForm.business_type || !addForm.email || !addForm.admin_name || !addForm.admin_email || !addForm.admin_password}
                  className="flex-1 px-4 py-3 rounded-xl font-medium bg-[#5FA8D3] text-white hover:bg-[#4A95C0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Creating...' : 'Create Company'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminCompanies;
