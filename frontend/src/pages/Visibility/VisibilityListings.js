import React, { useEffect, useState, useCallback } from 'react';
import { MapPin, ExternalLink, CheckCircle, XCircle, Clock, Edit2, Save, X, RefreshCw, AlertCircle } from 'lucide-react';
import { getListings, upsertListing } from '../../services/visibilityApi';

const PLATFORMS = [
  { id: 'google', label: 'Google Business Profile', icon: '🔵', description: 'Appears in Google Search and Maps' },
  { id: 'zomato', label: 'Zomato', icon: '🔴', description: 'Food delivery and discovery platform' },
  { id: 'justdial', label: 'Justdial', icon: '🟡', description: 'Local business directory' },
  { id: 'tripadvisor', label: 'TripAdvisor', icon: '🟢', description: 'Travel and hospitality reviews' },
];

const STATUS_CONFIG = {
  connected: {
    label: 'Connected',
    icon: CheckCircle,
    cls: 'text-emerald-400',
    badgeCls: 'bg-green-500/15 text-green-400',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    cls: 'text-amber-500',
    badgeCls: 'bg-amber-500/15 text-amber-400',
  },
  not_connected: {
    label: 'Not Connected',
    icon: XCircle,
    cls: 'text-gray-500',
    badgeCls: 'bg-white/8 text-gray-500',
  },
};

function EditModal({ platform, listing, onSave, onClose }) {
  const [status, setStatus] = useState(listing?.status || 'not_connected');
  const [url, setUrl] = useState(listing?.listing_url || '');
  const [externalId, setExternalId] = useState(listing?.external_id || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ platform: platform.id, status, listing_url: url || null, external_id: externalId || null });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59] flex items-center justify-center p-4">
      <div className="bg-[#13161D] border border-white/8 rounded-3xl shadow-2xl w-full max-w-md z-[60]">
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <div className="flex items-center gap-2">
            <span className="text-xl">{platform.icon}</span>
            <h2 className="font-semibold text-white">{platform.label}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors duration-150">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/8 bg-[#0D0F17] text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="not_connected">Not Connected</option>
              <option value="pending">Pending Setup</option>
              <option value="connected">Connected</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Listing URL</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder={`https://${platform.id}.com/your-business`}
              className="w-full px-3 py-2 rounded-xl border border-white/8 bg-[#0D0F17] text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">External ID</label>
            <input
              type="text"
              value={externalId}
              onChange={e => setExternalId(e.target.value)}
              placeholder="Platform's business ID"
              className="w-full px-3 py-2 rounded-xl border border-white/8 bg-[#0D0F17] text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-gray-500"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/8">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-white hover:bg-white/8 transition-colors duration-150">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white accent-gradient-bg hover:opacity-90 transition-opacity duration-150 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

const VisibilityListings = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // platform object

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getListings();
      setListings(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getListing = (platformId) => listings.find(l => l.platform === platformId);

  const connected = listings.filter(l => l.status === 'connected').length;
  const completeness = Math.round((connected / PLATFORMS.length) * 100);

  const handleSave = async (data) => {
    const updated = await upsertListing(data);
    setListings(prev => {
      const idx = prev.findIndex(l => l.platform === updated.platform);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
  };

  return (
    <div className="min-h-screen bg-[#0D0F17] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Listings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Keep your business information consistent everywhere customers search</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 text-sm text-gray-500 hover:text-white hover:bg-white/8 transition-colors duration-200"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Completeness Bar */}
      <div className="bg-[#13161D] border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white">Listing Completeness</span>
          <span className="text-sm font-bold text-white">{connected}/{PLATFORMS.length} connected</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${completeness >= 75 ? 'bg-emerald-500' : completeness >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${completeness}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          {completeness === 100 ? 'All platforms connected — great work!' : `Connect ${PLATFORMS.length - connected} more platform${PLATFORMS.length - connected !== 1 ? 's' : ''} to improve your Visibility Score`}
        </p>
      </div>

      {/* Platform Cards */}
      {loading && listings.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-white/8 border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLATFORMS.map(platform => {
            const listing = getListing(platform.id);
            const statusKey = listing?.status || 'not_connected';
            const cfg = STATUS_CONFIG[statusKey];
            const StatusIcon = cfg.icon;

            return (
              <div key={platform.id} className="bg-[#13161D] border border-white/8 rounded-2xl p-5 hover:border-white/8/80 transition-colors duration-150">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{platform.icon}</span>
                    <div>
                      <div className="font-semibold text-white text-sm">{platform.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{platform.description}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.badgeCls}`}>
                    {cfg.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 mb-4">
                  <StatusIcon size={14} className={cfg.cls} />
                  {listing?.listing_url ? (
                    <a
                      href={listing.listing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline flex items-center gap-1 truncate max-w-[200px]"
                    >
                      {listing.listing_url}
                      <ExternalLink size={10} />
                    </a>
                  ) : (
                    <span className="text-xs text-gray-500">No listing URL set</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  {listing?.last_synced_at && (
                    <span className="text-xs text-gray-500">
                      Last updated {new Date(listing.last_synced_at).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    onClick={() => setEditing(platform)}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/8 text-gray-500 hover:text-white hover:bg-white/8 transition-colors duration-150"
                  >
                    <Edit2 size={12} />
                    {listing ? 'Edit' : 'Connect'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EditModal
          platform={editing}
          listing={getListing(editing.id)}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default VisibilityListings;
