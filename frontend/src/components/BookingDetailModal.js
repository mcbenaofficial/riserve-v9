import React, { useState, useEffect } from 'react';
import { X, Check, Clock, Calendar, User, Phone, Mail, FileText, CheckCircle, AlertCircle, CreditCard, Banknote } from 'lucide-react';
import { api } from '../services/api';

const BookingDetailModal = ({ isOpen, onClose, booking, onUpdateStatus }) => {
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [customer, setCustomer] = useState(null);
    const [transaction, setTransaction] = useState(null);

    useEffect(() => {
        if (isOpen && booking) {
            fetchCustomerDetails();
        }
    }, [isOpen, booking]);

    const fetchCustomerDetails = async () => {
        setLoadingHistory(true);
        try {
            // 1. Get full customer details
            if (booking.customer_id) {
                const customerRes = await api.getCustomer(booking.customer_id);
                setCustomer(customerRes.data);

                // 2. Get customer booking history
                const bookingsRes = await api.getCustomerBookings(booking.customer_id);
                // Filter out current booking and sort by date
                const pastBookings = bookingsRes.data
                    .filter(b => b.id !== booking.id)
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, 5); // Last 5 bookings
                setHistory(pastBookings);
            } else {
                // Fallback if no customer_id (guest/legacy)
                setCustomer({
                    name: booking.customer,
                    phone: booking.customer_phone,
                    email: booking.customer_email
                });
                setHistory([]);
            }

            // 3. Get transaction details
            const txRes = await api.getTransactionByBooking(booking.id);
            setTransaction(txRes.data);

        } catch (error) {
            console.error('Failed to fetch customer history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    if (!isOpen || !booking) return null;

    const STATUS_STEPS = ['Pending', 'Confirmed', 'In Progress', 'Completed'];
    const currentStepIndex = STATUS_STEPS.indexOf(booking.status);

    // Handle cancelled state specially
    const isCancelled = booking.status === 'Cancelled';

    const handleStatusClick = (step) => {
        if (isCancelled) return; // Cannot move from cancelled via stepper
        onUpdateStatus(booking.id, step);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="w-full max-w-4xl glass-panel rounded-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* Header */}
                <div className="px-6 py-4 border-b border-[#1F2630] flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-[#E6E8EB] text-gradient-pro">
                            Booking #{booking.id.substring(0, 8).toUpperCase()}
                        </h2>
                        <p className="text-sm text-[#9CA3AF]">
                            Created on {new Date(booking.created_at).toLocaleDateString()}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-[#9CA3AF] hover:text-[#E6E8EB]"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#12161C]/50">

                    {/* Status Stepper */}
                    <div className="w-full">
                        <h3 className="text-sm font-semibold text-[#9CA3AF] uppercase tracking-wider mb-6">Booking Status</h3>

                        {isCancelled ? (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3 backdrop-blur-sm">
                                <AlertCircle size={24} />
                                <div>
                                    <span className="font-bold">Booking Cancelled</span>
                                    <p className="text-sm opacity-80">This booking has been cancelled and cannot be modified.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="relative flex items-center justify-between w-full px-4">
                                {/* Connecting Line */}
                                <div className="absolute left-0 top-1/2 w-full h-1 bg-[#1F2630] -z-10 transform -translate-y-1/2" />

                                {STATUS_STEPS.map((step, index) => {
                                    const isCompleted = index < currentStepIndex;
                                    const isCurrent = index === currentStepIndex;

                                    return (
                                        <div key={step} className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => handleStatusClick(step)}>
                                            <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all
                        ${isCompleted ? 'bg-purple-500 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : ''}
                        ${isCurrent ? 'bg-[#0B0D10] border-purple-500 text-purple-500 scale-110 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : ''}
                        ${!isCompleted && !isCurrent ? 'bg-[#0B0D10] border-[#1F2630] text-[#7D8590]' : ''}
                      `}>
                                                {isCompleted ? <Check size={16} /> : <div className="w-2 h-2 rounded-full bg-current" />}
                                            </div>
                                            <span className={`text-xs font-semibold ${isCurrent ? 'text-purple-400' : 'text-[#7D8590]'}`}>
                                                {step}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Booking Details */}
                        <div className="bg-white/5 rounded-2xl p-6 border border-[#1F2630] hover:border-purple-500/30 transition-colors">
                            <h3 className="text-lg font-bold text-[#E6E8EB] mb-4 flex items-center gap-2">
                                <FileText size={18} className="text-purple-400" />
                                Booking Details
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    <span className="text-[#9CA3AF]">Service</span>
                                    <span className="font-semibold text-[#E6E8EB]">{booking.service_name || 'Generic Service'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[#9CA3AF]">Date</span>
                                    <span className="font-semibold text-[#E6E8EB]">{booking.date}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[#9CA3AF]">Time</span>
                                    <span className="font-semibold text-[#E6E8EB]">{booking.time}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[#9CA3AF]">Outlet</span>
                                    <span className="font-semibold text-[#E6E8EB]">{booking.outlet_name || 'Main Outlet'}</span>
                                </div>
                                <div className="pt-4 border-t border-[#1F2630] flex justify-between items-center">
                                    <span className="text-[#9CA3AF]">Total Amount</span>
                                    <span className="text-xl font-bold text-purple-400">₹{booking.total_amount || booking.amount}</span>
                                </div>
                            </div>
                        </div>

                        {/* Customer Details */}
                        <div className="bg-white/5 rounded-2xl p-6 border border-[#1F2630] hover:border-blue-500/30 transition-colors">
                            <h3 className="text-lg font-bold text-[#E6E8EB] mb-4 flex items-center gap-2">
                                <User size={18} className="text-blue-400" />
                                Customer
                            </h3>
                            {customer ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-lg border border-blue-500/20">
                                            {customer.name?.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-[#E6E8EB]">{customer.name}</div>
                                            <div className="text-sm text-[#9CA3AF]">Customer since {new Date(customer.created_at || Date.now()).getFullYear()}</div>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mt-4">
                                        <div className="flex items-center gap-3 text-sm">
                                            <Phone size={16} className="text-[#7D8590]" />
                                            <span className="text-[#E6E8EB]">{customer.phone || 'No phone'}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Mail size={16} className="text-[#7D8590]" />
                                            <span className="text-[#E6E8EB]">{customer.email || 'No email'}</span>
                                        </div>
                                        {customer.notes && (
                                            <div className="mt-4 p-3 bg-yellow-500/10 text-yellow-200 text-sm rounded-lg border border-yellow-500/20">
                                                {customer.notes}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-[#7D8590]">Loading customer info...</div>
                            )}
                        </div>
                    </div>

                    {/* Transaction/Payment Details */}
                    {transaction && (
                        <div className="bg-white/5 rounded-2xl p-6 border border-[#1F2630]">
                            <h3 className="text-lg font-bold text-[#E6E8EB] mb-4 flex items-center gap-2">
                                <CreditCard size={18} className="text-green-400" />
                                Payment Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div>
                                    <div className="text-sm text-[#9CA3AF] mb-1">Status</div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                        ${transaction.status === 'Settled' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                            transaction.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                                'bg-white/10 text-[#9CA3AF]'}`}>
                                        {transaction.status}
                                    </span>
                                </div>
                                <div>
                                    <div className="text-sm text-[#9CA3AF] mb-1">Transaction ID</div>
                                    <div className="font-mono text-sm text-[#E6E8EB]">{transaction.id?.substring(0, 8).toUpperCase()}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-[#9CA3AF] mb-1">Amount</div>
                                    <div className="font-semibold text-[#E6E8EB]">₹{transaction.total_amount || transaction.gross}</div>
                                </div>
                                <div>
                                    <div className="text-sm text-[#9CA3AF] mb-1">Date</div>
                                    <div className="text-sm text-[#E6E8EB]">{new Date(transaction.date).toLocaleDateString()}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* History Section */}
                    <div>
                        <h3 className="text-lg font-bold text-[#E6E8EB] mb-4 flex items-center gap-2">
                            <Clock size={18} className="text-[#9CA3AF]" />
                            Recent History
                        </h3>

                        {loadingHistory ? (
                            <div className="text-center py-8 text-[#7D8590]">Loading history...</div>
                        ) : history.length > 0 ? (
                            <div className="bg-[#0B0D10] border border-[#1F2630] rounded-xl overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white/5 text-[#9CA3AF]">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Date</th>
                                            <th className="px-4 py-3 font-medium">Service</th>
                                            <th className="px-4 py-3 font-medium">Amount</th>
                                            <th className="px-4 py-3 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#1F2630]">
                                        {history.map(h => (
                                            <tr key={h.id} className="hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3 text-[#E6E8EB]">{h.date}</td>
                                                <td className="px-4 py-3 text-[#E6E8EB]">{h.service_name || 'Service'}</td>
                                                <td className="px-4 py-3 text-[#E6E8EB]">₹{h.amount}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium 
                            ${h.status === 'Completed' ? 'bg-green-500/10 text-green-400' :
                                                            h.status === 'Cancelled' ? 'bg-red-500/10 text-red-400' :
                                                                'bg-blue-500/10 text-blue-400'}`}>
                                                        {h.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-white/5 rounded-xl border border-dashed border-[#1F2630] text-[#7D8590]">
                                No previous bookings found for this customer.
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-[#1F2630] flex justify-end gap-3 glass-panel rounded-b-3xl">
                    {!isCancelled && (
                        <button
                            onClick={() => onUpdateStatus(booking.id, 'Cancelled')}
                            className="px-4 py-2 text-red-500 hover:bg-red-500/10 rounded-xl font-medium transition-colors"
                        >
                            Cancel Booking
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 text-white rounded-xl font-medium shadow-lg shadow-purple-500/20 transition-all"
                    >
                        Close
                    </button>
                </div>

            </div>
        </div>
    );
};

export default BookingDetailModal;
