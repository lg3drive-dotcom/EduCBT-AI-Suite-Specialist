
import React, { useState, useEffect } from 'react';
import { EduCBTQuestion, QuestionType } from '../types';
import ImageControl from './ImageControl';
import { generateExplanationForQuestion, convertTextToLatex, normalizeQuestionType } from '../geminiService';

interface Props {
  question: EduCBTQuestion;
  onSave: (updated: EduCBTQuestion) => void;
  onClose: () => void;
}

const QuestionEditor: React.FC<Props> = ({ question, onSave, onClose }) => {
  // Pastikan tipe soal dinormalkan saat dibuka
  const [edited, setEdited] = useState<EduCBTQuestion>({ 
    ...question,
    type: normalizeQuestionType(question.type),
    tfLabels: question.tfLabels || (normalizeQuestionType(question.type) === QuestionType.BenarSalah ? { true: 'Benar', false: 'Salah' } : (normalizeQuestionType(question.type) === QuestionType.SesuaiTidakSesuai ? { true: 'Sesuai', false: 'Tidak Sesuai' } : undefined))
  });

  const [isGeneratingExpl, setIsGeneratingExpl] = useState(false);
  const [loadingLatex, setLoadingLatex] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // @ts-ignore
    if (window.renderMathInElement) {
      // @ts-ignore
      window.renderMathInElement(document.body);
    }
  }, [edited, isGeneratingExpl]);

  const handleCorrectAnswerChange = (idx: number) => {
    const type = normalizeQuestionType(edited.type);
    
    if (type === QuestionType.PilihanGanda) {
      setEdited({ ...edited, correctAnswer: idx });
    } else if (type === QuestionType.MCMA) {
      const current = Array.isArray(edited.correctAnswer) ? (edited.correctAnswer as number[]) : [];
      const updated = current.includes(idx) ? current.filter(i => i !== idx) : [...current, idx];
      setEdited({ ...edited, correctAnswer: updated });
    } else if (type === QuestionType.BenarSalah || type === QuestionType.SesuaiTidakSesuai) {
      const current = Array.isArray(edited.correctAnswer) ? (edited.correctAnswer as boolean[]) : edited.options.map(() => false);
      const updated = [...current];
      updated[idx] = !updated[idx];
      setEdited({ ...edited, correctAnswer: updated });
    }
  };

  const handleApplyLatex = async (field: 'text' | 'explanation' | 'option', index?: number) => {
    let sourceText = "";
    const key = index !== undefined ? `option-${index}` : field;

    if (field === 'text') sourceText = edited.text;
    else if (field === 'explanation') sourceText = edited.explanation;
    else if (field === 'option' && index !== undefined) sourceText = edited.options[index];

    if (!sourceText.trim()) return;

    setLoadingLatex(prev => ({ ...prev, [key]: true }));
    try {
      const latexText = await convertTextToLatex(sourceText);
      if (field === 'text') setEdited({ ...edited, text: latexText });
      else if (field === 'explanation') setEdited({ ...edited, explanation: latexText });
      else if (field === 'option' && index !== undefined) {
        const newOps = [...edited.options];
        newOps[index] = latexText;
        setEdited({ ...edited, options: newOps });
      }
    } catch (err) {
      alert("Gagal konversi ke LaTeX.");
    } finally {
      setLoadingLatex(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleGenerateAIExplanation = async () => {
    if (!edited.text) return;
    setIsGeneratingExpl(true);
    try {
      const aiExplanation = await generateExplanationForQuestion(edited);
      setEdited(prev => ({ ...prev, explanation: aiExplanation }));
    } catch (err) {
      alert("Gagal generate pembahasan.");
    } finally {
      setIsGeneratingExpl(false);
    }
  };

  const qType = normalizeQuestionType(edited.type);
  const isTableType = qType === QuestionType.BenarSalah || qType === QuestionType.SesuaiTidakSesuai;

  const isCorrect = (idx: number): boolean => {
    if (qType === QuestionType.PilihanGanda) return Number(edited.correctAnswer) === idx;
    if (qType === QuestionType.MCMA) return Array.isArray(edited.correctAnswer) && (edited.correctAnswer as number[]).includes(idx);
    if (isTableType) return Array.isArray(edited.correctAnswer) && (edited.correctAnswer as boolean[])[idx] === true;
    return false;
  };

  const LatexButton = ({ onClick, isLoading }: { onClick: () => void, isLoading: boolean }) => (
    <button 
      type="button" 
      onClick={onClick}
      disabled={isLoading}
      className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter transition-all border ${
        isLoading ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-600 hover:text-white'
      }`}
    >
      {isLoading ? <div className="w-2.5 h-2.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div> : <span>&sum; LaTeX</span>}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50/50">
          <h2 className="text-xl font-black text-indigo-900">Edit Soal {qType}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] font-black uppercase text-slate-500">Teks Soal</label>
                  <LatexButton onClick={() => handleApplyLatex('text')} isLoading={loadingLatex['text']} />
                </div>
                <textarea rows={6} className="w-full p-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium" value={edited.text} onChange={(e) => setEdited({...edited, text: e.target.value})} />
              </div>
              <ImageControl label="Gambar Stimulus" currentImage={edited.image} onImageChange={(img) => setEdited({...edited, image: img})} />
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black uppercase text-slate-500">{isTableType ? 'Pernyataan' : 'Opsi Jawaban'}</label>
                <button onClick={() => {
                  const newOptions = [...edited.options, ""];
                  let newAns = edited.correctAnswer;
                  if (isTableType) newAns = [...(Array.isArray(edited.correctAnswer) ? edited.correctAnswer : []) as boolean[], false];
                  setEdited({...edited, options: newOptions, correctAnswer: newAns});
                }} className="text-[10px] font-bold text-indigo-600 hover:underline">+ Tambah</button>
              </div>

              <div className="space-y-3">
                {edited.options.map((opt, i) => {
                  const active = isCorrect(i);
                  return (
                    <div key={i} className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${active ? 'bg-emerald-50 border-emerald-300 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                      <button 
                        type="button" 
                        onClick={() => handleCorrectAnswerChange(i)} 
                        className={`w-8 h-8 flex-shrink-0 rounded flex items-center justify-center text-[10px] font-black border-2 transition-all ${
                          active ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      >
                        {isTableType ? (active ? 'B' : 'S') : String.fromCharCode(65+i)}
                      </button>
                      <div className="flex-grow flex flex-col gap-1">
                        <input type="text" className="w-full bg-transparent border-b border-slate-200 outline-none text-sm font-bold py-1" value={opt} onChange={(e) => {
                          const newOps = [...edited.options]; newOps[i] = e.target.value; setEdited({...edited, options: newOps});
                        }} />
                        <div className="flex justify-start">
                          <LatexButton onClick={() => handleApplyLatex('option', i)} isLoading={loadingLatex[`option-${i}`]} />
                        </div>
                      </div>
                      <button onClick={() => {
                        const newOps = [...edited.options]; newOps.splice(i, 1);
                        let newAns = edited.correctAnswer;
                        if (isTableType && Array.isArray(newAns)) {
                           const arr = [...newAns]; arr.splice(i, 1); newAns = arr;
                        }
                        setEdited({...edited, options: newOps, correctAnswer: newAns});
                      }} className="text-rose-400 hover:text-rose-600 self-start mt-1"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg></button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="bg-amber-50/30 p-4 rounded-2xl border border-amber-100">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-[10px] font-black uppercase text-amber-700 tracking-widest">Pembahasan / Analisis Kunci</label>
              <div className="flex gap-2">
                <LatexButton onClick={() => handleApplyLatex('explanation')} isLoading={loadingLatex['explanation']} />
                <button type="button" disabled={isGeneratingExpl} onClick={handleGenerateAIExplanation} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
                  {isGeneratingExpl ? '...' : '✨ Auto-Pembahasan'}
                </button>
              </div>
            </div>
            <textarea rows={4} className="w-full p-4 rounded-xl border border-amber-200 bg-white text-sm italic text-slate-700 outline-none" value={edited.explanation} onChange={(e) => setEdited({...edited, explanation: e.target.value})} placeholder="Masukkan penjelasan..." />
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-500">Batal</button>
          <button onClick={() => onSave(edited)} className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg">Simpan Perubahan</button>
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;
