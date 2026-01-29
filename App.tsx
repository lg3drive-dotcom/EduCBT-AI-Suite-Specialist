
import React, { useState, useMemo } from 'react';
import Header from './components/Header';
import GenerationForm from './components/GenerationForm';
import QuestionList from './components/QuestionList';
import JsonPreview from './components/JsonPreview';
import QuestionEditor from './components/QuestionEditor';
import { EduCBTQuestion, GenerationConfig, QuestionType } from './types';
import { generateEduCBTQuestions, regenerateSingleQuestion, repairQuestions } from './geminiService';
import { downloadSoalDoc, downloadKisiKisiDoc, downloadSoalPdf, downloadKisiKisiPdf, exportQuestionsToExcel } from './utils/exportUtils';
import { shuffleQuestions, shuffleAllOptions } from './utils/shuffleUtils';

const App: React.FC = () => {
  const [questions, setQuestions] = useState<EduCBTQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'json'>('preview');
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  
  const [editingId, setEditingId] = useState<string | null>(null);

  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => {
      const tokenA = (a.quizToken || "").toString().toLowerCase();
      const tokenB = (b.quizToken || "").toString().toLowerCase();
      if (tokenA < tokenB) return -1;
      if (tokenA > tokenB) return 1;
      const orderA = typeof a.order === 'number' ? a.order : parseInt(a.order as any) || 0;
      const orderB = typeof b.order === 'number' ? b.order : parseInt(b.order as any) || 0;
      return orderA - orderB;
    });
  }, [questions]);

  const activeQuestions = useMemo(() => 
    sortedQuestions.filter(q => !q.isDeleted), 
    [sortedQuestions]
  );
  
  const trashQuestions = useMemo(() => 
    sortedQuestions.filter(q => q.isDeleted), 
    [sortedQuestions]
  );

  const hasEmptyFields = useMemo(() => {
    return activeQuestions.some(q => !q.explanation || q.material === "Materi Belum Terisi" || !q.level);
  }, [activeQuestions]);

  const handleSmartRepair = async () => {
    if (activeQuestions.length === 0) return;
    setRepairing(true);
    setError(null);
    try {
      const repaired = await repairQuestions(activeQuestions);
      setQuestions(prev => {
        const trash = prev.filter(q => q.isDeleted);
        return [...repaired, ...trash];
      });
      alert("AI telah melengkapi data yang kosong (Pembahasan, Materi, dan Level).");
    } catch (err: any) {
      setError(err.message || "Gagal melakukan perbaikan data via AI.");
    } finally {
      setRepairing(false);
    }
  };

  const handleGenerate = async (config: GenerationConfig) => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateEduCBTQuestions(config);
      const lastOrder = questions.length > 0 ? Math.max(...questions.map(q => q.order || 0)) : 0;
      const resultWithOrder = result.map((q, i) => ({ ...q, order: lastOrder + i + 1 }));
      setQuestions(prev => [...prev, ...resultWithOrder]);
    } catch (err: any) {
      setError(err.message || "Gagal menghasilkan soal. Periksa koneksi atau API Key.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportJson = (importedQuestions: EduCBTQuestion[]) => {
    setQuestions(prev => {
      const sanitized = importedQuestions.map((q, i) => ({
        ...q,
        id: q.id || `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        isDeleted: q.isDeleted ?? false,
        isRegenerating: false,
        order: q.order || (prev.length + i + 1),
        quizToken: q.quizToken || ""
      }));
      return [...prev, ...sanitized];
    });
    setError(null);
  };

  const handleRegenerateQuestion = async (id: string, instructions?: string) => {
    const target = questions.find(q => q.id === id);
    if (!target) return;
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, isRegenerating: true } : q));
    try {
      const newQuestion = await regenerateSingleQuestion(target, instructions);
      setQuestions(prev => prev.map(q => q.id === id ? { ...newQuestion, isRegenerating: false } : q));
    } catch (err) {
      alert("Gagal mengganti soal. AI sedang sibuk atau limit tercapai.");
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, isRegenerating: false } : q));
    }
  };

  const handleChangeType = (id: string, newType: QuestionType) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === id) {
        let newCorrectAnswer = q.correctAnswer;
        let newTfLabels = q.tfLabels;

        if (newType === QuestionType.PilihanGanda) {
          if (Array.isArray(q.correctAnswer)) {
             const firstIndex = q.correctAnswer.findIndex(v => v === true || typeof v === 'number');
             newCorrectAnswer = firstIndex !== -1 ? firstIndex : 0;
          } else if (typeof q.correctAnswer !== 'number') {
             newCorrectAnswer = 0;
          }
        } 
        else if (newType === QuestionType.MCMA) {
          if (!Array.isArray(q.correctAnswer)) {
            newCorrectAnswer = [typeof q.correctAnswer === 'number' ? q.correctAnswer : 0];
          } else {
            if (typeof q.correctAnswer[0] === 'boolean') {
               newCorrectAnswer = (q.correctAnswer as boolean[]).map((v, i) => v ? i : -1).filter(i => i !== -1);
            }
          }
        }
        else if (newType === QuestionType.Kompleks || newType === QuestionType.KompleksBS) {
          if (!Array.isArray(q.correctAnswer)) {
            const arr = q.options.map(() => false);
            if (typeof q.correctAnswer === 'number' && q.correctAnswer < arr.length) {
              arr[q.correctAnswer] = true;
            }
            newCorrectAnswer = arr;
          } else if (typeof q.correctAnswer[0] === 'number') {
             const arr = q.options.map(() => false);
             (q.correctAnswer as number[]).forEach(idx => { if (idx < arr.length) arr[idx] = true; });
             newCorrectAnswer = arr;
          }

          if (newType === QuestionType.KompleksBS && !newTfLabels) {
            newTfLabels = { true: 'Benar', false: 'Salah' };
          }
        }
        else if (newType === QuestionType.Isian || newType === QuestionType.Uraian) {
          newCorrectAnswer = "";
        }

        return { 
          ...q, 
          type: newType, 
          correctAnswer: newCorrectAnswer,
          tfLabels: newTfLabels
        };
      }
      return q;
    }));
  };

  const handleUpdateQuestion = (updated: EduCBTQuestion) => {
    setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
    setEditingId(null);
  };

  const handleQuickUpdate = (id: string, field: 'order' | 'quizToken', value: any) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === id) {
        let finalValue = value;
        if (field === 'order' && value !== "") {
          finalValue = parseInt(value);
          if (isNaN(finalValue)) finalValue = q.order;
        }
        return { ...q, [field]: finalValue };
      }
      return q;
    }));
  };

  const editingQuestion = useMemo(() => questions.find(q => q.id === editingId), [editingId, questions]);

  const toggleTrash = (id: string, isDeleted: boolean) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, isDeleted } : q));
  };

  const reorderSequentially = () => {
    setQuestions(prev => {
      const active = [...prev].filter(q => !q.isDeleted).sort((a, b) => {
        const tokenA = (a.quizToken || "").toString().toLowerCase();
        const tokenB = (b.quizToken || "").toString().toLowerCase();
        if (tokenA < tokenB) return -1;
        if (tokenA > tokenB) return 1;
        return (a.order || 0) - (b.order || 0);
      });
      const trashed = prev.filter(q => q.isDeleted);
      const reorderedActive = active.map((q, i) => ({ ...q, order: i + 1 }));
      return [...reorderedActive, ...trashed];
    });
  };

  const handleShuffleQuestions = () => {
    if (activeQuestions.length <= 1) return;
    if (!confirm("Acak urutan soal? Ini akan mereset nomor urut.")) return;
    
    setQuestions(prev => {
      const active = prev.filter(q => !q.isDeleted);
      const trashed = prev.filter(q => q.isDeleted);
      const shuffled = shuffleQuestions(active);
      return [...shuffled, ...trashed];
    });
  };

  const handleShuffleOptions = () => {
    if (activeQuestions.length === 0) return;
    if (!confirm("Acak semua pilihan jawaban (opsi) pada soal aktif? Kunci jawaban akan otomatis disesuaikan.")) return;
    
    setQuestions(prev => {
      const active = prev.filter(q => !q.isDeleted);
      const trashed = prev.filter(q => q.isDeleted);
      const shuffled = shuffleAllOptions(active);
      return [...shuffled, ...trashed];
    });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm sticky top-20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">Konfigurator Soal</h2>
              </div>
              <GenerationForm 
                onGenerate={handleGenerate} 
                onImportJson={handleImportJson}
                isLoading={loading} 
              />
            </div>
            {error && (
              <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-xl text-xs font-bold animate-shake">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                  <span>SISTEM AI TERKENDALA</span>
                </div>
                {error}
              </div>
            )}
          </div>

          <div className="lg:col-span-7">
            {(questions.length > 0 || loading) ? (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-20 z-40">
                  <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                    <div className="flex bg-slate-200 p-1 rounded-lg">
                      <button onClick={() => setViewMode('preview')} className={`px-4 py-1 rounded-md text-sm font-bold ${viewMode === 'preview' ? 'bg-white text-indigo-600' : 'text-slate-600'}`}>Preview</button>
                      <button onClick={() => setViewMode('json')} className={`px-4 py-1 rounded-md text-sm font-bold ${viewMode === 'json' ? 'bg-white text-indigo-600' : 'text-slate-600'}`}>JSON</button>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {hasEmptyFields && activeTab === 'active' && (
                        <button 
                          onClick={handleSmartRepair}
                          disabled={repairing}
                          className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-2 hover:bg-amber-700 transition-colors shadow-lg shadow-amber-200 animate-pulse-slow"
                        >
                          {repairing ? 'Memproses...' : '✨ Lengkapi via AI'}
                        </button>
                      )}
                      <button 
                        onClick={reorderSequentially}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-100 transition-colors"
                        title="Urutkan soal berdasarkan Token dan Nomor"
                      >
                        Auto-Urut
                      </button>
                      <button 
                        onClick={handleShuffleQuestions}
                        className="px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-[10px] font-black uppercase hover:bg-orange-100 transition-colors"
                        title="Acak urutan seluruh soal aktif"
                      >
                        Acak Soal
                      </button>
                      <button 
                        onClick={handleShuffleOptions}
                        className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-black uppercase hover:bg-purple-100 transition-colors"
                        title="Acak pilihan jawaban (opsi) tiap soal"
                      >
                        Acak Opsi
                      </button>
                      <button onClick={() => exportQuestionsToExcel(activeQuestions)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-emerald-200 shadow-lg">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0L8 8m4-4v12" /></svg>
                        Export Excel
                      </button>
                      <button onClick={() => downloadSoalPdf(activeQuestions)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase">Download PDF</button>
                    </div>
                  </div>
                  <div className="flex gap-4 border-t pt-4">
                    <button onClick={() => setActiveTab('active')} className={`text-sm font-bold pb-2 border-b-2 ${activeTab === 'active' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Soal Aktif ({activeQuestions.length})</button>
                    <button onClick={() => setActiveTab('trash')} className={`text-sm font-bold pb-2 border-b-2 ${activeTab === 'trash' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-400'}`}>Sampah ({trashQuestions.length})</button>
                  </div>
                </div>

                {repairing && (
                  <div className="bg-amber-50 p-6 rounded-2xl border-2 border-dashed border-amber-300 flex flex-col items-center justify-center text-center space-y-3">
                    <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-black text-amber-900 uppercase tracking-widest">Sistem sedang menganalisis & melengkapi soal...</p>
                    <p className="text-xs text-amber-700 italic">Membagi proses menjadi batch kecil untuk menghindari Rate Limit.</p>
                  </div>
                )}

                {viewMode === 'preview' ? (
                  <QuestionList 
                    questions={activeTab === 'active' ? activeQuestions : trashQuestions} 
                    onEdit={(q) => setEditingId(q.id)}
                    onDelete={(id) => toggleTrash(id, true)}
                    onRestore={(id) => toggleTrash(id, false)}
                    onRegenerate={handleRegenerateQuestion}
                    onQuickUpdate={handleQuickUpdate}
                    onChangeType={handleChangeType}
                    isTrashView={activeTab === 'trash'}
                  />
                ) : (
                  <JsonPreview questions={activeQuestions} />
                )}
                {loading && (
                  <div className="p-12 text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-indigo-600 font-black uppercase tracking-widest text-sm">Sedang berdiskusi dengan AI untuk merancang soal...</p>
                    <p className="text-[10px] text-slate-400">Jika memakan waktu lama, sistem mungkin sedang melakukan antrean retry otomatis.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-white text-slate-400 text-center px-8 italic">
                Belum ada soal aktif.<br/>Gunakan form di samping atau buka beberapa file JSON.
              </div>
            )}
          </div>
        </div>
      </main>
      {editingQuestion && <QuestionEditor question={editingQuestion} onSave={handleUpdateQuestion} onClose={() => setEditingId(null)} />}
    </div>
  );
};

export default App;
