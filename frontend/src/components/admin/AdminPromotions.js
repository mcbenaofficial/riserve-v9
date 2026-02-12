import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Calendar, Tag, MoreVertical, Loader, TrendingUp, Users, DollarSign } from 'lucide-react';
import { api } from '../../services/api';
import CreatePromotionModal from './CreatePromotionModal';

const AdminPromotions = () => {
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // all, active, expired

    const fetchPromotions = async () => {
        setLoading(true);
        try {
            const response = await api.getPromotions();
            setPromotions(response.data);
        } catch (err) {
            setError('Failed to load promotions');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPromotions();
    }, []);

    const filteredPromotions = promotions.filter(promo => {
        const matchesSearch = promo.title.toLowerCase().includes(searchTerm.toLowerCase());
        const isActive = promo.is_active;
        const isExpired = promo.valid_to && new Date(promo.valid_to) < new Date();

        if (filterStatus === 'active') return matchesSearch && isActive && !isExpired;
        if (filterStatus === 'expired') return matchesSearch && (isExpired || !isActive);
        return matchesSearch;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Promotions & Campaigns</h1>
                    <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">Manage your marketing campaigns and discount codes</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#FF6B6B] hover:bg-[#EE5253] text-white rounded-xl font-medium transition-all shadow-lg shadow-red-500/20"
                >
                    <Plus size={18} />
                    <span>New Campaign</span>
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                    title="Active Campaigns"
                    value={promotions.filter(p => p.is_active).length}
                    icon={Tag}
                    color="bg-green-500"
                />
                <StatsCard
                    title="Total Redemptions"
                    value="1,245"
                    icon={Users}
                    color="bg-blue-500"
                />
                <StatsCard
                    title="Revenue Generated"
                    value="$12,450"
                    icon={TrendingUp}
                    color="bg-purple-500"
                />
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4 bg-white/50 dark:bg-white/5 p-4 rounded-xl border border-[#D9DEE5] dark:border-[#2A303C]">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search campaigns..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-white dark:bg-[#0E1116] border border-[#D9DEE5] dark:border-[#2A303C] outline-none focus:ring-2 focus:ring-[#FF6B6B]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <FilterButton label="All" active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} />
                    <FilterButton label="Active" active={filterStatus === 'active'} onClick={() => setFilterStatus('active')} />
                    <FilterButton label="Expired" active={filterStatus === 'expired'} onClick={() => setFilterStatus('expired')} />
                </div>
            </div>

            {/* Campaigns List */}
            <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-[#D9DEE5] dark:border-[#2A303C] overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader className="animate-spin text-[#FF6B6B]" size={32} />
                    </div>
                ) : filteredPromotions.length > 0 ? (
                    <div className="divide-y divide-[#D9DEE5] dark:divide-[#2A303C]">
                        {filteredPromotions.map(promo => (
                            <PromotionCard key={promo.promotion_id} promo={promo} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                            <Tag size={32} className="text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-[#0E1116] dark:text-[#E6E8EB]">No campaigns found</h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm mt-2">
                            {searchTerm || filterStatus !== 'all' ? "Try adjusting your filters" : "Create your first marketing campaign to attract more customers."}
                        </p>
                    </div>
                )}
            </div>

            <CreatePromotionModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreated={fetchPromotions}
            />
        </div>
    );
};

const StatsCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl p-6 rounded-2xl border border-[#D9DEE5] dark:border-[#2A303C] flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${color} bg-opacity-10 flex items-center justify-center`}>
            <Icon size={24} className={color.replace('bg-', 'text-')} />
        </div>
        <div>
            <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">{title}</p>
            <h3 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">{value}</h3>
        </div>
    </div>
);

const FilterButton = ({ label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${active
            ? 'bg-[#FF6B6B] text-white shadow-md shadow-red-500/20'
            : 'bg-white dark:bg-[#0E1116] text-[#4B5563] dark:text-[#9CA3AF] border border-[#D9DEE5] dark:border-[#2A303C] hover:bg-gray-50 dark:hover:bg-white/5'
            }`}
    >
        {label}
    </button>
);

const PromotionCard = ({ promo }) => {
    const isExpired = promo.valid_to && new Date(promo.valid_to) < new Date();

    return (
        <div className="p-6 transition-all hover:bg-black/5 dark:hover:bg-white/5 group">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${!promo.is_active ? 'bg-gray-100 text-gray-500 dark:bg-gray-800' :
                            isExpired ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' :
                                'bg-green-100 text-green-600 dark:bg-green-900/30'
                            }`}>
                            {!promo.is_active ? 'Inactive' : isExpired ? 'Expired' : 'Active'}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(promo.valid_from).toLocaleDateString()} - {new Date(promo.valid_to).toLocaleDateString()}
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-1">{promo.title}</h3>
                    <p className="text-sm text-[#4B5563] dark:text-[#7D8590] line-clamp-2">{promo.description}</p>
                </div>

                <div className="text-right">
                    <div className="text-2xl font-bold text-[#FF6B6B]">
                        {promo.discount_type === 'percentage' ? `${promo.discount_value}%` : `$${promo.discount_value}`}
                    </div>
                    <div className="text-xs text-gray-400 uppercase tracking-widest font-medium mt-1">off</div>
                </div>
            </div>
        </div>
    );
};

export default AdminPromotions;
