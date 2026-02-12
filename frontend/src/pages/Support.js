import React, { useState } from 'react';
import { api } from '../services/api';
import { Database, Sprout, BookOpen, Video, MessageCircle, Mail, Settings, CheckCircle } from 'lucide-react';

const Support = () => {
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState('');

  const handleSeedData = async () => {
    setSeeding(true);
    setMessage('');
    try {
      const response = await api.seedData();
      setMessage(`success:${response.data.message}`);
    } catch (error) {
      setMessage(`error:Failed to seed data: ${error.message}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
        <h2 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Support & Tools</h2>
        <p className="text-sm text-[#4B5563] dark:text-[#7D8590] mt-1">
          System utilities and support options
        </p>
      </div>

      {/* Data Management */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-[#D9DEE5] dark:border-[#1F2630]">
        <h3 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center">
            <Database size={20} className="text-[#222]" />
          </div>
          <span>Data Management</span>
        </h3>

        <div className="space-y-4">
          <div className="p-6 bg-gradient-to-r from-[#5FA8D3]/10 to-[#ffdb33]/10 rounded-xl border border-[#5FA8D3]/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Sprout size={18} className="text-green-600 dark:text-green-400" />
              </div>
              <h4 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">Seed Sample Data</h4>
            </div>
            <p className="text-sm text-[#4B5563] dark:text-[#7D8590] mb-4">
              Populate the database with 150+ sample records including outlets, services, bookings, and transactions.
            </p>
            <button
              onClick={handleSeedData}
              disabled={seeding}
              data-testid="seed-data-btn"
              className="px-6 py-3 rounded-lg font-semibold text-[#222] transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              style={{ background: '#5FA8D3' }}
            >
              {seeding ? 'Seeding...' : 'Seed Sample Data'}
            </button>
            {message && (
              <div className={`mt-4 p-4 rounded-lg text-sm font-medium flex items-center gap-2 ${
                message.startsWith('success:') 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                {message.startsWith('success:') && <CheckCircle size={18} />}
                {message.replace('success:', '').replace('error:', '')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help Resources */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-[#D9DEE5] dark:border-[#1F2630]">
        <h3 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <BookOpen size={20} className="text-white" />
          </div>
          <span>Help & Resources</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <HelpCard
            icon={BookOpen}
            iconBg="from-blue-500 to-blue-600"
            title="Documentation"
            description="Learn how to use the partner portal"
          />
          <HelpCard
            icon={Video}
            iconBg="from-purple-500 to-purple-600"
            title="Video Tutorials"
            description="Watch step-by-step guides"
          />
          <HelpCard
            icon={MessageCircle}
            iconBg="from-green-500 to-green-600"
            title="Live Chat"
            description="Get instant help from our team"
          />
          <HelpCard
            icon={Mail}
            iconBg="from-orange-500 to-orange-600"
            title="Email Support"
            description="support@ridn.com"
          />
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-[#D9DEE5] dark:border-[#1F2630]">
        <h3 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
            <Settings size={20} className="text-white" />
          </div>
          <span>System Information</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InfoCard label="Version" value="v2.0.1" />
          <InfoCard label="Environment" value="Production" />
          <InfoCard label="Status" value="All Systems Operational" status="success" />
        </div>
      </div>
    </div>
  );
};

const HelpCard = ({ icon: Icon, iconBg, title, description }) => (
  <div className="p-6 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl hover:border-[#5FA8D3] dark:hover:border-[#5FA8D3] transition-all cursor-pointer hover:shadow-lg transform hover:scale-[1.02] bg-white/80 dark:bg-white/5">
    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center mb-4`}>
      <Icon size={24} className="text-white" />
    </div>
    <h4 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-2">{title}</h4>
    <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">{description}</p>
  </div>
);

const InfoCard = ({ label, value, status }) => (
  <div className="p-6 bg-[#F6F7F9] dark:bg-white/5 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630]">
    <div className="text-xs text-[#6B7280] dark:text-[#E6E8EB]/50 mb-2">{label}</div>
    <div className={`text-sm font-semibold flex items-center gap-2 ${
      status === 'success' 
        ? 'text-green-600 dark:text-green-400' 
        : 'text-[#0E1116] dark:text-[#E6E8EB]'
    }`}>
      {status === 'success' && <CheckCircle size={16} />}
      {value}
    </div>
  </div>
);

export default Support;
