import React, { useState } from 'react';
import { Building2, User, Mail, Phone, Lock, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
import { api } from '../services/api';

const Signup = ({ theme, mode, onLogin }) => {
  const [formData, setFormData] = useState({
    company_name: '',
    business_type: '',
    admin_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const businessTypes = [
    'Car Wash / Auto Care',
    'Salon / Spa',
    'Clinic / Healthcare',
    'Restaurant / Cafe',
    'Gym / Fitness',
    'Repair Shop',
    'Consulting',
    'Other'
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.signup({
        company_name: formData.company_name,
        business_type: formData.business_type,
        admin_name: formData.admin_name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      });

      setSuccess(true);

      // Auto-login with the returned token
      setTimeout(() => {
        if (response.data.token && onLogin) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          onLogin(response.data.user);
          window.location.href = '/onboarding';
        }
      }, 2000);

    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-[#0B0D10]' : 'bg-[#F6F7F9]'}`}>
        <div className={`w-full max-w-md p-8 rounded-3xl text-center ${theme === 'dark' ? 'bg-white/5 backdrop-blur-xl border border-[#1F2630]' : 'bg-white border border-[#D9DEE5]'} shadow-xl`}>
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            Welcome to Ri'Serve!
          </h2>
          <p className={`mb-4 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
            Your 30-day trial has started. Redirecting to your dashboard...
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5FA8D3] mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex ${theme === 'dark' ? 'bg-[#0B0D10]' : 'bg-[#F6F7F9]'}`}>
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <img src={mode === 'zen' ? '/logo-zen.png' : '/logo-dark.png'} alt="Logo" className="w-12 h-12" />
            <span className="text-2xl font-bold text-white uppercase tracking-wider">{mode === 'zen' ? "RI'SERVE" : "RI'SERVE"}</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-6">
            Start Your Free 30-Day Trial
          </h1>
          <p className="text-white/80 text-lg mb-8">
            Join thousands of service businesses using Ri'Serve to manage bookings,
            customers, and operations efficiently.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 text-white/90">
            <CheckCircle size={20} />
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-3 text-white/90">
            <CheckCircle size={20} />
            <span>Full access to all features</span>
          </div>
          <div className="flex items-center gap-3 text-white/90">
            <CheckCircle size={20} />
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Signup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <img src={mode === 'zen' ? '/logo-zen.png' : (theme === 'dark' ? '/logo-dark.png' : '/logo-light.png')} alt="Logo" className="w-10 h-10" />
            <span className={`text-xl font-bold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'} uppercase tracking-wider`}>RI'SERVE</span>
          </div>

          <div className="flex items-center gap-2 mb-6">
            <Sparkles size={20} className="text-[#5FA8D3]" />
            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-[#5FA8D3]' : 'text-[#5FA8D3]'}`}>
              30-Day Free Trial
            </span>
          </div>

          <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            Create your account
          </h2>
          <p className={`mb-8 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
            Get started with your service operations platform
          </p>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Company Name */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                Company Name
              </label>
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-white/5 border border-[#1F2630]' : 'bg-white border border-[#D9DEE5]'}`}>
                <Building2 size={18} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  placeholder="Your Company Name"
                  required
                  className={`flex-1 bg-transparent border-none outline-none ${theme === 'dark' ? 'text-[#E6E8EB] placeholder-[#7D8590]' : 'text-[#0E1116] placeholder-[#6B7280]'}`}
                />
              </div>
            </div>

            {/* Business Type */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                Business Type
              </label>
              <select
                name="business_type"
                value={formData.business_type}
                onChange={handleChange}
                required
                className={`w-full px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-white/5 border border-[#1F2630] text-[#E6E8EB]' : 'bg-white border border-[#D9DEE5] text-[#0E1116]'} outline-none`}
              >
                <option value="">Select your business type</option>
                {businessTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Admin Name */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                Your Name
              </label>
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-white/5 border border-[#1F2630]' : 'bg-white border border-[#D9DEE5]'}`}>
                <User size={18} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                <input
                  type="text"
                  name="admin_name"
                  value={formData.admin_name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                  className={`flex-1 bg-transparent border-none outline-none ${theme === 'dark' ? 'text-[#E6E8EB] placeholder-[#7D8590]' : 'text-[#0E1116] placeholder-[#6B7280]'}`}
                />
              </div>
            </div>

            {/* Email & Phone Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  Email
                </label>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-white/5 border border-[#1F2630]' : 'bg-white border border-[#D9DEE5]'}`}>
                  <Mail size={18} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@company.com"
                    required
                    className={`flex-1 bg-transparent border-none outline-none ${theme === 'dark' ? 'text-[#E6E8EB] placeholder-[#7D8590]' : 'text-[#0E1116] placeholder-[#6B7280]'}`}
                  />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  Phone (Optional)
                </label>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-white/5 border border-[#1F2630]' : 'bg-white border border-[#D9DEE5]'}`}>
                  <Phone size={18} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                    className={`flex-1 bg-transparent border-none outline-none ${theme === 'dark' ? 'text-[#E6E8EB] placeholder-[#7D8590]' : 'text-[#0E1116] placeholder-[#6B7280]'}`}
                  />
                </div>
              </div>
            </div>

            {/* Password Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  Password
                </label>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-white/5 border border-[#1F2630]' : 'bg-white border border-[#D9DEE5]'}`}>
                  <Lock size={18} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className={`flex-1 bg-transparent border-none outline-none ${theme === 'dark' ? 'text-[#E6E8EB] placeholder-[#7D8590]' : 'text-[#0E1116] placeholder-[#6B7280]'}`}
                  />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  Confirm Password
                </label>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${theme === 'dark' ? 'bg-white/5 border border-[#1F2630]' : 'bg-white border border-[#D9DEE5]'}`}>
                  <Lock size={18} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                  <input
                    type="password"
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    className={`flex-1 bg-transparent border-none outline-none ${theme === 'dark' ? 'text-[#E6E8EB] placeholder-[#7D8590]' : 'text-[#0E1116] placeholder-[#6B7280]'}`}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#5FA8D3] hover:bg-[#4A95C0] text-white font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  Start Free Trial <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className={`mt-6 text-center text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
            Already have an account?{' '}
            <a href="/login" className="text-[#5FA8D3] hover:underline font-medium">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
