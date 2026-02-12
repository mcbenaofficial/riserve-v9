import React, { useState } from 'react';
import { X, Calendar, Tag, Percent, DollarSign, Gift } from 'lucide-react';
import { api } from '../../services/api';

const CreatePromotionModal = ({ isOpen, onClose, onCreated }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        discount_type: 'percentage', // percentage, fixed_amount
        discount_value: '',
        valid_from: '',
        valid_to: '',
        package_tier: 'all', // all, gold, platinum
        is_active: true
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await api.createPromotion(formData);
            onCreated();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create promotion');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative w-full max-w-2xl bg-white/90 dark:bg-[#1A1D24]/90 backdrop-blur-xl rounded-3xl p-8 border border-[#D9DEE5] dark:border-[#2A303C] shadow-2xl animate-in fade-in zoom-in duration-200">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF6B6B] to-[#EE5253] flex items-center justify-center mb-4 shadow-lg shadow-red-500/20">
                        <Gift size={24} className="text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Create New Campaign</h2>
                    <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">Launch a new marketing promotion or discount</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-[#374151] dark:text-[#9CA3AF] mb-2">Campaign Title</label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-[#0E1116]/50 border border-[#D9DEE5] dark:border-[#2A303C] focus:ring-2 focus:ring-[#FF6B6B] outline-none text-[#0E1116] dark:text-[#E6E8EB]"
                                placeholder="e.g., Summer Sale 2024"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-[#374151] dark:text-[#9CA3AF] mb-2">Description</label>
                            <textarea
                                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-[#0E1116]/50 border border-[#D9DEE5] dark:border-[#2A303C] focus:ring-2 focus:ring-[#FF6B6B] outline-none text-[#0E1116] dark:text-[#E6E8EB]"
                                placeholder="Campaign details..."
                                rows={3}
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#374151] dark:text-[#9CA3AF] mb-2">Discount Type</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, discount_type: 'percentage' })}
                                    className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${formData.discount_type === 'percentage'
                                        ? 'bg-[#FF6B6B]/10 border-[#FF6B6B] text-[#FF6B6B]'
                                        : 'border-[#D9DEE5] dark:border-[#2A303C] text-[#4B5563] dark:text-[#9CA3AF] hover:bg-gray-50 dark:hover:bg-white/5'
                                        }`}
                                >
                                    <Percent size={18} /> Percentage
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, discount_type: 'fixed_amount' })}
                                    className={`flex-1 py-3 px-4 rounded-xl border flex items-center justify-center gap-2 transition-all ${formData.discount_type === 'fixed_amount'
                                        ? 'bg-[#FF6B6B]/10 border-[#FF6B6B] text-[#FF6B6B]'
                                        : 'border-[#D9DEE5] dark:border-[#2A303C] text-[#4B5563] dark:text-[#9CA3AF] hover:bg-gray-50 dark:hover:bg-white/5'
                                        }`}
                                >
                                    <DollarSign size={18} /> Fixed
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#374151] dark:text-[#9CA3AF] mb-2">
                                {formData.discount_type === 'percentage' ? 'Percentage Value' : 'Amount Value'}
                            </label>
                            <input
                                type="number"
                                required
                                className="w-full px-4 py-3 rounded-xl bg-white/50 dark:bg-[#0E1116]/50 border border-[#D9DEE5] dark:border-[#2A303C] focus:ring-2 focus:ring-[#FF6B6B] outline-none text-[#0E1116] dark:text-[#E6E8EB]"
                                placeholder={formData.discount_type === 'percentage' ? "15" : "500"}
                                value={formData.discount_value}
                                onChange={e => setFormData({ ...formData, discount_value: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#374151] dark:text-[#9CA3AF] mb-2">Valid From</label>
                            <div className="relative">
                                <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                                <input
                                    type="datetime-local"
                                    required
                                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/50 dark:bg-[#0E1116]/50 border border-[#D9DEE5] dark:border-[#2A303C] focus:ring-2 focus:ring-[#FF6B6B] outline-none text-[#0E1116] dark:text-[#E6E8EB]"
                                    value={formData.valid_from}
                                    onChange={e => setFormData({ ...formData, valid_from: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#374151] dark:text-[#9CA3AF] mb-2">Valid To</label>
                            <div className="relative">
                                <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                                <input
                                    type="datetime-local"
                                    required
                                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/50 dark:bg-[#0E1116]/50 border border-[#D9DEE5] dark:border-[#2A303C] focus:ring-2 focus:ring-[#FF6B6B] outline-none text-[#0E1116] dark:text-[#E6E8EB]"
                                    value={formData.valid_to}
                                    onChange={e => setFormData({ ...formData, valid_to: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-[#D9DEE5] dark:border-[#2A303C]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl font-semibold text-[#4B5563] dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[#FF6B6B] to-[#EE5253] hover:shadow-lg hover:shadow-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creating...' : 'Launch Campaign'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreatePromotionModal;
