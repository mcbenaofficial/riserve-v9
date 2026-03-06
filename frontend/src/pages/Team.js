import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import {
    Users, UserPlus, Briefcase, Shield, Mail, Phone, Building2,
    CheckCircle2, XCircle, Eye, Edit2, Trash2, Plus, Search,
    ChevronDown, AlertCircle, UserCheck, RefreshCw, Lock
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────
const ROLE_COLORS = {
    Admin: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    Manager: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    User: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400',
    SuperAdmin: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

const ROLE_ICONS = {
    Admin: Shield,
    Manager: Briefcase,
    User: Users,
    SuperAdmin: Shield,
};

const avatar = (name, id) => {
    const colors = ['from-violet-500 to-indigo-500', 'from-cyan-500 to-blue-500', 'from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-pink-500 to-rose-500'];
    const i = id ? id.charCodeAt(0) % colors.length : 0;
    return colors[i];
};

// ─── Add/Edit User Modal ─────────────────────────────────────────────────────
const UserModal = ({ isOpen, user, outlets, onClose, onSave }) => {
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'User', phone: '', outlets: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) {
            setForm({ name: user.name || '', email: user.email || '', password: '', role: user.role || 'User', phone: user.phone || '', outlets: user.outlets || [] });
        } else {
            setForm({ name: '', email: '', password: '', role: 'User', phone: '', outlets: [] });
        }
        setError('');
    }, [user, isOpen]);

    const handleOutletToggle = (id) => {
        setForm(f => ({ ...f, outlets: f.outlets.includes(id) ? f.outlets.filter(o => o !== id) : [...f.outlets, id] }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const payload = { name: form.name, email: form.email, role: form.role, phone: form.phone, outlets: form.outlets };
            if (!user) payload.password = form.password;
            await onSave(payload, user?.id);
            onClose();
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save user');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-[#0E1116] rounded-2xl shadow-2xl border border-[#D9DEE5] dark:border-[#1F2630] w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-[#D9DEE5] dark:border-[#1F2630]">
                    <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">
                        {user ? 'Edit User' : 'Add Team Member'}
                    </h3>
                    <p className="text-sm text-[#6B7280] dark:text-white/40 mt-0.5">
                        {user ? 'Update user details' : 'Creates login access + staff profile automatically'}
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 text-sm text-red-700 dark:text-red-400">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] mb-1.5">Full Name *</label>
                            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-[#F6F7F9] dark:bg-white/5 border border-[#D9DEE5] dark:border-[#1F2630] text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent" placeholder="Jane Smith" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] mb-1.5">Email Address *</label>
                            <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                disabled={!!user} className="w-full px-3 py-2.5 rounded-xl bg-[#F6F7F9] dark:bg-white/5 border border-[#D9DEE5] dark:border-[#1F2630] text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:ring-2 focus:ring-[#5FA8D3] disabled:opacity-50" placeholder="jane@company.com" />
                        </div>
                        {!user && (
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] mb-1.5">Password *</label>
                                <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    className="w-full px-3 py-2.5 rounded-xl bg-[#F6F7F9] dark:bg-white/5 border border-[#D9DEE5] dark:border-[#1F2630] text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:ring-2 focus:ring-[#5FA8D3]" placeholder="••••••••" />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] mb-1.5">Role *</label>
                            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-[#F6F7F9] dark:bg-white/5 border border-[#D9DEE5] dark:border-[#1F2630] text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:ring-2 focus:ring-[#5FA8D3]">
                                <option value="Admin">Admin</option>
                                <option value="Manager">Manager</option>
                                <option value="User">User (Staff)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] mb-1.5">Phone</label>
                            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                className="w-full px-3 py-2.5 rounded-xl bg-[#F6F7F9] dark:bg-white/5 border border-[#D9DEE5] dark:border-[#1F2630] text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:ring-2 focus:ring-[#5FA8D3]" placeholder="+91 98765..." />
                        </div>
                    </div>

                    {outlets.length > 0 && (
                        <div>
                            <label className="block text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] mb-2">Outlet Access</label>
                            <div className="space-y-2">
                                {outlets.map(o => (
                                    <label key={o.id} className="flex items-center gap-2.5 cursor-pointer group">
                                        <input type="checkbox" checked={form.outlets.includes(o.id)} onChange={() => handleOutletToggle(o.id)}
                                            className="rounded border-[#D9DEE5] dark:border-[#1F2630] text-[#5FA8D3] focus:ring-[#5FA8D3]" />
                                        <span className="text-sm text-[#0E1116] dark:text-[#E6E8EB] group-hover:text-[#5FA8D3] transition-colors">{o.name}</span>
                                        <span className="text-xs text-[#6B7280] dark:text-white/40">{o.type}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] text-sm font-semibold text-[#4B5563] dark:text-[#7D8590] hover:bg-[#F6F7F9] dark:hover:bg-white/5 transition-all">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0] text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50">
                            {loading ? 'Saving...' : (user ? 'Save Changes' : 'Add Member')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Staff Detail Modal ──────────────────────────────────────────────────────
const StaffDetailModal = ({ isOpen, member, onClose }) => {
    if (!isOpen || !member) return null;
    const ua = member.user_account;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-[#0E1116] rounded-2xl shadow-2xl border border-[#D9DEE5] dark:border-[#1F2630] w-full max-w-md mx-4">
                <div className="p-6">
                    <div className="flex items-center gap-4 mb-5">
                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatar(member.full_name, member.id)} flex items-center justify-center text-2xl font-bold text-white`}>
                            {(member.first_name || '?').charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">{member.full_name}</h3>
                            <p className="text-sm text-[#6B7280] dark:text-white/40">{member.designation || 'No designation'}</p>
                            <p className="text-xs font-mono text-[#5FA8D3] mt-0.5">{member.employee_id}</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-[#F6F7F9] dark:bg-white/5 border border-[#D9DEE5] dark:border-[#1F2630]">
                            <p className="text-xs font-semibold text-[#6B7280] dark:text-white/40 mb-2">STAFF PROFILE</p>
                            <div className="space-y-1.5 text-sm text-[#0E1116] dark:text-[#E6E8EB]">
                                <div className="flex justify-between"><span className="text-[#6B7280] dark:text-white/40">Department</span><span>{member.department || '—'}</span></div>
                                <div className="flex justify-between"><span className="text-[#6B7280] dark:text-white/40">Employment</span><span className="capitalize">{(member.employment_type || '').replace('_', ' ')}</span></div>
                                <div className="flex justify-between"><span className="text-[#6B7280] dark:text-white/40">Email</span><span>{member.email}</span></div>
                                <div className="flex justify-between"><span className="text-[#6B7280] dark:text-white/40">Phone</span><span>{member.phone || '—'}</span></div>
                            </div>
                        </div>
                        <div className={`p-3 rounded-xl border ${ua ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-700/30' : 'bg-[#F6F7F9] dark:bg-white/5 border-[#D9DEE5] dark:border-[#1F2630]'}`}>
                            <p className="text-xs font-semibold text-[#6B7280] dark:text-white/40 mb-2">USER ACCOUNT</p>
                            {ua ? (
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between"><span className="text-[#6B7280] dark:text-white/40">Login Email</span><span className="text-[#0E1116] dark:text-[#E6E8EB]">{ua.email}</span></div>
                                    <div className="flex justify-between"><span className="text-[#6B7280] dark:text-white/40">Role</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[ua.role] || ''}`}>{ua.role}</span>
                                    </div>
                                    <div className="flex justify-between"><span className="text-[#6B7280] dark:text-white/40">Status</span>
                                        <span className={ua.status === 'Active' ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-[#6B7280]'}>{ua.status}</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-[#6B7280] dark:text-white/40">No user account linked — this staff member cannot log in.</p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="w-full mt-4 px-4 py-2.5 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] text-sm font-semibold text-[#4B5563] dark:text-[#7D8590] hover:bg-[#F6F7F9] dark:hover:bg-white/5 transition-all">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Team Page ──────────────────────────────────────────────────────────
const Team = () => {
    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [staff, setStaff] = useState([]);
    const [outlets, setOutlets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [userModalOpen, setUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [staffDetailOpen, setStaffDetailOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [notification, setNotification] = useState(null);

    const showNotification = (msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3500);
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [uRes, sRes, oRes] = await Promise.all([
                api.getUsers(),
                api.getStaff({ status: undefined }),
                api.getOutlets(),
            ]);
            setUsers(uRes.data);
            setStaff(sRes.data);
            setOutlets(oRes.data);
        } catch (e) {
            console.error('Failed to load team data', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSaveUser = async (data, userId) => {
        if (userId) {
            await api.updateUser(userId, data);
            showNotification('User updated successfully');
        } else {
            await api.createUser(data);
            showNotification('Team member added — staff profile auto-created');
        }
        await loadData();
    };

    const filteredUsers = users.filter(u => {
        const q = query.toLowerCase();
        const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
        const matchRole = roleFilter === 'all' || u.role === roleFilter;
        const matchStatus = statusFilter === 'all' || u.status === statusFilter;
        return matchQ && matchRole && matchStatus;
    });

    const filteredStaff = staff.filter(s => {
        const q = query.toLowerCase();
        return !q || (s.full_name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
    });

    const roleStats = {
        Admin: users.filter(u => u.role === 'Admin').length,
        Manager: users.filter(u => u.role === 'Manager').length,
        User: users.filter(u => u.role === 'User').length,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-[#5FA8D3] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-[#6B7280] dark:text-white/40">Loading team...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Notification Toast */}
            {notification && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border transition-all ${notification.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700/40 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700/40 text-red-700 dark:text-red-400'}`}>
                    <CheckCircle2 size={18} />
                    <span className="text-sm font-semibold">{notification.msg}</span>
                </div>
            )}

            {/* Header */}
            <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Team</h2>
                        <p className="text-sm text-[#4B5563] dark:text-[#7D8590] mt-1">
                            {users.length} users · {staff.length} staff profiles · Across {outlets.length} outlets
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={loadData} className="p-2.5 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] text-[#6B7280] dark:text-white/40 hover:bg-[#F6F7F9] dark:hover:bg-white/5 transition-all">
                            <RefreshCw size={18} />
                        </button>
                        <button
                            onClick={() => { setEditingUser(null); setUserModalOpen(true); }}
                            className="px-5 py-2.5 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg"
                            style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
                        >
                            <UserPlus size={18} /> Add Member
                        </button>
                    </div>
                </div>

                {/* Role Stats */}
                <div className="grid grid-cols-3 gap-3 mt-5">
                    {[
                        { label: 'Admins', count: roleStats.Admin, color: 'from-purple-500 to-indigo-600', icon: Shield },
                        { label: 'Managers', count: roleStats.Manager, color: 'from-blue-500 to-cyan-500', icon: Briefcase },
                        { label: 'Staff Users', count: roleStats.User, color: 'from-emerald-500 to-teal-600', icon: UserCheck },
                    ].map(({ label, count, color, icon: Icon }) => (
                        <div key={label} className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#F6F7F9] dark:bg-white/5 border border-[#D9DEE5] dark:border-[#1F2630]">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md flex-shrink-0`}>
                                <Icon size={18} className="text-white" />
                            </div>
                            <div>
                                <p className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">{count}</p>
                                <p className="text-xs text-[#6B7280] dark:text-white/40">{label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tab Switcher + Filters */}
            <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-4 border border-[#D9DEE5] dark:border-[#1F2630] flex flex-wrap items-center gap-3">
                <div className="flex rounded-xl overflow-hidden border border-[#D9DEE5] dark:border-[#1F2630]">
                    {[
                        { id: 'users', label: 'Users', icon: Users },
                        { id: 'staff', label: 'Staff Profiles', icon: Briefcase },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-[#5FA8D3] text-white' : 'text-[#6B7280] dark:text-white/40 hover:bg-[#F6F7F9] dark:hover:bg-white/5'}`}>
                            <tab.icon size={15} /> {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-0 ml-auto">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] dark:text-white/40" />
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or email..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F6F7F9] dark:bg-white/10 border border-[#D9DEE5] dark:border-[#1F2630] text-sm text-[#0E1116] dark:text-[#E6E8EB] placeholder:text-[#6B7280] dark:placeholder:text-white/30 focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all" />
                    </div>
                    {activeTab === 'users' && (
                        <>
                            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                                className="px-3 py-2 rounded-xl bg-[#F6F7F9] dark:bg-white/10 border border-[#D9DEE5] dark:border-[#1F2630] text-sm text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent">
                                <option value="all">All Roles</option>
                                <option value="Admin">Admin</option>
                                <option value="Manager">Manager</option>
                                <option value="User">User</option>
                            </select>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                                className="px-3 py-2 rounded-xl bg-[#F6F7F9] dark:bg-white/10 border border-[#D9DEE5] dark:border-[#1F2630] text-sm text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent">
                                <option value="all">All Status</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </>
                    )}
                </div>
            </div>

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl border border-[#D9DEE5] dark:border-[#1F2630] overflow-hidden">
                    {filteredUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-[#F6F7F9] dark:bg-white/5 flex items-center justify-center">
                                <Users size={24} className="text-[#6B7280] dark:text-white/30" />
                            </div>
                            <p className="text-[#6B7280] dark:text-white/40">No users found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-[#F6F7F9] dark:bg-white/5 border-b border-[#D9DEE5] dark:border-[#1F2630]">
                                    <tr>
                                        {['Team Member', 'Role', 'Status', 'Outlets', 'Staff Profile', 'Actions'].map(h => (
                                            <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] uppercase tracking-wider first:pl-6 last:text-center">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#D9DEE5] dark:divide-white/5">
                                    {filteredUsers.map(u => {
                                        const RoleIcon = ROLE_ICONS[u.role] || Users;
                                        return (
                                            <tr key={u.id} className="hover:bg-[#5FA8D3]/5 dark:hover:bg-[#5FA8D3]/10 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatar(u.name, u.id)} flex items-center justify-center font-bold text-white shadow-md flex-shrink-0`}>
                                                            {(u.name || '?').charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{u.name}</p>
                                                            <p className="text-xs text-[#6B7280] dark:text-white/40 flex items-center gap-1">
                                                                <Mail size={10} /> {u.email}
                                                            </p>
                                                            {u.phone && <p className="text-xs text-[#6B7280] dark:text-white/40 flex items-center gap-1"><Phone size={10} /> {u.phone}</p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] || ''}`}>
                                                        <RoleIcon size={11} /> {u.role}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${u.status === 'Active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-[#ECEFF3] dark:bg-[#1F2630] text-[#6B7280] dark:text-white/40'}`}>
                                                        {u.status === 'Active' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                                        {u.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(u.outlets || []).length === 0 ? (
                                                            <span className="text-xs text-[#6B7280] dark:text-white/30">No outlets</span>
                                                        ) : (u.outlets || []).slice(0, 2).map(oid => {
                                                            const o = outlets.find(x => x.id === oid);
                                                            return o ? (
                                                                <span key={oid} className="px-2 py-0.5 rounded-full text-xs bg-[#F6F7F9] dark:bg-white/10 border border-[#D9DEE5] dark:border-[#1F2630] text-[#4B5563] dark:text-[#E6E8EB]">
                                                                    {o.name}
                                                                </span>
                                                            ) : null;
                                                        })}
                                                        {(u.outlets || []).length > 2 && <span className="text-xs text-[#6B7280] dark:text-white/40">+{u.outlets.length - 2}</span>}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    {u.staff_profile ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
                                                            <CheckCircle2 size={13} /> Linked
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] dark:text-white/40">
                                                            <AlertCircle size={13} /> No profile
                                                        </span>
                                                    )}
                                                    {u.staff_profile && (
                                                        <p className="text-xs text-[#6B7280] dark:text-white/30 mt-0.5">{u.staff_profile.designation || u.staff_profile.department}</p>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { setEditingUser(u); setUserModalOpen(true); }}
                                                            className="p-2 rounded-lg hover:bg-[#5FA8D3]/10 text-[#5FA8D3] transition-all" title="Edit">
                                                            <Edit2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Staff Profiles Tab */}
            {activeTab === 'staff' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStaff.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 gap-3 bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl border border-[#D9DEE5] dark:border-[#1F2630]">
                            <div className="w-14 h-14 rounded-2xl bg-[#F6F7F9] dark:bg-white/5 flex items-center justify-center">
                                <Briefcase size={24} className="text-[#6B7280] dark:text-white/30" />
                            </div>
                            <p className="text-[#6B7280] dark:text-white/40">No staff profiles yet</p>
                            <p className="text-xs text-[#6B7280] dark:text-white/30 text-center max-w-xs">Staff profiles are automatically created when you add Manager or User team members</p>
                        </div>
                    ) : filteredStaff.map(s => {
                        const ua = s.user_account;
                        return (
                            <div key={s.id} className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] p-5 hover:border-[#5FA8D3]/40 transition-all hover:shadow-lg group">
                                <div className="flex items-start gap-3 mb-4">
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${avatar(s.full_name, s.id)} flex items-center justify-center text-lg font-bold text-white shadow-md flex-shrink-0`}>
                                        {(s.first_name || '?').charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] truncate">{s.full_name}</p>
                                        <p className="text-xs text-[#6B7280] dark:text-white/40 truncate">{s.designation || 'No designation'}</p>
                                        <p className="text-xs font-mono text-[#5FA8D3]/70 mt-0.5">{s.employee_id}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${s.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-[#ECEFF3] dark:bg-white/5 text-[#6B7280] dark:text-white/40'}`}>
                                        {s.status}
                                    </span>
                                </div>

                                <div className="space-y-2 text-xs">
                                    {s.department && (
                                        <div className="flex items-center gap-2 text-[#6B7280] dark:text-white/40">
                                            <Briefcase size={12} /> <span className="capitalize">{s.department}</span>
                                            {s.employment_type && <span className="ml-auto text-[#6B7280] dark:text-white/30 capitalize">{s.employment_type.replace('_', ' ')}</span>}
                                        </div>
                                    )}
                                    {s.email && (
                                        <div className="flex items-center gap-2 text-[#6B7280] dark:text-white/40">
                                            <Mail size={12} /> <span className="truncate">{s.email}</span>
                                        </div>
                                    )}
                                    {s.outlet_id && (() => {
                                        const o = outlets.find(x => x.id === s.outlet_id);
                                        return o ? (
                                            <div className="flex items-center gap-2 text-[#6B7280] dark:text-white/40">
                                                <Building2 size={12} /> {o.name}
                                            </div>
                                        ) : null;
                                    })()}
                                </div>

                                {/* User Account Status */}
                                <div className={`mt-4 px-3 py-2 rounded-xl border flex items-center gap-2 ${ua ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30' : 'bg-[#F6F7F9] dark:bg-white/5 border-[#D9DEE5] dark:border-[#1F2630]'}`}>
                                    {ua ? (
                                        <>
                                            <Lock size={12} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-green-700 dark:text-green-400">Has login access</p>
                                                <p className="text-xs text-[#6B7280] dark:text-white/40 truncate">{ua.email} · {ua.role}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <XCircle size={12} className="text-[#6B7280] dark:text-white/40 flex-shrink-0" />
                                            <p className="text-xs text-[#6B7280] dark:text-white/40">No login account</p>
                                        </>
                                    )}
                                </div>

                                <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { setSelectedStaff(s); setStaffDetailOpen(true); }}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] hover:bg-[#F6F7F9] dark:hover:bg-white/10 transition-all">
                                        <Eye size={13} /> View Details
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modals */}
            <UserModal
                isOpen={userModalOpen}
                user={editingUser}
                outlets={outlets}
                onClose={() => { setUserModalOpen(false); setEditingUser(null); }}
                onSave={handleSaveUser}
            />
            <StaffDetailModal
                isOpen={staffDetailOpen}
                member={selectedStaff}
                onClose={() => { setStaffDetailOpen(false); setSelectedStaff(null); }}
            />
        </div>
    );
};

export default Team;
