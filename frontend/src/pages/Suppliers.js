import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Plus, Search, Truck, AlertTriangle, ChevronRight, Package, ArrowRight, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';

const Suppliers = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('suppliers'); // 'suppliers' | 'suggestions'

    const [suppliers, setSuppliers] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        contact_person: '',
        notes: ''
    });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'suppliers') {
                const res = await api.getSuppliers();
                setSuppliers(res.data);
            } else {
                const res = await api.getReorderSuggestions(30);
                setSuggestions(res.data);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSupplier = async (e) => {
        e.preventDefault();
        try {
            await api.createSupplier(formData);
            setIsAddModalOpen(false);
            setFormData({ name: '', email: '', phone: '', contact_person: '', notes: '' });
            fetchData();
        } catch (err) {
            console.error('Error creating supplier:', err);
            alert('Failed to create supplier.');
        }
    };

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.contact_person && s.contact_person.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            {/* Header matches Inventory.js */}
            <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630] flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center shadow-lg">
                        <Truck size={24} className="text-[#222]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Suppliers & Vendors</h1>
                        <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">
                            Manage vendor relationships and automate reordering
                        </p>
                    </div>
                </div>

                {activeTab === 'suppliers' && (
                    <Button
                        onClick={() => setIsAddModalOpen(true)}
                        className="cosmic-btn"
                    >
                        <Plus size={18} className="mr-2" />
                        Add Vendor
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex space-x-1 p-1.5 rounded-xl w-fit bg-white/50 dark:bg-[#0B0D10]/50 backdrop-blur-md border border-white/20 dark:border-[#1F2630]">
                <button
                    onClick={() => setActiveTab('suppliers')}
                    className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'suppliers'
                            ? 'bg-white dark:bg-[#1F2630] text-[#0E1116] dark:text-[#E6E8EB] shadow-sm'
                            : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#0E1116] dark:hover:text-[#E6E8EB]'
                        }`}
                >
                    Vendors List
                </button>
                <button
                    onClick={() => setActiveTab('suggestions')}
                    className={`px-6 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${activeTab === 'suggestions'
                            ? 'bg-white dark:bg-[#1F2630] text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#0E1116] dark:hover:text-[#E6E8EB]'
                        }`}
                >
                    Restock Suggestions
                    {activeTab !== 'suggestions' && suggestions.length > 0 && (
                        <span className="bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                            {suggestions.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : activeTab === 'suppliers' ? (
                <Card>
                    <CardHeader className="pb-4">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search vendors..."
                                className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {filteredSuppliers.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground">
                                <Truck className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                                <p>No vendors found.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="p-4 text-sm font-medium text-muted-foreground">Vendor Name</th>
                                            <th className="p-4 text-sm font-medium text-muted-foreground">Contact</th>
                                            <th className="p-4 text-sm font-medium text-muted-foreground">Phone</th>
                                            <th className="p-4 text-sm font-medium text-muted-foreground text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border text-sm">
                                        {filteredSuppliers.map(supplier => (
                                            <tr
                                                key={supplier.id}
                                                className="hover:bg-accent/50 transition-colors cursor-pointer"
                                                onClick={() => navigate(`/suppliers/${supplier.id}`)}
                                            >
                                                <td className="p-4 font-medium">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                                                            {supplier.name.charAt(0)}
                                                        </div>
                                                        <span className="text-[#0E1116] dark:text-[#E6E8EB]">{supplier.name}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-muted-foreground">
                                                    {supplier.contact_person || '-'}
                                                    {supplier.email && <div className="text-xs text-muted-foreground/70 mt-1">{supplier.email}</div>}
                                                </td>
                                                <td className="p-4 text-muted-foreground">{supplier.phone || '-'}</td>
                                                <td className="p-4 text-right">
                                                    <ChevronRight className="inline text-muted-foreground" size={18} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : (
                /* Suggestions Tab */
                <div className="space-y-6">
                    <Card className="border-blue-500/30 bg-blue-500/5">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                <AlertTriangle className="h-4 w-4" />
                                Smart Restock Suggestions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                                These restock suggestions are based on a predictive algorithm analyzing your past 30 days of sales velocity combined with each vendor's stated lead time.
                            </p>
                        </CardContent>
                    </Card>

                    {suggestions.length === 0 ? (
                        <Card>
                            <CardContent className="p-12 text-center text-muted-foreground">
                                <Package className="mx-auto h-12 w-12 text-green-500/50 mb-3" />
                                <h3 className="text-lg font-medium text-[#0E1116] dark:text-[#E6E8EB] mb-1">Inventory Optimized</h3>
                                <p>No immediate restocks required based on current burn rates.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {suggestions.map((suggestion, idx) => {
                                const isCritical = suggestion.status === 'CRITICAL';
                                return (
                                    <Card key={idx} className={`relative overflow-hidden transition-all hover:shadow-lg ${isCritical ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]'}`}>
                                        {/* Status Indicator Bar */}
                                        <div className={`absolute top-0 left-0 w-full h-1.5 ${isCritical ? 'bg-red-500' : 'bg-amber-500'}`}></div>

                                        <CardContent className="p-5 pt-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="font-bold text-lg leading-tight text-[#0E1116] dark:text-[#E6E8EB]">{suggestion.product_name}</h3>
                                                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                                        <Truck size={14} /> {suggestion.supplier_name}
                                                    </p>
                                                </div>
                                                <Badge variant={isCritical ? 'destructive' : 'outline'} className={!isCritical ? 'border-amber-500 text-amber-500' : ''}>
                                                    {suggestion.status}
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div className="bg-accent/50 rounded-xl p-3">
                                                    <div className="text-xs text-muted-foreground mb-1">Current Stock</div>
                                                    <div className="font-semibold text-lg text-[#0E1116] dark:text-[#E6E8EB]">{suggestion.current_stock}</div>
                                                </div>
                                                <div className="bg-accent/50 rounded-xl p-3">
                                                    <div className="text-xs text-muted-foreground mb-1">Days Left (Est)</div>
                                                    <div className={`font-semibold text-lg ${suggestion.days_remaining <= suggestion.lead_time_days ? 'text-red-500' : 'text-[#0E1116] dark:text-[#E6E8EB]'}`}>
                                                        {suggestion.days_remaining} d
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-sm text-muted-foreground mb-5 flex items-center justify-between">
                                                <span>Burn: <strong className="text-[#0E1116] dark:text-[#E6E8EB]">{suggestion.daily_burn_rate}/day</strong></span>
                                                <span className="text-border">|</span>
                                                <span>Lead: <strong className="text-[#0E1116] dark:text-[#E6E8EB]">{suggestion.lead_time_days}d</strong></span>
                                            </div>

                                            <Button className="w-full cosmic-btn" variant="default">
                                                Order <span className="opacity-80 ml-1">{suggestion.recommended_order_quantity} units</span> <ArrowRight size={16} className="ml-2" />
                                            </Button>
                                            <div className="text-center mt-2 text-xs text-muted-foreground">
                                                MOQ: {suggestion.moq}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Add Supplier Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-accent/30">
                            <h2 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Add New Vendor</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-muted-foreground hover:bg-accent rounded-lg p-1 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateSupplier} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Vendor Name *</label>
                                <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition" placeholder="Acme Salon Supplies" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Contact Person</label>
                                <input type="text" value={formData.contact_person} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition" placeholder="John Doe" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
                                    <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition" placeholder="john@acme.com" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Phone</label>
                                    <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition" placeholder="(555) 123-4567" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Notes</label>
                                <textarea rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition resize-none"></textarea>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="flex-1">Cancel</Button>
                                <Button type="submit" className="cosmic-btn flex-1">Save Vendor</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Suppliers;
