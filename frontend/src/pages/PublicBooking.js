import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Calendar, Clock, User, Phone, Mail, MessageSquare, CheckCircle, ChevronLeft, ChevronRight, Store, Plus, X, Layers } from 'lucide-react';

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
    // Use 30 min default if dynamic duration (0)
    const duration = config.slot_duration_min || 30;

    let current = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;

    while (current + duration <= end) {
      const hour = Math.floor(current / 60);
      const min = current % 60;
      const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

      // Check if this time falls within any break period
      if (!isBreakTime(timeStr)) {
        slots.push(timeStr);
      }
      current += duration;
    }
    return slots;
  };

  // Check if a time slot falls within a break period
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

  // Multi-service helpers
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
        service_id: selectedServices[0]?.id, // For backward compatibility
        customer_name: customerInfo.name,
        customer_phone: customerInfo.phone,
        customer_email: customerInfo.email || null,
        notes: customerInfo.notes || null,

        total_duration: getTotalDuration(),
        total_amount: getTotalPrice()
      });
      setBookingSuccess(true);
      setBookingId(response.data?.booking_id);
      setStep(4);
    } catch (err) {
      // Handle Pydantic validation errors (array of objects) or simple error messages
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        // Extract first error message from Pydantic validation errors
        const firstError = detail[0];
        setError(firstError?.msg || 'Validation error');
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Failed to create booking');
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading booking information...</div>
      </div>
    );
  }

  if (error && !bookingInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
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

  const { outlet, config, services } = bookingInfo;
  const timeSlots = generateTimeSlots();
  const enabledFields = getEnabledFields();

  // Branding config
  const isPlusPlan = config?.plan === 'plus';
  const branding = config?.branding || {};
  const primaryColor = isPlusPlan && branding.primary_color ? branding.primary_color : '#5FA8D3';
  const secondaryColor = isPlusPlan && branding.secondary_color ? branding.secondary_color : '#222222';
  const backgroundColor = isPlusPlan && branding.background_color ? branding.background_color : '#F9FAFB';
  const textColor = isPlusPlan && branding.text_color ? branding.text_color : '#111827';
  const fontFamily = isPlusPlan && branding.font_family ? branding.font_family : 'Inter, system-ui, sans-serif';
  const businessName = isPlusPlan && branding.business_name ? branding.business_name : outlet.name;
  const tagline = isPlusPlan && branding.tagline ? branding.tagline : '';

  const buttonStyle = {
    background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
    color: secondaryColor
  };

  const activeResources = config.resources?.filter(r => r.active !== false) || [];
  const allowMultiService = config?.allow_multiple_services || false;

  return (
    <div
      className="min-h-screen py-8 px-4"
      style={{ fontFamily, backgroundColor }}
      data-testid="public-booking-page"
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 shadow-xl mb-6">
          <div className="flex items-center gap-4">
            {isPlusPlan && branding.logo_url ? (
              <img src={branding.logo_url} alt="Logo" className="w-16 h-16 rounded-2xl object-cover" />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)` }}
              >
                <Store size={32} style={{ color: secondaryColor }} />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold" style={{ color: textColor }}>{businessName}</h1>
              {tagline && <p className="text-sm opacity-70" style={{ color: textColor }}>{tagline}</p>}
              <p className="text-gray-600">{outlet.address}, {outlet.city}</p>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all"
                style={step >= s ? { backgroundColor: primaryColor, color: secondaryColor } : { backgroundColor: '#e5e7eb', color: '#6b7280' }}
              >
                {step > s ? <CheckCircle size={16} /> : s}
              </div>
              {s < 4 && (
                <div
                  className="w-12 h-1 transition-all"
                  style={{ backgroundColor: step > s ? primaryColor : '#e5e7eb' }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Success State */}
        {bookingSuccess ? (
          <div className="bg-white rounded-2xl p-8 shadow-xl text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={40} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
            <p className="text-gray-600 mb-6">
              Your appointment has been scheduled for {formatDate(selectedDate)} at {selectedTime}.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 text-left">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Date:</span>
                  <div className="font-semibold text-gray-900">{formatDate(selectedDate)}</div>
                </div>
                <div>
                  <span className="text-gray-500">Time:</span>
                  <div className="font-semibold text-gray-900">{selectedTime}</div>
                </div>
                {selectedResource && (
                  <div>
                    <span className="text-gray-500">With:</span>
                    <div className="font-semibold text-gray-900">{selectedResource.name}</div>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">Duration:</span>
                  <div className="font-semibold text-gray-900">{getTotalDuration()} mins</div>
                </div>
              </div>

              {selectedServices.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <span className="text-gray-500 text-sm">Services:</span>
                  <div className="space-y-1 mt-1">
                    {selectedServices.map(s => (
                      <div key={s.id} className="flex justify-between text-sm">
                        <span className="font-medium text-gray-900">{s.name}</span>
                        <span className="text-gray-700">₹{s.price}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-gray-200">
                    <span>Total</span>
                    <span>₹{getTotalPrice()}</span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-4">
              {bookingId && `Booking ID: ${bookingId.substring(0, 8).toUpperCase()}`}
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setBookingSuccess(false);
                  setStep(1);
                  setSelectedTime(null);
                  setSelectedServices([]);
                  setCustomerInfo({ name: '', phone: '', email: '', notes: '' });
                }}
                className="flex-1 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-[1.02]"
                style={buttonStyle}
              >
                Book Another
              </button>
              <button
                onClick={() => navigate('/bookings')}
                className="flex-1 px-6 py-3 rounded-xl font-semibold border-2 transition-all hover:scale-[1.02]"
                style={{ borderColor: primaryColor, color: textColor }}
              >
                View Bookings
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Step 1: Select Resource & Date */}
            {step === 1 && (
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4" style={{ color: textColor }}>Select Date</h2>

                {/* Resource Selection (if multiple) */}
                {activeResources.length > 1 && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Choose your preferred provider
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {activeResources.map((resource) => (
                        <button
                          key={resource.id}
                          onClick={() => setSelectedResource(resource)}
                          data-testid={`resource-${resource.id}`}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${selectedResource?.id === resource.id ? '' : 'border-gray-200 hover:border-gray-300'
                            }`}
                          style={selectedResource?.id === resource.id ? { borderColor: primaryColor, backgroundColor: `${primaryColor}15` } : {}}
                        >
                          <div className="font-semibold" style={{ color: textColor }}>{resource.name}</div>
                          {resource.description && (
                            <div className="text-sm text-gray-500">{resource.description}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Date Navigation */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => navigateDate(-1)}
                    disabled={selectedDate.toDateString() === new Date().toDateString()}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <div className="text-center">
                    <div className="text-lg font-bold" style={{ color: textColor }}>{formatDate(selectedDate)}</div>
                  </div>
                  <button onClick={() => navigateDate(1)} className="p-2 rounded-lg hover:bg-gray-100">
                    <ChevronRight size={24} />
                  </button>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={activeResources.length > 1 && !selectedResource}
                  className="w-full py-3 rounded-xl font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 shadow-lg mt-4"
                  style={buttonStyle}
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 2: Select Time & Service */}
            {step === 2 && (
              <div className="p-6">
                <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
                  <ChevronLeft size={16} /> Back
                </button>

                <h2 className="text-xl font-bold mb-4" style={{ color: textColor }}>Select Time & Services</h2>

                {/* Time Slots */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock size={14} className="inline mr-1" />
                    Available Times
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {timeSlots.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`p-3 rounded-xl border-2 font-medium transition-all ${selectedTime === time ? '' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        style={selectedTime === time ? { borderColor: primaryColor, backgroundColor: `${primaryColor}15` } : {}}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Service Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    {allowMultiService ? (
                      <>
                        <Layers size={14} />
                        Select Services (multiple allowed)
                      </>
                    ) : (
                      'Select Service'
                    )}
                  </label>
                  <div className="space-y-2">
                    {services.filter(s => s.active !== false).map((service) => {
                      const isSelected = selectedServices.find(s => s.id === service.id);
                      return (
                        <button
                          key={service.id}
                          onClick={() => toggleService(service)}
                          className={`w-full p-4 rounded-xl border-2 text-left transition-all ${isSelected ? '' : 'border-gray-200 hover:border-gray-300'
                            }`}
                          style={isSelected ? { borderColor: primaryColor, backgroundColor: `${primaryColor}15` } : {}}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              {allowMultiService && (
                                <div
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? '' : 'border-gray-300'}`}
                                  style={isSelected ? { borderColor: primaryColor, backgroundColor: primaryColor } : {}}
                                >
                                  {isSelected && <CheckCircle size={14} style={{ color: secondaryColor }} />}
                                </div>
                              )}
                              <div>
                                <div className="font-semibold" style={{ color: textColor }}>{service.name}</div>
                                <div className="text-sm text-gray-500">{service.duration_min} mins</div>
                              </div>
                            </div>
                            <div className="text-lg font-bold" style={{ color: textColor }}>₹{service.price}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Services Summary */}
                {allowMultiService && selectedServices.length > 0 && (
                  <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: `${primaryColor}10` }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold" style={{ color: textColor }}>Selected Services</span>
                      <span className="text-sm text-gray-500">{selectedServices.length} service(s)</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      {selectedServices.map(s => (
                        <div key={s.id} className="flex justify-between items-center">
                          <span style={{ color: textColor }}>{s.name} ({s.duration_min} mins)</span>
                          <button
                            onClick={() => toggleService(s)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <X size={14} className="text-gray-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-3 pt-3 border-t" style={{ borderColor: `${primaryColor}30` }}>
                      <span className="font-bold" style={{ color: textColor }}>Total: {getTotalDuration()} mins</span>
                      <span className="font-bold" style={{ color: textColor }}>₹{getTotalPrice()}</span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setStep(3)}
                  disabled={!selectedTime || selectedServices.length === 0}
                  className="w-full py-3 rounded-xl font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 shadow-lg"
                  style={buttonStyle}
                >
                  Continue
                </button>
              </div>
            )}

            {/* Step 3: Customer Info */}
            {step === 3 && (
              <div className="p-6">
                <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
                  <ChevronLeft size={16} /> Back
                </button>

                <h2 className="text-xl font-bold mb-4" style={{ color: textColor }}>Your Details</h2>

                {error && (
                  <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-xl text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  {enabledFields.map((field) => {
                    const Icon = fieldIcons[field.field_name] || MessageSquare;
                    const isTextArea = field.field_name === 'notes';
                    const inputType = field.field_name === 'email' ? 'email' : field.field_name === 'phone' ? 'tel' : 'text';

                    return (
                      <div key={field.field_name}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Icon size={14} className="inline mr-1" />
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {isTextArea ? (
                          <textarea
                            value={customerInfo[field.field_name]}
                            onChange={(e) => setCustomerInfo({ ...customerInfo, [field.field_name]: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent"
                            rows={3}
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                          />
                        ) : (
                          <input
                            type={inputType}
                            value={customerInfo[field.field_name]}
                            onChange={(e) => setCustomerInfo({ ...customerInfo, [field.field_name]: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:border-transparent"
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Booking Summary */}
                <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-semibold mb-2" style={{ color: textColor }}>Booking Summary</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} />
                      {formatDate(selectedDate)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={14} />
                      {selectedTime} • {getTotalDuration()} mins
                    </div>
                    {selectedResource && (
                      <div className="flex items-center gap-2">
                        <User size={14} />
                        {selectedResource.name}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    {selectedServices.map(s => (
                      <div key={s.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">{s.name}</span>
                        <span className="font-medium">₹{s.price}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold mt-2 pt-2 border-t border-gray-200" style={{ color: textColor }}>
                      <span>Total</span>
                      <span>₹{getTotalPrice()}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3 rounded-xl font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 shadow-lg mt-6"
                  style={buttonStyle}
                >
                  {submitting ? 'Booking...' : 'Confirm Booking'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-500">
          Powered by <span className="font-semibold">Ri&apos;Serve</span>
        </div>
      </div>
    </div>
  );
};

export default PublicBooking;
