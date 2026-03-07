import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { X, FolderTree } from 'lucide-react';

const EditCategoryModal = ({ isOpen, onClose, onSuccess, category }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (category) {
            setFormData({
                name: category.name || '',
                description: category.description || ''
            });
        }
    }, [category]);

    if (!isOpen || !category) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (!formData.name) throw new Error('Category name is required');

            await api.updateServiceCategory(category.id, {
                name: formData.name,
                description: formData.description
            });
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Failed to update category');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#1A1F26] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-[#1F2630]">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-[#1F2630] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <FolderTree size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">Edit Category</h2>
                            <p className="text-sm text-gray-500 dark:text-[#7D8590]">Update service group</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors text-gray-500 dark:text-[#7D8590]">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-500/20">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-[#E6E8EB] mb-1.5">Category Name *</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-[#E6E8EB] mb-1.5">Description (Optional)</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all outline-none resize-none"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-700 dark:text-[#E6E8EB] bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl font-semibold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-[#5FA8D3] hover:bg-[#4A95C0] text-gray-900 font-semibold rounded-xl transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditCategoryModal;
