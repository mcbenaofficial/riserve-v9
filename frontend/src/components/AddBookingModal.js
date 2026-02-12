import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';

const AddBookingModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    customer: '',
    time: '',
    service_id: '',
    outlet_id: '',
    amount: 0
  });
  const [services, setServices] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldConfig, setFieldConfig] = useState([]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    try {
      const [servicesRes, outletsRes, fieldsRes] = await Promise.all([
        api.getServices(),
        api.getOutlets(),
        api.getBookingFieldsConfig()
      ]);
      setServices(servicesRes.data.filter(s => s.active));
      setOutlets(outletsRes.data.filter(o => o.status === 'Active'));
      setFieldConfig(fieldsRes.data.fields || []);
    } catch (err) {
      setError('Failed to load data');
    }
  };

  const handleServiceChange = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    setFormData({
      ...formData,
      service_id: serviceId,
      amount: service ? service.price : 0
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.createBooking(formData);
      onSuccess();
      onClose();
      setFormData({
        customer: '',
        time: '',
        service_id: '',
        outlet_id: '',
        amount: 0
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create booking');
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
          <h3 className="text-xl font-bold text-white">Add New Booking</h3>
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
              Customer Name
            </label>
            <input
              type="text"
              required
              value={formData.customer}
              onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
              className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-white placeholder:text-[#4B5563] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
              placeholder="Enter customer name"
            />
          </div>



          <div>
            <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
              Outlet
            </label>
            <select
              required
              value={formData.outlet_id}
              onChange={(e) => setFormData({ ...formData, outlet_id: e.target.value })}
              className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-white focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
            >
              <option value="">Select outlet</option>
              {outlets.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
              Service
            </label>
            <select
              required
              value={formData.service_id}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-white focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
            >
              <option value="">Select service</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name} - ₹{s.price}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
              Time
            </label>
            <input
              type="time"
              required
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-white focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
              Amount
            </label>
            <div className="text-2xl font-bold text-white">₹{formData.amount}</div>
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
              {loading ? 'Creating...' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBookingModal;
