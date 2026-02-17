
import React, { useState, useEffect } from 'react';
import { EduCBTQuestion, QuestionType } from '../types';
import { normalizeQuestionType } from '../geminiService';

interface Props {
  questions: EduCBTQuestion[];
  onEdit: (q: EduCBTQuestion) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onRegenerate?: (id: string, instructions?: string) => void;
  onQuickUpdate?: (id: string, field: 'order' | 'quizToken', value: string | number) => void;
  onChangeType?: (id: string, newType: QuestionType) => void;
  onAutoLevel?: (id: string) => void;
  isTrashView?: boolean;
  regeneratingIds?: Set<string>;
}

const QuestionList: React.FC<Props> = ({ 
  questions, onEdit, onDelete, onRestore, onRegenerate, onQuickUpdate, onChangeType, onAutoLevel, isTrashView = false, regeneratingIds = new Set()
}) => {
  const [promptingId, setPromptingId] = useState<string | null>(null);
  const [regenPrompt, setRegenPrompt] = useState('');
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // @ts-ignore
    if (window.renderMathInElement) {
      // @ts-ignore
      window.renderMathInElement(document.body);
    }
  }, [questions]);

  const isOptionCorrect = (q: EduCBTQuestion, index: number): boolean => {
    const type = normalizeQuestionType(q.type);
    if (type === QuestionType.PilihanGanda) return Number(q.correctAnswer) === index;
    if (type === QuestionType.MCMA) return Array.isArray(q.correctAnswer) && (q.correctAnswer as number[]).includes(index);
    if (type === QuestionType.BenarSalah || type === QuestionType.SesuaiTidakSesuai) return Array.isArray(q.correctAnswer) && (q.correctAnswer as boolean[])[index] === true;
    return false;
  };

  const handleStartRegen = (id: string) => {
    if (onRegenerate) {
      onRegenerate(id, regenPrompt);
      setPromptingId(null);
      setRegenPrompt('');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {questions.map((q) => {
        const qType = normalizeQuestionType(q.type);
        const isTableType = qType === QuestionType.BenarSalah || qType === QuestionType.SesuaiTidakSesuai;
        const isMCMA = qType === QuestionType.MCMA;
        const trueLabel = q.tfLabels?.true || (qType === QuestionType.BenarSalah ? "Benar" : "Sesuai");
        const falseLabel = q.tfLabels?.false || (qType === QuestionType.BenarSalah ? "Salah" : "Tidak Sesuai");
        const isAnalyzing = analyzingIds.has(q.id);
        const isRegenerating = regeneratingIds.has(q.id);

        return (
          <div key={q.id} className={`relative bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all ${isTrashView ? 'opacity-60 grayscale border-slate-200' : 'border-slate-100 hover:border-indigo-300'} ${isRegenerating ? 'ring-2 ring-emerald-500' : ''}`}>
            
            {/* Loading Overlay */}
            {isRegenerating && (
              <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-black text-emerald-600 uppercase tracking-widest animate-pulse">Sedang Merevisi...</p>
              </div>
            )}

            {/* Metadata */}
            <div className={`px-4 py-3 flex items-center justify-between border-b ${isTrashView ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white border px-2 py-1 rounded-lg shadow-sm">
                  <span className="text-[9px] font-black text-slate-400">#</span>
                  <input disabled={isTrashView} type="number" className="w-8 text-xs font-black text-center outline-none bg-transparent" value={q.order} onChange={(e) => onQuickUpdate?.(q.id, 'order', e.target.value)} />
                </div>
                <div className="flex items-center gap-1 bg-white border px-2 py-1 rounded-lg shadow-sm">
                  <span className="text-[9px] font-black text-slate-400 uppercase">Tkn</span>
                  <input disabled={isTrashView} type="text" className="w-16 text-[9px] font-black uppercase outline-none bg-transparent" value={q.quizToken} onChange={(e) => onQuickUpdate?.(q.id, 'quizToken', e.target.value.toUpperCase())} />
                </div>
                <span className={`px-2 py-1 bg-indigo-600 text-white text-[9px] font-black rounded-lg uppercase tracking-widest ${isAnalyzing ? 'animate-pulse opacity-50' : ''}`}>
                  {isAnalyzing ? '...' : q.level}
                </span>
                {!isTrashView && (
                  <button onClick={() => onAutoLevel?.(q.id)} className="p-1.5 rounded-lg border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white shadow-sm">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </button>
                )}
              </div>
              
              {isTrashView ? (
                <div className="flex gap-2">
                  <button onClick={() => onRestore?.(q.id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm">Pulihkan</button>
                  <button onClick={() => onDelete(q.id)} className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm">Hapus Permanen</button>
                </div>
              ) : (
                <button onClick={() => onDelete(q.id)} className="p-2 text-rose-400 hover:text-rose-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
            </div>

            {/* Toolbar */}
            {!isTrashView && (
              <div className="bg-indigo-50/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100">
                <select className="px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-[10px] font-black uppercase text-indigo-900 shadow-sm outline-none" value={q.type} onChange={(e) => onChangeType?.(q.id, e.target.value as QuestionType)}>
                  {Object.values(QuestionType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={() => setPromptingId(promptingId === q.id ? null : q.id)} className={`px-3 py-2 border rounded-xl text-[10px] font-black uppercase shadow-sm flex items-center gap-1.5 transition-all ${promptingId === q.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>
                    {promptingId === q.id ? 'Tutup Panel' : 'Revisi AI'}
                  </button>
                  <button onClick={() => onEdit(q)} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md flex items-center gap-1.5">Edit</button>
                </div>
              </div>
            )}

            {/* Panel Input Instruksi Revisi */}
            {promptingId === q.id && (
              <div className="p-4 bg-emerald-50 border-b border-emerald-100 animate-in slide-in-from-top duration-200">
                <p className="text-[10px] font-black text-emerald-700 uppercase mb-2 tracking-widest">Apa yang ingin diperbaiki? (Contoh: "Ubah opsi C", "Buat lebih sulit")</p>
                <div className="flex gap-2">
                  <input 
                    autoFocus 
                    className="flex-grow px-4 py-2 rounded-xl border-2 border-emerald-200 text-sm font-medium outline-none focus:border-emerald-500 bg-white" 
                    placeholder="Ketik instruksi revisi di sini..." 
                    value={regenPrompt} 
                    onChange={(e) => setRegenPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleStartRegen(q.id)}
                  />
                  <button 
                    onClick={() => handleStartRegen(q.id)} 
                    className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    PROSES
                  </button>
                </div>
              </div>
            )}

            {/* Content Area */}
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <div className="text-slate-900 font-bold text-base leading-relaxed tracking-tight" dangerouslySetInnerHTML={{ __html: q.text }}></div>
                {isMCMA && <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black uppercase border border-amber-200">Pilihan Ganda Kompleks</span>}
              </div>
              
              {q.image && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                  <img src={q.image} className="w-full h-auto object-contain max-h-[400px] rounded-xl" alt="Stimulus" />
                </div>
              )}

              {isTableType ? (
                <div className="border border-slate-200 rounded-2xl overflow-x-auto shadow-sm bg-white">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50 border-b text-[10px] font-black uppercase text-slate-500">
                        <th className="px-4 py-4 w-12 text-center">#</th>
                        <th className="px-4 py-4 text-left">Pernyataan</th>
                        <th className="px-4 py-4 text-center w-28 bg-emerald-50 text-emerald-700">{trueLabel}</th>
                        <th className="px-4 py-4 text-center w-28 bg-rose-50 text-rose-700">{falseLabel}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {q.options.map((opt, i) => {
                        const isTrue = Array.isArray(q.correctAnswer) ? (q.correctAnswer as boolean[])[i] : false;
                        return (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-4 text-center text-slate-300 font-black">{i+1}</td>
                            <td className="px-4 py-4 text-slate-900 font-bold leading-snug" dangerouslySetInnerHTML={{ __html: opt }}></td>
                            <td className="px-4 py-4 text-center">
                              <div className={`w-8 h-8 mx-auto rounded-xl border-2 flex items-center justify-center ${isTrue ? 'bg-emerald-500 border-emerald-500 shadow-lg' : 'border-slate-200 bg-white'}`}>
                                {isTrue && <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className={`w-8 h-8 mx-auto rounded-xl border-2 flex items-center justify-center ${!isTrue ? 'bg-rose-500 border-rose-500 shadow-lg' : 'border-slate-200 bg-white'}`}>
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
                      <div key={i} className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${isCorrect ? 'bg-emerald-50 border-emerald-400 shadow-md' : 'bg-white border-slate-100'}`}>
                        <span className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-sm font-black ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65+i)}</span>
                        <div className={`text-sm font-bold leading-tight ${isCorrect ? 'text-emerald-900' : 'text-slate-700'}`} dangerouslySetInnerHTML={{ __html: opt }}></div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {q.explanation && (
                <div className="mt-6 p-5 bg-indigo-50/50 rounded-2xl text-[12px] text-indigo-900 border border-indigo-100 flex gap-4 shadow-sm">
                  <div className="bg-indigo-600 p-2 rounded-xl flex-shrink-0 shadow-lg h-fit">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  </div>
                  <div>
                    <span className="font-black uppercase block mb-1 text-[10px] tracking-widest text-indigo-600">Bedah Solusi & Analisis:</span>
                    <div className="font-medium italic leading-relaxed opacity-90" dangerouslySetInnerHTML={{ __html: q.explanation }}></div>
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
