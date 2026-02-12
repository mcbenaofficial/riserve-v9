import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, X, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const NotificationsPanel = () => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'booking',
      title: 'New Booking Received',
      message: 'Customer John Doe booked Premium Wash service',
      time: '5 minutes ago',
      read: false,
      icon: Calendar
    },
    {
      id: 2,
      type: 'payment',
      title: 'Payment Settled',
      message: '₹25,000 has been settled to your account',
      time: '1 hour ago',
      read: false,
      icon: DollarSign
    },
    {
      id: 3,
      type: 'alert',
      title: 'Outlet Maintenance Due',
      message: 'Chennai Outlet #3 requires maintenance check',
      time: '3 hours ago',
      read: true,
      icon: AlertCircle
    }
  ]);

  const panelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const clearNotification = (id) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'booking':
        return 'from-blue-500 to-blue-600';
      case 'payment':
        return 'from-green-500 to-green-600';
      case 'alert':
        return 'from-yellow-500 to-yellow-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        data-testid="notifications-btn"
        className={`relative p-3 rounded-xl transition-all backdrop-blur-sm ${
          theme === 'dark' 
            ? 'hover:bg-[#1F2630]' 
            : 'hover:bg-[#ECEFF3] border border-[#D9DEE5]'
        }`}
      >
        <Bell size={20} className={theme === 'dark' ? 'text-white' : 'text-[#4B5563]'} />
        {unreadCount > 0 && (
          <div className="absolute -right-1 -top-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-[#222] shadow-lg animate-pulse" style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}>
            {unreadCount}
          </div>
        )}
      </button>

      {/* Notifications Panel */}
      {isOpen && (
        <div className={`absolute right-0 mt-2 w-96 backdrop-blur-xl rounded-2xl border shadow-2xl z-50 overflow-hidden ${
          theme === 'dark' 
            ? 'bg-[#171C22] border-[#1F2630]' 
            : 'bg-white border-[#D9DEE5]'
        }`}>
          {/* Header */}
          <div className={`p-4 border-b flex items-center justify-between ${
            theme === 'dark' ? 'border-[#1F2630]' : 'border-[#D9DEE5]'
          }`}>
            <div>
              <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-[#0E1116]'}`}>Notifications</h3>
              <p className={`text-xs ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{unreadCount} unread</p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-[#5FA8D3] hover:text-[#4A95C0] font-medium transition-colors flex items-center gap-1"
              >
                <Check size={14} />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={48} className={theme === 'dark' ? 'text-white/20' : 'text-gray-300'} />
                <p className={`text-sm mt-4 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>No notifications</p>
              </div>
            ) : (
              <div className={`divide-y ${theme === 'dark' ? 'divide-white/10' : 'divide-gray-100'}`}>
                {notifications.map((notification) => {
                  const Icon = notification.icon;
                  return (
                    <div
                      key={notification.id}
                      className={`p-4 transition-all ${
                        !notification.read 
                          ? theme === 'dark' ? 'bg-[#5FA8D3]/10' : 'bg-blue-50/50'
                          : ''
                      } ${theme === 'dark' ? 'hover:bg-[#5FA8D3]/15' : 'hover:bg-[#5FA8D3]/10'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                          style={{
                            background: `linear-gradient(135deg, ${getGradientColors(getNotificationColor(notification.type))})`
                          }}
                        >
                          <Icon size={18} className="text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={`text-sm font-semibold truncate ${theme === 'dark' ? 'text-white' : 'text-[#0E1116]'}`}>
                              {notification.title}
                            </h4>
                            <button
                              onClick={() => clearNotification(notification.id)}
                              className={`flex-shrink-0 p-1 rounded-lg transition-all ${
                                theme === 'dark' ? 'hover:bg-[#1F2630]' : 'hover:bg-[#D9DEE5]'
                              }`}
                            >
                              <X size={14} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#7D8590]'} />
                            </button>
                          </div>
                          <p className={`text-xs mb-2 ${theme === 'dark' ? 'text-white/70' : 'text-[#4B5563]'}`}>{notification.message}</p>
                          <div className="flex items-center justify-between">
                            <span className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-[#7D8590]'}`}>{notification.time}</span>
                            {!notification.read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="text-xs text-[#5FA8D3] hover:text-[#4A95C0] font-medium transition-colors"
                              >
                                Mark as read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className={`p-3 border-t text-center ${theme === 'dark' ? 'border-[#1F2630]' : 'border-[#D9DEE5]'}`}>
              <button className={`text-sm font-medium transition-colors ${
                theme === 'dark' ? 'text-[#7D8590] hover:text-white' : 'text-[#6B7280] hover:text-[#0E1116]'
              }`}>
                View All Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const getGradientColors = (color) => {
  const gradients = {
    'from-blue-500 to-blue-600': '#667eea 0%, #764ba2 100%',
    'from-green-500 to-green-600': '#11998e 0%, #38ef7d 100%',
    'from-yellow-500 to-yellow-600': '#f093fb 0%, #f5576c 100%',
    'from-gray-500 to-gray-600': '#4b5563 0%, #6b7280 100%',
  };
  return gradients[color] || '#667eea 0%, #764ba2 100%';
};

export default NotificationsPanel;
