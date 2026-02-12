import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  X, Package, Plus, Minus, Trash2, Search, ShoppingCart, AlertCircle, Check
} from 'lucide-react';

const BookingItemsModal = ({ booking, onClose, onSuccess }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.getProducts();
      setProducts(res.data || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const existingItems = booking?.items || [];
  const existingProductIds = existingItems.map(i => i.product_id);

  const addItem = (product) => {
    const existing = selectedItems.find(i => i.product_id === product.id);
    if (existing) {
      setSelectedItems(selectedItems.map(i => 
        i.product_id === product.id 
          ? { ...i, quantity: Math.min(i.quantity + 1, product.stock_quantity) }
          : i
      ));
    } else {
      setSelectedItems([...selectedItems, {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        quantity: 1,
        max_quantity: product.stock_quantity
      }]);
    }
  };

  const updateQuantity = (productId, newQty) => {
    if (newQty <= 0) {
      setSelectedItems(selectedItems.filter(i => i.product_id !== productId));
    } else {
      setSelectedItems(selectedItems.map(i => 
        i.product_id === productId 
          ? { ...i, quantity: Math.min(newQty, i.max_quantity) }
          : i
      ));
    }
  };

  const removeItem = (productId) => {
    setSelectedItems(selectedItems.filter(i => i.product_id !== productId));
  };

  const getItemTotal = () => {
    return selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSave = async () => {
    if (selectedItems.length === 0) {
      setError('Please select at least one item');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await api.addItemsToBooking(booking.id, {
        items: selectedItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity
        }))
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to add items');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveExistingItem = async (productId) => {
    try {
      await api.removeItemFromBooking(booking.id, productId);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove item');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#171C22] rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[#D9DEE5] dark:border-[#1F2630]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center">
              <ShoppingCart size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Add Products to Booking</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#7D8590]">
                {booking.customer} • {booking.date} • {booking.time}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg"
          >
            <X size={20} className="text-[#6B7280]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Product Selection */}
          <div className="flex-1 border-r border-[#D9DEE5] dark:border-[#1F2630] flex flex-col">
            <div className="p-4 border-b border-[#D9DEE5] dark:border-[#1F2630]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#0B0D10] text-[#0E1116] dark:text-[#E6E8EB] placeholder:text-[#6B7280]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading ? (
                <div className="text-center py-8 text-[#6B7280]">Loading products...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-[#6B7280]">No products found</div>
              ) : (
                filteredProducts.map(product => {
                  const isAlreadyInBooking = existingProductIds.includes(product.id);
                  const isSelected = selectedItems.find(i => i.product_id === product.id);
                  const isOutOfStock = product.stock_quantity <= 0;

                  return (
                    <div
                      key={product.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isAlreadyInBooking
                          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                          : isSelected
                          ? 'border-[#5FA8D3] bg-[#5FA8D3]/10'
                          : isOutOfStock
                          ? 'border-[#D9DEE5] dark:border-[#1F2630] opacity-50'
                          : 'border-[#D9DEE5] dark:border-[#1F2630] hover:border-[#5FA8D3]/50 cursor-pointer'
                      }`}
                      onClick={() => !isAlreadyInBooking && !isOutOfStock && addItem(product)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isAlreadyInBooking ? 'bg-green-100 dark:bg-green-900/30' : 'bg-[#ECEFF3] dark:bg-[#1F2630]'
                          }`}>
                            {isAlreadyInBooking ? (
                              <Check size={18} className="text-green-600 dark:text-green-400" />
                            ) : (
                              <Package size={18} className="text-[#6B7280]" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-[#0E1116] dark:text-[#E6E8EB]">{product.name}</div>
                            <div className="text-xs text-[#6B7280] dark:text-[#7D8590]">
                              {product.sku} • Stock: {product.stock_quantity}
                              {isAlreadyInBooking && ' (Already added)'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">₹{product.price}</div>
                          {isSelected && (
                            <div className="text-xs text-[#5FA8D3]">Qty: {isSelected.quantity}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cart / Selected Items */}
          <div className="w-80 flex flex-col bg-[#F6F7F9] dark:bg-[#0B0D10]">
            <div className="p-4 border-b border-[#D9DEE5] dark:border-[#1F2630]">
              <h4 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">Items to Add</h4>
            </div>

            {/* Existing Items */}
            {existingItems.length > 0 && (
              <div className="p-4 border-b border-[#D9DEE5] dark:border-[#1F2630]">
                <div className="text-xs font-medium text-[#6B7280] dark:text-[#7D8590] mb-2">EXISTING ITEMS</div>
                <div className="space-y-2">
                  {existingItems.map(item => (
                    <div key={item.product_id} className="flex items-center justify-between p-2 bg-white dark:bg-[#171C22] rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB]">{item.name}</div>
                        <div className="text-xs text-[#6B7280]">Qty: {item.quantity} × ₹{item.price}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#0E1116] dark:text-[#E6E8EB]">₹{item.subtotal}</span>
                        <button
                          onClick={() => handleRemoveExistingItem(item.product_id)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Items */}
            <div className="flex-1 overflow-y-auto p-4">
              {selectedItems.length === 0 ? (
                <div className="text-center py-8 text-[#6B7280] dark:text-[#7D8590]">
                  <ShoppingCart size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Click on products to add</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedItems.map(item => (
                    <div key={item.product_id} className="p-3 bg-white dark:bg-[#171C22] rounded-xl border border-[#D9DEE5] dark:border-[#1F2630]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-[#0E1116] dark:text-[#E6E8EB] text-sm">{item.name}</div>
                        <button
                          onClick={() => removeItem(item.product_id)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            className="w-7 h-7 rounded-lg bg-[#ECEFF3] dark:bg-[#1F2630] flex items-center justify-center hover:bg-[#D9DEE5] dark:hover:bg-[#2A313C]"
                          >
                            <Minus size={14} className="text-[#4B5563] dark:text-[#A9AFB8]" />
                          </button>
                          <span className="w-8 text-center font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            disabled={item.quantity >= item.max_quantity}
                            className="w-7 h-7 rounded-lg bg-[#ECEFF3] dark:bg-[#1F2630] flex items-center justify-center hover:bg-[#D9DEE5] dark:hover:bg-[#2A313C] disabled:opacity-50"
                          >
                            <Plus size={14} className="text-[#4B5563] dark:text-[#A9AFB8]" />
                          </button>
                        </div>
                        <div className="text-sm font-semibold text-[#5FA8D3]">
                          ₹{item.price * item.quantity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#D9DEE5] dark:border-[#1F2630] bg-white dark:bg-[#171C22]">
              {error && (
                <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
              
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#6B7280] dark:text-[#7D8590]">Items Total</span>
                <span className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">₹{getItemTotal()}</span>
              </div>
              
              <button
                onClick={handleSave}
                disabled={saving || selectedItems.length === 0}
                className="w-full py-2.5 rounded-xl font-semibold text-white bg-[#5FA8D3] hover:bg-[#4A95C0] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {saving ? (
                  'Adding...'
                ) : (
                  <>
                    <Plus size={18} />
                    Add Items to Booking
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingItemsModal;
