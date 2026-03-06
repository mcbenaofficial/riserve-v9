import React, { useState, useEffect } from 'react';
import { X, User, Car, Wrench, Clock, Calendar, Check, AlertCircle, ChevronDown, Trash2 } from 'lucide-react';
import { api } from '../services/api';

const SlotBookingModal = ({
  isOpen,
  onClose,
  onSuccess,
  slot,
  resource,
  outlet,
  date,
  existingBooking,
  services: externalServices,
  onDelete
}) => {
  const [mode, setMode] = useState('add'); // 'add' or 'manage'
  const [formData, setFormData] = useState({
    customer: '',
    service_id: '',
    resource_id: '',
    outlet_id: '',
    time: '',
    outlet_id: '',
    time: '',
    duration: '',
    amount: 0
  });
  const [status, setStatus] = useState('Pending');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Self-fetch state (used when no outlet/services are passed in)
  const [fetchedOutlets, setFetchedOutlets] = useState([]);
  const [fetchedServices, setFetchedServices] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [fieldConfig, setFieldConfig] = useState([]);
  const [customFields, setCustomFields] = useState({});

  // Promo Code State
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');

  // Determine effective values (prefer props, fallback to self-fetched)
  const effectiveOutlet = outlet || selectedOutlet;
  const effectiveDate = date || selectedDate;
  const effectiveServices = externalServices || fetchedServices;
  const effectiveResources = effectiveOutlet?.resources || [];

  // Self-fetch outlets, services, and field config when not provided
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const promises = [
            api.getBookingFieldsConfig(),
            !outlet ? api.getOutlets() : Promise.resolve(null),
            !externalServices ? api.getServices() : Promise.resolve(null),
            !outlet ? api.getSlotConfigs() : Promise.resolve(null)
          ];
          const results = await Promise.all(promises);

          // Field config
          const fields = (results[0]?.data?.fields || []).filter(f => f.enabled).sort((a, b) => a.order - b.order);
          setFieldConfig(fields);

          if (results[1]) {
            const activeOutlets = results[1].data.filter(o => o.status === 'Active');
            const configs = results[3]?.data || [];
            const outletsWithResources = activeOutlets.map(o => {
              const config = configs.find(c => c.outlet_id === o.id);
              return { ...o, resources: config?.resources?.filter(r => r.active !== false) || [] };
            });
            setFetchedOutlets(outletsWithResources);
            if (outletsWithResources.length > 0 && !selectedOutlet) {
              setSelectedOutlet(outletsWithResources[0]);
            }
          }
          if (results[2]) {
            setFetchedServices(results[2].data.filter(s => s.active));
          }
        } catch (err) {
          console.error('Failed to fetch data for booking modal:', err);
        }
      };
      fetchData();
    }
  }, [isOpen, outlet, externalServices]);

  useEffect(() => {
    if (isOpen) {
      if (existingBooking) {
        setMode('manage');
        setFormData({
          customer: existingBooking.customer,
          service_id: existingBooking.service_id,
          resource_id: existingBooking.resource_id,
          outlet_id: existingBooking.outlet_id || effectiveOutlet?.id || '',
          time: existingBooking.time,
          outlet_id: existingBooking.outlet_id || effectiveOutlet?.id || '',
          time: existingBooking.time,
          duration: existingBooking.duration || existingBooking.duration_minutes || '',
          amount: existingBooking.amount
        });
        setStatus(existingBooking.status);
        // Populate custom fields from existing booking
        setCustomFields({
          customer_name: existingBooking.customer || existingBooking.customer_name || '',
          customer_phone: existingBooking.customer_phone || existingBooking.phone || '',
          customer_email: existingBooking.customer_email || existingBooking.email || '',
          notes: existingBooking.notes || '',
        });
      } else {
        setMode('add');
        setFormData({
          customer: '',
          service_id: '',
          resource_id: resource?.id || effectiveResources[0]?.id || '',
          outlet_id: effectiveOutlet?.id || '',
          time: slot || '09:00',
          time: slot || '09:00',
          duration: '',
          amount: 0
        });
        setStatus('Pending');
        setCustomFields({});
      }
      if (date) setSelectedDate(date);
      setError('');
      setPromoCode('');
      setPromoApplied(null);
      setPromoError('');
    }
  }, [isOpen, existingBooking, slot, resource, outlet, date]);

  const handleServiceChange = (serviceId) => {
    const service = effectiveServices.find(s => s.id === serviceId);
    setFormData({
      ...formData,
      service_id: serviceId,
      service_id: serviceId,
      amount: service ? service.price : 0,
      duration: service ? service.duration_min : formData.duration
    });
    // Reset promo when service changes as amount changes
    setPromoApplied(null);
    setPromoCode('');
    setPromoError('');
  };

  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError('');
    setPromoApplied(null);
    try {
      const res = await api.validatePromotion({
        code: promoCode,
        amount: formData.amount,
        service_id: formData.service_id,
      });
      if (res.data.valid) {
        setPromoApplied(res.data);
      }
    } catch (err) {
      setPromoError(err.response?.data?.detail || 'Invalid promotion code');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'add') {
        // Create new booking
        const bookingData = {
          ...formData,
          ...customFields,
          customer: customFields.customer_name || formData.customer,
          outlet_id: formData.outlet_id || effectiveOutlet?.id,
          date: effectiveDate instanceof Date ? effectiveDate.toISOString().split('T')[0] : effectiveDate,
          promo_code: promoApplied ? promoApplied.applied_code : null
        };
        await api.createBooking(bookingData);
      } else {
        // Update booking: send status + updated resource, time, service
        await api.updateBooking(existingBooking.id, {
          status: status,
          resource_id: formData.resource_id === '' ? null : formData.resource_id,
          time: formData.time,
          service_id: formData.service_id,
          duration: formData.duration,
          amount: formData.amount
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    const dateObj = d instanceof Date ? d : new Date(d);
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const getSelectedService = () => {
    return effectiveServices.find(s => s.id === formData.service_id);
  };

  const handleOutletChange = (outletId) => {
    const selected = fetchedOutlets.find(o => o.id === outletId);
    setSelectedOutlet(selected);
    setFormData(prev => ({
      ...prev,
      outlet_id: outletId,
      resource_id: selected?.resources?.[0]?.id || ''
    }));
  };

  const handleCustomFieldChange = (fieldName, value) => {
    setCustomFields(prev => ({ ...prev, [fieldName]: value }));
    // Keep legacy formData.customer in sync for display
    if (fieldName === 'customer_name') {
      setFormData(prev => ({ ...prev, customer: value }));
    }
  };

  const renderCustomField = (field) => {
    const value = customFields[field.field_name] || '';
    const inputClass = "w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all shadow-sm";

    return (
      <div key={field.field_name}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {(field.field_type === 'textarea' || field.input_type === 'textarea') ? (
          <textarea
            value={value}
            onChange={(e) => handleCustomFieldChange(field.field_name, e.target.value)}
            required={field.required}
            rows={3}
            className={inputClass + ' resize-none'}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          />
        ) : field.field_type === 'select' ? (
          <div className="relative">
            <select
              value={value}
              onChange={(e) => handleCustomFieldChange(field.field_name, e.target.value)}
              required={field.required}
              className={inputClass + ' appearance-none'}
            >
              <option value="">Select {field.label.toLowerCase()}</option>
              {(field.options || []).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <ChevronDown size={16} />
            </div>
          </div>
        ) : (
          <input
            type={field.field_type === 'phone' ? 'tel' : field.field_type === 'email' ? 'email' : field.field_type || 'text'}
            value={value}
            onChange={(e) => handleCustomFieldChange(field.field_name, e.target.value)}
            required={field.required}
            className={inputClass}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          />
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-panel w-full max-w-md rounded-3xl overflow-hidden shadow-2xl bg-white dark:bg-[#171C22] transition-colors duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              {mode === 'add' ? 'New Booking' : 'Manage Booking'}
            </h3>
            {(slot || effectiveOutlet) && (
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                {effectiveResources.find(r => r.id === formData.resource_id)?.name && (
                  <><span>{effectiveResources.find(r => r.id === formData.resource_id)?.name}</span><span>•</span></>
                )}
                {slot && <><Clock size={14} /><span>{slot}</span><span>•</span></>}
                <Calendar size={14} />
                <span>{formatDate(effectiveDate)}</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-all text-gray-500 dark:text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Outlet Info */}
        {effectiveOutlet && (
          <div className="px-6 py-3 bg-gray-50 dark:bg-[#0B0D10]/50 border-b border-gray-200 dark:border-white/5">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5FA8D3] to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Wrench size={14} className="text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">{effectiveOutlet?.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{effectiveOutlet?.city}</div>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {mode === 'add' ? (
            <>
              {/* Dynamic Custom Fields from Config */}
              {fieldConfig.length > 0 ? (
                fieldConfig.map(field => renderCustomField(field))
              ) : (
                /* Fallback: hardcoded customer name if no config loaded */
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <User size={14} className="inline mr-1" />
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customer}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all shadow-sm"
                    placeholder="Enter customer name"
                  />
                </div>
              )}

              {/* Outlet Selector (only when no outlet prop passed) */}
              {!outlet && fetchedOutlets.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Wrench size={14} className="inline mr-1" />
                    Outlet
                  </label>
                  <div className="relative">
                    <select
                      required
                      value={formData.outlet_id}
                      onChange={(e) => handleOutletChange(e.target.value)}
                      className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all shadow-sm appearance-none"
                    >
                      <option value="">Select outlet</option>
                      {fetchedOutlets.map(o => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>
              )}

              {/* Date Selector (only when no date prop passed) */}
              {!date && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Calendar size={14} className="inline mr-1" />
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={selectedDate instanceof Date ? selectedDate.toISOString().split('T')[0] : selectedDate}
                    onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
                    className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all shadow-sm"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              {/* Existing Booking Identity Summary */}
              <div className="p-4 bg-gray-50 dark:bg-[#0B0D10] rounded-xl border border-gray-200 dark:border-white/10 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#5FA8D3] to-blue-600 flex items-center justify-center font-bold text-white shadow-md">
                    {(formData.customer || '?').charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{formData.customer || 'Unknown Customer'}</div>
                    {customFields.customer_email || customFields.customer_phone ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {[customFields.customer_email, customFields.customer_phone].filter(Boolean).join(' • ')}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* SHARED FIELDS: Service, Resource, Time (Available in both Add and Manage modes) */}
          <div className="space-y-4 border-t border-gray-200 dark:border-white/5 pt-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Appointment Details
            </label>

            {/* Service Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Wrench size={14} className="inline mr-1" />
                Service
              </label>
              <div className="relative">
                <select
                  required
                  value={formData.service_id}
                  onChange={(e) => handleServiceChange(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all shadow-sm appearance-none"
                >
                  <option value="">Select a service</option>
                  {effectiveServices.filter(s => s.active !== false || s.id === formData.service_id).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {s.duration_min} mins - ₹{s.price}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            {/* Resource & Time Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <User size={14} className="inline mr-1" />
                  Resource
                </label>
                <div className="relative">
                  <select
                    value={formData.resource_id || ''}
                    onChange={(e) => setFormData({ ...formData, resource_id: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all shadow-sm appearance-none"
                  >
                    <option value="">-- Unassigned --</option>
                    {effectiveResources.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                    <ChevronDown size={16} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Clock size={14} className="inline mr-1" />
                  Time
                </label>
                <input
                  type="time"
                  required
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full px-4 py-3 bg-white dark:bg-[#0B0D10] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all shadow-sm"
                />
              </div>
            </div>
          </div>

          {mode === 'add' ? (
            <>

              {/* Service Details */}
              {getSelectedService() && (
                <div className="p-4 bg-[#5FA8D3]/10 rounded-xl border border-[#5FA8D3]/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {getSelectedService().name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Duration: {getSelectedService().duration_min} minutes
                      </div>
                    </div>
                    <div className="text-right">
                      {promoApplied ? (
                        <>
                          <div className="text-sm text-gray-400 line-through">₹{formData.amount}</div>
                          <div className="text-2xl font-bold text-green-500 dark:text-green-400">₹{promoApplied.final_price}</div>
                        </>
                      ) : (
                        <div className="text-2xl font-bold text-gray-900 dark:text-white">₹{formData.amount}</div>
                      )}
                    </div>
                  </div>

                  {/* Promo Code Input */}
                  <div className="mt-4 pt-3 border-t border-[#5FA8D3]/20">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                      Promo Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        placeholder="Enter code"
                        className="flex-1 px-3 py-2 bg-white dark:bg-[#0B0D10] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-1 focus:ring-[#5FA8D3] focus:border-transparent uppercase shadow-sm"
                        disabled={!!promoApplied}
                      />
                      {promoApplied ? (
                        <button
                          type="button"
                          onClick={() => { setPromoApplied(null); setPromoCode(''); }}
                          className="px-3 py-2 rounded-lg bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={applyPromo}
                          disabled={!promoCode || promoLoading}
                          className="px-3 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-black hover:opacity-90 disabled:opacity-50 text-sm font-medium transition-colors shadow-sm"
                        >
                          {promoLoading ? '...' : 'Apply'}
                        </button>
                      )}
                    </div>
                    {promoError && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{promoError}</p>}
                    {promoApplied && (
                      <div className="mt-2 text-xs text-green-600 dark:text-green-400 flex justify-between font-bold bg-green-50 dark:bg-green-500/10 p-2 rounded-lg border border-green-100 dark:border-green-500/20">
                        <span>Discount Applied ({promoApplied.applied_code})</span>
                        <span>-₹{promoApplied.discount_amount}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <> {/* Manage Mode Exclusives: Status Update & existing info */}
              <div className="space-y-4">
                {/* Status Update */}
                <div className="pt-4 border-t border-gray-200 dark:border-white/5">
                  <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Update Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Pending', 'In Progress', 'Completed', 'Cancelled'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
                        className={`p-3 rounded-xl border text-sm font-medium transition-all shadow-sm ${status === s
                          ? s === 'Completed'
                            ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-500/20 dark:border-green-500/50 dark:text-green-400'
                            : s === 'In Progress'
                              ? 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-500/20 dark:border-amber-500/50 dark:text-amber-400'
                              : s === 'Cancelled'
                                ? 'bg-red-100 border-red-300 text-red-800 dark:bg-red-500/20 dark:border-red-500/50 dark:text-red-400'
                                : 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-500/20 dark:border-blue-500/50 dark:text-blue-400'
                          : 'bg-white dark:bg-[#0B0D10] border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'
                          }`}
                      >
                        {status === s && <Check size={14} className="inline mr-1" />}
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {mode === 'manage' && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this booking?')) {
                    onDelete();
                    onClose();
                  }
                }}
                className="px-4 py-3 border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all font-medium"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="cosmic-btn flex-1 px-4 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
            >
              {loading ? 'Processing...' : mode === 'add' ? 'Book Slot' : 'Update Status'}
            </button>
          </div>
        </form >
      </div >
    </div >
  );
};

export default SlotBookingModal;
