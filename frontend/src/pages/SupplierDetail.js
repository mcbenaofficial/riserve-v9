import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ArrowLeft, Package, Plus, Link as LinkIcon, Save, Trash2, Edit2, AlertCircle, Truck, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

const SupplierDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [supplier, setSupplier] = useState(null);
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);

    // Link Product Modal
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [allProducts, setAllProducts] = useState([]);
    const [linkData, setLinkData] = useState({ product_id: '', lead_time_days: 7, moq: 1, unit_cost: '' });

    // Edit Link State
    const [editingLinkId, setEditingLinkId] = useState(null);
    const [editLinkData, setEditLinkData] = useState({});

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [suppRes, linksRes] = await Promise.all([
                api.getSupplier(id),
                api.getSupplierProducts(id)
            ]);
            setSupplier(suppRes.data);
            setLinks(linksRes.data);
        } catch (err) {
            console.error('Failed to fetch supplier data', err);
        } finally {
            setLoading(false);
        }
    };

    const loadProductsForLinking = async () => {
        try {
            // Basic fetch, ideally with pagination or search in a real app
            const res = await api.getProducts({ limit: 100 });
            setAllProducts(res.data.items || res.data);
            if (res.data.length > 0 || (res.data.items && res.data.items.length > 0)) {
                setLinkData({ ...linkData, product_id: res.data.items ? res.data.items[0].id : res.data[0].id });
            }
            setIsLinkModalOpen(true);
        } catch (err) {
            console.error('Failed to load products', err);
        }
    };

    const handleLinkProduct = async (e) => {
        e.preventDefault();
        try {
            // format payload
            const payload = {
                product_id: linkData.product_id,
                lead_time_days: parseInt(linkData.lead_time_days),
                moq: parseInt(linkData.moq),
                unit_cost: linkData.unit_cost ? parseFloat(linkData.unit_cost) : null
            };
            await api.linkSupplierProduct(id, payload);
            setIsLinkModalOpen(false);
            fetchData(); // refresh links
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || 'Failed to link product');
        }
    };

    const handleDeleteLink = async (linkId) => {
        if (!window.confirm("Remove this product from the vendor?")) return;
        try {
            await api.deleteSupplierProductLink(id, linkId);
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const startEditingLink = (link) => {
        setEditingLinkId(link.id);
        setEditLinkData({
            lead_time_days: link.lead_time_days,
            moq: link.moq,
            unit_cost: link.unit_cost || ''
        });
    };

    const saveEditedLink = async (linkId) => {
        try {
            const payload = {
                lead_time_days: parseInt(editLinkData.lead_time_days),
                moq: parseInt(editLinkData.moq),
                unit_cost: editLinkData.unit_cost ? parseFloat(editLinkData.unit_cost) : null
            };
            await api.updateSupplierProductLink(id, linkId, payload);
            setEditingLinkId(null);
            fetchData();
        } catch (err) {
            console.error(err);
            alert('Failed to update link parameters');
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-6 h-screen">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!supplier) return <div className="p-8 text-center text-muted-foreground">Vendor not found.</div>;

    return (
        <div className="space-y-6">

            {/* Navigation */}
            <button onClick={() => navigate('/suppliers')} className="flex items-center text-sm font-medium text-muted-foreground hover:text-[#0E1116] dark:hover:text-[#E6E8EB] transition-colors w-fit">
                <ArrowLeft size={16} className="mr-1.5" /> Back to Vendors
            </button>

            {/* Header Card */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold shadow-sm border border-primary/20">
                                {supplier.name.charAt(0)}
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">{supplier.name}</h1>
                                <p className="text-muted-foreground flex items-center gap-2 text-sm mt-0.5">
                                    <span className="inline-block w-2 bg-green-500 h-2 rounded-full animate-pulse"></span>
                                    Active Vendor since {new Date(supplier.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                        <Button variant="outline">
                            Edit Details
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-border">
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Contact Person</div>
                            <div className="text-[#0E1116] dark:text-[#E6E8EB]">{supplier.contact_person || 'Not specified'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Email / Phone</div>
                            <div className="text-[#0E1116] dark:text-[#E6E8EB]">{supplier.email || '-'}</div>
                            <div className="text-muted-foreground text-sm mt-0.5">{supplier.phone || '-'}</div>
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Location</div>
                            <div className="text-[#0E1116] dark:text-[#E6E8EB] text-sm">{supplier.address || 'Address not listed'}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Products Section */}
            <Card>
                <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-accent/30 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <Package className="text-primary" size={20} />
                        <h2 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Cataloque Items</h2>
                    </div>
                    <Button
                        variant="outline"
                        onClick={loadProductsForLinking}
                    >
                        <LinkIcon size={14} className="mr-2" /> Link Product
                    </Button>
                </div>
                <CardContent className="p-0">
                    {links.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <Package className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                            <p>No products are currently linked to this vendor.</p>
                            <button onClick={loadProductsForLinking} className="mt-4 text-primary font-medium hover:underline text-sm">Link an item to begin tracking restocks.</button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                                        <th className="py-4 px-6 font-medium">Product</th>
                                        <th className="py-4 px-6 font-medium">Lead Time</th>
                                        <th className="py-4 px-6 font-medium">Min Order Req (MOQ)</th>
                                        <th className="py-4 px-6 font-medium">Current Stock</th>
                                        <th className="py-4 px-6 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-sm">
                                    {links.map(link => (
                                        <tr key={link.id} className="hover:bg-accent/50 transition-colors group">
                                            <td className="py-4 px-6 font-medium text-[#0E1116] dark:text-[#E6E8EB]">
                                                {link.product_name}
                                                <div className="text-xs text-muted-foreground font-normal mt-0.5">{link.product_sku || 'No SKU'}</div>
                                            </td>

                                            {/* Editing Mode */}
                                            {editingLinkId === link.id ? (
                                                <>
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center text-muted-foreground">
                                                            <input type="number" value={editLinkData.lead_time_days} onChange={e => setEditLinkData({ ...editLinkData, lead_time_days: e.target.value })} className="w-16 px-2 py-1 bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/50 text-[#0E1116] dark:text-[#E6E8EB]" /> <span className="ml-2">days</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <input type="number" value={editLinkData.moq} onChange={e => setEditLinkData({ ...editLinkData, moq: e.target.value })} className="w-20 px-2 py-1 bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary/50 text-[#0E1116] dark:text-[#E6E8EB]" />
                                                    </td>
                                                    <td className="py-4 px-6 text-muted-foreground font-medium">{link.current_stock} units</td>
                                                    <td className="py-4 px-6 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => saveEditedLink(link.id)} className="p-1.5 text-green-500 hover:bg-green-500/10 rounded transition-colors"><Save size={16} /></button>
                                                            <button onClick={() => setEditingLinkId(null)} className="p-1.5 text-muted-foreground hover:bg-accent rounded text-xs transition-colors"><X size={16} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                /* Display Mode */
                                                <>
                                                    <td className="py-4 px-6 text-muted-foreground">{link.lead_time_days} days</td>
                                                    <td className="py-4 px-6 text-muted-foreground">
                                                        {link.moq}
                                                        {link.moq > link.current_stock && <Badge variant="destructive" className="ml-2 text-[10px] py-0">Below MOQ</Badge>}
                                                    </td>
                                                    <td className="py-4 px-6 text-muted-foreground font-medium">{link.current_stock} units</td>
                                                    <td className="py-4 px-6 text-right">
                                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => startEditingLink(link)} className="p-1.5 text-muted-foreground hover:text-primary rounded transition-colors" title="Edit Parameters"><Edit2 size={16} /></button>
                                                            <button onClick={() => handleDeleteLink(link.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors" title="Unlink Product"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Link Product Modal */}
            {isLinkModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border overflow-hidden">
                        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-accent/30">
                            <h2 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Link Inventory Item</h2>
                            <button onClick={() => setIsLinkModalOpen(false)} className="text-muted-foreground hover:bg-accent rounded-lg p-1 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleLinkProduct} className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Select Product *</label>
                                <select
                                    required
                                    value={linkData.product_id}
                                    onChange={e => setLinkData({ ...linkData, product_id: e.target.value })}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition"
                                >
                                    <option value="" disabled>Select an item</option>
                                    {allProducts.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4 border-t border-border pt-5">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">SLA Lead Time <span className="opacity-50 font-normal">(Days)</span></label>
                                    <input
                                        type="number"
                                        required min="0"
                                        value={linkData.lead_time_days}
                                        onChange={e => setLinkData({ ...linkData, lead_time_days: e.target.value })}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition"
                                    />
                                    <p className="text-[10px] text-muted-foreground/70 mt-1 leading-tight">Time from order to restock delivery.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1">Min Order Qty <span className="opacity-50 font-normal">(MOQ)</span></label>
                                    <input
                                        type="number"
                                        required min="1"
                                        value={linkData.moq}
                                        onChange={e => setLinkData({ ...linkData, moq: e.target.value })}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition"
                                    />
                                    <p className="text-[10px] text-muted-foreground/70 mt-1 leading-tight">Minimum units required per order.</p>
                                </div>
                            </div>

                            <div className="pt-2 flex gap-3">
                                <Button type="button" variant="outline" onClick={() => setIsLinkModalOpen(false)} className="flex-1">Cancel</Button>
                                <Button type="submit" className="cosmic-btn flex-1">Link Item</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupplierDetail;
