import React, { useState } from 'react';
import { Smartphone, Monitor } from 'lucide-react';

export default function OmniPreview() {
  const [device, setDevice] = useState('desktop');

  return (
    <div className="w-full h-[calc(100vh-100px)] animate-in fade-in flex flex-col">
       <div className="mb-4 flex justify-between items-center bg-white dark:bg-[#171C22] p-4 rounded-2xl shadow-sm border dark:border-[#1F2630]">
          <div>
            <h1 className="text-xl font-bold dark:text-white">Live Portal Preview</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Previewing exactly what your customers see.</p>
          </div>
          <div className="flex gap-4">
             <div className="flex bg-gray-100 dark:bg-[#0B0D10] p-1 rounded-lg">
                <button 
                  onClick={() => setDevice('mobile')} 
                  className={`p-2 rounded-md flex items-center gap-2 transition-all ${device === 'mobile' ? 'bg-white dark:bg-[#1F2630] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Smartphone className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setDevice('desktop')} 
                  className={`p-2 rounded-md flex items-center gap-2 transition-all ${device === 'desktop' ? 'bg-white dark:bg-[#1F2630] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Monitor className="w-4 h-4" />
                </button>
             </div>
             <a href="http://localhost:3001" target="_blank" rel="noreferrer" className="px-5 py-2.5 text-sm font-bold bg-purple-600 text-white hover:bg-purple-700 transition-colors rounded-xl shadow-md flex items-center gap-2">
                Open Fullscreen
             </a>
          </div>
       </div>
       <div className="flex-1 rounded-3xl overflow-hidden bg-gray-100 dark:bg-black flex justify-center items-center relative border dark:border-[#1F2630] p-4">
          <div className={`transition-all duration-500 ease-in-out shadow-2xl overflow-hidden rounded-[2rem] border-4 border-gray-300 dark:border-gray-800 bg-white ${device === 'mobile' ? 'w-[375px] h-[812px]' : 'w-full h-full'}`}>
             <iframe 
                src="http://localhost:3001" 
                className="w-full h-full" 
                title="Omni Preview" 
             />
          </div>
       </div>
    </div>
  );
}
