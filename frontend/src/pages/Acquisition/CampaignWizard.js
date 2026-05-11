import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Check, Plus, X, Trash2,
  Users, UserCheck, Building2, Package, Handshake, Target,
  FileText, Megaphone, GitBranch, AlertCircle,
  ChevronUp, ChevronDown, Globe, Info, GripVertical,
} from 'lucide-react';
import {
  getCampaignTypes, getTagGroups, getCampaignTemplates,
  getCampaign, createCampaign, updateCampaign, activateCampaign,
} from '../../services/campaignsApi';

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'basics',   label: 'Basics',   Icon: Info },
  { id: 'form',     label: 'Form',     Icon: FileText },
  { id: 'audience', label: 'Audience', Icon: Globe },
  { id: 'creative', label: 'Creative', Icon: Megaphone },
  { id: 'pipeline', label: 'Pipeline', Icon: GitBranch },
  { id: 'review',   label: 'Review',   Icon: Check },
];

const TYPE_META = {
  customer_acquisition:  { Icon: Users,      colorCls: 'text-indigo-400',  bgCls: 'bg-indigo-500/15 border-indigo-500/30',  activeBg: 'bg-indigo-500/25 border-indigo-400',  desc: 'Capture and nurture potential customers through your funnel' },
  talent_acquisition:    { Icon: UserCheck,  colorCls: 'text-violet-400',  bgCls: 'bg-violet-500/15 border-violet-500/30',  activeBg: 'bg-violet-500/25 border-violet-400',  desc: 'Recruit and screen job applicants for open positions' },
  franchise_development: { Icon: Building2,  colorCls: 'text-amber-400',   bgCls: 'bg-amber-500/15  border-amber-500/30',   activeBg: 'bg-amber-500/25  border-amber-400',   desc: 'Identify and qualify franchise expansion opportunities' },
  vendor_sourcing:       { Icon: Package,    colorCls: 'text-teal-400',    bgCls: 'bg-teal-500/15   border-teal-500/30',    activeBg: 'bg-teal-500/25   border-teal-400',    desc: 'Onboard suppliers and vendor partners at scale' },
  partnership_outreach:  { Icon: Handshake,  colorCls: 'text-rose-400',    bgCls: 'bg-rose-500/15   border-rose-500/30',    activeBg: 'bg-rose-500/25   border-rose-400',    desc: 'Manage business development and partnership pipelines' },
  general_lead_gen:      { Icon: Target,     colorCls: 'text-sky-400',     bgCls: 'bg-sky-500/15    border-sky-500/30',     activeBg: 'bg-sky-500/25    border-sky-400',     desc: 'All-purpose lead collection and management' },
};

const FIELD_TYPES = [
  { value: 'text',            label: 'Text' },
  { value: 'email',           label: 'Email' },
  { value: 'phone',           label: 'Phone' },
  { value: 'textarea',        label: 'Long Text' },
  { value: 'number',          label: 'Number' },
  { value: 'date',            label: 'Date' },
  { value: 'single_choice',   label: 'Single Choice' },
  { value: 'multi_choice',    label: 'Multi Choice' },
  { value: 'url',             label: 'URL' },
  { value: 'rating',          label: 'Rating (1–5)' },
  { value: 'boolean',         label: 'Yes / No' },
  { value: 'section_heading', label: 'Section Heading' },
];

const SUBMIT_ACTIONS = [
  { value: 'save_submission', label: 'Save and show thank-you message' },
  { value: 'redirect',        label: 'Redirect to URL after submit' },
  { value: 'webhook',         label: 'Fire a webhook after submit' },
  { value: 'none',            label: 'No post-submit action' },
];

const CHANNELS = [
  { value: 'web_form',   label: 'Web Form',   desc: 'Embeddable web form' },
  { value: 'whatsapp',   label: 'WhatsApp',   desc: 'WhatsApp flow messages' },
  { value: 'instagram',  label: 'Instagram',  desc: 'Instagram DM lead-gen' },
  { value: 'manual',     label: 'Manual Entry', desc: 'Staff-entered submissions' },
];

const RETENTION_CLASSES = [
  { value: 'standard',  label: 'Standard',  detail: '24-month retention' },
  { value: 'extended',  label: 'Extended',  detail: '36-month retention' },
  { value: 'sensitive', label: 'Sensitive', detail: '12-month retention' },
  { value: 'regulated', label: 'Regulated', detail: '60-month retention' },
];

const DEFAULT_STAGE_SET = {
  stages: [
    { key: 'new',       label: 'New',       is_initial: true },
    { key: 'engaging',  label: 'Engaging',  sla_hours: 24 },
    { key: 'qualified', label: 'Qualified', promotion_eligible: true, sla_hours: 48 },
    { key: 'converted', label: 'Converted', is_terminal: true, outcome: 'won' },
    { key: 'lost',      label: 'Lost',      is_terminal: true, outcome: 'lost' },
  ],
};

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/^[^a-z]+/, '') || 'field';
}

function makeEmptyForm() {
  return {
    name: '',
    description: '',
    campaign_type_id: '',
    tag_group_id: '',
    retention_class: 'standard',
    disclosure_footer: '',
    form_fields: [
      { id: 'fullname', type: 'text',  label: 'Full Name',     required: true,  placeholder: '', options: [] },
      { id: 'phone',    type: 'phone', label: 'Phone Number',  required: true,  placeholder: '', options: [] },
      { id: 'email',    type: 'email', label: 'Email Address', required: false, placeholder: '', options: [] },
    ],
    submit_action_kind: 'save_submission',
    submit_action_url: '',
    audience_countries: '',
    audience_age_min: 18,
    audience_age_max: 55,
    audience_lookalike: 2,
    audience_segment_tags: '',
    channels: ['web_form', 'manual'],
    start_at: '',
    end_at: '',
    daily_cap: '',
    total_cap: '',
    qualification_threshold: 40,
    stages: DEFAULT_STAGE_SET.stages.map((s) => ({ ...s })),
  };
}

// ─── Shared UI atoms ─────────────────────────────────────────────────────────

function Label({ children, required }) {
  return (
    <label className="block text-xs font-medium text-gray-400 mb-1.5">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full bg-[#1C1F2A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 transition-colors ${className}`}
      {...props}
    />
  );
}

function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full bg-[#1C1F2A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 transition-colors resize-none ${className}`}
      {...props}
    />
  );
}

function Select({ children, className = '', ...props }) {
  return (
    <select
      className={`w-full bg-[#1C1F2A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-2xl bg-[#13161D] border border-white/8 p-6">
      {title && <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>}
      {children}
    </div>
  );
}

// ─── Step progress bar ───────────────────────────────────────────────────────

function StepBar({ currentStep }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const done    = i < currentStep;
        const active  = i === currentStep;
        const { Icon } = step;
        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                done   ? 'bg-indigo-500 border-indigo-500 text-white' :
                active ? 'border-indigo-500 bg-indigo-500/15 text-indigo-400' :
                         'border-white/15 bg-transparent text-gray-600'
              }`}>
                {done ? <Check size={16} /> : <Icon size={15} />}
              </div>
              <span className={`mt-1.5 text-xs font-medium ${active ? 'text-indigo-400' : done ? 'text-gray-400' : 'text-gray-600'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-5 transition-colors ${done ? 'bg-indigo-500/60' : 'bg-white/10'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Template picker (shown on BasicsStep in create mode) ───────────────────

function TemplatePicker({ campaignTypes, selectedTypeId, onApply }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setFetchError(null);
    getCampaignTemplates({ is_active: true })
      .then((res) => setTemplates(Array.isArray(res) ? res : (res?.items ?? [])))
      .catch((err) => setFetchError(err.message || 'Failed to load templates'))
      .finally(() => setLoading(false));
  }, [open]);

  const visible = selectedTypeId
    ? templates.filter((t) => t.campaign_type_id === selectedTypeId)
    : templates;

  return (
    <div className="rounded-2xl bg-[#13161D] border border-white/8">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-gray-300 hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2">
          <FileText size={15} className="text-indigo-400" />
          Start from a template
        </span>
        {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
      </button>

      {open && (
        <div className="border-t border-white/8 px-5 pb-4 pt-4">
          {fetchError ? (
            <p className="text-xs text-red-400">{fetchError}</p>
          ) : loading ? (
            <div className="flex gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="flex-1 h-24 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="text-xs text-gray-500">
              {selectedTypeId
                ? 'No templates for this campaign type.'
                : 'No templates available.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visible.map((tmpl) => {
                const typeKey = campaignTypes.find((ct) => ct.id === tmpl.campaign_type_id)?.key || '';
                const meta = TYPE_META[typeKey] || {};
                const { colorCls = 'text-gray-400', Icon: TypeIcon = Target } = meta;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => { onApply(tmpl); setOpen(false); }}
                    className="text-left p-4 rounded-xl bg-[#1C1F2A] border border-white/8 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <TypeIcon size={14} className={colorCls} />
                      <span className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        {tmpl.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-snug line-clamp-2">
                      {tmpl.description || ''}
                    </p>
                    <div className="mt-2 text-xs text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Use this template →
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-gray-600">
            Selecting a template pre-fills the form fields and channel settings. You can customise everything afterwards.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Step 1: Basics ──────────────────────────────────────────────────────────

function BasicsStep({ data, onChange, campaignTypes, tagGroups, showTemplates, onApplyTemplate }) {
  const selectedTypeKey = campaignTypes.find((t) => t.id === data.campaign_type_id)?.key || '';

  return (
    <div className="space-y-5">
      {showTemplates && (
        <TemplatePicker
          campaignTypes={campaignTypes}
          selectedTypeId={data.campaign_type_id}
          onApply={onApplyTemplate}
        />
      )}
      <SectionCard title="Campaign details">
        <div className="space-y-4">
          <div>
            <Label required>Campaign name</Label>
            <Input
              value={data.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder="e.g. Summer 2026 Customer Acquisition"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={data.description}
              onChange={(e) => onChange('description', e.target.value)}
              placeholder="What is this campaign trying to achieve?"
            />
          </div>
          {tagGroups.length > 0 && (
            <div>
              <Label>Tag group</Label>
              <Select
                value={data.tag_group_id}
                onChange={(e) => onChange('tag_group_id', e.target.value)}
              >
                <option value="">No tag group</option>
                {tagGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Select>
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Campaign motion">
        <p className="text-xs text-gray-500 mb-4">Select the primary motion that drives this campaign. This determines default stages, retention policy, and promotion targets.</p>
        <div className="grid grid-cols-2 gap-3">
          {campaignTypes.map((ct) => {
            const meta = TYPE_META[ct.key] || {};
            const { Icon: TypeIcon = Target, colorCls = 'text-gray-400', bgCls = 'bg-white/5 border-white/10', activeBg = 'bg-indigo-500/20 border-indigo-400' } = meta;
            const active = data.campaign_type_id === ct.id;
            return (
              <button
                key={ct.id}
                type="button"
                onClick={() => onChange('campaign_type_id', ct.id)}
                className={`text-left p-4 rounded-xl border transition-all ${active ? activeBg : bgCls} hover:border-white/30`}
              >
                <TypeIcon size={20} className={`mb-2 ${colorCls}`} />
                <div className="text-sm font-medium text-white mb-1">{ct.display_name}</div>
                <div className="text-xs text-gray-500 leading-snug">{meta.desc || ct.description || ''}</div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Data policy">
        <div className="space-y-4">
          <div>
            <Label>Retention class</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {RETENTION_CLASSES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => onChange('retention_class', r.value)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    data.retention_class === r.value
                      ? 'border-indigo-500/60 bg-indigo-500/10'
                      : 'border-white/10 bg-transparent hover:border-white/20'
                  }`}
                >
                  <div className="text-xs font-semibold text-white">{r.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{r.detail}</div>
                </button>
              ))}
            </div>
          </div>
          {(selectedTypeKey === 'talent_acquisition' || selectedTypeKey === 'franchise_development') && (
            <div>
              <Label>Legal disclosure footer</Label>
              <Textarea
                rows={2}
                value={data.disclosure_footer}
                onChange={(e) => onChange('disclosure_footer', e.target.value)}
                placeholder="By submitting this form, you consent to…"
              />
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Meta SAC definitions ────────────────────────────────────────────────────

const META_AD_CATEGORY_INFO = {
  employment: {
    label: 'Employment',
    detail: 'Meta employment ad policy applies. Age targeting is locked to 18–65; demographic exclusions are prohibited.',
  },
  credit_or_employment: {
    label: 'Credit / Employment',
    detail: 'Meta Special Ad Category (Credit or Employment) applies. Age range locked 18–65; location and demographic exclusions are restricted.',
  },
  housing: {
    label: 'Housing',
    detail: 'Meta housing ad policy applies. Age targeting locked to 18–65; exclusions by zip, radius, or demographics are prohibited.',
  },
};

// ─── Form channel previews ────────────────────────────────────────────────────

function WebFormPreview({ fields }) {
  if (!fields.length) {
    return <p className="text-xs text-gray-600 text-center py-8">Add fields to see a preview</p>;
  }
  return (
    <div className="space-y-3">
      {fields.map((field) => {
        if (field.type === 'section_heading') {
          return (
            <div key={field.id} className="pt-1">
              <p className="text-xs font-semibold text-gray-300 border-b border-white/10 pb-1.5">{field.label || 'Section'}</p>
            </div>
          );
        }
        if (field.type === 'boolean') {
          return (
            <div key={field.id}>
              <p className="text-xs text-gray-400 mb-1.5">{field.label || <span className="italic text-gray-600">Untitled</span>}{field.required && <span className="text-red-400 ml-0.5">*</span>}</p>
              <div className="flex gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-white/8 text-xs text-gray-300">Yes</span>
                <span className="px-3 py-1.5 rounded-lg bg-white/8 text-xs text-gray-300">No</span>
              </div>
            </div>
          );
        }
        if (field.type === 'rating') {
          return (
            <div key={field.id}>
              <p className="text-xs text-gray-400 mb-1.5">{field.label || <span className="italic text-gray-600">Untitled</span>}{field.required && <span className="text-red-400 ml-0.5">*</span>}</p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className="w-7 h-7 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center text-xs text-gray-500">{n}</span>
                ))}
              </div>
            </div>
          );
        }
        if (field.type === 'single_choice' || field.type === 'multi_choice') {
          return (
            <div key={field.id}>
              <p className="text-xs text-gray-400 mb-1.5">{field.label || <span className="italic text-gray-600">Untitled</span>}{field.required && <span className="text-red-400 ml-0.5">*</span>}</p>
              <div className="space-y-1">
                {(field.options || []).slice(0, 4).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/8">
                    <div className={`w-3 h-3 rounded-${field.type === 'single_choice' ? 'full' : 'sm'} border border-white/30 flex-shrink-0`} />
                    <span className="text-xs text-gray-300">{opt}</span>
                  </div>
                ))}
                {(field.options || []).length > 4 && <p className="text-xs text-gray-600 px-1">+{field.options.length - 4} more</p>}
                {!(field.options?.length) && <p className="text-xs text-gray-600 px-1 italic">No options added yet</p>}
              </div>
            </div>
          );
        }
        if (field.type === 'textarea') {
          return (
            <div key={field.id}>
              <p className="text-xs text-gray-400 mb-1.5">{field.label || <span className="italic text-gray-600">Untitled</span>}{field.required && <span className="text-red-400 ml-0.5">*</span>}</p>
              <div className="w-full h-14 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5">
                <p className="text-xs text-gray-600 italic">{field.placeholder || 'Your answer…'}</p>
              </div>
            </div>
          );
        }
        const hint = field.placeholder || (field.type === 'date' ? 'DD / MM / YYYY' : field.type === 'number' ? '0' : 'Type here…');
        return (
          <div key={field.id}>
            <p className="text-xs text-gray-400 mb-1.5">{field.label || <span className="italic text-gray-600">Untitled</span>}{field.required && <span className="text-red-400 ml-0.5">*</span>}</p>
            <div className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-2">
              <p className="text-xs text-gray-600 italic">{hint}</p>
            </div>
          </div>
        );
      })}
      <button className="w-full py-2 rounded-lg bg-indigo-600/50 text-xs text-white font-medium mt-1 opacity-70 cursor-default">Submit</button>
    </div>
  );
}

function WhatsAppPreview({ fields }) {
  const content = fields.filter((f) => f.type !== 'section_heading');
  if (!content.length) {
    return <p className="text-xs text-gray-600 text-center py-8">Add fields to see a preview</p>;
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-start">
        <div className="max-w-[90%] bg-[#1C1F2A] rounded-2xl rounded-tl-none px-3 py-2 text-xs text-gray-200">
          Hi! I'd love to get your details. Let's start 👋
        </div>
      </div>
      {content.slice(0, 5).map((field) => (
        <React.Fragment key={field.id}>
          <div className="flex justify-start">
            <div className="max-w-[90%] bg-[#1C1F2A] rounded-2xl rounded-tl-none px-3 py-2 text-xs text-gray-200">
              {field.label || <span className="italic text-gray-500">Untitled</span>}{!field.required && ' (optional)'}
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[90%] bg-indigo-600/50 rounded-2xl rounded-tr-none px-3 py-2 text-xs text-white/60 italic">
              {field.placeholder || (field.type === 'phone' ? '+91 98765 43210' : field.type === 'email' ? 'user@email.com' : field.type === 'single_choice' && field.options?.[0] ? field.options[0] : '…')}
            </div>
          </div>
        </React.Fragment>
      ))}
      {content.length > 5 && (
        <p className="text-xs text-gray-600 text-center pt-1">+{content.length - 5} more questions</p>
      )}
    </div>
  );
}

function InstagramPreview({ fields }) {
  const content = fields.filter((f) => f.type !== 'section_heading' && f.type !== 'boolean' && f.type !== 'rating');
  if (!content.length) {
    return <p className="text-xs text-gray-600 text-center py-8">Add fields to see a preview</p>;
  }
  const current = content[0];
  return (
    <div className="rounded-xl overflow-hidden border border-white/10">
      <div className="bg-gradient-to-b from-indigo-900/40 to-[#0D0F17] h-16 flex items-center justify-center">
        <span className="text-xs text-white/30">Your brand visual</span>
      </div>
      <div className="bg-[#0D0F17] px-3 py-3 space-y-2.5">
        <p className="text-xs font-semibold text-white">{current.label || <span className="text-gray-500 italic">Untitled field</span>}</p>
        <div className="rounded-lg bg-white/8 border border-white/10 px-2.5 py-1.5">
          <p className="text-xs text-gray-500 italic">{current.placeholder || 'Your answer'}</p>
        </div>
        <div className="flex gap-1 justify-center py-1">
          {content.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === 0 ? 'bg-indigo-400' : 'bg-white/20'}`} />
          ))}
        </div>
        <button className="w-full py-1.5 rounded-lg bg-indigo-600 text-xs text-white font-medium opacity-70 cursor-default">Next</button>
      </div>
    </div>
  );
}

function FormPreview({ fields, activeChannel, onChannelChange }) {
  return (
    <div className="rounded-2xl bg-[#13161D] border border-white/8 p-4 sticky top-24">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-gray-400">Live preview</span>
        <div className="flex gap-1">
          {[
            { key: 'web_form',  label: 'Web' },
            { key: 'whatsapp',  label: 'WA' },
            { key: 'instagram', label: 'IG' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => onChannelChange(t.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeChannel === t.key ? 'bg-indigo-600 text-white' : 'bg-white/8 text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {activeChannel === 'web_form'  && <WebFormPreview  fields={fields} />}
        {activeChannel === 'whatsapp'  && <WhatsAppPreview  fields={fields} />}
        {activeChannel === 'instagram' && <InstagramPreview fields={fields} />}
      </div>
    </div>
  );
}

// ─── Step 2: Form builder ────────────────────────────────────────────────────

function FieldCard({ field, index, onChange, onRemove, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver }) {
  const needsOptions = field.type === 'single_choice' || field.type === 'multi_choice';
  const [newOpt, setNewOpt] = useState('');

  function addOption() {
    if (!newOpt.trim()) return;
    onChange(index, 'options', [...(field.options || []), newOpt.trim()]);
    setNewOpt('');
  }

  function removeOption(oi) {
    onChange(index, 'options', field.options.filter((_, i) => i !== oi));
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
      onDrop={() => onDrop(index)}
      onDragEnd={onDragEnd}
      className={`bg-[#1C1F2A] border rounded-xl p-4 transition-all ${
        isDragOver ? 'border-indigo-500/60 bg-indigo-500/5 scale-[1.01]' : 'border-white/8'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          className="mt-6 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing transition-colors flex-shrink-0"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
        >
          <GripVertical size={16} />
        </button>
        <div className="flex-1 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Label</Label>
              <Input
                value={field.label}
                onChange={(e) => {
                  const label = e.target.value;
                  onChange(index, 'label', label);
                  onChange(index, 'id', slugify(label) || field.id);
                }}
                placeholder="Field label"
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={field.type}
                onChange={(e) => onChange(index, 'type', e.target.value)}
              >
                {FIELD_TYPES.map((ft) => (
                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                ))}
              </Select>
            </div>
          </div>
          {field.type !== 'section_heading' && field.type !== 'boolean' && field.type !== 'rating' && (
            <div>
              <Label>Placeholder</Label>
              <Input
                value={field.placeholder || ''}
                onChange={(e) => onChange(index, 'placeholder', e.target.value)}
                placeholder="Optional hint text"
              />
            </div>
          )}
          {needsOptions && (
            <div>
              <Label>Options</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(field.options || []).map((opt, oi) => (
                  <span key={oi} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/8 text-xs text-gray-300">
                    {opt}
                    <button onClick={() => removeOption(oi)} className="text-gray-500 hover:text-red-400"><X size={11} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newOpt}
                  onChange={(e) => setNewOpt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                  placeholder="Add option and press Enter"
                  className="flex-1"
                />
                <button
                  onClick={addOption}
                  className="px-3 py-2 rounded-xl bg-white/8 text-gray-400 hover:text-white hover:bg-white/12 text-xs transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          )}
          {field.type !== 'section_heading' && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => onChange(index, 'required', e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-gray-400">Required field</span>
            </label>
          )}
        </div>
        <button onClick={() => onRemove(index)} className="mt-6 p-1 rounded text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function FormBuilderStep({ data, onChange }) {
  const [previewChannel, setPreviewChannel] = useState('web_form');
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  function updateField(index, key, value) {
    onChange('form_fields', data.form_fields.map((f, i) => i === index ? { ...f, [key]: value } : f));
  }

  function removeField(index) {
    onChange('form_fields', data.form_fields.filter((_, i) => i !== index));
  }

  function addField() {
    const base = `field_${Date.now()}`;
    onChange('form_fields', [
      ...data.form_fields,
      { id: base, type: 'text', label: '', required: false, placeholder: '', options: [] },
    ]);
  }

  function handleDragStart(i) { setDragIdx(i); }
  function handleDragOver(i) { setDragOverIdx(i); }
  function handleDrop(i) {
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDragOverIdx(null); return; }
    const fields = [...data.form_fields];
    const [moved] = fields.splice(dragIdx, 1);
    fields.splice(i, 0, moved);
    onChange('form_fields', fields);
    setDragIdx(null);
    setDragOverIdx(null);
  }
  function handleDragEnd() { setDragIdx(null); setDragOverIdx(null); }

  const showUrlInput = data.submit_action_kind === 'redirect' || data.submit_action_kind === 'webhook';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Left: field editor */}
      <div className="lg:col-span-3 space-y-5">
        <SectionCard title="Form fields">
          <div className="space-y-3">
            {data.form_fields.map((field, i) => (
              <FieldCard
                key={field.id}
                field={field}
                index={i}
                onChange={updateField}
                onRemove={removeField}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                isDragOver={dragOverIdx === i && dragIdx !== i}
              />
            ))}
            <button
              onClick={addField}
              className="w-full py-2.5 rounded-xl border border-dashed border-white/15 text-gray-500 hover:text-gray-300 hover:border-white/30 text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={15} /> Add field
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Submit action">
          <div className="space-y-3">
            <div>
              <Label>What happens after submit?</Label>
              <Select
                value={data.submit_action_kind}
                onChange={(e) => onChange('submit_action_kind', e.target.value)}
              >
                {SUBMIT_ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </Select>
            </div>
            {showUrlInput && (
              <div>
                <Label>{data.submit_action_kind === 'redirect' ? 'Redirect URL' : 'Webhook URL'}</Label>
                <Input
                  type="url"
                  value={data.submit_action_url}
                  onChange={(e) => onChange('submit_action_url', e.target.value)}
                  placeholder="https://"
                />
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Right: live preview */}
      <div className="lg:col-span-2">
        <FormPreview
          fields={data.form_fields}
          activeChannel={previewChannel}
          onChannelChange={setPreviewChannel}
        />
      </div>
    </div>
  );
}

// ─── Step 3: Audience ────────────────────────────────────────────────────────

function AudienceStep({ data, onChange, campaignType }) {
  const metaAdCategory = campaignType?.meta_ad_category || 'none';
  const requiresDisclosure = campaignType?.requires_legal_disclosure || false;
  const isMetaRestricted = metaAdCategory !== 'none';
  const metaCatInfo = META_AD_CATEGORY_INFO[metaAdCategory];

  const [geoInput, setGeoInput] = useState('');
  const countries = data.audience_countries
    ? data.audience_countries.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : [];

  function addCountry() {
    const c = geoInput.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) return;
    if (!countries.includes(c)) {
      onChange('audience_countries', [...countries, c].join(', '));
    }
    setGeoInput('');
  }

  function removeCountry(c) {
    onChange('audience_countries', countries.filter((x) => x !== c).join(', '));
  }

  return (
    <div className="space-y-5">
      {/* Meta Special Ad Category banner */}
      {isMetaRestricted && metaCatInfo && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertCircle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-300 mb-0.5">
              Meta Special Ad Category — {metaCatInfo.label}
            </p>
            <p className="text-xs text-amber-300/70 leading-relaxed">{metaCatInfo.detail}</p>
          </div>
        </div>
      )}

      {/* Legal disclosure missing warning */}
      {requiresDisclosure && !data.disclosure_footer?.trim() && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-red-300 mb-0.5">Legal disclosure required</p>
            <p className="text-xs text-red-300/70">
              This campaign motion requires a legal disclosure footer before activation.
              Go back to <strong className="text-red-300">Basics</strong> to add it.
            </p>
          </div>
        </div>
      )}

      {/* Geographic targeting — chip-style */}
      <SectionCard title="Geographic targeting">
        <div>
          <Label>Countries</Label>
          {countries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {countries.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-xs text-indigo-300"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removeCountry(c)}
                    className="text-indigo-400/60 hover:text-red-400 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={geoInput}
              onChange={(e) => setGeoInput(e.target.value.toUpperCase().slice(0, 2))}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCountry())}
              placeholder="ISO code e.g. IN"
              maxLength={2}
              className="flex-1 uppercase tracking-widest"
            />
            <button
              type="button"
              onClick={addCountry}
              className="px-3 py-2 rounded-xl bg-white/8 text-gray-400 hover:text-white hover:bg-white/12 text-xs transition-colors"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1.5">Leave empty to target all geographies.</p>
        </div>
      </SectionCard>

      {/* Age & demographics */}
      <SectionCard title="Age & demographics">
        {isMetaRestricted && (
          <div className="flex items-center gap-2 mb-4 text-xs text-amber-400 bg-amber-500/8 border border-amber-500/15 rounded-lg px-3 py-2">
            <AlertCircle size={13} className="flex-shrink-0" />
            Age range locked to 18–65 per Meta Special Ad Category policy.
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Minimum age</Label>
            <Input
              type="number"
              min={18}
              max={65}
              value={isMetaRestricted ? 18 : data.audience_age_min}
              onChange={(e) => !isMetaRestricted && onChange('audience_age_min', parseInt(e.target.value, 10) || 18)}
              disabled={isMetaRestricted}
              className={isMetaRestricted ? 'opacity-50 cursor-not-allowed' : ''}
            />
          </div>
          <div>
            <Label>Maximum age</Label>
            <Input
              type="number"
              min={18}
              max={65}
              value={isMetaRestricted ? 65 : data.audience_age_max}
              onChange={(e) => !isMetaRestricted && onChange('audience_age_max', parseInt(e.target.value, 10) || 65)}
              disabled={isMetaRestricted}
              className={isMetaRestricted ? 'opacity-50 cursor-not-allowed' : ''}
            />
          </div>
        </div>
      </SectionCard>

      {/* Lookalike audience */}
      <SectionCard title="Lookalike audience">
        <div>
          <Label>Lookalike size (1–10% of source audience)</Label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={1}
              max={10}
              value={data.audience_lookalike}
              onChange={(e) => onChange('audience_lookalike', parseInt(e.target.value, 10))}
              className="flex-1 accent-indigo-500"
            />
            <span className="text-sm font-semibold text-indigo-400 w-8 text-right">{data.audience_lookalike}%</span>
          </div>
          <p className="text-xs text-gray-600 mt-1.5">Used when publishing to Meta Ads. Smaller percentage = more precise match.</p>
        </div>
      </SectionCard>

      {/* WhatsApp segment tags */}
      <SectionCard title="WhatsApp segment tags">
        <div>
          <Label>Subscriber tags (comma-separated)</Label>
          <Input
            value={data.audience_segment_tags}
            onChange={(e) => onChange('audience_segment_tags', e.target.value)}
            placeholder="vip, returning, city:mumbai"
          />
          <p className="text-xs text-gray-600 mt-1.5">Only WhatsApp subscribers matching ALL listed tags will receive campaign messages.</p>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Step 4: Creative / Channels ─────────────────────────────────────────────

function CreativeStep({ data, onChange }) {
  function toggleChannel(ch) {
    const active = data.channels.includes(ch);
    onChange('channels', active ? data.channels.filter((c) => c !== ch) : [...data.channels, ch]);
  }

  return (
    <div className="space-y-5">
      <SectionCard title="Acquisition channels">
        <p className="text-xs text-gray-500 mb-4">Select every channel where this campaign will accept submissions.</p>
        <div className="grid grid-cols-2 gap-3">
          {CHANNELS.map((ch) => {
            const active = data.channels.includes(ch.value);
            return (
              <button
                key={ch.value}
                type="button"
                onClick={() => toggleChannel(ch.value)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  active
                    ? 'border-indigo-500/60 bg-indigo-500/10'
                    : 'border-white/10 bg-transparent hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{ch.label}</span>
                  {active && <Check size={14} className="text-indigo-400" />}
                </div>
                <span className="text-xs text-gray-500">{ch.desc}</span>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Campaign schedule">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Start date</Label>
            <Input
              type="date"
              value={data.start_at}
              onChange={(e) => onChange('start_at', e.target.value)}
            />
          </div>
          <div>
            <Label>End date</Label>
            <Input
              type="date"
              value={data.end_at}
              onChange={(e) => onChange('end_at', e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Volume controls">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label>Daily submission cap</Label>
            <Input
              type="number"
              min={1}
              value={data.daily_cap}
              onChange={(e) => onChange('daily_cap', e.target.value)}
              placeholder="Unlimited"
            />
          </div>
          <div>
            <Label>Total submission cap</Label>
            <Input
              type="number"
              min={1}
              value={data.total_cap}
              onChange={(e) => onChange('total_cap', e.target.value)}
              placeholder="Unlimited"
            />
          </div>
        </div>
        <div>
          <Label>Qualification score threshold ({data.qualification_threshold})</Label>
          <input
            type="range"
            min={0}
            max={100}
            value={data.qualification_threshold}
            onChange={(e) => onChange('qualification_threshold', parseInt(e.target.value, 10))}
            className="w-full mt-1 accent-indigo-500"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>0 — any score qualifies</span>
            <span>100 — perfect score only</span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Step 5: Pipeline ────────────────────────────────────────────────────────

function PipelineStep({ data, onChange }) {
  function updateStage(i, key, value) {
    const stages = data.stages.map((s, si) => si === i ? { ...s, [key]: value } : s);
    onChange('stages', stages);
  }

  function addStage() {
    const terminalIndex = data.stages.findIndex((s) => s.is_terminal);
    const insertAt = terminalIndex === -1 ? data.stages.length : terminalIndex;
    const key = `stage_${Date.now()}`;
    const newStage = { key, label: 'New Stage', sla_hours: 48 };
    const stages = [...data.stages];
    stages.splice(insertAt, 0, newStage);
    onChange('stages', stages);
  }

  function removeStage(i) {
    if (data.stages[i].is_terminal || data.stages[i].is_initial) return;
    onChange('stages', data.stages.filter((_, si) => si !== i));
  }

  function moveStage(i, dir) {
    const stages = [...data.stages];
    const swap = i + dir;
    if (swap < 0 || swap >= stages.length) return;
    if (stages[swap].is_initial || stages[i].is_initial) return;
    [stages[i], stages[swap]] = [stages[swap], stages[i]];
    onChange('stages', stages);
  }

  const terminalStages = data.stages.filter((s) => s.is_terminal);
  const nonTerminalCount = data.stages.filter((s) => !s.is_terminal).length;

  return (
    <div className="space-y-5">
      <SectionCard title="Submission pipeline">
        <p className="text-xs text-gray-500 mb-4">
          Define the stages a submission moves through. Initial and terminal stages are fixed — you can add custom intermediate stages.
        </p>
        <div className="space-y-2">
          {data.stages.map((stage, i) => (
            <div
              key={stage.key}
              className={`flex items-center gap-3 p-3 rounded-xl border ${
                stage.is_terminal
                  ? stage.outcome === 'won'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-red-500/30 bg-red-500/5'
                  : stage.is_initial
                    ? 'border-blue-500/30 bg-blue-500/5'
                    : 'border-white/8 bg-white/3'
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveStage(i, -1)} disabled={i === 0 || stage.is_initial} className="text-gray-600 hover:text-gray-300 disabled:opacity-20 transition-colors"><ChevronUp size={13} /></button>
                <button onClick={() => moveStage(i, 1)} disabled={i === data.stages.length - 1 || stage.is_terminal} className="text-gray-600 hover:text-gray-300 disabled:opacity-20 transition-colors"><ChevronDown size={13} /></button>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <Label>Stage label</Label>
                  <Input
                    value={stage.label}
                    onChange={(e) => updateStage(i, 'label', e.target.value)}
                    disabled={stage.is_terminal || stage.is_initial}
                    className={stage.is_terminal || stage.is_initial ? 'opacity-60 cursor-not-allowed' : ''}
                  />
                </div>
                {!stage.is_terminal && (
                  <div>
                    <Label>SLA hours</Label>
                    <Input
                      type="number"
                      min={0}
                      value={stage.sla_hours || ''}
                      onChange={(e) => updateStage(i, 'sla_hours', parseInt(e.target.value, 10) || undefined)}
                      placeholder="None"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {stage.is_initial && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Initial</span>}
                {stage.promotion_eligible && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">Promote</span>}
                {stage.is_terminal && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${stage.outcome === 'won' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {stage.outcome === 'won' ? 'Won' : 'Lost'}
                  </span>
                )}
                {!stage.is_terminal && !stage.is_initial && (
                  <button onClick={() => removeStage(i)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addStage}
          className="mt-3 w-full py-2.5 rounded-xl border border-dashed border-white/15 text-gray-500 hover:text-gray-300 hover:border-white/30 text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Plus size={14} /> Add custom stage
        </button>
      </SectionCard>

      <SectionCard>
        <div className="flex items-start gap-3">
          <Info size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            The <span className="text-gray-300">Promotion</span> badge marks the stage where a qualified submission can be promoted to a customer, employee, or franchisee record. Terminal stages end the pipeline — won or lost.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Step 6: Review ──────────────────────────────────────────────────────────

function ReviewStep({ data, campaignTypes }) {
  const ct = campaignTypes.find((t) => t.id === data.campaign_type_id);
  const typeLabel = ct?.display_name || '—';

  function Row({ label, value }) {
    return (
      <div className="flex justify-between items-start py-2 border-b border-white/5 last:border-0">
        <span className="text-xs text-gray-500 w-40 flex-shrink-0">{label}</span>
        <span className="text-xs text-gray-200 text-right">{value || <span className="text-gray-600">—</span>}</span>
      </div>
    );
  }

  const countries = data.audience_countries.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const segTags = data.audience_segment_tags.split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      <SectionCard title="Campaign basics">
        <Row label="Name" value={data.name} />
        <Row label="Motion" value={typeLabel} />
        <Row label="Retention class" value={RETENTION_CLASSES.find((r) => r.value === data.retention_class)?.label} />
        {data.description && <Row label="Description" value={data.description} />}
      </SectionCard>

      <SectionCard title="Form">
        <Row label="Fields" value={`${data.form_fields.length} field${data.form_fields.length !== 1 ? 's' : ''}`} />
        <Row label="Required" value={data.form_fields.filter((f) => f.required).map((f) => f.label).join(', ')} />
        <Row label="Submit action" value={SUBMIT_ACTIONS.find((a) => a.value === data.submit_action_kind)?.label} />
      </SectionCard>

      <SectionCard title="Audience">
        <Row label="Countries" value={countries.length ? countries.join(', ') : 'All geographies'} />
        <Row label="Age range" value={`${data.audience_age_min} – ${data.audience_age_max}`} />
        <Row label="Lookalike size" value={`${data.audience_lookalike}%`} />
        {segTags.length > 0 && <Row label="Segment tags" value={segTags.join(', ')} />}
      </SectionCard>

      <SectionCard title="Creative & schedule">
        <Row label="Channels" value={data.channels.map((c) => CHANNELS.find((ch) => ch.value === c)?.label || c).join(', ')} />
        <Row label="Start date" value={data.start_at || 'Not set'} />
        <Row label="End date" value={data.end_at || 'Not set'} />
        {data.daily_cap && <Row label="Daily cap" value={data.daily_cap} />}
        {data.total_cap && <Row label="Total cap" value={data.total_cap} />}
        <Row label="Qualification threshold" value={`${data.qualification_threshold} / 100`} />
      </SectionCard>

      <SectionCard title="Pipeline">
        <Row label="Stages" value={data.stages.map((s) => s.label).join(' → ')} />
      </SectionCard>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function CampaignWizard() {
  const navigate = useNavigate();
  const { id: campaignId } = useParams();
  const isEdit = Boolean(campaignId);

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState(makeEmptyForm());
  const [campaignTypes, setCampaignTypes] = useState([]);
  const [tagGroups, setTagGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Seed stages from campaign type when type changes
  const seedStagesFromType = useCallback((typeId, types) => {
    const ct = types.find((t) => t.id === typeId);
    if (!ct?.default_stage_set?.stages) return;
    setFormData((prev) => ({ ...prev, stages: ct.default_stage_set.stages.map((s) => ({ ...s })) }));
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [types, groups] = await Promise.all([getCampaignTypes(), getTagGroups()]);
        setCampaignTypes(types);
        setTagGroups(groups);

        if (isEdit) {
          const c = await getCampaign(campaignId);
          // Build form_fields from form_schema
          const fields = (c.form_schema?.fields || []).map((f) => ({
            id: f.id || slugify(f.label),
            type: f.type || 'text',
            label: f.label || '',
            required: f.required || false,
            placeholder: f.placeholder || '',
            options: f.options || [],
          }));
          const stagesToUse = c.lifecycle_stages_override?.stages
            || types.find((t) => t.id === c.campaign_type_id)?.default_stage_set?.stages
            || DEFAULT_STAGE_SET.stages;

          setFormData({
            name: c.name || '',
            description: c.description || '',
            campaign_type_id: c.campaign_type_id || '',
            tag_group_id: c.tag_group_id || '',
            retention_class: c.retention_class || 'standard',
            disclosure_footer: c.disclosure_footer || '',
            form_fields: fields.length ? fields : makeEmptyForm().form_fields,
            submit_action_kind: c.form_schema?.submit_action?.kind || 'save_submission',
            submit_action_url: c.form_schema?.submit_action?.url || '',
            audience_countries: (c.audience_spec?.geo?.countries || []).join(', '),
            audience_age_min: c.audience_spec?.age_min || 18,
            audience_age_max: c.audience_spec?.age_max || 55,
            audience_lookalike: c.audience_spec?.lookalike_size_percent || 2,
            audience_segment_tags: (c.audience_spec?.segment_tags || []).join(', '),
            channels: c.creative_refs?.source_channels || ['web_form', 'manual'],
            start_at: c.start_at ? c.start_at.split('T')[0] : '',
            end_at: c.end_at ? c.end_at.split('T')[0] : '',
            daily_cap: c.daily_submission_cap || '',
            total_cap: c.total_submission_cap || '',
            qualification_threshold: c.qualification_threshold || 40,
            stages: stagesToUse.map((s) => ({ ...s })),
          });
        }
      } catch (e) {
        setError('Failed to load. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isEdit, campaignId]);

  function handleChange(key, value) {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-seed stages when campaign type changes
      if (key === 'campaign_type_id' && !isEdit) {
        const ct = campaignTypes.find((t) => t.id === value);
        if (ct?.default_stage_set?.stages) {
          next.stages = ct.default_stage_set.stages.map((s) => ({ ...s }));
        }
      }
      return next;
    });
  }

  function handleApplyTemplate(tmpl) {
    const fields = (tmpl.form_schema?.fields || []).map((f) => ({
      id: f.id || slugify(f.label || ''),
      type: f.type || 'text',
      label: f.label || '',
      required: f.required || false,
      placeholder: f.placeholder || '',
      options: Array.isArray(f.options) ? f.options : [],
    }));
    const channels = tmpl.default_creative_pattern?.source_channels || ['web_form', 'manual'];
    setFormData((prev) => {
      const typeId = prev.campaign_type_id || tmpl.campaign_type_id || '';
      const ct = campaignTypes.find((t) => t.id === typeId);
      const stages = ct?.default_stage_set?.stages?.map((s) => ({ ...s }))
        || DEFAULT_STAGE_SET.stages.map((s) => ({ ...s }));
      return {
        ...prev,
        campaign_type_id: typeId,
        form_fields: fields.length ? fields : prev.form_fields,
        channels,
        stages,
      };
    });
  }

  function buildPayload(status = 'draft') {
    const countries = formData.audience_countries
      .split(',').map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s));
    const segTags = formData.audience_segment_tags
      .split(',').map((s) => s.trim()).filter(Boolean);

    const form_schema = formData.form_fields.length
      ? {
          version: 1,
          fields: formData.form_fields.map((f) => {
            const field = { id: f.id, type: f.type, label: f.label, required: f.required };
            if (f.placeholder) field.placeholder = f.placeholder;
            if (f.options?.length) field.options = f.options;
            return field;
          }),
          submit_action: { kind: formData.submit_action_kind, ...(formData.submit_action_url ? { url: formData.submit_action_url } : {}) },
        }
      : {};

    const audience_spec = {
      ...(countries.length ? { geo: { countries } } : {}),
      age_min: formData.audience_age_min,
      age_max: formData.audience_age_max,
      lookalike_size_percent: formData.audience_lookalike,
      ...(segTags.length ? { segment_tags: segTags } : {}),
    };

    const defaultStages = DEFAULT_STAGE_SET.stages;
    const stagesChanged = JSON.stringify(formData.stages) !== JSON.stringify(defaultStages);

    return {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      campaign_type_id: formData.campaign_type_id,
      tag_group_id: formData.tag_group_id || null,
      retention_class: formData.retention_class,
      disclosure_footer: formData.disclosure_footer.trim() || null,
      form_schema,
      audience_spec,
      creative_refs: { source_channels: formData.channels },
      lifecycle_stages_override: stagesChanged ? { stages: formData.stages } : null,
      qualification_threshold: formData.qualification_threshold,
      start_at: formData.start_at || null,
      end_at: formData.end_at || null,
      daily_submission_cap: formData.daily_cap ? parseInt(formData.daily_cap, 10) : null,
      total_submission_cap: formData.total_cap ? parseInt(formData.total_cap, 10) : null,
    };
  }

  function validateCurrentStep() {
    if (step === 0) {
      if (!formData.name.trim()) return 'Campaign name is required.';
      if (!formData.campaign_type_id) return 'Please select a campaign motion.';
    }
    return null;
  }

  async function handleSave(activate = false) {
    const validErr = validateCurrentStep();
    if (validErr) { setError(validErr); return; }
    setError('');
    setSaving(true);
    try {
      const payload = buildPayload('draft');
      let campaign;
      if (isEdit) {
        campaign = await updateCampaign(campaignId, payload);
      } else {
        campaign = await createCampaign(payload);
      }
      if (activate) {
        await activateCampaign(campaign.id);
      }
      navigate('/acquisition/campaigns');
    } catch (e) {
      setError(e.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function nextStep() {
    const validErr = validateCurrentStep();
    if (validErr) { setError(validErr); return; }
    setError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function prevStep() {
    setError('');
    setStep((s) => Math.max(s - 1, 0));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1018] flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading…</div>
      </div>
    );
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="min-h-screen bg-[#0E1018] text-white">
      {/* Header */}
      <div className="sticky top-0 z-[50] bg-[#0E1018]/90 backdrop-blur-xl border-b border-white/8 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/acquisition/campaigns')}
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <ChevronLeft size={16} />
            Campaigns
          </button>
          <h1 className="text-sm font-semibold text-white">
            {isEdit ? 'Edit campaign' : 'New campaign'}
          </h1>
          <div className="w-24" />
        </div>
      </div>

      {/* Content */}
      <div className={`${step === 1 ? 'max-w-4xl' : 'max-w-2xl'} mx-auto px-6 py-8 transition-all`}>
        {/* Step bar + error always constrained to 2xl */}
        <div className={step === 1 ? 'max-w-2xl mx-auto' : ''}>
          <StepBar currentStep={step} />

          {error && (
            <div className="mb-5 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {step === 0 && <BasicsStep data={formData} onChange={handleChange} campaignTypes={campaignTypes} tagGroups={tagGroups} showTemplates={!isEdit} onApplyTemplate={handleApplyTemplate} />}
        {step === 1 && <FormBuilderStep data={formData} onChange={handleChange} />}
        {step === 2 && <AudienceStep data={formData} onChange={handleChange} campaignType={campaignTypes.find((t) => t.id === formData.campaign_type_id)} />}
        {step === 3 && <CreativeStep data={formData} onChange={handleChange} />}
        {step === 4 && <PipelineStep data={formData} onChange={handleChange} />}
        {step === 5 && <ReviewStep data={formData} campaignTypes={campaignTypes} />}

        {/* Navigation */}
        <div className={step === 1 ? 'max-w-2xl mx-auto' : ''}>
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/8">
            <button
              onClick={prevStep}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 text-sm text-gray-300 hover:text-white hover:border-white/30 disabled:opacity-0 disabled:pointer-events-none transition-all"
            >
              <ChevronLeft size={15} /> Back
            </button>

            <div className="flex items-center gap-3">
              {isLastStep ? (
                <>
                  <button
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl border border-white/15 text-sm text-gray-300 hover:text-white hover:border-white/30 disabled:opacity-50 transition-all"
                  >
                    {saving ? 'Saving…' : 'Save as draft'}
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving…' : 'Save & activate'}
                  </button>
                </>
              ) : (
                <button
                  onClick={nextStep}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium transition-colors"
                >
                  Next <ChevronRight size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
