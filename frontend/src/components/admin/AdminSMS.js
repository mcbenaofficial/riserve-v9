import React, { useState } from 'react';
import { MessageSquare, Plus, ToggleLeft, ToggleRight, Pencil, Send } from 'lucide-react';

const AdminSMS = () => {
  const [templates, setTemplates] = useState([
    { id: 1, name: 'Booking Confirmation', trigger: 'On Booking Created', active: true, message: 'Hi {customer}, your booking at {outlet} is confirmed for {time}.' },
    { id: 2, name: 'Booking Reminder', trigger: '30 mins before', active: true, message: 'Reminder: Your appointment at {outlet} is in 30 minutes.' },
    { id: 3, name: 'Service Completed', trigger: 'On Completion', active: false, message: 'Your service at {outlet} is complete. Thank you for choosing Ri\'DN!' },
  ]);

  const [settings, setSettings] = useState({
    enabled: true,
    provider: 'twilio',
    senderId: 'RIDN'
  });

  const toggleTemplate = (id) => {
    setTemplates(templates.map(t => t.id === id ? { ...t, active: !t.active } : t));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">SMS Notifications</h2>
          <p className="text-sm text-gray-600 dark:text-[#7D8590]">Configure SMS templates and provider settings</p>
        </div>
        <button
          className="px-4 py-2 rounded-xl font-semibold text-[#222] transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
        >
          <Plus size={18} />
          New Template
        </button>
      </div>

      {/* Settings Card */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E6E8EB]">SMS Settings</h3>
          <button
            onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              settings.enabled 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-[#7D8590]'
            }`}
          >
            {settings.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            {settings.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#A9AFB8] mb-2">SMS Provider</label>
            <select
              value={settings.provider}
              onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB]"
            >
              <option value="twilio">Twilio</option>
              <option value="aws_sns">AWS SNS</option>
              <option value="msg91">MSG91</option>
              <option value="textlocal">TextLocal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#A9AFB8] mb-2">Sender ID</label>
            <input
              type="text"
              value={settings.senderId}
              onChange={(e) => setSettings({ ...settings, senderId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB]"
            />
          </div>
        </div>
      </div>

      {/* Templates */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-[#1F2630]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E6E8EB]">SMS Templates</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-white/10">
          {templates.map((template) => (
            <div key={template.id} className="p-4 hover:bg-[#5FA8D3]/10 dark:hover:bg-[#5FA8D3]/15">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    template.active ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-gray-100 dark:bg-white/5'
                  }`}>
                    <MessageSquare size={20} className={template.active ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-[#E6E8EB]">{template.name}</div>
                    <div className="text-xs text-gray-500 dark:text-[#E6E8EB]/50">{template.trigger}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleTemplate(template.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      template.active
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {template.active ? 'Active' : 'Inactive'}
                  </button>
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-[#1F2630] rounded-lg">
                    <Send size={16} className="text-gray-500 dark:text-[#E6E8EB]/50" />
                  </button>
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-[#1F2630] rounded-lg">
                    <Pencil size={16} className="text-gray-500 dark:text-[#E6E8EB]/50" />
                  </button>
                </div>
              </div>
              <div className="ml-13 p-3 bg-gray-50 dark:bg-white/5 rounded-lg text-sm text-gray-600 dark:text-[#7D8590] font-mono">
                {template.message}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminSMS;
