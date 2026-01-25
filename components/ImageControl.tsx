
import React, { useState } from 'react';
import { generateImage } from '../geminiService';

interface Props {
  currentImage?: string;
  onImageChange: (base64: string | undefined) => void;
  label: string;
}

const ImageControl: React.FC<Props> = ({ currentImage, onImageChange, label }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      const base64 = await generateImage(aiPrompt);
      onImageChange(base64);
      setShowAiInput(false);
    } catch (err) {
      alert("Gagal men-generate gambar AI.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
        {currentImage && (
          <button 
            onClick={() => onImageChange(undefined)}
            className="text-xs text-red-500 hover:underline"
          >
            Hapus Gambar
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {currentImage ? (
          <div className="relative group w-24 h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
            <img src={currentImage} className="w-full h-full object-contain" alt="Preview" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
               <span className="text-[10px] text-white font-bold">Terpasang</span>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 w-full">
            <label className="flex-1 flex flex-col items-center justify-center py-4 px-2 border-2 border-dashed border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-all">
              <svg className="w-5 h-5 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span className="text-[10px] text-slate-500 font-semibold">Upload</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
            </label>
            
            <button 
              type="button"
              onClick={() => setShowAiInput(!showAiInput)}
              className="flex-1 flex flex-col items-center justify-center py-4 px-2 border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-all"
            >
              <svg className="w-5 h-5 text-indigo-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[10px] text-indigo-500 font-semibold">AI Generate</span>
            </button>
          </div>
        )}
      </div>

      {showAiInput && (
        <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 space-y-2">
          <input 
            type="text" 
            placeholder="Deskripsikan gambar..." 
            className="w-full px-3 py-1.5 text-xs rounded border border-indigo-200 outline-none focus:ring-1 focus:ring-indigo-500"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAiInput(false)} className="text-[10px] text-slate-500">Batal</button>
            <button 
              onClick={handleAiGenerate}
              disabled={isGenerating}
              className="px-3 py-1 bg-indigo-600 text-white rounded text-[10px] font-bold disabled:bg-slate-400"
            >
              {isGenerating ? 'Generating...' : 'Buat Sekarang'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageControl;
