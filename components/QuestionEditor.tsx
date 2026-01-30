
import React, { useState } from 'react';
import { EduCBTQuestion, QuestionType } from '../types';
import ImageControl from './ImageControl';
import { generateExplanationForQuestion, analyzeLevelForQuestion } from '../geminiService';

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
      <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50/50">
          <h2 className="text-xl font-black text-indigo-900">Edit Soal {edited.type}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="flex-grow overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">Teks Soal</label>
                <textarea rows={6} className="w-full p-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={edited.text} onChange={(e) => setEdited({...edited, text: e.target.value})} />
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
                }} className="text-[10px] font-bold text-indigo-600">+ Tambah</button>
              </div>

              <div className="space-y-3">
                {edited.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex flex-col items-center">
                      <button type="button" onClick={() => handleCorrectAnswerChange(i)} className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-black border-2 transition-all ${
                        isTableType ? (
                          (edited.correctAnswer as boolean[])[i] ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-rose-500 border-rose-500 text-white'
                        ) : (
                          (Array.isArray(edited.correctAnswer) ? (edited.correctAnswer as number[]).includes(i) : edited.correctAnswer === i) 
                          ? 'bg-emerald-500 border-emerald-500 text-white' 
                          : 'bg-white border-slate-200 text-slate-400'
                        )
                      }`}>
                        {isTableType ? ((edited.correctAnswer as boolean[])[i] ? 'B' : 'S') : String.fromCharCode(65+i)}
                      </button>
                    </div>
                    <input type="text" className="flex-grow bg-transparent border-b border-slate-200 outline-none text-sm font-bold" value={opt} onChange={(e) => {
                      const newOps = [...edited.options]; newOps[i] = e.target.value; setEdited({...edited, options: newOps});
                    }} />
                    <button onClick={() => {
                      const newOps = [...edited.options]; newOps.splice(i, 1);
                      let newAns = edited.correctAnswer;
                      if (isTableType && Array.isArray(newAns)) {
                         const arr = [...newAns]; arr.splice(i, 1); newAns = arr;
                      }
                      setEdited({...edited, options: newOps, correctAnswer: newAns});
                    }} className="text-rose-400 hover:text-rose-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">Pembahasan</label>
            <textarea rows={3} className="w-full p-4 rounded-xl border border-slate-200 text-sm italic text-slate-600 outline-none" value={edited.explanation} onChange={(e) => setEdited({...edited, explanation: e.target.value})} />
          </div>
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-500">Batal</button>
          <button onClick={() => onSave(edited)} className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Simpan</button>
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;
