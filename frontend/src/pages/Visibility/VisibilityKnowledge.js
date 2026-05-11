import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen, HelpCircle, Star, Plus, Pencil, Trash2,
  ChevronUp, ChevronDown, Save, X, AlertCircle, Loader2,
  RefreshCw, Eye, EyeOff, ExternalLink
} from 'lucide-react';
import {
  getKnowledgeEntries,
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
} from '../../services/visibilityApi';

const TABS = [
  { id: 'faq', label: 'FAQ', icon: HelpCircle, hint: 'Questions & answers AI crawlers cite when users ask about your business' },
  { id: 'highlight', label: 'Highlights', icon: Star, hint: 'Key dishes, services, or achievements worth featuring in AI responses' },
];

function EntryCard({ entry, onEdit, onDelete, onMove, isFirst, isLast }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(entry.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`bg-[#13161D] border border-white/8 rounded-2xl p-4 space-y-2 ${!entry.active ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-snug">{entry.title}</p>
          {entry.body && (
            <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-3">{entry.body}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {!entry.active && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-gray-500 border border-white/8 mr-1">Hidden</span>
          )}
          <button
            onClick={() => onMove(entry.id, 'up')}
            disabled={isFirst}
            className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors duration-150 disabled:opacity-30"
          >
            <ChevronUp size={13} />
          </button>
          <button
            onClick={() => onMove(entry.id, 'down')}
            disabled={isLast}
            className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors duration-150 disabled:opacity-30"
          >
            <ChevronDown size={13} />
          </button>
          <button
            onClick={() => onEdit(entry)}
            className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors duration-150"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-500 transition-colors duration-150"
          >
            {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryModal({ entry, category, onSave, onClose }) {
  const isEdit = !!entry;
  const isFaq = category === 'faq';

  const [title, setTitle] = useState(entry?.title || '');
  const [body, setBody] = useState(entry?.body || '');
  const [active, setActive] = useState(entry?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ title: title.trim(), body: body.trim() || null, active });
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59] flex items-center justify-center p-4">
      <div className="bg-[#13161D] border border-white/8 rounded-3xl shadow-2xl w-full max-w-lg z-[60]">
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <h2 className="font-semibold text-white">
            {isEdit ? 'Edit' : 'Add'} {isFaq ? 'FAQ' : 'Highlight'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors duration-150">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-xs">
              <AlertCircle size={13} />
              {error}
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              {isFaq ? 'Question' : 'Title'}
            </label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={isFaq ? 'e.g. What are your opening hours?' : 'e.g. Signature Lamb Biryani'}
              className="w-full px-3 py-2 rounded-xl border border-white/8 bg-[#0D0F17] text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-gray-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              {isFaq ? 'Answer' : 'Description'}
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              placeholder={
                isFaq
                  ? 'e.g. We are open Monday–Saturday, 11am–10pm and Sunday 12pm–9pm.'
                  : 'e.g. Slow-cooked with saffron and whole spices, our signature lamb biryani has been on the menu since day one.'
              }
              className="w-full px-3 py-2 rounded-xl border border-white/8 bg-[#0D0F17] text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-gray-500 resize-none"
            />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div
              onClick={() => setActive(v => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${active ? 'accent-gradient-bg' : 'bg-white/8'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-white">Visible on knowledge page</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/8">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:text-white hover:bg-white/8 transition-colors duration-150">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white accent-gradient-bg hover:opacity-90 transition-opacity duration-150 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : `Add ${isFaq ? 'FAQ' : 'Highlight'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewPanel({ faqs, highlights, businessName }) {
  return (
    <div className="bg-white/8/40 border border-white/8 rounded-2xl p-5 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <ExternalLink size={13} className="text-gray-500" />
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">AI Crawler Preview</span>
      </div>

      <div>
        <h3 className="text-base font-bold text-white mb-0.5">{businessName || 'Your Business'}</h3>
        <p className="text-xs text-gray-500">Schema.org JSON-LD · FAQPage · LocalBusiness</p>
      </div>

      {faqs.filter(e => e.active).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white">Frequently Asked Questions</p>
          {faqs.filter(e => e.active).map(e => (
            <div key={e.id} className="pl-3 border-l-2 border-white/8 space-y-0.5">
              <p className="text-xs font-medium text-white">{e.title}</p>
              {e.body && <p className="text-xs text-gray-500">{e.body}</p>}
            </div>
          ))}
        </div>
      )}

      {highlights.filter(e => e.active).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white">Highlights</p>
          <div className="flex flex-wrap gap-1.5">
            {highlights.filter(e => e.active).map(e => (
              <span key={e.id} className="text-xs px-2.5 py-1 rounded-full bg-[#13161D] border border-white/8 text-white">
                {e.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {faqs.filter(e => e.active).length === 0 && highlights.filter(e => e.active).length === 0 && (
        <p className="text-xs text-gray-500 italic">Add FAQ entries and highlights to see how your knowledge page will appear to AI crawlers.</p>
      )}
    </div>
  );
}

const VisibilityKnowledge = () => {
  const [activeTab, setActiveTab] = useState('faq');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // null | { mode: 'add' | 'edit', entry?: object }
  const [showPreview, setShowPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getKnowledgeEntries();
      setEntries(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabEntries = entries
    .filter(e => e.category === activeTab)
    .sort((a, b) => a.sort_order - b.sort_order);

  const faqs = entries.filter(e => e.category === 'faq').sort((a, b) => a.sort_order - b.sort_order);
  const highlights = entries.filter(e => e.category === 'highlight').sort((a, b) => a.sort_order - b.sort_order);

  const handleSave = async (data) => {
    if (modal?.mode === 'edit') {
      const updated = await updateKnowledgeEntry(modal.entry.id, data);
      setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
    } else {
      const created = await createKnowledgeEntry({ ...data, category: activeTab, sort_order: tabEntries.length });
      setEntries(prev => [...prev, created]);
    }
  };

  const handleDelete = async (id) => {
    await deleteKnowledgeEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleMove = async (id, direction) => {
    const list = [...tabEntries];
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;

    const a = list[idx];
    const b = list[swapIdx];
    const newSortA = b.sort_order;
    const newSortB = a.sort_order;

    // Optimistic update
    setEntries(prev => prev.map(e => {
      if (e.id === a.id) return { ...e, sort_order: newSortA };
      if (e.id === b.id) return { ...e, sort_order: newSortB };
      return e;
    }));

    try {
      await Promise.all([
        updateKnowledgeEntry(a.id, { sort_order: newSortA }),
        updateKnowledgeEntry(b.id, { sort_order: newSortB }),
      ]);
    } catch {
      load(); // revert on failure
    }
  };

  const tab = TABS.find(t => t.id === activeTab);
  const TabIcon = tab?.icon;

  return (
    <div className="min-h-screen bg-[#0D0F17] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Knowledge Pages</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Structured content served at <span className="font-mono text-xs bg-white/8 px-1.5 py-0.5 rounded">/info/[outlet]</span> — cited by ChatGPT, Perplexity, and Google AI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-xl border border-white/8 text-gray-500 hover:text-white hover:bg-white/8 transition-colors duration-200"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowPreview(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 text-sm transition-colors duration-200 ${showPreview ? 'bg-white/8 text-white' : 'text-gray-500 hover:text-white hover:bg-white/8'}`}
          >
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            Preview
          </button>
          <button
            onClick={() => setModal({ mode: 'add' })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white accent-gradient-bg hover:opacity-90 transition-opacity duration-150"
          >
            <Plus size={14} />
            Add {tab?.label === 'FAQ' ? 'FAQ' : 'Highlight'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className={`${showPreview ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : ''}`}>
        <div className={`${showPreview ? 'lg:col-span-2' : ''} space-y-4`}>
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-white/8 rounded-xl w-fit">
            {TABS.map(t => {
              const Icon = t.icon;
              const count = entries.filter(e => e.category === t.id).length;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    activeTab === t.id
                      ? 'bg-[#13161D] text-white shadow-sm border border-white/8'
                      : 'text-gray-500 hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-white/8 text-gray-500' : 'bg-[#13161D] text-gray-500'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab hint */}
          <p className="text-xs text-gray-500">{tab?.hint}</p>

          {/* Entry list */}
          {loading && entries.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-white/8 border-t-transparent animate-spin" />
            </div>
          ) : tabEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-2xl accent-gradient-bg mb-4">
                {TabIcon && <TabIcon size={24} className="text-white" />}
              </div>
              <p className="text-white font-medium">
                No {activeTab === 'faq' ? 'FAQ entries' : 'highlights'} yet
              </p>
              <p className="text-sm text-gray-500 mt-1 max-w-xs">
                {activeTab === 'faq'
                  ? 'Add questions your customers frequently ask. Each Q&A becomes a structured data entry that AI crawlers can cite directly.'
                  : 'Add your standout dishes, services, or achievements. These appear as named highlights in AI-generated responses about your business.'}
              </p>
              <button
                onClick={() => setModal({ mode: 'add' })}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-white accent-gradient-bg hover:opacity-90 transition-opacity duration-150"
              >
                <Plus size={14} />
                Add First {activeTab === 'faq' ? 'FAQ' : 'Highlight'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {tabEntries.map((entry, idx) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={(e) => setModal({ mode: 'edit', entry: e })}
                  onDelete={handleDelete}
                  onMove={handleMove}
                  isFirst={idx === 0}
                  isLast={idx === tabEntries.length - 1}
                />
              ))}
            </div>
          )}

          {/* Stats footer */}
          {(entries.length > 0) && (
            <div className="flex items-center gap-4 pt-2 border-t border-white/8">
              <div className="text-xs text-gray-500">
                <span className="font-medium text-white">{faqs.filter(e => e.active).length}</span> active FAQ{faqs.filter(e => e.active).length !== 1 ? 's' : ''}
              </div>
              <div className="text-xs text-gray-500">
                <span className="font-medium text-white">{highlights.filter(e => e.active).length}</span> active highlight{highlights.filter(e => e.active).length !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <div className={`w-2 h-2 rounded-full ${(faqs.length + highlights.length) > 0 ? 'bg-emerald-500' : 'bg-white/8-foreground'}`} />
                <span className="text-xs text-gray-500">
                  {(faqs.length + highlights.length) > 0 ? 'Knowledge page live' : 'No content yet'}
                </span>
              </div>
            </div>
          )}
        </div>

        {showPreview && (
          <div className="lg:col-span-1">
            <PreviewPanel faqs={faqs} highlights={highlights} />
          </div>
        )}
      </div>

      {modal && (
        <EntryModal
          entry={modal.entry || null}
          category={activeTab}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};

export default VisibilityKnowledge;
