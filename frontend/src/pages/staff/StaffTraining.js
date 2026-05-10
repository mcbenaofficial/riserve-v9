import React, { useState, useEffect } from 'react';
import { api, getImageUrl } from '../../services/api';
import {
  BookOpen, Users, Plus, Edit2, Trash2, X, Search, Check,
  Clock, Award, Target, Layers, BarChart3, Sparkles, CheckCircle2,
  CheckCircle, XCircle, Volume2, VolumeX, Headphones, Mic, ChevronDown,
  UserCheck
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// TRAINING MODULES
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = ['Compliance', 'Service', 'Safety', 'Sales', 'Operations'];

const CATEGORY_COLORS = {
  Compliance: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Service: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  Safety: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  Sales: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Operations: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
};

const TrainingModules = () => {
  const [activeSubTab, setActiveSubTab] = useState('modules');
  const [modules, setModules] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(null); // module to assign
  const [showContentModal, setShowContentModal] = useState(null); // module to view content
  const [generating, setGenerating] = useState(null); // module_id being generated
  const [generatingAudio, setGeneratingAudio] = useState(null); // module_id being audio-generated
  const [showAudioModal, setShowAudioModal] = useState(null); // module to preview audio

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [modRes, ovRes] = await Promise.all([
        api.getTrainingModules(),
        api.getTrainingOverview(),
      ]);
      setModules(modRes.data);
      setOverview(ovRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this training module?')) return;
    await api.deleteTrainingModule(id);
    fetchAll();
  };

  const handleGenerate = async (module) => {
    if (!module.content) {
      alert('Add source content to this module before generating AI assets.');
      return;
    }
    setGenerating(module.id);
    try {
      await api.aiGenerateTrainingContent(module.id);
      fetchAll();
    } catch (e) {
      alert('AI generation failed. Please try again.');
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateAudio = async (module) => {
    const source = module.content || module.has_study_guide;
    if (!source) {
      alert('Add source content or generate study materials first before generating audio.');
      return;
    }
    setGeneratingAudio(module.id);
    try {
      const res = await api.generateTrainingAudio(module.id);
      setModules(prev => prev.map(m => m.id === module.id ? res.data : m));
      setShowAudioModal(res.data);
    } catch (e) {
      alert('Audio generation failed. Please try again.');
    } finally {
      setGeneratingAudio(null);
    }
  };

  const handleApproveAudio = async (module) => {
    try {
      const res = await api.approveTrainingAudio(module.id);
      setModules(prev => prev.map(m => m.id === module.id ? res.data : m));
      setShowAudioModal(res.data);
    } catch (e) {
      alert('Failed to update approval status.');
    }
  };

  const subTabs = [
    { id: 'modules', label: 'Modules', icon: Layers },
    { id: 'progress', label: 'Completion Progress', icon: BarChart3 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-[#6B7280] dark:text-[#7D8590]">
        Loading training data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview stats */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <TrainingStat label="Active Modules" value={overview.total_modules} icon={BookOpen} color="blue" />
          <TrainingStat label="Active Staff" value={overview.total_staff} icon={Users} color="teal" />
          <TrainingStat label="Total Completions" value={overview.total_completions} icon={CheckCircle2} color="green" />
          <TrainingStat
            label="Avg Completion Rate"
            value={
              overview.modules.length
                ? `${Math.round(overview.modules.reduce((s, m) => s + m.completion_rate, 0) / overview.modules.length)}%`
                : '—'
            }
            icon={Target}
            color="amber"
          />
        </div>
      )}

      {/* Sub-tab nav */}
      <div className="flex gap-1 border-b border-[#D9DEE5] dark:border-[#1F2630]">
        {subTabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t transition-all ${
                activeSubTab === t.id
                  ? 'text-[#5FA8D3] border-b-2 border-[#5FA8D3] bg-[#5FA8D3]/5'
                  : 'text-[#6B7280] dark:text-[#7D8590] hover:text-[#0E1116] dark:hover:text-[#E6E8EB]'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {activeSubTab === 'modules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#6B7280] dark:text-[#7D8590]">
              {modules.length} module{modules.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => { setEditingModule(null); setShowModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#5FA8D3] text-white rounded-lg text-sm font-medium hover:bg-[#4a90bb] transition-colors"
            >
              <Plus size={16} />
              New Module
            </button>
          </div>

          {modules.length === 0 ? (
            <div className="text-center py-16 text-[#6B7280] dark:text-[#7D8590]">
              <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No training modules yet</p>
              <p className="text-sm mt-1">Create your first module to get started.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {modules.map(m => (
                <TrainingModuleCard
                  key={m.id}
                  module={m}
                  generating={generating === m.id}
                  generatingAudio={generatingAudio === m.id}
                  onEdit={() => { setEditingModule(m); setShowModal(true); }}
                  onDelete={() => handleDelete(m.id)}
                  onGenerate={() => handleGenerate(m)}
                  onGenerateAudio={() => handleGenerateAudio(m)}
                  onPreviewAudio={() => setShowAudioModal(m)}
                  onAssign={() => setShowAssignModal(m)}
                  onViewContent={() => setShowContentModal(m)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'progress' && (
        <TrainingProgress overview={overview} />
      )}

      {showModal && (
        <TrainingModuleModal
          module={editingModule}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchAll(); }}
        />
      )}
      {showAssignModal && (
        <AssignTrainingModal
          module={showAssignModal}
          onClose={() => setShowAssignModal(null)}
          onSuccess={() => { setShowAssignModal(null); fetchAll(); }}
        />
      )}
      {showContentModal && (
        <TrainingContentModal
          module={showContentModal}
          onClose={() => setShowContentModal(null)}
        />
      )}
      {showAudioModal && (
        <AudioPreviewModal
          module={showAudioModal}
          onClose={() => setShowAudioModal(null)}
          onApprove={() => handleApproveAudio(showAudioModal)}
        />
      )}
    </div>
  );
};

const TrainingStat = ({ label, value, icon: Icon, color }) => {
  const colors = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-500/10',
    teal: 'text-teal-600 dark:text-teal-400 bg-teal-500/10',
    green: 'text-green-600 dark:text-green-400 bg-green-500/10',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
  };
  return (
    <div className="bg-white dark:bg-[#171C22] rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] p-4">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${colors[color]}`}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">{value}</p>
      <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-0.5">{label}</p>
    </div>
  );
};

const TrainingModuleCard = ({ module: m, generating, generatingAudio, onEdit, onDelete, onGenerate, onGenerateAudio, onPreviewAudio, onAssign, onViewContent }) => {
  const catColor = CATEGORY_COLORS[m.category] || 'bg-gray-100 text-gray-700';
  const hasAssets = m.has_study_guide || m.has_flashcards || m.has_quiz;
  const hasSource = m.content || m.has_study_guide;

  return (
    <div className="bg-white dark:bg-[#171C22] rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catColor}`}>
              {m.category}
            </span>
            {m.ai_generated && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                <Sparkles size={10} />
                AI-generated
              </span>
            )}
            {m.has_audio && (
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                m.audio_approved
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}>
                {m.audio_approved ? <Volume2 size={10} /> : <VolumeX size={10} />}
                {m.audio_approved ? 'Audio Live' : 'Audio Pending'}
              </span>
            )}
            {!m.is_active && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                Inactive
              </span>
            )}
          </div>
          <h3 className="font-semibold text-[#0E1116] dark:text-[#E6E8EB] truncate">{m.title}</h3>
          {m.description && (
            <p className="text-sm text-[#6B7280] dark:text-[#7D8590] mt-0.5 line-clamp-1">{m.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-[#6B7280] dark:text-[#7D8590]">
            <span className="flex items-center gap-1"><Clock size={12} />{m.duration_minutes} min</span>
            <span className="flex items-center gap-1"><Award size={12} />{m.completion_count} completed</span>
            {hasAssets && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 size={12} />
                {[m.has_study_guide && 'Guide', m.has_flashcards && 'Flashcards', m.has_quiz && 'Quiz'].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {m.content && (
            <button
              onClick={onGenerate}
              disabled={!!generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/40 transition-colors disabled:opacity-50"
            >
              <Sparkles size={12} className={generating ? 'animate-pulse' : ''} />
              {generating ? 'Generating…' : 'AI Generate'}
            </button>
          )}
          {hasSource && (
            <button
              onClick={generatingAudio ? undefined : (m.has_audio ? onPreviewAudio : onGenerateAudio)}
              disabled={!!generatingAudio}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                m.has_audio
                  ? 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/20 dark:text-sky-300 dark:hover:bg-sky-900/40'
                  : 'bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-900/20 dark:text-teal-300 dark:hover:bg-teal-900/40'
              }`}
              title={m.has_audio ? 'Preview & approve audio' : 'Generate audio dialogue'}
            >
              {generatingAudio
                ? <><Mic size={12} className="animate-pulse" /> Generating…</>
                : m.has_audio
                  ? <><Headphones size={12} /> Preview Audio</>
                  : <><Mic size={12} /> Gen Audio</>
              }
            </button>
          )}
          {hasAssets && (
            <button
              onClick={onViewContent}
              className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#5FA8D3] hover:bg-[#5FA8D3]/10 transition-colors"
              title="View learning assets"
            >
              <BookOpen size={15} />
            </button>
          )}
          <button
            onClick={onAssign}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-green-600 hover:bg-green-500/10 transition-colors"
            title="Assign to staff"
          >
            <UserCheck size={15} />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#5FA8D3] hover:bg-[#5FA8D3]/10 transition-colors"
          >
            <Edit2 size={15} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

const TrainingModuleModal = ({ module, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    title: module?.title || '',
    category: module?.category || 'Service',
    description: module?.description || '',
    duration_minutes: module?.duration_minutes || 15,
    content: module?.content || '',
    is_active: module?.is_active !== false,
  });
  const [saving, setSaving] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (module) {
        await api.updateTrainingModule(module.id, form);
      } else {
        await api.createTrainingModule(form);
      }
      onSuccess();
    } catch (e) {
      alert('Failed to save module.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#171C22] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <h2 className="text-lg font-semibold text-[#0E1116] dark:text-[#E6E8EB]">
            {module ? 'Edit Module' : 'New Training Module'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] transition-colors">
            <X size={18} className="text-[#6B7280]" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] dark:text-[#D1D5DB] mb-1">Title *</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Food Safety Fundamentals"
              className="w-full px-3 py-2 rounded-lg border border-[#D9DEE5] dark:border-[#1F2630] bg-white dark:bg-[#0E1116] text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] dark:text-[#D1D5DB] mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-[#D9DEE5] dark:border-[#1F2630] bg-white dark:bg-[#0E1116] text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]/50"
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] dark:text-[#D1D5DB] mb-1">Duration (min)</label>
              <input
                type="number"
                min={1}
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 15 }))}
                className="w-full px-3 py-2 rounded-lg border border-[#D9DEE5] dark:border-[#1F2630] bg-white dark:bg-[#0E1116] text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] dark:text-[#D1D5DB] mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Brief overview of what staff will learn"
              className="w-full px-3 py-2 rounded-lg border border-[#D9DEE5] dark:border-[#1F2630] bg-white dark:bg-[#0E1116] text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]/50 resize-none"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowContent(v => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#5FA8D3] hover:text-[#4a90bb] transition-colors mb-2"
            >
              <ChevronDown size={14} className={`transition-transform ${showContent ? 'rotate-180' : ''}`} />
              {form.content ? 'Source content (for AI generation)' : 'Add source content for AI generation'}
            </button>
            {showContent && (
              <div className="space-y-2">
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  rows={8}
                  placeholder="Paste the training material here. The AI will use this to generate a study guide, flashcards, and quiz automatically."
                  className="w-full px-3 py-2 rounded-lg border border-[#D9DEE5] dark:border-[#1F2630] bg-white dark:bg-[#0E1116] text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]/50 resize-y font-mono"
                />
                <p className="text-xs text-[#6B7280] dark:text-[#7D8590] flex items-center gap-1">
                  <Sparkles size={11} />
                  After saving, click "AI Generate" on the module card to create study guide, flashcards, and quiz.
                </p>
              </div>
            )}
          </div>

          {module && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 accent-[#5FA8D3]"
              />
              <span className="text-sm text-[#374151] dark:text-[#D1D5DB]">Active</span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-3 p-6 pt-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[#D9DEE5] dark:border-[#1F2630] text-sm text-[#6B7280] hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="px-4 py-2 rounded-lg bg-[#5FA8D3] text-white text-sm font-medium hover:bg-[#4a90bb] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : module ? 'Save Changes' : 'Create Module'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AssignTrainingModal = ({ module, onClose, onSuccess }) => {
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    api.getStaff().then(r => setStaff(r.data?.staff || r.data || [])).catch(() => {});
  }, []);

  const filtered = staff.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const handleAssign = async () => {
    if (!selected.length) return;
    setAssigning(true);
    try {
      const res = await api.assignTraining({ module_id: module.id, staff_ids: selected });
      const d = res.data;
      alert(`Assigned to ${d.assigned} staff member${d.assigned !== 1 ? 's' : ''}${d.already_assigned ? ` (${d.already_assigned} already assigned)` : ''}.`);
      onSuccess();
    } catch (e) {
      alert('Assignment failed.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#171C22] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <div>
            <h2 className="text-lg font-semibold text-[#0E1116] dark:text-[#E6E8EB]">Assign Training</h2>
            <p className="text-sm text-[#6B7280] dark:text-[#7D8590] mt-0.5">{module.title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] transition-colors">
            <X size={18} className="text-[#6B7280]" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search staff…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#D9DEE5] dark:border-[#1F2630] bg-white dark:bg-[#0E1116] text-[#0E1116] dark:text-[#E6E8EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]/50"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.length === 0 && (
              <p className="text-center py-6 text-sm text-[#6B7280]">No staff found</p>
            )}
            {filtered.map(s => (
              <label key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  onChange={() => toggle(s.id)}
                  className="w-4 h-4 accent-[#5FA8D3]"
                />
                <div className="w-7 h-7 rounded-full bg-[#5FA8D3]/20 flex items-center justify-center text-xs font-bold text-[#5FA8D3]">
                  {s.first_name?.[0]}{s.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB]">{s.first_name} {s.last_name}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#7D8590]">{s.department || s.designation || '—'}</p>
                </div>
              </label>
            ))}
          </div>

          <p className="text-xs text-[#6B7280] dark:text-[#7D8590]">
            {selected.length} staff member{selected.length !== 1 ? 's' : ''} selected
          </p>
        </div>

        <div className="flex justify-end gap-3 p-6 pt-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[#D9DEE5] dark:border-[#1F2630] text-sm text-[#6B7280] hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={assigning || !selected.length}
            className="px-4 py-2 rounded-lg bg-[#5FA8D3] text-white text-sm font-medium hover:bg-[#4a90bb] disabled:opacity-50 transition-colors"
          >
            {assigning ? 'Assigning…' : `Assign to ${selected.length || ''} Staff`}
          </button>
        </div>
      </div>
    </div>
  );
};

const TrainingContentModal = ({ module, onClose }) => {
  const [activeAsset, setActiveAsset] = useState(
    module.has_study_guide ? 'guide' : module.has_flashcards ? 'cards' : 'quiz'
  );
  const [cardIdx, setCardIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const assets = [
    module.has_study_guide && { id: 'guide', label: 'Study Guide' },
    module.has_flashcards && { id: 'cards', label: 'Flashcards' },
    module.has_quiz && { id: 'quiz', label: 'Quiz' },
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#171C22] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-[#D9DEE5] dark:border-[#1F2630] flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[#0E1116] dark:text-[#E6E8EB]">{module.title}</h2>
            <div className="flex gap-1 mt-2">
              {assets.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setActiveAsset(a.id); setCardIdx(0); setShowAnswer(false); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeAsset === a.id
                      ? 'bg-[#5FA8D3] text-white'
                      : 'bg-[#F6F7F9] dark:bg-[#1F2630] text-[#6B7280] dark:text-[#7D8590] hover:bg-[#E5E7EB] dark:hover:bg-[#2D3748]'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] transition-colors">
            <X size={18} className="text-[#6B7280]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeAsset === 'guide' && module.study_guide && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {module.study_guide.split('\n').map((line, i) => {
                if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-[#0E1116] dark:text-[#E6E8EB] mt-4 mb-1">{line.slice(3)}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-[#374151] dark:text-[#D1D5DB] mt-3 mb-1">{line.slice(4)}</h3>;
                if (line.startsWith('- ')) return <p key={i} className="text-sm text-[#374151] dark:text-[#D1D5DB] ml-3 before:content-['•'] before:mr-2 before:text-[#5FA8D3]">{line.slice(2)}</p>;
                if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-sm font-semibold text-[#374151] dark:text-[#D1D5DB]">{line.slice(2, -2)}</p>;
                if (line.trim()) return <p key={i} className="text-sm text-[#374151] dark:text-[#D1D5DB]">{line}</p>;
                return <div key={i} className="h-2" />;
              })}
            </div>
          )}

          {activeAsset === 'cards' && module.flashcards && (
            <div className="space-y-4">
              <p className="text-sm text-[#6B7280] dark:text-[#7D8590] text-center">
                Card {cardIdx + 1} of {module.flashcards.length}
              </p>
              <div
                onClick={() => setShowAnswer(v => !v)}
                className="min-h-36 rounded-xl border-2 border-[#5FA8D3]/30 bg-gradient-to-br from-[#5FA8D3]/5 to-[#5FA8D3]/10 dark:from-[#5FA8D3]/10 dark:to-[#5FA8D3]/5 flex flex-col items-center justify-center p-6 cursor-pointer hover:border-[#5FA8D3]/60 transition-colors"
              >
                <p className="text-xs font-medium text-[#5FA8D3] uppercase tracking-wide mb-3">
                  {showAnswer ? 'Answer' : 'Question — tap to reveal'}
                </p>
                <p className="text-base font-medium text-[#0E1116] dark:text-[#E6E8EB] text-center leading-relaxed">
                  {showAnswer ? module.flashcards[cardIdx].answer : module.flashcards[cardIdx].question}
                </p>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => { setCardIdx(i => Math.max(0, i - 1)); setShowAnswer(false); }}
                  disabled={cardIdx === 0}
                  className="px-4 py-2 rounded-lg border border-[#D9DEE5] dark:border-[#1F2630] text-sm text-[#6B7280] hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] disabled:opacity-40 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => { setCardIdx(i => Math.min(module.flashcards.length - 1, i + 1)); setShowAnswer(false); }}
                  disabled={cardIdx === module.flashcards.length - 1}
                  className="px-4 py-2 rounded-lg border border-[#D9DEE5] dark:border-[#1F2630] text-sm text-[#6B7280] hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] disabled:opacity-40 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {activeAsset === 'quiz' && module.quiz && (
            <div className="space-y-4">
              {module.quiz.map((q, qi) => (
                <div key={qi} className="p-4 rounded-xl border border-[#D9DEE5] dark:border-[#1F2630]">
                  <p className="text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB] mb-3">
                    <span className="text-[#5FA8D3] font-bold mr-1">Q{qi + 1}.</span>{q.question}
                  </p>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => (
                      <div
                        key={oi}
                        className={`px-3 py-2 rounded-lg text-sm border ${
                          oi === q.correct_index
                            ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300'
                            : 'border-[#D9DEE5] dark:border-[#1F2630] text-[#374151] dark:text-[#D1D5DB]'
                        }`}
                      >
                        {oi === q.correct_index && <Check size={12} className="inline mr-1.5" />}
                        {opt}
                      </div>
                    ))}
                  </div>
                  {q.explanation && (
                    <p className="text-xs text-[#6B7280] dark:text-[#7D8590] mt-2 italic">{q.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AudioPreviewModal = ({ module: m, onClose, onApprove }) => {
  const [approving, setApproving] = useState(false);
  const audioSrc = m.audio_url ? getImageUrl(m.audio_url) : null;
  const lines = (m.audio_script || '').split('\n').filter(l => l.trim());

  const handleApprove = async () => {
    setApproving(true);
    try { await onApprove(); } finally { setApproving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#171C22] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#D9DEE5] dark:border-[#1F2630]">
          <div>
            <h2 className="text-lg font-semibold text-[#0E1116] dark:text-[#E6E8EB]">Audio Dialogue Preview</h2>
            <p className="text-sm text-[#6B7280] dark:text-[#7D8590] mt-0.5">{m.title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] text-[#6B7280]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Audio Player */}
          {audioSrc && (
            <div className="bg-[#F6F7F9] dark:bg-[#0E1116] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB]">
                <Headphones size={16} className="text-[#5FA8D3]" />
                Audio Playback
              </div>
              <audio
                controls
                src={audioSrc}
                className="w-full"
                style={{ accentColor: '#5FA8D3' }}
              >
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {/* Approval status */}
          <div className={`flex items-center justify-between p-4 rounded-xl border ${
            m.audio_approved
              ? 'border-green-200 bg-green-50 dark:border-green-800/40 dark:bg-green-900/10'
              : 'border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/10'
          }`}>
            <div className="flex items-center gap-2">
              {m.audio_approved
                ? <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
                : <VolumeX size={16} className="text-amber-600 dark:text-amber-400" />
              }
              <span className={`text-sm font-medium ${m.audio_approved ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {m.audio_approved ? 'Approved — visible to staff' : 'Pending approval — not yet shared with team'}
              </span>
            </div>
            <button
              onClick={handleApprove}
              disabled={approving}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                m.audio_approved
                  ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/20 dark:text-rose-300'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {m.audio_approved
                ? <><XCircle size={14} /> Revoke</>
                : <><CheckCircle size={14} /> Approve for Team</>
              }
            </button>
          </div>

          {/* Dialogue script */}
          {lines.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] dark:text-[#7D8590] mb-3">Dialogue Script</p>
              <div className="space-y-2">
                {lines.map((line, i) => {
                  const isTrainer = line.startsWith('TRAINER:');
                  const isStaff = line.startsWith('STAFF:');
                  const speaker = isTrainer ? 'TRAINER' : isStaff ? 'STAFF' : null;
                  const text = speaker ? line.slice(speaker.length + 1).trim() : line;
                  return (
                    <div key={i} className={`flex gap-3 ${isTrainer ? '' : 'flex-row-reverse'}`}>
                      {speaker && (
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          isTrainer
                            ? 'bg-[#5FA8D3]/15 text-[#5FA8D3]'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                        }`}>
                          {isTrainer ? 'T' : 'S'}
                        </div>
                      )}
                      <div className={`flex-1 rounded-xl px-3 py-2 text-sm ${
                        isTrainer
                          ? 'bg-[#F6F7F9] dark:bg-[#0E1116] text-[#0E1116] dark:text-[#E6E8EB] rounded-tl-none'
                          : 'bg-purple-50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-100 rounded-tr-none'
                      }`}>
                        {speaker && <span className="text-xs font-semibold opacity-60 block mb-0.5">{speaker}</span>}
                        {text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TrainingProgress = ({ overview }) => {
  const [completions, setCompletions] = useState({});
  const [loadingModule, setLoadingModule] = useState(null);

  const loadCompletions = async (moduleId) => {
    if (completions[moduleId]) return;
    setLoadingModule(moduleId);
    try {
      const res = await api.getModuleCompletions(moduleId);
      setCompletions(prev => ({ ...prev, [moduleId]: res.data }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingModule(null);
    }
  };

  if (!overview || !overview.modules.length) {
    return (
      <div className="text-center py-16 text-[#6B7280] dark:text-[#7D8590]">
        <BarChart3 size={40} className="mx-auto mb-3 opacity-30" />
        <p className="font-medium">No data yet</p>
        <p className="text-sm mt-1">Create modules and assign them to staff to track progress.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {overview.modules.map(m => {
        const mc = completions[m.module_id];
        return (
          <div key={m.module_id} className="bg-white dark:bg-[#171C22] rounded-xl border border-[#D9DEE5] dark:border-[#1F2630] overflow-hidden">
            <button
              onClick={() => loadCompletions(m.module_id)}
              className="w-full flex items-center justify-between p-4 hover:bg-[#F6F7F9] dark:hover:bg-[#1F2630] transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[m.category] || 'bg-gray-100 text-gray-600'}`}>
                    {m.category}
                  </span>
                  <span className="text-sm font-medium text-[#0E1116] dark:text-[#E6E8EB] truncate">{m.title}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-[#F6F7F9] dark:bg-[#1F2630] rounded-full h-1.5">
                    <div
                      className="bg-[#5FA8D3] rounded-full h-1.5 transition-all"
                      style={{ width: `${m.completion_rate}%` }}
                    />
                  </div>
                  <span className="text-xs text-[#6B7280] dark:text-[#7D8590] whitespace-nowrap">
                    {m.completion_count} completed · {m.completion_rate}%
                    {m.avg_score !== null && ` · avg ${m.avg_score}%`}
                  </span>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`ml-3 text-[#6B7280] flex-shrink-0 transition-transform ${mc ? 'rotate-180' : ''}`}
              />
            </button>

            {mc && (
              <div className="border-t border-[#D9DEE5] dark:border-[#1F2630] divide-y divide-[#D9DEE5] dark:divide-[#1F2630]">
                {mc.length === 0 && (
                  <p className="px-4 py-3 text-sm text-[#6B7280] dark:text-[#7D8590]">No completions yet.</p>
                )}
                {mc.map(c => (
                  <div key={c.completion_id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#5FA8D3]/20 flex items-center justify-center text-xs font-bold text-[#5FA8D3]">
                        {c.staff_name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-sm text-[#374151] dark:text-[#D1D5DB]">{c.staff_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#6B7280] dark:text-[#7D8590]">
                      {c.score !== null && (
                        <span className={`font-medium ${c.score >= 70 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {c.score}%
                        </span>
                      )}
                      <span>{new Date(c.completed_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {loadingModule === m.module_id && (
              <div className="px-4 py-3 text-sm text-[#6B7280] dark:text-[#7D8590] border-t border-[#D9DEE5] dark:border-[#1F2630]">
                Loading…
              </div>
            )}
          </div>
        );
      })}
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
const StaffTrainingPage = () => (
  <div className="space-y-6">
    <PageHeader icon={BookOpen} title="Training" description="Create and manage staff training modules" />
    <TrainingModules />
  </div>
);

export default StaffTrainingPage;
