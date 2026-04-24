import React, { useState, useEffect } from 'react';
import { api, getImageUrl } from '../../services/api';
import {
  Palette, Image as ImageIcon, LayoutTemplate, Type, Save, CheckCircle2, Loader2,
  Link as LinkIcon, QrCode, Copy, ExternalLink, ShieldCheck, Smartphone,
  Scissors, Coffee, CalendarCheck, UtensilsCrossed, UserCircle, Phone,
  MessageCircle, ToggleLeft, ToggleRight, Eye, Globe, Lock, LayoutGrid, List, Grid3x3, ChevronsUpDown
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const FONTS = [
  { id: 'Inter', name: 'Inter (Modern & Clean)' },
  { id: 'Playfair Display', name: 'Playfair Display (Elegant)' },
  { id: 'Roboto', name: 'Roboto (Functional)' },
  { id: 'Outfit', name: 'Outfit (Geometric)' },
  { id: 'Merriweather', name: 'Merriweather (Serif)' },
  { id: 'Manrope', name: 'Manrope (Minimalist)' }
];

// ─── Toggle Switch ──────────────────────────────────────────────
const Toggle = ({ enabled, onChange, size = 'md' }) => {
  const w = size === 'sm' ? 'w-9 h-5' : 'w-11 h-6';
  const dot = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5';
  const off = size === 'sm' ? 'left-0.5' : 'left-0.5';
  const on = size === 'sm' ? 'left-[18px]' : 'left-[22px]';
  return (
    <button type="button" onClick={onChange}
      className={`relative ${w} rounded-full transition-all duration-300 ${enabled ? 'bg-teal-500' : 'bg-gray-300 dark:bg-white/10'}`}
    >
      <div className={`absolute top-0.5 ${dot} bg-white rounded-full shadow-sm transition-all duration-300 ${enabled ? on : off}`} />
    </button>
  );
};

// ─── Section Wrapper ────────────────────────────────────────────
const Section = ({ icon: Icon, iconColor = 'text-purple-500', title, subtitle, children, badge }) => (
  <div className="bg-white/90 dark:bg-[#12161C]/90 backdrop-blur-xl border border-gray-200 dark:border-[#1F2630] rounded-2xl p-6 space-y-5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl bg-current/10 ${iconColor}`} style={{ backgroundColor: 'currentColor', opacity: 0.08 }}>
          <Icon size={18} className={iconColor} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-[#E6E8EB]">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 dark:text-[#7D8590] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {badge}
    </div>
    {children}
  </div>
);

// ─── Main Component ─────────────────────────────────────────────
const AdminPortalDesign = () => {
  const { theme } = useTheme();
  const [outlets, setOutlets] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [licensedModules, setLicensedModules] = useState([]);
  const [previewScreen, setPreviewScreen] = useState('portal'); // 'gate' | 'portal'

  // Form State
  const [logoUrl, setLogoUrl] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [colors, setColors] = useState({
    primary: '#1A1A1A',
    secondary: '#F59E0B',
    bgColor: '#FAFAFA',
    surfaceColor: '#FFFFFF',
    textColor: '#1A1A1A'
  });

  // New: Portal config
  const [portalEnabled, setPortalEnabled] = useState(true);
  const [requireIdentity, setRequireIdentity] = useState(true);
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [identityFields, setIdentityFields] = useState([
    { name: 'customer_name', label: 'Full Name', required: true, enabled: true },
    { name: 'customer_phone', label: 'Mobile Number', required: true, enabled: true },
  ]);
  const [menuLayout, setMenuLayout] = useState('classic');
  const [portalType, setPortalType] = useState('order'); // 'order' | 'booking' | 'both'

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [outletsRes, featuresRes] = await Promise.all([
        api.getOutlets(),
        api.getCompanyFeatures().catch(() => ({ data: {} })),
      ]);

      const outletList = outletsRes.data || [];
      setOutlets(outletList);
      setLicensedModules(featuresRes.data?.licensed_modules || []);

      if (outletList.length > 0) {
        const firstActive = outletList.find(o => o.status === 'Active') || outletList[0];
        handleSelectOutlet(firstActive.id, outletList);
      }
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOutlet = (id, outletList = outlets) => {
    setSelectedOutletId(id);
    const outlet = outletList.find(o => o.id === id);
    if (outlet) {
      setLogoUrl(outlet.portal_logo_url || '');
      const config = outlet.portal_color_scheme || {};
      setHeroImageUrl(config.heroImage || '');
      setFontFamily(config.fontFamily || 'Inter');
      setColors({
        primary: config.primary || '#1A1A1A',
        secondary: config.secondary || '#F59E0B',
        bgColor: config.bgColor || '#FAFAFA',
        surfaceColor: config.surfaceColor || '#FFFFFF',
        textColor: config.textColor || '#1A1A1A'
      });
      setPortalEnabled(config.portalEnabled !== false);
      setRequireIdentity(config.requireIdentity !== false);
      setWhatsappOptIn(config.whatsappOptIn !== false);
      if (config.identityFields) setIdentityFields(config.identityFields);
      setMenuLayout(config.menuLayout || 'classic');
      // Default portalType from saved config, or infer from licensed modules
      if (config.portalType) {
        setPortalType(config.portalType);
      } else {
        const hasMenu = licensedModules.includes('restaurant_orders');
        const hasBook = licensedModules.includes('booking');
        setPortalType(hasMenu && hasBook ? 'both' : hasBook ? 'booking' : 'order');
      }
    }
  };

  const handleFileUpload = async (file, type) => {
    if (!file) return;
    try {
      const data = new FormData();
      data.append('files', file);
      const res = await api.uploadFiles(data);
      if (res.data.urls?.length > 0) {
        if (type === 'logo') setLogoUrl(res.data.urls[0]);
        if (type === 'hero') setHeroImageUrl(res.data.urls[0]);
      }
    } catch (error) {
      console.error('Upload failed', error);
      alert('Failed to upload image.');
    }
  };

  const handleSave = async () => {
    if (!selectedOutletId) return;
    setSaving(true);
    try {
      const outlet = outlets.find(o => o.id === selectedOutletId);
      if (!outlet) return;

      const updatedPayload = {
        name: outlet.name,
        city: outlet.city,
        address: outlet.address,
        capacity: outlet.capacity,
        status: outlet.status,
        portal_logo_url: logoUrl,
        portal_custom_colors: true,
        portal_color_scheme: {
          ...colors,
          fontFamily,
          heroImage: heroImageUrl,
          portalEnabled,
          requireIdentity,
          whatsappOptIn,
          identityFields,
          menuLayout,
          portalType,
        }
      };

      await api.updateOutlet(selectedOutletId, updatedPayload);

      setOutlets(outlets.map(o => o.id === selectedOutletId ? {
        ...o,
        portal_logo_url: logoUrl,
        portal_color_scheme: updatedPayload.portal_color_scheme,
        portal_custom_colors: true
      } : o));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const portalPath = portalType === 'booking' ? `/book/${selectedOutletId}`
    : portalType === 'both' ? `/p/${selectedOutletId}`
    : `/menu/${selectedOutletId}`;

  const copyLink = () => {
    const link = `${window.location.protocol}//${window.location.hostname}:3002${portalPath}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Derived
  const portalLink = `${window.location.protocol}//${window.location.hostname}:3002${portalPath}`;
  const isRestaurant = licensedModules.includes('restaurant_orders');
  const isBooking = licensedModules.includes('booking');
  const portalTypeLabel = isRestaurant && isBooking ? 'Menu & Booking Portal'
    : isRestaurant ? 'Menu & Ordering Portal'
    : isBooking ? 'Booking Portal'
    : 'Customer Portal';
  const portalTypeIcon = isRestaurant ? UtensilsCrossed : CalendarCheck;
  const PortalIcon = portalTypeIcon;
  const selectedOutlet = outlets.find(o => o.id === selectedOutletId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-purple-400" />
        <span className="ml-3 text-gray-500 dark:text-gray-400">Loading portal configuration...</span>
      </div>
    );
  }

  if (outlets.length === 0) {
    return <div className="p-8 text-center text-gray-500">Please create an outlet first before designing a portal.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col lg:flex-row gap-6">

        {/* ═══════════════════ EDITOR PANE ═══════════════════ */}
        <div className="flex-1 space-y-5">

          {/* ── Outlet Selector ────────────────────────────── */}
          <div className="bg-white/90 dark:bg-[#12161C]/90 backdrop-blur-xl border border-gray-200 dark:border-[#1F2630] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-[#E6E8EB] flex items-center gap-2">
                <LayoutTemplate size={20} className="text-purple-500" />
                Portal Configuration
              </h2>
              <button
                onClick={handleSave}
                disabled={saving || !selectedOutletId}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold hover:shadow-lg transition-all disabled:opacity-50 text-sm"
              >
                {saving ? <Loader2 size={16} className="animate-spin" />
                  : saveSuccess ? <CheckCircle2 size={16} className="text-green-400" />
                  : <Save size={16} />}
                {saveSuccess ? 'Saved!' : 'Save Design'}
              </button>
            </div>
            <select
              value={selectedOutletId}
              onChange={(e) => handleSelectOutlet(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-[#1F2630] text-gray-900 dark:text-[#E6E8EB] focus:ring-2 focus:ring-purple-500 transition-all font-medium"
            >
              {outlets.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          {/* ── 1. Portal Type Banner ─────────────────────── */}
          <Section
            icon={PortalIcon}
            iconColor={isRestaurant ? 'text-amber-500' : 'text-teal-500'}
            title={portalTypeLabel}
            subtitle="Auto-detected from your account license"
            badge={
              <div className="flex items-center gap-2">
                {isRestaurant && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Coffee size={10} /> Menu
                  </span>
                )}
                {isBooking && (
                  <span className="px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Scissors size={10} /> Booking
                  </span>
                )}
              </div>
            }
          >
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-[#1F2630]">
              <div className="flex items-center gap-3">
                <Globe size={16} className="text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Portal Status</p>
                  <p className="text-[11px] text-gray-500 dark:text-[#7D8590]">
                    {portalEnabled ? 'Customers can access your portal link' : 'Portal is currently disabled'}
                  </p>
                </div>
              </div>
              <Toggle enabled={portalEnabled} onChange={() => setPortalEnabled(!portalEnabled)} />
            </div>
          </Section>

          {/* ── 2. Portal Type Selector ───────────────────── */}
          <Section
            icon={LayoutGrid}
            iconColor="text-indigo-500"
            title="Portal Type"
            subtitle="Choose what your customers can do on the portal"
          >
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'order', icon: UtensilsCrossed, label: 'Order', desc: 'Menu & cart', color: 'amber', show: isRestaurant || (!isRestaurant && !isBooking) },
                { id: 'booking', icon: CalendarCheck, label: 'Booking', desc: 'Appointments', color: 'teal', show: isBooking || (!isRestaurant && !isBooking) },
                { id: 'both', icon: LayoutGrid, label: 'Both', desc: 'Landing page', color: 'indigo', show: isRestaurant && isBooking },
              ].filter(opt => opt.show).map(opt => {
                const active = portalType === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setPortalType(opt.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all font-medium text-sm
                      ${active
                        ? `border-${opt.color}-500 bg-${opt.color}-50 dark:bg-${opt.color}-500/10`
                        : 'border-gray-200 dark:border-[#1F2630] hover:border-gray-300 dark:hover:border-white/10'
                      }`}
                  >
                    <Icon
                      size={22}
                      className={active ? `text-${opt.color}-500` : 'text-gray-400 dark:text-[#7D8590]'}
                    />
                    <div>
                      <div className={`font-bold text-xs ${active ? `text-${opt.color}-600 dark:text-${opt.color}-400` : 'text-gray-700 dark:text-[#E6E8EB]'}`}>
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-gray-400 dark:text-[#7D8590]">{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 dark:text-[#7D8590] mt-1">
              {portalType === 'both'
                ? 'Customers see a branded landing page to choose between ordering and booking.'
                : portalType === 'booking'
                ? 'Customers land directly on the appointment booking flow.'
                : 'Customers land directly on the menu and can add items to cart.'}
            </p>
          </Section>

          {/* ── 3. Digital Access ──────────────────────────── */}
          <Section
            icon={QrCode}
            iconColor="text-blue-500"
            title="Digital Access"
            subtitle="Share your portal link and QR code with customers"
          >
            <div className="space-y-4">
              {/* Public Link */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-[#7D8590] uppercase tracking-wider mb-2">
                  Public {portalType === 'both' ? 'Portal' : portalType === 'booking' ? 'Booking' : 'Ordering'} Link
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-gray-50 dark:bg-[#0B0D10] border border-gray-200 dark:border-[#1F2630] rounded-xl px-4 py-3 text-sm text-teal-600 dark:text-teal-400 truncate font-mono">
                    {portalLink}
                  </div>
                  <button
                    onClick={copyLink}
                    className={`px-4 rounded-xl border font-bold text-sm transition-all flex items-center gap-1.5 ${
                      copied
                        ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-600 dark:text-green-400'
                        : 'bg-white dark:bg-[#0B0D10] border-gray-200 dark:border-[#1F2630] text-gray-600 dark:text-gray-400 hover:border-teal-300 dark:hover:border-teal-500/30'
                    }`}
                  >
                    {copied ? <><CheckCircle2 size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                  </button>
                </div>
              </div>

              {/* QR Code + Preview */}
              <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-[#0B0D10] rounded-xl border border-gray-100 dark:border-[#1F2630]">
                <div className="w-24 h-24 bg-white rounded-xl flex items-center justify-center p-1 shrink-0 shadow-sm border border-gray-100">
                  <QrCode size={64} className="text-gray-900" />
                </div>
                <div className="flex-1">
                  <h5 className="text-sm font-bold text-gray-900 dark:text-[#E6E8EB] mb-1">Storefront QR Code</h5>
                  <p className="text-xs text-gray-500 dark:text-[#7D8590] mb-3">
                    Display at your {portalType === 'booking' ? 'reception desk' : 'tables or entrance'} for contactless {portalType === 'booking' ? 'booking' : portalType === 'both' ? 'ordering & booking' : 'ordering'}.
                  </p>
                  <button
                    onClick={() => window.open(portalLink, '_blank')}
                    className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={11} /> Preview Live Portal
                  </button>
                </div>
              </div>
            </div>
          </Section>

          {/* ── 3. Customer Identity Gate ─────────────────── */}
          <Section
            icon={ShieldCheck}
            iconColor="text-emerald-500"
            title="Customer Identity Gate"
            subtitle="Require identification before accessing the portal"
          >
            <div className="space-y-4">
              {/* Master Toggle */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-[#1F2630]">
                <div className="flex items-center gap-3">
                  <Lock size={16} className="text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Require customer identification</p>
                    <p className="text-[11px] text-gray-500 dark:text-[#7D8590]">
                      Customers enter their name & phone before browsing
                    </p>
                  </div>
                </div>
                <Toggle enabled={requireIdentity} onChange={() => setRequireIdentity(!requireIdentity)} />
              </div>

              {requireIdentity && (
                <>
                  {/* Identity Fields */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-[#7D8590] uppercase tracking-wider">
                      Required Fields
                    </label>
                    {identityFields.map((field, i) => (
                      <div key={field.name} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white dark:bg-[#0B0D10] border border-gray-100 dark:border-[#1F2630]">
                        <div className="flex items-center gap-3">
                          {field.name === 'customer_name' ? <UserCircle size={16} className="text-gray-400" /> : <Phone size={16} className="text-gray-400" />}
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{field.label}</span>
                          {field.required && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">Required</span>
                          )}
                        </div>
                        <Toggle enabled={field.enabled} onChange={() => {
                          const updated = [...identityFields];
                          updated[i] = { ...updated[i], enabled: !updated[i].enabled };
                          setIdentityFields(updated);
                        }} size="sm" />
                      </div>
                    ))}
                  </div>

                  {/* WhatsApp Opt-In */}
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-green-50 dark:bg-green-500/5 border border-green-100 dark:border-green-500/10">
                    <div className="flex items-center gap-3">
                      <MessageCircle size={16} className="text-green-600 dark:text-green-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">WhatsApp Updates</p>
                        <p className="text-[11px] text-gray-500 dark:text-[#7D8590]">
                          Pre-checked by default, customer can opt out
                        </p>
                      </div>
                    </div>
                    <Toggle enabled={whatsappOptIn} onChange={() => setWhatsappOptIn(!whatsappOptIn)} />
                  </div>
                </>
              )}
            </div>
          </Section>

          {/* ── 4. Brand Assets ───────────────────────────── */}
          <Section
            icon={ImageIcon}
            iconColor="text-blue-500"
            title="Brand Assets"
            subtitle="Upload your logo and hero banner"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-[#7D8590] uppercase tracking-wider mb-2">Portal Logo</label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 px-4 py-2.5 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-400 rounded-xl text-center cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-colors font-semibold text-sm">
                    Upload Logo
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e.target.files[0], 'logo')} />
                  </label>
                  {logoUrl && (
                    <div className="w-12 h-12 rounded-lg bg-white dark:bg-black/20 border border-gray-200 dark:border-[#1F2630] p-1 flex items-center justify-center shrink-0">
                      <img src={getImageUrl(logoUrl)} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 dark:text-[#7D8590] uppercase tracking-wider mb-2">Hero Banner</label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 rounded-xl text-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors font-semibold text-sm">
                    Upload Image
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e.target.files[0], 'hero')} />
                  </label>
                  {heroImageUrl && (
                    <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-[#1F2630]">
                      <img src={getImageUrl(heroImageUrl)} alt="Hero" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* ── 5. Typography ─────────────────────────────── */}
          <Section
            icon={Type}
            iconColor="text-pink-500"
            title="Typography"
            subtitle="Choose the font for your customer portal"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {FONTS.map(font => (
                <button
                  key={font.id}
                  onClick={() => setFontFamily(font.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${fontFamily === font.id
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10 ring-1 ring-purple-500'
                    : 'border-gray-200 dark:border-[#1F2630] bg-white dark:bg-black/20 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="text-[10px] text-gray-500 dark:text-[#7D8590] mb-1 truncate">{font.name}</div>
                  <div className="text-lg text-gray-900 dark:text-[#E6E8EB] truncate" style={{ fontFamily: font.id }}>Ag</div>
                </button>
              ))}
            </div>
          </Section>

          {/* ── 6. Color Palette ──────────────────────────── */}
          <Section
            icon={Palette}
            iconColor="text-amber-500"
            title="Color Palette"
            subtitle="Define your portal's visual identity"
          >
            <div className="space-y-4">
              {/* Brand colors */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-[#7D8590] uppercase tracking-wider mb-2">Brand</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'primary', label: 'Primary', hint: 'Hero, buttons, active states' },
                    { key: 'secondary', label: 'Accent', hint: 'Prices, highlights, badges' },
                  ].map(c => (
                    <div key={c.key}>
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-[#7D8590] mb-1.5">{c.label} <span className="font-normal opacity-60">· {c.hint}</span></label>
                      <div className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-black/20">
                        <input type="color" value={colors[c.key]} onChange={(e) => setColors({ ...colors, [c.key]: e.target.value })} className="w-8 h-8 rounded border-0 p-0 cursor-pointer overflow-hidden" />
                        <input type="text" value={colors[c.key].toUpperCase()} onChange={(e) => setColors({ ...colors, [c.key]: e.target.value })} className="w-full bg-transparent border-none text-sm text-gray-900 dark:text-[#E6E8EB] focus:ring-0 uppercase font-mono" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Layout colors */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-[#7D8590] uppercase tracking-wider mb-2">Layout</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'bgColor', label: 'Page Background', hint: 'Page base' },
                    { key: 'surfaceColor', label: 'Cards / Panels', hint: 'Cards, headers' },
                    { key: 'textColor', label: 'Text', hint: 'Body text' },
                  ].map(c => (
                    <div key={c.key}>
                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-[#7D8590] mb-1.5">{c.label} <span className="font-normal opacity-60">· {c.hint}</span></label>
                      <div className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-black/20">
                        <input type="color" value={colors[c.key]} onChange={(e) => setColors({ ...colors, [c.key]: e.target.value })} className="w-8 h-8 rounded border-0 p-0 cursor-pointer overflow-hidden" />
                        <input type="text" value={colors[c.key].toUpperCase()} onChange={(e) => setColors({ ...colors, [c.key]: e.target.value })} className="w-full bg-transparent border-none text-sm text-gray-900 dark:text-[#E6E8EB] focus:ring-0 uppercase font-mono" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visual swatch strip */}
              <div className="flex rounded-xl overflow-hidden h-6 mt-1 border border-black/5">
                <div className="flex-1" style={{ backgroundColor: colors.bgColor }} title="Page Background" />
                <div className="flex-1" style={{ backgroundColor: colors.surfaceColor }} title="Cards / Panels" />
                <div className="flex-1" style={{ backgroundColor: colors.primary }} title="Primary" />
                <div className="flex-1" style={{ backgroundColor: colors.secondary }} title="Accent" />
                <div className="flex-1" style={{ backgroundColor: colors.textColor }} title="Text" />
              </div>
            </div>
          </Section>

          {/* ── 7. Menu Layout ────────────────────────────── */}
          {isRestaurant && portalType !== 'booking' && (
            <Section
              icon={LayoutGrid}
              iconColor="text-indigo-500"
              title="Menu Layout"
              subtitle="Choose how items are displayed on your portal"
            >
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'classic', name: 'Classic', desc: 'Card grid with images', icon: LayoutGrid,
                    wireframe: (
                      <div className="space-y-1.5">
                        <div className="flex gap-1.5">
                          <div className="flex-1 h-8 rounded bg-current opacity-10 flex gap-1 p-1"><div className="w-6 h-full rounded bg-current opacity-30" /><div className="flex-1" /></div>
                          <div className="flex-1 h-8 rounded bg-current opacity-10 flex gap-1 p-1"><div className="w-6 h-full rounded bg-current opacity-30" /><div className="flex-1" /></div>
                        </div>
                        <div className="flex gap-1.5">
                          <div className="flex-1 h-8 rounded bg-current opacity-10 flex gap-1 p-1"><div className="w-6 h-full rounded bg-current opacity-30" /><div className="flex-1" /></div>
                          <div className="flex-1 h-8 rounded bg-current opacity-10 flex gap-1 p-1"><div className="w-6 h-full rounded bg-current opacity-30" /><div className="flex-1" /></div>
                        </div>
                      </div>
                    )
                  },
                  { id: 'compact', name: 'Compact List', desc: 'Dense rows, no images', icon: List,
                    wireframe: (
                      <div className="space-y-1">
                        {[1,2,3,4].map(i => <div key={i} className="h-4 rounded bg-current opacity-10 flex items-center px-1.5"><div className="w-12 h-1.5 rounded bg-current opacity-30" /><div className="ml-auto w-6 h-1.5 rounded bg-current opacity-30" /></div>)}
                      </div>
                    )
                  },
                  { id: 'grid', name: 'Photo Grid', desc: 'Image-first tiles', icon: Grid3x3,
                    wireframe: (
                      <div className="grid grid-cols-3 gap-1">
                        {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square rounded bg-current opacity-10"><div className="w-full h-2/3 rounded-t bg-current opacity-20" /></div>)}
                      </div>
                    )
                  },
                  { id: 'accordion', name: 'Accordion', desc: 'Collapsible categories', icon: ChevronsUpDown,
                    wireframe: (
                      <div className="space-y-1">
                        <div className="h-5 rounded bg-current opacity-15 flex items-center px-1.5"><div className="w-10 h-1.5 rounded bg-current opacity-40" /><div className="ml-auto w-2 h-2 rounded bg-current opacity-30" /></div>
                        <div className="ml-2 space-y-0.5">
                          <div className="h-3 rounded bg-current opacity-5" />
                          <div className="h-3 rounded bg-current opacity-5" />
                        </div>
                        <div className="h-5 rounded bg-current opacity-15 flex items-center px-1.5"><div className="w-8 h-1.5 rounded bg-current opacity-40" /><div className="ml-auto w-2 h-2 rounded bg-current opacity-30" /></div>
                      </div>
                    )
                  },
                ].map(layout => {
                  const LayoutIcon = layout.icon;
                  return (
                    <button
                      key={layout.id}
                      onClick={() => setMenuLayout(layout.id)}
                      className={`p-4 rounded-xl border text-left transition-all ${menuLayout === layout.id
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/10 ring-1 ring-indigo-500'
                        : 'border-gray-200 dark:border-[#1F2630] bg-white dark:bg-black/20 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <LayoutIcon size={14} className={menuLayout === layout.id ? 'text-indigo-500' : 'text-gray-400'} />
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{layout.name}</span>
                      </div>
                      <div className="mb-2 text-gray-500">{layout.wireframe}</div>
                      <p className="text-[10px] text-gray-500 dark:text-[#7D8590]">{layout.desc}</p>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}
        </div>

        {/* ═══════════════════ LIVE PREVIEW PANE ═══════════════════ */}
        <div className="w-full lg:w-96 flex-shrink-0">
          <div className="sticky top-6 space-y-4">
            {/* Preview Toggle */}
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-bold text-gray-500 dark:text-[#7D8590] uppercase tracking-wider flex items-center gap-2">
                <Eye size={14} /> Live Preview
              </h3>
              {requireIdentity && (
                <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-lg p-0.5">
                  <button
                    onClick={() => setPreviewScreen('gate')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${previewScreen === 'gate' ? 'bg-white dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 shadow-sm' : 'text-gray-500'}`}
                  >
                    Identity Gate
                  </button>
                  <button
                    onClick={() => setPreviewScreen('portal')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${previewScreen === 'portal' ? 'bg-white dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 shadow-sm' : 'text-gray-500'}`}
                  >
                    {portalType === 'booking' ? 'Booking' : portalType === 'both' ? 'Portal' : 'Menu'}
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Device Mockup */}
            <div className="relative mx-auto border-gray-200 dark:border-[#2A313C] border-[8px] rounded-[2.5rem] h-[620px] w-[300px] overflow-hidden shadow-2xl bg-white transition-colors duration-500" style={{ backgroundColor: colors.bgColor, fontFamily }}>

              <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap');`}} />

              {/* Status Bar */}
              <div className="absolute top-0 w-full h-6 z-10 flex justify-between px-6 pt-2" style={{ color: colors.textColor }}>
                <div className="w-12 h-4 rounded-full bg-current opacity-20" />
                <div className="w-16 h-4 rounded-full bg-current opacity-20" />
              </div>

              {/* Identity Gate Preview */}
              {requireIdentity && previewScreen === 'gate' ? (
                <div className="h-full flex flex-col pt-10 px-5 pb-6">
                  {/* Logo */}
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto rounded-2xl shadow-lg flex items-center justify-center p-2 mb-3" style={{ backgroundColor: colors.surfaceColor }}>
                      {logoUrl ? <img src={getImageUrl(logoUrl)} alt="Logo" className="max-w-full max-h-full object-contain" /> : <Palette size={24} className="opacity-20" />}
                    </div>
                    <h1 className="text-lg font-bold tracking-tight" style={{ color: colors.textColor }}>
                      {selectedOutlet?.name || 'Your Business'}
                    </h1>
                    <p className="text-[10px] opacity-50 mt-0.5" style={{ color: colors.textColor }}>
                      {isRestaurant ? 'Welcome! Let us know who you are' : 'Book your appointment'}
                    </p>
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-3 flex-1">
                    {identityFields.filter(f => f.enabled).map(field => (
                      <div key={field.name}>
                        <label className="block text-[9px] font-semibold uppercase tracking-wider mb-1.5 opacity-60" style={{ color: colors.textColor }}>
                          {field.label} {field.required && <span className="text-red-400">*</span>}
                        </label>
                        <div className="w-full px-3 py-2.5 rounded-xl border text-sm" style={{
                          borderColor: colors.primary + '20',
                          color: colors.textColor + '60',
                          backgroundColor: theme === 'dark' ? '#ffffff08' : '#00000005'
                        }}>
                          {field.name === 'customer_name' ? 'Enter your name' : '+91 '}
                        </div>
                      </div>
                    ))}

                    {/* WhatsApp Checkbox */}
                    {whatsappOptIn && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-4 h-4 rounded border-2 flex items-center justify-center" style={{ borderColor: '#25D366', backgroundColor: '#25D36620' }}>
                          <div className="w-2 h-2 rounded-sm bg-[#25D366]" />
                        </div>
                        <span className="text-[10px] font-medium" style={{ color: colors.textColor + 'CC' }}>
                          Get updates via WhatsApp
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Continue Button */}
                  <div className="mt-auto pt-4">
                    <div className="w-full py-3 rounded-xl font-bold text-sm text-white text-center shadow-lg" style={{ backgroundColor: colors.primary }}>
                      Continue
                    </div>
                    <p className="text-center text-[8px] mt-2 opacity-40" style={{ color: colors.textColor }}>
                      Powered by Ri'Serve
                    </p>
                  </div>
                </div>
              ) : (
                /* Menu / Booking Preview */
                <>
                  {/* Hero */}
                  <div className="h-36 relative w-full border-b border-black/5" style={{ backgroundColor: colors.primary + '11' }}>
                    {heroImageUrl ? (
                      <img src={getImageUrl(heroImageUrl)} alt="Hero" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs opacity-50" style={{ color: colors.textColor }}>Empty Hero Space</div>
                    )}
                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-2xl shadow-xl flex items-center justify-center p-2 overflow-hidden z-10" style={{ backgroundColor: colors.surfaceColor }}>
                      {logoUrl ? <img src={getImageUrl(logoUrl)} alt="Logo" className="max-w-full max-h-full object-contain" /> : <Palette size={24} className="opacity-20" />}
                    </div>
                  </div>

                  <div className="pt-12 px-5 pb-6 text-center space-y-5">
                    <div>
                      <h1 className="text-lg font-bold tracking-tight mb-1" style={{ color: colors.textColor }}>
                        {selectedOutlet?.name || 'Your Business'}
                      </h1>
                      <p className="text-[10px] opacity-50 uppercase tracking-widest" style={{ color: colors.textColor }}>
                        {portalType === 'both' ? 'Order & Book' : portalType === 'booking' ? 'Book Appointment' : 'Order & Dining'}
                      </p>
                    </div>

                    {/* Both Portal: show two CTAs */}
                    {portalType === 'both' && (
                      <div className="space-y-2 pt-2">
                        <div className="rounded-2xl p-3 flex items-center gap-3 shadow-sm border border-black/5" style={{ backgroundColor: colors.surfaceColor }}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: colors.primary }}>
                            <UtensilsCrossed size={14} className="text-white" />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="font-bold text-xs" style={{ color: colors.textColor }}>Order Now</div>
                            <div className="text-[9px] opacity-50" style={{ color: colors.textColor }}>Browse menu & cart</div>
                          </div>
                        </div>
                        <div className="rounded-2xl p-3 flex items-center gap-3 shadow-sm border border-black/5" style={{ backgroundColor: colors.surfaceColor }}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: colors.secondary }}>
                            <CalendarCheck size={14} className="text-white" />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="font-bold text-xs" style={{ color: colors.textColor }}>Book Appointment</div>
                            <div className="text-[9px] opacity-50" style={{ color: colors.textColor }}>Schedule a session</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Booking Portal: show service list */}
                    {portalType === 'booking' && (
                      <div className="space-y-2.5 pt-2 text-left">
                        <div className="text-[10px] font-semibold uppercase tracking-widest opacity-50" style={{ color: colors.textColor }}>Services</div>
                        {[{ name: 'Haircut & Style', dur: '45 min', price: '₹599' }, { name: 'Facial', dur: '60 min', price: '₹1,200' }].map(svc => (
                          <div key={svc.name} className="rounded-2xl p-3 flex justify-between items-center shadow-sm border border-black/5" style={{ backgroundColor: colors.surfaceColor }}>
                            <div>
                              <div className="font-semibold text-xs" style={{ color: colors.textColor }}>{svc.name}</div>
                              <div className="text-[9px] opacity-50" style={{ color: colors.textColor }}>{svc.dur}</div>
                            </div>
                            <div className="font-bold text-xs" style={{ color: colors.secondary }}>{svc.price}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2.5 pt-2 text-left">
                      <div className="text-[10px] font-semibold uppercase tracking-widest opacity-50" style={{ color: colors.textColor }}>
                        {portalType === 'booking' ? '' : `Menu · ${menuLayout}`}
                      </div>

                      {/* Classic layout preview */}
                      {portalType !== 'booking' && menuLayout === 'classic' && [1, 2].map(i => (
                        <div key={i} className="rounded-2xl p-3 flex gap-3 shadow-sm border border-black/5" style={{ backgroundColor: colors.surfaceColor }}>
                          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 opacity-20" style={{ backgroundColor: colors.secondary }} />
                          <div className="flex-1">
                            <div className="font-semibold text-xs mb-1" style={{ color: colors.textColor }}>Signature Item {i}</div>
                            <div className="text-[10px] opacity-50 mb-1" style={{ color: colors.textColor }}>Freshly prepared daily</div>
                            <div className="font-bold flex justify-between items-center text-xs" style={{ color: colors.secondary }}>₹{249 + i * 100}<div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px]" style={{ backgroundColor: colors.primary }}>+</div></div>
                          </div>
                        </div>
                      ))}

                      {/* Compact list preview */}
                      {portalType !== 'booking' && menuLayout === 'compact' && [1, 2, 3, 4].map(i => (
                        <div key={i} className="flex items-center justify-between py-2 px-2 border-b border-black/5">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 border rounded-sm" style={{ borderColor: i % 2 === 0 ? '#dc2626' : '#16a34a' }}><div className="w-1.5 h-1.5 rounded-full m-[1px]" style={{ backgroundColor: i % 2 === 0 ? '#dc2626' : '#16a34a' }} /></div>
                            <span className="text-[10px] font-semibold" style={{ color: colors.textColor }}>Menu Item {i}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold" style={{ color: colors.secondary }}>₹{149 + i * 50}</span>
                            <div className="text-[8px] font-bold px-1.5 py-0.5 rounded border" style={{ borderColor: colors.primary, color: colors.primary }}>ADD</div>
                          </div>
                        </div>
                      ))}

                      {/* Photo grid preview */}
                      {portalType !== 'booking' && menuLayout === 'grid' && (
                        <div className="grid grid-cols-2 gap-1.5">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i} className="rounded-xl overflow-hidden shadow-sm border border-black/5" style={{ backgroundColor: colors.surfaceColor }}>
                              <div className="aspect-square opacity-15" style={{ backgroundColor: colors.secondary }} />
                              <div className="p-2">
                                <div className="text-[9px] font-bold truncate" style={{ color: colors.textColor }}>Item {i}</div>
                                <div className="text-[9px] font-bold" style={{ color: colors.secondary }}>₹{199 + i * 50}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Accordion preview */}
                      {portalType !== 'booking' && menuLayout === 'accordion' && (
                        <div className="space-y-1">
                          <div className="rounded-xl p-2 border border-black/5" style={{ backgroundColor: colors.surfaceColor }}>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold" style={{ color: colors.textColor }}>☕ Coffee (4)</span>
                              <span className="text-[10px] opacity-40">▼</span>
                            </div>
                            <div className="mt-1.5 space-y-1">
                              {[1, 2].map(i => (
                                <div key={i} className="flex justify-between items-center py-1 border-t border-black/5">
                                  <span className="text-[9px]" style={{ color: colors.textColor }}>Coffee {i}</span>
                                  <span className="text-[9px] font-bold" style={{ color: colors.secondary }}>₹{149 + i * 50}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-xl p-2 border border-black/5 opacity-60" style={{ backgroundColor: colors.surfaceColor }}>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold" style={{ color: colors.textColor }}>🍔 Mains (6)</span>
                              <span className="text-[10px] opacity-40">►</span>
                            </div>
                          </div>
                          <div className="rounded-xl p-2 border border-black/5 opacity-60" style={{ backgroundColor: colors.surfaceColor }}>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold" style={{ color: colors.textColor }}>🍰 Desserts (3)</span>
                              <span className="text-[10px] opacity-40">►</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-4">
                      <div className="w-full py-2.5 rounded-xl font-bold text-xs text-white shadow-md" style={{ backgroundColor: colors.primary }}>
                        {portalType === 'booking' ? 'Book Now' : 'View Cart'}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPortalDesign;
