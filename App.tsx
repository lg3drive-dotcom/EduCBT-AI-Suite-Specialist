
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
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
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
        quizToken: (q.quizToken || "IMPORT").toString().toUpperCase(),
        text: q.text || "Soal tanpa teks",
        options: Array.isArray(q.options) ? q.options : [],
        type: q.type || QuestionType.PilihanGanda,
        level: q.level || "C1 Mengingat",
        explanation: q.explanation || ""
      }));
      return [...prev, ...sanitized];
    });
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

  const handleRegenerate = async (id: string, instructions?: string) => {
    const target = questions.find(q => q.id === id);
    if (!target) return;

    setRegeneratingIds(prev => new Set(prev).add(id));
    try {
      const res = await regenerateSingleQuestion(target, instructions);
      setQuestions(prev => prev.map(q => q.id === id ? { ...res, id, isDeleted: false } : q));
    } catch (err) {
      alert("Gagal merevisi soal.");
    } finally {
      setRegeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleTrash = (id: string, isDeleted: boolean) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, isDeleted } : q));
  };

  const handlePermanentlyDelete = (id: string) => {
    if (window.confirm("Hapus permanen soal ini?")) {
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
              <h2 className="text-xl font-bold text-slate-900 mb-4">Konfigurator Soal</h2>
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
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'active' && viewMode === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      Aktif ({activeQuestions.length})
                    </button>
                    <button 
                      onClick={() => { setViewMode('preview'); setActiveTab('trash'); }} 
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'trash' && viewMode === 'preview' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      Sampah ({trashQuestions.length})
                    </button>
                    <button 
                      onClick={() => setViewMode('json')} 
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${viewMode === 'json' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      JSON
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => exportQuestionsToExcel(activeQuestions)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase">Export Excel</button>
                    <button onClick={() => downloadSoalPdf(activeQuestions)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase">Download PDF</button>
                  </div>
                </div>

                {viewMode === 'preview' ? (
                  <QuestionList 
                    questions={activeTab === 'active' ? activeQuestions : trashQuestions} 
                    onEdit={(q) => setEditingId(q.id)} 
                    onDelete={(id) => activeTab === 'active' ? toggleTrash(id, true) : handlePermanentlyDelete(id)} 
                    onRestore={(id) => toggleTrash(id, false)} 
                    onRegenerate={handleRegenerate} 
                    onQuickUpdate={(id, f, v) => setQuestions(prev => prev.map(q => q.id === id ? { ...q, [f]: v } : q))} 
                    onChangeType={(id, t) => setQuestions(prev => prev.map(q => q.id === id ? { ...q, type: t } : q))} 
                    onAutoLevel={async (id) => {
                      const target = questions.find(q => q.id === id);
                      if (target) {
                        const lvl = await analyzeCognitiveLevel(target);
                        setQuestions(prev => prev.map(q => q.id === id ? { ...q, level: lvl } : q));
                      }
                    }}
                    isTrashView={activeTab === 'trash'} 
                    regeneratingIds={regeneratingIds}
                  />
                ) : ( <JsonPreview questions={activeQuestions} /> )}
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-white text-slate-400 italic">Belum ada soal.</div>
            )}
          </div>
        </div>
      </main>
      {editingId && questions.find(q => q.id === editingId) && <QuestionEditor question={questions.find(q => q.id === editingId)!} onSave={(u) => { setQuestions(prev => prev.map(q => q.id === u.id ? u : q)); setEditingId(null); }} onClose={() => setEditingId(null)} />}
    </div>
  );
};

export default App;
