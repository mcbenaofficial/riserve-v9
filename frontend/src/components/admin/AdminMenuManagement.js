import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Plus, Edit, Trash2, Search, Link as LinkIcon, 
  Image as ImageIcon, Loader2, AlertCircle, CheckCircle2, Package, X, UploadCloud
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, 
  DialogTitle, DialogFooter 
} from '../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';

const AdminMenuManagement = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Food',
    price: '',
    image_url: '',
    image_urls: [],
    is_available: true,
    inventory_linked: false,
    inventory_product_id: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [menuRes, invRes] = await Promise.all([
        api.getMenuItems(),
        api.getProducts().catch(() => ({ data: [] }))
      ]);
      setMenuItems(menuRes.data || []);
      setInventoryProducts(invRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item = null) => {
    setSelectedFiles([]);
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name || '',
        description: item.description || '',
        category: item.category || 'Food',
        price: item.price || '',
        image_url: item.image_url || '',
        image_urls: item.image_urls || [],
        is_available: item.is_available ?? true,
        inventory_linked: item.inventory_linked ?? false,
        inventory_product_id: item.inventory_product_id || 'auto_create'
      });
      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        category: 'Food',
        price: '',
        image_url: '',
        image_urls: [],
        is_available: true,
        inventory_linked: false,
        inventory_product_id: 'auto_create'
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.price || !formData.category) return;
    
    setSaving(true);
    try {
      let finalImageUrls = [...(formData.image_urls || [])];
      
      if (selectedFiles.length > 0) {
        const uploadData = new FormData();
        selectedFiles.forEach(file => {
          uploadData.append('files', file);
        });
        const uploadRes = await api.uploadFiles(uploadData);
        if (uploadRes.data && uploadRes.data.urls) {
           finalImageUrls = [...finalImageUrls, ...uploadRes.data.urls];
        }
      }

      const payload = {
        ...formData,
        image_urls: finalImageUrls,
        price: parseFloat(formData.price) || 0,
        inventory_product_id: formData.inventory_linked && formData.inventory_product_id !== 'auto_create' ? (formData.inventory_product_id || null) : null
      };

      if (editingItem) {
        await api.updateMenuItem(editingItem.id, payload);
      } else {
        await api.createMenuItem(payload);
      }
      
      await fetchData();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save menu item:', error);
      alert('Failed to save menu item. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;
    
    try {
      await api.deleteMenuItem(id);
      setMenuItems(menuItems.filter(item => item.id !== id));
    } catch (error) {
      console.error('Failed to delete menu item:', error);
    }
  };

  const filteredItems = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = [...new Set(menuItems.map(item => item.category))];
  // Add some defaults if empty
  if (categories.length === 0) categories.push('Coffee', 'Food', 'Add-ons');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Menu Management</h2>
            <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">Manage your restaurant offerings and map to inventory products.</p>
          </div>
          <Button 
            onClick={() => handleOpenModal()} 
            className="bg-purple-600 hover:bg-purple-700 text-white border-0 shadow-lg shadow-purple-500/30"
          >
            <Plus size={16} className="mr-2" />
            Add Menu Item
          </Button>
        </div>

        <div className="relative mb-6 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input 
            placeholder="Search menu items..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-50 dark:bg-[#12161C] border-[#D9DEE5] dark:border-[#1F2630]"
          />
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-[#1F2630] rounded-xl">
            <ImageIcon className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-[#E6E8EB]">No menu items found</h3>
            <p className="text-sm text-gray-500 mt-1">Get started by creating your first menu item.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <div 
                key={item.id} 
                className="group p-4 bg-white dark:bg-[#171C22] rounded-xl border border-gray-100 dark:border-[#1F2630] hover:shadow-lg transition-all"
              >
                <div className="flex gap-4">
                  <div className="w-20 h-20 rounded-lg bg-gray-100 dark:bg-[#12161C] flex-shrink-0 overflow-hidden border border-gray-200 dark:border-[#1F2630] flex items-center justify-center">
                    {(item.image_urls?.[0] || item.image_url) ? (
                      <img src={item.image_urls?.[0] || item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={24} className="text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-gray-900 dark:text-[#E6E8EB] truncate pr-2">{item.name}</h3>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">₹{item.price}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2 truncate max-w-full">{item.description || 'No description'}</p>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-auto">
                      <Badge variant="outline" className="text-[10px] uppercase font-semibold text-gray-500 border-gray-200 dark:border-[#1F2630]">
                        {item.category}
                      </Badge>
                      {!item.is_available && (
                        <Badge variant="destructive" className="text-[10px]">Sold Out</Badge>
                      )}
                      {item.inventory_linked && (
                        <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-0 flex items-center gap-1 text-[10px]">
                          <LinkIcon size={10} /> Linked
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Actions overlay */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#1F2630] flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenModal(item)} className="h-8 text-gray-500 hover:text-purple-600">
                    <Edit size={14} className="mr-1.5" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="h-8 text-gray-500 hover:text-red-600">
                    <Trash2 size={14} className="mr-1.5" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-[#171C22] border-gray-200 dark:border-[#1F2630]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Menu Item' : 'New Menu Item'}</DialogTitle>
            <DialogDescription>
              Details will be visible on your digital menu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Item Name <span className="text-red-500">*</span></Label>
                <Input 
                  placeholder="e.g. Avocado Toast" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="bg-gray-50 dark:bg-[#12161C] dark:border-[#1F2630]"
                />
              </div>
              <div className="space-y-2">
                <Label>Price (₹) <span className="text-red-500">*</span></Label>
                <Input 
                  type="number"
                  placeholder="0.00" 
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                  className="bg-gray-50 dark:bg-[#12161C] dark:border-[#1F2630]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category <span className="text-red-500">*</span></Label>
              <Input 
                  placeholder="e.g. Coffee, Main Course, Dessert" 
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="bg-gray-50 dark:bg-[#12161C] dark:border-[#1F2630]"
                />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input 
                  placeholder="Brief description for the customer" 
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="bg-gray-50 dark:bg-[#12161C] dark:border-[#1F2630]"
                />
            </div>

            <div className="space-y-2">
              <Label>Images</Label>
              <div className="border-2 border-dashed border-gray-200 dark:border-[#1F2630] rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-[#12161C] transition-colors" onClick={() => document.getElementById('file-upload').click()}>
                <UploadCloud className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">Click to upload images</p>
                <input 
                  id="file-upload" 
                  type="file" 
                  multiple 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files) {
                      setSelectedFiles([...selectedFiles, ...Array.from(e.target.files)]);
                    }
                  }}
                />
              </div>
              
              {/* Image Previews */}
              {(formData.image_urls?.length > 0 || selectedFiles.length > 0) && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {formData.image_urls?.map((url, i) => (
                    <div key={`url-${i}`} className="relative w-16 h-16 rounded overflow-hidden border">
                      <img src={url} alt={`img-${i}`} className="w-full h-full object-cover" />
                      <button 
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newUrls = [...formData.image_urls];
                          newUrls.splice(i, 1);
                          setFormData({...formData, image_urls: newUrls});
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {selectedFiles.map((file, i) => (
                    <div key={`file-${i}`} className="relative w-16 h-16 rounded overflow-hidden border">
                      <img src={URL.createObjectURL(file)} alt={`new-${i}`} className="w-full h-full object-cover" />
                      <button 
                        className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newFiles = [...selectedFiles];
                          newFiles.splice(i, 1);
                          setSelectedFiles(newFiles);
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-[#12161C] rounded-lg p-4 space-y-4 border border-gray-100 dark:border-[#1F2630]">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Available for Sale</Label>
                  <p className="text-xs text-gray-500">Allow customers to order this item.</p>
                </div>
                <Switch 
                  checked={formData.is_available} 
                  onCheckedChange={(c) => setFormData({...formData, is_available: c})} 
                />
              </div>

              <div className="border-t border-gray-200 dark:border-[#1F2630] pt-4 flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Package size={16} /> Link to Inventory
                  </Label>
                  <p className="text-xs text-gray-500">
                    Auto-trigger sold out status when stock drops to 0. 
                  </p>
                </div>
                <Switch 
                  checked={formData.inventory_linked} 
                  onCheckedChange={(c) => setFormData({...formData, inventory_linked: c, inventory_product_id: c ? formData.inventory_product_id || 'auto_create' : 'auto_create'})} 
                />
              </div>

              {formData.inventory_linked && (
                <div className="pt-2 animate-in slide-in-from-top-2">
                  <Label className="text-xs mb-1.5 block text-gray-500">Select Existing Product (Optional)</Label>
                  <Select 
                    value={formData.inventory_product_id || 'auto_create'} 
                    onValueChange={(val) => setFormData({...formData, inventory_product_id: val})}
                  >
                    <SelectTrigger className="bg-white dark:bg-[#171C22]">
                      <SelectValue placeholder="Auto-create new product if left blank" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto_create">Auto-create new product</SelectItem>
                      {inventoryProducts.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name} ({p.stock_quantity} in stock)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                    <AlertCircle size={10} /> If left blank, a new inventory item will be created upon saving.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formData.name || !formData.price || !formData.category} className="bg-purple-600 hover:bg-purple-700 text-white">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingItem ? 'Save Changes' : 'Create Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMenuManagement;
