import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, X, Play, BarChart2, Clock } from 'lucide-react';
import * as api from '../../services/marketingApi';
import { getSegments, getTemplates } from '../../services/marketingApi';
import { getInboxes } from '../../services/conversationsApi';

const STATUS_STYLES = {
  draft:     'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  scheduled: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  running:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  completed: 'bg-green-500/20 text-green-400 border border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

function CampaignDrawer({ open, onClose, onSaved, segments, inboxes, templates }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const [inboxId, setInboxId] = useState('');
  const [contentType, setContentType] = useState('freeform');
  const [textContent, setTextContent] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState('en');
  const [sendNow, setSendNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setName('');
      setSegmentId('');
      setInboxId('');
      setTextContent('');
      setTemplateName('');
      setSendNow(true);
      setScheduledAt('');
    }
  }, [open]);

  const handleSave = async (andLaunch = false) => {
    setSaving(true);
    try {
      const content = contentType === 'template'
        ? { template_name: templateName, template_language: templateLanguage }
        : { text: textContent };
      const data = {
        name,
        segment_id: segmentId || null,
        inbox_id: inboxId || null,
        content_type: contentType,
        content,
        scheduled_at: sendNow ? null : scheduledAt || null,
      };
      const campaign = await api.createCampaign(data);
      if (andLaunch) {
        await api.launchCampaign(campaign.id);
        campaign.status = 'running';
      }
      onSaved(campaign);
      onClose();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  if (!open) return null;

  const stepTitles = ['Details', 'Content', 'Schedule'];
  const canNext = step === 1
    ? name.trim()
    : step === 2
      ? (contentType === 'freeform' ? textContent.trim() : templateName.trim())
      : true;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[520px] bg-[#111318] border-l border-[#1F2630] z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1F2630]">
          <div>
            <h2 className="text-[#E6E8EB] font-semibold text-base">New Campaign</h2>
            <div className="flex items-center gap-2 mt-1">
              {stepTitles.map((t, i) => (
                <React.Fragment key={i}>
                  <span className={`text-xs ${i + 1 === step ? 'text-[var(--accent)] font-medium' : i + 1 < step ? 'text-green-400' : 'text-[#6B7280]'}`}>
                    {t}
                  </span>
                  {i < stepTitles.length - 1 && <span className="text-[#1F2630]">›</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Campaign Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Ramadan Promo 2026"
                  className="w-full bg-[#0B0D10] border border-[#1F2630] rounded-xl px-4 py-2.5 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-1.5">
                  Segment <span className="text-gray-600">(optional — send to all if empty)</span>
                </label>
                <select
                  value={segmentId}
                  onChange={e => setSegmentId(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-[#1F2630] rounded-xl px-4 py-2.5 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="">All customers</option>
                  {segments.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (~{s.estimated_count})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Inbox (Channel)</label>
                <select
                  value={inboxId}
                  onChange={e => setInboxId(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-[#1F2630] rounded-xl px-4 py-2.5 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="">Select inbox</option>
                  {inboxes.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.channel})</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex gap-2">
                {['freeform', 'template'].map(t => (
                  <button
                    key={t}
                    onClick={() => setContentType(t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      contentType === t
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'border-[#1F2630] bg-white/5 text-[#6B7280] hover:text-[#E6E8EB]'
                    }`}
                  >
                    {t === 'freeform' ? 'Free Text' : 'Template'}
                  </button>
                ))}
              </div>
              {contentType === 'freeform' ? (
                <div>
                  <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Message Text</label>
                  <textarea
                    value={textContent}
                    onChange={e => setTextContent(e.target.value)}
                    rows={6}
                    placeholder="Type your message…"
                    className="w-full bg-[#0B0D10] border border-[#1F2630] rounded-xl px-4 py-2.5 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Template</label>
                    <select
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      className="w-full bg-[#0B0D10] border border-[#1F2630] rounded-xl px-4 py-2.5 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)]"
                    >
                      <option value="">Select template</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Language</label>
                    <input
                      value={templateLanguage}
                      onChange={e => setTemplateLanguage(e.target.value)}
                      placeholder="en"
                      className="w-full bg-[#0B0D10] border border-[#1F2630] rounded-xl px-4 py-2.5 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <button
                onClick={() => setSendNow(true)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                  sendNow
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[#1F2630] bg-white/5 hover:border-[#2F3640]'
                }`}
              >
                <Play size={16} className={sendNow ? 'text-[var(--accent)]' : 'text-[#6B7280]'} />
                <div className="text-left">
                  <div className={`text-sm font-medium ${sendNow ? 'text-[var(--accent)]' : 'text-[#E6E8EB]'}`}>
                    Send Now
                  </div>
                  <div className="text-xs text-[#6B7280]">Launch immediately after saving</div>
                </div>
              </button>
              <button
                onClick={() => setSendNow(false)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                  !sendNow
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                    : 'border-[#1F2630] bg-white/5 hover:border-[#2F3640]'
                }`}
              >
                <Clock size={16} className={!sendNow ? 'text-[var(--accent)]' : 'text-[#6B7280]'} />
                <div className="text-left">
                  <div className={`text-sm font-medium ${!sendNow ? 'text-[var(--accent)]' : 'text-[#E6E8EB]'}`}>
                    Schedule
                  </div>
                  <div className="text-xs text-[#6B7280]">Save as draft for later</div>
                </div>
              </button>
              {!sendNow && (
                <div>
                  <label className="block text-xs font-medium text-[#6B7280] mb-1.5">
                    Scheduled Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                    className="w-full bg-[#0B0D10] border border-[#1F2630] rounded-xl px-4 py-2.5 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-[#1F2630]">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="text-sm text-[#6B7280] hover:text-[#E6E8EB] transition-colors"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={saving || !name.trim()}
              className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#E6E8EB] disabled:opacity-50 transition-colors"
            >
              Save Draft
            </button>
            {step < 3 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext}
                className="px-5 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                Next
              </button>
            ) : (
              <button
                onClick={() => handleSave(sendNow)}
                disabled={saving || !name.trim()}
                className="px-5 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {saving ? 'Saving…' : sendNow ? 'Launch' : 'Save Draft'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [segments, setSegments] = useState([]);
  const [inboxes, setInboxes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getCampaigns(),
      api.getSegments(),
      getInboxes().catch(() => []),
    ]).then(([c, s, i]) => {
      setCampaigns(c);
      setSegments(s);
      setInboxes(i);
    }).catch(console.error).finally(() => setLoading(false));

    // Load templates separately (may fail if no inboxes)
    import('../../services/conversationsApi')
      .then(m => m.getTemplates())
      .then(setTemplates)
      .catch(() => {});
  }, []);

  const handleSaved = (campaign) => {
    setCampaigns(prev => {
      const idx = prev.findIndex(c => c.id === campaign.id);
      return idx >= 0
        ? prev.map(c => c.id === campaign.id ? campaign : c)
        : [campaign, ...prev];
    });
  };

  const handleLaunch = async (id) => {
    const campaign = campaigns.find(c => c.id === id);
    const seg = segments.find(s => s.id === campaign?.segment_id);
    const count = seg?.estimated_count ?? '?';
    if (!window.confirm(`Launch this campaign to ~${count} customers?`)) return;
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'running' } : c));
    try {
      await api.launchCampaign(id);
      setTimeout(async () => {
        const updated = await api.getCampaigns();
        setCampaigns(updated);
      }, 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign?')) return;
    await api.deleteCampaign(id);
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  const filtered = statusFilter === 'all'
    ? campaigns
    : campaigns.filter(c => c.status === statusFilter);

  const formatDate = (iso) => iso
    ? new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#E6E8EB]">Campaigns</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Broadcast messages to customer segments</p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> New Campaign
        </button>
      </div>

      <div className="flex gap-1 flex-wrap">
        {['all', 'draft', 'scheduled', 'running', 'completed'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
              statusFilter === s
                ? 'bg-[var(--accent)] text-white'
                : 'bg-white/5 text-[#6B7280] hover:bg-white/10 hover:text-[#E6E8EB]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#6B7280]">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <Megaphone size={22} className="text-[#6B7280]" />
          </div>
          <p className="text-[#E6E8EB] font-medium">
            No campaigns{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ' yet'}
          </p>
          <p className="text-sm text-[#6B7280] mt-1">Create your first broadcast campaign to reach customers</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const seg = segments.find(s => s.id === c.segment_id);
            const stats = c.stats || {};
            return (
              <div
                key={c.id}
                className="bg-[#111318] border border-[#1F2630] rounded-2xl p-5 hover:border-[var(--accent)]/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="text-[#E6E8EB] font-medium text-sm">{c.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[c.status] || STATUS_STYLES.draft}`}>
                        {c.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#6B7280] flex-wrap">
                      {seg && <span>Segment: {seg.name}</span>}
                      {c.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} />{formatDate(c.scheduled_at)}
                        </span>
                      )}
                      {(stats.sent || stats.failed) ? (
                        <span className="flex items-center gap-1">
                          <BarChart2 size={11} />
                          {stats.sent ?? 0} sent · {stats.failed ?? 0} failed · {stats.suppressed ?? 0} suppressed
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {c.status === 'draft' && (
                      <>
                        <button
                          onClick={() => handleLaunch(c.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 text-xs font-medium transition-colors"
                        >
                          <Play size={12} /> Launch
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CampaignDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
        segments={segments}
        inboxes={inboxes}
        templates={templates}
      />
    </div>
  );
}
