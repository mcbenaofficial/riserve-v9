import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Pencil, Trash2, Search, Clock, DollarSign, FolderTree } from 'lucide-react';
import AddServiceModal from '../AddServiceModal';
import EditServiceModal from '../EditServiceModal';
import AddCategoryModal from './AddCategoryModal';
import EditCategoryModal from './EditCategoryModal';

const AdminServices = () => {
  const [activeTab, setActiveTab] = useState('services'); // services, categories
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);

  // Editing state
  const [selectedService, setSelectedService] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterServices();
  }, [services, query]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [servicesRes, categoriesRes] = await Promise.all([
        api.getServices(),
        api.getServiceCategories()
      ]);
      setServices(servicesRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterItems = () => {
    if (activeTab === 'services') {
      if (query) {
        setFilteredServices(services.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())));
      } else {
        setFilteredServices(services);
      }
    } else {
      if (query) {
        setFilteredCategories(categories.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())));
      } else {
        setFilteredCategories(categories);
      }
    }
  };

  useEffect(() => {
    filterItems();
  }, [services, categories, query, activeTab]);

  const handleEdit = (service) => {
    setSelectedService(service);
    setShowEditModal(true);
  };

  const handleDelete = async (service) => {
    if (!window.confirm(`Delete service "${service.name}"?`)) return;
    setDeleting(service.id);
    try {
      await api.deleteService(service.id);
      await fetchData();
    } catch (error) {
      alert('Failed to delete service');
    } finally {
      setDeleting(null);
    }
  };

  const handleEditCategory = (category) => {
    setSelectedCategory(category);
    setShowEditCategoryModal(true);
  };

  const handleDeleteCategory = async (category) => {
    if (!window.confirm(`Delete category "${category.name}"? All services in this category will lose their category association.`)) return;
    setDeleting(`cat_${category.id}`);
    try {
      await api.deleteServiceCategory(category.id);
      await fetchData();
    } catch (error) {
      alert('Failed to delete category');
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
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">Services & Categories</h2>
          <p className="text-sm text-gray-600 dark:text-[#7D8590]">
            {activeTab === 'services' ? `${filteredServices.length} services` : `${filteredCategories.length} categories`}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 dark:bg-[#1A1F26] p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => { setActiveTab('services'); setQuery(''); }}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'services'
                ? 'bg-white dark:bg-[#2A313C] text-gray-900 dark:text-[#E6E8EB] shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-[#7D8590] dark:hover:text-[#E6E8EB]'
              }`}
          >
            Services
          </button>
          <button
            onClick={() => { setActiveTab('categories'); setQuery(''); }}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'categories'
                ? 'bg-white dark:bg-[#2A313C] text-gray-900 dark:text-[#E6E8EB] shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-[#7D8590] dark:hover:text-[#E6E8EB]'
              }`}
          >
            Categories
          </button>
        </div>

        <div className="flex gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] placeholder:text-gray-400 focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all w-64"
            />
          </div>
          <button
            onClick={() => activeTab === 'services' ? setShowAddModal(true) : setShowAddCategoryModal(true)}
            className="px-4 py-2 rounded-xl font-semibold text-[#222] transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg whitespace-nowrap"
            style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
          >
            <Plus size={18} />
            {activeTab === 'services' ? 'Add Service' : 'Add Category'}
          </button>
        </div>
      </div>

      {/* Services Table */}
      {activeTab === 'services' && (
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-[#1F2630]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#7D8590] uppercase">Category</th>
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
                    <div className="text-xs text-gray-500 dark:text-[#7D8590] mt-1">{s.description || 'No description'}</div>
                  </td>
                  <td className="px-6 py-4">
                    {s.category_id ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 text-xs font-medium border border-purple-200 dark:border-purple-500/20">
                        <FolderTree size={12} />
                        {categories.find(c => c.id === s.category_id)?.name || 'Unknown'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-[#7D8590] italic">Uncategorized</span>
                    )}
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
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${s.active
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
      )}

      {/* Categories Table */}
      {activeTab === 'categories' && (
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-[#1F2630]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#7D8590] uppercase">Category Name</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-[#7D8590] uppercase">Description</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-[#7D8590] uppercase">Services</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-[#7D8590] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500 dark:text-[#7D8590]">
                    No categories found. Create categories to organize your services.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((c) => {
                  const serviceCount = services.filter(s => s.category_id === c.id).length;
                  return (
                    <tr key={c.id} className="hover:bg-[#5FA8D3]/5 dark:hover:bg-[#5FA8D3]/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <FolderTree size={16} />
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-[#E6E8EB]">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-[#7D8590]">
                        {c.description || <span className="italic opacity-50">No description</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full bg-gray-100 dark:bg-white/10 text-xs font-medium text-gray-700 dark:text-[#E6E8EB]">
                          {serviceCount}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleEditCategory(c)} className="p-2 hover:bg-gray-100 dark:hover:bg-[#1F2630] rounded-lg transition-all">
                            <Pencil size={16} className="text-gray-600 dark:text-[#7D8590]" />
                          </button>
                          <button onClick={() => handleDeleteCategory(c)} disabled={deleting === `cat_${c.id}`} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-50">
                            <Trash2 size={16} className="text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <AddServiceModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={fetchData} categories={categories} />
      <EditServiceModal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedService(null); }} onSuccess={fetchData} service={selectedService} categories={categories} />
      {showAddCategoryModal && <AddCategoryModal isOpen={showAddCategoryModal} onClose={() => setShowAddCategoryModal(false)} onSuccess={fetchData} />}
      {showEditCategoryModal && <EditCategoryModal isOpen={showEditCategoryModal} onClose={() => { setShowEditCategoryModal(false); setSelectedCategory(null); }} onSuccess={fetchData} category={selectedCategory} />}
    </div>
  );
};

export default AdminServices;
