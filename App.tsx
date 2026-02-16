
import React, { useState, useMemo } from 'react';
import Header from './components/Header';
import GenerationForm from './components/GenerationForm';
import QuestionList from './components/QuestionList';
import JsonPreview from './components/JsonPreview';
import QuestionEditor from './components/QuestionEditor';
import { EduCBTQuestion, GenerationConfig, QuestionType } from './types';
import { generateEduCBTQuestions, regenerateSingleQuestion, analyzeCognitiveLevel } from './geminiService';
import { exportQuestionsToExcel, downloadSoalPdf } from './utils/exportUtils';

const App: React.FC = () => {
  const [questions, setQuestions] = useState<EduCBTQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'json'>('preview');
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [editingId, setEditingId] = useState<string | null>(null);

  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => {
      const tokenA = String(a.quizToken || "").toLowerCase();
      const tokenB = String(b.quizToken || "").toLowerCase();
      if (tokenA < tokenB) return -1;
      if (tokenA > tokenB) return 1;
      return (Number(a.order) || 0) - (Number(b.order) || 0);
    });
  }, [questions]);

  const activeQuestions = useMemo(() => sortedQuestions.filter(q => !q.isDeleted), [sortedQuestions]);
  const trashQuestions = useMemo(() => sortedQuestions.filter(q => q.isDeleted), [sortedQuestions]);

  const handleImportJson = (importedQuestions: EduCBTQuestion[]) => {
    if (!importedQuestions || !Array.isArray(importedQuestions)) return;
    
    setQuestions(prev => {
      const startOrder = prev.length;
      const sanitized = importedQuestions.map((q, i) => ({
        ...q,
        id: q.id || `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        isDeleted: false,
        order: q.order || (startOrder + i + 1),
        quizToken: (q.quizToken || "IMPORT").toUpperCase(),
        text: q.text || "Soal tanpa teks",
        options: Array.isArray(q.options) ? q.options : [],
        type: q.type || QuestionType.PilihanGanda,
        level: q.level || "C1 Mengingat",
        explanation: q.explanation || ""
      }));
      return [...prev, ...sanitized];
    });
    setError(null);
  };

  const handleGenerate = async (config: GenerationConfig) => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateEduCBTQuestions(config);
      const lastOrder = questions.length > 0 ? Math.max(...questions.map(q => Number(q.order) || 0)) : 0;
      const resultWithOrder = result.map((q, i) => ({ ...q, order: lastOrder + i + 1 }));
      setQuestions(prev => [...prev, ...resultWithOrder]);
    } catch (err: any) {
      setError(err.message || "Gagal menghasilkan soal.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateQuestion = async (id: string, instructions?: string) => {
    const target = questions.find(q => q.id === id);
    if (!target) return;
    try {
      const newQuestion = await regenerateSingleQuestion(target, instructions);
      setQuestions(prev => prev.map(q => q.id === id ? { ...newQuestion, id } : q));
    } catch (err) { alert("Gagal mengganti soal."); }
  };

  const handleAutoDetermineLevel = async (id: string) => {
    const target = questions.find(q => q.id === id);
    if (!target) return;
    try {
      const detectedLevel = await analyzeCognitiveLevel(target);
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, level: detectedLevel } : q));
    } catch (err) {
      console.error("Gagal mendeteksi level.", err);
    }
  };

  const handleChangeType = (id: string, newType: QuestionType) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === id) return { ...q, type: newType };
      return q;
    }));
  };

  const handleUpdateQuestion = (updated: EduCBTQuestion) => {
    setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
    setEditingId(null);
  };

  const handleQuickUpdate = (id: string, field: 'order' | 'quizToken', value: any) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === id) return { ...q, [field]: value };
      return q;
    }));
  };

  const toggleTrash = (id: string, isDeleted: boolean) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, isDeleted } : q));
  };

  const handlePermanentlyDelete = (id: string) => {
    if (window.confirm("Hapus permanen soal ini? Tindakan ini tidak bisa dibatalkan.")) {
      setQuestions(prev => prev.filter(q => q.id !== id));
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow max-w-7xl mx-auto px-4 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            <div className="bg-white p-6 rounded-xl border border-indigo-100 shadow-sm sticky top-20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">Konfigurator Soal</h2>
              </div>
              <GenerationForm onGenerate={handleGenerate} onImportJson={handleImportJson} isLoading={loading} />
            </div>
          </div>
          <div className="lg:col-span-7">
            {questions.length > 0 ? (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl border border-slate-200 sticky top-20 z-40 flex items-center justify-between shadow-sm">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                      onClick={() => { setViewMode('preview'); setActiveTab('active'); }} 
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'active' && viewMode === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Aktif ({activeQuestions.length})
                    </button>
                    <button 
                      onClick={() => { setViewMode('preview'); setActiveTab('trash'); }} 
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'trash' && viewMode === 'preview' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Sampah ({trashQuestions.length})
                    </button>
                    <button 
                      onClick={() => setViewMode('json')} 
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${viewMode === 'json' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      JSON
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => exportQuestionsToExcel(activeQuestions)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-emerald-700 transition-colors shadow-sm">Export Excel</button>
                    <button onClick={() => downloadSoalPdf(activeQuestions)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-indigo-700 transition-colors shadow-sm">Download PDF</button>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm font-bold flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {error}
                  </div>
                )}

                {viewMode === 'preview' ? (
                  activeTab === 'trash' && trashQuestions.length === 0 ? (
                    <div className="h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 text-slate-400 p-8 text-center">
                      <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      <p className="font-bold uppercase text-[10px] tracking-widest">Tempat sampah kosong</p>
                    </div>
                  ) : (
                    <QuestionList 
                      questions={activeTab === 'active' ? activeQuestions : trashQuestions} 
                      onEdit={(q) => setEditingId(q.id)} 
                      onDelete={(id) => activeTab === 'active' ? toggleTrash(id, true) : handlePermanentlyDelete(id)} 
                      onRestore={(id) => toggleTrash(id, false)} 
                      onRegenerate={handleRegenerateQuestion} 
                      onQuickUpdate={handleQuickUpdate} 
                      onChangeType={handleChangeType} 
                      onAutoLevel={handleAutoDetermineLevel}
                      isTrashView={activeTab === 'trash'} 
                    />
                  )
                ) : ( 
                  <JsonPreview questions={activeQuestions} /> 
                )}
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-white text-slate-400 p-8 text-center">
                <div className="bg-slate-50 p-6 rounded-full mb-4">
                  <svg className="w-16 h-16 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-500 mb-1">Siap Menyusun Soal?</h3>
                <p className="text-sm italic opacity-75">Gunakan form di kiri untuk membuat soal otomatis atau scan dokumen.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      {editingId && questions.find(q => q.id === editingId) && <QuestionEditor question={questions.find(q => q.id === editingId)!} onSave={handleUpdateQuestion} onClose={() => setEditingId(null)} />}
    </div>
  );
};

export default App;
