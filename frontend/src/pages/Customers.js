import React, { useState, useEffect } from 'react';
import {
    Search, Plus, Filter, MoreHorizontal, Mail, Phone,
    Calendar, DollarSign, TrendingUp, User, Clock,
    ChevronRight, ArrowUpRight, X, Activity // Added Activity
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import { format } from 'date-fns';

const Customers = () => {
    const { theme } = useTheme();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [customerBookings, setCustomerBookings] = useState([]);
    const [loadingBookings, setLoadingBookings] = useState(false);

    // Fetch customers
    useEffect(() => {
        fetchCustomers();
    }, [searchTerm]);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            // Debounce search could be added here
            const res = await api.getCustomers({ search: searchTerm });
            setCustomers(res.data);
        } catch (error) {
            console.error('Failed to fetch customers:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch customer details and bookings
    const handleCustomerClick = async (customer) => {
        setSelectedCustomer(customer);
        setShowDetailModal(true);
        setLoadingBookings(true);
        try {
            // Fetch full details (stats are computed on backend for single get)
            const detailRes = await api.getCustomer(customer.id);
            setSelectedCustomer(detailRes.data);

            const bookingsRes = await api.getCustomerBookings(customer.id);
            setCustomerBookings(bookingsRes.data);
        } catch (error) {
            console.error('Failed to fetch customer details:', error);
        } finally {
            setLoadingBookings(false);
        }
    };

    const [showAddModal, setShowAddModal] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', notes: '' });
    const [creating, setCreating] = useState(false);

    // Create customer
    const handleCreateCustomer = async (e) => {
        e.preventDefault();
        if (!newCustomer.email && !newCustomer.phone) {
            alert("Either Email or Phone is required");
            return;
        }
        setCreating(true);
        try {
            await api.createCustomer(newCustomer);
            setShowAddModal(false);
            setNewCustomer({ name: '', email: '', phone: '', notes: '' });
            fetchCustomers(); // Refresh list
        } catch (error) {
            console.error('Failed to create customer:', error);
            alert(error.response?.data?.detail || "Failed to create customer");
        } finally {
            setCreating(false);
        }
    };

    const isDark = theme === 'dark';

    return (

        <div className="glass-panel p-6 rounded-3xl min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-[#E6E8EB] text-gradient-pro">Customers</h1>
                    <p className="text-sm text-gray-500 dark:text-[#9CA3AF]">
                        Manage and view your customer base
                    </p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-500 dark:to-blue-500 hover:opacity-90 text-white rounded-xl transition-all shadow-lg shadow-purple-500/20 font-medium text-sm"
                >
                    <Plus size={18} />
                    Add Customer
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total Customers', value: customers.length, icon: User, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' },
                    { label: 'Active This Month', value: customers.filter(c => c.last_visit && new Date(c.last_visit) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length, icon: Activity, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-500/10' },
                    { label: 'Total Revenue', value: `₹${customers.reduce((acc, c) => acc + (c.total_revenue || 0), 0).toLocaleString()}`, icon: DollarSign, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' }
                ].map((stat, i) => (
                    <div key={i} className="p-4 rounded-2xl border border-white/50 dark:border-[#1F2630] bg-white/50 dark:bg-white/5 backdrop-blur-sm hover:border-purple-500/30 transition-all shadow-sm dark:shadow-none">
                        <div className="flex justify-between items-start mb-2">
                            <div className={`p-2 rounded-lg ${stat.bg}`}>
                                <stat.icon size={20} className={stat.color} />
                            </div>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-black/5 dark:bg-[#1F2630] text-gray-600 dark:text-[#7D8590]">
                                +2.5%
                            </span>
                        </div>
                        <div className="text-2xl font-bold mb-1 text-gray-900 dark:text-[#E6E8EB]">{stat.value}</div>
                        <div className="text-sm text-gray-500 dark:text-[#9CA3AF]">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-[#9CA3AF]" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] placeholder-gray-500 dark:placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all backdrop-blur-sm"
                    />
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#1F2630] bg-white/50 dark:bg-white/5 text-gray-700 dark:text-[#E6E8EB] hover:bg-black/5 dark:hover:bg-white/10 transition-colors backdrop-blur-sm">
                    <Filter size={18} />
                    <span>Filters</span>
                </button>
            </div>

            {/* Customers Table */}
            <div className="rounded-2xl border border-gray-200 dark:border-[#1F2630] overflow-hidden glass-panel">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-200 dark:border-[#1F2630] bg-black/5 dark:bg-white/5">
                                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#9CA3AF]">Customer</th>
                                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#9CA3AF]">Contact</th>
                                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#9CA3AF]">User Since</th>
                                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#9CA3AF]">Total Revenue</th>
                                <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#9CA3AF]">Bookings</th>
                                <th className="p-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-[#1F2630]">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500 dark:text-[#9CA3AF]">Loading customers...</td>
                                </tr>
                            ) : customers.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500 dark:text-[#9CA3AF]">No customers found</td>
                                </tr>
                            ) : (
                                customers.map((customer) => (
                                    <tr
                                        key={customer.id}
                                        onClick={() => handleCustomerClick(customer)}
                                        className="cursor-pointer transition-all duration-300 hover:bg-black/5 dark:hover:bg-white/5 border-l-2 border-transparent hover:border-purple-500 group"
                                    >
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gray-200 dark:bg-[#1F2630] text-gray-700 dark:text-[#E6E8EB] group-hover:bg-purple-100 dark:group-hover:bg-purple-500/20 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                                    {customer.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-medium text-gray-900 dark:text-[#E6E8EB] group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{customer.name}</div>
                                                    <div className="text-xs text-gray-500 dark:text-[#7D8590]">Active</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col gap-1">
                                                {customer.email && (
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#9CA3AF]">
                                                        <Mail size={12} />
                                                        {customer.email}
                                                    </div>
                                                )}
                                                {customer.phone && (
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#9CA3AF]">
                                                        <Phone size={12} />
                                                        {customer.phone}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-[#9CA3AF]">
                                            {format(new Date(customer.created_at), 'MMM d, yyyy')}
                                        </td>
                                        <td className="p-4 text-sm font-medium text-gray-900 dark:text-[#E6E8EB]">
                                            ₹{(customer.total_revenue || 0).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-[#9CA3AF]">
                                            {customer.total_bookings || 0}
                                        </td>
                                        <td className="p-4 text-right">
                                            <ChevronRight size={16} className="text-gray-400 dark:text-[#9CA3AF] group-hover:text-purple-600 dark:group-hover:text-purple-400" />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Customer Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="w-full max-w-md rounded-3xl shadow-2xl glass-panel">
                        <div className="p-4 border-b border-gray-200 dark:border-[#1F2630] flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-[#E6E8EB]">Add Customer</h3>
                            <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 dark:text-[#9CA3AF] transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateCustomer} className="p-4 space-y-4 bg-white/50 dark:bg-[#12161C]/50">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-[#9CA3AF]">Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newCustomer.name}
                                    onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] focus:ring-2 focus:ring-purple-500/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-[#9CA3AF]">Email</label>
                                <input
                                    type="email"
                                    value={newCustomer.email}
                                    onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] focus:ring-2 focus:ring-purple-500/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-[#9CA3AF]">Phone</label>
                                <input
                                    type="tel"
                                    value={newCustomer.phone}
                                    onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] focus:ring-2 focus:ring-purple-500/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-[#9CA3AF]">Notes</label>
                                <textarea
                                    value={newCustomer.notes}
                                    onChange={e => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] focus:ring-2 focus:ring-purple-500/50 transition-all"
                                    rows="3"
                                />
                            </div>
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-[#1F2630] text-gray-700 dark:text-[#9CA3AF] hover:bg-black/5 dark:hover:bg-white/5 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-500 dark:to-blue-500 hover:opacity-90 text-white rounded-xl font-medium shadow-lg shadow-purple-500/20 transition-all"
                                >
                                    {creating ? 'Creating...' : 'Create Customer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Customer Detail Modal */}
            {showDetailModal && selectedCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl glass-panel">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-200 dark:border-[#1F2630] sticky top-0 z-10 flex justify-between items-start bg-white/80 dark:bg-[#12161C]/80 backdrop-blur-md">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold bg-gray-100 dark:bg-[#1F2630] text-gray-900 dark:text-[#E6E8EB] border border-gray-200 dark:border-[#1F2630]">
                                    {selectedCustomer.name.charAt(0)}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">{selectedCustomer.name}</h2>
                                    <div className="flex items-center gap-3 mt-1">
                                        {selectedCustomer.email && (
                                            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-[#9CA3AF]">
                                                <Mail size={12} /> {selectedCustomer.email}
                                            </span>
                                        )}
                                        {selectedCustomer.phone && (
                                            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-[#9CA3AF]">
                                                <Phone size={12} /> {selectedCustomer.phone}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-gray-500 dark:text-[#9CA3AF]"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 bg-white/50 dark:bg-[#12161C]/50">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                <div className="p-4 rounded-xl border border-gray-200 dark:border-[#1F2630] bg-white/50 dark:bg-white/5 backdrop-blur-sm">
                                    <div className="text-xs mb-1 text-gray-500 dark:text-[#9CA3AF]">Total Spend</div>
                                    <div className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">
                                        ₹{(selectedCustomer.total_revenue || 0).toLocaleString()}
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl border border-gray-200 dark:border-[#1F2630] bg-white/50 dark:bg-white/5 backdrop-blur-sm">
                                    <div className="text-xs mb-1 text-gray-500 dark:text-[#9CA3AF]">Total Visits</div>
                                    <div className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">
                                        {selectedCustomer.total_bookings || 0}
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl border border-gray-200 dark:border-[#1F2630] bg-white/50 dark:bg-white/5 backdrop-blur-sm">
                                    <div className="text-xs mb-1 text-gray-500 dark:text-[#9CA3AF]">User Since</div>
                                    <div className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">
                                        {format(new Date(selectedCustomer.created_at), 'MMM yyyy')}
                                    </div>
                                </div>
                                <div className="p-4 rounded-xl border border-gray-200 dark:border-[#1F2630] bg-white/50 dark:bg-white/5 backdrop-blur-sm">
                                    <div className="text-xs mb-1 text-gray-500 dark:text-[#9CA3AF]">Most Used Service</div>
                                    <div className="text-sm font-bold truncate text-gray-900 dark:text-[#E6E8EB]">
                                        {/* We'd need to fetch service name from ID or store it. For now showing ID or placeholder */}
                                        {selectedCustomer.most_used_service_id ? 'Premium Wash' : 'N/A'} {/* Placeholder */}
                                    </div>
                                </div>
                            </div>

                            {/* Past Bookings */}
                            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-[#E6E8EB]">Booking History</h3>
                            <div className="rounded-xl border border-gray-200 dark:border-[#1F2630] overflow-hidden bg-white dark:bg-[#0B0D10]">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-black/5 dark:bg-white/5">
                                        <tr>
                                            <th className="p-3 text-xs font-semibold uppercase text-gray-500 dark:text-[#9CA3AF]">Date & Time</th>
                                            <th className="p-3 text-xs font-semibold uppercase text-gray-500 dark:text-[#9CA3AF]">Service</th>
                                            <th className="p-3 text-xs font-semibold uppercase text-gray-500 dark:text-[#9CA3AF]">Amount</th>
                                            <th className="p-3 text-xs font-semibold uppercase text-gray-500 dark:text-[#9CA3AF]">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-[#1F2630]">
                                        {loadingBookings ? (
                                            <tr><td colSpan="4" className="p-4 text-center text-gray-500 dark:text-[#9CA3AF]">Loading history...</td></tr>
                                        ) : customerBookings.length === 0 ? (
                                            <tr><td colSpan="4" className="p-4 text-center text-gray-500 dark:text-[#9CA3AF]">No bookings found</td></tr>
                                        ) : (
                                            customerBookings.map(booking => (
                                                <tr key={booking.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                                    <td className="p-3 text-sm text-gray-900 dark:text-[#E6E8EB]">
                                                        {booking.date} at {booking.time}
                                                    </td>
                                                    <td className="p-3 text-sm text-gray-500 dark:text-[#9CA3AF]">
                                                        {booking.service_id} {/* Would map to name ideally */}
                                                    </td>
                                                    <td className="p-3 text-sm font-medium text-gray-900 dark:text-[#E6E8EB]">
                                                        ₹{booking.amount}
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${booking.status === 'Completed' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                                                            booking.status === 'Cancelled' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                                                'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                            }`}>
                                                            {booking.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
// End of file

export default Customers;
