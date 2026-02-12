import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/api';
import {
  User, Mail, Phone, Building2, Shield, Camera, Save,
  Lock, Eye, EyeOff, CheckCircle, AlertCircle
} from 'lucide-react';

const ProfileSettings = () => {
  const { user, refreshUser } = useAuth();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.updateProfile(profile);
      setSuccess('Profile updated successfully');
      if (refreshUser) refreshUser();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('New passwords do not match');
      return;
    }

    if (passwordForm.new_password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setChangingPassword(true);
    setError('');
    setSuccess('');

    try {
      await api.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      setSuccess('Password changed successfully');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const inputClass = `w-full px-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent ${theme === 'dark'
      ? 'bg-[#0B0D10]/50 border-[#1F2630] text-[#E6E8EB] placeholder:text-[#7D8590]'
      : 'bg-white/50 border-[#D9DEE5] text-[#0E1116] placeholder:text-[#6B7280]'
    }`;

  const labelClass = `block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-[#A9AFB8]' : 'text-[#4B5563]'
    }`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className={`rounded-3xl p-6 border ${theme === 'dark'
          ? 'bg-white/5 backdrop-blur-xl border-[#1F2630]'
          : 'bg-white/90 border-[#D9DEE5]'
        }`}>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center shadow-lg">
              <span className="text-3xl font-bold text-white">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
              Profile Settings
            </h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
              Manage your account information and security
            </p>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">
          <CheckCircle size={18} />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Profile Information */}
      <div className={`rounded-3xl p-6 border ${theme === 'dark'
          ? 'bg-white/5 backdrop-blur-xl border-[#1F2630]'
          : 'bg-white/90 border-[#D9DEE5]'
        }`}>
        <h2 className={`text-lg font-semibold mb-6 flex items-center gap-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'
          }`}>
          <User size={20} className="text-[#5FA8D3]" />
          Personal Information
        </h2>

        <form onSubmit={handleProfileUpdate} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>Full Name</label>
              <div className="relative">
                <User size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'
                  }`} />
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className={`${inputClass} pl-12`}
                  placeholder="Your name"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Email Address</label>
              <div className="relative">
                <Mail size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'
                  }`} />
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className={`${inputClass} pl-12`}
                  placeholder="your@email.com"
                  disabled
                />
              </div>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                Email cannot be changed
              </p>
            </div>

            <div>
              <label className={labelClass}>Phone Number</label>
              <div className="relative">
                <Phone size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'
                  }`} />
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className={`${inputClass} pl-12`}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Role</label>
              <div className="relative">
                <Shield size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'
                  }`} />
                <input
                  type="text"
                  value={user?.role || 'User'}
                  className={`${inputClass} pl-12`}
                  disabled
                />
              </div>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                Contact admin to change role
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-[#5FA8D3] text-white rounded-xl font-semibold hover:bg-[#4A95C0] transition-all disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className={`rounded-3xl p-6 border ${theme === 'dark'
          ? 'bg-white/5 backdrop-blur-xl border-[#1F2630]'
          : 'bg-white/90 border-[#D9DEE5]'
        }`}>
        <h2 className={`text-lg font-semibold mb-6 flex items-center gap-2 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'
          }`}>
          <Lock size={20} className="text-[#5FA8D3]" />
          Change Password
        </h2>

        <form onSubmit={handlePasswordChange} className="space-y-5">
          <div>
            <label className={labelClass}>Current Password</label>
            <div className="relative">
              <Lock size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'
                }`} />
              <input
                type={showPasswords.current ? 'text' : 'password'}
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                className={`${inputClass} pl-12 pr-12`}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                className={`absolute right-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-[#7D8590] hover:text-[#E6E8EB]' : 'text-[#6B7280] hover:text-[#0E1116]'
                  }`}
              >
                {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClass}>New Password</label>
              <div className="relative">
                <Lock size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'
                  }`} />
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  className={`${inputClass} pl-12 pr-12`}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-[#7D8590] hover:text-[#E6E8EB]' : 'text-[#6B7280] hover:text-[#0E1116]'
                    }`}
                >
                  {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className={labelClass}>Confirm New Password</label>
              <div className="relative">
                <Lock size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'
                  }`} />
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  className={`${inputClass} pl-12 pr-12`}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-[#7D8590] hover:text-[#E6E8EB]' : 'text-[#6B7280] hover:text-[#0E1116]'
                    }`}
                >
                  {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={changingPassword || !passwordForm.current_password || !passwordForm.new_password}
              className="flex items-center gap-2 px-6 py-3 bg-[#5FA8D3] text-white rounded-xl font-semibold hover:bg-[#4A95C0] transition-all disabled:opacity-50"
            >
              <Lock size={18} />
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;
