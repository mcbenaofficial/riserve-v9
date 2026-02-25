import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Store, CreditCard, Banknote, Plus, Minus, Search, Trash2, CheckCircle, PackageSearch } from 'lucide-react';
import { api } from '../services/api';

const POS = () => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [cart, setCart] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [isLoading, setIsLoading] = useState(true);
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [checkoutMethod, setCheckoutMethod] = useState('card');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            // Get all active products
            const response = await api.getProducts({ active_only: true });
            const fetchedProducts = response.data;
            setProducts(fetchedProducts);

            const cats = ['All', ...new Set(fetchedProducts.map(p => p.category))];
            setCategories(cats);
        } catch (error) {
            console.error('Failed to fetch products', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [products, searchQuery, selectedCategory]);

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);

            // Stock check in UI
            if (existing && existing.quantity >= product.stock_quantity) {
                // Can't add more than stock
                return prev;
            } else if (!existing && product.stock_quantity <= 0) {
                return prev;
            }

            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId, delta) => {
        setCart(prev => {
            return prev.map(item => {
                if (item.product.id === productId) {
                    const newQuantity = Math.max(0, item.quantity + delta);
                    // Check against max stock
                    if (newQuantity > item.product.stock_quantity) {
                        return item;
                    }
                    return { ...item, quantity: newQuantity };
                }
                return item;
            }).filter(item => item.quantity > 0);
        });
    };

    const cartTotal = useMemo(() => {
        return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
    }, [cart]);

    const handleCheckout = async () => {
        if (cart.length === 0) return;

        setIsSubmitting(true);
        try {
            const payload = {
                items: cart.map(item => ({
                    product_id: item.product.id,
                    quantity: item.quantity,
                    price: item.product.price
                })),
                payment_method: checkoutMethod
            };

            await api.processPOSCheckout(payload);

            // Success state
            setSuccessMessage('Transaction completed successfully!');
            setCart([]);
            fetchProducts(); // Refresh stock levels
            setIsCheckoutModalOpen(false);

            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Checkout failed', error);
            alert(error.response?.data?.detail || 'Checkout failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-8rem)] gap-6">

            {/* Left Area - Product Grid */}
            <div className="flex-1 flex flex-col bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl border border-[#D9DEE5] dark:border-[#1F2630] shadow-sm overflow-hidden">

                {/* Header and Controls */}
                <div className="p-6 border-b border-[#D9DEE5] dark:border-[#1F2630] space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center shadow-lg">
                            <Store size={20} className="text-[#222]" />
                        </div>
                        <h1 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Point of Sale</h1>
                    </div>

                    <div className="flex gap-4 items-center">
                        {/* Search Bar */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search products or scan barcode..."
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-[#2A303C] rounded-xl focus:ring-2 focus:ring-[#5FA8D3] outline-none text-gray-800 dark:text-gray-200 transition-all font-medium"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Categories */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${selectedCategory === cat
                                        ? 'bg-[#5FA8D3] text-black shadow-md'
                                        : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                    }`}
                            >
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <div className="w-8 h-8 rounded-full border-2 border-[#5FA8D3] border-t-transparent animate-spin mb-4" />
                            <p>Loading catalog...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <PackageSearch size={48} className="mb-4 opacity-50" />
                            <p>No products found.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredProducts.map(product => {
                                const inCart = cart.find(item => item.product.id === product.id)?.quantity || 0;
                                const isOutOfStock = product.stock_quantity <= 0;
                                const maxReached = inCart >= product.stock_quantity;

                                return (
                                    <button
                                        key={product.id}
                                        onClick={() => addToCart(product)}
                                        disabled={isOutOfStock || maxReached}
                                        className={`relative text-left p-4 rounded-2xl border transition-all duration-200 group flex flex-col justify-between h-40 ${isOutOfStock
                                                ? 'border-red-500/30 bg-red-500/5 cursor-not-allowed opacity-60'
                                                : maxReached
                                                    ? 'border-yellow-500/50 bg-yellow-500/10 cursor-not-allowed'
                                                    : 'border-[#D9DEE5] dark:border-[#2A303C] bg-white dark:bg-[#1A1E26] hover:border-[#5FA8D3] hover:shadow-lg dark:hover:bg-[#222730]'
                                            }`}
                                    >
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
                                                    {product.name}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 uppercase tracking-wider">
                                                {product.sku}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-end mt-4">
                                            <span className="text-lg font-bold text-[#5FA8D3]">
                                                ${product.price.toFixed(2)}
                                            </span>
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isOutOfStock ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                                                    : product.stock_quantity < 5 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400'
                                                        : 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400'
                                                }`}>
                                                {isOutOfStock ? 'Out' : `Stock: ${product.stock_quantity}`}
                                            </span>
                                        </div>

                                        {/* Cart Indicator */}
                                        {inCart > 0 && (
                                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#5FA8D3] text-black text-xs font-bold rounded-full flex items-center justify-center shadow-md">
                                                {inCart}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Area - Cart */}
            <div className="w-96 flex flex-col bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl border border-[#D9DEE5] dark:border-[#1F2630] shadow-sm overflow-hidden">

                <div className="p-6 border-b border-[#D9DEE5] dark:border-[#1F2630] bg-gray-50/50 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                        <ShoppingCart size={22} className="text-[#5FA8D3]" />
                        <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Current Order</h2>
                    </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
                            <ShoppingCart size={48} className="mb-4" />
                            <p>Cart is empty</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.product.id} className="flex flex-col gap-2 p-3 rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-[#2A303C]">
                                <div className="flex justify-between items-start">
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{item.product.name}</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        ${(item.product.price * item.quantity).toFixed(2)}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-sm text-gray-500">${item.product.price.toFixed(2)} / each</span>

                                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#1A1E26] rounded-lg p-1 border border-gray-200 dark:border-[#2A303C]">
                                        <button
                                            onClick={() => updateQuantity(item.product.id, -1)}
                                            className="p-1 rounded text-gray-500 hover:text-red-500 hover:bg-gray-200 dark:hover:bg-[#2A303C] transition-colors"
                                        >
                                            {item.quantity === 1 ? <Trash2 size={16} /> : <Minus size={16} />}
                                        </button>
                                        <span className="font-semibold w-6 text-center text-gray-800 dark:text-gray-200">{item.quantity}</span>
                                        <button
                                            onClick={() => updateQuantity(item.product.id, 1)}
                                            disabled={item.quantity >= item.product.stock_quantity}
                                            className="p-1 rounded text-gray-500 hover:text-green-500 hover:bg-gray-200 dark:hover:bg-[#2A303C] transition-colors disabled:opacity-30 disabled:hover:text-gray-500"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Checkout Footer */}
                <div className="p-6 border-t border-[#D9DEE5] dark:border-[#1F2630] bg-gray-50/80 dark:bg-black/20">
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-lg text-gray-600 dark:text-gray-400 font-medium">Total</span>
                        <span className="text-3xl font-bold tracking-tight text-[#0E1116] dark:text-white">
                            ${cartTotal.toFixed(2)}
                        </span>
                    </div>

                    <button
                        onClick={() => setIsCheckoutModalOpen(true)}
                        disabled={cart.length === 0}
                        className="w-full py-4 bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0] hover:from-[#4A95C0] hover:to-[#3882B0] text-black font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        Charge ${(cartTotal).toFixed(2)}
                    </button>
                </div>
            </div>

            {/* Checkout Modal */}
            {isCheckoutModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-[#14171C] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-[#D9DEE5] dark:border-[#2A303C]">
                        <div className="p-6 border-b border-[#D9DEE5] dark:border-[#2A303C]">
                            <h3 className="text-2xl font-bold text-center text-gray-900 dark:text-white">Complete Transaction</h3>
                            <p className="text-center text-gray-500 dark:text-gray-400 mt-2">Total Amount Due</p>
                            <div className="text-5xl font-bold text-center mt-2 text-[#5FA8D3]">${cartTotal.toFixed(2)}</div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setCheckoutMethod('card')}
                                    className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${checkoutMethod === 'card'
                                            ? 'border-[#5FA8D3] bg-[#5FA8D3]/10 text-[#5FA8D3]'
                                            : 'border-gray-200 dark:border-[#2A303C] text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                >
                                    <CreditCard size={32} />
                                    <span className="font-semibold">Credit/Debit</span>
                                </button>
                                <button
                                    onClick={() => setCheckoutMethod('cash')}
                                    className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${checkoutMethod === 'cash'
                                            ? 'border-green-500 bg-green-500/10 text-green-500'
                                            : 'border-gray-200 dark:border-[#2A303C] text-gray-500 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                >
                                    <Banknote size={32} />
                                    <span className="font-semibold">Cash</span>
                                </button>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setIsCheckoutModalOpen(false)}
                                    className="flex-1 py-3 px-4 rounded-xl font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCheckout}
                                    disabled={isSubmitting}
                                    className="flex-1 py-3 px-4 rounded-xl font-semibold bg-[#5FA8D3] hover:bg-[#4A95C0] text-black shadow-lg transition-colors flex justify-center items-center"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                                    ) : (
                                        'Complete Payment'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Toast */}
            {successMessage && (
                <div className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce-in z-50">
                    <CheckCircle size={24} />
                    <span className="font-semibold">{successMessage}</span>
                </div>
            )}
        </div>
    );
};

export default POS;
