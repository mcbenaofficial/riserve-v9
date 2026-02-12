import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Star, MessageSquare, Copy, Check, Mail, Phone, 
  TrendingUp, Smile, Meh, Frown, Heart, Loader2, Save, Link
} from 'lucide-react';

const AdminFeedback = () => {
  const [config, setConfig] = useState({
    enabled: true,
    auto_send_after_completion: true,
    send_via_email: true,
    send_via_sms: false,
    email_subject: "How was your experience?",
    email_message: "We'd love to hear your feedback!",
    sms_message: "Rate your experience: {link}",
    thank_you_message: "Thank you for your feedback!"
  });
  const [stats, setStats] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const baseUrl = window.location.origin;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [configRes, statsRes, feedbackRes] = await Promise.all([
        api.getFeedbackConfig(),
        api.getFeedbackStats(),
        api.getAllFeedback()
      ]);
      if (configRes.data) setConfig(prev => ({ ...prev, ...configRes.data }));
      setStats(statsRes.data);
      setFeedback(feedbackRes.data);
    } catch (error) {
      console.error('Failed to fetch feedback data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await api.updateFeedbackConfig(config);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const copyLink = (bookingId) => {
    const link = `${baseUrl}/rate/${bookingId}`;
    navigator.clipboard.writeText(link);
    setCopied(bookingId);
    setTimeout(() => setCopied(false), 2000);
  };

  const getEmoji = (rating) => {
    switch (rating) {
      case 1: return { icon: Frown, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' };
      case 2: return { icon: Frown, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' };
      case 3: return { icon: Meh, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' };
      case 4: return { icon: Smile, color: 'text-lime-500', bg: 'bg-lime-100 dark:bg-lime-900/30' };
      case 5: return { icon: Heart, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' };
      default: return { icon: Star, color: 'text-gray-400', bg: 'bg-gray-100' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#5FA8D3]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Responses"
          value={stats?.total_responses || 0}
          icon={MessageSquare}
          color="from-blue-500 to-indigo-500"
        />
        <StatCard
          title="Average Rating"
          value={stats?.average_rating || '0.0'}
          icon={Star}
          color="from-amber-500 to-orange-500"
          suffix="/5"
        />
        <StatCard
          title="Satisfaction Score"
          value={`${stats?.satisfaction_score || 0}%`}
          icon={TrendingUp}
          color="from-green-500 to-emerald-500"
        />
        <StatCard
          title="5-Star Ratings"
          value={stats?.rating_distribution?.[5] || 0}
          icon={Heart}
          color="from-pink-500 to-rose-500"
        />
      </div>

      {/* Rating Distribution */}
      {stats && stats.total_responses > 0 && (
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
          <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-4">Rating Distribution</h3>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = stats.rating_distribution?.[rating] || 0;
              const percent = stats.total_responses > 0 ? (count / stats.total_responses) * 100 : 0;
              const emoji = getEmoji(rating);
              const EmojiIcon = emoji.icon;
              
              return (
                <div key={rating} className="flex items-center gap-4">
                  <div className="flex items-center gap-2 w-24">
                    <EmojiIcon size={20} className={emoji.color} />
                    <span className="text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8]">{rating} star</span>
                  </div>
                  <div className="flex-1 h-4 bg-gray-200 dark:bg-[#1F2630] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all bg-gradient-to-r ${
                        rating >= 4 ? 'from-green-500 to-emerald-500' :
                        rating === 3 ? 'from-yellow-500 to-amber-500' :
                        'from-red-500 to-orange-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-[#0E1116] dark:text-[#E6E8EB] w-16 text-right">
                    {count} ({percent.toFixed(0)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Message */}
      {message.text && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' 
            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' 
            : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
          {message.type === 'success' ? <Check size={20} /> : <Frown size={20} />}
          {message.text}
        </div>
      )}

      {/* Configuration */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center">
            <Star size={24} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Feedback Settings</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#7D8590]">Configure customer satisfaction surveys</p>
          </div>
        </div>

        {/* Feedback Link Info */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Link size={16} className="text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Feedback Link Format</span>
          </div>
          <code className="text-sm text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded">
            {baseUrl}/rate/{'<booking_id>'}
          </code>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            Share this link with customers after their service is completed
          </p>
        </div>

        <div className="space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between p-4 bg-[#F6F7F9] dark:bg-[#12161C] rounded-xl">
            <div>
              <div className="font-medium text-[#0E1116] dark:text-[#E6E8EB]">Enable Feedback Collection</div>
              <div className="text-sm text-[#6B7280] dark:text-[#7D8590]">Allow customers to rate their experience</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#5FA8D3]/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5FA8D3]"></div>
            </label>
          </div>

          {/* Auto Send */}
          <div className="flex items-center justify-between p-4 bg-[#F6F7F9] dark:bg-[#12161C] rounded-xl">
            <div>
              <div className="font-medium text-[#0E1116] dark:text-[#E6E8EB]">Auto-send After Completion</div>
              <div className="text-sm text-[#6B7280] dark:text-[#7D8590]">Automatically send feedback request when booking is completed</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.auto_send_after_completion}
                onChange={(e) => setConfig({ ...config, auto_send_after_completion: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#5FA8D3]/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5FA8D3]"></div>
            </label>
          </div>

          {/* Notification Channels */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              config.send_via_email 
                ? 'border-[#5FA8D3] bg-[#5FA8D3]/5' 
                : 'border-[#D9DEE5] dark:border-[#1F2630]'
            }`} onClick={() => setConfig({ ...config, send_via_email: !config.send_via_email })}>
              <div className="flex items-center gap-3">
                <Mail size={20} className={config.send_via_email ? 'text-[#5FA8D3]' : 'text-[#6B7280]'} />
                <span className={`font-medium ${config.send_via_email ? 'text-[#5FA8D3]' : 'text-[#4B5563] dark:text-[#A9AFB8]'}`}>
                  Email Notification
                </span>
              </div>
            </div>
            <div className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              config.send_via_sms 
                ? 'border-[#5FA8D3] bg-[#5FA8D3]/5' 
                : 'border-[#D9DEE5] dark:border-[#1F2630]'
            }`} onClick={() => setConfig({ ...config, send_via_sms: !config.send_via_sms })}>
              <div className="flex items-center gap-3">
                <Phone size={20} className={config.send_via_sms ? 'text-[#5FA8D3]' : 'text-[#6B7280]'} />
                <span className={`font-medium ${config.send_via_sms ? 'text-[#5FA8D3]' : 'text-[#4B5563] dark:text-[#A9AFB8]'}`}>
                  SMS Notification
                </span>
              </div>
            </div>
          </div>

          {/* Message Templates */}
          {config.send_via_email && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={config.email_subject}
                  onChange={(e) => setConfig({ ...config, email_subject: e.target.value })}
                  className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
                  Email Message
                </label>
                <textarea
                  value={config.email_message}
                  onChange={(e) => setConfig({ ...config, email_message: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB]"
                />
              </div>
            </div>
          )}

          {config.send_via_sms && (
            <div>
              <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
                SMS Message <span className="text-xs text-[#6B7280]">(use {'{link}'} for feedback link)</span>
              </label>
              <input
                type="text"
                value={config.sms_message}
                onChange={(e) => setConfig({ ...config, sms_message: e.target.value })}
                className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB]"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#4B5563] dark:text-[#A9AFB8] mb-2">
              Thank You Message (shown after submission)
            </label>
            <input
              type="text"
              value={config.thank_you_message}
              onChange={(e) => setConfig({ ...config, thank_you_message: e.target.value })}
              className="w-full px-4 py-3 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl bg-white dark:bg-[#12161C] text-[#0E1116] dark:text-[#E6E8EB]"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-50 flex items-center gap-2 shadow-lg bg-[#5FA8D3] hover:bg-[#4A95C0]"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Recent Feedback */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630]">
        <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB] mb-4 flex items-center gap-2">
          <MessageSquare size={20} className="text-[#5FA8D3]" />
          Recent Feedback
        </h3>
        
        {feedback.length > 0 ? (
          <div className="space-y-3">
            {feedback.slice(0, 10).map((fb) => {
              const emoji = getEmoji(fb.rating);
              const EmojiIcon = emoji.icon;
              
              return (
                <div key={fb.id} className="flex items-start gap-4 p-4 bg-[#F6F7F9] dark:bg-[#12161C] rounded-xl">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${emoji.bg}`}>
                    <EmojiIcon size={24} className={emoji.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">
                        {fb.customer_name || 'Anonymous'}
                      </span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={14}
                            className={star <= fb.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}
                          />
                        ))}
                      </div>
                    </div>
                    {fb.comment && (
                      <p className="text-sm text-[#4B5563] dark:text-[#A9AFB8]">"{fb.comment}"</p>
                    )}
                    <div className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-1">
                      {new Date(fb.created_at).toLocaleDateString('en-IN', { 
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => copyLink(fb.booking_id)}
                    className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg transition-all"
                    title="Copy feedback link"
                  >
                    {copied === fb.booking_id ? (
                      <Check size={16} className="text-green-500" />
                    ) : (
                      <Copy size={16} className="text-[#6B7280]" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-[#6B7280] dark:text-[#7D8590]">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
            <p>No feedback collected yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, suffix = '' }) => (
  <div className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${color}`}>
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-white/80 mb-1">{title}</div>
        <div className="text-2xl font-bold text-white">{value}{suffix}</div>
      </div>
      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
        <Icon size={20} className="text-white" />
      </div>
    </div>
  </div>
);

export default AdminFeedback;
