import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Building2, MapPin, Phone, Mail, Globe, Clock, Calendar,
  Save, Loader2, CheckCircle, AlertCircle
} from 'lucide-react';

const AdminCompanySettings = () => {
  const [settings, setSettings] = useState({
    company_name: '',
    business_type: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    phone: '',
    email: '',
    website: '',
    tax_id: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    operating_hours_start: '09:00',
    operating_hours_end: '18:00',
    working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    logo_url: ''
  });
  const [businessTypes, setBusinessTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const currencies = [
    { code: 'INR', name: 'Indian Rupee (₹)' },
    { code: 'USD', name: 'US Dollar ($)' },
    { code: 'EUR', name: 'Euro (€)' },
    { code: 'GBP', name: 'British Pound (£)' },
    { code: 'AED', name: 'UAE Dirham (د.إ)' },
    { code: 'SGD', name: 'Singapore Dollar (S$)' }
  ];

  const timezones = [
    { id: 'Asia/Kolkata', name: 'India (IST)' },
    { id: 'America/New_York', name: 'US Eastern (EST)' },
    { id: 'America/Los_Angeles', name: 'US Pacific (PST)' },
    { id: 'Europe/London', name: 'UK (GMT)' },
    { id: 'Asia/Dubai', name: 'UAE (GST)' },
    { id: 'Asia/Singapore', name: 'Singapore (SGT)' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, typesRes] = await Promise.all([
        api.getCompanySettings(),
        api.getBusinessTypes()
      ]);
      if (settingsRes.data) {
        setSettings(prev => ({ ...prev, ...settingsRes.data }));
      }
      setBusinessTypes(typesRes.data.types || []);
    } catch (error) {
      console.error('Failed to fetch company settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setMessage({ type: '', text: '' });
  };

  const toggleWorkingDay = (day) => {
    const days = settings.working_days || [];
    if (days.includes(day)) {
      handleChange('working_days', days.filter(d => d !== day));
    } else {
      handleChange('working_days', [...days, day]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    
    try {
      await api.updateCompanySettings(settings);
      setMessage({ type: 'success', text: 'Company settings saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#5FA8D3]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center">
            <Building2 size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Company Settings</h2>
            <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">
              Configure your business details and operational settings
            </p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
            : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {message.text}
        </div>
      )}

      {/* Business Information */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
        <h3 className="text-lg font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-4">Business Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              Company Name *
            </label>
            <input
              type="text"
              value={settings.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              placeholder="Enter your company name"
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              Business Type *
            </label>
            <select
              value={settings.business_type}
              onChange={(e) => handleChange('business_type', e.target.value)}
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            >
              <option value="">Select business type</option>
              {businessTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              Tax ID / GST Number
            </label>
            <input
              type="text"
              value={settings.tax_id}
              onChange={(e) => handleChange('tax_id', e.target.value)}
              placeholder="Enter tax ID"
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              Currency
            </label>
            <select
              value={settings.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            >
              {currencies.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
        <h3 className="text-lg font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-4 flex items-center gap-2">
          <MapPin size={20} className="text-[#5FA8D3]" />
          Contact & Address
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              Street Address
            </label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Enter street address"
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">City</label>
            <input
              type="text"
              value={settings.city}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="City"
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">State/Province</label>
            <input
              type="text"
              value={settings.state}
              onChange={(e) => handleChange('state', e.target.value)}
              placeholder="State"
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">Country</label>
            <input
              type="text"
              value={settings.country}
              onChange={(e) => handleChange('country', e.target.value)}
              placeholder="Country"
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">Postal Code</label>
            <input
              type="text"
              value={settings.postal_code}
              onChange={(e) => handleChange('postal_code', e.target.value)}
              placeholder="Postal code"
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              <Phone size={16} className="inline mr-1" /> Phone
            </label>
            <input
              type="tel"
              value={settings.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              <Mail size={16} className="inline mr-1" /> Email
            </label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="contact@company.com"
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              <Globe size={16} className="inline mr-1" /> Website
            </label>
            <input
              type="url"
              value={settings.website}
              onChange={(e) => handleChange('website', e.target.value)}
              placeholder="https://www.company.com"
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Operating Hours */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
        <h3 className="text-lg font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-4 flex items-center gap-2">
          <Clock size={20} className="text-[#5FA8D3]" />
          Operating Hours
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              Opening Time
            </label>
            <input
              type="time"
              value={settings.operating_hours_start}
              onChange={(e) => handleChange('operating_hours_start', e.target.value)}
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              Closing Time
            </label>
            <input
              type="time"
              value={settings.operating_hours_end}
              onChange={(e) => handleChange('operating_hours_end', e.target.value)}
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              Timezone
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => handleChange('timezone', e.target.value)}
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent"
            >
              {timezones.map(tz => (
                <option key={tz.id} value={tz.id}>{tz.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-3">
            <Calendar size={16} className="inline mr-1" /> Working Days
          </label>
          <div className="flex flex-wrap gap-2">
            {weekDays.map(day => (
              <button
                key={day}
                type="button"
                onClick={() => toggleWorkingDay(day)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  (settings.working_days || []).includes(day)
                    ? 'bg-[#5FA8D3] text-white'
                    : 'bg-[#ECEFF3] dark:bg-[#1F2630] text-[#4B5563] dark:text-[#A9AFB8] hover:bg-[#D9DEE5] dark:hover:bg-[#2A3441]'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-50 flex items-center gap-2 shadow-lg bg-[#5FA8D3] hover:bg-[#4A95C0]"
        >
          {saving ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save size={20} />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AdminCompanySettings;
