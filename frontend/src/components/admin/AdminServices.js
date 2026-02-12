import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Pencil, Trash2, Search, Clock, DollarSign } from 'lucide-react';
import AddServiceModal from '../AddServiceModal';
import EditServiceModal from '../EditServiceModal';

const AdminServices = () => {
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
      setFilteredServices(services.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())));
    } else {
      setFilteredServices(services);
    }
  };

  const handleEdit = (service) => {
    setSelectedService(service);
    setShowEditModal(true);
  };

  const handleDelete = async (service) => {
    if (!window.confirm(`Delete "${service.name}"?`)) return;
    setDeleting(service.id);
    try {
      await api.deleteService(service.id);
      await fetchServices();
    } catch (error) {
      alert('Failed to delete service');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-[#7D8590]">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">Services Management</h2>
          <p className="text-sm text-gray-600 dark:text-[#7D8590]">{filteredServices.length} services</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services..."
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] placeholder:text-gray-400 focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all w-64"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl font-semibold text-[#222] transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
          >
            <Plus size={18} />
            Add Service
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-[#1F2630]">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#7D8590] uppercase">Service</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-[#7D8590] uppercase">Duration</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-[#7D8590] uppercase">Price</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-[#7D8590] uppercase">Status</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-[#7D8590] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/10">
            {filteredServices.map((s) => (
              <tr key={s.id} className="hover:bg-[#5FA8D3]/5 dark:hover:bg-[#5FA8D3]/10 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-sm font-semibold text-gray-900 dark:text-[#E6E8EB]">{s.name}</div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-sm text-gray-600 dark:text-[#E6E8EB]/70">
                    <Clock size={14} />
                    {s.duration_min} mins
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-sm font-bold text-gray-900 dark:text-[#E6E8EB]">
                    <DollarSign size={14} />
                    ₹{s.price}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    s.active
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                  }`}>
                    {s.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => handleEdit(s)} className="p-2 hover:bg-gray-100 dark:hover:bg-[#1F2630] rounded-lg transition-all">
                      <Pencil size={16} className="text-gray-600 dark:text-[#7D8590]" />
                    </button>
                    <button onClick={() => handleDelete(s)} disabled={deleting === s.id} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-50">
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddServiceModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={fetchServices} />
      <EditServiceModal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedService(null); }} onSuccess={fetchServices} service={selectedService} />
    </div>
  );
};

export default AdminServices;
