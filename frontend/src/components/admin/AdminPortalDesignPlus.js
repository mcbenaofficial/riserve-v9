import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getImageUrl } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Sparkles, Palette, LayoutGrid, List, Grid3x3, ChevronsUpDown,
  Save, CheckCircle2, Loader2, Copy, ExternalLink, QrCode,
  Smartphone, Wand2, ShieldCheck, MessageCircle, UtensilsCrossed,
  User, Star, Hash, ShoppingCart, Upload, X, ImagePlus, SlidersHorizontal
} from 'lucide-react';

// ─── Theme Presets ──────────────────────────────────────────────────────────
const THEME_PRESETS = [
  {
    id: 'espresso',
    name: 'Dark Espresso',
    colors: { primary: '#8B5E3C', secondary: '#D4A96A', bgColor: '#0D0A08', surfaceColor: '#1C1410', textColor: '#F5ECD7' },
    fontFamily: 'Playfair Display',
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    colors: { primary: '#4F8EF7', secondary: '#A78BFA', bgColor: '#060B18', surfaceColor: '#0E1829', textColor: '#E8F0FE' },
    fontFamily: 'Manrope',
  },
  {
    id: 'minimal',
    name: 'Light Minimal',
    colors: { primary: '#1A1A1A', secondary: '#6B7280', bgColor: '#FAFAFA', surfaceColor: '#FFFFFF', textColor: '#111827' },
    fontFamily: 'Inter',
  },
  {
    id: 'sakura',
    name: 'Sakura Pink',
    colors: { primary: '#E879A0', secondary: '#FB7185', bgColor: '#FFF0F5', surfaceColor: '#FFFFFF', textColor: '#3D1023' },
    fontFamily: 'Outfit',
  },
  {
    id: 'forest',
    name: 'Forest Green',
    colors: { primary: '#16A34A', secondary: '#65A30D', bgColor: '#F0FDF4', surfaceColor: '#FFFFFF', textColor: '#14532D' },
    fontFamily: 'Inter',
  },
  {
    id: 'saffron',
    name: 'Saffron Sunset',
    colors: { primary: '#F97316', secondary: '#EAB308', bgColor: '#0D0805', surfaceColor: '#1C1208', textColor: '#FFF7ED' },
    fontFamily: 'Outfit',
  },
];

const FONTS = [
  { id: 'Inter', name: 'Inter — Modern & Clean' },
  { id: 'Playfair Display', name: 'Playfair Display — Elegant' },
  { id: 'Outfit', name: 'Outfit — Geometric' },
  { id: 'Manrope', name: 'Manrope — Minimalist' },
  { id: 'Roboto', name: 'Roboto — Functional' },
  { id: 'Merriweather', name: 'Merriweather — Serif' },
];

const LAYOUTS = [
  { id: 'classic', name: 'Classic', desc: 'Photo + text side by side', icon: List },
  { id: 'grid', name: 'Grid', desc: 'Photo-first tiles', icon: Grid3x3 },
  { id: 'compact', name: 'Compact', desc: 'Dense list rows', icon: LayoutGrid },
  { id: 'accordion', name: 'Accordion', desc: 'Collapsible categories', icon: ChevronsUpDown },
];

const ITEM_TAGS = ['Spicy', "Chef's Pick", 'New', 'Healthy', 'Popular'];

// ─── Sub-components ─────────────────────────────────────────────────────────
const Toggle = ({ enabled, onChange }) => (
  <button type="button" onClick={onChange}
    className={`relative w-11 h-6 rounded-full transition-all duration-300 ${enabled ? 'bg-teal-500' : 'bg-gray-300 dark:bg-white/10'}`}>
    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
  </button>
);

const Section = ({ icon: Icon, title, subtitle, children, iconColor = 'text-violet-500' }) => (
  <div className="bg-white/90 dark:bg-[#12161C]/90 backdrop-blur-xl border border-gray-200 dark:border-[#1F2630] rounded-2xl p-6 space-y-5">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-xl ${iconColor.replace('text-', 'bg-')}/10`}>
        <Icon size={18} className={iconColor} />
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-[#E6E8EB]">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 dark:text-[#7D8590] mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);

// ─── Logo Adjust Panel ───────────────────────────────────────────────────────
const LogoAdjustPanel = ({ logoUrl, adjust, onChange }) => {
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startAdjX: 0, startAdjY: 0 });

  const { x = 0, y = 0, scale = 1, fit = 'contain' } = adjust;

  const onMouseDown = (e) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, startAdjX: x, startAdjY: y };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dx = ((e.clientX - dragRef.current.startX) / 128) * 100;
      const dy = ((e.clientY - dragRef.current.startY) / 128) * 100;
      onChange({ ...adjust, x: dragRef.current.startAdjX + dx, y: dragRef.current.startAdjY + dy });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, adjust, onChange]);

  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    onChange({ ...adjust, scale: Math.round(Math.max(0.3, Math.min(4, scale + delta)) * 10) / 10 });
  };

  return (
    <div className="p-4 rounded-2xl border border-gray-200 dark:border-[#1F2630] bg-gray-50 dark:bg-black/20 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-700 dark:text-[#E6E8EB]">Adjust Logo</span>
        <button type="button" onClick={() => onChange({ x: 0, y: 0, scale: 1, fit: 'contain' })}
          className="text-[10px] font-bold text-violet-500 hover:text-violet-600 transition-colors">
          Reset
        </button>
      </div>

      {/* Drag canvas */}
      <div className="flex flex-col items-center gap-1.5">
        <div
          onMouseDown={onMouseDown}
          onWheel={onWheel}
          className={`relative w-32 h-32 rounded-2xl overflow-hidden select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ background: 'repeating-conic-gradient(#80808018 0% 25%, transparent 0% 50%) 0 0 / 12px 12px', border: '1.5px dashed rgba(128,128,128,0.3)' }}
        >
          {logoUrl && (
            <img
              src={getImageUrl(logoUrl)}
              alt="Logo"
              draggable={false}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: fit,
                transform: `translate(${x}%, ${y}%) scale(${scale})`,
                transformOrigin: 'center center',
                pointerEvents: 'none',
              }}
            />
          )}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 w-full h-px -translate-y-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
            <div className="absolute left-1/2 h-full w-px -translate-x-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
          </div>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-[#7D8590]">Drag to reposition · Scroll to zoom</p>
      </div>

      {/* Zoom slider */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-semibold text-gray-500 dark:text-[#7D8590]">Zoom</span>
          <span className="text-[10px] font-mono text-gray-500 dark:text-[#7D8590]">{Number(scale).toFixed(1)}×</span>
        </div>
        <input type="range" min="0.3" max="4" step="0.1" value={scale}
          onChange={e => onChange({ ...adjust, scale: parseFloat(e.target.value) })}
          className="w-full cursor-pointer accent-violet-500"
        />
      </div>

      {/* Fit mode */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-semibold text-gray-500 dark:text-[#7D8590]">Fit Mode</span>
        <div className="flex gap-2">
          {[
            { v: 'contain', label: 'Contain', sub: 'Full logo visible' },
            { v: 'cover',   label: 'Cover',   sub: 'Fill the frame' },
          ].map(o => (
            <button key={o.v} type="button" onClick={() => onChange({ ...adjust, fit: o.v })}
              className={`flex-1 py-2 px-3 rounded-xl border text-left transition-all ${
                fit === o.v
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                  : 'border-gray-200 dark:border-[#1F2630] hover:border-gray-300 dark:hover:border-white/10'
              }`}
            >
              <div className={`text-xs font-bold ${fit === o.v ? 'text-violet-700 dark:text-violet-300' : 'text-gray-600 dark:text-[#E6E8EB]'}`}>{o.label}</div>
              <div className="text-[9px] text-gray-400 dark:text-[#7D8590] mt-0.5">{o.sub}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Image Upload Zone ───────────────────────────────────────────────────────
const ImageUploadZone = ({ label, hint, value, onChange, aspect = 'square' }) => {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) { alert('Only JPG, PNG, WEBP, or GIF files are allowed.'); return; }
    setUploading(true);
    try {
      const data = new FormData();
      data.append('files', file);
      const res = await api.uploadFiles(data);
      if (res.data.urls?.length > 0) onChange(res.data.urls[0]);
    } catch {
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  const previewW = aspect === 'square' ? 'w-28' : 'w-full';

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-gray-700 dark:text-[#E6E8EB]">{label}</label>

      {value ? (
        <div className={`relative h-28 ${previewW} rounded-2xl overflow-hidden border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-black/20 group`}>
          <img
            src={getImageUrl(value)}
            alt={label}
            className={`w-full h-full ${aspect === 'square' ? 'object-contain p-2' : 'object-cover'}`}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="w-8 h-8 rounded-full bg-white/90 text-gray-900 flex items-center justify-center hover:bg-white transition-colors shadow-md" title="Replace">
              <Upload size={13} />
            </button>
            <button type="button" onClick={() => onChange('')}
              className="w-8 h-8 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:bg-red-500 transition-colors shadow-md" title="Remove">
              <X size={13} />
            </button>
          </div>
          <input ref={inputRef} type="file" className="hidden" accept="image/*" onChange={(e) => upload(e.target.files[0])} />
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`relative cursor-pointer h-28 ${previewW} rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2
            ${dragging
              ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/10 scale-[1.01]'
              : 'border-gray-200 dark:border-[#1F2630] hover:border-violet-300 dark:hover:border-violet-500/30 bg-gray-50/50 dark:bg-black/10'
            }`}
        >
          {uploading ? (
            <Loader2 size={20} className="animate-spin text-violet-400" />
          ) : (
            <>
              <div className={`p-2.5 rounded-xl transition-colors ${dragging ? 'bg-violet-100 dark:bg-violet-500/20' : 'bg-gray-100 dark:bg-white/5'}`}>
                <ImagePlus size={18} className={dragging ? 'text-violet-500' : 'text-gray-400 dark:text-[#7D8590]'} />
              </div>
              <div className="text-center px-4">
                <p className="text-xs font-semibold text-gray-700 dark:text-[#E6E8EB]">
                  {dragging ? 'Drop to upload' : 'Click or drag & drop'}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-[#7D8590] mt-0.5">{hint}</p>
              </div>
            </>
          )}
          <input ref={inputRef} type="file" className="hidden" accept="image/*" onChange={(e) => upload(e.target.files[0])} />
        </div>
      )}
    </div>
  );
};

// ─── Mobile Preview ──────────────────────────────────────────────────────────
const MobilePreview = ({ colors, fontFamily, logoUrl, restaurantName, menuLayout, menuItems = [] }) => {
  const primary = colors.primary || '#1A1A1A';
  const secondary = colors.secondary || '#F59E0B';
  const bg = colors.bgColor || '#FAFAFA';
  const surface = colors.surfaceColor || '#FFFFFF';
  const text = colors.textColor || '#1A1A1A';

  const isDark = (() => {
    const c = bg.replace('#', '');
    if (c.length !== 6) return false;
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return r * 0.299 + g * 0.587 + b * 0.114 < 128;
  })();

  const itemBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const itemBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  return (
    <div className="relative mx-auto" style={{ width: 220, height: 420 }}>
      {/* Phone frame */}
      <div className="absolute inset-0 rounded-[32px] border-[6px] border-gray-800 dark:border-gray-600 bg-gray-900 shadow-2xl z-10 pointer-events-none">
        {/* Notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-3.5 bg-gray-900 rounded-full z-20" />
      </div>

      {/* Screen content */}
      <div className="absolute inset-[6px] rounded-[26px] overflow-hidden"
        style={{ backgroundColor: bg, fontFamily: `${fontFamily}, system-ui, sans-serif` }}>
        {/* Blob */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
          style={{ background: primary, opacity: 0.2, filter: 'blur(30px)' }} />

        {/* Header bar */}
        <div className="flex items-center gap-2 px-3 py-2.5 sticky top-0 z-10"
          style={{ backgroundColor: `${surface}E0`, backdropFilter: 'blur(12px)', borderBottom: `1px solid ${itemBorder}` }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0"
            style={{ backgroundColor: primary }}>{(restaurantName || 'R')[0]}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-black leading-none truncate" style={{ color: text }}>{restaurantName || 'Restaurant'}</div>
          </div>
          <div className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ backgroundColor: `${primary}18`, color: primary }}><User className="w-2 h-2" /></div>
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 px-3 py-2 overflow-hidden">
          {['All', 'Mains', 'Sides'].map((cat, i) => (
            <div key={cat} className="text-[8px] font-bold px-2 py-1 rounded-full shrink-0"
              style={i === 0
                ? { backgroundColor: primary, color: 'white' }
                : { backgroundColor: itemBg, color: text, border: `1px solid ${itemBorder}` }}>
              {cat}
            </div>
          ))}
        </div>

        {/* Menu items (preview) */}
        <div className="px-3 pb-2 space-y-1.5">
          {menuLayout === 'grid' ? (
            <div className="grid grid-cols-2 gap-1.5">
              {(menuItems.length > 0 ? menuItems.slice(0, 4) : [{ name: 'Cappuccino', price: 220 }, { name: 'Croissant', price: 180 }]).map((item, i) => (
                <div key={i} className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: itemBg, border: `1px solid ${itemBorder}` }}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} className="w-full aspect-square object-cover" />
                    : <div className="aspect-square" style={{ backgroundColor: `${primary}20` }} />}
                  <div className="p-1.5">
                    <div className="text-[8px] font-bold truncate" style={{ color: text }}>{item.name}</div>
                    <div className="text-[8px] font-black mt-0.5" style={{ color: secondary }}>₹{item.price}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            (menuItems.length > 0 ? menuItems.slice(0, 3) : [{ name: 'Espresso', price: 180, description: 'Rich, bold & aromatic' }, { name: 'Croissant', price: 220, description: 'Buttery, flaky layers' }]).map((item, i) => (
              <div key={i} className="rounded-xl p-2 flex items-center gap-2"
                style={{ backgroundColor: itemBg, border: `1px solid ${itemBorder}` }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} className="w-9 h-9 rounded-lg shrink-0 object-cover" />
                  : <div className="w-9 h-9 rounded-lg shrink-0" style={{ backgroundColor: `${primary}25` }} />}
                <div className="flex-1 min-w-0">
                  <div className="text-[8px] font-bold" style={{ color: text }}>{item.name}</div>
                  <div className="text-[7px] truncate" style={{ color: text, opacity: 0.5 }}>{item.description || ''}</div>
                </div>
                <div className="text-[8px] font-black shrink-0" style={{ color: secondary }}>₹{item.price}</div>
              </div>
            ))
          )}
          {menuItems.length === 0 && (
            <div className="text-center py-2">
              <div className="text-[7px]" style={{ color: `${text}40` }}>No menu items yet</div>
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around px-3 py-2"
          style={{ backgroundColor: `${surface}F0`, backdropFilter: 'blur(12px)', borderTop: `1px solid ${itemBorder}` }}>
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-4 h-4 flex items-center justify-center">
              <svg width="12" height="12" fill="none" stroke={primary} strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
            <span className="text-[6px] font-bold" style={{ color: primary }}>Menu</span>
          </div>
          <div className="w-10 h-10 -mt-3 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: `linear-gradient(135deg, ${primary}EE, ${primary}AA)` }}>
            <svg width="14" height="14" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-4 h-4 flex items-center justify-center">
              <svg width="12" height="12" fill="none" stroke={`${text}50`} strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272" />
              </svg>
            </div>
            <span className="text-[6px] font-bold" style={{ color: `${text}50` }}>Cart</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AdminPortalDesignPlus() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [outlets, setOutlets] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [itemTagEdits, setItemTagEdits] = useState({});  // {itemId: {is_bestseller, tags}}
  const [tagSaving, setTagSaving] = useState(false);
  const [tagSaveSuccess, setTagSaveSuccess] = useState(false);

  // Portal config
  const [colors, setColors] = useState({
    primary: '#1A1A1A', secondary: '#F59E0B',
    bgColor: '#FAFAFA', surfaceColor: '#FFFFFF', textColor: '#1A1A1A'
  });
  const [fontFamily, setFontFamily] = useState('Inter');
  const [menuLayout, setMenuLayout] = useState('classic');
  const [logoUrl, setLogoUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [cuisineType, setCuisineType] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [portalEnabled, setPortalEnabled] = useState(true);
  const [requireIdentity, setRequireIdentity] = useState(true);
  const [aiDishSuggestion, setAiDishSuggestion] = useState(true);
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [portalType, setPortalType] = useState('order');
  const [portalNameMode, setPortalNameMode] = useState('outlet'); // 'outlet' | 'company'
  const [companyName, setCompanyName] = useState('');
  const [logoAdjust, setLogoAdjust] = useState({ x: 0, y: 0, scale: 1, fit: 'contain' });
  const [showLogoAdjust, setShowLogoAdjust] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [outletsRes, companyRes] = await Promise.all([
        api.getOutlets(),
        api.getCompanySettings().catch(() => ({ data: {} })),
      ]);
      const list = outletsRes.data || [];
      setOutlets(list);
      setCompanyName(companyRes.data?.name || '');
      if (list.length > 0) {
        const first = list.find(o => o.status === 'Active') || list[0];
        loadOutlet(first.id, list);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadOutlet = (id, list = outlets) => {
    setSelectedOutletId(id);
    setItemTagEdits({});
    const outlet = list.find(o => o.id === id);
    if (!outlet) return;
    api.getMenuItems(id).then(r => setMenuItems(r.data || [])).catch(() => setMenuItems([]));
    const cfg = outlet.portal_color_scheme || {};
    setLogoUrl(outlet.portal_logo_url || '');
    setCoverImageUrl(cfg.coverImageUrl || '');
    setCuisineType(cfg.cuisineType || '');
    setOpeningHours(cfg.openingHours || '');
    setFontFamily(cfg.fontFamily || 'Inter');
    setColors({
      primary: cfg.primary || '#1A1A1A',
      secondary: cfg.secondary || '#F59E0B',
      bgColor: cfg.bgColor || '#FAFAFA',
      surfaceColor: cfg.surfaceColor || '#FFFFFF',
      textColor: cfg.textColor || '#1A1A1A',
    });
    setMenuLayout(cfg.menuLayout || 'classic');
    setPortalEnabled(cfg.portalEnabled !== false);
    setRequireIdentity(cfg.requireIdentity !== false);
    setAiDishSuggestion(cfg.aiDishSuggestion !== false);
    setWhatsappOptIn(cfg.whatsappOptIn !== false);
    setPortalType(cfg.portalType || 'order');
    setPortalNameMode(cfg.portalNameMode || 'outlet');
    setLogoAdjust(cfg.logoAdjust || { x: 0, y: 0, scale: 1, fit: 'contain' });
    setShowLogoAdjust(false);
  };

  const applyPreset = (preset) => {
    setColors(preset.colors);
    setFontFamily(preset.fontFamily);
  };

  const toggleItemTag = (itemId, tag) => {
    setItemTagEdits(prev => {
      const item = menuItems.find(i => i.id === itemId);
      const base = prev[itemId] || { is_bestseller: item?.is_bestseller || false, tags: [...(item?.tags || [])] };
      const tags = base.tags.includes(tag) ? base.tags.filter(t => t !== tag) : [...base.tags, tag];
      return { ...prev, [itemId]: { ...base, tags } };
    });
  };

  const toggleBestseller = (itemId) => {
    setItemTagEdits(prev => {
      const item = menuItems.find(i => i.id === itemId);
      const base = prev[itemId] || { is_bestseller: item?.is_bestseller || false, tags: [...(item?.tags || [])] };
      return { ...prev, [itemId]: { ...base, is_bestseller: !base.is_bestseller } };
    });
  };

  const saveItemTags = async () => {
    if (!Object.keys(itemTagEdits).length) return;
    setTagSaving(true);
    try {
      await Promise.all(Object.entries(itemTagEdits).map(([id, edits]) => {
        const item = menuItems.find(i => i.id === id);
        if (!item) return Promise.resolve();
        return api.updateMenuItem(id, { ...item, ...edits });
      }));
      // Refresh menu items
      const r = await api.getMenuItems(selectedOutletId);
      setMenuItems(r.data || []);
      setItemTagEdits({});
      setTagSaveSuccess(true);
      setTimeout(() => setTagSaveSuccess(false), 3000);
    } catch (e) { console.error(e); }
    finally { setTagSaving(false); }
  };

  const handleSave = async () => {
    if (!selectedOutletId) return;
    setSaving(true);
    try {
      const outlet = outlets.find(o => o.id === selectedOutletId);
      if (!outlet) return;
      await api.updateOutlet(selectedOutletId, {
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
          coverImageUrl,
          cuisineType,
          openingHours,
          menuLayout,
          portalEnabled,
          requireIdentity,
          aiDishSuggestion,
          whatsappOptIn,
          portalType,
          portalNameMode,
          logoAdjust,
        },
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert('Failed to save portal settings.');
    } finally {
      setSaving(false);
    }
  };

  const selectedOutlet = outlets.find(o => o.id === selectedOutletId);
  const portalBaseUrl = typeof window !== 'undefined' ? window.location.origin.replace(':3001', ':3002').replace(':3003', ':3002') : '';
  const portalUrl = selectedOutletId ? `${portalBaseUrl}/menu/${selectedOutletId}` : '';

  const copyPortalUrl = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin text-violet-500" />
    </div>
  );

  return (
    <div className={`min-h-screen p-6 ${theme === 'dark' ? 'bg-[#080C12]' : 'bg-gray-50'}`}>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg">
                <Sparkles size={16} className="text-white" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 dark:text-white">Portal Design <span className="text-violet-500">+</span></h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-[#7D8590]">Customise the customer-facing ordering portal with the new mobile-first UI</p>
          </div>

          <div className="flex items-center gap-3">
            {outlets.length > 1 && (
              <select value={selectedOutletId} onChange={e => loadOutlet(e.target.value)}
                className="text-sm font-medium px-3 py-2 rounded-xl border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-[#12161C] text-gray-700 dark:text-[#E6E8EB] focus:outline-none">
                {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
            <button onClick={() => navigate('/admin?tab=menu-management')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-gray-200 dark:border-[#1F2630] text-gray-600 dark:text-[#C9D1D9] hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all">
              <UtensilsCrossed size={15} />
              Manage Menu
            </button>
            <button onClick={handleSave} disabled={saving || !selectedOutletId}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', boxShadow: '0 4px 20px rgba(139,92,246,0.35)' }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : saveSuccess ? <CheckCircle2 size={16} /> : <Save size={16} />}
              {saving ? 'Saving…' : saveSuccess ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
          {/* Left: Controls */}
          <div className="space-y-5">

            {/* Portal status */}
            <Section icon={ShieldCheck} title="Portal Access" subtitle="Control who can access your ordering portal" iconColor="text-teal-500">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gray-50 dark:bg-white/5">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-[#E6E8EB]">Portal Enabled</p>
                    <p className="text-xs text-gray-400 dark:text-[#7D8590] mt-0.5">Allow customers to access and order from the portal</p>
                  </div>
                  <Toggle enabled={portalEnabled} onChange={() => setPortalEnabled(!portalEnabled)} />
                </div>
                <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gray-50 dark:bg-white/5">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-[#E6E8EB]">Identity Gate</p>
                    <p className="text-xs text-gray-400 dark:text-[#7D8590] mt-0.5">Ask for name & phone before showing the menu</p>
                  </div>
                  <Toggle enabled={requireIdentity} onChange={() => setRequireIdentity(!requireIdentity)} />
                </div>
                <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gray-50 dark:bg-white/5">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-[#E6E8EB]">WhatsApp Opt-In</p>
                    <p className="text-xs text-gray-400 dark:text-[#7D8590] mt-0.5">Show WhatsApp update opt-in at gate & checkout</p>
                  </div>
                  <Toggle enabled={whatsappOptIn} onChange={() => setWhatsappOptIn(!whatsappOptIn)} />
                </div>
              </div>
            </Section>

            {/* AI suggestion */}
            <Section icon={Sparkles} title="AI Dish Suggestions" subtitle="Let customers describe their mood and get AI-powered dish picks" iconColor="text-fuchsia-500">
              <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gray-50 dark:bg-white/5">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-[#E6E8EB]">Enable AI Dish Suggestions</p>
                  <p className="text-xs text-gray-400 dark:text-[#7D8590] mt-0.5">Adds the AI tab to the customer portal's bottom navigation</p>
                </div>
                <Toggle enabled={aiDishSuggestion} onChange={() => setAiDishSuggestion(!aiDishSuggestion)} />
              </div>
              {aiDishSuggestion && (
                <div className="px-4 py-3 rounded-xl text-xs font-medium"
                  style={{ background: 'rgba(217,70,239,0.08)', border: '1px solid rgba(217,70,239,0.2)', color: '#a855f7' }}>
                  Customers will see a middle AI tab in the bottom nav. They can pick a mood (Comfort Food, Spicy, Sweet, etc.) and get instant dish recommendations powered by your menu + AI.
                </div>
              )}
            </Section>

            {/* Restaurant identity */}
            <Section icon={Smartphone} title="Restaurant Identity" subtitle="Logo, hero banner, cuisine type, and opening hours" iconColor="text-blue-500">
              <div className="space-y-4">
                {/* Name display mode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-[#E6E8EB]">Portal Display Name</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'outlet', label: 'Outlet Name', preview: outlets.find(o => o.id === selectedOutletId)?.name || '—' },
                      { value: 'company', label: 'Account Name', preview: companyName || '—' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPortalNameMode(opt.value)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          portalNameMode === opt.value
                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                            : 'border-gray-200 dark:border-[#1F2630] hover:border-gray-300 dark:hover:border-white/10'
                        }`}
                      >
                        <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
                          portalNameMode === opt.value ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400 dark:text-[#7D8590]'
                        }`}>{opt.label}</div>
                        <div className={`text-xs font-semibold truncate ${
                          portalNameMode === opt.value ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-[#7D8590]'
                        }`}>{opt.preview}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div className="space-y-2">
                    <ImageUploadZone
                      label="Portal Logo"
                      hint="PNG or SVG · transparent bg recommended"
                      value={logoUrl}
                      onChange={(v) => { setLogoUrl(v); if (!v) setShowLogoAdjust(false); }}
                      aspect="square"
                    />
                    {logoUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowLogoAdjust(v => !v)}
                          className="flex items-center gap-1.5 text-[11px] font-bold text-violet-500 hover:text-violet-600 transition-colors"
                        >
                          <SlidersHorizontal size={12} />
                          {showLogoAdjust ? 'Hide adjustments' : 'Reposition & zoom'}
                        </button>
                        {showLogoAdjust && (
                          <LogoAdjustPanel
                            logoUrl={logoUrl}
                            adjust={logoAdjust}
                            onChange={setLogoAdjust}
                          />
                        )}
                      </>
                    )}
                  </div>
                  <ImageUploadZone
                    label="Cover / Hero Image"
                    hint="JPG or PNG · 1200 × 400 px recommended"
                    value={coverImageUrl}
                    onChange={setCoverImageUrl}
                    aspect="wide"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-[#E6E8EB]">Cuisine Type</label>
                    <input type="text" value={cuisineType} onChange={e => setCuisineType(e.target.value)}
                      placeholder="e.g. Café · Snacks · Beverages"
                      className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#1F2630] bg-transparent text-gray-700 dark:text-[#E6E8EB] focus:outline-none focus:border-violet-400 transition-colors" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-[#E6E8EB]">Opening Hours</label>
                    <input type="text" value={openingHours} onChange={e => setOpeningHours(e.target.value)}
                      placeholder="e.g. 8 AM – 10 PM"
                      className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#1F2630] bg-transparent text-gray-700 dark:text-[#E6E8EB] focus:outline-none focus:border-violet-400 transition-colors" />
                  </div>
                </div>
              </div>
            </Section>

            {/* Theme presets */}
            <Section icon={Wand2} title="Theme Presets" subtitle="One-click brand themes — customise further with the colour pickers below" iconColor="text-amber-500">
              <div className="grid grid-cols-3 gap-2.5">
                {THEME_PRESETS.map(preset => (
                  <button key={preset.id} onClick={() => applyPreset(preset)}
                    className="group relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: `linear-gradient(135deg, ${preset.colors.bgColor}, ${preset.colors.surfaceColor})`,
                      borderColor: colors.primary === preset.colors.primary && colors.bgColor === preset.colors.bgColor
                        ? preset.colors.primary : 'transparent',
                    }}>
                    <div className="w-8 h-8 rounded-xl shadow-md" style={{ backgroundColor: preset.colors.primary }} />
                    <div>
                      <div className="text-[11px] font-bold text-center leading-tight"
                        style={{ color: preset.colors.textColor }}>{preset.name}</div>
                      <div className="flex gap-1 justify-center mt-1.5">
                        {[preset.colors.primary, preset.colors.secondary, preset.colors.bgColor].map((c, i) => (
                          <div key={i} className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>

            {/* Colour controls */}
            <Section icon={Palette} title="Brand Colours" subtitle="Fine-tune the colour scheme for your portal" iconColor="text-rose-500">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { key: 'primary', label: 'Primary', hint: 'Buttons, accents, active states' },
                  { key: 'secondary', label: 'Secondary', hint: 'Prices, highlights' },
                  { key: 'bgColor', label: 'Background', hint: 'Page background' },
                  { key: 'surfaceColor', label: 'Surface', hint: 'Cards, panels' },
                  { key: 'textColor', label: 'Text', hint: 'Body text colour' },
                ].map(({ key, label, hint }) => (
                  <div key={key} className="space-y-1.5">
                    <div className="text-xs font-bold text-gray-700 dark:text-[#E6E8EB]">{label}</div>
                    <div className="flex items-center gap-2">
                      <label className="w-10 h-10 rounded-xl cursor-pointer ring-2 ring-offset-2 ring-gray-200 dark:ring-[#1F2630] overflow-hidden shrink-0 transition-transform hover:scale-105"
                        style={{ backgroundColor: colors[key] }}>
                        <input type="color" value={colors[key]} onChange={e => setColors({ ...colors, [key]: e.target.value })} className="opacity-0 w-full h-full cursor-pointer" />
                      </label>
                      <input type="text" value={colors[key]} onChange={e => setColors({ ...colors, [key]: e.target.value })}
                        className="flex-1 min-w-0 text-xs font-mono px-2 py-1.5 rounded-lg border border-gray-200 dark:border-[#1F2630] bg-transparent text-gray-700 dark:text-[#E6E8EB] focus:outline-none" />
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-[#7D8590]">{hint}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Font */}
            <Section icon={Wand2} title="Typography" subtitle="Font family for the ordering portal" iconColor="text-sky-500">
              <div className="grid grid-cols-2 gap-2">
                {FONTS.map(f => (
                  <button key={f.id} onClick={() => setFontFamily(f.id)}
                    className={`px-4 py-3 rounded-xl text-sm text-left transition-all border-2 ${fontFamily === f.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-gray-200 dark:border-[#1F2630] hover:border-violet-300'}`}>
                    <span className="font-bold text-gray-800 dark:text-[#E6E8EB]" style={{ fontFamily: f.id }}>{f.id}</span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">{f.name.split('—')[1]?.trim()}</span>
                  </button>
                ))}
              </div>
            </Section>

            {/* Menu layout */}
            <Section icon={LayoutGrid} title="Menu Layout" subtitle="How items are displayed on the menu tab" iconColor="text-emerald-500">
              <div className="grid grid-cols-2 gap-3">
                {LAYOUTS.map(l => {
                  const Icon = l.icon;
                  return (
                    <button key={l.id} onClick={() => setMenuLayout(l.id)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${menuLayout === l.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-gray-200 dark:border-[#1F2630] hover:border-emerald-300'}`}>
                      <Icon size={20} className={menuLayout === l.id ? 'text-emerald-500' : 'text-gray-400'} />
                      <div>
                        <div className={`text-sm font-bold ${menuLayout === l.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-[#E6E8EB]'}`}>{l.name}</div>
                        <div className="text-[11px] text-gray-400 dark:text-[#7D8590]">{l.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Portal link */}
            {selectedOutletId && (
              <Section icon={QrCode} title="Portal Link" subtitle="Share this link with customers to access the ordering portal" iconColor="text-blue-500">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 px-4 py-3 rounded-xl text-xs font-mono truncate"
                    style={{ background: 'rgba(128,128,128,0.08)', border: '1px solid rgba(128,128,128,0.15)', color: 'inherit' }}>
                    {portalUrl}
                  </div>
                  <button onClick={copyPortalUrl}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-bold transition-all text-white shrink-0"
                    style={{ background: copied ? '#22c55e' : 'linear-gradient(135deg, #4F8EF7, #4F46E5)', boxShadow: '0 4px 14px rgba(79,142,247,0.3)' }}>
                    <Copy size={14} />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-bold border border-gray-200 dark:border-[#1F2630] text-gray-600 dark:text-[#7D8590] hover:border-blue-400 transition-all shrink-0">
                    <ExternalLink size={14} />
                    Open
                  </a>
                </div>
                <div className="mt-2 px-4 py-2.5 rounded-xl text-xs" style={{ background: 'rgba(128,128,128,0.06)', border: '1px solid rgba(128,128,128,0.12)' }}>
                  <span className="font-bold text-gray-600 dark:text-[#7D8590]">Pickup PIN:</span>
                  <span className="ml-1.5 text-gray-500 dark:text-[#7D8590]">Auto-generated 4-digit PIN shown on every order for counter collection verification</span>
                </div>
              </Section>
            )}

            {/* Item tags editor */}
            {menuItems.length > 0 && (
              <Section icon={UtensilsCrossed} title="Item Badges" subtitle="Tag menu items — badges appear on item cards in the portal" iconColor="text-orange-500">
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {menuItems.filter(i => i.available !== false).map(item => {
                    const edits = itemTagEdits[item.id] || { is_bestseller: item.is_bestseller || false, tags: item.tags || [] };
                    return (
                      <div key={item.id} className="flex items-start gap-3 py-2.5 px-3 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
                        {item.image_url && (
                          <img src={item.image_url.startsWith('/') ? `http://localhost:8000${item.image_url}` : item.image_url}
                            alt={item.name} className="w-8 h-8 rounded-lg object-cover shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-gray-800 dark:text-[#E6E8EB] truncate">{item.name}</span>
                            <span className="text-[10px] text-gray-400">₹{item.price}</span>
                          </div>
                          <div className="flex gap-1.5 mt-1.5 flex-wrap">
                            <button onClick={() => toggleBestseller(item.id)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${edits.is_bestseller ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 dark:border-white/10 text-gray-400 hover:border-amber-400'}`}>
                              Bestseller
                            </button>
                            {ITEM_TAGS.map(tag => (
                              <button key={tag} onClick={() => toggleItemTag(item.id, tag)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${edits.tags.includes(tag) ? 'bg-violet-500 border-violet-500 text-white' : 'border-gray-200 dark:border-white/10 text-gray-400 hover:border-violet-400'}`}>
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {Object.keys(itemTagEdits).length > 0 && (
                  <button onClick={saveItemTags} disabled={tagSaving}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
                    style={{ background: tagSaveSuccess ? '#22c55e' : 'linear-gradient(135deg, #F97316, #EF4444)' }}>
                    {tagSaving ? <Loader2 size={15} className="animate-spin" /> : tagSaveSuccess ? <CheckCircle2 size={15} /> : <Save size={15} />}
                    {tagSaving ? 'Saving badges…' : tagSaveSuccess ? 'Badges saved!' : `Save ${Object.keys(itemTagEdits).length} badge change${Object.keys(itemTagEdits).length > 1 ? 's' : ''}`}
                  </button>
                )}
              </Section>
            )}
          </div>

          {/* Right: Preview */}
          <div className="xl:sticky xl:top-6 xl:self-start space-y-4">
            <div className="bg-white/90 dark:bg-[#12161C]/90 backdrop-blur-xl border border-gray-200 dark:border-[#1F2630] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Smartphone size={16} className="text-violet-500" />
                  <span className="text-sm font-bold text-gray-800 dark:text-[#E6E8EB]">Live Preview</span>
                </div>
                {menuItems.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {menuItems.length} items
                  </span>
                )}
              </div>
              <MobilePreview
                colors={colors}
                fontFamily={fontFamily}
                logoUrl={logoUrl}
                restaurantName={(portalNameMode === 'company' ? companyName : selectedOutlet?.name) || 'Restaurant'}
                menuLayout={menuLayout}
                menuItems={menuItems}
              />
              <p className="text-center text-[10px] text-gray-400 dark:text-[#7D8590] mt-4">
                This is a visual approximation. Open the portal link for the full experience.
              </p>
            </div>

            {/* Feature summary */}
            <div className="bg-white/90 dark:bg-[#12161C]/90 backdrop-blur-xl border border-gray-200 dark:border-[#1F2630] rounded-2xl p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-[#7D8590]">What's included</p>
              {[
                { Icon: Palette, text: 'Fully whitelabeled — your colours, logo & font' },
                { Icon: ShieldCheck, text: requireIdentity ? 'Identity gate ON — name + phone required' : 'Identity gate OFF — open access' },
                { Icon: Sparkles, text: aiDishSuggestion ? 'AI Dish Suggestions tab enabled' : 'AI tab disabled' },
                { Icon: Smartphone, text: 'Mobile-first bottom nav: Menu · AI · Cart' },
                { Icon: Hash, text: '4-digit pickup PIN on every order' },
                { Icon: ShoppingCart, text: 'Inline cart — no page redirect needed' },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-start gap-2.5">
                  <Icon className="w-4 h-4 shrink-0 mt-0.5 text-gray-400 dark:text-[#7D8590]" />
                  <span className="text-xs text-gray-600 dark:text-[#7D8590] leading-relaxed">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
