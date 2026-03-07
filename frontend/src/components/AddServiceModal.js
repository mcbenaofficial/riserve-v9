import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';

const AddServiceModal = ({ isOpen, onClose, onSuccess, categories = [] }) => {
  const [formData, setFormData] = useState({
    name: '',
    duration_min: 30,
    price: 299,
    category_id: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.createService({
        ...formData,
        category_id: formData.category_id || null
      });
      onSuccess();
      onClose();
      setFormData({
        name: '',
        duration_min: 30,
        price: 299,
        category_id: '',
        description: ''
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create service');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#171C22] backdrop-blur-xl rounded-3xl border border-[#1F2630] max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1F2630]">
          <h3 className="text-xl font-bold text-white">Add New Service</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1F2630] rounded-xl transition-all"
          >
            <X size={20} className="text-[#7D8590]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
              Service Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-white placeholder:text-[#4B5563] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
              placeholder="e.g., Premium Wash"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
              Category (Optional)
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-white focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all outline-none"
            >
              <option value="">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
                Duration (mins)
              </label>
              <input
                type="number"
                min="5"
                step="5"
                required
                value={formData.duration_min}
                onChange={(e) => setFormData({ ...formData, duration_min: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-white focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
                Price (₹)
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-white focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-white placeholder:text-[#4B5563] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all resize-none"
              rows="3"
              placeholder="Describe the service..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-[#1F2630] rounded-xl text-white hover:bg-[#1F2630] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="cosmic-btn flex-1 px-4 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddServiceModal;
