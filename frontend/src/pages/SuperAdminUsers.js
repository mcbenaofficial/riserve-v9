import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Search, Filter, Building2, Mail, Shield
} from 'lucide-react';
import { api } from '../services/api';

const SuperAdminUsers = ({ theme }) => {
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    company_id: '',
    role: ''
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [usersRes, companiesRes] = await Promise.all([
        api.getAllUsers(),
        api.getCompanies()
      ]);
      setUsers(usersRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredUsers = users.filter(user => {
    const matchesSearch = !filters.search || 
      user.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      user.email.toLowerCase().includes(filters.search.toLowerCase());
    const matchesCompany = !filters.company_id || user.company_id === filters.company_id;
    const matchesRole = !filters.role || user.role === filters.role;
    return matchesSearch && matchesCompany && matchesRole;
  });

  const getRoleColor = (role) => {
    const colors = {
      Admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      Manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      User: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    };
    return colors[role] || colors.User;
  };

  const totalUsers = users.length;

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
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600">
            <Users size={24} className="text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
              All Users
            </h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
              View users across all companies
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-sm`}>
          <div className={`text-3xl font-bold mb-1 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            {totalUsers}
          </div>
          <div className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
            Total Users
          </div>
        </div>
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-sm`}>
          <div className={`text-3xl font-bold mb-1 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            {users.filter(u => u.role === 'Admin').length}
          </div>
          <div className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
            Admins
          </div>
        </div>
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-sm`}>
          <div className={`text-3xl font-bold mb-1 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            {users.filter(u => u.role === 'Manager').length}
          </div>
          <div className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
            Managers
          </div>
        </div>
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-sm`}>
          <div className={`text-3xl font-bold mb-1 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            {users.filter(u => u.role === 'User').length}
          </div>
          <div className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
            Staff Users
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className={`rounded-2xl ${theme === 'dark' ? 'bg-[#171C22]' : 'bg-white'} shadow-sm overflow-hidden`}>
        {/* Filters */}
        <div className="p-6 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
              <span className={`text-sm font-medium ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                Filter Users
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
                <Search size={16} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className={`bg-transparent border-none outline-none text-sm w-48 ${theme === 'dark' ? 'text-[#E6E8EB] placeholder-[#7D8590]' : 'text-[#0E1116] placeholder-[#6B7280]'}`}
                />
              </div>
              <select
                value={filters.company_id}
                onChange={(e) => setFilters(prev => ({ ...prev, company_id: e.target.value }))}
                className={`px-3 py-2 rounded-xl text-sm ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} border-none outline-none`}
              >
                <option value="">All Companies</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
              <select
                value={filters.role}
                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                className={`px-3 py-2 rounded-xl text-sm ${theme === 'dark' ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#0E1116]'} border-none outline-none`}
              >
                <option value="">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="User">User</option>
              </select>
              <button
                onClick={() => setFilters({ search: '', company_id: '', role: '' })}
                className={`px-3 py-2 rounded-xl text-sm ${theme === 'dark' ? 'bg-[#1F2630] text-[#7D8590] hover:text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#6B7280] hover:text-[#0E1116]'} transition-colors`}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  User
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Company
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Role
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Status
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9DEE5] dark:divide-[#1F2630]">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-[#5FA8D3]/10 dark:hover:bg-[#5FA8D3]/15 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'}`}>
                        <Users size={18} className="text-purple-500" />
                      </div>
                      <div>
                        <div className={`font-medium ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                          {user.name}
                        </div>
                        <div className={`flex items-center gap-1 text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                          <Mail size={12} />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-[#5FA8D3]" />
                      <span className={`text-sm ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                        {user.company_name || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                      <Shield size={12} />
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
                      user.status === 'Active' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="p-8 text-center">
            <Users size={48} className={`mx-auto mb-4 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`} />
            <p className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}>
              No users found
            </p>
          </div>
        )}

        {/* Results count */}
        {filteredUsers.length > 0 && (
          <div className={`px-6 py-3 border-t ${theme === 'dark' ? 'border-[#1F2630]' : 'border-[#D9DEE5]'}`}>
            <span className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
              Showing {filteredUsers.length} of {totalUsers} users
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminUsers;
