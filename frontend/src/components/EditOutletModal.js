import React, { useState, useEffect } from 'react';
import { X, Store, MapPin, Plus, Trash2, Users, Layers, Scissors, Coffee, Dumbbell, Car, Building2, Sparkles, Briefcase, Camera, Package, User, Link, QrCode } from 'lucide-react';
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

const EditOutletModal = ({ isOpen, onClose, onSuccess, outlet }) => {
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    address: '',
    status: 'Active',
    resource_type: 'custom',
    resource_label: 'Resource',
    resource_label_plural: 'Resources',
    resources: [],
    default_capacity: 1,
    portal_logo_url: '',
    portal_color_scheme: { primary: '#F59E0B', secondary: '#F97316' },
    portal_custom_colors: false
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

  useEffect(() => {
    if (isOpen && outlet) {
      const resourceType = outlet.resource_type || 'custom';
      const preset = BUSINESS_PRESETS[resourceType] || BUSINESS_PRESETS.custom;

      let resources = outlet.resources || [];
      if (resources.length === 0 && outlet.capacity) {
        resources = Array.from({ length: outlet.capacity }, (_, i) => ({
          id: `resource-${i + 1}`,
          name: `${preset.resourceLabel} ${i + 1}`,
          capacity: preset.defaultCapacity,
          active: true,
          user_id: null
        }));
      }

      setFormData({
        name: outlet.name || '',
        city: outlet.city || '',
        address: outlet.address || '',
        status: outlet.status || 'Active',
        resource_type: resourceType,
        resource_label: outlet.resource_label || preset.resourceLabel,
        resource_label_plural: outlet.resource_label_plural || preset.resourceLabelPlural,
        resources: resources,
        default_capacity: outlet.default_capacity || preset.defaultCapacity,
        portal_logo_url: outlet.portal_logo_url || '',
        portal_color_scheme: outlet.portal_color_scheme || { primary: '#F59E0B', secondary: '#F97316' },
        portal_custom_colors: outlet.portal_custom_colors || false
      });
      setError('');
    }
  }, [isOpen, outlet]);

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
        status: formData.status,
        resource_type: formData.resource_type,
        resource_label: formData.resource_label,
        resource_label_plural: formData.resource_label_plural,
        resources: formData.resources,
        default_capacity: formData.default_capacity,
        capacity: formData.resources.length,
        portal_logo_url: formData.portal_logo_url,
        portal_color_scheme: formData.portal_color_scheme,
        portal_custom_colors: formData.portal_custom_colors
      };

      await api.updateOutlet(outlet.id, submitData);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update outlet');
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
            <h3 className="text-xl font-bold text-[#E6E8EB]">Edit Outlet</h3>
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

          {/* Basic Info Section */}
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
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
                >
                  <option value="Active">Active</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>
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

          {/* Resource Configuration Section */}
          <div className="space-y-4 pt-4 border-t border-[#1F2630]">
            <h4 className="text-sm font-semibold text-[#7D8590] uppercase tracking-wider flex items-center gap-2">
              <Layers size={14} />
              Resource Configuration
            </h4>

            <p className="text-xs text-[#7D8590]">
              Define what can be booked at this outlet. Examples: Stylists for salons, Tables for restaurants, Bays for car washes.
            </p>

            {/* Resource Type Selector */}
            <div>
              <label className="block text-sm font-medium text-[#A9AFB8] mb-3">
                Business Type (Template)
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
                  placeholder="e.g., Stylist, Table, Bay"
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
                  placeholder="e.g., Stylists, Tables, Bays"
                />
              </div>
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
                  Add {formData.resource_label}
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {formData.resources.length === 0 ? (
                  <div className="p-4 bg-[#0B0D10] border border-[#1F2630] rounded-xl text-center">
                    <Layers size={24} className="mx-auto text-[#4B5563] mb-2" />
                    <p className="text-sm text-[#7D8590]">
                      No {formData.resource_label_plural.toLowerCase()} added yet
                    </p>
                    <button
                      type="button"
                      onClick={addResource}
                      className="mt-2 text-sm text-[#5FA8D3] hover:underline"
                    >
                      + Add your first {formData.resource_label.toLowerCase()}
                    </button>
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
                            title="Capacity (how many can book this at once)"
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
                  Capacity = how many customers can book the same {formData.resource_label.toLowerCase()} at once.
                </p>
              )}
            </div>
          </div>

            {/* Digital Access Section */}
            <div className="space-y-4 pt-4 border-t border-[#1F2630]">
              <h4 className="text-sm font-semibold text-[#7D8590] uppercase tracking-wider flex items-center gap-2">
                <QrCode size={14} />
                Digital Access
              </h4>
              
              <div className="bg-[#0B0D10] border border-[#1F2630] rounded-xl p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#7D8590] mb-2 uppercase tracking-wide">
                    Public Ordering Link
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-[#12161C] border border-[#1F2630] rounded-lg px-3 py-2 text-sm text-[#5FA8D3] truncate">
                      http://localhost:3001/menu/{outlet.id}
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`http://localhost:3001/menu/${outlet.id}`);
                        alert('Link copied to clipboard!');
                      }}
                      className="p-2 bg-[#12161C] border border-[#1F2630] rounded-lg text-[#7D8590] hover:text-[#5FA8D3] transition-all"
                      title="Copy Link"
                    >
                      <Link size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-[#12161C] rounded-xl border border-[#1F2630]">
                  <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center p-1 shrink-0">
                    <QrCode size={64} className="text-black" />
                  </div>
                  <div className="flex-1">
                    <h5 className="text-sm font-semibold text-[#E6E8EB] mb-1">Store Front QR Code</h5>
                    <p className="text-xs text-[#7D8590] mb-3">
                      Display this QR code at your tables or entrance for contactless ordering and menu access.
                    </p>
                    <button 
                      type="button"
                      className="text-xs font-bold text-[#5FA8D3] hover:underline flex items-center gap-1"
                      onClick={() => window.open(`http://localhost:3001/menu/${outlet.id}`, '_blank')}
                    >
                      Preview Store Front
                      <Link size={10} />
                    </button>
                  </div>
                </div>
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
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditOutletModal;
