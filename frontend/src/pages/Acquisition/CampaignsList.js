import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ChevronDown, X, CheckCircle2, Clock, AlertCircle,
} from 'lucide-react';
import {
  getCampaigns,
  getCampaignTypes,
  activateCampaign,
  pauseCampaign,
  archiveCampaign,
  deleteCampaign,
} from '../../services/campaignsApi';

const STATUS_STYLES = {
  draft:     { pill: 'bg-gray-500/20 text-gray-400',    label: 'Draft' },
  active:    { pill: 'bg-emerald-500/20 text-emerald-400', label: 'Active' },
  paused:    { pill: 'bg-amber-500/20 text-amber-400',  label: 'Paused' },
  completed: { pill: 'bg-blue-500/20 text-blue-400',    label: 'Completed' },
  archived:  { pill: 'bg-gray-500/10 text-gray-500',    label: 'Archived' },
};

const TYPE_STYLES = {
  customer_acquisition:  'bg-indigo-500/20 text-indigo-400',
  talent_acquisition:    'bg-violet-500/20 text-violet-400',
  franchise_development: 'bg-amber-500/20 text-amber-400',
  vendor_sourcing:       'bg-teal-500/20 text-teal-400',
  partnership_outreach:  'bg-rose-500/20 text-rose-400',
  general_lead_gen:      'bg-sky-500/20 text-sky-400',
};

const STATUS_FILTERS = ['All', 'draft', 'active', 'paused', 'completed', 'archived'];

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-[#13161D] border border-white/8 p-5 animate-pulse">
      <div className="h-4 bg-white/10 rounded w-2/3 mb-3" />
      <div className="flex gap-2 mb-4">
        <div className="h-5 bg-white/10 rounded-full w-24" />
        <div className="h-5 bg-white/10 rounded-full w-16" />
      </div>
      <div className="h-3 bg-white/10 rounded w-1/2 mb-2" />
      <div className="h-3 bg-white/10 rounded w-1/3" />
    </div>
  );
}

function ActionMenu({ campaign, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const items = [];
  if (campaign.status === 'draft' || campaign.status === 'paused') {
    items.push({ label: 'Activate', action: 'activate' });
  }
  if (campaign.status === 'active') {
    items.push({ label: 'Pause', action: 'pause' });
  }
  if (campaign.status !== 'archived') {
    items.push({ label: 'Archive', action: 'archive' });
  }
  items.push({ label: 'Edit', action: 'edit' });
  items.push({ label: 'Delete', action: 'delete', danger: true });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/8 transition-colors"
      >
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-40 rounded-xl bg-[#1C1F2A] border border-white/10 shadow-xl py-1">
          {items.map((item) => (
            <button
              key={item.action}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onAction(item.action, campaign);
              }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/8 ${
                item.danger ? 'text-red-400 hover:text-red-300' : 'text-gray-300 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignCard({ campaign, typeMap, onAction, onClick }) {
  const statusStyle = STATUS_STYLES[campaign.status] || STATUS_STYLES.draft;
  const typeKey = typeMap[campaign.campaign_type_id] || '';
  const typeLabel = typeKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const typeStyle = TYPE_STYLES[typeKey] || 'bg-gray-500/20 text-gray-400';

  return (
    <div
      onClick={onClick}
      className="rounded-2xl bg-[#13161D] border border-white/8 p-5 cursor-pointer hover:border-white/16 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-semibold text-white text-sm leading-snug group-hover:text-indigo-300 transition-colors line-clamp-2">
          {campaign.name}
        </h3>
        <ActionMenu campaign={campaign} onAction={onAction} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {typeKey && (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeStyle}`}>
            {typeLabel}
          </span>
        )}
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.pill}`}>
          {statusStyle.label}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{campaign.submission_count ?? 0} submissions</span>
        <span>
          {campaign.created_at
            ? new Date(campaign.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })
            : '—'}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ onNew }) {
  return (
    <div className="col-span-3 flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
        <CheckCircle2 size={28} className="text-indigo-400" />
      </div>
      <h3 className="text-white font-semibold text-lg mb-2">No campaigns yet</h3>
      <p className="text-gray-500 text-sm mb-6 max-w-xs">
        Create your first campaign to start collecting submissions and tracking leads.
      </p>
      <button
        onClick={onNew}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
      >
        <Plus size={16} />
        Create your first campaign
      </button>
    </div>
  );
}

export default function CampaignsList() {
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState([]);
  const [campaignTypes, setCampaignTypes] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTypeKey, setFilterTypeKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [typeDropOpen, setTypeDropOpen] = useState(false);
  const typeDropRef = useRef(null);

  // Build a map from type id -> key for badge lookups
  const typeMap = Object.fromEntries(campaignTypes.map((t) => [t.id, t.key]));
  const typeKeyToLabel = Object.fromEntries(
    campaignTypes.map((t) => [t.key, (t.label || t.key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())])
  );

  useEffect(() => {
    function handleClick(e) {
      if (typeDropRef.current && !typeDropRef.current.contains(e.target)) setTypeDropOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterTypeKey) params.campaign_type_key = filterTypeKey;
      const [camps, types] = await Promise.all([
        getCampaigns(params),
        getCampaignTypes(),
      ]);
      setCampaigns(Array.isArray(camps) ? camps : (camps?.items ?? []));
      setCampaignTypes(Array.isArray(types) ? types : (types?.items ?? []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterStatus, filterTypeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAction(action, campaign) {
    try {
      if (action === 'edit') {
        navigate(`/acquisition/campaigns/${campaign.id}/edit`);
        return;
      }
      if (action === 'activate') await activateCampaign(campaign.id);
      else if (action === 'pause') await pauseCampaign(campaign.id);
      else if (action === 'archive') await archiveCampaign(campaign.id);
      else if (action === 'delete') {
        if (!window.confirm(`Delete "${campaign.name}"? This cannot be undone.`)) return;
        await deleteCampaign(campaign.id);
      }
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  const selectedTypeLabelDisplay = filterTypeKey
    ? (typeKeyToLabel[filterTypeKey] || filterTypeKey)
    : 'All Types';

  return (
    <div className="min-h-screen bg-[#0D0F17] text-white px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage acquisition and outreach campaigns</p>
        </div>
        <button
          onClick={() => navigate('/acquisition/campaigns/new')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Campaign
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Status pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((s) => {
            const isActive = (s === 'All' && filterStatus === '') || filterStatus === s;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s === 'All' ? '' : s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white/8 text-gray-400 hover:bg-white/12 hover:text-gray-200'
                }`}
              >
                {s === 'All' ? 'All' : (STATUS_STYLES[s]?.label || s)}
              </button>
            );
          })}
        </div>

        {/* Type dropdown */}
        <div className="relative ml-auto" ref={typeDropRef}>
          <button
            onClick={() => setTypeDropOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/8 hover:bg-white/12 text-sm text-gray-300 transition-colors"
          >
            {selectedTypeLabelDisplay}
            <ChevronDown size={14} className="text-gray-500" />
          </button>
          {typeDropOpen && (
            <div className="absolute right-0 top-9 z-20 w-52 rounded-xl bg-[#1C1F2A] border border-white/10 shadow-xl py-1">
              <button
                onClick={() => { setFilterTypeKey(''); setTypeDropOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/8 ${!filterTypeKey ? 'text-white' : 'text-gray-400'}`}
              >
                All Types
              </button>
              {campaignTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setFilterTypeKey(t.key); setTypeDropOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/8 ${filterTypeKey === t.key ? 'text-white' : 'text-gray-400'}`}
                >
                  {typeKeyToLabel[t.key] || t.key}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active filter clear */}
        {(filterStatus || filterTypeKey) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterTypeKey(''); }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-200 hover:bg-white/8 transition-colors"
          >
            <X size={12} />
            Clear filters
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : campaigns.length === 0 ? (
          <EmptyState onNew={() => navigate('/acquisition/campaigns/new')} />
        ) : (
          campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              typeMap={typeMap}
              onAction={handleAction}
              onClick={() => navigate(`/acquisition/submissions?campaign_id=${c.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}
