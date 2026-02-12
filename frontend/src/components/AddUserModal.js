import React, { useState } from 'react';
import { X, User, Mail, Phone, Shield, Eye, EyeOff } from 'lucide-react';

const AddUserModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Staff',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      setError('Name, Email, and Password are required');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(formData);
      setFormData({ name: '', email: '', phone: '', role: 'Staff', password: '' });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#2E2E2E] rounded-3xl p-8 w-full max-w-md border border-[#D9DEE5] dark:border-[#333333] shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-[#6B7280] dark:text-[#7D8590] hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-6">Add New User</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              <User size={16} className="inline mr-2" />
              Full Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter full name"
              className="w-full px-4 py-3 rounded-xl border border-[#D9DEE5] dark:border-[#333333] bg-white dark:bg-[#1b1b1b] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              <Mail size={16} className="inline mr-2" />
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="user@example.com"
              className="w-full px-4 py-3 rounded-xl border border-[#D9DEE5] dark:border-[#333333] bg-white dark:bg-[#1b1b1b] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              <Phone size={16} className="inline mr-2" />
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+91 98765 43210"
              className="w-full px-4 py-3 rounded-xl border border-[#D9DEE5] dark:border-[#333333] bg-white dark:bg-[#1b1b1b] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              <Shield size={16} className="inline mr-2" />
              Role
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border border-[#D9DEE5] dark:border-[#333333] bg-white dark:bg-[#1b1b1b] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all"
            >
              <option value="Staff">Staff</option>
              <option value="Manager">Manager</option>
              <option value="Admin">Admin</option>
              <option value="Owner">Owner</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password"
                className="w-full px-4 py-3 rounded-xl border border-[#D9DEE5] dark:border-[#333333] bg-white dark:bg-[#1b1b1b] text-[#0E1116] dark:text-[#E6E8EB] focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent transition-all pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] dark:text-[#7D8590] hover:text-[#4B5563] dark:hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="cosmic-btn w-full py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mt-6"
          >
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;
