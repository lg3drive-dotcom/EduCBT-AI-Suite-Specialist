
import React, { useState, useEffect } from 'react';
import { EduCBTQuestion, QuestionType } from '../types';
import ImageControl from './ImageControl';
import { generateExplanationForQuestion, convertTextToLatex } from '../geminiService';

interface Props {
  question: EduCBTQuestion;
  onSave: (updated: EduCBTQuestion) => void;
  onClose: () => void;
}

const QuestionEditor: React.FC<Props> = ({ question, onSave, onClose }) => {
  const [edited, setEdited] = useState<EduCBTQuestion>({ 
    ...question,
    tfLabels: question.tfLabels || (question.type === QuestionType.BenarSalah ? { true: 'Benar', false: 'Salah' } : (question.type === QuestionType.SesuaiTidakSesuai ? { true: 'Sesuai', false: 'Tidak Sesuai' } : undefined))
  });

  const [isGeneratingExpl, setIsGeneratingExpl] = useState(false);
  const [loadingLatex, setLoadingLatex] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // @ts-ignore
    if (window.renderMathInElement) {
      // @ts-ignore
      window.renderMathInElement(document.body);
    }
  }, [edited, isGeneratingExpl, loadingLatex]);

  const handleCorrectAnswerChange = (idx: number) => {
    if (edited.type === QuestionType.PilihanGanda) {
      setEdited({ ...edited, correctAnswer: idx });
    } else if (edited.type === QuestionType.MCMA) {
      const current = Array.isArray(edited.correctAnswer) ? (edited.correctAnswer as number[]) : [];
      const updated = current.includes(idx) ? current.filter(i => i !== idx) : [...current, idx];
      setEdited({ ...edited, correctAnswer: updated });
    } else if (edited.type === QuestionType.BenarSalah || edited.type === QuestionType.SesuaiTidakSesuai) {
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
        const newOps = [...edited.options]; newOps[index] = latexText; setEdited({ ...edited, options: newOps });
      }
    } catch (err) { alert("Gagal LaTeX."); } finally { setLoadingLatex(prev => ({ ...prev, [key]: false })); }
  };

  const handleGenerateAIExplanation = async () => {
    setIsGeneratingExpl(true);
    try {
      const aiExplanation = await generateExplanationForQuestion(edited);
      setEdited(prev => ({ ...prev, explanation: aiExplanation }));
    } catch (err) { alert("Gagal AI."); } finally { setIsGeneratingExpl(false); }
  };

  const isTableType = edited.type === QuestionType.BenarSalah || edited.type === QuestionType.SesuaiTidakSesuai;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50/50">
          <h2 className="text-xl font-black text-indigo-900">Editor Soal (Support HTML)</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-black uppercase text-slate-500">Isi Soal (HTML OK)</label>
                  <button onClick={() => handleApplyLatex('text')} className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Latex Fix</button>
                </div>
                <textarea rows={5} className="w-full p-4 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" value={edited.text} onChange={(e) => setEdited({...edited, text: e.target.value})} />
                <div className="mt-2 p-3 bg-slate-50 border rounded-lg text-xs" dangerouslySetInnerHTML={{ __html: edited.text }}></div>
              </div>
              <ImageControl label="Gambar Stimulus" currentImage={edited.image} onImageChange={(img) => setEdited({...edited, image: img})} />
            </div>

            <div className="lg:col-span-5 space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-500">{isTableType ? 'Pernyataan' : 'Pilihan Jawaban'}</label>
              <div className="space-y-2">
                {edited.options.map((opt, i) => (
                  <div key={i} className="flex flex-col gap-1 p-3 bg-slate-50 rounded-xl border">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleCorrectAnswerChange(i)} className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-black border-2 transition-all ${isTableType ? ((edited.correctAnswer as boolean[])[i] ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-rose-500 border-rose-500 text-white') : ((Array.isArray(edited.correctAnswer) ? (edited.correctAnswer as number[]).includes(i) : edited.correctAnswer === i) ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-400')}`}>
                        {isTableType ? ((edited.correctAnswer as boolean[])[i] ? 'B' : 'S') : String.fromCharCode(65+i)}
                      </button>
                      <input className="flex-grow bg-transparent border-b border-slate-200 outline-none text-sm font-bold" value={opt} onChange={(e) => { const newOps = [...edited.options]; newOps[i] = e.target.value; setEdited({...edited, options: newOps}); }} />
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1" dangerouslySetInnerHTML={{ __html: opt }}></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="bg-amber-50/30 p-4 rounded-2xl border border-amber-100">
            <div className="flex justify-between items-center mb-3">
              <label className="text-[10px] font-black uppercase text-amber-700">Pembahasan (Akan tampil sebagai HTML)</label>
              <button disabled={isGeneratingExpl} onClick={handleGenerateAIExplanation} className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase">✨ Auto AI</button>
            </div>
            <textarea rows={4} className="w-full p-4 rounded-xl border border-amber-200 text-sm italic outline-none mb-2" value={edited.explanation} onChange={(e) => setEdited({...edited, explanation: e.target.value})} />
            <div className="p-3 bg-white border border-amber-100 rounded-lg text-xs italic" dangerouslySetInnerHTML={{ __html: edited.explanation }}></div>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-500">Batal</button>
          <button onClick={() => onSave(edited)} className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase shadow-lg">Simpan</button>
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;
