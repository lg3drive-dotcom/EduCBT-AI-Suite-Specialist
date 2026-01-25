
import React, { useState } from 'react';
import { EduCBTQuestion, QuestionType } from '../types';
import ImageControl from './ImageControl';

interface Props {
  question: EduCBTQuestion;
  onSave: (updated: EduCBTQuestion) => void;
  onClose: () => void;
}

const QuestionEditor: React.FC<Props> = ({ question, onSave, onClose }) => {
  const [edited, setEdited] = useState<EduCBTQuestion>({ 
    ...question,
    optionImages: question.optionImages || question.options.map(() => null),
    tfLabels: question.tfLabels || (question.type === QuestionType.KompleksBS ? { true: 'Benar', false: 'Salah' } : undefined)
  });

  const handleOptionChange = (idx: number, text: string) => {
    const newOptions = [...edited.options];
    newOptions[idx] = text;
    setEdited({ ...edited, options: newOptions });
  };

  const handleOptionImageChange = (idx: number, base64: string | undefined) => {
    const newOptionImages = [...(edited.optionImages || [])];
    newOptionImages[idx] = base64 || null;
    setEdited({ ...edited, optionImages: newOptionImages });
  };

  const handleCorrectAnswerChange = (idx: number) => {
    if (edited.type === QuestionType.PilihanGanda) {
      setEdited({ ...edited, correctAnswer: idx });
    } else if (edited.type === QuestionType.MCMA) {
      const current = Array.isArray(edited.correctAnswer) ? (edited.correctAnswer as number[]) : [];
      const updated = current.includes(idx) 
        ? current.filter(i => i !== idx) 
        : [...current, idx];
      setEdited({ ...edited, correctAnswer: updated });
    } else if (edited.type === QuestionType.Kompleks) {
      const current = Array.isArray(edited.correctAnswer) ? (edited.correctAnswer as boolean[]) : edited.options.map(() => false);
      const updated = [...current];
      updated[idx] = !updated[idx];
      setEdited({ ...edited, correctAnswer: updated });
    } else if (edited.type === QuestionType.KompleksBS) {
      const current = Array.isArray(edited.correctAnswer) ? (edited.correctAnswer as boolean[]) : edited.options.map(() => false);
      const updated = [...current];
      updated[idx] = !updated[idx];
      setEdited({ ...edited, correctAnswer: updated });
    }
  };

  const handleTfLabelChange = (key: 'true' | 'false', value: string) => {
    setEdited({
      ...edited,
      tfLabels: {
        ...(edited.tfLabels || { true: 'Benar', false: 'Salah' }),
        [key]: value
      }
    });
  };

  const isBS = edited.type === QuestionType.KompleksBS;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
      <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-white/20">
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30">
          <div>
            <h2 className="text-2xl font-black text-indigo-900">Editor Butir Soal</h2>
            <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest">{edited.type} • {edited.level}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-rose-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-8 space-y-8 bg-white">
          {isBS && (
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-purple-700 uppercase mb-1">Label Nilai TRUE</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 rounded-lg border border-purple-300 text-sm font-bold"
                  value={edited.tfLabels?.true}
                  onChange={(e) => handleTfLabelChange('true', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-purple-700 uppercase mb-1">Label Nilai FALSE</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 rounded-lg border border-purple-300 text-sm font-bold"
                  value={edited.tfLabels?.false}
                  onChange={(e) => handleTfLabelChange('false', e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-blue-50/30 p-5 rounded-2xl border border-blue-100">
                <label className="block text-xs font-black text-blue-900 uppercase tracking-widest mb-3">Narasi / Teks Soal</label>
                <textarea 
                  rows={8}
                  className="w-full p-5 rounded-xl border border-blue-200 bg-white shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm leading-relaxed text-slate-800"
                  value={edited.text}
                  onChange={(e) => setEdited({...edited, text: e.target.value})}
                  placeholder="Ketikkan teks soal di sini..."
                />
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <ImageControl 
                  label="Stimulus Visual (Gambar Soal)" 
                  currentImage={edited.image} 
                  onImageChange={(img) => setEdited({...edited, image: img})} 
                />
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100">
                <label className="block text-xs font-black text-emerald-900 uppercase tracking-widest mb-4">
                  {isBS ? 'Daftar Pernyataan' : 'Pilihan Jawaban'}
                </label>
                <div className="space-y-4">
                  {edited.options.map((opt, i) => (
                    <div key={i} className="group bg-white p-4 rounded-xl border border-emerald-100 shadow-sm hover:shadow-md transition-all space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center gap-1">
                          {isBS ? (
                            <button 
                              type="button"
                              onClick={() => handleCorrectAnswerChange(i)}
                              className={`px-3 py-1 rounded text-[10px] font-black uppercase transition-all ${
                                (edited.correctAnswer as boolean[])[i] 
                                  ? 'bg-emerald-600 text-white' 
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {(edited.correctAnswer as boolean[])[i] ? edited.tfLabels?.true : edited.tfLabels?.false}
                            </button>
                          ) : (
                            <input 
                              type={edited.type === QuestionType.PilihanGanda ? "radio" : "checkbox"} 
                              checked={
                                Array.isArray(edited.correctAnswer) 
                                  ? (typeof edited.correctAnswer[0] === 'boolean' ? edited.correctAnswer[i] as boolean : (edited.correctAnswer as number[]).includes(i))
                                  : edited.correctAnswer === i
                              }
                              onChange={() => handleCorrectAnswerChange(i)}
                              className="w-6 h-6 text-emerald-600 rounded-full border-2 border-emerald-200 focus:ring-emerald-500 cursor-pointer"
                            />
                          )}
                        </div>
                        <input 
                          type="text" 
                          value={opt}
                          onChange={(e) => handleOptionChange(i, e.target.value)}
                          className="flex-grow bg-transparent border-b-2 border-slate-100 focus:border-emerald-400 outline-none py-1 text-sm font-bold text-slate-700"
                          placeholder={`Ketik ${isBS ? 'Pernyataan' : 'Opsi'} ${String.fromCharCode(65+i)}...`}
                        />
                      </div>
                      {!isBS && (
                        <ImageControl 
                          label={`Gambar Opsi ${String.fromCharCode(65+i)}`}
                          currentImage={edited.optionImages?.[i] || undefined}
                          onImageChange={(img) => handleOptionImageChange(i, img)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-amber-50/50 rounded-2xl border border-amber-200">
            <label className="block text-xs font-black text-amber-700 uppercase tracking-widest mb-3">Analisis Kunci & Pembahasan</label>
            <textarea 
              rows={4}
              className="w-full p-4 rounded-xl border border-amber-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500 shadow-inner italic text-amber-900"
              value={edited.explanation}
              onChange={(e) => setEdited({...edited, explanation: e.target.value})}
              placeholder="Jelaskan alasan jawaban tersebut benar..."
            />
          </div>
        </div>

        <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-4 bg-slate-50">
          <button 
            onClick={onClose} 
            className="px-8 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-white transition-all"
          >
            Batalkan
          </button>
          <button 
            onClick={() => onSave(edited)}
            className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
          >
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;
