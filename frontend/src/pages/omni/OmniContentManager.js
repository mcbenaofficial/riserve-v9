import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { api, getHeaders } from '../../services/api';
import { Save, FileText, Image as ImageIcon, Users, MessageSquare, Plus, Trash2, Home, UploadCloud, GripHorizontal, ChevronUp, ChevronDown, Check, X, Camera } from 'lucide-react';
import axios from 'axios';

export default function OmniContentManager() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaTargetCallback, setMediaTargetCallback] = useState(null);

  // Core CMS State Graph
  const [cms, setCms] = useState({
    pages: {
      home: { sections: [] },
      about: { sections: [] },
      services: { sections: [] },
      team: { sections: [] },
      gallery: { sections: [] },
      contact: { sections: [] }
    },
    media_library: []
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.getCompanySettings();
      setSettings(res.data);
      if (res.data?.general_settings?.cms_content?.pages) {
        setCms(res.data.general_settings.cms_content);
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
          cms_content: cms
        }
      };
      await api.updateCompanySettings(updatedSettings);
      alert('Content Graph saved securely. Portal will rerender on next load.');
    } catch (err) {
      alert('Failed to save content graph.');
    } finally {
      setSaving(false);
    }
  };

  // --- MEDIA LIBRARY FUNCTIONS ---
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    for(let i=0; i<files.length; i++) {
        formData.append('files', files[i]);
    }
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:8000/api'}/upload`, formData, {
         headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' }
      });
      if(res.data && res.data.urls) {
          const newMedia = res.data.urls.map(url => ({
              id: Math.random().toString(36).substr(2, 9),
              url: `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${url}`,
              name: url.split('/').pop(),
              created_at: new Date().toISOString()
          }));
          setCms(prev => ({
              ...prev,
              media_library: [...newMedia, ...prev.media_library]
          }));
      }
    } catch(err) {
      console.error(err);
      alert('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const deleteMedia = (id) => {
      setCms(prev => ({
          ...prev,
          media_library: prev.media_library.filter(m => m.id !== id)
      }));
  };

  const openMediaPicker = (callback) => {
      setMediaTargetCallback(() => callback);
      setMediaModalOpen(true);
  };

  const selectMedia = (url) => {
      if(mediaTargetCallback) mediaTargetCallback(url);
      setMediaModalOpen(false);
      setMediaTargetCallback(null);
  };

  // --- NODE BUILDER FUNCTIONS ---
  const addSection = (page, type) => {
    const newSection = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      data: {}
    };
    if(type === 'hero') newSection.data = { headline: '', subhead: '', image: '', button_text: '' };
    if(type === 'text') newSection.data = { title: '', content: '' };
    if(type === 'features') newSection.data = { title: '', items: [] };
    if(type === 'gallery') newSection.data = { title: '', images: [] };

    setCms(prev => ({
      ...prev,
      pages: {
        ...prev.pages,
        [page]: {
          ...prev.pages[page],
          sections: [...prev.pages[page].sections, newSection]
        }
      }
    }));
  };

  const updateSection = (page, index, newData) => {
    const updatedSections = [...cms.pages[page].sections];
    updatedSections[index].data = { ...updatedSections[index].data, ...newData };
    setCms(prev => ({
      ...prev,
      pages: { ...prev.pages, [page]: { ...prev.pages[page], sections: updatedSections } }
    }));
  };

  const removeSection = (page, index) => {
    const updatedSections = [...cms.pages[page].sections];
    updatedSections.splice(index, 1);
    setCms(prev => ({
      ...prev,
      pages: { ...prev.pages, [page]: { ...prev.pages[page], sections: updatedSections } }
    }));
  };

  const moveSection = (page, index, direction) => {
    const updatedSections = [...cms.pages[page].sections];
    if (direction === -1 && index > 0) {
      [updatedSections[index-1], updatedSections[index]] = [updatedSections[index], updatedSections[index-1]];
    } else if (direction === 1 && index < updatedSections.length - 1) {
      [updatedSections[index+1], updatedSections[index]] = [updatedSections[index], updatedSections[index+1]];
    }
    setCms(prev => ({
      ...prev,
      pages: { ...prev.pages, [page]: { ...prev.pages[page], sections: updatedSections } }
    }));
  };

  if (loading) return <div className="p-8">Loading Architecture Tree...</div>;

  const bgStyle = theme === 'dark' ? 'bg-[#0B0D10] border-[#1F2630] text-gray-100' : 'bg-gray-50 border-gray-200 text-gray-900';
  const cardStyle = theme === 'dark' ? 'bg-[#171C22] border-[#1F2630]' : 'bg-white border-gray-100';

  return (
    <div className={`max-w-[1200px] mx-auto p-4 md:p-8 animate-in fade-in duration-500`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className={`text-3xl font-black flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            <FileText className="w-8 h-8 text-pink-500" /> Page Builder
          </h1>
          <p className="text-gray-500 font-medium tracking-wide mt-2">Construct your site blocks, manage uploaded media, and draft content.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-3 bg-gradient-to-br from-pink-600 to-rose-600 text-white px-8 py-4 rounded-xl font-bold shadow-xl hover:shadow-pink-500/20 hover:-translate-y-0.5 transition-all outline-none disabled:opacity-50"
        >
          {saving ? 'Publishing...' : <><Save className="w-5 h-5" /> Publish to Edge</>}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Sidebar Nav */}
        <div className="w-full lg:w-64 shrink-0 space-y-2 sticky top-8">
           <div className="mb-4 text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">Pages</div>
           {[
             { id: 'home', label: 'Home Page', icon: Home },
             { id: 'about', label: 'About Us', icon: FileText },
             { id: 'services', label: 'Services Wrapper', icon: Users },
             { id: 'team', label: 'Our Team', icon: Users },
             { id: 'gallery', label: 'Gallery', icon: ImageIcon },
             { id: 'contact', label: 'Contact', icon: MessageSquare },
           ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 border border-pink-200 dark:border-pink-800' 
                    : `border border-transparent ${theme === 'dark' ? 'text-gray-400 hover:bg-[#1F2630]' : 'text-gray-600 hover:bg-gray-100'}`
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
           ))}

           <div className="mt-8 mb-4 pt-4 border-t border-gray-200 dark:border-[#1F2630] text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">Repository</div>
           <button
              onClick={() => setActiveTab('media')}
              className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl font-bold transition-all ${
                activeTab === 'media' 
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800' 
                  : `border border-transparent ${theme === 'dark' ? 'text-gray-400 hover:bg-[#1F2630]' : 'text-gray-600 hover:bg-gray-100'}`
              }`}
            >
              <UploadCloud className="w-5 h-5" />
              Media Library
            </button>
        </div>

        {/* Content Node Editor */}
        <div className={`flex-1 w-full p-6 md:p-10 rounded-3xl shadow-sm border ${cardStyle}`}>
           {activeTab === 'media' ? (
             <div className="animate-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-center mb-8">
                  <h2 className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Global Media Library</h2>
                  <label className="cursor-pointer flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all hover:-translate-y-0.5">
                      <UploadCloud className="w-5 h-5" />
                      {uploading ? 'Uploading...' : 'Upload Files'}
                      <input type="file" multiple className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading}/>
                  </label>
                </div>

                {cms.media_library.length === 0 ? (
                  <div className="text-center py-24 border-2 border-dashed rounded-3xl border-gray-200 dark:border-gray-800 text-gray-500 font-medium">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    Drop files or click Upload above to build your repository.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {cms.media_library.map(media => (
                      <div key={media.id} className="group relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-black aspect-square">
                        <img src={media.url} alt="media" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-2">
                           <button onClick={() => deleteMedia(media.id)} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-lg"><Trash2 className="w-4 h-4" /></button>
                           <button onClick={() => {navigator.clipboard.writeText(media.url); alert("Copied!")}} className="bg-white text-black p-2 rounded-full shadow-lg text-xs font-bold">Copy URL</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
           ) : (
             <div className="animate-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-center mb-10">
                   <div>
                      <h2 className={`text-3xl font-black capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{activeTab} Page Canvas</h2>
                      <p className="text-gray-500 font-medium text-sm mt-1">Structure the blocks rendered on this page.</p>
                   </div>
                   
                   <div className="relative group cursor-pointer inline-block">
                     <button className="flex items-center gap-2 bg-gray-100 dark:bg-[#1F2630] hover:bg-gray-200 dark:hover:bg-[#2A3441] text-gray-800 dark:text-white font-bold py-3 px-6 rounded-xl transition-colors">
                        <Plus className="w-5 h-5"/> Add Node
                     </button>
                     <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#0B0D10] border dark:border-[#1F2630] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 overflow-hidden">
                        {[
                          {type: 'hero', label: 'Hero Banner'},
                          {type: 'text', label: 'Rich Text'},
                          {type: 'features', label: 'Feature Grid'},
                          {type: 'gallery', label: 'Image Deck'}
                        ].map(opt => (
                           <div key={opt.type} onClick={() => addSection(activeTab, opt.type)} className="px-5 py-3 hover:bg-gray-50 dark:hover:bg-[#171C22] text-sm font-bold text-gray-700 dark:text-gray-300 border-b last:border-0 dark:border-[#1F2630]">
                             + {opt.label}
                           </div>
                        ))}
                     </div>
                   </div>
                </div>

                {cms.pages[activeTab].sections.length === 0 ? (
                  <div className="text-center py-24 border-2 border-dashed rounded-3xl border-pink-200 dark:border-pink-900/30 bg-pink-50/50 dark:bg-pink-900/10 text-pink-600 dark:text-pink-400 font-medium">
                    <Layout className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    This page is empty. Start adding nodes from the top right.
                  </div>
                ) : (
                  <div className="space-y-6">
                     {cms.pages[activeTab].sections.map((section, index) => (
                        <div key={section.id} className={`rounded-2xl border-2 transition-all group ${theme === 'dark' ? 'bg-[#0B0D10] border-[#1F2630] hover:border-gray-600' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                           {/* Node Header */}
                           <div className={`p-4 border-b flex justify-between items-center rounded-t-xl ${theme === 'dark' ? 'bg-[#171C22] border-[#1F2630]' : 'bg-white border-gray-200'}`}>
                              <div className="flex items-center gap-3">
                                 <GripHorizontal className="w-5 h-5 text-gray-400 cursor-grab" />
                                 <span className="font-black text-sm tracking-wide uppercase text-pink-500">{section.type} BLOCK</span>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => moveSection(activeTab, index, -1)} className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white rounded bg-gray-100 dark:bg-black"><ChevronUp className="w-4 h-4"/></button>
                                <button onClick={() => moveSection(activeTab, index, 1)} className="p-1.5 text-gray-400 hover:text-black dark:hover:text-white rounded bg-gray-100 dark:bg-black"><ChevronDown className="w-4 h-4"/></button>
                                <div className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1 align-middle"></div>
                                <button onClick={() => removeSection(activeTab, index)} className="p-1.5 text-red-400 hover:text-red-500 rounded bg-red-50 dark:bg-red-900/20"><Trash2 className="w-4 h-4"/></button>
                              </div>
                           </div>
                           
                           {/* Node Editor Canvas */}
                           <div className="p-6">
                              {section.type === 'hero' && (
                                <div className="space-y-5">
                                   <div className="flex gap-4">
                                      <div className="flex-1 space-y-4">
                                        <input type="text" value={section.data.headline || ''} onChange={(e) => updateSection(activeTab, index, {headline: e.target.value})} placeholder="Hero Headline (e.g. Master your craft)" className={`w-full rounded-xl border px-4 h-12 outline-none font-bold text-lg ${bgStyle}`} />
                                        <textarea rows={2} value={section.data.subhead || ''} onChange={(e) => updateSection(activeTab, index, {subhead: e.target.value})} placeholder="Subtitle paragraph..." className={`w-full rounded-xl border p-4 outline-none resize-none ${bgStyle}`} />
                                      </div>
                                      <div className="w-48 shrink-0">
                                         <div 
                                           onClick={() => openMediaPicker((url) => updateSection(activeTab, index, {image: url}))}
                                           className={`w-full h-full min-h-[#120px] rounded-xl border-2 border-dashed flex flex-col justify-center items-center cursor-pointer overflow-hidden transition-all ${theme === 'dark' ? 'border-gray-700 hover:border-pink-500 bg-[#171C22]' : 'border-gray-300 hover:border-pink-500 bg-white'}`}
                                         >
                                            {section.data.image ? (
                                              <img src={section.data.image} alt="hero" className="w-full h-full object-cover" />
                                            ) : (
                                              <div className="text-gray-400 font-bold text-xs flex flex-col items-center gap-2 mt-4 mb-4"><Camera className="w-6 h-6"/> Attach Media</div>
                                            )}
                                         </div>
                                      </div>
                                   </div>
                                </div>
                              )}

                              {section.type === 'text' && (
                                <div className="space-y-4">
                                   <input type="text" value={section.data.title || ''} onChange={(e) => updateSection(activeTab, index, {title: e.target.value})} placeholder="Section Title..." className={`w-full rounded-xl border px-4 h-12 outline-none font-bold ${bgStyle}`} />
                                   <textarea rows={5} value={section.data.content || ''} onChange={(e) => updateSection(activeTab, index, {content: e.target.value})} placeholder="Rich text content here..." className={`w-full rounded-xl border p-4 outline-none resize-none ${bgStyle}`} />
                                </div>
                              )}

                              {section.type === 'features' && (
                                <div className="space-y-4">
                                   <input type="text" value={section.data.title || ''} onChange={(e) => updateSection(activeTab, index, {title: e.target.value})} placeholder="Features Wrapper Title..." className={`w-full rounded-xl border px-4 h-12 outline-none font-bold ${bgStyle}`} />
                                   
                                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                      {(section.data.items || []).map((item, i) => (
                                         <div key={i} className={`p-4 rounded-xl border relative ${theme === 'dark' ? 'bg-[#171C22] border-[#1F2630]' : 'bg-white border-gray-200'}`}>
                                            <button onClick={() => {
                                              const newItems = [...section.data.items]; newItems.splice(i, 1);
                                              updateSection(activeTab, index, {items: newItems});
                                            }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3"/></button>
                                            <div 
                                              onClick={() => openMediaPicker((url) => {
                                                const newItems = [...section.data.items]; newItems[i].image = url; updateSection(activeTab, index, {items: newItems});
                                              })}
                                              className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 mb-3 cursor-pointer overflow-hidden flex items-center justify-center border border-gray-200 dark:border-gray-700 hover:border-pink-500"
                                            >
                                                {item.image ? <img src={item.image} alt="icon" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-gray-400"/>}
                                            </div>
                                            <input type="text" value={item.title || ''} onChange={e => {
                                              const newItems = [...section.data.items]; newItems[i].title = e.target.value; updateSection(activeTab, index, {items: newItems});
                                            }} placeholder="Item Title" className={`w-full mb-2 bg-transparent border-b border-dashed dark:border-gray-700 outline-none font-bold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}/>
                                            <textarea rows={2} value={item.desc || ''} onChange={e => {
                                              const newItems = [...section.data.items]; newItems[i].desc = e.target.value; updateSection(activeTab, index, {items: newItems});
                                            }} placeholder="Item description" className={`w-full bg-transparent border-none outline-none text-xs text-gray-500 resize-none`}/>
                                         </div>
                                      ))}
                                      <button onClick={() => {
                                        const newItems = [...(section.data.items || []), {title: '', desc: '', image: ''}];
                                        updateSection(activeTab, index, {items: newItems});
                                      }} className={`p-4 flex flex-col justify-center items-center gap-2 text-sm font-bold rounded-xl border-2 border-dashed ${theme === 'dark' ? 'border-[#1F2630] text-gray-400 hover:border-pink-500 bg-[#0B0D10]' : 'border-gray-300 text-gray-500 hover:border-pink-500'}`}>
                                          <Plus className="w-6 h-6"/> Add Block
                                      </button>
                                   </div>
                                </div>
                              )}

                              {section.type === 'gallery' && (
                                <div className="space-y-4">
                                   <input type="text" value={section.data.title || ''} onChange={(e) => updateSection(activeTab, index, {title: e.target.value})} placeholder="Gallery Title (optional)" className={`w-full rounded-xl border px-4 h-12 outline-none font-bold ${bgStyle}`} />
                                   
                                   <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                      {(section.data.images || []).map((imgUrl, i) => (
                                         <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 group">
                                            <img src={imgUrl} alt="gallery" className="w-full h-full object-cover" />
                                            <button onClick={() => {
                                              const newImgs = [...section.data.images]; newImgs.splice(i, 1);
                                              updateSection(activeTab, index, {images: newImgs});
                                            }} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3"/></button>
                                         </div>
                                      ))}
                                      <button onClick={() => openMediaPicker((url) => {
                                        const newImgs = [...(section.data.images || []), url];
                                        updateSection(activeTab, index, {images: newImgs});
                                      })} className={`aspect-square flex flex-col justify-center items-center gap-2 rounded-xl border-2 border-dashed ${theme === 'dark' ? 'border-[#1F2630] hover:border-pink-500' : 'border-gray-300 hover:border-pink-500'}`}>
                                         <Plus className="w-6 h-6 text-gray-400"/>
                                      </button>
                                   </div>
                                </div>
                              )}
                           </div>
                        </div>
                     ))}
                  </div>
                )}
             </div>
           )}
        </div>
      </div>

      {/* Media Library Picker Modal */}
      {mediaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 md:p-10 animate-in fade-in">
           <div className={`w-full max-w-5xl h-full max-h-[80vh] flex flex-col rounded-[2xl] shadow-2xl border ${theme === 'dark' ? 'bg-[#0B0D10] border-[#1F2630]' : 'bg-white border-gray-200'}`}>
              <div className={`p-6 border-b flex justify-between items-center ${theme === 'dark' ? 'border-[#1F2630]' : 'border-gray-100'}`}>
                 <h2 className={`text-2xl font-black flex items-center gap-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}><ImageIcon className="w-6 h-6 text-blue-500"/> Select from Repository</h2>
                 <button onClick={() => setMediaModalOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#1F2630] text-gray-500"><X className="w-6 h-6"/></button>
              </div>
              <div className="flex-1 overflow-auto p-6 bg-gray-50 dark:bg-[#171C22]">
                 {cms.media_library.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 font-medium">Repository is empty. Go to the Media Library tab to upload globally.</div>
                 ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {cms.media_library.map(media => (
                        <div key={media.id} onClick={() => selectMedia(media.url)} className="cursor-pointer group relative rounded-xl overflow-hidden border-2 border-transparent hover:border-blue-500 bg-gray-100 dark:bg-black aspect-square transition-all focus:scale-95 shadow-sm hover:shadow-xl">
                          <img src={media.url} alt="media" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
// Using lucide-react Layout component fallback
const Layout = ({className}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>;
