
import React, { useState } from 'react';
import { EduCBTQuestion, QuestionType } from '../types';
import { suggestLevel, generateSingleExplanation } from '../geminiService';
import ImageControl from './ImageControl';
import MathText from './MathText';

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
  const [isLevelLoading, setIsLevelLoading] = useState(false);
  const [isExpLoading, setIsExpLoading] = useState(false);

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

  const isTableType = edited.type === QuestionType.BenarSalah || edited.type === QuestionType.SesuaiTidakSesuai;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-6xl max-h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50/50">
          <h2 className="text-xl font-black text-indigo-900 uppercase tracking-tighter">Editor Soal Matematika & Sains</h2>
          <div className="flex gap-4 items-center">
             <span className="text-[10px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full">KODE LaTeX AKTIF ($)</span>
             <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input Side */}
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">Teks Soal (Input Rumus dengan $ ... $)</label>
                <textarea rows={5} className="w-full p-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner bg-slate-50/50" value={edited.text} onChange={(e) => setEdited({...edited, text: e.target.value})} />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">Opsi Jawaban</label>
                <div className="space-y-3">
                  {edited.options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                       <button onClick={() => handleCorrectAnswerChange(i)} className={`w-10 h-10 rounded-xl border-2 font-black transition-all ${isTableType ? ((edited.correctAnswer as boolean[])[i] ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-rose-500 border-rose-500 text-white') : (Array.isArray(edited.correctAnswer) ? (edited.correctAnswer as number[]).includes(i) : edited.correctAnswer === i) ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white text-slate-300'}`}>
                         {isTableType ? ((edited.correctAnswer as boolean[])[i] ? 'B' : 'S') : String.fromCharCode(65+i)}
                       </button>
                       <input type="text" className="flex-grow p-2 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 outline-none" value={opt} onChange={(e) => {
                         const n = [...edited.options]; n[i] = e.target.value; setEdited({...edited, options: n});
                       }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Preview Side */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300 space-y-4">
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Pratinjau Visual (Live Render)</label>
              <div className="bg-white p-6 rounded-xl shadow-sm min-h-[100px] border border-slate-200">
                <MathText text={edited.text || 'Teks soal akan muncul di sini...'} className="text-slate-800 font-bold text-lg leading-relaxed" />
              </div>
              <div className="grid grid-cols-1 gap-2">
                {edited.options.map((opt, i) => (
                  <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                    <span className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center text-[10px] font-black text-slate-400">{String.fromCharCode(65+i)}</span>
                    <MathText text={opt || '...'} className="text-sm font-semibold text-slate-700" />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Pratinjau Pembahasan</label>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 min-h-[60px]">
                  <MathText text={edited.explanation || 'Pembahasan akan muncul di sini...'} className="text-xs italic text-amber-900" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-4 border-t flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-500">Batal</button>
          <button onClick={() => onSave(edited)} className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all hover:bg-indigo-700">Simpan Perubahan</button>
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;
