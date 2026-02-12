import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Filter, Download, DollarSign, TrendingUp, Percent } from 'lucide-react';

const Finance = () => {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const perPage = 15;

  useEffect(() => {
    fetchTransactions();
  }, []);

  useEffect(() => {
    filterTransactions();
  }, [transactions, statusFilter, dateFilter]);

  const fetchTransactions = async () => {
    try {
      const response = await api.getTransactions();
      setTransactions(response.data);
      setFilteredTransactions(response.data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTransactions = () => {
    let filtered = transactions;

    if (statusFilter !== 'All') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (dateFilter !== 'All') {
      const now = new Date();
      filtered = filtered.filter(t => {
        const transDate = new Date(t.date);
        if (dateFilter === 'Today') {
          return transDate.toDateString() === now.toDateString();
        } else if (dateFilter === 'This Week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return transDate >= weekAgo;
        } else if (dateFilter === 'This Month') {
          return transDate.getMonth() === now.getMonth() && transDate.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }

    setFilteredTransactions(filtered);
    setPage(1);
  };

  const pageCount = Math.ceil(filteredTransactions.length / perPage);
  const pageItems = filteredTransactions.slice((page - 1) * perPage, page * perPage);

  const totals = filteredTransactions.reduce(
    (acc, t) => ({
      gross: acc.gross + t.gross,
      commission: acc.commission + t.commission,
      partner_share: acc.partner_share + t.partner_share
    }),
    { gross: 0, commission: 0, partner_share: 0 }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-[#4B5563] dark:text-[#7D8590]">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard title="Total Gross" value={`₹${totals.gross.toLocaleString()}`} icon={DollarSign} color="from-green-500 to-green-600" />
        <SummaryCard title="Total Commission" value={`₹${totals.commission.toLocaleString()}`} icon={Percent} color="from-red-500 to-red-600" />
        <SummaryCard title="Partner Share" value={`₹${totals.partner_share.toLocaleString()}`} icon={TrendingUp} color="from-yellow-500 to-yellow-600" />
      </div>

      {/* Transactions Table */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl border border-[#D9DEE5] dark:border-[#1F2630] overflow-hidden">
        <div className="p-6 border-b border-[#D9DEE5] dark:border-[#1F2630] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Transactions</h2>
            <p className="text-sm text-[#4B5563] dark:text-[#7D8590] mt-1">
              {filteredTransactions.length} total transactions
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-white/5 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:ring-2 focus:ring-[#5FA8D3] transition-all backdrop-blur-sm"
            >
              <option>All</option>
              <option>Settled</option>
              <option>Held</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-white/5 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:ring-2 focus:ring-[#5FA8D3] transition-all backdrop-blur-sm"
            >
              <option>All</option>
              <option>Today</option>
              <option>This Week</option>
              <option>This Month</option>
            </select>

            <button className="p-2 bg-[#ECEFF3] dark:bg-white/5 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl hover:bg-[#D9DEE5] dark:hover:bg-[#1F2630] transition-all">
              <Filter size={20} className="text-[#4B5563] dark:text-[#E6E8EB]" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-[#ECEFF3] dark:bg-white/5 border-b border-[#D9DEE5] dark:border-[#1F2630]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] uppercase tracking-wider">
                  Transaction ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] uppercase tracking-wider">
                  Booking ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] uppercase tracking-wider">
                  Gross
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] uppercase tracking-wider">
                  Commission
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] uppercase tracking-wider">
                  Partner Share
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-[#4B5563] dark:text-[#7D8590] uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {pageItems.map((t) => (
                <tr key={t.id} className="hover:bg-[#5FA8D3]/10 dark:hover:bg-[#5FA8D3]/15 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{t.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-[#4B5563] dark:text-[#E6E8EB]/70">{t.booking_id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[#4B5563] dark:text-[#E6E8EB]/70">
                      {new Date(t.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-bold text-[#0E1116] dark:text-[#E6E8EB]">₹{t.gross.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-bold text-red-600 dark:text-red-400">₹{t.commission.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-bold text-green-600 dark:text-green-400">₹{t.partner_share.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm ${
                        t.status === 'Settled'
                          ? 'bg-green-500/20 border-green-500/30 text-green-700 dark:text-green-400'
                          : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-[#ECEFF3] dark:bg-white/5 border-t border-[#D9DEE5] dark:border-[#1F2630]">
          <div className="text-sm text-[#4B5563] dark:text-[#7D8590]">
            Showing <span className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{(page - 1) * perPage + 1}</span> to{' '}
            <span className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{Math.min(page * perPage, filteredTransactions.length)}</span> of{' '}
            <span className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{filteredTransactions.length}</span> results
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-sm font-medium text-[#4B5563] dark:text-[#E6E8EB] bg-white dark:bg-white/5 hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] disabled:opacity-50 disabled:cursor-not-allowed transition-all backdrop-blur-sm"
            >
              Previous
            </button>
            <div className="px-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-sm font-semibold bg-white dark:bg-white/5 text-[#0E1116] dark:text-[#E6E8EB] backdrop-blur-sm">
              {page} / {pageCount || 1}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
              className="px-4 py-2 border border-[#D9DEE5] dark:border-[#1F2630] rounded-xl text-sm font-medium text-[#4B5563] dark:text-[#E6E8EB] bg-white dark:bg-white/5 hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] disabled:opacity-50 disabled:cursor-not-allowed transition-all backdrop-blur-sm"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ title, value, icon: Icon, color }) => (
  <div
    className="relative overflow-hidden rounded-3xl p-6 shadow-lg"
    style={{
      background: `linear-gradient(135deg, ${getGradientColors(color)})`,
    }}
  >
    <div className="relative z-10">
      <div className={`w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl mb-4`}>
        <Icon size={28} className="text-white" strokeWidth={2} />
      </div>
      <div className="text-sm text-[#A9AFB8] mb-1 font-medium">{title}</div>
      <div className="text-3xl font-bold text-white drop-shadow-lg">{value}</div>
    </div>
    <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
  </div>
);

const getGradientColors = (color) => {
  const gradients = {
    'from-green-500 to-green-600': '#11998e 0%, #38ef7d 100%',
    'from-red-500 to-red-600': '#f093fb 0%, #f5576c 100%',
    'from-yellow-500 to-yellow-600': '#5FA8D3 0%, #4A95C0 100%',
  };
  return gradients[color] || '#667eea 0%, #764ba2 100%';
};

export default Finance;
