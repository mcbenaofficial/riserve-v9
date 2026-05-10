import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Calendar, Grid, Plus, Image, Film, AlignLeft, Upload,
  Clock, Loader2, ChevronLeft, ChevronRight, X, Hash,
  Link2, Trash2, Send, Edit2, AlertCircle, CheckCircle2,
  Play, ImageIcon, Sparkles, ChevronDown, ChevronUp, Lightbulb,
} from 'lucide-react';
import {
  getPosts, createPost, updatePost, deletePost, publishPost,
  getAccounts, getMedia, deleteMedia, uploadMedia, generateCaption,
} from '../../services/acquisitionApi';

const STATUS_COLOR = {
  draft: 'bg-gray-500/20 text-gray-400',
  scheduled: 'bg-blue-500/20 text-blue-400',
  publishing: 'bg-amber-500/20 text-amber-400',
  published: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
  archived: 'bg-gray-500/10 text-gray-500',
};

const KIND_ICON = { feed: Image, reel: Film, story: AlignLeft, carousel: Grid };

const KIND_RULES = {
  feed:     { accepts: 'image/*,video/*', maxFiles: 1,  hint: 'JPEG/PNG/WebP · max 8 MB   or   MP4/MOV · max 100 MB' },
  reel:     { accepts: 'video/*',         maxFiles: 1,  hint: 'MP4/MOV · max 1 GB · 15–90 s · 9:16 recommended' },
  story:    { accepts: 'image/*,video/*', maxFiles: 1,  hint: 'JPEG/PNG · max 8 MB   or   MP4/MOV · max 100 MB · 9:16' },
  carousel: { accepts: 'image/*,video/*', maxFiles: 10, hint: '2–10 items · JPEG/PNG or MP4/MOV · mix of types OK' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const GROWTH_TIPS = [
  {
    category: 'Content Strategy',
    tips: [
      'Post 3–5 times weekly — Reels drive 36% more reach, carousels 12% more engagement.',
      'Define 3–5 content pillars (e.g. behind-the-scenes, offers, lifestyle) and stick to them.',
      'Lead with a hook in the first line — viewers scroll fast.',
      'Add 3–5 niche hashtags per post (not 30 generic ones).',
    ],
  },
  {
    category: 'Best Days & Times',
    tips: [
      'Reels: Wed–Thu, 9–11 AM or 6–8 PM for highest discovery.',
      'Stories: Tue–Wed midday or evening; post daily for recency signals.',
      'Feed & Carousels: Mon–Thu, 2–4 PM; mornings work well for education content.',
      'Avoid weekends for feed posts; Friday early AM for promos.',
    ],
  },
  {
    category: 'Engagement Tactics',
    tips: [
      'Reply to every comment — each reply adds ~21% engagement lift.',
      'Use Stories polls and questions daily to stay top-of-feed.',
      'DM shares (sends per reach) are the strongest algorithm signal — create share-worthy content.',
      'Cross-promote on LinkedIn and Twitter for a quick follower boost.',
    ],
  },
  {
    category: 'Algorithm Rules',
    tips: [
      'Longer Reels (up to 3 min) now qualify for Explore — don\'t cut short artificially.',
      'Repeat views count — create content worth rewatching (tutorials, reveals).',
      'Maintain niche consistency in your last 9–12 posts for category recognition.',
      'Avoid follow-unfollow tactics — they trigger penalties that suppress reach.',
    ],
  },
];

function GrowthTipsPanel({ isDark }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#13161D] border-white/8' : 'bg-white border-gray-200'}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium transition-colors ${isDark ? 'hover:bg-white/3' : 'hover:bg-gray-50'}`}
      >
        <span className="flex items-center gap-2">
          <Lightbulb size={14} className="text-amber-400" />
          Growth Tips
          <span className="text-xs text-gray-500 font-normal">Instagram 2025 best practices</span>
        </span>
        {open ? <ChevronUp size={15} className="text-gray-500" /> : <ChevronDown size={15} className="text-gray-500" />}
      </button>

      {open && (
        <div className={`border-t ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
          {/* Tab strip */}
          <div className={`flex overflow-x-auto gap-1 px-4 py-2 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
            {GROWTH_TIPS.map((section, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === i
                    ? 'bg-[var(--accent)] text-white'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {section.category}
              </button>
            ))}
          </div>
          {/* Tips list */}
          <ul className="px-5 py-4 flex flex-col gap-2.5">
            {GROWTH_TIPS[activeTab].tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-400">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function fmtBytes(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function calendarDays(year, month) {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  return cells;
}

// ---------------------------------------------------------------------------
// MediaZone — drag-drop upload with preview grid
// ---------------------------------------------------------------------------
function MediaZone({ kind, assets, onAdd, onRemove, uploading, uploadError, theme }) {
  const isDark = theme === 'dark';
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const rules = KIND_RULES[kind] || KIND_RULES.feed;
  const canAdd = assets.length < rules.maxFiles;

  const handleFiles = (fileList) => {
    const files = Array.from(fileList).slice(0, rules.maxFiles - assets.length);
    files.forEach(onAdd);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-500">
          Media
          {kind === 'carousel' && (
            <span className="ml-1 text-gray-600">({assets.length}/{rules.maxFiles})</span>
          )}
        </label>
        {kind === 'carousel' && assets.length >= 2 && (
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 size={10} /> minimum met
          </span>
        )}
      </div>

      {/* Preview grid */}
      {assets.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {assets.map((asset) => (
            <div key={asset.id} className="relative aspect-square rounded-xl overflow-hidden bg-black/30 group">
              {asset.kind === 'video' ? (
                <>
                  <video
                    src={asset.storage_url}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play size={20} className="text-white" fill="white" />
                  </div>
                  <div className="absolute bottom-1 left-1 flex items-center gap-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded-full">
                    <Film size={8} /> {fmtBytes(asset.file_size)}
                  </div>
                </>
              ) : (
                <>
                  <img src={asset.storage_url} alt={asset.alt_text || ''} className="w-full h-full object-cover" />
                  <div className="absolute bottom-1 left-1 flex items-center gap-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded-full">
                    <ImageIcon size={8} /> {fmtBytes(asset.file_size)}
                  </div>
                </>
              )}
              <button
                onClick={() => onRemove(asset.id)}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {canAdd && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all select-none ${
            uploading ? 'opacity-60 cursor-default' : 'cursor-pointer'
          } ${
            dragging
              ? 'border-[var(--accent)] bg-[var(--accent)]/5 scale-[1.01]'
              : isDark
                ? 'border-white/10 hover:border-white/25 hover:bg-white/[0.02]'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={22} className="animate-spin text-[var(--accent)]" />
              <p className="text-sm text-gray-400">Uploading…</p>
            </div>
          ) : (
            <>
              <Upload size={22} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-400">
                Drop {kind === 'reel' ? 'a video' : kind === 'carousel' ? 'files' : 'a photo or video'} here
                {assets.length === 0 ? ' or click to browse' : ''}
              </p>
              <p className="text-xs text-gray-600 mt-1">{rules.hint}</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={rules.accepts}
            multiple={kind === 'carousel'}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {uploadError && (
        <p className="text-red-400 text-xs flex items-center gap-1.5 bg-red-500/10 px-3 py-2 rounded-xl">
          <AlertCircle size={12} /> {uploadError}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PostCard
// ---------------------------------------------------------------------------
function PostCard({ post, assets, onEdit, onDelete, onPublish, theme }) {
  const isDark = theme === 'dark';
  const KindIcon = KIND_ICON[post.kind] || Image;
  const coverAsset = (post.media_asset_ids || [])
    .map((id) => assets.find((a) => a.id === id))
    .find(Boolean);

  return (
    <div className={`rounded-2xl border overflow-hidden flex flex-col ${isDark ? 'bg-[#13161D] border-white/8' : 'bg-white border-gray-200'}`}>
      {/* Media thumbnail */}
      {coverAsset ? (
        <div className="aspect-[4/3] bg-black/20 relative overflow-hidden">
          {coverAsset.kind === 'video' ? (
            <>
              <video src={coverAsset.storage_url} className="w-full h-full object-cover" muted preload="metadata" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                  <Play size={16} className="text-white ml-0.5" fill="white" />
                </div>
              </div>
            </>
          ) : (
            <img src={coverAsset.storage_url} alt="" className="w-full h-full object-cover" />
          )}
          {(post.media_asset_ids || []).length > 1 && (
            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
              +{post.media_asset_ids.length - 1}
            </div>
          )}
        </div>
      ) : (
        <div className={`aspect-[4/3] flex items-center justify-center ${isDark ? 'bg-white/3' : 'bg-gray-50'}`}>
          <KindIcon size={32} className="text-gray-600" />
        </div>
      )}

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[post.status] || STATUS_COLOR.draft}`}>
              {post.status}
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <KindIcon size={11} /> {post.kind}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(post)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors">
              <Edit2 size={13} />
            </button>
            <button onClick={() => onDelete(post.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {post.caption && (
          <p className="text-sm text-gray-400 line-clamp-2">{post.caption}</p>
        )}

        {(post.hashtags || []).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {post.hashtags.slice(0, 3).map((h) => (
              <span key={h} className="text-xs text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">#{h}</span>
            ))}
            {post.hashtags.length > 3 && <span className="text-xs text-gray-500">+{post.hashtags.length - 3}</span>}
          </div>
        )}

        {post.scheduled_for && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock size={11} /> {new Date(post.scheduled_for).toLocaleString()}
          </div>
        )}

        <div className="mt-auto flex gap-2">
          {(post.status === 'draft' || post.status === 'scheduled' || post.status === 'failed') && (
            <button
              onClick={() => onPublish(post.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
            >
              <Send size={11} /> Publish Now
            </button>
          )}
          {post.external_permalink && (
            <a href={post.external_permalink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline">
              <Link2 size={11} /> View
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ComposerDrawer
// ---------------------------------------------------------------------------
const CAPTION_LENGTHS = [
  { value: 'short',  label: 'Short',  desc: '< 125 chars' },
  { value: 'medium', label: 'Medium', desc: '150–300 chars' },
  { value: 'long',   label: 'Long',   desc: '700+ chars' },
  { value: 'mix',    label: 'Recommended Mix', desc: '3 variants · 60/30/10%' },
];

function AiWritePanel({ onInsert, theme }) {
  const isDark = theme === 'dark';
  const [theme_input, setThemeInput] = useState('');
  const [ideas, setIdeas] = useState('');
  const [length, setLength] = useState('short');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const generate = async () => {
    if (!theme_input.trim()) { setError('Enter a content theme.'); return; }
    setGenerating(true);
    setError('');
    setResult('');
    try {
      const data = await generateCaption({ theme: theme_input, ideas, length });
      setResult(data.caption);
    } catch (e) {
      let msg = e.message;
      try { msg = JSON.parse(msg)?.detail || msg; } catch {}
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${isDark ? 'bg-[var(--accent)]/5 border-[var(--accent)]/20' : 'bg-violet-50 border-violet-200'}`}>
      <div className="flex items-center gap-2">
        <Sparkles size={13} className="text-[var(--accent)]" />
        <span className="text-xs font-medium text-[var(--accent)]">AI Write</span>
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Content theme *</label>
        <input
          type="text"
          value={theme_input}
          onChange={(e) => setThemeInput(e.target.value)}
          placeholder="e.g. Sunday brunch specials at our rooftop…"
          className={`w-full rounded-xl px-3 py-2 text-sm border ${isDark ? 'bg-[#0B0D10] border-white/10 text-white placeholder-gray-600' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Key ideas / notes (optional)</label>
        <textarea
          rows={2}
          value={ideas}
          onChange={(e) => setIdeas(e.target.value)}
          placeholder="Mention the deal, the mood, a quote…"
          className={`w-full rounded-xl px-3 py-2 text-sm border resize-none ${isDark ? 'bg-[#0B0D10] border-white/10 text-white placeholder-gray-600' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">Caption length</label>
        <div className="grid grid-cols-2 gap-1.5">
          {CAPTION_LENGTHS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setLength(opt.value)}
              className={`text-left px-3 py-2 rounded-xl border text-xs transition-colors ${
                length === opt.value
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                  : isDark ? 'border-white/10 text-gray-400 hover:border-white/20' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className="font-medium">{opt.label}</span>
              <span className={`block text-[10px] mt-0.5 ${length === opt.value ? 'text-[var(--accent)]/70' : 'text-gray-500'}`}>{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-xs flex items-center gap-1.5 bg-red-500/10 px-3 py-2 rounded-xl">
          <AlertCircle size={11} /> {error}
        </p>
      )}

      {result && (
        <div className={`rounded-xl border p-3 text-sm whitespace-pre-wrap ${isDark ? 'bg-[#0B0D10] border-white/10 text-gray-300' : 'bg-white border-gray-200 text-gray-700'}`}>
          {result}
          <button
            onClick={() => onInsert(result)}
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
          >
            Use this caption
          </button>
        </div>
      )}

      <button
        onClick={generate}
        disabled={generating}
        className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {generating ? 'Generating…' : 'Generate caption'}
      </button>
    </div>
  );
}

function ComposerDrawer({ open, post, accounts, allAssets, onClose, onSaved, onAssetCreated, theme }) {
  const isDark = theme === 'dark';
  const [form, setForm] = useState({
    social_account_id: '',
    kind: 'feed',
    caption: '',
    hashtags: '',
    scheduled_for: '',
    media_asset_ids: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [aiWriteOpen, setAiWriteOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (post) {
      setForm({
        social_account_id: post.social_account_id || '',
        kind: post.kind || 'feed',
        caption: post.caption || '',
        hashtags: (post.hashtags || []).join(' '),
        scheduled_for: post.scheduled_for ? new Date(post.scheduled_for).toISOString().slice(0, 16) : '',
        media_asset_ids: post.media_asset_ids || [],
      });
    } else {
      setForm({
        social_account_id: accounts[0]?.id || '',
        kind: 'feed',
        caption: '',
        hashtags: '',
        scheduled_for: '',
        media_asset_ids: [],
      });
    }
    setError('');
    setUploadError('');
  }, [post, accounts, open]);

  // When kind changes, clear media if incompatible
  const handleKindChange = (k) => {
    const isReel = k === 'reel';
    const incompatible = isReel
      ? currentAssets.filter((a) => a.kind !== 'video').map((a) => a.id)
      : [];
    setForm((f) => ({
      ...f,
      kind: k,
      media_asset_ids: f.media_asset_ids.filter((id) => !incompatible.includes(id)),
    }));
  };

  const currentAssets = (form.media_asset_ids || [])
    .map((id) => allAssets.find((a) => a.id === id))
    .filter(Boolean);

  const handleAddFile = async (file) => {
    setUploading(true);
    setUploadError('');
    try {
      const asset = await uploadMedia(file, { kind: form.kind });
      onAssetCreated(asset);
      setForm((f) => ({ ...f, media_asset_ids: [...f.media_asset_ids, asset.id] }));
    } catch (e) {
      // Unwrap JSON error detail if present
      let msg = e.message;
      try { msg = JSON.parse(msg)?.detail || msg; } catch {}
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAsset = async (assetId) => {
    setForm((f) => ({ ...f, media_asset_ids: f.media_asset_ids.filter((id) => id !== assetId) }));
    try { await deleteMedia(assetId); } catch {}
  };

  const save = async () => {
    if (!form.social_account_id) { setError('Select an Instagram account.'); return; }
    if (form.kind === 'carousel' && form.media_asset_ids.length < 2) {
      setError('Carousel requires at least 2 media items.'); return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        social_account_id: form.social_account_id,
        kind: form.kind,
        caption: form.caption,
        hashtags: form.hashtags.split(/[\s,#]+/).filter(Boolean),
        scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null,
        media_asset_ids: form.media_asset_ids,
      };
      if (post) {
        await updatePost(post.id, payload);
      } else {
        await createPost(payload);
      }
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59]" onClick={onClose} />
      <div className={`fixed right-0 top-0 h-full w-[480px] z-[60] flex flex-col shadow-2xl border-l ${isDark ? 'bg-[#13161D] border-white/8' : 'bg-white border-gray-200'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
          <h2 className="font-semibold text-base">{post ? 'Edit Post' : 'New Post'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Account */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Instagram Account</label>
            <select
              value={form.social_account_id}
              onChange={(e) => setForm((f) => ({ ...f, social_account_id: e.target.value }))}
              className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-[#0B0D10] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>@{a.handle || a.display_name}</option>
              ))}
              {accounts.length === 0 && <option value="">No accounts connected</option>}
            </select>
          </div>

          {/* Post Type */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Post Type</label>
            <div className="grid grid-cols-4 gap-2">
              {['feed', 'reel', 'story', 'carousel'].map((k) => {
                const Icon = KIND_ICON[k];
                return (
                  <button
                    key={k}
                    onClick={() => handleKindChange(k)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium capitalize transition-colors ${
                      form.kind === k
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                        : isDark ? 'border-white/10 text-gray-400 hover:border-white/20' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={15} /> {k}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Media Upload */}
          <MediaZone
            kind={form.kind}
            assets={currentAssets}
            onAdd={handleAddFile}
            onRemove={handleRemoveAsset}
            uploading={uploading}
            uploadError={uploadError}
            theme={theme}
          />

          {/* Caption */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500">Caption</label>
              <button
                onClick={() => setAiWriteOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  aiWriteOpen
                    ? 'bg-[var(--accent)] text-white'
                    : isDark ? 'bg-white/8 text-gray-400 hover:text-white' : 'bg-gray-100 text-gray-500 hover:text-gray-800'
                }`}
              >
                <Sparkles size={11} /> AI Write
                {aiWriteOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            </div>
            {aiWriteOpen && (
              <AiWritePanel
                theme={theme}
                onInsert={(text) => {
                  setForm((f) => ({ ...f, caption: text }));
                  setAiWriteOpen(false);
                }}
              />
            )}
            <textarea
              rows={5}
              value={form.caption}
              onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))}
              maxLength={2200}
              placeholder="Write your caption…"
              className={`w-full rounded-xl px-3 py-2.5 text-sm border resize-none ${isDark ? 'bg-[#0B0D10] border-white/10 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
            />
            <p className={`text-xs text-right ${form.caption.length > 2000 ? 'text-amber-400' : 'text-gray-600'}`}>
              {form.caption.length}/2200
            </p>
          </div>

          {/* Hashtags */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 flex items-center gap-1.5">
              <Hash size={11} /> Hashtags
            </label>
            <input
              type="text"
              value={form.hashtags}
              onChange={(e) => setForm((f) => ({ ...f, hashtags: e.target.value }))}
              placeholder="#brunch #reservations #lifestyle"
              className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-[#0B0D10] border-white/10 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
            />
          </div>

          {/* Schedule */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 flex items-center gap-1.5">
              <Clock size={11} /> Schedule For
            </label>
            <input
              type="datetime-local"
              value={form.scheduled_for}
              onChange={(e) => setForm((f) => ({ ...f, scheduled_for: e.target.value }))}
              className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-[#0B0D10] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm flex items-center gap-2 bg-red-500/10 px-3 py-2 rounded-xl">
              <AlertCircle size={14} /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex gap-3 ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
          <button onClick={onClose} className={`flex-1 py-2.5 rounded-xl text-sm border transition-colors ${isDark ? 'border-white/10 text-gray-400 hover:text-white' : 'border-gray-200 text-gray-500 hover:text-gray-800'}`}>
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || uploading || !form.social_account_id}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {post ? 'Save Changes' : 'Create Post'}
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ContentStudio (page)
// ---------------------------------------------------------------------------
export default function ContentStudio() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [view, setView] = useState('calendar');
  const [posts, setPosts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [allAssets, setAllAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const load = async () => {
    setLoading(true);
    try {
      const [p, a, m] = await Promise.all([getPosts(), getAccounts(), getMedia()]);
      setPosts(p);
      setAccounts(a);
      setAllAssets(m);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this post?')) return;
    await deletePost(id);
    load();
  };

  const handlePublish = async (id) => {
    await publishPost(id);
    load();
  };

  // Group posts by day for calendar
  const postsByDay = {};
  posts.forEach((p) => {
    if (p.scheduled_for) {
      const d = new Date(p.scheduled_for);
      if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
        const key = d.getDate();
        if (!postsByDay[key]) postsByDay[key] = [];
        postsByDay[key].push(p);
      }
    }
  });

  const cells = calendarDays(calYear, calMonth);

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Studio</h1>
          <p className="text-sm text-gray-500 mt-0.5">Schedule and publish Instagram content</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex rounded-xl p-1 gap-1 ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
            <button
              onClick={() => setView('calendar')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${view === 'calendar' ? 'bg-[var(--accent)] text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Calendar size={14} /> Calendar
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${view === 'list' ? 'bg-[var(--accent)] text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Grid size={14} /> All Posts
            </button>
          </div>
          <button
            onClick={() => { setEditingPost(null); setComposerOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> New Post
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Posts', val: posts.length },
          { label: 'Scheduled', val: posts.filter((p) => p.status === 'scheduled').length },
          { label: 'Published', val: posts.filter((p) => p.status === 'published').length },
          { label: 'Drafts', val: posts.filter((p) => p.status === 'draft').length },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border p-4 ${isDark ? 'bg-[#13161D] border-white/8' : 'bg-white border-gray-200'}`}>
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-500" />
        </div>
      ) : view === 'calendar' ? (
        <>
        <div className={`rounded-3xl border ${isDark ? 'bg-[#13161D] border-white/8' : 'bg-white border-gray-200'}`}>
          <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-semibold text-base">{MONTHS[calMonth]} {calYear}</h2>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 border-b border-white/5">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-medium text-gray-500 py-3">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
              const dayPosts = day ? (postsByDay[day] || []) : [];
              return (
                <div key={i} className={`min-h-[100px] p-2 border-r border-b border-white/5 last:border-r-0 ${!day ? 'opacity-20' : ''}`}>
                  {day && (
                    <>
                      <span className={`text-xs font-medium flex items-center justify-center w-6 h-6 rounded-full mb-1 ${isToday ? 'bg-[var(--accent)] text-white' : 'text-gray-400'}`}>
                        {day}
                      </span>
                      {dayPosts.map((p) => {
                        const KIcon = KIND_ICON[p.kind] || Image;
                        return (
                          <div
                            key={p.id}
                            onClick={() => { setEditingPost(p); setComposerOpen(true); }}
                            className={`mb-1 px-1.5 py-0.5 rounded text-xs truncate cursor-pointer flex items-center gap-1 ${STATUS_COLOR[p.status] || STATUS_COLOR.draft} border border-current/20`}
                          >
                            <KIcon size={9} />
                            {p.caption?.slice(0, 18) || '(no caption)'}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <GrowthTipsPanel isDark={isDark} />
        </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.length === 0 ? (
            <div className="col-span-3 text-center py-20 text-gray-500">No posts yet. Create your first post.</div>
          ) : posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              assets={allAssets}
              theme={theme}
              onEdit={(post) => { setEditingPost(post); setComposerOpen(true); }}
              onDelete={handleDelete}
              onPublish={handlePublish}
            />
          ))}
        </div>
      )}

      <ComposerDrawer
        open={composerOpen}
        post={editingPost}
        accounts={accounts}
        allAssets={allAssets}
        theme={theme}
        onAssetCreated={(asset) => setAllAssets((prev) => [asset, ...prev])}
        onClose={() => { setComposerOpen(false); setEditingPost(null); }}
        onSaved={() => { setComposerOpen(false); setEditingPost(null); load(); }}
      />
    </div>
  );
}
