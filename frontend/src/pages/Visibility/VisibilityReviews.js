import React, { useEffect, useState, useCallback } from 'react';
import {
  Star, Plus, Trash2, Wand2, CheckCircle, RefreshCw,
  AlertCircle, X, Filter, ChevronDown, Send, Edit3
} from 'lucide-react';
import { getReviews, createReview, deleteReview, draftReply, setReply } from '../../services/visibilityApi';

const SOURCES = ['all', 'google', 'zomato', 'justdial', 'tripadvisor', 'manual'];
const REPLY_STATUSES = ['all', 'none', 'drafted', 'approved', 'published'];

const SOURCE_COLORS = {
  google: 'bg-blue-500/15 text-blue-400',
  zomato: 'bg-red-500/15 text-red-400',
  justdial: 'bg-yellow-500/15 text-yellow-400',
  tripadvisor: 'bg-green-500/15 text-green-400',
  manual: 'bg-white/8 text-gray-500',
};

const SENTIMENT_COLORS = {
  positive: 'text-emerald-400',
  neutral: 'text-amber-500',
  negative: 'text-red-500',
};

const REPLY_STATUS_CONFIG = {
  none: { label: 'No Reply', cls: 'bg-white/8 text-gray-500' },
  drafted: { label: 'Draft Ready', cls: 'bg-amber-500/15 text-amber-400' },
  approved: { label: 'Approved', cls: 'bg-blue-500/15 text-blue-400' },
  published: { label: 'Published', cls: 'bg-green-500/15 text-green-400' },
};

function StarRow({ rating, size = 14 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={size}
          className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-500'}
        />
      ))}
    </div>
  );
}

function AddReviewModal({ onSave, onClose }) {
  const [form, setForm] = useState({ author_name: '', rating: 5, content: '', source: 'manual' });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.rating) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59] flex items-center justify-center p-4">
      <div className="bg-[#13161D] border border-white/8 rounded-3xl shadow-2xl w-full max-w-lg z-[60]">
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <h2 className="font-semibold text-white">Add Review</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors duration-150">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Author Name</label>
              <input
                value={form.author_name}
                onChange={e => set('author_name', e.target.value)}
                placeholder="Customer name"
                className="w-full px-3 py-2 rounded-xl border border-white/8 bg-[#0D0F17] text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Source</label>
              <select
                value={form.source}
                onChange={e => set('source', e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-white/8 bg-[#0D0F17] text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {SOURCES.filter(s => s !== 'all').map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Rating</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => set('rating', n)}>
                  <Star
                    size={24}
                    className={n <= form.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-500 hover:text-amber-300 transition-colors'}
                  />
                </button>
              ))}
              <span className="text-sm text-gray-500 ml-1">{form.rating}/5</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Review Content</label>
            <textarea
              value={form.content}
              onChange={e => set('content', e.target.value)}
              placeholder="What did the customer say?"
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-white/8 bg-[#0D0F17] text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-gray-500 resize-none"
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
            <Plus size={14} />
            {saving ? 'Adding…' : 'Add Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ review, onDraft, onApprove, onPublish, onDelete }) {
  const [replyText, setReplyText] = useState(review.reply_content || review.ai_draft || '');
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showReply, setShowReply] = useState(!!review.ai_draft || !!review.reply_content);

  const cfg = REPLY_STATUS_CONFIG[review.reply_status] || REPLY_STATUS_CONFIG.none;

  const handleDraft = async () => {
    setDrafting(true);
    try {
      const updated = await onDraft(review.id);
      setReplyText(updated.ai_draft || '');
      setShowReply(true);
    } finally {
      setDrafting(false);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      await onApprove(review.id, replyText);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      await onPublish(review.id, replyText);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#13161D] border border-white/8 rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full accent-gradient-bg flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {(review.author_name || '?')[0].toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-white text-sm">{review.author_name || 'Anonymous'}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <StarRow rating={review.rating} />
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_COLORS[review.source] || SOURCE_COLORS.manual}`}>
                {review.source}
              </span>
              {review.sentiment && (
                <span className={`text-xs font-medium ${SENTIMENT_COLORS[review.sentiment]}`}>
                  {review.sentiment}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.cls}`}>{cfg.label}</span>
          <button
            onClick={() => onDelete(review.id)}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-500 transition-colors duration-150"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {review.content && (
        <p className="text-sm text-white leading-relaxed">{review.content}</p>
      )}

      {review.reviewed_at && (
        <p className="text-xs text-gray-500">
          {new Date(review.reviewed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}

      {/* Reply section */}
      {showReply && (
        <div className="pt-3 border-t border-white/8 space-y-2">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reply</label>
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-white/8 bg-[#0D0F17] text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
          <div className="flex items-center justify-end gap-2">
            {review.reply_status !== 'published' && (
              <button
                onClick={() => setShowReply(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-white/8 transition-colors duration-150"
              >
                Hide
              </button>
            )}
            {review.reply_status === 'published' ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle size={12} />
                Reply published
              </div>
            ) : review.reply_status === 'approved' ? (
              <button
                onClick={handlePublish}
                disabled={saving || !replyText.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <Send size={12} />
                {saving ? 'Publishing…' : 'Publish'}
              </button>
            ) : (
              <button
                onClick={handleApprove}
                disabled={saving || !replyText.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white accent-gradient-bg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <CheckCircle size={12} />
                {saving ? 'Saving…' : 'Approve'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleDraft}
          disabled={drafting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/8 text-gray-500 hover:text-white hover:bg-white/8 transition-colors duration-150 disabled:opacity-50"
        >
          <Wand2 size={12} className={drafting ? 'animate-pulse' : ''} />
          {drafting ? 'Drafting…' : 'AI Draft Reply'}
        </button>
        {!showReply && review.reply_status !== 'published' && (
          <button
            onClick={() => { setReplyText(''); setShowReply(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/8 text-gray-500 hover:text-white hover:bg-white/8 transition-colors duration-150"
          >
            <Edit3 size={12} />
            Write Reply
          </button>
        )}
      </div>
    </div>
  );
}

const VisibilityReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filterSource, setFilterSource] = useState('all');
  const [filterReplyStatus, setFilterReplyStatus] = useState('all');
  const [filterRating, setFilterRating] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filterSource !== 'all') params.source = filterSource;
      if (filterReplyStatus !== 'all') params.reply_status = filterReplyStatus;
      if (filterRating !== 'all') params.rating = parseInt(filterRating, 10);
      const data = await getReviews(params);
      setReviews(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterSource, filterReplyStatus, filterRating]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (form) => {
    const created = await createReview(form);
    setReviews(prev => [created, ...prev]);
  };

  const handleDraft = async (id) => {
    const updated = await draftReply(id);
    setReviews(prev => prev.map(r => r.id === id ? updated : r));
    return updated;
  };

  const handleApprove = async (id, replyContent) => {
    const updated = await setReply(id, { reply_content: replyContent, reply_status: 'approved' });
    setReviews(prev => prev.map(r => r.id === id ? updated : r));
  };

  const handlePublish = async (id, replyContent) => {
    const updated = await setReply(id, { reply_content: replyContent, reply_status: 'published' });
    setReviews(prev => prev.map(r => r.id === id ? updated : r));
  };

  const handleDelete = async (id) => {
    await deleteReview(id);
    setReviews(prev => prev.filter(r => r.id !== id));
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';
  const unreplied = reviews.filter(r => r.reply_status === 'none').length;

  return (
    <div className="min-h-screen bg-[#0D0F17] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reviews</h1>
          <p className="text-sm text-gray-500 mt-0.5">All your reviews in one inbox</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 text-sm text-gray-500 hover:text-white hover:bg-white/8 transition-colors duration-200"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white accent-gradient-bg hover:opacity-90 transition-opacity duration-150"
          >
            <Plus size={14} />
            Add Review
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Reviews', value: reviews.length },
          { label: 'Avg Rating', value: avgRating },
          { label: 'Awaiting Reply', value: unreplied },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#13161D] border border-white/8 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter size={14} className="text-gray-500" />
        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-white/8 bg-[#0D0F17] text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {SOURCES.map(s => <option key={s} value={s}>{s === 'all' ? 'All Sources' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select
          value={filterRating}
          onChange={e => setFilterRating(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-white/8 bg-[#0D0F17] text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="all">All Ratings</option>
          {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} Star{n !== 1 ? 's' : ''}</option>)}
        </select>
        <select
          value={filterReplyStatus}
          onChange={e => setFilterReplyStatus(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-white/8 bg-[#0D0F17] text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {REPLY_STATUSES.map(s => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Statuses' : REPLY_STATUS_CONFIG[s]?.label || s}
            </option>
          ))}
        </select>
      </div>

      {/* Review List */}
      {loading && reviews.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-white/8 border-t-transparent animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Star size={32} className="text-gray-500 mb-3" />
          <p className="text-white font-medium">No reviews yet</p>
          <p className="text-sm text-gray-500 mt-1">Add your first review or connect a platform to import</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              onDraft={handleDraft}
              onApprove={handleApprove}
              onPublish={handlePublish}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showAdd && <AddReviewModal onSave={handleCreate} onClose={() => setShowAdd(false)} />}
    </div>
  );
};

export default VisibilityReviews;
