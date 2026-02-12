import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { UserPlus } from 'lucide-react';
import AddUserModal from '../components/AddUserModal';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, query]);

  const fetchUsers = async () => {
    try {
      const response = await api.getUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (query) {
      setFilteredUsers(
        users.filter(
          (u) =>
            u.name.toLowerCase().includes(query.toLowerCase()) ||
            u.email.toLowerCase().includes(query.toLowerCase())
        )
      );
    } else {
      setFilteredUsers(users);
    }
  };

  const handleAddUser = async (userData) => {
    await api.createUser(userData);
    await fetchUsers();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-[#4B5563] dark:text-[#7D8590]">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Users</h2>
            <p className="text-sm text-[#4B5563] dark:text-[#7D8590] mt-1">
              {filteredUsers.length} users found
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              data-testid="add-user-btn"
              className="px-4 py-2 rounded-xl font-semibold text-[#222] transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
            >
              <UserPlus size={20} />
              Add User
            </button>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="px-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-[#0E1116] dark:text-[#E6E8EB] placeholder:text-[#6B7280] dark:placeholder:text-white/40 focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all backdrop-blur-sm"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl border border-[#D9DEE5] dark:border-[#1F2630] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F6F7F9] dark:bg-white/5 border-b border-[#D9DEE5] dark:border-[#1F2630]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-[#5FA8D3]/10 dark:hover:bg-[#5FA8D3]/15 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5FA8D3] to-[#ffdb33] flex items-center justify-center font-bold text-[#222] shadow-md">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{u.name}</div>
                        <div className="text-xs text-[#6B7280] dark:text-[#E6E8EB]/50">{u.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[#4B5563] dark:text-[#E6E8EB]/70">{u.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[#4B5563] dark:text-[#E6E8EB]/70">{u.phone || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        u.status === 'Active'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-[#ECEFF3] dark:bg-[#171C22] text-[#4B5563] dark:text-[#7D8590]'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button className="px-4 py-2 rounded-lg text-sm font-medium text-[#4B5563] dark:text-[#E6E8EB] hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] transition-all">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddUser}
      />
    </div>
  );
};

export default Users;
