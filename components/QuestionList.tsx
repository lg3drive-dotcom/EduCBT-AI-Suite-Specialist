
import React, { useState } from 'react';
import { EduCBTQuestion, QuestionType } from '../types';

interface Props {
  questions: EduCBTQuestion[];
  onEdit: (q: EduCBTQuestion) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onRegenerate?: (id: string, instructions?: string) => void;
  onQuickUpdate?: (id: string, field: 'order' | 'quizToken', value: string | number) => void;
  onChangeType?: (id: string, newType: QuestionType) => void;
  isTrashView?: boolean;
}

const QuestionList: React.FC<Props> = ({ 
  questions, onEdit, onDelete, onRestore, onRegenerate, onQuickUpdate, onChangeType, isTrashView = false 
}) => {
  const [promptingId, setPromptingId] = useState<string | null>(null);
  const [regenPrompt, setRegenPrompt] = useState('');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const isOptionCorrect = (q: EduCBTQuestion, index: number): boolean => {
    if (q.type === QuestionType.PilihanGanda) return q.correctAnswer === index;
    if (q.type === QuestionType.MCMA) return Array.isArray(q.correctAnswer) && (q.correctAnswer as number[]).includes(index);
    if (q.type === QuestionType.BenarSalah || q.type === QuestionType.SesuaiTidakSesuai) return Array.isArray(q.correctAnswer) && (q.correctAnswer as boolean[])[index] === true;
    return false;
  };

  const handleImgError = (id: string) => {
    setImgErrors(prev => ({ ...prev, [id]: true }));
  };

  return (
    <div className="space-y-6">
      {questions.map((q) => {
        const isTableType = q.type === QuestionType.BenarSalah || q.type === QuestionType.SesuaiTidakSesuai;
        const isMCMA = q.type === QuestionType.MCMA;
        const trueLabel = q.tfLabels?.true || (q.type === QuestionType.BenarSalah ? "Benar" : "Sesuai");
        const falseLabel = q.tfLabels?.false || (q.type === QuestionType.BenarSalah ? "Salah" : "Tidak Sesuai");

        return (
          <div key={q.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${isTrashView ? 'opacity-70' : 'border-slate-200'}`}>
            <div className="bg-slate-50 px-4 py-2 border-b flex justify-between items-center">
              <div className="flex items-center gap-3">
                <input type="number" className="w-12 px-2 py-1 bg-white border rounded text-xs font-bold text-center" value={q.order} onChange={(e) => onQuickUpdate?.(q.id, 'order', e.target.value)} />
                <input type="text" className="w-24 px-2 py-1 bg-white border rounded text-[10px] font-mono uppercase" value={q.quizToken} onChange={(e) => onQuickUpdate?.(q.id, 'quizToken', e.target.value)} />
                <select className="px-2 py-1 bg-white border rounded text-[10px] font-bold" value={q.type} onChange={(e) => onChangeType?.(q.id, e.target.value as QuestionType)}>
                  {Object.values(QuestionType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded uppercase">{q.level}</span>
              </div>
              <div className="flex gap-1">
                {!isTrashView ? (
                  <>
                    <button onClick={() => setPromptingId(q.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Revisi AI"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
                    <button onClick={() => onEdit(q)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded" title="Edit Manual"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                    <button onClick={() => onDelete(q.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" title="Hapus"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </>
                ) : (
                  <button onClick={() => onRestore?.(q.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded">Pulihkan</button>
                )}
              </div>
            </div>

            {promptingId === q.id && (
              <div className="p-4 bg-emerald-50 border-b flex gap-2">
                <input autoFocus className="flex-grow px-3 py-1.5 rounded border text-sm" placeholder="Instruksi revisi..." value={regenPrompt} onChange={(e) => setRegenPrompt(e.target.value)} />
                <button onClick={() => { onRegenerate?.(q.id, regenPrompt); setPromptingId(null); }} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-bold uppercase">Go</button>
                <button onClick={() => setPromptingId(null)} className="text-slate-500 text-xs px-2">Batal</button>
              </div>
            )}

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">{q.text}</p>
                {isMCMA && (
                  <p className="text-[11px] font-bold text-slate-500 italic">(Pilih lebih dari satu jawaban yang benar)</p>
                )}
              </div>
              
              {q.image && !imgErrors[q.id] && (
                <div className="max-w-md border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                  <img 
                    src={q.image} 
                    className="w-full h-auto object-contain max-h-[400px]" 
                    alt="Stimulus" 
                    onError={() => handleImgError(q.id)}
                  />
                </div>
              )}

              {q.image && imgErrors[q.id] && (
                <div className="max-w-md p-4 bg-rose-50 border border-rose-100 rounded-xl text-[10px] text-rose-600 font-bold italic">
                  ⚠ Gambar gagal dimuat. Gunakan Direct Link (i.ibb.co/...).
                </div>
              )}

              {isTableType ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 border-b text-left text-[10px] font-black uppercase text-slate-600">
                        <th className="px-4 py-3 w-12 text-center">#</th>
                        <th className="px-4 py-3">Pernyataan / Analisis</th>
                        <th className="px-4 py-3 text-center w-24 bg-emerald-50 text-emerald-700">{trueLabel}</th>
                        <th className="px-4 py-3 text-center w-24 bg-rose-50 text-rose-700">{falseLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.options.map((opt, i) => {
                        const isTrue = Array.isArray(q.correctAnswer) ? (q.correctAnswer as boolean[])[i] : false;
                        return (
                          <tr key={i} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-center text-slate-400 font-bold">{i+1}</td>
                            <td className="px-4 py-3 text-slate-700 font-medium">{opt}</td>
                            <td className="px-4 py-3 text-center">
                              <div className={`w-6 h-6 mx-auto rounded-lg border-2 flex items-center justify-center transition-all ${isTrue ? 'bg-emerald-500 border-emerald-500 shadow-sm' : 'border-slate-200 bg-white'}`}>
                                {isTrue && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className={`w-6 h-6 mx-auto rounded-lg border-2 flex items-center justify-center transition-all ${!isTrue ? 'bg-rose-500 border-rose-500 shadow-sm' : 'border-slate-200 bg-white'}`}>
                                {!isTrue && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {q.options.map((opt, i) => {
                    const isCorrect = isOptionCorrect(q, i);
                    return (
                      <div key={i} className={`p-3 rounded-xl border-2 flex items-center gap-4 transition-all ${isCorrect ? 'bg-emerald-50 border-emerald-300 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                        {isMCMA ? (
                          <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-all ${isCorrect ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-300'}`}>
                            {isCorrect && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                        ) : (
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>{String.fromCharCode(65+i)}</span>
                        )}
                        <span className="text-sm font-semibold text-slate-700">{opt}</span>
                        {!isMCMA && isCorrect && <svg className="ml-auto w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    );
                  })}
                </div>
              )}
              
              {q.explanation && (
                <div className="mt-4 p-4 bg-amber-50/50 rounded-xl text-[11px] text-amber-900 italic border border-amber-100 flex gap-3 items-start">
                  <div className="bg-amber-100 p-1 rounded-md">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <span className="font-black uppercase block mb-1 text-[9px] tracking-wider text-amber-700">Analisis Pakar:</span>
                    {q.explanation}
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
