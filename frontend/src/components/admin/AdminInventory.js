import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Package, Plus, Search, AlertTriangle, Edit2, Trash2, 
  Settings, History, BarChart3, X, Save, RefreshCw,
  ChevronDown, Filter, Box, DollarSign, TrendingDown
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';

const AdminInventory = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [settings, setSettings] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [outlets, setOutlets] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, statsRes, alertsRes, settingsRes, categoriesRes, outletsRes] = await Promise.all([
        api.getProducts(),
        api.getInventoryStats(),
        api.getInventoryAlerts(),
        api.getInventorySettings(),
        api.getProductCategories(),
        api.getOutlets()
      ]);
      setProducts(productsRes.data);
      setStats(statsRes.data);
      setAlerts(alertsRes.data);
      setSettings(settingsRes.data);
      setCategories(categoriesRes.data);
      setOutlets(outletsRes.data);
    } catch (error) {
      console.error('Failed to fetch inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (data) => {
    try {
      await api.createProduct(data);
      setShowAddModal(false);
      fetchData();
    } catch (error) {
      console.error('Failed to create product:', error);
      alert(error.response?.data?.detail || 'Failed to create product');
    }
  };

  const handleUpdateProduct = async (data) => {
    try {
      await api.updateProduct(selectedProduct.id, data);
      setShowEditModal(false);
      setSelectedProduct(null);
      fetchData();
    } catch (error) {
      console.error('Failed to update product:', error);
      alert(error.response?.data?.detail || 'Failed to update product');
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.deleteProduct(id);
      fetchData();
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

  const handleAdjustStock = async (productId, quantity, reason) => {
    try {
      await api.adjustStock({ product_id: productId, quantity, reason });
      setShowStockModal(false);
      setSelectedProduct(null);
      fetchData();
    } catch (error) {
      console.error('Failed to adjust stock:', error);
      alert(error.response?.data?.detail || 'Failed to adjust stock');
    }
  };

  const handleUpdateSettings = async (data) => {
    try {
      await api.updateInventorySettings(data);
      setShowSettingsModal(false);
      fetchData();
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      await api.resolveInventoryAlert(alertId);
      fetchData();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{stats?.total_products || 0}</p>
              </div>
              <Package className="h-8 w-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inventory Value</p>
                <p className="text-2xl font-bold">₹{(stats?.total_value || 0).toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className={stats?.low_stock_count > 0 ? 'border-amber-500/50' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low Stock Items</p>
                <p className="text-2xl font-bold text-amber-500">{stats?.low_stock_count || 0}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-amber-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className={stats?.out_of_stock > 0 ? 'border-red-500/50' : ''}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold text-red-500">{stats?.out_of_stock || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Low Stock Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {alerts.slice(0, 5).map(alert => (
                <Badge key={alert.id} variant="outline" className="gap-2 py-1.5 border-amber-500/30">
                  <span>{alert.product_name}</span>
                  <span className="text-amber-500">({alert.current_quantity} left)</span>
                  <button onClick={() => handleResolveAlert(alert.id)} className="hover:text-red-500">
                    <X size={12} />
                  </button>
                </Badge>
              ))}
              {alerts.length > 5 && (
                <Badge variant="outline">+{alerts.length - 5} more</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-background border border-border"
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
          ))}
        </select>
        <Button variant="outline" onClick={() => setShowSettingsModal(true)}>
          <Settings size={16} className="mr-2" /> Settings
        </Button>
        <Button onClick={() => setShowAddModal(true)} className="cosmic-btn">
          <Plus size={16} className="mr-2" /> Add Product
        </Button>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Product</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">SKU</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Category</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Price</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Cost</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Stock</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Outlet</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => {
                  const isLowStock = product.stock_quantity <= product.reorder_level;
                  const isOutOfStock = product.stock_quantity === 0;
                  const outlet = outlets.find(o => o.id === product.outlet_id);
                  
                  return (
                    <tr key={product.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Box size={18} className="text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            {product.is_addon && (
                              <Badge variant="secondary" className="text-[10px]">Add-on</Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{product.sku}</td>
                      <td className="p-4">
                        <Badge variant="outline">{product.category}</Badge>
                      </td>
                      <td className="p-4 text-right font-medium">₹{product.price}</td>
                      <td className="p-4 text-right text-muted-foreground">₹{product.cost || 0}</td>
                      <td className="p-4">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`font-bold ${isOutOfStock ? 'text-red-500' : isLowStock ? 'text-amber-500' : ''}`}>
                            {product.stock_quantity}
                          </span>
                          <Progress 
                            value={Math.min((product.stock_quantity / (product.reorder_level * 3)) * 100, 100)} 
                            className="w-16 h-1.5"
                          />
                          {isOutOfStock && <Badge variant="destructive" className="text-[10px]">Out</Badge>}
                          {isLowStock && !isOutOfStock && <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-500">Low</Badge>}
                        </div>
                      </td>
                      <td className="p-4 text-sm">
                        {outlet ? outlet.name : <span className="text-muted-foreground">All Outlets</span>}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedProduct(product); setShowStockModal(true); }}
                            title="Adjust Stock"
                          >
                            <RefreshCw size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedProduct(product); setShowEditModal(true); }}
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id)}
                            className="hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      <Package size={40} className="mx-auto mb-2 opacity-20" />
                      <p>No products found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Product Modal */}
      {showAddModal && (
        <ProductModal
          title="Add Product"
          outlets={outlets}
          categories={categories}
          onSave={handleAddProduct}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Edit Product Modal */}
      {showEditModal && selectedProduct && (
        <ProductModal
          title="Edit Product"
          product={selectedProduct}
          outlets={outlets}
          categories={categories}
          onSave={handleUpdateProduct}
          onClose={() => { setShowEditModal(false); setSelectedProduct(null); }}
        />
      )}

      {/* Stock Adjustment Modal */}
      {showStockModal && selectedProduct && (
        <StockAdjustmentModal
          product={selectedProduct}
          onSave={handleAdjustStock}
          onClose={() => { setShowStockModal(false); setSelectedProduct(null); }}
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && settings && (
        <InventorySettingsModal
          settings={settings}
          onSave={handleUpdateSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </div>
  );
};

// Product Modal Component
const ProductModal = ({ title, product, outlets, categories, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    category: product?.category || 'general',
    description: product?.description || '',
    price: product?.price || 0,
    cost: product?.cost || 0,
    outlet_id: product?.outlet_id || '',
    stock_quantity: product?.stock_quantity || 0,
    reorder_level: product?.reorder_level || 10,
    is_addon: product?.is_addon ?? true,
    active: product?.active ?? true
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSave({
      ...formData,
      outlet_id: formData.outlet_id || null,
      price: parseFloat(formData.price),
      cost: parseFloat(formData.cost),
      stock_quantity: parseInt(formData.stock_quantity),
      reorder_level: parseInt(formData.reorder_level)
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Product Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="e.g., Premium Car Freshener"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="Auto-generated if empty"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-xl"
              >
                <option value="general">General</option>
                <option value="consumables">Consumables</option>
                <option value="accessories">Accessories</option>
                <option value="parts">Parts</option>
                <option value="retail">Retail</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Selling Price (₹) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Cost Price (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Stock Quantity</label>
              <input
                type="number"
                min="0"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Reorder Level</label>
              <input
                type="number"
                min="0"
                value={formData.reorder_level}
                onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Outlet</label>
              <select
                value={formData.outlet_id}
                onChange={(e) => setFormData({ ...formData, outlet_id: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-xl"
              >
                <option value="">All Outlets (Centralized)</option>
                {outlets.map(outlet => (
                  <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                rows={2}
                placeholder="Product description..."
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_addon}
                  onChange={(e) => setFormData({ ...formData, is_addon: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">Available as Add-on</span>
              </label>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm">Active</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <button type="submit" disabled={loading} className="cosmic-btn flex-1 py-2 rounded-xl font-semibold disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Stock Adjustment Modal
const StockAdjustmentModal = ({ product, onSave, onClose }) => {
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('adjustment');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (quantity === 0) return;
    setLoading(true);
    await onSave(product.id, parseInt(quantity), reason);
    setLoading(false);
  };

  const newStock = product.stock_quantity + parseInt(quantity || 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl w-full max-w-md">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold">Adjust Stock</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-center p-4 bg-accent/50 rounded-xl">
            <p className="text-sm text-muted-foreground">Product</p>
            <p className="font-bold text-lg">{product.name}</p>
            <p className="text-sm text-muted-foreground mt-2">Current Stock: <span className="font-bold">{product.stock_quantity}</span></p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Adjustment Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-center text-xl"
              placeholder="Enter + or - value"
            />
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Use positive numbers to add, negative to deduct
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl"
            >
              <option value="restock">Restock / Received</option>
              <option value="adjustment">Inventory Adjustment</option>
              <option value="damaged">Damaged / Expired</option>
              <option value="return">Customer Return</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="text-center p-3 bg-primary/10 rounded-xl">
            <p className="text-sm text-muted-foreground">New Stock Level</p>
            <p className={`font-bold text-2xl ${newStock < 0 ? 'text-red-500' : ''}`}>{newStock}</p>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <button 
              type="submit" 
              disabled={loading || quantity === 0 || newStock < 0} 
              className="cosmic-btn flex-1 py-2 rounded-xl font-semibold disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Confirm Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Inventory Settings Modal
const InventorySettingsModal = ({ settings, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    inventory_mode: settings.inventory_mode || 'centralized',
    low_stock_alerts: settings.low_stock_alerts ?? true,
    allow_customer_addons: settings.allow_customer_addons ?? false,
    default_reorder_level: settings.default_reorder_level || 10
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSave(formData);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl w-full max-w-md">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold">Inventory Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Inventory Mode</label>
            <select
              value={formData.inventory_mode}
              onChange={(e) => setFormData({ ...formData, inventory_mode: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl"
            >
              <option value="centralized">Centralized (Shared across all outlets)</option>
              <option value="outlet_specific">Outlet Specific (Each outlet has own stock)</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {formData.inventory_mode === 'centralized' 
                ? 'Products are shared across all outlets' 
                : 'Each outlet manages its own inventory'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Default Reorder Level</label>
            <input
              type="number"
              min="1"
              value={formData.default_reorder_level}
              onChange={(e) => setFormData({ ...formData, default_reorder_level: parseInt(e.target.value) })}
              className="w-full px-4 py-2 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-accent/50 rounded-xl">
              <input
                type="checkbox"
                checked={formData.low_stock_alerts}
                onChange={(e) => setFormData({ ...formData, low_stock_alerts: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <div>
                <span className="font-medium">Low Stock Alerts</span>
                <p className="text-xs text-muted-foreground">Get notified when products fall below reorder level</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-accent/50 rounded-xl">
              <input
                type="checkbox"
                checked={formData.allow_customer_addons}
                onChange={(e) => setFormData({ ...formData, allow_customer_addons: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <div>
                <span className="font-medium">Customer Add-ons</span>
                <p className="text-xs text-muted-foreground">Allow customers to add products during online booking</p>
              </div>
            </label>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <button type="submit" disabled={loading} className="cosmic-btn flex-1 py-2 rounded-xl font-semibold disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminInventory;
