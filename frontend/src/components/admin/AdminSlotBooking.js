import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import SlotTimelineView from './SlotTimelineView';
import SlotBookingModal from '../SlotBookingModal';
import {
  Calendar, Pencil, Trash2, Copy, CheckCircle, ExternalLink,
  ToggleLeft, ToggleRight, Clock, Users, Store, Link, Settings,
  Scissors, Car, Stethoscope, Dumbbell, Coffee, User, Phone, Mail,
  FileText, Palette, Type, Image, Crown, Sparkles, Upload, X,
  Layers, Eye, Info, AlertCircle, Plus, CoffeeIcon
} from 'lucide-react';

const DEFAULT_CUSTOMER_FIELDS = [
  { field_name: 'name', label: 'Full Name', required: true, enabled: true },
  { field_name: 'phone', label: 'Phone Number', required: true, enabled: true },
  { field_name: 'email', label: 'Email Address', required: false, enabled: false },
  { field_name: 'notes', label: 'Additional Notes', required: false, enabled: false },
];

const FONT_OPTIONS = [
  { id: 'Inter', name: 'Inter (Default)' },
  { id: 'Poppins', name: 'Poppins' },
  { id: 'Roboto', name: 'Roboto' },
  { id: 'Open Sans', name: 'Open Sans' },
  { id: 'Montserrat', name: 'Montserrat' },
  { id: 'Lato', name: 'Lato' },
  { id: 'Playfair Display', name: 'Playfair Display' },
  { id: 'Raleway', name: 'Raleway' },
];

const SLOT_DURATION_OPTIONS = [
  { value: 0, label: 'Use Service Duration (Dynamic)' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
  { value: 90, label: '90 minutes' },
  { value: 120, label: '120 minutes' },
];

const AdminSlotBooking = () => {
  const [outlets, setOutlets] = useState([]);
  const [slotConfigs, setSlotConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [editingConfig, setEditingConfig] = useState(null);
  const [copiedToken, setCopiedToken] = useState(null);
  const [showSlotView, setShowSlotView] = useState(null);
  const [bookingToEdit, setBookingToEdit] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [outletsRes, configsRes] = await Promise.all([
        api.getOutlets(),
        api.getSlotConfigs()
      ]);
      setOutlets(outletsRes.data);
      setSlotConfigs(configsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOutletConfig = (outletId) => {
    return slotConfigs.find(c => c.outlet_id === outletId);
  };

  const copyEmbedLink = async (config) => {
    const embedUrl = config.short_url || `${window.location.origin}/book/${config.embed_token}`;

    // Try multiple methods to copy
    let copied = false;

    // Method 1: Modern Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(embedUrl);
        copied = true;
      } catch (err) {
        console.log('Clipboard API failed, trying fallback');
      }
    }

    // Method 2: execCommand fallback
    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = embedUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '0';
        textArea.style.top = '0';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const result = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (result) {
          copied = true;
        }
      } catch (err) {
        console.log('execCommand failed');
      }
    }

    // Method 3: Show prompt as last resort
    if (!copied) {
      window.prompt('Copy this booking URL:', embedUrl);
      copied = true; // User manually copied
    }

    if (copied) {
      setCopiedToken(config.id);
      setTimeout(() => setCopiedToken(null), 2000);
    }
  };

  const handleConfigureSlots = (outlet) => {
    setSelectedOutlet(outlet);
    setEditingConfig(getOutletConfig(outlet.id));
    setShowConfigModal(true);
  };

  const handleDeleteConfig = async (config) => {
    if (!window.confirm('Are you sure you want to delete this slot configuration?')) return;
    try {
      await api.deleteSlotConfig(config.id);
      await fetchData();
    } catch (error) {
      console.error('Failed to delete config:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-[#6B7280] dark:text-[#7D8590]">Loading slot configurations...</div>
      </div>
    );
  }



  const handleEditBooking = (booking) => {
    setBookingToEdit(booking);
  };

  const handleDeleteBooking = async (booking) => {
    if (!window.confirm('Are you sure you want to delete this booking?')) return;
    try {
      await api.deleteBooking(booking.id); // Assuming this API exists
      // Refresh data
      fetchData();
    } catch (error) {
      console.error('Failed to delete booking:', error);
      alert('Failed to delete booking');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Slot Booking Configuration</h2>
          <p className="text-sm text-[#6B7280] dark:text-[#7D8590]">
            Configure booking settings for your outlets
          </p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-[#5FA8D3]/10 rounded-2xl p-4 border border-[#5FA8D3]/30">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5FA8D3]/20 flex items-center justify-center flex-shrink-0">
            <Info size={20} className="text-[#5FA8D3]" />
          </div>
          <div>
            <h4 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">How it works</h4>
            <p className="text-sm text-[#A9AFB8] mt-1">
              Resources (stylists, tables, bays, etc.) are defined in <strong>Outlet Settings</strong>.
              Here you configure <strong>when</strong> and <strong>how</strong> customers can book those resources.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#171C22] rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] p-4">
          <div className="text-sm text-[#6B7280] dark:text-[#7D8590] mb-1">Configured Outlets</div>
          <div className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">{slotConfigs.length}</div>
        </div>
        <div className="bg-white dark:bg-[#171C22] rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] p-4">
          <div className="text-sm text-[#6B7280] dark:text-[#7D8590] mb-1">Multi-Service Enabled</div>
          <div className="text-2xl font-bold text-purple-400">
            {slotConfigs.filter(c => c.allow_multiple_services).length}
          </div>
        </div>
        <div className="bg-white dark:bg-[#171C22] rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] p-4">
          <div className="text-sm text-[#6B7280] dark:text-[#7D8590] mb-1">Online Booking Active</div>
          <div className="text-2xl font-bold text-green-400">
            {slotConfigs.filter(c => c.allow_online_booking).length}
          </div>
        </div>
      </div>

      {/* Outlets List */}
      <div className="bg-white dark:bg-[#171C22] rounded-2xl border border-[#D9DEE5] dark:border-[#1F2630] overflow-hidden">
        <div className="p-4 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <h3 className="text-lg font-semibold text-[#0E1116] dark:text-[#E6E8EB]">Outlets & Booking Settings</h3>
        </div>
        <div className="divide-y divide-[#1F2630]">
          {outlets.filter(o => o.status === 'Active').map((outlet) => {
            const config = getOutletConfig(outlet.id);
            const resourceCount = outlet.resources?.length || outlet.capacity || 0;
            const resourceLabel = outlet.resource_label_plural || 'resources';
            const isPlusPlan = config?.plan === 'plus';

            return (
              <div key={outlet.id} className="p-4 hover:bg-[#5FA8D3]/5 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${config
                      ? 'bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0]'
                      : 'bg-[#ECEFF3] dark:bg-[#1F2630]'
                      }`}>
                      <Store size={24} className={config ? 'text-white' : 'text-[#6B7280] dark:text-[#7D8590]'} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{outlet.name}</span>
                        {isPlusPlan && (
                          <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                            <Crown size={10} />
                            Plus
                          </span>
                        )}
                        {config?.allow_multiple_services && (
                          <span className="px-2 py-0.5 bg-purple-900/30 text-purple-400 text-xs font-bold rounded-full flex items-center gap-1">
                            <Layers size={10} />
                            Multi-Service
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[#6B7280] dark:text-[#7D8590]">{outlet.city} • {resourceCount} {resourceLabel}</div>
                    </div>
                  </div>

                  {config ? (
                    <div className="flex items-center gap-3">
                      {/* Config summary */}
                      <div className="hidden md:flex items-center gap-4 text-sm text-[#6B7280] dark:text-[#7D8590]">
                        <span>{config.operating_hours_start} - {config.operating_hours_end}</span>
                        <span>•</span>
                        <span>{config.booking_advance_days} days advance</span>
                      </div>

                      {/* Online status */}
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.allow_online_booking
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-[#ECEFF3] dark:bg-[#1F2630] text-[#6B7280] dark:text-[#7D8590]'
                        }`}>
                        {config.allow_online_booking ? 'Online' : 'Offline'}
                      </span>

                      {/* View Slots */}
                      <button
                        onClick={() => setShowSlotView(showSlotView === outlet.id ? null : outlet.id)}
                        data-testid={`view-slots-${outlet.id}`}
                        className="flex items-center gap-2 px-3 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-lg text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB] hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] transition-all"
                      >
                        <Eye size={16} />
                        {showSlotView === outlet.id ? 'Hide' : 'View'}
                      </button>

                      {/* Copy link */}
                      {config.allow_online_booking && (
                        <button
                          onClick={() => copyEmbedLink(config)}
                          data-testid={`copy-link-${outlet.id}`}
                          className="flex items-center gap-2 px-3 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-lg text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB] hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] transition-all"
                        >
                          {copiedToken === config.id ? (
                            <>
                              <CheckCircle size={16} className="text-green-400" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Link size={16} />
                              Copy Link
                            </>
                          )}
                        </button>
                      )}

                      {/* Edit */}
                      <button
                        onClick={() => handleConfigureSlots(outlet)}
                        data-testid={`edit-config-${outlet.id}`}
                        className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg transition-all"
                      >
                        <Settings size={18} className="text-[#6B7280] dark:text-[#7D8590]" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteConfig(config)}
                        className="p-2 hover:bg-red-900/20 rounded-lg transition-all"
                      >
                        <Trash2 size={18} className="text-red-400" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleConfigureSlots(outlet)}
                      data-testid={`configure-slots-${outlet.id}`}
                      className="px-4 py-2 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg bg-[#5FA8D3] hover:bg-[#4A95C0]"
                    >
                      <Settings size={18} />
                      Configure
                    </button>
                  )}
                </div>

                {/* Slot View Panel */}
                {showSlotView === outlet.id && config && (
                  <div className="mt-6">
                    <SlotTimelineView
                      config={config}
                      outlet={outlet}
                      onEditBooking={handleEditBooking}
                      onDeleteBooking={handleDeleteBooking}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {outlets.filter(o => o.status === 'Active').length === 0 && (
            <div className="p-8 text-center text-[#6B7280] dark:text-[#7D8590]">
              No active outlets found. Create an outlet first in the Outlets tab.
            </div>
          )}
        </div>
      </div>

      {/* Configuration Modal */}
      {showConfigModal && (
        <SlotConfigModal
          outlet={selectedOutlet}
          existingConfig={editingConfig}
          onClose={() => {
            setShowConfigModal(false);
            setSelectedOutlet(null);
            setEditingConfig(null);
          }}
          onSuccess={() => {
            fetchData();
            setShowConfigModal(false);
            setSelectedOutlet(null);
            setEditingConfig(null);
          }}
        />
      )}

      {/* Edit Booking Modal Wrapper */}
      {bookingToEdit && (
        <SlotBookingModal
          isOpen={true}
          onClose={() => setBookingToEdit(null)}
          onSuccess={() => {
            setBookingToEdit(null);
            // Ideally trigger refresh here
            const currentView = showSlotView;
            setShowSlotView(null);
            setTimeout(() => setShowSlotView(currentView), 50);
          }}
          existingBooking={bookingToEdit}
          slot={bookingToEdit.time}
          date={new Date(bookingToEdit.date)}
          outlet={outlets.find(o => o.id === bookingToEdit.outlet_id)}
          services={outlets.find(o => o.id === bookingToEdit.outlet_id)?.services || []}
          onDelete={() => handleDeleteBooking(bookingToEdit)}
        />
      )}
    </div>
  );
};

// Slot Configuration Modal - CLEANED UP (No redundant fields)
const SlotConfigModal = ({ outlet, existingConfig, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('general');
  // Define services from outlet safely
  const services = outlet.services || [];

  const [formData, setFormData] = useState({
    slot_duration_min: existingConfig?.slot_duration_min || 0, // 0 = use service duration
    operating_hours_start: existingConfig?.operating_hours_start || '08:00',
    operating_hours_end: existingConfig?.operating_hours_end || '20:00',
    allow_online_booking: existingConfig?.allow_online_booking ?? true,
    booking_advance_days: existingConfig?.booking_advance_days || 7,
    customer_fields: existingConfig?.customer_fields || DEFAULT_CUSTOMER_FIELDS,
    plan: existingConfig?.plan || 'free',
    allow_multiple_services: existingConfig?.allow_multiple_services || false,
    breaks: existingConfig?.breaks || [], // [{"name": "Lunch", "start": "13:00", "end": "14:00"}]
    branding: existingConfig?.branding || {
      logo_url: '',
      cover_image_url: '',
      primary_color: '#5FA8D3',
      secondary_color: '#FFFFFF',
      text_color: '#333333',
      background_color: '#FFFFFF',
      font_family: 'Inter',
      business_name: '',
      tagline: '',
      welcome_text: '',
      layout: 'centered', // centered, split
      phone: '',
      email: '',
      website: '',
      instagram: '',
      facebook: '',
      hide_powered_by: false
    },
    // Advanced Scheduling
    weekly_schedule: existingConfig?.weekly_schedule || {},
    exceptions: existingConfig?.exceptions || [],
    capacity_type: existingConfig?.capacity_type || 'appointment',
    max_capacity: existingConfig?.max_capacity || 1,
    // Initialize resources logic:
    // 1. Try existing config resources
    // 2. Try outlet resources
    // 3. Fallback to generating from capacity
    resources: existingConfig?.resources || outlet.resources || Array.from({ length: outlet.capacity || 1 }, (_, i) => ({
      id: `resource-${i + 1}`,
      name: `${outlet.resource_label || 'Resource'} ${i + 1}`,
      active: true,
      allowed_services: [] // Default to all if empty, but good to init
    }))
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoPreview, setLogoPreview] = useState(formData.branding.logo_url);

  // Initialize weekly schedule if empty but operating hours exist
  useEffect(() => {
    if (Object.keys(formData.weekly_schedule).length === 0) {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const initialSchedule = {};
      days.forEach(day => {
        initialSchedule[day] = [{
          start: formData.operating_hours_start,
          end: formData.operating_hours_end
        }];
      });
      // Only set if we are creating new or migrating
      if (!existingConfig?.weekly_schedule) {
        setFormData(prev => ({ ...prev, weekly_schedule: initialSchedule }));
      }
    }
  }, []);

  // Dynamically load Google Font for Preview
  useEffect(() => {
    const font = formData.branding.font_family;
    if (font && font !== 'Inter') {
      const linkId = `font-link-${font.replace(/\s+/g, '-')}`;
      // Basic check to see if link already exists
      if (!document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`;
        document.head.appendChild(link);
      }
    }
  }, [formData.branding.font_family]);

  // Get resource info from outlet (not from config)
  const resourceCount = outlet.resources?.length || outlet.capacity || 0;
  const resourceLabel = outlet.resource_label || 'Resource';
  const resourceLabelPlural = outlet.resource_label_plural || 'Resources';

  const updateCustomerField = (index, field, value) => {
    const updated = [...formData.customer_fields];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, customer_fields: updated });
  };

  const updateBranding = (field, value) => {
    setFormData({
      ...formData,
      branding: { ...formData.branding, [field]: value }
    });
    if (field === 'logo_url') {
      setLogoPreview(value);
    }
  };

  // Breaks management (Keeping for backward compatibility or simple mode if we decide to keep it)
  // For now, we will rely on Weekly Schedule exceptions/blocks, but breaks are global.
  // Actually, breaks can be handled as exclusions in weekly schedule, but let's keep global breaks simple for now.
  const addBreak = () => {
    setFormData({
      ...formData,
      breaks: [...formData.breaks, { name: 'Break', start: '12:00', end: '13:00' }]
    });
  };

  const updateBreak = (index, field, value) => {
    const updated = [...formData.breaks];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, breaks: updated });
  };

  const removeBreak = (index) => {
    setFormData({
      ...formData,
      breaks: formData.breaks.filter((_, i) => i !== index)
    });
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
        updateBranding('logo_url', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateBranding('cover_image_url', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (resourceCount === 0) {
      setError('Please add resources in Outlet Settings first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Use resources from outlet, not from form
      const payload = {
        outlet_id: outlet.id,
        business_type: outlet.resource_type || 'custom',
        resources: outlet.resources || Array.from({ length: outlet.capacity || 1 }, (_, i) => ({
          id: `resource-${i + 1}`,
          name: `${resourceLabel} ${i + 1}`,
          active: true
        })),
        ...formData
      };

      if (existingConfig) {
        await api.updateSlotConfig(existingConfig.id, payload);
      } else {
        await api.createSlotConfig(payload);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const fieldIcons = {
    name: User,
    phone: Phone,
    email: Mail,
    vehicle: Car,
    notes: FileText
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-panel w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-[#D9DEE5] dark:border-[#1F2630] flex justify-between items-center bg-white/50 dark:bg-[#12161C]/50 backdrop-blur-md sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB] text-gradient-pro">
              {existingConfig ? 'Edit' : 'Configure'} Booking Settings
            </h2>
            <p className="text-sm text-[#4B5563] dark:text-[#9CA3AF]">
              Manage availability, resources, and scheduling rules for {outlet.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-[#6B7280] dark:text-[#9CA3AF]"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#D9DEE5] dark:border-[#1F2630] px-6 bg-white/30 dark:bg-white/5 backdrop-blur-sm">
          {[
            { id: 'general', label: 'Schedule & Rules', icon: Clock },
            { id: 'resources', label: 'Resources & Skills', icon: Users },
            { id: 'booking', label: 'Booking Options', icon: Calendar },
            { id: 'fields', label: 'Customer Fields', icon: User },
            { id: 'branding', label: 'White Label', icon: Palette },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-all ${activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#4B5563] dark:hover:text-[#E6E8EB]'
                  }`}
              >
                <Icon size={16} />
                {tab.label}
                {tab.id === 'branding' && formData.plan === 'free' && (
                  <Crown size={12} className="text-amber-500" />
                )}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* General/Schedule Tab */}
          {/* General/Schedule Tab */}
          {activeTab === 'general' && (
            <>
              {/* Business Logic Mode */}
              <div className="bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] p-4 mb-6">
                <h4 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-3 flex items-center gap-2">
                  <Settings size={18} />
                  Booking Logic & Capacity
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, capacity_type: 'appointment', max_capacity: 1 })}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${formData.capacity_type === 'appointment'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                      : 'border-transparent bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10'
                      }`}
                  >
                    <div className={`font-medium ${formData.capacity_type === 'appointment' ? 'text-purple-700 dark:text-purple-300' : 'text-[#0E1116] dark:text-[#E6E8EB]'}`}>Appointment</div>
                    <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">1 Booking = 1 Resource</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, capacity_type: 'shared' })}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${formData.capacity_type === 'shared'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                      : 'border-transparent bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10'
                      }`}
                  >
                    <div className={`font-medium ${formData.capacity_type === 'shared' ? 'text-purple-700 dark:text-purple-300' : 'text-[#0E1116] dark:text-[#E6E8EB]'}`}>Shared Capacity</div>
                    <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Classes, Gyms, Tours</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, capacity_type: 'private' })}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${formData.capacity_type === 'private'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                      : 'border-transparent bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10'
                      }`}
                  >
                    <div className={`font-medium ${formData.capacity_type === 'private' ? 'text-purple-700 dark:text-purple-300' : 'text-[#0E1116] dark:text-[#E6E8EB]'}`}>Private Inventory</div>
                    <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Tables, Rooms (Party Size)</div>
                  </button>
                </div>

                {(formData.capacity_type === 'shared' || formData.capacity_type === 'private') && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-1">
                      Max Capacity (per slot/resource)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.max_capacity}
                      onChange={(e) => setFormData({ ...formData, max_capacity: parseInt(e.target.value) })}
                      className="w-32 px-3 py-2 bg-white dark:bg-[#171C22] border border-[#D9DEE5] dark:border-[#1F2630] rounded-lg text-[#0E1116] dark:text-[#E6E8EB]"
                    />
                    <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-1">
                      {formData.capacity_type === 'shared'
                        ? 'Total people allowed per time slot.'
                        : 'Max people allowed per resource (e.g., Table for 4).'}
                    </p>
                  </div>
                )}
              </div>

              {/* Slot Duration */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
                  <Clock size={14} className="inline mr-1" />
                  Default Slot Duration
                </label>
                <select
                  value={formData.slot_duration_min}
                  onChange={(e) => setFormData({ ...formData, slot_duration_min: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
                >
                  {SLOT_DURATION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-2">
                  {formData.slot_duration_min === 0
                    ? 'Slots will be sized based on each service\'s duration. Best for businesses with varying service times.'
                    : 'All time slots will be fixed to this duration regardless of service length.'
                  }
                </p>
              </div>

              {/* Weekly Schedule */}
              <div className="mb-6">
                <h4 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-2">Weekly Schedule</h4>
                <WeeklyScheduleBuilder
                  schedule={formData.weekly_schedule}
                  onChange={(newSchedule) => setFormData({ ...formData, weekly_schedule: newSchedule })}
                />
              </div>

              {/* Exceptions */}
              <div className="mb-6">
                <h4 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-2">Calendar Exceptions (Holidays)</h4>
                <ExceptionManager
                  exceptions={formData.exceptions}
                  onChange={(newExceptions) => setFormData({ ...formData, exceptions: newExceptions })}
                />
              </div>

              {/* Advance Booking */}
              <div>
                <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
                  Advance Booking (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={formData.booking_advance_days}
                  onChange={(e) => setFormData({ ...formData, booking_advance_days: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
                />
                <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-2">
                  Customers can book up to {formData.booking_advance_days} days in advance
                </p>
              </div>
            </>
          )}

          {/* Resources Tab */}
          {activeTab === 'resources' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-4 rounded-xl border border-purple-500/20 mb-4">
                <h4 className="font-semibold text-gray-900 dark:text-[#E6E8EB] flex items-center gap-2 mb-1">
                  <Users size={16} className="text-purple-500" />
                  Resource Skill Mapping
                </h4>
                <p className="text-sm text-[#4B5563] dark:text-[#9CA3AF]">
                  Specify which services each resource can perform. If no services are selected, the resource can perform <b>all</b> services.
                </p>
              </div>

              {formData.resources.length === 0 ? (
                <div className="text-center py-8 text-[#6B7280] dark:text-[#9CA3AF]">
                  <Users size={32} className="mx-auto mb-2 opacity-50" />
                  No resources found. Check your Outlet Settings capacity.
                </div>
              ) : (
                <div className="space-y-4">
                  {formData.resources.map((resource, idx) => (
                    <div key={resource.id} className="p-4 bg-white/50 dark:bg-white/5 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] hover:border-purple-500/50 transition-all shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{resource.name}</div>
                            <div className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{resource.id}</div>
                          </div>
                        </div>
                        <div className="text-xs font-medium px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                          {(resource.allowed_services?.length || 0) === 0 ? 'All Services Allowed' : `${resource.allowed_services.length} Services Allowed`}
                        </div>
                      </div>

                      <div className="bg-white/80 dark:bg-[#0B0D10]/80 p-3 rounded-lg border border-[#D9DEE5] dark:border-[#1F2630]">
                        <label className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] uppercase mb-2 block tracking-wider">Allowed Services</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {services.map(service => {
                            const isSelected = resource.allowed_services?.includes(service.service_id) || (resource.allowed_services?.length === 0 && false);
                            // Helper to toggle
                            const toggleService = () => {
                              let newAllowed = [...(resource.allowed_services || [])];
                              if (newAllowed.includes(service.service_id)) {
                                newAllowed = newAllowed.filter(id => id !== service.service_id);
                              } else {
                                newAllowed.push(service.service_id);
                              }
                              const newResources = [...formData.resources];
                              newResources[idx] = { ...resource, allowed_services: newAllowed };
                              setFormData({ ...formData, resources: newResources });
                            };

                            const isChecked = (resource.allowed_services || []).includes(service.service_id);

                            return (
                              <label key={service.service_id} className={`flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg transition-all ${isChecked ? 'bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20' : 'hover:bg-gray-50 dark:hover:bg-white/5 border border-transparent'}`}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={toggleService}
                                  className="rounded text-purple-500 focus:ring-purple-500 border-gray-300 dark:border-gray-600"
                                />
                                <span className={`text-sm ${isChecked ? 'text-purple-700 dark:text-purple-300 font-medium' : 'text-[#0E1116] dark:text-[#E6E8EB]'}`}>{service.name}</span>
                              </label>
                            );
                          })}
                          {services.length === 0 && (
                            <div className="col-span-3 text-sm text-[#6B7280] dark:text-[#9CA3AF] italic">
                              No services found for this outlet.
                            </div>
                          )}
                        </div>
                        {(resource.allowed_services || []).length === 0 && (
                          <div className="mt-2 text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                            <Info size={12} />
                            All services are currently allowed for this resource.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Booking Options Tab */}
          {activeTab === 'booking' && (
            <div className="space-y-6">
              {/* Online Booking Toggle */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, allow_online_booking: !formData.allow_online_booking })}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border transition-all ${formData.allow_online_booking
                  ? 'bg-green-900/20 border-green-700'
                  : 'bg-[#0B0D10] border-[#D9DEE5] dark:border-[#1F2630]'
                  }`}
              >
                <div className="text-left">
                  <span className={`font-medium ${formData.allow_online_booking ? 'text-green-400' : 'text-[#6B7280] dark:text-[#7D8590]'}`}>
                    Allow Online Booking
                  </span>
                  <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-1">
                    Customers can book slots using a shareable link
                  </p>
                </div>
                {formData.allow_online_booking ? (
                  <ToggleRight size={28} className="text-green-400" />
                ) : (
                  <ToggleLeft size={28} className="text-[#6B7280] dark:text-[#7D8590]" />
                )}
              </button>

              {/* Multi-Service Toggle */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, allow_multiple_services: !formData.allow_multiple_services })}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border transition-all ${formData.allow_multiple_services
                  ? 'bg-purple-900/20 border-purple-700'
                  : 'bg-[#0B0D10] border-[#D9DEE5] dark:border-[#1F2630]'
                  }`}
              >
                <div className="text-left">
                  <span className={`font-medium flex items-center gap-2 ${formData.allow_multiple_services ? 'text-purple-400' : 'text-[#6B7280] dark:text-[#7D8590]'}`}>
                    <Layers size={18} />
                    Allow Multiple Services
                  </span>
                  <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-1">
                    Customers can select multiple services in one booking
                  </p>
                </div>
                {formData.allow_multiple_services ? (
                  <ToggleRight size={28} className="text-purple-400" />
                ) : (
                  <ToggleLeft size={28} className="text-[#6B7280] dark:text-[#7D8590]" />
                )}
              </button>

              {formData.allow_multiple_services && (
                <div className="p-4 bg-purple-900/10 rounded-xl border border-purple-800">
                  <h4 className="font-semibold text-purple-300 flex items-center gap-2 mb-2">
                    <Layers size={16} />
                    Multi-Service Info
                  </h4>
                  <ul className="text-sm text-purple-400 space-y-1">
                    <li>• Total duration = sum of all selected service times</li>
                    <li>• Consecutive slots auto-blocked for longer services</li>
                    <li>• Total price shown is sum of all services</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Customer Fields Tab */}
          {activeTab === 'fields' && (
            <div className="space-y-4">
              <div className="bg-[#5FA8D3]/10 rounded-xl p-4 border border-[#5FA8D3]/30">
                <p className="text-sm text-[#A9AFB8]">
                  Configure which fields customers need to fill when booking.
                </p>
              </div>

              <div className="space-y-3">
                {formData.customer_fields.map((field, idx) => {
                  const Icon = fieldIcons[field.field_name] || FileText;
                  return (
                    <div
                      key={field.field_name}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${field.enabled
                        ? 'bg-[#0B0D10] border-[#D9DEE5] dark:border-[#1F2630]'
                        : 'bg-[#0B0D10]/50 border-[#D9DEE5] dark:border-[#1F2630]/50 opacity-60'
                        }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#ECEFF3] dark:bg-[#1F2630] flex items-center justify-center">
                        <Icon size={20} className="text-[#6B7280] dark:text-[#7D8590]" />
                      </div>

                      <div className="flex-1">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateCustomerField(idx, 'label', e.target.value)}
                          className="font-medium text-[#0E1116] dark:text-[#E6E8EB] bg-transparent border-none p-0 focus:ring-0 w-full"
                        />
                        <div className="text-xs text-[#6B7280] dark:text-[#7D8590]">{field.field_name}</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateCustomerField(idx, 'required', e.target.checked)}
                            disabled={!field.enabled}
                            className="rounded border-[#D9DEE5] dark:border-[#1F2630] bg-[#0B0D10] text-[#5FA8D3] focus:ring-[#5FA8D3]"
                          />
                          <span className="text-sm text-[#6B7280] dark:text-[#7D8590]">Required</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => updateCustomerField(idx, 'enabled', !field.enabled)}
                          className={`p-2 rounded-lg transition-all ${field.enabled
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-[#ECEFF3] dark:bg-[#1F2630] text-[#6B7280] dark:text-[#7D8590]'
                            }`}
                        >
                          {field.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              {/* Plan Selection */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, plan: 'free' })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${formData.plan === 'free'
                    ? 'border-[#5FA8D3] bg-[#5FA8D3]/10'
                    : 'border-[#D9DEE5] dark:border-[#1F2630] hover:border-[#5FA8D3]/50'
                    }`}
                >
                  <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-1">Free Plan</div>
                  <p className="text-sm text-[#6B7280] dark:text-[#7D8590]">Default Ri&apos;Serve branding</p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, plan: 'plus' })}
                  className={`p-4 rounded-xl border-2 text-left transition-all relative ${formData.plan === 'plus'
                    ? 'border-purple-500 bg-purple-900/20'
                    : 'border-[#D9DEE5] dark:border-[#1F2630] hover:border-purple-500/50'
                    }`}
                >
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
                      <Sparkles size={10} />
                      Plus
                    </span>
                  </div>
                  <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-1 flex items-center gap-2">
                    <Crown size={16} className="text-purple-500" />
                    Plus Plan
                  </div>
                  <p className="text-sm text-[#6B7280] dark:text-[#7D8590]">Full white-label customization</p>
                </button>
              </div>

              {formData.plan === 'plus' ? (
                <div className="space-y-6 p-4 bg-purple-500/5 dark:bg-purple-900/10 rounded-xl border border-purple-300 dark:border-purple-800">
                  <h4 className="font-semibold text-purple-600 dark:text-purple-300 flex items-center gap-2">
                    <Palette size={16} />
                    White Label Customization
                  </h4>

                  {/* Logo & Cover Image Upload */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">Logo</label>
                      <div className="flex flex-col gap-2">
                        {logoPreview ? (
                          <div className="relative w-full aspect-square max-w-[120px]">
                            <img src={logoPreview} alt="Logo" className="w-full h-full rounded-xl object-cover border border-purple-700" />
                            <button
                              type="button"
                              onClick={() => { setLogoPreview(''); updateBranding('logo_url', ''); }}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <label className="w-full aspect-square max-w-[120px] rounded-xl border-2 border-dashed border-purple-400 dark:border-purple-700 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 transition-all bg-white/5">
                            <Upload size={24} className="text-purple-500 mb-2" />
                            <span className="text-xs text-center text-[#6B7280]">Upload Logo</span>
                            <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                          </label>
                        )}
                        <input
                          type="url"
                          value={formData.branding.logo_url}
                          onChange={(e) => updateBranding('logo_url', e.target.value)}
                          placeholder="Or paste logo URL"
                          className="w-full px-3 py-2 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB] text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">Cover Image (Split Layout)</label>
                      <div className="flex flex-col gap-2">
                        {formData.branding.cover_image_url ? (
                          <div className="relative w-full aspect-video">
                            <img src={formData.branding.cover_image_url} alt="Cover" className="w-full h-full rounded-xl object-cover border border-purple-700" />
                            <button
                              type="button"
                              onClick={() => updateBranding('cover_image_url', '')}
                              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <label className="w-full aspect-video rounded-xl border-2 border-dashed border-purple-400 dark:border-purple-700 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 transition-all bg-white/5">
                            <Upload size={24} className="text-purple-500 mb-2" />
                            <span className="text-xs text-center text-[#6B7280]">Upload Cover</span>
                            <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                          </label>
                        )}
                        <input
                          type="url"
                          value={formData.branding.cover_image_url || ''}
                          onChange={(e) => updateBranding('cover_image_url', e.target.value)}
                          placeholder="Paste cover image URL"
                          className="w-full px-3 py-2 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB] text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Business Name & Tagline */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">Business Name</label>
                      <input
                        type="text"
                        value={formData.branding.business_name}
                        onChange={(e) => updateBranding('business_name', e.target.value)}
                        placeholder={outlet.name}
                        className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">Tagline</label>
                      <input
                        type="text"
                        value={formData.branding.tagline || ''}
                        onChange={(e) => updateBranding('tagline', e.target.value)}
                        placeholder="Your tagline"
                        className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB]"
                      />
                    </div>
                  </div>

                  {/* Welcome Header */}
                  <div>
                    <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
                      Welcome Header Text
                    </label>
                    <input
                      type="text"
                      value={formData.branding.welcome_text || ''}
                      onChange={(e) => updateBranding('welcome_text', e.target.value)}
                      placeholder="Book your appointment with us"
                      className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB]"
                    />
                  </div>

                  {/* Colors - Expanded */}
                  {/* Colors - Expanded with Live Preview */}
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8]">
                      Brand Customization & Preview
                    </label>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Color Inputs */}
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs text-[#6B7280] dark:text-[#7D8590] mb-1 block">Brand / Button Color</span>
                          <div className="flex items-center gap-2">
                            <input type="color" value={formData.branding.primary_color} onChange={(e) => updateBranding('primary_color', e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                            <input type="text" value={formData.branding.primary_color} onChange={(e) => updateBranding('primary_color', e.target.value)} className="flex-1 px-3 py-2 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB] text-sm" />
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-[#6B7280] dark:text-[#7D8590] mb-1 block">Button Text / Accent Color</span>
                          <div className="flex items-center gap-2">
                            <input type="color" value={formData.branding.secondary_color || '#6B7280'} onChange={(e) => updateBranding('secondary_color', e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                            <input type="text" value={formData.branding.secondary_color || '#6B7280'} onChange={(e) => updateBranding('secondary_color', e.target.value)} className="flex-1 px-3 py-2 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB] text-sm" />
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-[#6B7280] dark:text-[#7D8590] mb-1 block">Page Background</span>
                          <div className="flex items-center gap-2">
                            <input type="color" value={formData.branding.background_color || '#FFFFFF'} onChange={(e) => updateBranding('background_color', e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                            <input type="text" value={formData.branding.background_color || '#FFFFFF'} onChange={(e) => updateBranding('background_color', e.target.value)} className="flex-1 px-3 py-2 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB] text-sm" />
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-[#6B7280] dark:text-[#7D8590] mb-1 block">Page Text Color</span>
                          <div className="flex items-center gap-2">
                            <input type="color" value={formData.branding.text_color || '#333333'} onChange={(e) => updateBranding('text_color', e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0" />
                            <input type="text" value={formData.branding.text_color || '#333333'} onChange={(e) => updateBranding('text_color', e.target.value)} className="flex-1 px-3 py-2 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB] text-sm" />
                          </div>
                        </div>
                      </div>

                      {/* Live Preview Card */}
                      <div className="bg-[#1F2937] p-1 rounded-2xl border border-gray-700 shadow-xl">
                        <div className="bg-black/20 text-xs text-gray-400 text-center py-1 mb-1 rounded-t-xl">Live Preview of Button & Content</div>
                        <div
                          className="w-full aspect-[4/3] rounded-xl flex flex-col items-center justify-center p-6 transition-colors duration-200"
                          style={{
                            backgroundColor: formData.branding.background_color || '#FFFFFF',
                            fontFamily: formData.branding.font_family || 'Inter'
                          }}
                        >
                          <div className="text-center mb-4">
                            <h5 className="text-lg font-bold mb-1" style={{ color: formData.branding.text_color || '#333333' }}>Your Booking</h5>
                            <p className="text-sm opacity-80" style={{ color: formData.branding.text_color || '#333333' }}>
                              Select a time slot
                            </p>
                          </div>

                          <button
                            type="button"
                            className={`px-6 py-3 font-semibold shadow-lg transform active:scale-95 transition-all ${formData.branding.button_style === 'pill' ? 'rounded-full' :
                              formData.branding.button_style === 'square' ? 'rounded-md' : 'rounded-xl'
                              }`}
                            style={{
                              backgroundColor: formData.branding.primary_color || '#5FA8D3',
                              color: formData.branding.secondary_color || '#FFFFFF'
                            }}
                          >
                            Confirm Booking
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Layout & Button Style */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
                        Page Layout
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateBranding('layout', 'centered')}
                          className={`flex-1 p-2 rounded-xl border-2 text-center text-sm transition-all ${formData.branding.layout === 'centered' || !formData.branding.layout
                            ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-300'
                            : 'border-[#D9DEE5] dark:border-[#1F2630] text-[#6B7280] dark:text-[#7D8590]'
                            }`}
                        >
                          Centered
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBranding('layout', 'split')}
                          className={`flex-1 p-2 rounded-xl border-2 text-center text-sm transition-all ${formData.branding.layout === 'split'
                            ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-300'
                            : 'border-[#D9DEE5] dark:border-[#1F2630] text-[#6B7280] dark:text-[#7D8590]'
                            }`}
                        >
                          Split (Recommended)
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
                        Button Style
                      </label>
                      <div className="flex gap-2">
                        {['rounded', 'pill', 'square'].map((style) => (
                          <button
                            key={style}
                            type="button"
                            onClick={() => updateBranding('button_style', style)}
                            className={`flex-1 p-2 rounded-xl border-2 text-center capitalize text-sm transition-all ${formData.branding.button_style === style
                              ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-300'
                              : 'border-[#D9DEE5] dark:border-[#1F2630] text-[#6B7280] dark:text-[#7D8590]'
                              }`}
                          >
                            {style}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Font */}
                  <div>
                    <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
                      <Type size={14} className="inline mr-1" />
                      Font Family
                    </label>
                    <select
                      value={formData.branding.font_family}
                      onChange={(e) => updateBranding('font_family', e.target.value)}
                      className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB]"
                    >
                      {FONT_OPTIONS.map((font) => (
                        <option key={font.id} value={font.id}>{font.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Contact & Social */}
                  <div className="space-y-4 pt-4 border-t border-purple-300/30 dark:border-purple-800/30">
                    <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8]">
                      Contact & Social Links
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-[#6B7280] dark:text-[#7D8590] mb-1 block">Phone Number</span>
                        <input
                          type="tel"
                          value={formData.branding.phone || ''}
                          onChange={(e) => updateBranding('phone', e.target.value)}
                          placeholder="+1 234 567 8900"
                          className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB]"
                        />
                      </div>
                      <div>
                        <span className="text-xs text-[#6B7280] dark:text-[#7D8590] mb-1 block">Email</span>
                        <input
                          type="email"
                          value={formData.branding.email || ''}
                          onChange={(e) => updateBranding('email', e.target.value)}
                          placeholder="contact@business.com"
                          className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB]"
                        />
                      </div>
                      <div>
                        <span className="text-xs text-[#6B7280] dark:text-[#7D8590] mb-1 block">Instagram</span>
                        <input
                          type="url"
                          value={formData.branding.instagram || ''}
                          onChange={(e) => updateBranding('instagram', e.target.value)}
                          placeholder="https://instagram.com/yourbiz"
                          className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB]"
                        />
                      </div>
                      <div>
                        <span className="text-xs text-[#6B7280] dark:text-[#7D8590] mb-1 block">Website</span>
                        <input
                          type="url"
                          value={formData.branding.website || ''}
                          onChange={(e) => updateBranding('website', e.target.value)}
                          placeholder="https://yourbusiness.com"
                          className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hide Powered By */}
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-[#0B0D10]/50 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630]">
                    <div>
                      <span className="font-medium text-[#0E1116] dark:text-[#E6E8EB]">Hide &quot;Powered by Ri&apos;Serve&quot;</span>
                      <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-1">Remove Ri&apos;Serve branding from footer</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateBranding('hide_powered_by', !formData.branding.hide_powered_by)}
                      className={`p-2 rounded-lg transition-all ${formData.branding.hide_powered_by
                        ? 'bg-purple-500/20 text-purple-500'
                        : 'bg-[#ECEFF3] dark:bg-[#1F2630] text-[#6B7280] dark:text-[#7D8590]'
                        }`}
                    >
                      {formData.branding.hide_powered_by ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] text-center">
                  <Crown size={32} className="text-[#6B7280] dark:text-[#7D8590] mx-auto mb-2" />
                  <p className="text-[#6B7280] dark:text-[#7D8590]">
                    Upgrade to Plus plan to customize your booking page with your logo, colors, and fonts.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="p-6 border-t border-[#D9DEE5] dark:border-[#1F2630] flex justify-end gap-3 bg-white/50 dark:bg-[#12161C]/50 backdrop-blur-md sticky bottom-0 z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] text-[#4B5563] dark:text-[#9CA3AF] font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-all"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || resourceCount === 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-500 dark:to-blue-500 text-white font-semibold hover:opacity-90 shadow-lg shadow-purple-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
              data-testid="save-config-btn"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Advanced Scheduling Components ---

const WeeklyScheduleBuilder = ({ schedule, onChange }) => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const handleDayToggle = (day) => {
    const newSchedule = { ...schedule };
    if (newSchedule[day]) {
      // If exists (even empty array), remove it to mark as closed
      delete newSchedule[day];
    } else {
      // Initialize with default 9-5
      newSchedule[day] = [{ start: '09:00', end: '17:00' }];
    }
    onChange(newSchedule);
  };

  const addTimeRange = (day) => {
    const newSchedule = { ...schedule };
    if (!newSchedule[day]) newSchedule[day] = [];
    newSchedule[day].push({ start: '09:00', end: '17:00' });
    onChange(newSchedule);
  };

  const removeTimeRange = (day, index) => {
    const newSchedule = { ...schedule };
    newSchedule[day] = newSchedule[day].filter((_, i) => i !== index);
    if (newSchedule[day].length === 0) {
      delete newSchedule[day]; // Close day if no ranges
    }
    onChange(newSchedule);
  };

  const updateTimeRange = (day, index, field, value) => {
    const newSchedule = { ...schedule };
    newSchedule[day][index] = { ...newSchedule[day][index], [field]: value };
    onChange(newSchedule);
  };

  const copyToAll = (sourceDay) => {
    if (!schedule[sourceDay]) return;
    const newSchedule = { ...schedule };
    days.forEach(day => {
      if (day !== sourceDay) {
        newSchedule[day] = [...schedule[sourceDay]];
      }
    });
    onChange(newSchedule);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {days.map(day => {
          const isOpen = !!schedule[day];
          const ranges = schedule[day] || [];

          return (
            <div key={day} className={`p-3 rounded-xl border transition-all ${isOpen ? 'bg-white dark:bg-[#171C22] border-[#D9DEE5] dark:border-[#1F2630]' : 'bg-[#F6F7F9] dark:bg-[#0B0D10] border-dashed border-[#D9DEE5] dark:border-[#1F2630] opacity-75'}`}>
              <div className="flex items-start gap-4">
                {/* Day Toggle */}
                <div className="w-32 flex-shrink-0 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isOpen ? 'bg-[#5FA8D3] border-[#5FA8D3]' : 'border-[#6B7280]'}`}>
                      {isOpen && <CheckCircle size={12} className="text-white" />}
                    </div>
                    <input
                      type="checkbox"
                      checked={isOpen}
                      onChange={() => handleDayToggle(day)}
                      className="hidden"
                    />
                    <span className="capitalize font-medium text-[#0E1116] dark:text-[#E6E8EB]">{day}</span>
                  </label>
                  {isOpen && (
                    <button
                      onClick={() => copyToAll(day)}
                      type="button"
                      className="text-xs text-[#5FA8D3] mt-2 hover:underline flex items-center gap-1"
                    >
                      <Copy size={10} /> Copy to all
                    </button>
                  )}
                </div>

                {/* Time Ranges */}
                <div className="flex-1 space-y-2">
                  {isOpen ? (
                    <>
                      {ranges.map((range, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={range.start}
                            onChange={(e) => updateTimeRange(day, idx, 'start', e.target.value)}
                            className="px-3 py-2 bg-[#F6F7F9] dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-lg text-sm text-[#0E1116] dark:text-[#E6E8EB]"
                          />
                          <span className="text-[#6B7280]">-</span>
                          <input
                            type="time"
                            value={range.end}
                            onChange={(e) => updateTimeRange(day, idx, 'end', e.target.value)}
                            className="px-3 py-2 bg-[#F6F7F9] dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-lg text-sm text-[#0E1116] dark:text-[#E6E8EB]"
                          />
                          <button
                            type="button"
                            onClick={() => removeTimeRange(day, idx)}
                            className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addTimeRange(day)}
                        className="text-xs text-[#5FA8D3] font-medium flex items-center gap-1 mt-1"
                      >
                        <Plus size={12} /> Add hours
                      </button>
                    </>
                  ) : (
                    <div className="py-2 text-sm text-[#6B7280] dark:text-[#7D8590]">Closed</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ExceptionManager = ({ exceptions, onChange }) => {
  const [newDate, setNewDate] = useState('');

  const addException = () => {
    if (!newDate) return;
    // Check if already exists
    if (exceptions.some(e => e.date === newDate)) return;

    const newEx = {
      date: newDate,
      is_closed: true, // Default to closed
      hours: []
    };
    onChange([...exceptions, newEx]);
    setNewDate('');
  };

  const removeException = (index) => {
    const newExceptions = exceptions.filter((_, i) => i !== index);
    onChange(newExceptions);
  };

  const toggleClosed = (index) => {
    const newExceptions = [...exceptions];
    newExceptions[index].is_closed = !newExceptions[index].is_closed;
    if (!newExceptions[index].is_closed && (!newExceptions[index].hours || newExceptions[index].hours.length === 0)) {
      newExceptions[index].hours = [{ start: '09:00', end: '13:00' }];
    }
    onChange(newExceptions);
  };

  const updateHours = (index, hoursIndex, field, value) => {
    const newExceptions = [...exceptions];
    newExceptions[index].hours[hoursIndex][field] = value;
    onChange(newExceptions);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-1">Add Date Override</label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full px-4 py-2 bg-white dark:bg-[#0B0D10] border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB]"
          />
        </div>
        <button
          type="button"
          onClick={addException}
          disabled={!newDate}
          className="px-4 py-2 bg-[#5FA8D3] text-white rounded-xl font-medium disabled:opacity-50"
        >
          Add Date
        </button>
      </div>

      <div className="space-y-2">
        {exceptions.map((ex, idx) => (
          <div key={idx} className="p-3 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl border border-[#D9DEE5] dark:border-[#1F2630]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">
                {new Date(ex.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleClosed(idx)}
                  className={`text-xs px-2 py-1 rounded-lg font-medium ${ex.is_closed
                    ? 'bg-red-400/20 text-red-500'
                    : 'bg-green-400/20 text-green-500'
                    }`}
                >
                  {ex.is_closed ? 'Closed' : 'Open'}
                </button>
                <button
                  type="button"
                  onClick={() => removeException(idx)}
                  className="p-1 hover:bg-red-400/10 rounded text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {!ex.is_closed && (
              <div className="mt-2 space-y-2 pl-2 border-l-2 border-[#5FA8D3]">
                {ex.hours?.map((h, hIdx) => (
                  <div key={hIdx} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={h.start}
                      onChange={(e) => updateHours(idx, hIdx, 'start', e.target.value)}
                      className="px-2 py-1 text-sm rounded border border-[#D9DEE5] dark:border-[#1F2630] bg-white dark:bg-[#171C22] text-[#0E1116] dark:text-[#E6E8EB]"
                    />
                    <span>-</span>
                    <input
                      type="time"
                      value={h.end}
                      onChange={(e) => updateHours(idx, hIdx, 'end', e.target.value)}
                      className="px-2 py-1 text-sm rounded border border-[#D9DEE5] dark:border-[#1F2630] bg-white dark:bg-[#171C22] text-[#0E1116] dark:text-[#E6E8EB]"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {exceptions.length === 0 && (
          <div className="text-center py-4 text-sm text-[#6B7280] dark:text-[#7D8590] italic">
            No specific date overrides added yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSlotBooking;
