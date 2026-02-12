import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import AddServiceModal from '../components/AddServiceModal';
import EditServiceModal from '../components/EditServiceModal';

const Services = () => {
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    filterServices();
  }, [services, query]);

  const fetchServices = async () => {
    try {
      const response = await api.getServices();
      setServices(response.data);
    } catch (error) {
      console.error('Failed to fetch services:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterServices = () => {
    if (query) {
      setFilteredServices(
        services.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
      );
    } else {
      setFilteredServices(services);
    }
  };

  const handleEdit = (service) => {
    setSelectedService(service);
    setShowEditModal(true);
  };

  const handleDelete = async (service) => {
    if (!window.confirm(`Are you sure you want to delete "${service.name}"?`)) {
      return;
    }

    setDeleting(service.id);
    try {
      await api.deleteService(service.id);
      await fetchServices();
    } catch (error) {
      console.error('Failed to delete service:', error);
      alert('Failed to delete service');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-[#4B5563] dark:text-[#7D8590]">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-3xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB] text-gradient-pro">Services</h2>
            <p className="text-sm text-[#4B5563] dark:text-[#9CA3AF] mt-1">
              {filteredServices.length} services available
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              data-testid="add-service-btn"
              className="px-4 py-2 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg hover:shadow-purple-500/20"
              style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)' }}
            >
              <Plus size={20} />
              Add Service
            </button>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services..."
              className="px-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-[#0E1116] dark:text-[#E6E8EB] placeholder:text-[#6B7280] dark:placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all backdrop-blur-sm"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((s) => (
          <div
            key={s.id}
            className="glass-panel p-6 rounded-3xl hover:border-purple-500/30 transition-all duration-300 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-2 group-hover:text-purple-400 transition-colors">{s.name}</h3>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${s.active
                  ? 'bg-green-500/10 border border-green-500/20 text-green-500'
                  : 'bg-white/5 border border-[#1F2630] text-[#7D8590]'
                  }`}
              >
                {s.active ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-[#1F2630]">
                <span className="text-sm text-[#4B5563] dark:text-[#9CA3AF]">⏱️ Duration</span>
                <span className="text-sm font-bold text-[#0E1116] dark:text-[#E6E8EB]">{s.duration_min} mins</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-[#1F2630] bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                <span className="text-sm text-[#4B5563] dark:text-[#E6E8EB]/70">💰 Price</span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400">₹{s.price}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(s)}
                data-testid={`edit-service-${s.id}`}
                className="flex-1 py-2 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] shadow-lg flex items-center justify-center gap-2 hover:shadow-purple-500/20"
                style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)' }}
              >
                <Pencil size={16} />
                Edit
              </button>
              <button
                onClick={() => handleDelete(s)}
                disabled={deleting === s.id}
                data-testid={`delete-service-${s.id}`}
                className="px-4 py-2 border border-red-500/30 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all backdrop-blur-sm disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 size={16} />
                {deleting === s.id ? '...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Service Modal */}
      <AddServiceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchServices}
      />

      {/* Edit Service Modal */}
      <EditServiceModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedService(null);
        }}
        onSuccess={fetchServices}
        service={selectedService}
      />
    </div>
  );
};

export default Services;
