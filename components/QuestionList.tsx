
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
  onAutoLevel?: (id: string) => void;
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
            
            {/* Metadata */}
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
                <span className={`px-2 py-1 bg-indigo-600 text-white text-[9px] font-black rounded-lg uppercase tracking-widest ${isAnalyzing ? 'animate-pulse opacity-50' : ''}`}>
                  {isAnalyzing ? '...' : q.level}
                </span>
                {!isTrashView && (
                  <button disabled={isAnalyzing} onClick={() => handleAutoLevelClick(q.id)} className="p-1.5 rounded-lg border border-indigo-200 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                    {isAnalyzing ? <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                  </button>
                )}
              </div>
              {isTrashView && (
                <button onClick={() => onRestore?.(q.id)} className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase">Pulihkan</button>
              )}
            </div>

            {/* Toolbar */}
            {!isTrashView && (
              <div className="bg-indigo-50/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100">
                <select className="px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-[10px] font-black uppercase text-indigo-900 shadow-sm" value={q.type} onChange={(e) => onChangeType?.(q.id, e.target.value as QuestionType)}>
                  {Object.values(QuestionType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPromptingId(q.id)} className="px-3 py-2 bg-white text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-50 text-[10px] font-black uppercase shadow-sm flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> Revisi
                  </button>
                  <button onClick={() => onEdit(q)} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-md flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg> Edit
                  </button>
                  <button onClick={() => confirmDelete(q.id)} className="px-3 py-2 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase shadow-md">Hapus</button>
                </div>
              </div>
            )}

            {/* Revisi Panel */}
            {promptingId === q.id && (
              <div className="p-4 bg-emerald-50 border-b-2 border-emerald-200">
                <input autoFocus className="w-full px-4 py-2 rounded-xl border-2 border-emerald-300 text-sm outline-none mb-2" placeholder="Instruksi revisi AI..." value={regenPrompt} onChange={(e) => setRegenPrompt(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setPromptingId(null)} className="px-4 py-2 text-slate-500 text-xs font-bold uppercase">Batal</button>
                  <button onClick={() => { onRegenerate?.(q.id, regenPrompt); setPromptingId(null); }} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase shadow-lg">PROSES</button>
                </div>
              </div>
            )}

            {/* Content Area */}
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <div className="text-slate-900 font-bold text-base leading-relaxed tracking-tight latex-content" dangerouslySetInnerHTML={{ __html: q.text }}></div>
                {isMCMA && <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black uppercase border border-amber-200">Pilihan Ganda Kompleks</span>}
              </div>
              
              {q.image && !imgErrors[q.id] && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                  <img src={q.image} className="w-full h-auto object-contain max-h-[400px] rounded-xl" alt="Stimulus" onError={() => handleImgError(q.id)} />
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
                    <span className="font-black uppercase block mb-1 text-[10px] tracking-widest text-indigo-600">Pembahasan:</span>
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
