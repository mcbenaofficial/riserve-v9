import React, { useState } from 'react';
import { Zap, Plus, ToggleLeft, ToggleRight, Pencil, Trash2, Play, Clock, ArrowRight } from 'lucide-react';

const AdminAutomations = () => {
  const [automations, setAutomations] = useState([
    { 
      id: 1, 
      name: 'Auto-assign bookings', 
      trigger: 'When booking is created',
      action: 'Assign to nearest available outlet',
      active: true, 
      runsToday: 45 
    },
    { 
      id: 2, 
      name: 'Send reminder', 
      trigger: '1 hour before appointment',
      action: 'Send SMS and Email reminder',
      active: true, 
      runsToday: 23 
    },
    { 
      id: 3, 
      name: 'Follow-up survey', 
      trigger: '24 hours after service completion',
      action: 'Send feedback survey email',
      active: false, 
      runsToday: 0 
    },
    { 
      id: 4, 
      name: 'VIP customer alert', 
      trigger: 'When VIP customer books',
      action: 'Notify outlet manager via SMS',
      active: true, 
      runsToday: 5 
    },
  ]);

  const toggleAutomation = (id) => {
    setAutomations(automations.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">Automations</h2>
          <p className="text-sm text-gray-600 dark:text-[#7D8590]">Automate workflows and repetitive tasks</p>
        </div>
        <button
          className="px-4 py-2 rounded-xl font-semibold text-[#222] transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
        >
          <Plus size={18} />
          Create Automation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-4">
          <div className="text-sm text-gray-600 dark:text-[#7D8590] mb-1">Active Automations</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-[#E6E8EB]">{automations.filter(a => a.active).length}</div>
        </div>
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-4">
          <div className="text-sm text-gray-600 dark:text-[#7D8590] mb-1">Runs Today</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-[#E6E8EB]">{automations.reduce((sum, a) => sum + a.runsToday, 0)}</div>
        </div>
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-4">
          <div className="text-sm text-gray-600 dark:text-[#7D8590] mb-1">Success Rate</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">98.5%</div>
        </div>
      </div>

      {/* Automations List */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-[#1F2630]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E6E8EB]">All Automations</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-white/10">
          {automations.map((automation) => (
            <div key={automation.id} className="p-4 hover:bg-[#5FA8D3]/5 dark:hover:bg-[#5FA8D3]/10 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    automation.active ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-gray-100 dark:bg-white/5'
                  }`}>
                    <Zap size={20} className={automation.active ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400'} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-[#E6E8EB]">{automation.name}</div>
                    <div className="text-xs text-gray-500 dark:text-[#E6E8EB]/50">{automation.runsToday} runs today</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleAutomation(automation.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      automation.active
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {automation.active ? 'Active' : 'Inactive'}
                  </button>
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-[#1F2630] rounded-lg" title="Run now">
                    <Play size={16} className="text-gray-500 dark:text-[#E6E8EB]/50" />
                  </button>
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-[#1F2630] rounded-lg">
                    <Pencil size={16} className="text-gray-500 dark:text-[#E6E8EB]/50" />
                  </button>
                  <button className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-400">
                  <Clock size={14} />
                  {automation.trigger}
                </div>
                <ArrowRight size={16} className="text-gray-400" />
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                  <Zap size={14} />
                  {automation.action}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminAutomations;
