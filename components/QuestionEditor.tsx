
import React, { useState } from 'react';
import { EduCBTQuestion, QuestionType } from '../types';
import { suggestLevel, generateSingleExplanation } from '../geminiService';
import ImageControl from './ImageControl';

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

  const handleAutoLevel = async () => {
    if (isLevelLoading) return;
    setIsLevelLoading(true);
    try {
      const level = await suggestLevel(edited.text, edited.options);
      setEdited(prev => ({ ...prev, level }));
    } catch (err) {
      alert("Gagal menentukan level otomatis.");
    } finally {
      setIsLevelLoading(false);
    }
  };

  const handleAutoExplanation = async () => {
    if (isExpLoading) return;
    setIsExpLoading(true);
    try {
      const explanation = await generateSingleExplanation(edited);
      setEdited(prev => ({ ...prev, explanation }));
    } catch (err) {
      alert("Gagal membuat pembahasan otomatis.");
    } finally {
      setIsExpLoading(false);
    }
  };

  const isTableType = edited.type === QuestionType.BenarSalah || edited.type === QuestionType.SesuaiTidakSesuai;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-6xl max-h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50/50">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-indigo-900 uppercase tracking-tighter">Editor Soal Profesional</h2>
            <div className="h-6 w-[1px] bg-indigo-200"></div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Level:</label>
              <select 
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-indigo-600 outline-none"
                value={edited.level}
                onChange={(e) => setEdited({...edited, level: e.target.value})}
              >
                <option value="L1">L1 (Ingatan)</option>
                <option value="L2">L2 (Aplikasi)</option>
                <option value="L3">L3 (Penalaran)</option>
              </select>
              <button 
                onClick={handleAutoLevel}
                disabled={isLevelLoading}
                className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50"
                title="Tentukan Level via AI"
              >
                {isLevelLoading ? (
                  <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                )}
              </button>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="flex-grow overflow-y-auto p-8 space-y-8">
          {/* Section Stimulus */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 shadow-inner">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <label className="text-[10px] font-black uppercase text-indigo-900 tracking-widest">Stimulus / Bacaan (Digunakan Bersama)</label>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <textarea 
                  rows={6} 
                  placeholder="Masukkan teks stimulus atau bacaan di sini..."
                  className="w-full p-4 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-inner" 
                  value={edited.stimulusText || ''} 
                  onChange={(e) => setEdited({...edited, stimulusText: e.target.value})} 
                />
              </div>
              <ImageControl 
                label="Gambar Stimulus" 
                currentImage={edited.stimulusImage} 
                onImageChange={(img) => setEdited({...edited, stimulusImage: img})} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Section Pertanyaan */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-2">Pertanyaan Spesifik</label>
                <textarea rows={4} className="w-full p-4 rounded-xl border border-slate-200 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={edited.text} onChange={(e) => setEdited({...edited, text: e.target.value})} />
              </div>
              <ImageControl label="Gambar Khusus Soal ini" currentImage={edited.image} onImageChange={(img) => setEdited({...edited, image: img})} />
            </div>

            {/* Section Opsi */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black uppercase text-slate-500">{isTableType ? 'Pernyataan / Analisis' : 'Opsi Jawaban'}</label>
                <button onClick={() => {
                  const newOptions = [...edited.options, ""];
                  let newAns = edited.correctAnswer;
                  if (isTableType) newAns = [...(Array.isArray(edited.correctAnswer) ? edited.correctAnswer : []) as boolean[], false];
                  setEdited({...edited, options: newOptions, correctAnswer: newAns});
                }} className="text-[10px] font-bold text-indigo-600 hover:underline">+ Tambah Opsi</button>
              </div>

              <div className="space-y-3">
                {edited.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                    {/* Fix: changed 'idx' to 'i' on line 153 to resolve "Cannot find name 'idx'" error. */}
                    <button type="button" onClick={() => handleCorrectAnswerChange(i)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border-2 transition-all shrink-0 ${
                      isTableType ? (
                        (edited.correctAnswer as boolean[])[i] ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-rose-500 border-rose-500 text-white'
                      ) : (
                        (Array.isArray(edited.correctAnswer) ? (edited.correctAnswer as number[]).includes(i) : edited.correctAnswer === i) 
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' 
                        : 'bg-white border-slate-200 text-slate-400'
                      )
                    }`}>
                      {isTableType ? ((edited.correctAnswer as boolean[])[i] ? 'B' : 'S') : String.fromCharCode(65+i)}
                    </button>
                    <input type="text" className="flex-grow bg-transparent border-b border-transparent focus:border-indigo-300 outline-none text-sm font-semibold py-1" value={opt} onChange={(e) => {
                      const newOps = [...edited.options]; newOps[i] = e.target.value; setEdited({...edited, options: newOps});
                    }} />
                    <button onClick={() => {
                      const newOps = [...edited.options]; newOps.splice(i, 1);
                      let newAns = edited.correctAnswer;
                      if (isTableType && Array.isArray(newAns)) {
                         const arr = [...newAns]; arr.splice(i, 1); newAns = arr;
                      }
                      setEdited({...edited, options: newOps, correctAnswer: newAns});
                    }} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] font-black uppercase text-slate-500">Analisis Jawaban / Pembahasan</label>
              <button 
                onClick={handleAutoExplanation}
                disabled={isExpLoading}
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase hover:bg-amber-200 transition-all disabled:opacity-50"
              >
                {isExpLoading ? (
                  <div className="w-3 h-3 border-2 border-amber-700 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.628.283a2 2 0 01-1.186.127l-2.431-.486a2 2 0 00-1.638.527l-1.138 1.138a2 2 0 00-.509 1.35l.206 2.707a2 2 0 00.99 1.581l2.356 1.308a2 2 0 002.254-.158 10.97 10.97 0 003.958-3.958 2 2 0 00-.158-2.254l-1.308-2.356a2 2 0 00-1.581-.99l-2.707-.206a2 2 0 00-1.35.509l-1.138 1.138z" /></svg>
                )}
                <span>✨ Buat Pembahasan Otomatis</span>
              </button>
            </div>
            <textarea rows={3} className="w-full p-4 rounded-xl border border-slate-200 text-sm italic text-slate-600 outline-none bg-amber-50/30 focus:ring-2 focus:ring-amber-200" value={edited.explanation} onChange={(e) => setEdited({...edited, explanation: e.target.value})} />
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
