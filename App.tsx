
import React, { useState, useMemo } from 'react';
import Header from './components/Header';
import GenerationForm from './components/GenerationForm';
import QuestionList from './components/QuestionList';
import JsonPreview from './components/JsonPreview';
import QuestionEditor from './components/QuestionEditor';
import { EduCBTQuestion, GenerationConfig, QuestionType } from './types';
import { generateEduCBTQuestions, regenerateSingleQuestion, analyzeCognitiveLevel } from './geminiService';
import { exportQuestionsToExcel, downloadSoalPdf } from './utils/exportUtils';
import { shuffleQuestions, shuffleAllOptions } from './utils/shuffleUtils';

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
        level: q.level || "L1",
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
                <div className="bg-white p-4 rounded-xl border border-slate-200 sticky top-20 z-40 flex items-center justify-between">
                  <div className="flex bg-slate-200 p-1 rounded-lg">
                    <button onClick={() => setViewMode('preview')} className={`px-4 py-1 rounded-md text-sm font-bold ${viewMode === 'preview' ? 'bg-white text-indigo-600' : ''}`}>Preview</button>
                    <button onClick={() => setViewMode('json')} className={`px-4 py-1 rounded-md text-sm font-bold ${viewMode === 'json' ? 'bg-white text-indigo-600' : ''}`}>JSON</button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => exportQuestionsToExcel(activeQuestions)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black">Export Excel</button>
                    <button onClick={() => downloadSoalPdf(activeQuestions)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black">Download PDF</button>
                  </div>
                </div>
                {viewMode === 'preview' ? (
                  <QuestionList 
                    questions={activeTab === 'active' ? activeQuestions : trashQuestions} 
                    onEdit={(q) => setEditingId(q.id)} 
                    onDelete={(id) => toggleTrash(id, true)} 
                    onRestore={(id) => toggleTrash(id, false)} 
                    onRegenerate={handleRegenerateQuestion} 
                    onQuickUpdate={handleQuickUpdate} 
                    onChangeType={handleChangeType} 
                    onAutoLevel={handleAutoDetermineLevel}
                    isTrashView={activeTab === 'trash'} 
                  />
                ) : ( <JsonPreview questions={activeQuestions} /> )}
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-white text-slate-400 italic">Belum ada soal.</div>
            )}
          </div>
        </div>
      </main>
      {editingId && questions.find(q => q.id === editingId) && <QuestionEditor question={questions.find(q => q.id === editingId)!} onSave={handleUpdateQuestion} onClose={() => setEditingId(null)} />}
    </div>
  );
};

export default App;
