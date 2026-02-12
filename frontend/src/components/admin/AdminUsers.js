import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { UserPlus, Pencil, Trash2, Search, Shield, Users, User, Store } from 'lucide-react';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'User',
    outlets: [],
    status: 'Active'
  });

  const roles = [
    { 
      id: 'Admin', 
      name: 'Admin', 
      icon: Shield,
      color: 'from-purple-500 to-indigo-500',
      description: 'Global account access - can manage all settings, users, outlets, and data'
    },
    { 
      id: 'Manager', 
      name: 'Manager', 
      icon: Users,
      color: 'from-[#5FA8D3] to-[#4A95C0]',
      description: 'Outlet level access - can manage bookings and operations for assigned outlets'
    },
    { 
      id: 'User', 
      name: 'User', 
      icon: User,
      color: 'from-green-500 to-emerald-500',
      description: 'Limited access - can only view and manage bookings/orders assigned to them'
    }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, query]);

  const fetchData = async () => {
    try {
      const [usersRes, outletsRes] = await Promise.all([
        api.getUsers(),
        api.getOutlets()
      ]);
      setUsers(usersRes.data);
      setOutlets(outletsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (query) {
      setFilteredUsers(
        users.filter(
          (u) =>
            u.name?.toLowerCase().includes(query.toLowerCase()) ||
            u.email?.toLowerCase().includes(query.toLowerCase()) ||
            u.role?.toLowerCase().includes(query.toLowerCase())
        )
      );
    } else {
      setFilteredUsers(users);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, formData);
      } else {
        await api.createUser(formData);
      }
      await fetchData();
      resetForm();
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: 'User',
      outlets: [],
      status: 'Active'
    });
    setEditingUser(null);
    setShowAddModal(false);
  };

  const startEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      phone: user.phone || '',
      role: user.role || 'User',
      outlets: user.outlets || [],
      status: user.status || 'Active'
    });
    setShowAddModal(true);
  };

  const toggleOutlet = (outletId) => {
    const current = formData.outlets || [];
    if (current.includes(outletId)) {
      setFormData({ ...formData, outlets: current.filter(id => id !== outletId) });
    } else {
      setFormData({ ...formData, outlets: [...current, outletId] });
    }
  };

  const getRoleColor = (role) => {
    const r = roles.find(x => x.id === role);
    return r?.color || 'from-gray-500 to-gray-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#6B7280] dark:text-[#7D8590]">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Legend */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] p-4">
        <h3 className="text-sm font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase tracking-wider mb-3">
          User Roles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roles.map(role => {
            const Icon = role.icon;
            return (
              <div key={role.id} className="flex items-start gap-3 p-3 rounded-xl bg-[#F6F7F9] dark:bg-[#12161C]">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={20} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{role.name}</div>
                  <div className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-1">{role.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">User Management</h2>
          <p className="text-sm text-[#6B7280] dark:text-[#7D8590]">{filteredUsers.length} users</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users..."
              className="pl-10 pr-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-[#0E1116] dark:text-[#E6E8EB] placeholder:text-[#6B7280] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all w-64"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            data-testid="admin-add-user-btn"
            className="px-4 py-2 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg bg-[#5FA8D3] hover:bg-[#4A95C0]"
          >
            <UserPlus size={18} />
            Add User
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#F6F7F9] dark:bg-white/5 border-b border-[#D9DEE5] dark:border-[#1F2630]">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase">User</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase">Email</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase">Role</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase">Assigned Outlets</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase">Status</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D9DEE5] dark:divide-[#1F2630]">
            {filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-[#5FA8D3]/10 dark:hover:bg-[#5FA8D3]/15 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getRoleColor(u.role)} flex items-center justify-center font-bold text-white`}>
                      {u.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{u.name}</div>
                      <div className="text-xs text-[#6B7280] dark:text-[#7D8590]">{u.phone || 'No phone'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-[#4B5563] dark:text-[#A9AFB8]">{u.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${getRoleColor(u.role)}`}>
                    {u.role || 'User'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {u.role === 'Admin' ? (
                    <span className="text-xs text-[#6B7280] dark:text-[#7D8590]">All outlets</span>
                  ) : (u.outlets?.length || 0) > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {u.outlets.slice(0, 2).map(outletId => {
                        const outlet = outlets.find(o => o.id === outletId);
                        return outlet ? (
                          <span key={outletId} className="px-2 py-1 text-xs rounded-lg bg-[#ECEFF3] dark:bg-[#1F2630] text-[#4B5563] dark:text-[#A9AFB8]">
                            {outlet.name?.slice(0, 15)}
                          </span>
                        ) : null;
                      })}
                      {(u.outlets?.length || 0) > 2 && (
                        <span className="px-2 py-1 text-xs rounded-lg bg-[#ECEFF3] dark:bg-[#1F2630] text-[#4B5563] dark:text-[#A9AFB8]">
                          +{u.outlets.length - 2} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-[#6B7280] dark:text-[#7D8590]">None assigned</span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    u.status === 'Active'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-[#ECEFF3] dark:bg-[#1F2630] text-[#6B7280] dark:text-[#7D8590]'
                  }`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={() => startEdit(u)}
                      className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg transition-all"
                    >
                      <Pencil size={16} className="text-[#6B7280] dark:text-[#7D8590]" />
                    </button>
                    <button className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#171C22] rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto border border-[#D9DEE5] dark:border-[#1F2630]">
            <h3 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-4">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
                  required
                />
              </div>
              
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
                    required={!editingUser}
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">Role *</label>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map(role => {
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: role.id })}
                        className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                          formData.role === role.id
                            ? 'border-[#5FA8D3] bg-[#5FA8D3]/10'
                            : 'border-[#D9DEE5] dark:border-[#1F2630] hover:border-[#5FA8D3]/50'
                        }`}
                      >
                        <Icon size={20} className={formData.role === role.id ? 'text-[#5FA8D3]' : 'text-[#6B7280]'} />
                        <span className={`text-sm font-medium ${formData.role === role.id ? 'text-[#5FA8D3]' : 'text-[#4B5563] dark:text-[#A9AFB8]'}`}>
                          {role.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {formData.role !== 'Admin' && outlets.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
                    <Store size={16} className="inline mr-1" />
                    Assign Outlets {formData.role === 'Manager' && '(Required for Managers)'}
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl p-2 space-y-1">
                    {outlets.map(outlet => (
                      <label
                        key={outlet.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={(formData.outlets || []).includes(outlet.id)}
                          onChange={() => toggleOutlet(outlet.id)}
                          className="w-4 h-4 text-[#5FA8D3] border-[#D9DEE5] rounded focus:ring-[#5FA8D3]"
                        />
                        <span className="text-sm text-[#0E1116] dark:text-[#E6E8EB]">{outlet.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#4B5563] dark:text-[#A9AFB8] hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-white shadow-lg bg-[#5FA8D3] hover:bg-[#4A95C0] transition-all"
                >
                  {editingUser ? 'Save Changes' : 'Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
