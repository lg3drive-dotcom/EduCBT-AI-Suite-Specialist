
import React, { useState } from 'react';

interface Props {
  currentImage?: string;
  onImageChange: (url: string | undefined) => void;
  label: string;
}

const ImageControl: React.FC<Props> = ({ currentImage, onImageChange, label }) => {
  const [urlInput, setUrlInput] = useState(currentImage || '');

  const handleApplyUrl = () => {
    if (urlInput.trim()) {
      onImageChange(urlInput.trim());
    } else {
      onImageChange(undefined);
    }
  };

  const openExternalTool = () => {
    window.open('https://pages.edgeone.ai/id/use-cases/image-to-url', '_blank');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
        {currentImage && (
          <button 
            onClick={() => {
              onImageChange(undefined);
              setUrlInput('');
            }}
            className="text-[10px] font-bold text-rose-500 hover:underline"
          >
            Hapus Gambar
          </button>
        )}
      </div>

      <div className="space-y-3">
        {currentImage && (
          <div className="relative group w-full h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-inner">
            <img src={currentImage} className="w-full h-full object-contain" alt="Preview" />
            <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
               <span className="bg-white/90 px-3 py-1 rounded-full text-[10px] font-black text-slate-700 shadow-sm uppercase">Pratinjau Aktif</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Tempelkan URL gambar di sini (http://...)" 
              className="flex-grow px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all shadow-sm"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyUrl()}
            />
            <button 
              type="button"
              onClick={handleApplyUrl}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 active:scale-95 transition-all shadow-md"
            >
              Pasang
            </button>
          </div>
          
          <button 
            type="button"
            onClick={openExternalTool}
            className="w-full py-2.5 px-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all group"
          >
            <svg className="w-4 h-4 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Ubah Gambar Menjadi URL
          </button>
          <p className="text-[9px] text-slate-400 font-medium italic text-center">
            * Gunakan tombol di atas jika Anda ingin mengunggah file gambar dari komputer/HP Anda.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ImageControl;
