import React, { useState, useEffect } from 'react';
import { X, Store, MapPin, Plus, Trash2, Users, Layers, Scissors, Coffee, Dumbbell, Car, Building2, Sparkles, Briefcase, Camera, Package, User } from 'lucide-react';
import { api } from '../services/api';

// Business type presets with Lucide icons
const BUSINESS_PRESETS = {
  salon: { resourceLabel: 'Stylist', resourceLabelPlural: 'Stylists', defaultCapacity: 1, Icon: Scissors },
  restaurant: { resourceLabel: 'Table', resourceLabelPlural: 'Tables', defaultCapacity: 4, Icon: Coffee },
  gym: { resourceLabel: 'Station', resourceLabelPlural: 'Stations', defaultCapacity: 10, Icon: Dumbbell },
  car_wash: { resourceLabel: 'Bay', resourceLabelPlural: 'Bays', defaultCapacity: 1, Icon: Car },
  clinic: { resourceLabel: 'Room', resourceLabelPlural: 'Rooms', defaultCapacity: 1, Icon: Building2 },
  spa: { resourceLabel: 'Room', resourceLabelPlural: 'Rooms', defaultCapacity: 1, Icon: Sparkles },
  fitness: { resourceLabel: 'Class', resourceLabelPlural: 'Classes', defaultCapacity: 20, Icon: Users },
  coworking: { resourceLabel: 'Desk', resourceLabelPlural: 'Desks', defaultCapacity: 1, Icon: Briefcase },
  photography: { resourceLabel: 'Studio', resourceLabelPlural: 'Studios', defaultCapacity: 1, Icon: Camera },
  custom: { resourceLabel: 'Resource', resourceLabelPlural: 'Resources', defaultCapacity: 1, Icon: Package }
};

const AddOutletModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    address: '',
    resource_type: 'custom',
    resource_label: 'Resource',
    resource_label_plural: 'Resources',
    resources: [],
    default_capacity: 1
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableUsers, setAvailableUsers] = useState([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.getUsers();
        setAvailableUsers(response.data);
      } catch (err) {
        console.error('Failed to fetch users for resource assignment', err);
      }
    };
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const handleResourceTypeChange = (type) => {
    const preset = BUSINESS_PRESETS[type] || BUSINESS_PRESETS.custom;

    const updatedResources = formData.resources.map((r, i) => ({
      ...r,
      name: type === 'custom' ? r.name : `${preset.resourceLabel} ${i + 1}`
    }));

    setFormData({
      ...formData,
      resource_type: type,
      resource_label: preset.resourceLabel,
      resource_label_plural: preset.resourceLabelPlural,
      default_capacity: preset.defaultCapacity,
      resources: updatedResources
    });
  };

  const addResource = () => {
    const newIndex = formData.resources.length + 1;

    setFormData({
      ...formData,
      resources: [
        ...formData.resources,
        {
          id: `resource-${Date.now()}`,
          name: `${formData.resource_label} ${newIndex}`,
          capacity: formData.default_capacity,
          active: true,
          user_id: null
        }
      ]
    });
  };

  const updateResource = (index, field, value) => {
    const updated = [...formData.resources];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, resources: updated });
  };

  const removeResource = (index) => {
    const updated = formData.resources.filter((_, i) => i !== index);
    setFormData({ ...formData, resources: updated });
  };

  const quickAddResources = (count) => {
    const newResources = Array.from({ length: count }, (_, i) => ({
      id: `resource-${Date.now()}-${i}`,
      name: `${formData.resource_label} ${formData.resources.length + i + 1}`,
      capacity: formData.default_capacity,
      active: true,
      user_id: null
    }));

    setFormData({
      ...formData,
      resources: [...formData.resources, ...newResources]
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.city.trim() || !formData.address.trim()) {
      setError('Name, city, and address are required');
      return;
    }

    if (formData.resources.length === 0) {
      setError('At least one resource is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const submitData = {
        name: formData.name,
        city: formData.city,
        address: formData.address,
        resource_type: formData.resource_type,
        resource_label: formData.resource_label,
        resource_label_plural: formData.resource_label_plural,
        resources: formData.resources,
        default_capacity: formData.default_capacity,
        capacity: formData.resources.length
      };

      await api.createOutlet(submitData);
      onSuccess();
      onClose();
      setFormData({
        name: '',
        city: '',
        address: '',
        resource_type: 'custom',
        resource_label: 'Resource',
        resource_label_plural: 'Resources',
        resources: [],
        default_capacity: 1
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create outlet');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#171C22] backdrop-blur-xl rounded-3xl border border-[#1F2630] max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1F2630] sticky top-0 bg-[#171C22] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center">
              <Store size={20} className="text-white" />
            </div>
            <h3 className="text-xl font-bold text-[#E6E8EB]">Add New Outlet</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1F2630] rounded-xl transition-all"
          >
            <X size={20} className="text-[#7D8590]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-[#7D8590] uppercase tracking-wider flex items-center gap-2">
              <Store size={14} />
              Basic Information
            </h4>

            <div>
              <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
                Outlet Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-[#E6E8EB] placeholder:text-[#4B5563] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
                placeholder="e.g., Downtown Branch"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
                  <MapPin size={14} className="inline mr-1" />
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-[#E6E8EB] placeholder:text-[#4B5563] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
                  placeholder="City"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
                  Address *
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-[#E6E8EB] placeholder:text-[#4B5563] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
                  placeholder="123, Main Street"
                />
              </div>
            </div>
          </div>

          {/* Resource Configuration */}
          <div className="space-y-4 pt-4 border-t border-[#1F2630]">
            <h4 className="text-sm font-semibold text-[#7D8590] uppercase tracking-wider flex items-center gap-2">
              <Layers size={14} />
              Resource Configuration
            </h4>

            <p className="text-xs text-[#7D8590]">
              Select your business type to get smart defaults, or customize your own resource names.
            </p>

            {/* Business Type Grid */}
            <div>
              <label className="block text-sm font-medium text-[#A9AFB8] mb-3">
                Business Type
              </label>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(BUSINESS_PRESETS).slice(0, 5).map(([key, preset]) => {
                  const IconComponent = preset.Icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleResourceTypeChange(key)}
                      className={`p-3 rounded-xl border text-center transition-all ${formData.resource_type === key
                          ? 'bg-[#5FA8D3]/20 border-[#5FA8D3] text-[#5FA8D3]'
                          : 'bg-[#0B0D10] border-[#1F2630] text-[#7D8590] hover:border-[#5FA8D3]/50 hover:text-[#A9AFB8]'
                        }`}
                    >
                      <IconComponent size={20} className="mx-auto mb-1" />
                      <span className="text-xs font-medium">{preset.resourceLabel}</span>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {Object.entries(BUSINESS_PRESETS).slice(5).map(([key, preset]) => {
                  const IconComponent = preset.Icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleResourceTypeChange(key)}
                      className={`p-3 rounded-xl border text-center transition-all ${formData.resource_type === key
                          ? 'bg-[#5FA8D3]/20 border-[#5FA8D3] text-[#5FA8D3]'
                          : 'bg-[#0B0D10] border-[#1F2630] text-[#7D8590] hover:border-[#5FA8D3]/50 hover:text-[#A9AFB8]'
                        }`}
                    >
                      <IconComponent size={20} className="mx-auto mb-1" />
                      <span className="text-xs font-medium">{preset.resourceLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Labels */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
                  Resource Label (Singular)
                </label>
                <input
                  type="text"
                  value={formData.resource_label}
                  onChange={(e) => setFormData({ ...formData, resource_label: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-[#E6E8EB] placeholder:text-[#4B5563] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
                  placeholder="e.g., Stylist"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#A9AFB8] mb-2">
                  Resource Label (Plural)
                </label>
                <input
                  type="text"
                  value={formData.resource_label_plural}
                  onChange={(e) => setFormData({ ...formData, resource_label_plural: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-[#E6E8EB] placeholder:text-[#4B5563] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
                  placeholder="e.g., Stylists"
                />
              </div>
            </div>

            {/* Quick Add */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-[#7D8590]">Quick add:</span>
              {[1, 2, 3, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => quickAddResources(n)}
                  className="px-3 py-1.5 text-sm font-medium bg-[#0B0D10] border border-[#1F2630] rounded-lg text-[#A9AFB8] hover:border-[#5FA8D3] hover:text-[#5FA8D3] transition-all"
                >
                  +{n} {n === 1 ? formData.resource_label : formData.resource_label_plural}
                </button>
              ))}
            </div>

            {/* Resources List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-[#A9AFB8]">
                  {formData.resource_label_plural} ({formData.resources.length})
                </label>
                <button
                  type="button"
                  onClick={addResource}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#5FA8D3] hover:bg-[#5FA8D3]/10 rounded-lg transition-all"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {formData.resources.length === 0 ? (
                  <div className="p-4 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-center">
                    <Layers size={24} className="mx-auto text-[#4B5563] mb-2" />
                    <p className="text-sm text-[#7D8590]">
                      No {formData.resource_label_plural.toLowerCase()} added yet
                    </p>
                    <p className="text-xs text-[#4B5563] mt-1">
                      Use quick add buttons above or click + Add
                    </p>
                  </div>
                ) : (
                  formData.resources.map((resource, index) => (
                    <div
                      key={resource.id || index}
                      className="flex items-center gap-3 p-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl"
                    >
                      <div className="flex-1">
                        <input
                          type="text"
                          value={resource.name}
                          onChange={(e) => updateResource(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 bg-[#12161C] border border-[#1F2630] rounded-lg text-sm text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
                          placeholder={`${formData.resource_label} name`}
                        />
                      </div>
                      <div className="w-1/3 min-w-[140px]">
                        <div className="flex items-center gap-1">
                          <User size={14} className="text-[#7D8590]" />
                          <select
                            value={resource.user_id || ''}
                            onChange={(e) => updateResource(index, 'user_id', e.target.value || null)}
                            className="w-full px-2 py-2 bg-[#12161C] border border-[#1F2630] rounded-lg text-sm text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
                          >
                            <option value="">Unassigned</option>
                            {availableUsers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.role})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="w-24">
                        <div className="flex items-center gap-1">
                          <Users size={14} className="text-[#7D8590]" />
                          <input
                            type="number"
                            min="1"
                            value={resource.capacity}
                            onChange={(e) => updateResource(index, 'capacity', parseInt(e.target.value) || 1)}
                            className="w-full px-2 py-2 bg-[#12161C] border border-[#1F2630] rounded-lg text-sm text-center text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
                            title="Capacity"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeResource(index)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {formData.resources.length > 0 && (
                <p className="text-xs text-[#4B5563] mt-2">
                  Capacity = simultaneous bookings per {formData.resource_label.toLowerCase()}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#1F2630]">
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
              {loading ? 'Creating...' : 'Create Outlet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddOutletModal;
