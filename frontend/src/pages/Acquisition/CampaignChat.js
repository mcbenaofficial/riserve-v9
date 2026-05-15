import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Zap, Users, UserCheck, Building2, Package,
  Handshake, Target, Send, Check, Rocket, Globe,
  MessageSquare, Instagram, MapPin, TrendingUp, Sparkles,
  Film, AlignLeft, Image, Upload, X,
} from 'lucide-react';
import { getCampaignTypes, createCampaign, activateCampaign } from '../../services/campaignsApi';
import { generateHeadline, getPosts, uploadMedia } from '../../services/acquisitionApi';

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_META = {
  customer_acquisition:  { Icon: Users,     color: 'indigo', label: 'Get Customers',    desc: 'Capture and nurture potential customers' },
  talent_acquisition:    { Icon: UserCheck, color: 'violet', label: 'Hire Talent',      desc: 'Recruit and screen job applicants' },
  franchise_development: { Icon: Building2, color: 'amber',  label: 'Grow Franchise',   desc: 'Find and qualify franchise partners' },
  vendor_sourcing:       { Icon: Package,   color: 'teal',   label: 'Source Vendors',   desc: 'Onboard suppliers and partners' },
  partnership_outreach:  { Icon: Handshake, color: 'rose',   label: 'Build Partnerships', desc: 'Business development and alliances' },
  general_lead_gen:      { Icon: Target,    color: 'sky',    label: 'Generate Leads',   desc: 'All-purpose lead collection' },
};

const COLOR_CLASSES = {
  indigo: { bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', activeBg: 'bg-indigo-500/25', activeBorder: 'border-indigo-400', icon: 'text-indigo-400' },
  violet: { bg: 'bg-violet-500/15', border: 'border-violet-500/30', activeBg: 'bg-violet-500/25', activeBorder: 'border-violet-400', icon: 'text-violet-400' },
  amber:  { bg: 'bg-amber-500/15',  border: 'border-amber-500/30',  activeBg: 'bg-amber-500/25',  activeBorder: 'border-amber-400',  icon: 'text-amber-400'  },
  teal:   { bg: 'bg-teal-500/15',   border: 'border-teal-500/30',   activeBg: 'bg-teal-500/25',   activeBorder: 'border-teal-400',   icon: 'text-teal-400'   },
  rose:   { bg: 'bg-rose-500/15',   border: 'border-rose-500/30',   activeBg: 'bg-rose-500/25',   activeBorder: 'border-rose-400',   icon: 'text-rose-400'   },
  sky:    { bg: 'bg-sky-500/15',    border: 'border-sky-500/30',    activeBg: 'bg-sky-500/25',    activeBorder: 'border-sky-400',    icon: 'text-sky-400'    },
};

const CPL_BENCHMARKS = {
  customer_acquisition:  { min: 150,  max: 300  },
  talent_acquisition:    { min: 300,  max: 500  },
  franchise_development: { min: 500,  max: 1200 },
  vendor_sourcing:       { min: 200,  max: 400  },
  partnership_outreach:  { min: 400,  max: 800  },
  general_lead_gen:      { min: 100,  max: 250  },
};

const LOCATION_CHIPS = ['Pan India', 'Mumbai', 'Delhi NCR', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata'];

const FIELD_OPTIONS = [
  { id: 'fullname', label: 'Full Name',       type: 'text',     required: true,  locked: true  },
  { id: 'phone',    label: 'Phone Number',    type: 'phone',    required: true,  locked: true  },
  { id: 'email',    label: 'Email Address',   type: 'email',    required: false, locked: false },
  { id: 'business', label: 'Business Name',   type: 'text',     required: false, locked: false },
  { id: 'city',     label: 'City / Location', type: 'text',     required: false, locked: false },
  { id: 'message',  label: 'Tell us more',    type: 'textarea', required: false, locked: false },
];

const CHANNEL_OPTIONS = [
  { value: 'web_form',  label: 'Web Form',     Icon: Globe,         desc: 'Embed on your website' },
  { value: 'whatsapp',  label: 'WhatsApp',     Icon: MessageSquare, desc: 'WhatsApp flow messages' },
  { value: 'instagram', label: 'Instagram',    Icon: Instagram,     desc: 'Instagram lead ads' },
  { value: 'manual',    label: 'Manual Entry', Icon: Check,         desc: 'Staff-entered leads' },
];

const POWER_LABELS = ['Getting Started', 'Taking Shape', 'Taking Shape', 'Looking Good', 'Looking Good', 'Almost Ready', 'Almost Ready', 'Campaign Pro'];

const IG_FORMATS = [
  { value: 'reel',  label: 'Reel',  desc: 'Short video · best for discovery & reach' },
  { value: 'story', label: 'Story', desc: 'Full-screen · best for warm audiences' },
  { value: 'feed',  label: 'Feed',  desc: 'Static or carousel · familiar & low-friction' },
];

const WA_FORMATS = [
  { value: 'ctwa', label: 'Click-to-WhatsApp', desc: 'Ad on FB/IG opens a WhatsApp chat' },
  { value: 'flow', label: 'WhatsApp Flow',     desc: 'Structured form inside WhatsApp' },
];

const BOT_QUESTIONS = [
  "Hey! What are you trying to achieve with this campaign? 🎯",
  "Love it! What do you want to call this campaign?",
  "Got it. Who are you targeting? Let me know your ideal audience.",
  "Great! What information do you need from your leads?",
  "Nice! Write a short headline for your campaign.",
  "Almost there — where will this campaign run?",
  "Last step — set your budget and we'll estimate your reach! 🚀",
];

const MILESTONES = {
  3: { emoji: '🌱', title: 'Halfway there!',  sub: "You're building something great" },
  6: { emoji: '🔥', title: 'Almost ready!',   sub: 'Just the budget to go' },
  7: { emoji: '🎉', title: 'Campaign ready!', sub: "Let's review and launch" },
};

// ── ProgressRing ─────────────────────────────────────────────────────────────

function ProgressRing({ progress, size = 72 }) {
  const sw = 5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <defs>
        <linearGradient id="prog-ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#prog-ring-grad)" strokeWidth={sw}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

// ── Chat bubbles ─────────────────────────────────────────────────────────────

function BotBubble({ children, fresh }) {
  return (
    <div className={`flex items-start gap-3 ${fresh ? 'animate-chat-in' : ''}`}>
      <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles size={14} className="text-indigo-400" />
      </div>
      <div className="bg-[#1C1F2A] border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs text-sm text-gray-200 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function UserBubble({ children }) {
  return (
    <div className="flex justify-end animate-chat-in">
      <div className="bg-indigo-600/30 border border-indigo-500/20 rounded-2xl rounded-tr-sm px-4 py-3 max-w-xs text-sm text-indigo-100 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

// ── Milestone toast ──────────────────────────────────────────────────────────

function MilestoneToast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-[#1C1F2A] border border-indigo-500/40 rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-2xl animate-chat-in">
      <span className="text-2xl">{msg.emoji}</span>
      <div>
        <div className="text-white text-sm font-semibold">{msg.title}</div>
        <div className="text-gray-400 text-xs">{msg.sub}</div>
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export default function CampaignChat() {
  const navigate = useNavigate();
  const chatEndRef = useRef(null);
  const nameInputRef = useRef(null);
  const headlineInputRef = useRef(null);
  const aiThemeRef = useRef(null);
  const igFileRef = useRef(null);

  const [campaignTypes, setCampaignTypes] = useState([]);
  const [step, setStep] = useState(0);
  const [chatLog, setChatLog] = useState([{ role: 'bot', content: BOT_QUESTIONS[0], id: 'q0', fresh: false }]);
  const [milestone, setMilestone] = useState(null);
  const [phase, setPhase] = useState('chat'); // 'chat' | 'review'
  const [saving, setSaving] = useState(false);

  // Draft
  const [selectedTypeKey, setSelectedTypeKey] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [name, setName] = useState('');
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(45);
  const [locations, setLocations] = useState([]);
  const [customLocation, setCustomLocation] = useState('');
  const [selectedFields, setSelectedFields] = useState(['fullname', 'phone']);
  const [headline, setHeadline] = useState('');
  const [channels, setChannels] = useState(['web_form']);
  const [instagramFormat, setInstagramFormat] = useState('reel'); // 'story' | 'reel' | 'feed'
  const [whatsappFormat, setWhatsappFormat] = useState('ctwa');   // 'ctwa' | 'flow'

  // Instagram asset picker
  const [igAssetMode, setIgAssetMode] = useState('library');     // 'library' | 'upload'
  const [igPosts, setIgPosts] = useState([]);
  const [igPostsLoading, setIgPostsLoading] = useState(false);
  const [igSelectedPostId, setIgSelectedPostId] = useState(null);
  const [igUploadFile, setIgUploadFile] = useState(null);
  const [igUploading, setIgUploading] = useState(false);
  const [igUploadedAssetId, setIgUploadedAssetId] = useState(null);
  const [dailyBudget, setDailyBudget] = useState(2000);
  const [startNow, setStartNow] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [runIndefinitely, setRunIndefinitely] = useState(true);
  const [endDate, setEndDate] = useState('');

  // AI Assist (step 4)
  const [aiAssistOpen, setAiAssistOpen] = useState(false);
  const [aiTheme, setAiTheme] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiError, setAiError] = useState('');

  // Derived
  const score = step; // steps completed = score (0–7)
  const progress = Math.round((score / 7) * 100);
  const cpl = CPL_BENCHMARKS[selectedTypeKey] || { min: 200, max: 400 };
  const monthlyBudget = dailyBudget * 30;
  const leadsMin = Math.max(1, Math.floor(monthlyBudget / cpl.max));
  const leadsMax = Math.max(2, Math.floor(monthlyBudget / cpl.min));
  const reachMin = leadsMin * 8;
  const reachMax = leadsMax * 12;
  const typeEntry = TYPE_META[selectedTypeKey] || null;
  const typeColor = typeEntry ? COLOR_CLASSES[typeEntry.color] : null;

  useEffect(() => {
    getCampaignTypes().then(setCampaignTypes).catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  useEffect(() => {
    if (!channels.includes('instagram')) return;
    setIgSelectedPostId(null);
    setIgUploadFile(null);
    setIgUploadedAssetId(null);
    setIgPostsLoading(true);
    getPosts({ kind: instagramFormat })
      .then(data => setIgPosts(Array.isArray(data) ? data : (data?.items ?? [])))
      .catch(() => setIgPosts([]))
      .finally(() => setIgPostsLoading(false));
  }, [channels, instagramFormat]); // eslint-disable-line react-hooks/exhaustive-deps

  function pushMsg(role, content) {
    setChatLog(prev => [...prev, { role, content, id: `${role}-${Date.now()}`, fresh: true }]);
  }

  function advance(nextStep, userAnswer) {
    if (userAnswer) pushMsg('user', userAnswer);
    setTimeout(() => {
      pushMsg('bot', BOT_QUESTIONS[nextStep]);
      setStep(nextStep);
      if (MILESTONES[nextStep]) setMilestone(MILESTONES[nextStep]);
    }, 380);
  }

  // ── Instagram asset helpers ──────────────────────────────────────────────

  const IG_KIND_ICON = { reel: Film, story: AlignLeft, feed: Image };
  const IG_KIND_HINT = {
    reel:  'MP4/MOV · max 1 GB · 15–90 s · 9:16',
    story: 'JPEG/PNG or MP4/MOV · max 100 MB · 9:16',
    feed:  'JPEG/PNG/WebP · max 8 MB or MP4/MOV · max 100 MB',
  };

  async function handleIgUpload(file) {
    if (!file) return;
    setIgUploadFile(file);
    setIgUploading(true);
    setIgUploadedAssetId(null);
    try {
      const asset = await uploadMedia(file, { kind: instagramFormat });
      setIgUploadedAssetId(asset.id);
      setIgSelectedPostId(null);
    } catch {
      setIgUploadFile(null);
    } finally {
      setIgUploading(false);
    }
  }

  // ── Step handlers ────────────────────────────────────────────────────────

  function handleTypeSelect(typeKey, typeId) {
    setSelectedTypeKey(typeKey);
    setSelectedTypeId(typeId);
    advance(1, TYPE_META[typeKey]?.label || typeKey);
    setTimeout(() => nameInputRef.current?.focus(), 820);
  }

  function handleNameSubmit() {
    if (!name.trim()) return;
    advance(2, name.trim());
  }

  function toggleLocation(loc) {
    setLocations(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]);
  }

  function handleAudienceConfirm() {
    const locs = [...locations, customLocation].filter(Boolean);
    const answer = `${ageMin}–${ageMax} yrs${locs.length ? ' · ' + locs.slice(0, 2).join(', ') + (locs.length > 2 ? ` +${locs.length - 2}` : '') : ''}`;
    advance(3, answer);
  }

  function toggleField(id) {
    if (FIELD_OPTIONS.find(f => f.id === id)?.locked) return;
    setSelectedFields(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  }

  function handleFieldsConfirm() {
    const labels = FIELD_OPTIONS.filter(f => selectedFields.includes(f.id)).map(f => f.label).join(', ');
    advance(4, labels);
    setTimeout(() => headlineInputRef.current?.focus(), 820);
  }

  function handleHeadlineSubmit() {
    if (!headline.trim()) return;
    advance(5, headline.trim());
  }

  async function handleAiAssist() {
    if (!aiTheme.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiSuggestions([]);
    const allLocations = [...locations, customLocation].filter(Boolean);
    try {
      const res = await generateHeadline({
        theme: aiTheme.trim(),
        campaign_type: selectedTypeKey || 'general_lead_gen',
        audience: allLocations.length ? allLocations.slice(0, 2).join(', ') : undefined,
      });
      setAiSuggestions(res.headlines || []);
    } catch {
      setAiError('Generation failed — please try again.');
    } finally {
      setAiLoading(false);
    }
  }

  function toggleChannel(val) {
    setChannels(prev => prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]);
  }

  function handleChannelsConfirm() {
    if (!channels.length) return;
    const labels = CHANNEL_OPTIONS.filter(c => channels.includes(c.value)).map(c => {
      if (c.value === 'instagram') return `Instagram ${IG_FORMATS.find(f => f.value === instagramFormat)?.label || ''}`;
      if (c.value === 'whatsapp')  return `WhatsApp ${WA_FORMATS.find(f => f.value === whatsappFormat)?.label || ''}`;
      return c.label;
    }).join(', ');
    advance(6, labels);
  }

  function handleBudgetConfirm() {
    const answer = `₹${dailyBudget.toLocaleString('en-IN')}/day · ${startNow ? 'Starts now' : startDate || 'Scheduled'}`;
    pushMsg('user', answer);
    setStep(7);
    setMilestone(MILESTONES[7]);
    setTimeout(() => setPhase('review'), 600);
  }

  // ── Save / launch ────────────────────────────────────────────────────────

  async function handleSave(launch) {
    setSaving(true);
    try {
      const formFields = FIELD_OPTIONS
        .filter(f => selectedFields.includes(f.id))
        .map(({ id, label, type, required }) => ({ id, label, type, required, placeholder: '', options: [] }));

      const allLocations = [...locations, customLocation].filter(Boolean);

      const payload = {
        name: name.trim(),
        campaign_type_id: selectedTypeId,
        retention_class: 'standard',
        disclosure_footer: '',
        form_fields: formFields,
        submit_action_kind: 'save_submission',
        submit_action_url: '',
        audience_countries: allLocations.join(', '),
        audience_age_min: ageMin,
        audience_age_max: ageMax,
        audience_lookalike: 2,
        audience_segment_tags: '',
        channels,
        start_at: startNow ? '' : startDate,
        end_at: runIndefinitely ? '' : endDate,
        daily_cap: '',
        total_cap: '',
        qualification_threshold: 40,
        stages: [
          { key: 'new',       label: 'New',       is_initial: true },
          { key: 'engaging',  label: 'Engaging',  sla_hours: 24 },
          { key: 'qualified', label: 'Qualified', promotion_eligible: true, sla_hours: 48 },
          { key: 'converted', label: 'Converted', is_terminal: true, outcome: 'won' },
          { key: 'lost',      label: 'Lost',      is_terminal: true, outcome: 'lost' },
        ],
      };

      const created = await createCampaign(payload);
      if (launch) await activateCampaign(created.id);
      navigate(`/acquisition/campaigns`);
    } catch {
      setSaving(false);
    }
  }

  // ── Step input renderer ──────────────────────────────────────────────────

  function renderInput() {
    switch (step) {
      case 0:
        return (
          <div className="grid grid-cols-2 gap-2 p-4">
            {Object.entries(TYPE_META).map(([key, meta]) => {
              const typeObj = campaignTypes.find(t => t.key === key);
              const cc = COLOR_CLASSES[meta.color];
              return (
                <button
                  key={key}
                  onClick={() => handleTypeSelect(key, typeObj?.id || key)}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all text-left ${cc.bg} ${cc.border} hover:${cc.activeBg} hover:${cc.activeBorder}`}
                >
                  <meta.Icon size={16} className={`${cc.icon} flex-shrink-0 mt-0.5`} />
                  <div>
                    <div className="text-white text-xs font-semibold leading-tight">{meta.label}</div>
                    <div className="text-gray-500 text-xs mt-0.5 line-clamp-1">{meta.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        );

      case 1:
        return (
          <div className="p-4 flex gap-2">
            <input
              ref={nameInputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
              placeholder={typeEntry ? `e.g. ${typeEntry.label} Q3 2026` : 'Campaign name…'}
              className="flex-1 bg-[#1C1F2A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 transition-colors"
            />
            <button
              onClick={handleNameSubmit}
              disabled={!name.trim()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors flex items-center"
            >
              <Send size={14} />
            </button>
          </div>
        );

      case 2:
        return (
          <div className="p-4 space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-500">Age Range</span>
                <span className="text-xs text-white font-medium">{ageMin} – {ageMax} years</span>
              </div>
              <div className="relative flex items-center h-4">
                <div className="absolute w-full h-1 bg-white/10 rounded-full" />
                <div
                  className="absolute h-1 bg-indigo-500 rounded-full pointer-events-none"
                  style={{
                    left: `${((ageMin - 18) / (65 - 18)) * 100}%`,
                    right: `${100 - ((ageMax - 18) / (65 - 18)) * 100}%`,
                  }}
                />
                <input type="range" min={18} max={65} value={ageMin}
                  onChange={e => setAgeMin(Math.min(+e.target.value, ageMax - 1))}
                  className="absolute w-full appearance-none bg-transparent cursor-pointer" style={{ zIndex: 2 }} />
                <input type="range" min={18} max={65} value={ageMax}
                  onChange={e => setAgeMax(Math.max(+e.target.value, ageMin + 1))}
                  className="absolute w-full appearance-none bg-transparent cursor-pointer" style={{ zIndex: 3 }} />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-2">Location</div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {LOCATION_CHIPS.map(loc => (
                  <button
                    key={loc}
                    onClick={() => toggleLocation(loc)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                      locations.includes(loc)
                        ? 'bg-indigo-600/25 border-indigo-500/50 text-indigo-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
              <input
                value={customLocation}
                onChange={e => setCustomLocation(e.target.value)}
                placeholder="Or type a custom location…"
                className="w-full bg-[#1C1F2A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 transition-colors"
              />
            </div>
            <button
              onClick={handleAudienceConfirm}
              disabled={!locations.length && !customLocation.trim()}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              Confirm Audience
            </button>
          </div>
        );

      case 3:
        return (
          <div className="p-4 space-y-1.5">
            {FIELD_OPTIONS.map(f => (
              <label
                key={f.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  f.locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-white/20'
                } ${
                  selectedFields.includes(f.id)
                    ? 'bg-indigo-600/15 border-indigo-500/30 text-indigo-100'
                    : 'bg-white/4 border-white/8 text-gray-400'
                }`}
              >
                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                  selectedFields.includes(f.id) ? 'bg-indigo-600 border-indigo-500' : 'border-white/20'
                }`}>
                  {selectedFields.includes(f.id) && <Check size={10} className="text-white" />}
                </div>
                <input type="checkbox" checked={selectedFields.includes(f.id)} onChange={() => toggleField(f.id)} disabled={f.locked} className="sr-only" />
                <span className="text-sm flex-1">{f.label}</span>
                {f.locked && <span className="text-xs text-gray-600">required</span>}
              </label>
            ))}
            <button
              onClick={handleFieldsConfirm}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors mt-2"
            >
              Use These Fields
            </button>
          </div>
        );

      case 4:
        return (
          <div className="p-4 space-y-3">
            {/* Main input row */}
            <div className="flex gap-2">
              <input
                ref={headlineInputRef}
                value={headline}
                onChange={e => setHeadline(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleHeadlineSubmit()}
                placeholder="e.g. Join Mumbai's #1 Restaurant Group"
                className="flex-1 bg-[#1C1F2A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 transition-colors"
              />
              <button
                onClick={handleHeadlineSubmit}
                disabled={!headline.trim()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors flex items-center"
              >
                <Send size={14} />
              </button>
            </div>

            {/* AI Assist toggle */}
            {!aiAssistOpen && (
              <button
                onClick={() => { setAiAssistOpen(true); setTimeout(() => aiThemeRef.current?.focus(), 80); }}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <Sparkles size={12} />
                AI Assist — let me write it for you
              </button>
            )}

            {/* AI Assist panel */}
            {aiAssistOpen && (
              <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-xl p-3 space-y-2.5 animate-chat-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-medium">
                    <Sparkles size={12} />
                    AI Headline Writer
                  </div>
                  <button
                    onClick={() => { setAiAssistOpen(false); setAiSuggestions([]); setAiError(''); }}
                    className="text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    ref={aiThemeRef}
                    value={aiTheme}
                    onChange={e => setAiTheme(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !aiLoading && handleAiAssist()}
                    placeholder="What's the main offer or theme? e.g. 20% off first month"
                    className="flex-1 bg-[#1C1F2A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                  <button
                    onClick={handleAiAssist}
                    disabled={!aiTheme.trim() || aiLoading}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-colors flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
                  >
                    {aiLoading ? (
                      <>
                        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Writing…
                      </>
                    ) : (
                      <><Sparkles size={12} /> Generate</>
                    )}
                  </button>
                </div>

                {aiError && (
                  <p className="text-xs text-red-400">{aiError}</p>
                )}

                {aiSuggestions.length > 0 && (
                  <div className="space-y-1.5 animate-chat-in">
                    <div className="text-xs text-gray-500">Tap to use →</div>
                    {aiSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setHeadline(s);
                          setAiAssistOpen(false);
                          setAiSuggestions([]);
                          setAiTheme('');
                          headlineInputRef.current?.focus();
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-lg bg-white/5 border border-white/8 hover:bg-indigo-600/15 hover:border-indigo-500/30 text-sm text-gray-200 hover:text-indigo-100 transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="p-4 space-y-2">
            {CHANNEL_OPTIONS.map(ch => {
              const active = channels.includes(ch.value);
              return (
                <div key={ch.value}>
                  <button
                    onClick={() => toggleChannel(ch.value)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      active ? 'bg-indigo-600/15 border-indigo-500/30' : 'bg-white/4 border-white/8 hover:border-white/20'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-indigo-600/40' : 'bg-white/8'}`}>
                      <ch.Icon size={14} className={active ? 'text-indigo-300' : 'text-gray-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${active ? 'text-indigo-100' : 'text-gray-300'}`}>{ch.label}</div>
                      <div className="text-xs text-gray-600">{ch.desc}</div>
                    </div>
                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${active ? 'bg-indigo-600 border-indigo-500' : 'border-white/20'}`}>
                      {active && <Check size={10} className="text-white" />}
                    </div>
                  </button>

                  {/* Instagram format picker + asset picker */}
                  {ch.value === 'instagram' && active && (
                    <div className="mt-1.5 ml-3 pl-3 border-l border-indigo-500/20 space-y-3 animate-chat-in">
                      {/* Format */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1.5">Ad format</div>
                        <div className="space-y-1">
                          {IG_FORMATS.map(fmt => (
                            <button
                              key={fmt.value}
                              onClick={() => setInstagramFormat(fmt.value)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all ${
                                instagramFormat === fmt.value
                                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                                  : 'bg-white/3 border-white/6 text-gray-400 hover:border-white/16'
                              }`}
                            >
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${instagramFormat === fmt.value ? 'bg-indigo-400' : 'bg-white/20'}`} />
                              <span className="text-xs font-medium">{fmt.label}</span>
                              <span className="text-xs text-gray-600 ml-1">{fmt.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Asset picker */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1.5">Creative asset</div>
                        {/* Mode tabs */}
                        <div className="flex gap-1 mb-2">
                          {[{ v: 'library', label: 'Content Studio' }, { v: 'upload', label: 'Upload New' }].map(({ v, label }) => (
                            <button
                              key={v}
                              onClick={() => setIgAssetMode(v)}
                              className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                igAssetMode === v
                                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                                  : 'bg-white/3 border-white/6 text-gray-500 hover:border-white/16'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        {/* Library mode */}
                        {igAssetMode === 'library' && (
                          igPostsLoading ? (
                            <div className="flex items-center justify-center py-6 text-gray-600 text-xs gap-2">
                              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                              Loading…
                            </div>
                          ) : igPosts.length === 0 ? (
                            <div className="text-center py-5 text-xs text-gray-600">
                              No {instagramFormat}s in Content Studio yet.
                              <button
                                onClick={() => setIgAssetMode('upload')}
                                className="block mx-auto mt-1.5 text-indigo-400 hover:text-indigo-300 transition-colors"
                              >
                                Upload one instead →
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                              {igPosts.map(post => {
                                const KindIcon = IG_KIND_ICON[post.kind] || Film;
                                const selected = igSelectedPostId === post.id;
                                return (
                                  <button
                                    key={post.id}
                                    onClick={() => { setIgSelectedPostId(selected ? null : post.id); setIgUploadedAssetId(null); setIgUploadFile(null); }}
                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                                      selected
                                        ? 'bg-indigo-600/20 border-indigo-500/40'
                                        : 'bg-white/3 border-white/6 hover:border-white/16'
                                    }`}
                                  >
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${selected ? 'bg-indigo-600/40' : 'bg-white/8'}`}>
                                      <KindIcon size={13} className={selected ? 'text-indigo-300' : 'text-gray-500'} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className={`text-xs font-medium truncate ${selected ? 'text-indigo-100' : 'text-gray-300'}`}>
                                        {post.caption ? post.caption.slice(0, 48) + (post.caption.length > 48 ? '…' : '') : `${post.kind} post`}
                                      </div>
                                      <div className="text-xs text-gray-600">{post.status}</div>
                                    </div>
                                    {selected && <Check size={13} className="text-indigo-400 flex-shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          )
                        )}

                        {/* Upload mode */}
                        {igAssetMode === 'upload' && (
                          <div>
                            <input
                              ref={igFileRef}
                              type="file"
                              accept={instagramFormat === 'reel' ? 'video/*' : 'image/*,video/*'}
                              className="sr-only"
                              onChange={e => handleIgUpload(e.target.files?.[0])}
                            />
                            {igUploadFile ? (
                              <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${igUploading ? 'border-indigo-500/30 bg-indigo-600/10' : igUploadedAssetId ? 'border-emerald-500/30 bg-emerald-600/10' : 'border-white/8 bg-white/3'}`}>
                                {igUploading ? (
                                  <svg className="animate-spin w-4 h-4 text-indigo-400 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                  </svg>
                                ) : igUploadedAssetId ? (
                                  <Check size={15} className="text-emerald-400 flex-shrink-0" />
                                ) : null}
                                <span className="text-xs text-gray-300 truncate flex-1">{igUploadFile.name}</span>
                                <button onClick={() => { setIgUploadFile(null); setIgUploadedAssetId(null); }} className="text-gray-600 hover:text-gray-400 flex-shrink-0">
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => igFileRef.current?.click()}
                                className="w-full flex flex-col items-center gap-2 py-5 rounded-lg border border-dashed border-white/12 hover:border-indigo-500/30 hover:bg-indigo-600/5 transition-all text-center"
                              >
                                <Upload size={18} className="text-gray-600" />
                                <div>
                                  <div className="text-xs text-gray-400 font-medium">Click to browse</div>
                                  <div className="text-xs text-gray-700 mt-0.5">{IG_KIND_HINT[instagramFormat]}</div>
                                </div>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* WhatsApp format picker + approval callout */}
                  {ch.value === 'whatsapp' && active && (
                    <div className="mt-1.5 ml-3 pl-3 border-l border-indigo-500/20 space-y-1.5 animate-chat-in">
                      <div className="text-xs text-gray-500 mb-1.5">Message type</div>
                      {WA_FORMATS.map(fmt => (
                        <button
                          key={fmt.value}
                          onClick={() => setWhatsappFormat(fmt.value)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all ${
                            whatsappFormat === fmt.value
                              ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-200'
                              : 'bg-white/3 border-white/6 text-gray-400 hover:border-white/16'
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${whatsappFormat === fmt.value ? 'bg-indigo-400' : 'bg-white/20'}`} />
                          <div>
                            <span className="text-xs font-medium">{fmt.label}</span>
                            <span className="text-xs text-gray-600 ml-2">{fmt.desc}</span>
                          </div>
                        </button>
                      ))}
                      <div className="flex items-start gap-2 mt-2 px-3 py-2.5 rounded-lg bg-amber-500/8 border border-amber-500/20">
                        <span className="text-amber-400 text-sm leading-none mt-0.5">⚠</span>
                        <p className="text-xs text-amber-300/80 leading-snug">
                          WhatsApp message templates require Meta approval — allow <span className="font-medium text-amber-300">48–72 hours</span> before your campaign can go live.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <button
              onClick={handleChannelsConfirm}
              disabled={!channels.length}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium transition-colors mt-2"
            >
              Set Channels
            </button>
          </div>
        );

      case 6:
        return (
          <div className="p-4 space-y-5">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-500">Daily Budget</span>
                <span className="text-sm font-semibold text-white">₹{dailyBudget.toLocaleString('en-IN')}/day</span>
              </div>
              <input
                type="range" min={500} max={25000} step={500}
                value={dailyBudget}
                onChange={e => setDailyBudget(+e.target.value)}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>₹500</span><span>₹25,000</span>
              </div>
              <div className="mt-3 flex gap-3">
                <div className="flex-1 bg-[#1C1F2A] rounded-xl p-3 border border-white/8 text-center">
                  <div className="text-xs text-gray-500 mb-0.5">Est. leads/mo</div>
                  <div className="text-sm font-semibold text-emerald-400">{leadsMin}–{leadsMax}</div>
                </div>
                <div className="flex-1 bg-[#1C1F2A] rounded-xl p-3 border border-white/8 text-center">
                  <div className="text-xs text-gray-500 mb-0.5">Monthly spend</div>
                  <div className="text-sm font-semibold text-white">₹{monthlyBudget.toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-2">Start Date</div>
              <div className="flex gap-2">
                {[{ v: true, label: 'Start Now' }, { v: false, label: 'Schedule' }].map(({ v, label }) => (
                  <button
                    key={label}
                    onClick={() => setStartNow(v)}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                      startNow === v
                        ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-white/4 border-white/8 text-gray-500 hover:border-white/20'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {!startNow && (
                <input
                  type="date" value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full mt-2 bg-[#1C1F2A] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors"
                />
              )}
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-2">Duration</div>
              <div className="flex gap-2">
                {[{ v: true, label: 'Run Indefinitely' }, { v: false, label: 'Set End Date' }].map(({ v, label }) => (
                  <button
                    key={label}
                    onClick={() => setRunIndefinitely(v)}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                      runIndefinitely === v
                        ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-white/4 border-white/8 text-gray-500 hover:border-white/20'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {!runIndefinitely && (
                <input
                  type="date" value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full mt-2 bg-[#1C1F2A] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-colors"
                />
              )}
            </div>

            <button
              onClick={handleBudgetConfirm}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Rocket size={14} />
              Preview Campaign
            </button>
          </div>
        );

      default:
        return null;
    }
  }

  // ── Right panel ──────────────────────────────────────────────────────────

  function renderRightPanel() {
    return (
      <div className="space-y-4">
        {/* Progress card */}
        <div className="bg-[#13161D] rounded-2xl border border-white/8 p-5">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <ProgressRing progress={progress} size={72} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-base font-bold text-white">{progress}%</span>
              </div>
            </div>
            <div>
              <div className="text-white font-semibold text-sm">{POWER_LABELS[score]}</div>
              <div className="text-gray-500 text-xs mt-0.5">{score} of 7 steps done</div>
              <div className="flex gap-1 mt-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i < score ? 'bg-indigo-500' : 'bg-white/10'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live campaign preview */}
        <div className="bg-[#13161D] rounded-2xl border border-white/8 p-5">
          <div className="text-xs text-gray-600 mb-3 font-medium uppercase tracking-wider">Campaign Preview</div>
          <h3 className={`font-semibold text-sm leading-snug mb-3 ${name ? 'text-white' : 'text-gray-700'}`}>
            {name || 'Campaign name will appear here…'}
          </h3>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selectedTypeKey && typeColor && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColor.bg} ${typeColor.icon}`}>
                {TYPE_META[selectedTypeKey].label}
              </span>
            )}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
              Draft
            </span>
          </div>
          {headline && (
            <p className="text-xs text-gray-400 italic mb-3 line-clamp-2">"{headline}"</p>
          )}
          <div className="space-y-1.5">
            {locations.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <MapPin size={11} className="flex-shrink-0" />
                <span>{locations.slice(0, 2).join(', ')}{locations.length > 2 ? ` +${locations.length - 2}` : ''}</span>
              </div>
            )}
            {channels.length > 0 && step >= 6 && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Globe size={11} className="flex-shrink-0" />
                <span>{channels.map(c => CHANNEL_OPTIONS.find(o => o.value === c)?.label).filter(Boolean).join(', ')}</span>
              </div>
            )}
            {step >= 6 && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <TrendingUp size={11} className="flex-shrink-0" />
                <span>₹{dailyBudget.toLocaleString('en-IN')}/day · ~{leadsMin}–{leadsMax} leads/mo</span>
              </div>
            )}
          </div>
        </div>

        {/* Reach estimator (step 6+) */}
        {step >= 6 && (
          <div className="bg-[#13161D] rounded-2xl border border-white/8 p-5">
            <div className="text-xs text-gray-600 mb-3 font-medium uppercase tracking-wider">Monthly Estimate</div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">People reached</span>
                <span className="text-sm font-semibold text-white">{reachMin.toLocaleString('en-IN')}–{reachMax.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Estimated leads</span>
                <span className="text-sm font-semibold text-emerald-400">{leadsMin}–{leadsMax}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Monthly spend</span>
                <span className="text-sm font-semibold text-white">₹{monthlyBudget.toLocaleString('en-IN')}</span>
              </div>
              <div className="pt-2 border-t border-white/5 text-xs text-gray-700">* Based on industry benchmarks</div>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/acquisition/campaigns/new/advanced')}
          className="w-full py-2.5 rounded-xl border border-white/8 text-gray-600 text-xs hover:text-gray-300 hover:border-white/16 transition-colors"
        >
          Switch to Advanced Mode →
        </button>
      </div>
    );
  }

  // ── Review phase ─────────────────────────────────────────────────────────

  if (phase === 'review') {
    const allLocations = [...locations, customLocation].filter(Boolean);
    const summaryRows = [
      { label: 'Campaign Type',      value: TYPE_META[selectedTypeKey]?.label },
      { label: 'Audience',           value: `${ageMin}–${ageMax} years${allLocations.length ? ' · ' + allLocations.join(', ') : ''}` },
      { label: 'Form Fields',        value: FIELD_OPTIONS.filter(f => selectedFields.includes(f.id)).map(f => f.label).join(', ') },
      { label: 'Channels', value: CHANNEL_OPTIONS.filter(c => channels.includes(c.value)).map(c => {
        if (c.value === 'instagram') return `Instagram · ${IG_FORMATS.find(f => f.value === instagramFormat)?.label}`;
        if (c.value === 'whatsapp')  return `WhatsApp · ${WA_FORMATS.find(f => f.value === whatsappFormat)?.label}`;
        return c.label;
      }).join(', ') },
      { label: 'Daily Budget',       value: `₹${dailyBudget.toLocaleString('en-IN')}` },
      { label: 'Est. Monthly Leads', value: `${leadsMin}–${leadsMax} leads` },
      { label: 'Start',              value: startNow ? 'Immediately' : (startDate || 'TBD') },
    ];

    return (
      <div className="min-h-screen bg-[#0E1117] flex flex-col">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/8 flex-shrink-0">
          <button onClick={() => setPhase('chat')} className="text-gray-500 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-white font-semibold">Review Campaign</h1>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
            <Check size={13} />
            Ready to launch
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-lg mx-auto space-y-5">
            <div className="bg-gradient-to-br from-indigo-600/20 to-violet-600/10 rounded-2xl border border-indigo-500/20 p-6 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-xl font-bold text-white mb-1">{name}</h2>
              <p className="text-gray-400 text-sm">"{headline}"</p>
            </div>

            <div className="bg-[#13161D] rounded-2xl border border-white/8 divide-y divide-white/5">
              {summaryRows.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
                  <span className="text-sm text-white font-medium text-right ml-4 line-clamp-1">{value || '—'}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:border-white/20 hover:text-white transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Rocket size={15} />
                {saving ? 'Launching…' : 'Launch Campaign'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat UI ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0E1117] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/8 flex-shrink-0">
        <button onClick={() => navigate('/acquisition/campaigns')} className="text-gray-500 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-white font-semibold text-sm">Campaign Builder</h1>
          <p className="text-gray-600 text-xs">Guided setup · ~2 min</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Zap size={12} className="text-indigo-400" />
          <span className="text-xs text-gray-500">{POWER_LABELS[score]}</span>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat column */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
            {chatLog.map(({ role, content, id, fresh }) =>
              role === 'bot'
                ? <BotBubble key={id} fresh={fresh}>{content}</BotBubble>
                : <UserBubble key={id}>{content}</UserBubble>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="flex-shrink-0 border-t border-white/6 bg-[#0E1117]">
            {renderInput()}
          </div>
        </div>

        {/* Right panel — desktop only */}
        <div className="hidden lg:block w-72 xl:w-80 flex-shrink-0 border-l border-white/6 overflow-y-auto p-4">
          {renderRightPanel()}
        </div>
      </div>

      {milestone && <MilestoneToast msg={milestone} onDone={() => setMilestone(null)} />}
    </div>
  );
}
