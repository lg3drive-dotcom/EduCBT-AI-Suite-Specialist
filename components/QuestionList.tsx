
import React, { useState } from 'react';
import { EduCBTQuestion, QuestionType } from '../types';

interface Props {
  questions: EduCBTQuestion[];
  onEdit: (q: EduCBTQuestion) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onRegenerate?: (id: string, instructions?: string) => void;
  onPermanentDelete?: (id: string) => void;
  onQuickUpdate?: (id: string, field: 'order' | 'quizToken', value: string | number) => void;
  isTrashView?: boolean;
}

const QuestionList: React.FC<Props> = ({ 
  questions, 
  onEdit, 
  onDelete, 
  onRestore, 
  onRegenerate,
  onPermanentDelete, 
  onQuickUpdate,
  isTrashView = false 
}) => {
  const [promptingId, setPromptingId] = useState<string | null>(null);
  const [regenPrompt, setRegenPrompt] = useState('');

  if (questions.length === 0) return null;

  const handleStartRegen = (id: string) => {
    setPromptingId(id);
    setRegenPrompt('');
  };

  const handleConfirmRegen = (id: string) => {
    if (onRegenerate) {
      onRegenerate(id, regenPrompt);
    }
    setPromptingId(null);
  };

  return (
    <div className="space-y-6">
      {questions.map((q, idx) => {
        const typeStr = (q.type || "").toLowerCase();
        const isMultiChoice = 
          q.type === QuestionType.MCMA || 
          q.type === QuestionType.Kompleks ||
          typeStr.includes('jamak') ||
          typeStr.includes('kompleks');
        
        return (
          <div key={q.id} className={`relative bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${isTrashView ? 'opacity-75 border-slate-200 grayscale-[0.3]' : 'border-slate-200 hover:border-indigo-200'}`}>
            {/* Loading Overlay Per Card */}
            {q.isRegenerating && (
              <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center backdrop-blur-[1px]">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest text-center px-4">AI sedang merancang soal pengganti...</span>
              </div>
            )}

            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                {/* Edit Nomor Urut Langsung */}
                <div className="flex items-center gap-1.5" title="Ubah Nomor Urut">
                  <span className="text-[10px] font-black text-slate-400">#</span>
                  <input 
                    type="number"
                    className="w-12 px-1.5 py-1 bg-white border border-slate-200 rounded text-xs font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    value={q.order || 0}
                    onChange={(e) => onQuickUpdate && onQuickUpdate(q.id, 'order', parseInt(e.target.value) || 0)}
                  />
                </div>
                
                {/* Edit Token Langsung */}
                <div className="flex items-center gap-1.5" title="Ubah Token Paket">
                  <span className="text-[10px] font-black text-slate-400">TOKEN:</span>
                  <input 
                    type="text"
                    className="w-24 px-1.5 py-1 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    value={q.quizToken || ''}
                    placeholder="ID Paket"
                    onChange={(e) => onQuickUpdate && onQuickUpdate(q.id, 'quizToken', e.target.value)}
                  />
                </div>

                <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>
                
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 hidden sm:inline">
                  {q.level} • {q.type}
                </span>
              </div>
              
              <div className="flex items-center gap-1">
                {!isTrashView ? (
                  <>
                    <button 
                      type="button"
                      disabled={q.isRegenerating}
                      onClick={() => handleStartRegen(q.id)}
                      className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${promptingId === q.id ? 'bg-emerald-600 text-white' : 'text-emerald-600 hover:bg-emerald-50'}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      <span className="text-[9px] font-black uppercase">{promptingId === q.id ? 'Input...' : 'Ganti'}</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => onEdit(q)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      <span className="text-[9px] font-black uppercase">Edit</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => onDelete(q.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      <span className="text-[9px] font-black uppercase">Hapus</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      type="button"
                      onClick={() => onRestore && onRestore(q.id)}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      <span className="text-[9px] font-black uppercase">Pulihkan</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Form Instruksi Regenerate */}
            {promptingId === q.id && (
              <div className="bg-emerald-50 p-4 border-b border-emerald-100 flex flex-col gap-3 animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                   <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Instruksi Khusus untuk Soal Baru:</label>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    autoFocus
                    className="flex-grow px-4 py-2 rounded-lg border-2 border-emerald-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50/50 outline-none text-sm font-medium placeholder:text-emerald-300"
                    placeholder="Misal: 'Buat konteks lebih sulit'..."
                    value={regenPrompt}
                    onChange={(e) => setRegenPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmRegen(q.id);
                      if (e.key === 'Escape') setPromptingId(null);
                    }}
                  />
                  <button 
                    onClick={() => handleConfirmRegen(q.id)}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all active:scale-95"
                  >
                    Generate
                  </button>
                  <button 
                    onClick={() => setPromptingId(null)}
                    className="bg-white text-slate-500 border border-slate-200 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 transition-all"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
            
            <div className="p-6 space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                {q.image && (
                  <div className="md:w-1/3 w-full h-40 rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                    <img src={q.image} className="w-full h-full object-contain" alt="Stimulus" />
                  </div>
                )}
                <div className="flex-1">
                  {isMultiChoice && (
                    <p className="text-rose-600 font-black text-xs mb-2 italic flex items-center gap-2">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                      (Jawaban bisa lebih dari satu)
                    </p>
                  )}
                  <p className="text-slate-800 font-medium whitespace-pre-wrap text-base leading-relaxed">{q.text}</p>
                </div>
              </div>

              {q.options && q.options.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {q.options.map((opt, i) => (
                    <div key={i} className="p-3 rounded-xl border bg-slate-50 border-slate-100 flex items-center gap-3">
                      <span className="inline-block w-6 h-6 leading-6 text-center rounded-lg border text-[10px] font-black bg-white text-slate-400 border-slate-200">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm font-medium text-slate-600">{opt}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {q.explanation && (
                <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100 text-[11px] text-amber-800 italic">
                  <span className="font-black uppercase block mb-1">Analisis:</span>
                  {q.explanation}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default QuestionList;
