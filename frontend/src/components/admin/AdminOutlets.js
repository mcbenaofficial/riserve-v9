import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Pencil, Trash2, Search, MapPin } from 'lucide-react';
import AddOutletModal from '../AddOutletModal';
import EditOutletModal from '../EditOutletModal';

const AdminOutlets = () => {
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
      setFilteredOutlets(outlets.filter((o) => 
        o.name.toLowerCase().includes(query.toLowerCase()) || 
        o.city.toLowerCase().includes(query.toLowerCase())
      ));
    } else {
      setFilteredOutlets(outlets);
    }
  };

  const handleEdit = (outlet) => {
    setSelectedOutlet(outlet);
    setShowEditModal(true);
  };

  const handleDelete = async (outlet) => {
    if (!window.confirm(`Delete "${outlet.name}"?`)) return;
    setDeleting(outlet.id);
    try {
      await api.deleteOutlet(outlet.id);
      await fetchOutlets();
    } catch (error) {
      alert('Failed to delete outlet');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#6B7280] dark:text-[#7D8590]">Loading outlets...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Outlets Management</h2>
          <p className="text-sm text-[#6B7280] dark:text-[#7D8590]">{filteredOutlets.length} outlets</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search outlets..."
              className="pl-10 pr-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#0B0D10] text-[#0E1116] dark:text-[#E6E8EB] placeholder:text-[#6B7280] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all w-64"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl font-semibold text-[#222] transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
          >
            <Plus size={18} />
            Add Outlet
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#171C22] rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#F6F7F9] dark:bg-[#0B0D10] border-b border-[#D9DEE5] dark:border-[#1F2630]">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase">Outlet</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase">City</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase">Resources</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase">Status</th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D9DEE5] dark:divide-[#1F2630]">
            {filteredOutlets.map((o) => (
              <tr key={o.id} className="hover:bg-[#5FA8D3]/5 dark:hover:bg-[#5FA8D3]/10 transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{o.name}</div>
                    <div className="text-xs text-[#6B7280] dark:text-[#7D8590]">{o.address}</div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-sm text-[#4B5563] dark:text-[#A9AFB8]">
                    <MapPin size={14} />
                    {o.city}
                  </div>
                </td>
                <td className="px-6 py-4 text-center text-sm text-[#0E1116] dark:text-[#E6E8EB]">
                  {o.resources?.length || o.capacity || 0} {o.resource_label_plural || 'resources'}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    o.status === 'Active'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => handleEdit(o)} className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg transition-all">
                      <Pencil size={16} className="text-[#6B7280] dark:text-[#7D8590]" />
                    </button>
                    <button onClick={() => handleDelete(o)} disabled={deleting === o.id} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-50">
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddOutletModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={fetchOutlets} />
      <EditOutletModal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedOutlet(null); }} onSuccess={fetchOutlets} outlet={selectedOutlet} />
    </div>
  );
};

export default AdminOutlets;
