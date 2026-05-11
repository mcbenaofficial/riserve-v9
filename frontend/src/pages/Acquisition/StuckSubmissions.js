import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { getStuckSubmissions } from '../../services/campaignsApi';

function SlaBar({ breachedBy }) {
  const hours = Math.round(breachedBy);
  const severity = hours > 48 ? 'bg-red-500' : hours > 12 ? 'bg-amber-500' : 'bg-yellow-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${severity} transition-all`} style={{ width: '100%' }} />
      </div>
      <span className="text-xs text-gray-400 whitespace-nowrap">+{hours}h over</span>
    </div>
  );
}

export default function StuckSubmissions() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    getStuckSubmissions()
      .then((data) => {
        setItems(data?.items ?? []);
        setTotal(data?.total ?? 0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-[#0D0F17] text-white px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle size={22} className="text-amber-400" />
            Stuck Submissions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Submissions that have exceeded their stage SLA
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-sm text-gray-300 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-[#13161D] border border-white/8 p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
            <Clock size={28} className="text-emerald-400" />
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">No stuck submissions</h3>
          <p className="text-gray-500 text-sm max-w-xs">
            All submissions are within their stage SLA windows.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500 mb-4">{total} submission{total !== 1 ? 's' : ''} over SLA</p>
          <div className="overflow-x-auto rounded-2xl border border-white/8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-[#13161D]">
                  {['Name', 'Stage', 'Campaign', 'SLA (h)', 'Elapsed (h)', 'SLA Breach'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((sub) => (
                  <tr key={sub.id} className="border-b border-white/4 hover:bg-white/4 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-white">
                      {sub.common_name || sub.submitter_handle || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                        {sub.stage}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {sub.campaign_name || sub.campaign_id || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {sub.sla_hours ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {sub.elapsed_hours != null ? Math.round(sub.elapsed_hours) : '—'}
                    </td>
                    <td className="px-5 py-3.5 w-48">
                      {sub.sla_breached_by_hours != null ? (
                        <SlaBar breachedBy={sub.sla_breached_by_hours} />
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
