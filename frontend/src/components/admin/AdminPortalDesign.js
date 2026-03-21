import React, { useState, useEffect } from 'react';
import { api, getImageUrl } from '../../services/api';
import { Palette, Image as ImageIcon, LayoutTemplate, Type, Save, CheckCircle2, Loader2, Link } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const FONTS = [
  { id: 'Inter', name: 'Inter (Modern & Clean)' },
  { id: 'Playfair Display', name: 'Playfair Display (Elegant & Classic)' },
  { id: 'Roboto', name: 'Roboto (Functional & Clear)' },
  { id: 'Outfit', name: 'Outfit (Geometric & Friendly)' },
  { id: 'Merriweather', name: 'Merriweather (Sophisticated Serif)' },
  { id: 'Manrope', name: 'Manrope (Minimalist)' }
];

const AdminPortalDesign = () => {
  const { theme } = useTheme();
  const [outlets, setOutlets] = useState([]);
  const [selectedOutletId, setSelectedOutletId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form State
  const [logoUrl, setLogoUrl] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [colors, setColors] = useState({
    primary: '#1A1A1A',
    secondary: '#F59E0B',
    bgColor: '#FAFAFA',
    textColor: '#1A1A1A'
  });

  useEffect(() => {
    fetchOutlets();
  }, []);

  const fetchOutlets = async () => {
    try {
      const res = await api.getOutlets();
      if (res.data && res.data.length > 0) {
        setOutlets(res.data);
        const firstActive = res.data.find(o => o.status === 'Active') || res.data[0];
        handleSelectOutlet(firstActive.id, res.data);
      }
    } catch (error) {
      console.error('Failed to fetch outlets:', error);
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
        textColor: config.textColor || '#1A1A1A'
      });
    }
  };

  const handleFileUpload = async (file, type) => {
    if (!file) return;
    try {
      const data = new FormData();
      data.append('files', file);
      const res = await api.uploadFiles(data);
      if (res.data.urls && res.data.urls.length > 0) {
        if (type === 'logo') setLogoUrl(res.data.urls[0]);
        if (type === 'hero') setHeroImageUrl(res.data.urls[0]);
      }
    } catch (error) {
      console.error('Upload failed', error);
      alert('Failed to upload image. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!selectedOutletId) return;
    setSaving(true);
    try {
      // We will perform a partial update by fetching the outlet and updating its fields
      // The current edit outlet endpoint takes the full OutletCreate schema.
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
          heroImage: heroImageUrl
        }
      };

      await api.updateOutlet(selectedOutletId, updatedPayload);
      
      // Update local state to reflect changes without reloading
      setOutlets(outlets.map(o => o.id === selectedOutletId ? { ...o, portal_logo_url: logoUrl, portal_color_scheme: updatedPayload.portal_color_scheme, portal_custom_colors: true } : o));
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save design:', error);
      alert('Failed to save configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading portal configurations...</div>;
  }

  if (outlets.length === 0) {
    return <div className="p-8 text-center text-gray-500">Please create an outlet first before designing a portal.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Editor Pane */}
        <div className="flex-1 space-y-6">
          <div className="bg-white/90 dark:bg-[#12161C]/90 backdrop-blur-xl border border-gray-200 dark:border-[#1F2630] rounded-2xl p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB] mb-6 flex items-center gap-2">
              <LayoutTemplate size={20} className="text-purple-500" />
              Portal Configuration
            </h2>

            {/* Target Outlet Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-[#9CA3AF] mb-2">Target Location</label>
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

            <hr className="border-gray-100 dark:border-[#1F2630] mb-6" />

            {/* Brand Assets */}
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-[#E6E8EB] flex items-center gap-2">
                <ImageIcon size={16} className="text-blue-500" /> Brand Assets
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-[#7D8590] uppercase tracking-wider mb-2">Portal Logo</label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 px-4 py-2 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-400 rounded-xl text-center cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-colors font-medium text-sm">
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
                  <label className="block text-xs font-medium text-gray-500 dark:text-[#7D8590] uppercase tracking-wider mb-2">Hero Banner</label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 rounded-xl text-center cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors font-medium text-sm">
                      Upload Landscape Image
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
            </div>

            <hr className="border-gray-100 dark:border-[#1F2630] my-6" />

            {/* Typography */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-[#E6E8EB] flex items-center gap-2">
                <Type size={16} className="text-pink-500" /> Typography
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {FONTS.map(font => (
                  <button
                    key={font.id}
                    onClick={() => setFontFamily(font.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${fontFamily === font.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10 ring-1 ring-purple-500' : 'border-gray-200 dark:border-[#1F2630] bg-white dark:bg-black/20 hover:border-gray-300 dark:hover:border-gray-600'}`}
                  >
                    <div className="text-xs text-gray-500 dark:text-[#7D8590] mb-1 truncate">{font.name}</div>
                    <div className="text-lg text-gray-900 dark:text-[#E6E8EB] truncate" style={{ fontFamily: font.id }}>Ag</div>
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-gray-100 dark:border-[#1F2630] my-6" />

            {/* Color Palette */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-[#E6E8EB] flex items-center gap-2">
                <Palette size={16} className="text-amber-500" /> Color Palette
              </h3>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { key: 'primary', label: 'Primary Brand' },
                  { key: 'secondary', label: 'Accent / Actions' },
                  { key: 'bgColor', label: 'Background' },
                  { key: 'textColor', label: 'Text/Content' },
                ].map(c => (
                  <div key={c.key}>
                    <label className="block text-[11px] font-medium text-gray-500 dark:text-[#7D8590] uppercase tracking-wider mb-2">{c.label}</label>
                    <div className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-black/20">
                      <input
                        type="color"
                        value={colors[c.key]}
                        onChange={(e) => setColors({ ...colors, [c.key]: e.target.value })}
                        className="w-8 h-8 rounded border-0 p-0 cursor-pointer overflow-hidden"
                      />
                      <input
                        type="text"
                        value={colors[c.key].toUpperCase()}
                        onChange={(e) => setColors({ ...colors, [c.key]: e.target.value })}
                        className="w-full bg-transparent border-none text-sm text-gray-900 dark:text-[#E6E8EB] focus:ring-0 uppercase font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <a 
                href={`/order/${selectedOutletId}`} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:underline"
              >
                <Link size={14} /> Open Live Portal
              </a>
              <button
                onClick={handleSave}
                disabled={saving || !selectedOutletId}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : (saveSuccess ? <CheckCircle2 size={18} className="text-green-400" /> : <Save size={18} />)}
                {saveSuccess ? 'Saved!' : 'Save Design'}
              </button>
            </div>
            
          </div>
        </div>

        {/* Live Preview Pane */}
        <div className="w-full md:w-80 lg:w-96 flex-shrink-0">
          <div className="sticky top-6">
            <h3 className="text-sm font-semibold text-gray-500 dark:text-[#7D8590] uppercase tracking-wider mb-4 px-2">Live Preview</h3>
            
            {/* Mobile Device Mockup */}
            <div className="relative mx-auto border-gray-200 dark:border-[#2A313C] border-[8px] rounded-[2.5rem] h-[600px] w-[300px] overflow-hidden shadow-2xl bg-white transition-colors duration-500" style={{ backgroundColor: colors.bgColor, fontFamily }}>
              
              {/* Dynamic Font Import Hook */}
              <style dangerouslySetInnerHTML={{__html: `@import url('https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap');`}} />

              {/* Status Bar Mock */}
              <div className="absolute top-0 w-full h-6 z-10 flex justify-between px-6 pt-2" style={{ color: colors.textColor }}>
                 <div className="w-12 h-4 rounded-full bg-current opacity-20" />
                 <div className="w-16 h-4 rounded-full bg-current opacity-20" />
              </div>

              {/* Hero */}
              <div className="h-40 relative w-full border-b border-black/5" style={{ backgroundColor: colors.primary + '11' }}>
                {heroImageUrl ? (
                  <img src={getImageUrl(heroImageUrl)} alt="Hero" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs opacity-50" style={{ color: colors.textColor }}>Empty Hero Space</div>
                )}
                
                {/* Logo Overlap */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center p-2 border border-gray-100 overflow-hidden z-10">
                  {logoUrl ? <img src={getImageUrl(logoUrl)} alt="Logo" className="max-w-full max-h-full object-contain" /> : <Palette size={24} className="opacity-20" />}
                </div>
              </div>

              {/* Content Mockup */}
              <div className="pt-12 px-5 pb-6 text-center space-y-6">
                <div>
                  <h1 className="text-xl font-bold tracking-tight mb-1" style={{ color: colors.textColor }}>Kosmo Cafe</h1>
                  <p className="text-xs opacity-60 uppercase tracking-widest" style={{ color: colors.textColor }}>Order & Dining</p>
                </div>

                <div className="space-y-3 pt-4 text-left">
                  <div className="text-[10px] font-semibold uppercase tracking-widest opacity-50" style={{ color: colors.textColor }}>Menu Preview</div>
                  
                  {/* Item Cards Mock */}
                  {[1, 2].map(i => (
                    <div key={i} className="rounded-2xl p-3 flex gap-4 shadow-sm border border-black/5" style={{ backgroundColor: theme === 'dark' ? '#ffffff05' : '#ffffff' }}>
                      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 opacity-20" style={{ backgroundColor: colors.secondary }} />
                      <div className="flex-1">
                        <div className="font-semibold text-sm mb-1 line-clamp-1" style={{ color: colors.textColor }}>Artisan Signature Item {i}</div>
                        <div className="text-xs opacity-60 line-clamp-1 mb-2" style={{ color: colors.textColor }}>Freshly prepared daily</div>
                        <div className="font-bold flex justify-between items-center text-sm" style={{ color: colors.secondary }}>
                           $14.00
                           <div className="w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: colors.primary }}>+</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-6 flex gap-2">
                   <div className="flex-1 py-3 rounded-xl font-bold text-sm text-white shadow-md transition-transform" style={{ backgroundColor: colors.primary }}>View Cart</div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPortalDesign;
