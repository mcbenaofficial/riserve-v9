import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Car, MapPin, Star, Sun, Droplet, Plus, Pencil, Trash2 } from 'lucide-react';
import AddOutletModal from '../components/AddOutletModal';
import EditOutletModal from '../components/EditOutletModal';

const Outlets = () => {
  const [outlets, setOutlets] = useState([]);
  const [filteredOutlets, setFilteredOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchOutlets();
  }, []);

  useEffect(() => {
    filterOutlets();
  }, [outlets, query]);

  const fetchOutlets = async () => {
    try {
      const response = await api.getOutlets();
      setOutlets(response.data);
    } catch (error) {
      console.error('Failed to fetch outlets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterOutlets = () => {
    if (query) {
      setFilteredOutlets(
        outlets.filter(
          (o) =>
            o.name.toLowerCase().includes(query.toLowerCase()) ||
            o.city.toLowerCase().includes(query.toLowerCase())
        )
      );
    } else {
      setFilteredOutlets(outlets);
    }
  };

  const handleEdit = (outlet) => {
    setSelectedOutlet(outlet);
    setShowEditModal(true);
  };

  const handleDelete = async (outlet) => {
    if (!window.confirm(`Are you sure you want to delete "${outlet.name}"?`)) {
      return;
    }
    
    setDeleting(outlet.id);
    try {
      await api.deleteOutlet(outlet.id);
      await fetchOutlets();
    } catch (error) {
      console.error('Failed to delete outlet:', error);
      alert('Failed to delete outlet');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-[#4B5563] dark:text-[#7D8590]">Loading outlets...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Outlets</h2>
            <p className="text-sm text-[#4B5563] dark:text-[#7D8590] mt-1">
              {filteredOutlets.length} outlets found
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              data-testid="add-outlet-btn"
              className="px-4 py-2 rounded-xl font-semibold text-[#222] transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
            >
              <Plus size={20} />
              Add Outlet
            </button>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search outlets by name or city..."
              className="px-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-[#0E1116] dark:text-[#E6E8EB] placeholder:text-[#6B7280] dark:placeholder:text-white/40 focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all backdrop-blur-sm"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOutlets.map((o) => (
          <div
            key={o.id}
            className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630] hover:shadow-2xl transition-all transform hover:scale-[1.02] hover:border-[#D9DEE5] dark:hover:border-[#1F2630]"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-1">{o.name}</h3>
                <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">{o.address}</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${
                  o.status === 'Active'
                    ? 'bg-green-100 dark:bg-green-500/20 border border-green-300 dark:border-green-500/30 text-green-700 dark:text-green-400'
                    : 'bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/30 text-red-700 dark:text-red-400'
                }`}
              >
                {o.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <InfoBadge label="Machines" value={o.machines} icon={Car} />
              <InfoBadge label="Capacity" value={o.capacity} icon={MapPin} />
              <InfoBadge label="Rating" value={o.rating} icon={Star} />
              <InfoBadge label="City" value={o.city} icon={MapPin} />
            </div>

            <div className="flex items-center gap-2 mb-4">
              {o.solar && (
                <span className="px-2 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-500/30 rounded-lg text-xs font-medium flex items-center gap-1 backdrop-blur-sm">
                  <Sun size={14} /> Solar
                </span>
              )}
              {o.water_recycle && (
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30 rounded-lg text-xs font-medium flex items-center gap-1 backdrop-blur-sm">
                  <Droplet size={14} /> Water Recycle
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => handleEdit(o)}
                data-testid={`edit-outlet-${o.id}`}
                className="flex-1 py-2 rounded-xl font-semibold text-[#222] transition-all hover:scale-[1.02] shadow-lg flex items-center justify-center gap-2" 
                style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
              >
                <Pencil size={16} />
                Edit
              </button>
              <button 
                onClick={() => handleDelete(o)}
                disabled={deleting === o.id}
                data-testid={`delete-outlet-${o.id}`}
                className="px-4 py-2 border border-red-300 dark:border-red-400/30 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all backdrop-blur-sm disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 size={16} />
                {deleting === o.id ? '...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Outlet Modal */}
      <AddOutletModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchOutlets}
      />

      {/* Edit Outlet Modal */}
      <EditOutletModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedOutlet(null);
        }}
        onSuccess={fetchOutlets}
        outlet={selectedOutlet}
      />
    </div>
  );
};

const InfoBadge = ({ label, value, icon: Icon }) => (
  <div className="bg-[#ECEFF3] dark:bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-[#D9DEE5] dark:border-[#1F2630]">
    <div className="flex items-center gap-1 text-xs text-[#4B5563] dark:text-[#7D8590] mb-1">
      <Icon size={14} />
      <span>{label}</span>
    </div>
    <div className="text-sm font-bold text-[#0E1116] dark:text-[#E6E8EB]">{value}</div>
  </div>
);

export default Outlets;
