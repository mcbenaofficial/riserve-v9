import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, CheckCircle, ChevronDown, ExternalLink, Link,
  MessageCircle, Pencil, Plus, RefreshCw, Send, Tag, Trash2,
  Upload, Users, X, Zap, BarChart2, Clock, TrendingUp, FlaskConical,
} from 'lucide-react';
import {
  addSubscriber, bulkImportSubscribers, checkConfig, createCampaign,
  deleteCampaign, getAcquisitionStats, getCampaignStats, getCampaigns,
  getSubscribers, optOutSubscriber, previewSegment, retagSubscriber,
  sendCampaign, testSendCampaign, updateCampaign,
} from '../../services/whatsappAcquisitionApi';

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------
const SOURCE_META = {
  organic:    { label: 'Organic',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  import:     { label: 'Imported',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  aggregator: { label: 'Aggregator', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  referral:   { label: 'Referral',   color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  widget:     { label: 'Widget',     color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' },
};

const STATUS_META = {
  draft:     { label: 'Draft',     color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  sending:   { label: 'Sending…',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  sent:      { label: 'Sent',      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  failed:    { label: 'Failed',    color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
};

// ---------------------------------------------------------------------------
// Shared UI atoms
// ---------------------------------------------------------------------------
const PageHeader = () => (
  <div className="flex items-center gap-3 mb-6">
    <div className="accent-gradient-bg p-2.5 rounded-xl">
      <MessageCircle className="w-5 h-5 text-white" />
    </div>
    <div>
      <h1 className="text-xl font-semibold text-foreground">WhatsApp Acquisition</h1>
      <p className="text-sm text-muted-foreground">Grow and broadcast to your opted-in WhatsApp subscriber list</p>
    </div>
  </div>
);

const Badge = ({ meta, text }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta?.color || 'bg-zinc-100 text-zinc-600'}`}>
    {meta?.label || text}
  </span>
);

const StatCard = ({ icon: Icon, label, value, sub }) => (
  <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
    <div className="accent-gradient-bg p-2 rounded-xl shrink-0">
      <Icon className="w-4 h-4 text-white" />
    </div>
    <div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs font-medium text-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  </div>
);

const ErrBox = ({ msg }) => msg ? (
  <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-2">
    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {msg}
  </div>
) : null;

// ---------------------------------------------------------------------------
// Config warning banner
// ---------------------------------------------------------------------------
function ConfigBanner({ status }) {
  if (!status || status.ok) return null;
  return (
    <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 mb-4">
      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">WhatsApp not configured</p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{status.reason}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Subscriber Modal
// ---------------------------------------------------------------------------
function AddSubscriberModal({ onClose, onSaved }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [source, setSource] = useState('organic');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setSaving(true); setErr('');
    try {
      await addSubscriber({
        phone: phone.trim(),
        name: name.trim() || undefined,
        source,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      });
      onSaved();
    } catch (ex) { setErr(ex.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[59] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl w-full max-w-md p-6 z-[60]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">Add Subscriber</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Phone *</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" required
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Customer name"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Source</label>
            <select value={source} onChange={e => setSource(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none">
              {Object.entries(SOURCE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Tags <span className="text-muted-foreground">(comma-separated)</span></label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="vip, salon, new"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border" />
          </div>
          <ErrBox msg={err} />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl text-sm border border-border text-foreground hover:bg-background transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 accent-gradient-bg px-4 py-2 rounded-xl text-sm text-white font-medium disabled:opacity-50">
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bulk Import Modal
// ---------------------------------------------------------------------------
function BulkImportModal({ onClose, onSaved }) {
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const EXAMPLE = JSON.stringify([
    { phone: '+919876543210', name: 'Priya S', source: 'import', tags: ['vip'] },
    { phone: '+918765432109', name: 'Rahul K', source: 'import', tags: [] },
  ], null, 2);

  const handleImport = async () => {
    let items;
    try { items = JSON.parse(raw); } catch { setErr('Invalid JSON. Check the format.'); return; }
    if (!Array.isArray(items)) { setErr('Must be a JSON array.'); return; }
    setSaving(true); setErr('');
    try { const res = await bulkImportSubscribers(items); setResult(res); onSaved(); }
    catch (ex) { setErr(ex.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[59] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl w-full max-w-lg p-6 z-[60]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">Bulk Import</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        {result ? (
          <div className="text-center py-6">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-foreground font-medium">{result.imported} imported, {result.skipped} skipped</p>
            <button onClick={onClose} className="mt-4 accent-gradient-bg px-5 py-2 rounded-xl text-sm text-white font-medium">Done</button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2">Paste a JSON array of subscribers:</p>
            <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={10} placeholder={EXAMPLE}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border resize-none" />
            <ErrBox msg={err} />
            <div className="flex gap-2 mt-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2 rounded-xl text-sm border border-border text-foreground hover:bg-background transition-colors">Cancel</button>
              <button onClick={handleImport} disabled={saving || !raw.trim()}
                className="flex-1 accent-gradient-bg px-4 py-2 rounded-xl text-sm text-white font-medium disabled:opacity-50">
                {saving ? 'Importing…' : 'Import'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Retag Modal
// ---------------------------------------------------------------------------
function RetagModal({ subscriber, onClose, onSaved }) {
  const [tags, setTags] = useState((subscriber.tags || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    setSaving(true); setErr('');
    try {
      await retagSubscriber(subscriber.id, tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);
      onSaved();
    } catch (ex) { setErr(ex.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[59] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl w-full max-w-sm p-6 z-[60]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Edit Tags</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{subscriber.name || subscriber.phone}</p>
        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="vip, salon, new"
          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border mb-3" />
        <ErrBox msg={err} />
        <div className="flex gap-2 mt-3">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl text-sm border border-border text-foreground hover:bg-background transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 accent-gradient-bg px-4 py-2 rounded-xl text-sm text-white font-medium disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign Modal (create / edit) — with segment preview, scheduler, CTA
// ---------------------------------------------------------------------------
function CampaignModal({ campaign, onClose, onSaved }) {
  const [name, setName] = useState(campaign?.name || '');
  const [templateName, setTemplateName] = useState(campaign?.template_name || '');
  const [templateParams, setTemplateParams] = useState((campaign?.template_params || []).join(', '));
  const [segmentTags, setSegmentTags] = useState((campaign?.segment_tags || []).join(', '));
  const [scheduledAt, setScheduledAt] = useState(
    campaign?.scheduled_at ? campaign.scheduled_at.slice(0, 16) : ''
  );
  const [ctaText, setCtaText] = useState(campaign?.cta_button_text || '');
  const [ctaUrl, setCtaUrl] = useState(campaign?.cta_button_url || '');
  const [previewCount, setPreviewCount] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const previewTimer = useRef(null);

  // Debounced segment preview
  useEffect(() => {
    clearTimeout(previewTimer.current);
    const tags = segmentTags ? segmentTags.split(',').map(t => t.trim()).filter(Boolean) : [];
    previewTimer.current = setTimeout(async () => {
      try {
        const res = await previewSegment(tags);
        setPreviewCount(res.count);
      } catch { setPreviewCount(null); }
    }, 400);
    return () => clearTimeout(previewTimer.current);
  }, [segmentTags]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    const payload = {
      name: name.trim(),
      template_name: templateName.trim(),
      template_params: templateParams ? templateParams.split(',').map(t => t.trim()).filter(Boolean) : [],
      segment_tags: segmentTags ? segmentTags.split(',').map(t => t.trim()).filter(Boolean) : [],
      scheduled_at: scheduledAt || undefined,
      cta_button_text: ctaText.trim() || undefined,
      cta_button_url: ctaUrl.trim() || undefined,
    };
    try {
      if (campaign) await updateCampaign(campaign.id, payload);
      else await createCampaign(payload);
      onSaved();
    } catch (ex) { setErr(ex.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[59] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl w-full max-w-md p-6 z-[60] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">{campaign ? 'Edit Campaign' : 'New Campaign'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Campaign name *</label>
            <input value={name} onChange={e => setName(e.target.value)} required placeholder="May Promo — VIP Customers"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Template name *</label>
            <input value={templateName} onChange={e => setTemplateName(e.target.value)} required placeholder="promo_offer_v1"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border" />
            <p className="text-xs text-muted-foreground mt-1">Must match an approved template in your WhatsApp Business account.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Template variables <span className="text-muted-foreground">(comma-separated, in order)</span></label>
            <input value={templateParams} onChange={e => setTemplateParams(e.target.value)} placeholder="Customer Name, Offer Name, Expiry Date"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border" />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Segment tags <span className="text-muted-foreground">(send to all if empty)</span></label>
            <input value={segmentTags} onChange={e => setSegmentTags(e.target.value)} placeholder="vip, salon"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border" />
            {previewCount !== null && (
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-medium text-foreground">{previewCount}</span> active subscriber{previewCount !== 1 ? 's' : ''} will receive this
              </p>
            )}
          </div>

          {/* CTA button */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5" /> CTA Button <span className="text-muted-foreground font-normal">(optional)</span>
            </p>
            <div className="space-y-2">
              <input value={ctaText} onChange={e => setCtaText(e.target.value)} placeholder="Book Now"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border" />
              <input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="https://riserve.app/book/..."
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border" />
              <p className="text-xs text-muted-foreground">Template must have a URL button at index 0 for this to work.</p>
            </div>
          </div>

          {/* Scheduler */}
          <div className="border-t border-border pt-3">
            <label className="text-xs font-medium text-foreground mb-1 flex items-center gap-1.5 block">
              <Clock className="w-3.5 h-3.5" /> Schedule for later <span className="text-muted-foreground font-normal">(leave blank to send manually)</span>
            </label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-border" />
          </div>

          <ErrBox msg={err} />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl text-sm border border-border text-foreground hover:bg-background transition-colors">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 accent-gradient-bg px-4 py-2 rounded-xl text-sm text-white font-medium disabled:opacity-50">
              {saving ? 'Saving…' : campaign ? 'Save' : scheduledAt ? 'Schedule' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test Send Modal
// ---------------------------------------------------------------------------
function TestSendModal({ campaign, onClose }) {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const handleSend = async () => {
    if (!phone.trim()) return;
    setSending(true); setErr(''); setResult(null);
    try {
      const res = await testSendCampaign(campaign.id, phone.trim());
      setResult(res);
    } catch (ex) { setErr(ex.message); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-[59] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl w-full max-w-sm p-6 z-[60]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FlaskConical className="w-4 h-4" /> Test Send
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Send a single test message for <span className="font-medium text-foreground">{campaign.name}</span> to a phone number of your choice.</p>
        {result ? (
          <div className="text-center py-4">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">Message sent!</p>
            <p className="text-xs text-muted-foreground mt-1">Check your WhatsApp</p>
            <button onClick={onClose} className="mt-4 accent-gradient-bg px-5 py-2 rounded-xl text-sm text-white font-medium">Done</button>
          </div>
        ) : (
          <>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border mb-3" />
            <ErrBox msg={err} />
            <div className="flex gap-2 mt-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2 rounded-xl text-sm border border-border text-foreground hover:bg-background transition-colors">Cancel</button>
              <button onClick={handleSend} disabled={sending || !phone.trim()}
                className="flex-1 accent-gradient-bg px-4 py-2 rounded-xl text-sm text-white font-medium disabled:opacity-50">
                {sending ? 'Sending…' : 'Send test'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign Stats Drawer
// ---------------------------------------------------------------------------
function CampaignStatsDrawer({ campaign, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCampaignStats(campaign.id).then(setData).finally(() => setLoading(false));
  }, [campaign.id]);

  const c = data?.campaign || campaign;
  const delivery = c.sent_count > 0 ? Math.round((c.delivered_count || 0) / c.sent_count * 100) : 0;
  const read = c.sent_count > 0 ? Math.round((c.read_count || 0) / c.sent_count * 100) : 0;

  return (
    <div className="fixed inset-0 z-[59] bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl w-full max-w-lg p-6 z-[60] max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground truncate pr-4">{campaign.name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0"><X className="w-4 h-4" /></button>
        </div>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Sent',      value: c.sent_count },
                { label: 'Delivered', value: `${c.delivered_count || 0} (${delivery}%)` },
                { label: 'Read',      value: `${c.read_count || 0} (${read}%)` },
                { label: 'Failed',    value: c.failed_count },
              ].map(s => (
                <div key={s.label} className="bg-background border border-border rounded-2xl p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            {data?.messages?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground mb-2">Recipients (first 200)</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {data.messages.map(m => (
                    <div key={m.id} className="flex items-center justify-between text-xs px-3 py-1.5 bg-background border border-border rounded-xl">
                      <span className="text-muted-foreground">{m.phone}</span>
                      <Badge meta={STATUS_META[m.status]} text={m.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subscribers Tab
// ---------------------------------------------------------------------------
function SubscribersTab({ reload }) {
  const [data, setData] = useState({ total: 0, has_more: false, subscribers: [] });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [sourceFilter, setSourceFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [retagTarget, setRetagTarget] = useState(null);
  const LIMIT = 50;

  const load = useCallback(async (newOffset = 0) => {
    if (newOffset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await getSubscribers({ source: sourceFilter || undefined, limit: LIMIT, offset: newOffset });
      if (newOffset === 0) {
        setData(res);
      } else {
        setData(prev => ({ ...res, subscribers: [...prev.subscribers, ...res.subscribers] }));
      }
      setOffset(newOffset);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sourceFilter]);

  useEffect(() => { load(0); }, [load, reload]);

  const handleOptOut = async (id) => {
    if (!window.confirm('Opt this subscriber out?')) return;
    await optOutSubscriber(id);
    load(0);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
            className="bg-background border border-border rounded-xl px-3 py-1.5 text-sm text-foreground focus:outline-none">
            <option value="">All sources</option>
            {Object.entries(SOURCE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <span className="text-sm text-muted-foreground">{data.total} active</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowBulk(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-sm text-foreground hover:bg-background transition-colors">
            <Upload className="w-3.5 h-3.5" /> Bulk Import
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 accent-gradient-bg px-3 py-1.5 rounded-xl text-sm text-white font-medium">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading subscribers…</div>
      ) : data.subscribers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No subscribers yet. Add your first opt-in above.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {data.subscribers.map(sub => (
              <div key={sub.id} className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{sub.name || sub.phone}</span>
                    {sub.name && <span className="text-xs text-muted-foreground">{sub.phone}</span>}
                    <Badge meta={SOURCE_META[sub.source]} text={sub.source} />
                    {(sub.tags || []).map(t => (
                      <span key={t} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        <Tag className="w-2.5 h-2.5" />{t}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Opted in {sub.opted_in_at ? new Date(sub.opted_in_at).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setRetagTarget(sub)}
                    className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleOptOut(sub.id)}
                    className="p-1.5 rounded-xl text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {data.has_more && (
            <button onClick={() => load(offset + LIMIT)} disabled={loadingMore}
              className="mt-4 w-full py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-background transition-colors disabled:opacity-50">
              {loadingMore ? 'Loading…' : `Load more (${data.total - data.subscribers.length} remaining)`}
            </button>
          )}
        </>
      )}

      {showAdd && <AddSubscriberModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(0); }} />}
      {showBulk && <BulkImportModal onClose={() => setShowBulk(false)} onSaved={() => { setShowBulk(false); load(0); }} />}
      {retagTarget && <RetagModal subscriber={retagTarget} onClose={() => setRetagTarget(null)} onSaved={() => { setRetagTarget(null); load(0); }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaigns Tab
// ---------------------------------------------------------------------------
function CampaignsTab({ reload, configStatus }) {
  const [data, setData] = useState({ total: 0, has_more: false, campaigns: [] });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [statsTarget, setStatsTarget] = useState(null);
  const [testTarget, setTestTarget] = useState(null);
  const [sending, setSending] = useState(null);
  const [err, setErr] = useState('');
  const LIMIT = 50;

  const load = useCallback(async (newOffset = 0) => {
    if (newOffset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await getCampaigns({ limit: LIMIT, offset: newOffset });
      if (newOffset === 0) setData(res);
      else setData(prev => ({ ...res, campaigns: [...prev.campaigns, ...res.campaigns] }));
      setOffset(newOffset);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(0); }, [load, reload]);

  const handleSend = async (c) => {
    if (!window.confirm(`Queue "${c.name}" for broadcast? Messages will be sent in the background.`)) return;
    setSending(c.id); setErr('');
    try { await sendCampaign(c.id); load(0); }
    catch (ex) { setErr(ex.message); }
    finally { setSending(null); }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try { await deleteCampaign(c.id); load(0); } catch (ex) { setErr(ex.message); }
  };

  const campaigns = data.campaigns || [];

  return (
    <div>
      <ConfigBanner status={configStatus} />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-foreground">{data.total} campaign{data.total !== 1 ? 's' : ''}</h2>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 accent-gradient-bg px-3 py-1.5 rounded-xl text-sm text-white font-medium">
          <Plus className="w-3.5 h-3.5" /> New Campaign
        </button>
      </div>

      {err && <ErrBox msg={err} />}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12">
          <Send className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No campaigns yet. Create your first broadcast above.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {campaigns.map(c => {
              const delivery = c.sent_count > 0 ? Math.round((c.delivered_count || 0) / c.sent_count * 100) : null;
              return (
                <div key={c.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-foreground">{c.name}</span>
                        <Badge meta={STATUS_META[c.status]} text={c.status} />
                        {c.scheduled_at && c.status === 'scheduled' && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(c.scheduled_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">{c.template_name}</p>
                      {c.segment_tags?.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <Tag className="w-3 h-3 text-muted-foreground" />
                          {c.segment_tags.map(t => (
                            <span key={t} className="text-xs px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">{t}</span>
                          ))}
                        </div>
                      )}
                      {(c.cta_button_text || c.cta_button_url) && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Link className="w-3 h-3" />
                          <span>{c.cta_button_text || c.cta_button_url}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.status === 'sent' && (
                        <button onClick={() => setStatsTarget(c)}
                          className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background transition-colors">
                          <BarChart2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {['draft', 'scheduled'].includes(c.status) && (
                        <>
                          <button onClick={() => setTestTarget(c)}
                            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background transition-colors" title="Test send">
                            <FlaskConical className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditTarget(c)}
                            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-background transition-colors text-xs font-medium px-2">
                            Edit
                          </button>
                          <button onClick={() => handleSend(c)} disabled={sending === c.id}
                            className="flex items-center gap-1 accent-gradient-bg px-2.5 py-1.5 rounded-xl text-xs text-white font-medium disabled:opacity-50">
                            <Send className="w-3 h-3" />
                            {sending === c.id ? 'Sending…' : 'Send now'}
                          </button>
                          <button onClick={() => handleDelete(c)}
                            className="p-1.5 rounded-xl text-muted-foreground hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {c.status === 'sent' && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {[
                        { label: 'Sent',      value: c.sent_count },
                        { label: 'Delivered', value: delivery !== null ? `${delivery}%` : '—' },
                        { label: 'Failed',    value: c.failed_count },
                      ].map(s => (
                        <div key={s.label} className="text-center bg-background border border-border rounded-xl py-1.5">
                          <p className="text-sm font-bold text-foreground">{s.value}</p>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {data.has_more && (
            <button onClick={() => load(offset + LIMIT)} disabled={loadingMore}
              className="mt-4 w-full py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-background transition-colors disabled:opacity-50">
              {loadingMore ? 'Loading…' : `Load more (${data.total - campaigns.length} remaining)`}
            </button>
          )}
        </>
      )}

      {showCreate && <CampaignModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(0); }} />}
      {editTarget && <CampaignModal campaign={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load(0); }} />}
      {statsTarget && <CampaignStatsDrawer campaign={statsTarget} onClose={() => setStatsTarget(null)} />}
      {testTarget && <TestSendModal campaign={testTarget} onClose={() => setTestTarget(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analytics Tab
// ---------------------------------------------------------------------------
function AnalyticsTab({ reload }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setStats(await getAcquisitionStats()); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, reload]);

  if (loading) return <div className="text-center py-12 text-muted-foreground text-sm">Loading analytics…</div>;
  if (!stats) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Active Subscribers" value={stats.total_subscribers} sub={`${stats.total_opted_out} opted out`} />
        <StatCard icon={Send} label="Total Campaigns" value={stats.total_campaigns} />
        <StatCard icon={TrendingUp} label="Delivery Rate" value={`${stats.delivery_rate}%`} sub={`${stats.total_delivered} of ${stats.total_sent}`} />
        <StatCard icon={Zap} label="Read Rate" value={`${stats.read_rate}%`} sub={`${stats.total_read} reads`} />
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Subscribers by Source</h3>
        {stats.source_breakdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="space-y-3">
            {stats.source_breakdown.map(row => {
              const pct = stats.total_subscribers > 0
                ? Math.round(row.count / stats.total_subscribers * 100)
                : 0;
              const meta = SOURCE_META[row.source] || { label: row.source, color: 'bg-zinc-100 text-zinc-600' };
              return (
                <div key={row.source}>
                  <div className="flex items-center justify-between mb-1">
                    <Badge meta={meta} text={row.source} />
                    <span className="text-xs text-muted-foreground">{row.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-background border border-border rounded-full h-1.5 overflow-hidden">
                    <div className="accent-gradient-bg h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">How to grow your subscriber list</h3>
        <div className="space-y-2">
          {[
            { icon: Upload,         text: 'Import existing customer contacts who have opted in.' },
            { icon: MessageCircle,  text: 'Embed a WhatsApp opt-in widget on your booking portal.' },
            { icon: Tag,            text: 'Tag subscribers at import time to enable precise segmentation.' },
            { icon: Clock,          text: 'Use aggregator-resolved customers as a warm acquisition segment.' },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground/60" />
              {text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root page
// ---------------------------------------------------------------------------
const TABS = [
  { id: 'subscribers', label: 'Subscribers', icon: Users },
  { id: 'campaigns',   label: 'Campaigns',   icon: Send },
  { id: 'analytics',   label: 'Analytics',   icon: BarChart2 },
];

export default function WhatsAppAcquisition() {
  const [activeTab, setActiveTab] = useState('subscribers');
  const [reloadKey, setReloadKey] = useState(0);
  const [configStatus, setConfigStatus] = useState(null);

  useEffect(() => {
    checkConfig().then(setConfigStatus).catch(() => setConfigStatus(null));
  }, []);

  const triggerReload = () => setReloadKey(k => k + 1);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader />

      <div className="flex items-center gap-1 bg-background border border-border rounded-2xl p-1 mb-6 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'accent-gradient-bg text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
        <button onClick={triggerReload}
          className="ml-1 p-1.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {activeTab === 'subscribers' && <SubscribersTab reload={reloadKey} />}
      {activeTab === 'campaigns'   && <CampaignsTab reload={reloadKey} configStatus={configStatus} />}
      {activeTab === 'analytics'   && <AnalyticsTab reload={reloadKey} />}
    </div>
  );
}
