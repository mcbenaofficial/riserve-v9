import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, Users, Calendar, TrendingUp, Activity, 
  Shield, Eye, MoreVertical, Search, Plus, ChevronRight,
  Clock, AlertCircle, CheckCircle, XCircle, Crown
} from 'lucide-react';
import { api } from '../services/api';

const SuperAdminDashboard = ({ theme }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashboardRes, companiesRes] = await Promise.all([
        api.getSuperAdminDashboard(),
        api.getCompanies()
      ]);
      setDashboardData(dashboardRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      console.error('Error fetching super admin data:', error);
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
    if (status === 'suspended') return <XCircle size={14} className="text-red-500" />;
    return <AlertCircle size={14} className="text-yellow-500" />;
  };

  const StatCard = ({ icon: Icon, label, value, subValue, color }) => (
    <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-sm`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        {subValue && (
          <span className={`text-xs px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-[#1F2630] text-[#7D8590]' : 'bg-[#F6F7F9] text-[#6B7280]'}`}>
            {subValue}
          </span>
        )}
      </div>
      <div className={`text-3xl font-bold mb-1 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
        {value}
      </div>
      <div className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
        {label}
      </div>
    </div>
  );

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
            <Shield size={24} className="text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
              Super Admin Dashboard
            </h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
              Platform overview and company management
            </p>
          </div>
        </div>
        <button 
          className="flex items-center gap-2 px-4 py-2 bg-[#5FA8D3] hover:bg-[#4A95C0] text-white rounded-xl transition-colors"
          onClick={() => window.location.href = '/super-admin/companies/new'}
        >
          <Plus size={18} />
          Add Company
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Building2} 
          label="Total Companies" 
          value={dashboardData?.companies?.total || 0}
          subValue={`${dashboardData?.companies?.active || 0} active`}
          color="bg-[#5FA8D3]"
        />
        <StatCard 
          icon={Users} 
          label="Total Users" 
          value={dashboardData?.users?.total || 0}
          color="bg-purple-500"
        />
        <StatCard 
          icon={Calendar} 
          label="Total Bookings" 
          value={dashboardData?.bookings?.total || 0}
          color="bg-emerald-500"
        />
        <StatCard 
          icon={TrendingUp} 
          label="Trial Companies" 
          value={dashboardData?.companies?.trial || 0}
          subValue="Last 30 days"
          color="bg-amber-500"
        />
      </div>

      {/* Plan Distribution */}
      <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-sm`}>
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
          Plan Distribution
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(dashboardData?.plan_distribution || {}).map(([plan, count]) => (
            <div 
              key={plan}
              className={`p-4 rounded-xl text-center ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}
            >
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-2 ${getPlanColor(plan)}`}>
                {plan.charAt(0).toUpperCase() + plan.slice(1)}
              </span>
              <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                {count}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Companies Table */}
      <div className={`rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-sm overflow-hidden`}>
        <div className="p-6 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
              Companies
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
                <Search size={16} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                <input
                  type="text"
                  placeholder="Search companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`bg-transparent border-none outline-none text-sm w-40 ${theme === 'dark' ? 'text-[#E6E8EB] placeholder-[#7D8590]' : 'text-[#0E1116] placeholder-[#6B7280]'}`}
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
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getPlanColor(company.plan)}`}>
                      {company.plan === 'pro' && <Crown size={12} />}
                      {company.plan.charAt(0).toUpperCase() + company.plan.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(company.status)}
                      <span className={`text-sm capitalize ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                        {company.status}
                      </span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                    {company.user_count || 0}
                  </td>
                  <td className={`px-6 py-4 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                    {company.booking_count || 0}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        className={`p-2 rounded-lg hover:bg-[#5FA8D3]/10 transition-colors`}
                        title="View Details"
                        onClick={() => window.location.href = `/super-admin/companies/${company.id}`}
                      >
                        <Eye size={16} className="text-[#5FA8D3]" />
                      </button>
                      <button 
                        className={`p-2 rounded-lg hover:bg-[#5FA8D3]/10 transition-colors`}
                        title="More Actions"
                      >
                        <MoreVertical size={16} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
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

      {/* Recent Activity */}
      {dashboardData?.recent_activity?.length > 0 && (
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-sm`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
              Recent Activity
            </h3>
            <button className="flex items-center gap-1 text-sm text-[#5FA8D3] hover:underline">
              View All <ChevronRight size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {dashboardData.recent_activity.map((log, index) => (
              <div 
                key={index}
                className={`flex items-center gap-4 p-3 rounded-xl ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}
              >
                <Activity size={16} className="text-[#5FA8D3]" />
                <div className="flex-1">
                  <span className={theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}>
                    {log.action} - {log.entity_type}
                  </span>
                  <span className={`ml-2 text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                    by {log.user_email}
                  </span>
                </div>
                <span className={`text-xs ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
