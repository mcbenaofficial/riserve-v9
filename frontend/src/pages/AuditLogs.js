import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Search, Filter, Calendar, User, Building2,
  ChevronLeft, ChevronRight, Download, RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

const AuditLogs = ({ theme }) => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    company_id: '',
    user_id: '',
    action: '',
    entity_type: ''
  });
  const [pagination, setPagination] = useState({
    limit: 50,
    offset: 0
  });
  const [companies, setCompanies] = useState([]);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        ...pagination
      };
      // Remove empty params
      Object.keys(params).forEach(key => {
        if (!params[key] && params[key] !== 0) delete params[key];
      });

      const response = await api.getAuditLogs(params);
      setLogs(response.data.logs);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination]);

  const fetchCompanies = useCallback(async () => {
    try {
      const response = await api.getCompanies();
      setCompanies(response.data);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const handlePageChange = (direction) => {
    setPagination(prev => ({
      ...prev,
      offset: direction === 'next'
        ? prev.offset + prev.limit
        : Math.max(0, prev.offset - prev.limit)
    }));
  };

  const getActionColor = (action) => {
    const colors = {
      create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      login: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      logout: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
      signup: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      impersonate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      suspend: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
      activate: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      plan_change: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
    };
    return colors[action] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  };

  const getEntityIcon = (entityType) => {
    switch (entityType) {
      case 'company': return <Building2 size={14} />;
      case 'user': return <User size={14} />;
      case 'booking': return <Calendar size={14} />;
      default: return <Activity size={14} />;
    }
  };

  const actionOptions = [
    'create', 'update', 'delete', 'login', 'logout', 'signup',
    'impersonate', 'suspend', 'activate', 'plan_change'
  ];

  const entityOptions = [
    'company', 'user', 'booking', 'outlet', 'service', 'feedback'
  ];

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(total / pagination.limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0]">
            <Activity size={24} className="text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
              Audit Logs
            </h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
              Track all system activities and changes
            </p>
          </div>
        </div>
        <button
          onClick={fetchLogs}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-white/50 hover:bg-white/80'} transition-colors border border-[#D9DEE5] dark:border-[#1F2630]`}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5 backdrop-blur-xl border border-[#1F2630]' : 'bg-white/90 border border-[#D9DEE5]'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
          <span className={`text-sm font-medium ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
            Filters
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={`text-xs font-medium ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
              Company
            </label>
            <select
              value={filters.company_id}
              onChange={(e) => handleFilterChange('company_id', e.target.value)}
              className={`w-full mt-1 px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-[#0B0D10]/50 text-[#E6E8EB] border border-[#1F2630]' : 'bg-[#F6F7F9] text-[#0E1116] border border-[#D9DEE5]'} outline-none`}
            >
              <option value="">All Companies</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`text-xs font-medium ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
              Action
            </label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className={`w-full mt-1 px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-[#0B0D10]/50 text-[#E6E8EB] border border-[#1F2630]' : 'bg-[#F6F7F9] text-[#0E1116] border border-[#D9DEE5]'} outline-none`}
            >
              <option value="">All Actions</option>
              {actionOptions.map(action => (
                <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`text-xs font-medium ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
              Entity Type
            </label>
            <select
              value={filters.entity_type}
              onChange={(e) => handleFilterChange('entity_type', e.target.value)}
              className={`w-full mt-1 px-3 py-2 rounded-lg ${theme === 'dark' ? 'bg-[#0B0D10]/50 text-[#E6E8EB] border border-[#1F2630]' : 'bg-[#F6F7F9] text-[#0E1116] border border-[#D9DEE5]'} outline-none`}
            >
              <option value="">All Entities</option>
              {entityOptions.map(entity => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setFilters({ company_id: '', user_id: '', action: '', entity_type: '' });
                setPagination({ limit: 50, offset: 0 });
              }}
              className={`px-4 py-2 rounded-lg text-sm ${theme === 'dark' ? 'bg-white/5 text-[#7D8590] hover:text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#6B7280] hover:text-[#0E1116]'} transition-colors border border-transparent hover:border-[#D9DEE5] dark:hover:border-[#1F2630]`}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className={`rounded-2xl ${theme === 'dark' ? 'bg-white/5 backdrop-blur-xl border border-[#1F2630]' : 'bg-white/90 border border-[#D9DEE5]'} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={theme === 'dark' ? 'bg-white/5' : 'bg-[#F6F7F9]/50'}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Timestamp
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Action
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Entity
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  User
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  Details
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  IP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9DEE5] dark:divide-[#1F2630]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5FA8D3] mx-auto"></div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Activity size={32} className={`mx-auto mb-2 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`} />
                    <p className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}>No logs found</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#5FA8D3]/10 dark:hover:bg-[#5FA8D3]/15 transition-colors">
                    <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                      <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                      <div className="text-xs">{new Date(log.timestamp).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}>
                          {getEntityIcon(log.entity_type)}
                        </span>
                        <div>
                          <div className={`text-sm ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                            {log.entity_type}
                          </div>
                          <div className={`text-xs ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                            {log.entity_id?.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                        {log.user_email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {log.details && Object.keys(log.details).length > 0 ? (
                        <div className={`text-xs ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                          {Object.entries(log.details).slice(0, 2).map(([key, value]) => (
                            <div key={key}>
                              <span className="font-medium">{key}:</span> {String(value).substring(0, 20)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className={`text-xs ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>-</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-xs ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className={`flex items-center justify-between px-4 py-3 border-t ${theme === 'dark' ? 'border-[#1F2630]' : 'border-[#D9DEE5]'}`}>
            <div className={`text-sm ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
              Showing {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange('prev')}
                disabled={pagination.offset === 0}
                className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-[#1F2630]' : 'hover:bg-[#F6F7F9]'} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
              >
                <ChevronLeft size={16} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
              </button>
              <span className={`text-sm ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange('next')}
                disabled={pagination.offset + pagination.limit >= total}
                className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-[#1F2630]' : 'hover:bg-[#F6F7F9]'} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
              >
                <ChevronRight size={16} className={theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
