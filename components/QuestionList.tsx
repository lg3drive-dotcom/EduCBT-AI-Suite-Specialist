
import React, { useState, useEffect } from 'react';
import { EduCBTQuestion, QuestionType } from '../types';

interface Props {
  questions: EduCBTQuestion[];
  onEdit: (q: EduCBTQuestion) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onRegenerate?: (id: string, instructions?: string) => void;
  onQuickUpdate?: (id: string, field: 'order' | 'quizToken', value: string | number) => void;
  onChangeType?: (id: string, newType: QuestionType) => void;
  onAutoLevel?: (id: string) => void; // Tambahan handler baru
  isTrashView?: boolean;
}

const QuestionList: React.FC<Props> = ({ 
  questions, onEdit, onDelete, onRestore, onRegenerate, onQuickUpdate, onChangeType, onAutoLevel, isTrashView = false 
}) => {
  const [promptingId, setPromptingId] = useState<string | null>(null);
  const [regenPrompt, setRegenPrompt] = useState('');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // @ts-ignore
    if (window.renderMathInElement) {
      // @ts-ignore
      window.renderMathInElement(document.body);
    }
  }, [questions]);

  const isOptionCorrect = (q: EduCBTQuestion, index: number): boolean => {
    if (q.type === QuestionType.PilihanGanda) return q.correctAnswer === index;
    if (q.type === QuestionType.MCMA) return Array.isArray(q.correctAnswer) && (q.correctAnswer as number[]).includes(index);
    if (q.type === QuestionType.BenarSalah || q.type === QuestionType.SesuaiTidakSesuai) return Array.isArray(q.correctAnswer) && (q.correctAnswer as boolean[])[index] === true;
    return false;
  };

  const handleImgError = (id: string) => {
    setImgErrors(prev => ({ ...prev, [id]: true }));
  };

  const confirmDelete = (id: string) => {
    if (window.confirm("Pindahkan soal ini ke tempat sampah?")) {
      onDelete(id);
    }
  };

  const handleAutoLevelClick = async (id: string) => {
    if (analyzingIds.has(id)) return;
    setAnalyzingIds(prev => new Set(prev).add(id));
    if (onAutoLevel) await onAutoLevel(id);
    setAnalyzingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 pb-20">
      {questions.map((q) => {
        const isTableType = q.type === QuestionType.BenarSalah || q.type === QuestionType.SesuaiTidakSesuai;
        const isMCMA = q.type === QuestionType.MCMA;
        const trueLabel = q.tfLabels?.true || (q.type === QuestionType.BenarSalah ? "Benar" : "Sesuai");
        const falseLabel = q.tfLabels?.false || (q.type === QuestionType.BenarSalah ? "Salah" : "Tidak Sesuai");
        const isAnalyzing = analyzingIds.has(q.id);

        return (
          <div key={q.id} className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all ${isTrashView ? 'opacity-70 grayscale' : 'border-slate-100 hover:border-indigo-300'}`}>
            
            {/* BARIS 1: Metadata (Nomor, Token, Level) */}
            <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white border px-2 py-1 rounded-lg shadow-sm">
                  <span className="text-[9px] font-black text-slate-400">#</span>
                  <input type="number" className="w-8 text-xs font-black text-center outline-none bg-transparent" value={q.order} onChange={(e) => onQuickUpdate?.(q.id, 'order', e.target.value)} />
                </div>
                <div className="flex items-center gap-1 bg-white border px-2 py-1 rounded-lg shadow-sm">
                  <span className="text-[9px] font-black text-slate-400 uppercase">Tkn</span>
                  <input type="text" className="w-16 text-[9px] font-black uppercase outline-none bg-transparent" value={q.quizToken} onChange={(e) => onQuickUpdate?.(q.id, 'quizToken', e.target.value.toUpperCase())} />
                </div>
                <div className="relative group">
                  <span className={`px-2 py-1 bg-indigo-600 text-white text-[9px] font-black rounded-lg uppercase tracking-widest transition-all ${isAnalyzing ? 'animate-pulse opacity-50' : ''}`}>
                    {isAnalyzing ? '...' : q.level}
                  </span>
                  {/* Tooltip Mini */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-800 text-white text-[8px] font-bold px-2 py-1 rounded whitespace-nowrap z-10">
                    Level Kognitif Soal
                  </div>
                </div>
                {!isTrashView && (
                  <button 
                    disabled={isAnalyzing}
                    onClick={() => handleAutoLevelClick(q.id)}
                    className={`p-1.5 rounded-lg border border-indigo-200 transition-all ${isAnalyzing ? 'bg-indigo-50 text-indigo-300' : 'bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white shadow-sm'}`}
                    title="Tentukan Level Otomatis via AI"
                  >
                    {isAnalyzing ? (
                      <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    )}
                  </button>
                )}
              </div>
              
              {isTrashView && (
                <button onClick={() => onRestore?.(q.id)} className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase">Pulihkan</button>
              )}
            </div>

            {/* BARIS 2: Toolbar Aksi */}
            {!isTrashView && (
              <div className="bg-indigo-50/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100">
                <select 
                  className="flex-grow sm:flex-grow-0 px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-[10px] font-black uppercase text-indigo-900 outline-none shadow-sm"
                  value={q.type} 
                  onChange={(e) => onChangeType?.(q.id, e.target.value as QuestionType)}
                >
                  {Object.values(QuestionType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                  <button onClick={() => setPromptingId(q.id)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-50 transition-all shadow-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    <span className="text-[10px] font-black uppercase">Revisi</span>
                  </button>
                  <button onClick={() => onEdit(q)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    <span className="text-[10px] font-black uppercase">Edit</span>
                  </button>
                  <button onClick={() => confirmDelete(q.id)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all shadow-md ring-2 ring-rose-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    <span className="text-[10px] font-black uppercase">Hapus</span>
                  </button>
                </div>
              </div>
            )}

            {/* Panel Input Revisi AI */}
            {promptingId === q.id && (
              <div className="p-4 bg-emerald-50 border-b-2 border-emerald-200 animate-in slide-in-from-top duration-300">
                <p className="text-[9px] font-black text-emerald-700 uppercase mb-2">Instruksi Revisi AI untuk Soal #{q.order}</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input autoFocus className="flex-grow px-4 py-2 rounded-xl border-2 border-emerald-300 text-sm outline-none focus:border-emerald-600" placeholder="Contoh: Ubah soal ini jadi lebih menantang..." value={regenPrompt} onChange={(e) => setRegenPrompt(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={() => { onRegenerate?.(q.id, regenPrompt); setPromptingId(null); }} className="flex-grow px-6 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg">GO</button>
                    <button onClick={() => setPromptingId(null)} className="px-4 py-2 text-slate-500 text-xs font-bold uppercase">Batal</button>
                  </div>
                </div>
              </div>
            )}

            {/* ISI SOAL */}
            <div className="p-6 space-y-5 latex-content">
              <div className="space-y-2">
                <p className="text-slate-900 font-bold text-base leading-relaxed tracking-tight">{q.text}</p>
                {isMCMA && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    <span className="text-[10px] font-black uppercase">Pilihan Ganda Kompleks</span>
                  </div>
                )}
              </div>
              
              {q.image && !imgErrors[q.id] && (
                <div className="max-w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-inner p-2">
                  <img src={q.image} className="w-full h-auto object-contain max-h-[450px] mx-auto rounded-xl" alt="Stimulus" onError={() => handleImgError(q.id)} />
                </div>
              )}

              {isTableType ? (
                <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-sm bg-white">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50 border-b text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">
                        <th className="px-4 py-4 w-12 text-center">#</th>
                        <th className="px-4 py-4">Pernyataan Analisis</th>
                        <th className="px-4 py-4 text-center w-28 bg-emerald-50 text-emerald-700">{trueLabel}</th>
                        <th className="px-4 py-4 text-center w-28 bg-rose-50 text-rose-700">{falseLabel}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {q.options.map((opt, i) => {
                        const isTrue = Array.isArray(q.correctAnswer) ? (q.correctAnswer as boolean[])[i] : false;
                        return (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4 text-center text-slate-300 font-black">{i+1}</td>
                            <td className="px-4 py-4 text-slate-900 font-bold leading-snug">{opt}</td>
                            <td className="px-4 py-4 text-center">
                              <div className={`w-8 h-8 mx-auto rounded-xl border-2 flex items-center justify-center transition-all ${isTrue ? 'bg-emerald-500 border-emerald-500 shadow-emerald-200 shadow-lg' : 'border-slate-200 bg-white'}`}>
                                {isTrue && <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className={`w-8 h-8 mx-auto rounded-xl border-2 flex items-center justify-center transition-all ${!isTrue ? 'bg-rose-500 border-rose-500 shadow-rose-200 shadow-lg' : 'border-slate-200 bg-white'}`}>
                                {!isTrue && <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {q.options.map((opt, i) => {
                    const isCorrect = isOptionCorrect(q, i);
                    return (
                      <div key={i} className={`group p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${isCorrect ? 'bg-emerald-50 border-emerald-400 shadow-md ring-1 ring-emerald-100' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
                        {isMCMA ? (
                          <div className={`w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center border-2 transition-all ${isCorrect ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-white border-slate-300'}`}>
                            {isCorrect && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                        ) : (
                          <span className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-sm font-black transition-all ${isCorrect ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-400 border border-slate-200 group-hover:bg-indigo-50 group-hover:text-indigo-400'}`}>{String.fromCharCode(65+i)}</span>
                        )}
                        <span className={`text-sm font-bold leading-tight ${isCorrect ? 'text-emerald-900' : 'text-slate-700'}`}>{opt}</span>
                        {!isMCMA && isCorrect && <div className="ml-auto bg-emerald-100 p-1 rounded-full"><svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg></div>}
                      </div>
                    );
                  })}
                </div>
              )}
              
              {q.explanation && (
                <div className="mt-6 p-5 bg-indigo-50/50 rounded-2xl text-[12px] text-indigo-900 border border-indigo-100 flex gap-4 items-start shadow-sm">
                  <div className="bg-indigo-600 p-2 rounded-xl flex-shrink-0 shadow-lg shadow-indigo-200">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  </div>
                  <div>
                    <span className="font-black uppercase block mb-1 text-[10px] tracking-widest text-indigo-600">Bedah Solusi & Analisis:</span>
                    <p className="font-medium italic leading-relaxed opacity-90">{q.explanation}</p>
                  </div>
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
