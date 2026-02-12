import React, { useState, useEffect } from 'react';
import {
    GripVertical, Eye, EyeOff, Asterisk, Save, RotateCcw,
    Type, Phone, Mail, FileText, Hash, Calendar, ChevronDown,
    Check, AlertCircle, Loader2
} from 'lucide-react';
import { api } from '../../services/api';

const FIELD_TYPE_ICONS = {
    text: Type,
    phone: Phone,
    email: Mail,
    textarea: FileText,
    number: Hash,
    date: Calendar,
    select: ChevronDown,
};

const AdminBookingForm = () => {
    const [fields, setFields] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await api.getBookingFieldsConfig();
            const sorted = (res.data.fields || []).sort((a, b) => a.order - b.order);
            setFields(sorted);
            setHasChanges(false);
        } catch (err) {
            setError('Failed to load booking form configuration');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateField = (index, key, value) => {
        setFields(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [key]: value };
            return updated;
        });
        setHasChanges(true);
        setSaved(false);
    };

    const moveField = (index, direction) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= fields.length) return;

        setFields(prev => {
            const updated = [...prev];
            const temp = updated[index];
            updated[index] = updated[newIndex];
            updated[newIndex] = temp;
            // Update order values
            return updated.map((f, i) => ({ ...f, order: i + 1 }));
        });
        setHasChanges(true);
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            await api.updateBookingFieldsConfig({ fields });
            setSaved(true);
            setHasChanges(false);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to save configuration');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        fetchConfig();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={24} className="animate-spin text-purple-400" />
                <span className="ml-3 text-gray-500 dark:text-gray-400">Loading form configuration...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Booking Form Fields</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Customize which fields appear on the booking form. Toggle visibility, set required fields, and reorder.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {hasChanges && (
                        <button
                            onClick={handleReset}
                            className="px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all font-medium flex items-center gap-2"
                        >
                            <RotateCcw size={16} />
                            Reset
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className="px-5 py-2 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)' }}
                    >
                        {saving ? (
                            <><Loader2 size={16} className="animate-spin" /> Saving...</>
                        ) : saved ? (
                            <><Check size={16} /> Saved!</>
                        ) : (
                            <><Save size={16} /> Save Changes</>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {/* Field Cards */}
            <div className="space-y-3">
                {fields.map((field, index) => {
                    const IconComp = FIELD_TYPE_ICONS[field.field_type || field.input_type] || Type;
                    return (
                        <div
                            key={field.field_name}
                            className={`group glass-panel rounded-2xl border transition-all duration-300 ${field.enabled
                                    ? 'border-gray-200 dark:border-white/10 hover:border-purple-500/30'
                                    : 'border-gray-200/50 dark:border-white/5 opacity-60'
                                }`}
                        >
                            <div className="flex items-center gap-4 p-4">
                                {/* Drag Handle / Order */}
                                <div className="flex flex-col items-center gap-1">
                                    <button
                                        onClick={() => moveField(index, -1)}
                                        disabled={index === 0}
                                        className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title="Move up"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6" /></svg>
                                    </button>
                                    <GripVertical size={16} className="text-gray-300 dark:text-gray-600" />
                                    <button
                                        onClick={() => moveField(index, 1)}
                                        disabled={index === fields.length - 1}
                                        className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title="Move down"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                                    </button>
                                </div>

                                {/* Field Type Icon */}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${field.enabled
                                        ? 'bg-purple-500/10 text-purple-500 dark:text-purple-400'
                                        : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600'
                                    }`}>
                                    <IconComp size={18} />
                                </div>

                                {/* Field Info */}
                                <div className="flex-1 min-w-0">
                                    <input
                                        type="text"
                                        value={field.label}
                                        onChange={(e) => updateField(index, 'label', e.target.value)}
                                        className="text-sm font-semibold text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 w-full p-0"
                                        placeholder="Field label"
                                    />
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                                            {field.field_name}
                                        </span>
                                        <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                                            {field.field_type || field.input_type || 'text'}
                                        </span>
                                    </div>
                                </div>

                                {/* Required Toggle */}
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer select-none" title="Required">
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Required</span>
                                        <button
                                            onClick={() => updateField(index, 'required', !field.required)}
                                            className={`relative w-10 h-5 rounded-full transition-all duration-300 ${field.required
                                                    ? 'bg-amber-500'
                                                    : 'bg-gray-200 dark:bg-white/10'
                                                }`}
                                        >
                                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${field.required ? 'left-5' : 'left-0.5'
                                                }`} />
                                        </button>
                                    </label>
                                </div>

                                {/* Enabled Toggle */}
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer select-none" title="Visible">
                                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Visible</span>
                                        <button
                                            onClick={() => updateField(index, 'enabled', !field.enabled)}
                                            className={`relative w-10 h-5 rounded-full transition-all duration-300 ${field.enabled
                                                    ? 'bg-purple-500'
                                                    : 'bg-gray-200 dark:bg-white/10'
                                                }`}
                                        >
                                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${field.enabled ? 'left-5' : 'left-0.5'
                                                }`} />
                                        </button>
                                    </label>
                                </div>
                            </div>

                            {/* Expanded Settings (placeholder for future) */}
                            {field.field_type === 'select' && field.enabled && (
                                <div className="px-4 pb-4 pt-0 border-t border-gray-100 dark:border-white/5 mt-0">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-3 mb-1">Options (comma-separated)</div>
                                    <input
                                        type="text"
                                        value={(field.options || []).join(', ')}
                                        onChange={(e) => updateField(index, 'options', e.target.value.split(',').map(o => o.trim()).filter(Boolean))}
                                        className="w-full px-3 py-2 bg-white dark:bg-[#0B0D10] border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white"
                                        placeholder="Option 1, Option 2, Option 3"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Preview Section */}
            <div className="glass-panel rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <Eye size={14} />
                        Form Preview
                    </h3>
                </div>
                <div className="p-6 bg-gray-50 dark:bg-[#0B0D10]/50">
                    <div className="max-w-sm mx-auto space-y-4">
                        {fields.filter(f => f.enabled).sort((a, b) => a.order - b.order).map(field => (
                            <div key={field.field_name}>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    {field.label}
                                    {field.required && <span className="text-red-400 ml-1">*</span>}
                                </label>
                                {field.field_type === 'textarea' || field.input_type === 'textarea' ? (
                                    <div className="w-full px-3 py-2 bg-white dark:bg-[#171C22] border border-gray-200 dark:border-white/10 rounded-xl text-gray-400 dark:text-gray-600 text-sm h-20">
                                        {field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                    </div>
                                ) : field.field_type === 'select' ? (
                                    <div className="w-full px-3 py-2.5 bg-white dark:bg-[#171C22] border border-gray-200 dark:border-white/10 rounded-xl text-gray-400 dark:text-gray-600 text-sm flex items-center justify-between">
                                        <span>Select {field.label.toLowerCase()}</span>
                                        <ChevronDown size={14} />
                                    </div>
                                ) : (
                                    <div className="w-full px-3 py-2.5 bg-white dark:bg-[#171C22] border border-gray-200 dark:border-white/10 rounded-xl text-gray-400 dark:text-gray-600 text-sm">
                                        {field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                    </div>
                                )}
                            </div>
                        ))}
                        {fields.filter(f => f.enabled).length === 0 && (
                            <div className="text-center py-8 text-gray-400 dark:text-gray-600">
                                No fields enabled. Toggle fields on above.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminBookingForm;
