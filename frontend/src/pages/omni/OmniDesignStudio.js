import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { api, getHeaders } from '../../services/api';
import { Save, Palette, Wand2, RefreshCw, Smartphone, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';

export default function OmniDesignStudio() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [settings, setSettings] = useState(null);
  const [prompt, setPrompt] = useState('');

  const [branding, setBranding] = useState({
    colors: { primary: '#4F46E5', secondary: '#1E1B4B', accent: '#F59E0B', background: '#F8FAFC', text: '#0F172A' },
    fonts: { heading: 'Inter', body: 'Roboto' },
    tagline: 'Empowering your craft.',
    voice: 'Professional and refined.',
    logoUrl: '',
    license_mode: 'service'
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.getCompanySettings();
      setSettings(res.data);
      if (res.data?.general_settings?.branding) {
        // Handle migration from old strictly simple branding
        const b = res.data.general_settings.branding;
        setBranding({
          colors: b.colors || { primary: b.primaryColor || '#4F46E5', secondary: '#1E1B4B', accent: '#F59E0B', background: '#ffffff', text: '#000000' },
          fonts: b.fonts || { heading: b.fontFamily || 'Inter', body: 'Roboto' },
          tagline: b.heroTagline || '',
          voice: b.voice || '',
          logoUrl: b.logoUrl || '',
          license_mode: b.license_mode || 'service'
        });
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updatedSettings = {
        ...settings,
        general_settings: {
          ...settings?.general_settings,
          branding: {
             ...branding,
             // backwards compatibility shims
             primaryColor: branding.colors.primary,
             fontFamily: branding.fonts.heading,
             heroTagline: branding.tagline
          }
        }
      };
      await api.updateCompanySettings(updatedSettings);
      alert('Brand Identity saved completely! Your portal design is instantly hot-swapped.');
    } catch (err) {
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const generateBrand = async () => {
    if (!prompt) return alert('Please describe your brand vision first!');
    setGenerating(true);
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/omni/generate-brand`, { prompt }, { headers: getHeaders() });
      setBranding(prev => ({
        ...prev,
        ...res.data
      }));
    } catch (error) {
      console.error("AI Generation Error: ", error);
      alert('Failed to generate brand identity.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="p-8">Loading Brand System...</div>;

  const bgStyle = theme === 'dark' ? 'bg-[#0B0D10] border-[#1F2630] text-gray-100' : 'bg-gray-50 border-gray-200 text-gray-900';
  const cardStyle = theme === 'dark' ? 'bg-[#171C22] border-[#1F2630]' : 'bg-white border-gray-100';

  return (
    <div className={`max-w-[1000px] mx-auto p-4 md:p-8 animate-in fade-in duration-500`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className={`text-3xl font-black flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            <Palette className="w-8 h-8 text-pink-500" /> Brand Identity Studio
          </h1>
          <p className="text-gray-500 font-medium tracking-wide mt-2">Generate your entire visual syntax and tone of voice using AI.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-3 bg-gradient-to-br from-pink-600 to-rose-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-xl hover:shadow-pink-500/20 hover:-translate-y-0.5 transition-all outline-none disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} {saving ? 'Applying...' : 'Apply Identity Global'}
        </button>
      </div>

      <div className="space-y-6">
         {/* Generative AI Input Block */}
         <div className={`p-8 rounded-[2rem] shadow-xl border overflow-hidden relative ${theme === 'dark' ? 'bg-gradient-to-br from-[#10141A] to-[#0A0D12] border-[#2A3143]' : 'bg-gradient-to-br from-[#FAFCFF] to-[#F1F5F9] border-blue-200'}`}>
            <div className="absolute top-0 right-0 p-8 opacity-10 blur-xl pointer-events-none">
              <Wand2 className="w-64 h-64 text-blue-500" />
            </div>
            <div className="flex items-center justify-between mb-4 relative z-10">
               <h2 className={`text-2xl font-black flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}><Wand2 className="w-6 h-6 text-blue-500" /> AI Identity Architect</h2>
            </div>
            <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} font-medium max-w-2xl relative z-10`}>
              Describe the feeling and aesthetic of your business. Our localized Answer Engine will automatically assemble a complete visual profile, picking exact harmonized HEX codes, typography pairs, and tone mapping perfectly aligned with your vision.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 relative z-10">
               <input 
                  type="text" 
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="e.g. 'We are a luxury, minimalist eco-friendly vegan bakery aiming for a chic aesthetic.'" 
                  className={`flex-1 rounded-2xl border-2 px-6 h-14 outline-none font-medium shadow-inner focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all ${theme === 'dark' ? 'bg-[#0B0D10] border-[#1F2630] text-white' : 'bg-white border-gray-300 text-gray-900'}`} 
               />
               <button 
                 onClick={generateBrand}
                 disabled={generating || !prompt}
                 className="flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 h-14 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all outline-none disabled:opacity-50 shrink-0"
               >
                 {generating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />} {generating ? 'Architecting...' : 'Generate Identity'}
               </button>
            </div>
         </div>

         {/* Extracted Architecture Panels */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left Col: Colors & Type */}
            <div className="space-y-6">
                <div className={`p-8 rounded-[2rem] shadow-sm border ${cardStyle}`}>
                  <h3 className={`text-lg font-bold mb-6 flex justify-between items-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    Color Architecture
                    <div className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-[#1A1A1A] text-gray-500">HEX Palette</div>
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                     {Object.entries(branding.colors).map(([key, val]) => (
                        <div key={key}>
                           <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{key}</label>
                           <div className="flex items-center gap-3">
                              <input type="color" value={val} onChange={(e) => setBranding({...branding, colors: {...branding.colors, [key]: e.target.value}})} className="w-12 h-12 rounded-xl cursor-pointer bg-transparent border-0 p-0 shadow-sm" />
                              <input type="text" value={val} onChange={(e) => setBranding({...branding, colors: {...branding.colors, [key]: e.target.value}})} className={`font-mono text-sm uppercase rounded-lg border px-3 h-10 w-full outline-none focus:ring-2 focus:ring-pink-500 ${bgStyle}`} />
                           </div>
                        </div>
                     ))}
                  </div>
                </div>

                <div className={`p-8 rounded-[2rem] shadow-sm border ${cardStyle}`}>
                  <h3 className={`text-lg font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Typography Pairings</h3>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Heading Font (e.g. Playfair Display)</label>
                      <input type="text" value={branding.fonts.heading} onChange={e => setBranding({...branding, fonts:{...branding.fonts, heading: e.target.value}})} className={`w-full rounded-xl border px-4 h-12 outline-none font-bold ${bgStyle}`} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Body Font (e.g. Inter)</label>
                      <input type="text" value={branding.fonts.body} onChange={e => setBranding({...branding, fonts:{...branding.fonts, body: e.target.value}})} className={`w-full rounded-xl border px-4 h-12 outline-none ${bgStyle}`} />
                    </div>
                  </div>
                </div>
            </div>

            {/* Right Col: Voice, Tone, Logo, Mode */}
            <div className="space-y-6">
                <div className={`p-8 rounded-[2rem] shadow-sm border ${cardStyle}`}>
                  <h3 className={`text-lg font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Tone & Tagline</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Brand Voice Archetype</label>
                      <textarea rows={2} value={branding.voice} onChange={e => setBranding({...branding, voice: e.target.value})} placeholder="e.g. Friendly, Modern, Elite" className={`w-full rounded-xl border p-4 outline-none resize-none text-sm ${bgStyle}`} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">AI Generated Tagline</label>
                      <input type="text" value={branding.tagline} onChange={e => setBranding({...branding, tagline: e.target.value})} className={`w-full rounded-xl border px-4 h-12 outline-none font-bold text-sm ${bgStyle}`} />
                    </div>
                  </div>
                </div>

                <div className={`p-8 rounded-[2rem] shadow-sm border ${cardStyle}`}>
                   <h3 className={`text-lg font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Assets & Platform License</h3>
                   
                   <div className="mb-6">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> Logo URL</label>
                      <input type="text" value={branding.logoUrl} onChange={e => setBranding({...branding, logoUrl: e.target.value})} placeholder="https://..." className={`w-full rounded-xl border px-4 h-12 outline-none text-sm ${bgStyle}`} />
                   </div>

                   <div className={`p-5 rounded-2xl border-2 shadow-inner bg-gradient-to-r ${theme === 'dark' ? 'from-[#0B0D10] to-[#111] border-indigo-500/30' : 'from-indigo-50 to-white border-indigo-200'}`}>
                      <label className="block text-xs font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                         <Smartphone className="w-4 h-4" /> Next.js Router Mode
                      </label>
                      <select 
                        value={branding.license_mode} 
                        onChange={(e) => setBranding({...branding, license_mode: e.target.value})}
                        className={`w-full rounded-xl border-2 px-4 h-14 outline-none font-bold tracking-wide focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 cursor-pointer ${theme === 'dark' ? 'bg-[#171C22] border-[#1F2630] text-white' : 'bg-white border-indigo-100 text-indigo-900'}`}
                      >
                        <option value="service" className="font-bold">Service Component (Checkouts, Salons)</option>
                        <option value="restaurant" className="font-bold">Restaurant Component (Menus, Carts)</option>
                        <option value="hybrid" className="font-bold">Hybrid License (Both Architectures)</option>
                      </select>
                      <p className="text-xs text-indigo-400 mt-3 font-semibold">Toggling this instantly rewires the Next.js portal layout and routing rules.</p>
                   </div>
                </div>
            </div>

         </div>
      </div>
    </div>
  );
}
