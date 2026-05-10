import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { CalendarDays, Check, X } from 'lucide-react';

// ============== LEAVE REQUESTS ==============
const LeaveRequests = ({ onUpdate }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    try {
      const res = await api.getLeaveRequests({ status: statusFilter || undefined });
      setRequests(res.data || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, status) => {
    try {
      await api.updateLeaveRequest(id, { status });
      fetchRequests();
      onUpdate();
    } catch (error) {
      console.error('Failed to update:', error);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'rejected': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'pending': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {['pending', 'approved', 'rejected', ''].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              statusFilter === s
                ? 'bg-[#5FA8D3] text-white'
                : 'bg-[#F6F7F9] dark:bg-[#1F2630] text-[#6B7280] hover:bg-[#ECEFF3] dark:hover:bg-[#2A313C]'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-[#6B7280]">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-[#6B7280]">
          <CalendarDays size={48} className="mx-auto mb-4 opacity-50" />
          <p>No {statusFilter} leave requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="p-4 bg-[#F6F7F9] dark:bg-[#0B0D10] rounded-xl border border-[#D9DEE5] dark:border-[#1F2630]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{r.staff_name}</div>
                  <div className="text-sm text-[#6B7280]">
                    {r.leave_type_name} • {r.days} day(s)
                  </div>
                  <div className="text-sm text-[#6B7280] mt-1">
                    {r.start_date} to {r.end_date}
                  </div>
                  {r.reason && <div className="text-sm text-[#6B7280] mt-1 italic">"{r.reason}"</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(r.status)}`}>
                    {r.status}
                  </span>
                  {r.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleAction(r.id, 'approved')}
                        className="p-2 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 rounded-lg"
                      >
                        <Check size={16} className="text-green-600" />
                      </button>
                      <button
                        onClick={() => handleAction(r.id, 'rejected')}
                        className="p-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 rounded-lg"
                      >
                        <X size={16} className="text-red-600" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============== PAGE HEADER ==============
const PageHeader = ({ icon: Icon, title, description }) => (
  <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630] mb-6">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl accent-gradient-bg flex items-center justify-center shadow-lg">
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">{title}</h1>
        <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">{description}</p>
      </div>
    </div>
  </div>
);

// ============== PAGE EXPORT ==============
const StaffLeaveRequestsPage = () => (
  <div className="space-y-6">
    <PageHeader icon={CalendarDays} title="Leave Requests" description="Review and manage staff leave applications" />
    <LeaveRequests onUpdate={() => {}} />
  </div>
);

export default StaffLeaveRequestsPage;
