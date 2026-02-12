import React, { useState, useEffect } from 'react';
import { X, Wrench, Clock, DollarSign, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '../services/api';

const EditServiceModal = ({ isOpen, onClose, onSuccess, service }) => {
  const [formData, setFormData] = useState({
    name: '',
    duration_min: 30,
    price: 299,
    active: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && service) {
      setFormData({
        name: service.name || '',
        duration_min: service.duration_min || 30,
        price: service.price || 299,
        active: service.active !== undefined ? service.active : true
      });
      setError('');
    }
  }, [isOpen, service]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Service name is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await api.updateService(service.id, formData);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update service');
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center">
              <Wrench size={20} className="text-white" />
            </div>
            <h3 className="text-xl font-bold text-[#E6E8EB]">Edit Service</h3>
          </div>
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

          {/* Service Name */}
          <div>
            <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
              <Wrench size={14} className="inline mr-1" />
              Service Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-[#E6E8EB] placeholder:text-[#4B5563] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
              placeholder="e.g., Premium Service"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
              <Clock size={14} className="inline mr-1" />
              Duration (minutes)
            </label>
            <input
              type="number"
              required
              min="5"
              max="240"
              value={formData.duration_min}
              onChange={(e) => setFormData({ ...formData, duration_min: parseInt(e.target.value) || 30 })}
              className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-[#E6E8EB] placeholder:text-[#4B5563] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
              <DollarSign size={14} className="inline mr-1" />
              Price (₹)
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-[#E6E8EB] placeholder:text-[#4B5563] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
            />
          </div>

          {/* Active Status */}
          <div>
            <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
              Status
            </label>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, active: !formData.active })}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                formData.active
                  ? 'bg-green-900/30 border-green-700'
                  : 'bg-[#0B0D10] border-[#1F2630]'
              }`}
            >
              <span className={`font-medium ${formData.active ? 'text-green-400' : 'text-[#7D8590]'}`}>
                {formData.active ? 'Active' : 'Inactive'}
              </span>
              {formData.active ? (
                <ToggleRight size={24} className="text-green-400" />
              ) : (
                <ToggleLeft size={24} className="text-[#7D8590]" />
              )}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-[#1F2630] rounded-xl text-[#A9AFB8] hover:bg-[#1F2630] transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="cosmic-btn flex-1 px-4 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditServiceModal;
