import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import NotificationsPanel from './NotificationsPanel';
import { User, Settings, LogOut, ChevronDown, Zap, Coffee } from 'lucide-react';
import { AtomicPowerIcon } from 'hugeicons-react';

const Topbar = ({ onToggleAgent }) => {
  const { user, logout } = useAuth();
  const { theme, mode, toggleMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/bookings')) return 'Bookings';
    if (path.startsWith('/outlets')) return 'Outlets';
    if (path.startsWith('/services')) return 'Services';
    if (path.startsWith('/finance')) return 'Finance';
    if (path.startsWith('/reports')) return 'Reports';
    if (path.startsWith('/users')) return 'Users';
    if (path.startsWith('/support')) return 'Support';
    return "Ri'Serve";
  };

  const handleLogout = () => {
    setShowDropdown(false);
    logout();
    navigate('/login');
  };

  const handleProfileSettings = () => {
    setShowDropdown(false);
    navigate('/profile');
  };

  return (
    <header className={`flex items-center justify-between px-8 py-5 border-b ${theme === 'dark' ? 'border-[#1F2630] bg-[#0B0D10]/80' : 'border-white/50 bg-white/70'} backdrop-blur-xl sticky top-0 z-50`}>
      <div className="flex items-center gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{getPageTitle()}</h1>
          <p className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
            Welcome back, <span className={`font-semibold ${theme === 'dark' ? 'text-[#A9AFB8]' : 'text-[#0E1116]'}`}>{user?.name || 'Partner'}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Global AI Chat Trigger */}
        <button
          onClick={onToggleAgent}
          className={`p-2 rounded-full transition-all ${theme === 'dark'
            ? mode === 'zen' ? 'bg-[#687988]/10 text-[#687988] hover:bg-[#687988]/20' : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
            : mode === 'zen' ? 'bg-[#687988]/10 text-[#687988] hover:bg-[#687988]/20' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
            }`}
          title="Open AI Chat"
        >
          <AtomicPowerIcon size={20} />
        </button>

        {/* Notifications */}
        <NotificationsPanel />

        {/* User Menu with Dropdown */}
        <div className={`relative flex items-center gap-3 pl-4 border-l ${theme === 'dark' ? 'border-[#1F2630]' : 'border-[#D9DEE5]'}`} ref={dropdownRef}>
          <div className="text-right">
            <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{user?.name}</div>
            <div className={`text-xs ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{user?.role}</div>
          </div>

          {/* Profile Button */}
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={`flex items-center gap-2 p-1 rounded-full transition-all ${showDropdown
              ? 'ring-2 ring-[#5FA8D3] ring-offset-2 ' + (theme === 'dark' ? 'ring-offset-[#12161C]' : 'ring-offset-white')
              : ''
              }`}
            data-testid="profile-dropdown-btn"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg bg-[#5FA8D3]">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <ChevronDown
              size={16}
              className={`transition-transform ${showDropdown ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}
            />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl shadow-xl border overflow-hidden z-50 ${theme === 'dark'
              ? 'bg-[#171C22] border-[#1F2630]'
              : 'bg-white border-[#D9DEE5]'
              }`}>
              {/* User Info Header */}
              <div className={`px-4 py-3 border-b ${theme === 'dark' ? 'border-[#1F2630]' : 'border-[#D9DEE5]'}`}>
                <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  {user?.name}
                </div>
                <div className={`text-xs ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  {user?.email}
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <button
                  onClick={handleProfileSettings}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all ${theme === 'dark'
                    ? 'text-[#E6E8EB] hover:bg-[#1F2630]'
                    : 'text-[#0E1116] hover:bg-[#F6F7F9]'
                    }`}
                  data-testid="profile-settings-btn"
                >
                  <Settings size={18} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                  Profile Settings
                </button>

                <button
                  onClick={() => {
                    toggleMode();
                    setShowDropdown(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all ${theme === 'dark'
                    ? 'text-[#E6E8EB] hover:bg-[#1F2630]'
                    : 'text-[#0E1116] hover:bg-[#F6F7F9]'
                    }`}
                >
                  {mode === 'zen' ? (
                    <Zap size={18} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                  ) : (
                    <Coffee size={18} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                  )}
                  {mode === 'zen' ? 'Switch to Vivid Mode' : 'Switch to Zen Mode'}
                </button>

                <div className={`mx-3 border-t ${theme === 'dark' ? 'border-[#1F2630]' : 'border-[#D9DEE5]'}`} />

                <button
                  onClick={handleLogout}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20`}
                  data-testid="sign-out-btn"
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
