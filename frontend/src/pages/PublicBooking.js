import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  Calendar, Clock, User, Phone, Mail, MessageSquare, CheckCircle,
  ChevronLeft, ChevronRight, Store, Plus, X, Layers, Instagram, Globe, Facebook, Link
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PublicBooking = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingInfo, setBookingInfo] = useState(null);
  const [step, setStep] = useState(1);

  // Selection state
  const [selectedResource, setSelectedResource] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: '',
    notes: ''
  });
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingId, setBookingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBookingInfo();
  }, [token]);

  // Dynamically load font
  useEffect(() => {
    if (bookingInfo?.config?.branding?.font_family) {
      const font = bookingInfo.config.branding.font_family;
      if (font && font !== 'Inter') {
        const linkId = `font-link-${font.replace(/\s+/g, '-')}`;
        if (!document.getElementById(linkId)) {
          const link = document.createElement('link');
          link.id = linkId;
          link.rel = 'stylesheet';
          link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap`;
          document.head.appendChild(link);
        }
      }
    }
  }, [bookingInfo]);

  const fetchBookingInfo = async () => {
    try {
      const response = await api.getPublicBookingInfo(token);
      setBookingInfo(response.data);
      const activeResources = response.data.config.resources?.filter(r => r.active !== false) || [];
      if (activeResources.length === 1) {
        setSelectedResource(activeResources[0]);
      }
    } catch (err) {
      setError('This booking link is invalid or has been disabled.');
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = () => {
    if (!bookingInfo) return [];
    const { config } = bookingInfo;
    const slots = [];
    const [startHour, startMin] = config.operating_hours_start.split(':').map(Number);
    const [endHour, endMin] = config.operating_hours_end.split(':').map(Number);
    const duration = config.slot_duration_min || 30;

    let current = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;

    while (current + duration <= end) {
      const hour = Math.floor(current / 60);
      const min = current % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

      if (!isBreakTime(timeStr)) {
        slots.push(timeStr);
      }
      current += duration;
    }
    return slots;
  };

  const isBreakTime = (time) => {
    if (!bookingInfo?.config?.breaks || bookingInfo.config.breaks.length === 0) return false;
    const [hour, min] = time.split(':').map(Number);
    const slotMinutes = hour * 60 + min;

    for (const breakItem of bookingInfo.config.breaks) {
      const [breakStartH, breakStartM] = breakItem.start.split(':').map(Number);
      const [breakEndH, breakEndM] = breakItem.end.split(':').map(Number);
      const breakStart = breakStartH * 60 + breakStartM;
      const breakEnd = breakEndH * 60 + breakEndM;

      if (slotMinutes >= breakStart && slotMinutes < breakEnd) {
        return true;
      }
    }
    return false;
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    if (newDate >= new Date().setHours(0, 0, 0, 0)) {
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + (bookingInfo?.config?.booking_advance_days || 7));
      if (newDate <= maxDate) {
        setSelectedDate(newDate);
        setSelectedTime(null);
      }
    }
  };

  const getEnabledFields = () => {
    if (!bookingInfo?.config?.customer_fields) {
      return [
        { field_name: 'name', label: 'Full Name', required: true, enabled: true },
        { field_name: 'phone', label: 'Phone Number', required: true, enabled: true },
      ];
    }
    return bookingInfo.config.customer_fields.filter(f => f.enabled);
  };

  const validateForm = () => {
    const enabledFields = getEnabledFields();
    for (const field of enabledFields) {
      if (field.required && !customerInfo[field.field_name]) {
        return `Please fill in ${field.label}`;
      }
    }
    return null;
  };

  const toggleService = (service) => {
    if (!bookingInfo?.config?.allow_multiple_services) {
      setSelectedServices([service]);
      return;
    }
    const isSelected = selectedServices.find(s => s.id === service.id);
    if (isSelected) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const getTotalDuration = () => {
    return selectedServices.reduce((sum, s) => sum + (s.duration_min || 30), 0);
  };

  const getTotalPrice = () => {
    return selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (selectedServices.length === 0) {
      setError('Please select at least one service');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await api.createPublicBooking(token, {
        outlet_id: bookingInfo.config.outlet_id,
        resource_id: selectedResource?.id || (bookingInfo.config.resources?.[0]?.id || null),
        date: selectedDate.toISOString().split('T')[0],
        time: selectedTime,
        service_ids: selectedServices.map(s => s.id),
        service_id: selectedServices[0]?.id,
        customer_name: customerInfo.name,
        customer_phone: customerInfo.phone,
        customer_email: customerInfo.email || null,
        notes: customerInfo.notes || null,
        total_duration: getTotalDuration(),
        total_amount: getTotalPrice()
      });
      setBookingSuccess(true);
      setBookingId(response.data?.booking_id);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail[0]?.msg || 'Validation error');
      } else {
        setError(typeof detail === 'string' ? detail : 'Failed to create booking');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldIcons = {
    name: User,
    phone: Phone,
    email: Mail,
    notes: MessageSquare
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-gray-500 font-medium">Loading...</div>
        </div>
      </div>
    );
  }

  if (error && !bookingInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">😕</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Booking Unavailable</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // --- Configuration Extraction ---
  const { outlet, config, services } = bookingInfo;
  const timeSlots = generateTimeSlots();
  const enabledFields = getEnabledFields();
  const activeResources = config.resources?.filter(r => r.active !== false) || [];
  const allowMultiService = config?.allow_multiple_services || false;

  const branding = config?.branding || {};
  const isPlusPlan = config?.plan === 'plus';
  // Fallbacks if not plus plan
  const primaryColor = isPlusPlan && branding.primary_color ? branding.primary_color : '#5FA8D3';
  const secondaryColor = isPlusPlan && branding.secondary_color ? branding.secondary_color : '#FFFFFF';
  const backgroundColor = isPlusPlan && branding.background_color ? branding.background_color : '#F9FAFB';
  const textColor = isPlusPlan && branding.text_color ? branding.text_color : '#111827';
  const fontFamily = isPlusPlan && branding.font_family ? branding.font_family : 'Inter';
  const businessName = isPlusPlan && branding.business_name ? branding.business_name : outlet.name;
  const layout = isPlusPlan && branding.layout === 'split' ? 'split' : 'centered';
  const buttonStyleType = isPlusPlan ? (branding.button_style || 'rounded') : 'rounded';
  const radiusClass = buttonStyleType === 'pill' ? 'rounded-full' : buttonStyleType === 'square' ? 'rounded-md' : 'rounded-xl';

  const coverImage = isPlusPlan && branding.cover_image_url ? branding.cover_image_url : null;
  const logoUrl = isPlusPlan && branding.logo_url ? branding.logo_url : null;

  const buttonStyle = {
    background: primaryColor,
    color: secondaryColor
  };

  const containerClass = layout === 'split'
    ? "min-h-screen flex flex-col lg:flex-row bg-white dark:bg-[#0B0D10]" // Add default bg here as fallback, overridden by style
    : "min-h-screen py-8 px-4 flex items-center justify-center";

  // --- Components ---

  const SocialLink = ({ icon: Icon, url }) => {
    if (!url) return null;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all"
      >
        <Icon size={18} />
      </a>
    );
  };

  const BrandingSide = () => (
    <div className={`
      relative overflow-hidden
      ${layout === 'split' ? 'hidden lg:flex lg:w-5/12 xl:w-1/2 bg-gray-900 text-white p-12 flex-col justify-between' : 'hidden'}
    `}>
      {/* Background Image */}
      {coverImage && (
        <div className="absolute inset-0 z-0">
          <img src={coverImage} alt="Cover" className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-between">
        <div>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl object-cover shadow-2xl mb-6" />
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/10 backdrop-blur-md mb-6">
              <Store size={32} className="text-white" />
            </div>
          )}
          <h1 className="text-4xl font-bold mb-3 tracking-tight">{businessName}</h1>
          <p className="text-lg text-white/80 max-w-md leading-relaxed">{branding.tagline || outlet.address}</p>
        </div>

        <div>
          {branding.welcome_text && (
            <div className="mb-8 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10">
              <h3 className="font-semibold text-lg mb-2">Welcome</h3>
              <p className="text-white/90 leading-relaxed">{branding.welcome_text}</p>
            </div>
          )}

          <div className="flex gap-3">
            <SocialLink icon={Instagram} url={branding.instagram} />
            <SocialLink icon={Facebook} url={branding.facebook} />
            <SocialLink icon={Globe} url={branding.website} />
            {branding.email && <SocialLink icon={Mail} url={`mailto:${branding.email}`} />}
            {branding.phone && <SocialLink icon={Phone} url={`tel:${branding.phone}`} />}
          </div>
        </div>
      </div>
    </div>
  );

  const MobileHeader = () => (
    <div className={`lg:hidden mb-6 ${layout === 'centered' ? 'text-center' : ''}`}>
      <div className="flex items-center gap-4 mb-4">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-14 h-14 rounded-xl object-cover shadow-sm" />
        ) : (
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <Store size={24} />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: textColor }}>{businessName}</h1>
          <p className="text-sm opacity-70" style={{ color: textColor }}>{branding.tagline || outlet.address}</p>
        </div>
      </div>
      {/* Cover Image for mobile if split layout */}
      {layout === 'split' && coverImage && (
        <div className="w-full h-40 rounded-xl overflow-hidden mb-6 relative">
          <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/10" />
        </div>
      )}
    </div>
  );

  return (
    <div className={containerClass} style={{ fontFamily, backgroundColor }}>
      <BrandingSide />

      <div className={`
        flex-1 flex flex-col
        ${layout === 'split' ? 'h-screen overflow-y-auto' : 'w-full max-w-lg'}
      `}>
        <div className={`flex-1 p-6 md:p-12 ${layout === 'split' ? 'max-w-xl mx-auto w-full' : ''}`}>

          {layout === 'centered' && (
            <div className="text-center mb-8">
              {logoUrl && <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl mx-auto mb-4 object-cover shadow-lg" />}
              <h1 className="text-3xl font-bold mb-2" style={{ color: textColor }}>{businessName}</h1>
              <p className="opacity-70" style={{ color: textColor }}>{branding.tagline || 'Book your appointment'}</p>
            </div>
          )}

          {layout === 'split' && <MobileHeader />}

          {/* Progress */}
          {!bookingSuccess && (
            <div className="flex items-center gap-2 mb-8">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-1.5 rounded-full flex-1 transition-all duration-500 ${step >= s ? 'opacity-100' : 'opacity-20'}`} style={{ backgroundColor: primaryColor }} />
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* SUCCESS */}
            {bookingSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={48} className="text-green-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
                <p className="text-gray-600 mb-8">
                  Your appointment is set for {formatDate(selectedDate)} at {selectedTime}.
                </p>
                <div className="bg-gray-50 rounded-2xl p-6 text-left mb-8 border border-gray-100">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                    <span className="text-gray-500">Booking ID</span>
                    <span className="font-mono font-medium">{bookingId?.substring(0, 8).toUpperCase()}</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-gray-700">
                      <Calendar size={18} className="text-gray-400" />
                      {formatDate(selectedDate)}
                    </div>
                    <div className="flex items-center gap-3 text-gray-700">
                      <Clock size={18} className="text-gray-400" />
                      {selectedTime} ({getTotalDuration()} mins)
                    </div>
                    <div className="flex items-center gap-3 text-gray-700">
                      <User size={18} className="text-gray-400" />
                      {selectedResource?.name || 'Any Available Staff'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className={`w-full py-4 text-lg font-semibold shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-transform ${radiusClass}`}
                  style={buttonStyle}
                >
                  Book Another Appointment
                </button>
              </motion.div>
            )}

            {/* STEP 1: DATE & RESOURCE */}
            {step === 1 && !bookingSuccess && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl font-bold mb-6" style={{ color: textColor }}>Select a Date</h2>

                {/* Resource Selector */}
                {activeResources.length > 1 && (
                  <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">Select Specialist</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeResources.map(r => (
                        <button
                          key={r.id}
                          onClick={() => setSelectedResource(r)}
                          className={`p-4 rounded-xl border-2 text-left transition-all hover:bg-gray-50 dark:hover:bg-white/5 ${selectedResource?.id === r.id ? 'border-current bg-opacity-5' : 'border-gray-200 dark:border-gray-800'}`}
                          style={selectedResource?.id === r.id ? { borderColor: primaryColor } : {}}
                        >
                          <div className="font-semibold" style={{ color: textColor }}>{r.name}</div>
                          {r.description && <div className="text-xs text-gray-500 mt-1">{r.description}</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Calendar Strip */}
                <div className="flex items-center justify-between mb-6 bg-gray-50 dark:bg-white/5 p-2 rounded-2xl">
                  <button onClick={() => navigateDate(-1)} className="p-3 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors">
                    <ChevronLeft size={20} className="text-gray-600 dark:text-gray-300" />
                  </button>
                  <div className="text-center">
                    <div className="font-bold text-lg" style={{ color: textColor }}>
                      {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  <button onClick={() => navigateDate(1)} className="p-3 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors">
                    <ChevronRight size={20} className="text-gray-600 dark:text-gray-300" />
                  </button>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={activeResources.length > 1 && !selectedResource}
                  className={`w-full py-4 font-semibold shadow-lg hover:scale-[1.01] transition-all disabled:opacity-50 disabled:scale-100 ${radiusClass}`}
                  style={buttonStyle}
                >
                  Find Available Slots
                </button>
              </motion.div>
            )}

            {/* STEP 2: TIME & SERVICES */}
            {step === 2 && !bookingSuccess && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <button onClick={() => setStep(1)} className="mb-6 text-sm flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors">
                  <ChevronLeft size={16} /> Change Date
                </button>

                <h2 className="text-2xl font-bold mb-6" style={{ color: textColor }}>Select Time & Service</h2>

                {/* Time Slots */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">Available Slots</label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {timeSlots.map(time => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`py-2 px-1 rounded-lg text-sm font-medium transition-all ${selectedTime === time ? 'text-white shadow-md transform scale-105' : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-gray-200'}`}
                        style={selectedTime === time ? { backgroundColor: primaryColor } : {}}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Services */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">Choose Service</label>
                  <div className="space-y-3">
                    {services.filter(s => s.active !== false).map(service => {
                      const isSelected = selectedServices.find(s => s.id === service.id);
                      return (
                        <button
                          key={service.id}
                          onClick={() => toggleService(service)}
                          className={`w-full p-4 rounded-xl border-2 text-left transition-all hover:shadow-sm ${isSelected ? 'border-current bg-opacity-5' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-white/5 hover:border-gray-200'}`}
                          style={isSelected ? { borderColor: primaryColor } : {}}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-bold flex items-center gap-2" style={{ color: textColor }}>
                                {service.name}
                                {isSelected && <CheckCircle size={16} style={{ color: primaryColor }} />}
                              </div>
                              <div className="text-sm text-gray-500 mt-1">{service.duration_min} mins</div>
                            </div>
                            <div className="font-bold bg-gray-100 dark:bg-white/10 px-3 py-1 rounded-lg text-sm" style={{ color: textColor }}>
                              ₹{service.price}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => setStep(3)}
                  disabled={!selectedTime || selectedServices.length === 0}
                  className={`w-full py-4 font-semibold shadow-lg hover:scale-[1.01] transition-all disabled:opacity-50 disabled:scale-100 ${radiusClass}`}
                  style={buttonStyle}
                >
                  Continue
                </button>
              </motion.div>
            )}

            {/* STEP 3: DETAILS */}
            {step === 3 && !bookingSuccess && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <button onClick={() => setStep(2)} className="mb-6 text-sm flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors">
                  <ChevronLeft size={16} /> Back
                </button>

                <h2 className="text-2xl font-bold mb-6" style={{ color: textColor }}>Your Information</h2>

                <div className="space-y-4 mb-8">
                  {enabledFields.map(field => {
                    const Icon = fieldIcons[field.field_name] || MessageSquare;
                    const isTextArea = field.field_name === 'notes';

                    return (
                      <div key={field.field_name} className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Icon size={18} className="text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                        </div>
                        {isTextArea ? (
                          <textarea
                            value={customerInfo[field.field_name]}
                            onChange={e => setCustomerInfo({ ...customerInfo, [field.field_name]: e.target.value })}
                            className="w-full pl-11 pr-4 py-4 bg-gray-50 dark:bg-white/5 border border-transparent focus:bg-white focus:border-purple-200 outline-none rounded-xl transition-all resize-none"
                            placeholder={field.label}
                            rows={3}
                          />
                        ) : (
                          <input
                            type={field.field_name === 'email' ? 'email' : 'text'}
                            value={customerInfo[field.field_name]}
                            onChange={e => setCustomerInfo({ ...customerInfo, [field.field_name]: e.target.value })}
                            className="w-full pl-11 pr-4 py-4 bg-gray-50 dark:bg-white/5 border border-transparent focus:bg-white focus:border-purple-200 outline-none rounded-xl transition-all"
                            placeholder={field.label}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                {error && <div className="mb-6 text-red-500 text-center bg-red-50 p-3 rounded-xl">{error}</div>}

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className={`w-full py-4 font-semibold shadow-lg hover:scale-[1.01] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 ${radiusClass}`}
                  style={buttonStyle}
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Confirming...
                    </>
                  ) : 'Confirm Booking'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {!branding.hide_powered_by && (
            <div className="text-center mt-8 pt-8 border-t border-gray-100 dark:border-white/5">
              <a href="https://riserve.io" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Powered by <span className="font-semibold text-gray-500">Ri&apos;Serve</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicBooking;
