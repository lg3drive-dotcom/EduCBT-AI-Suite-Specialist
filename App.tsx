
import React, { useState, useMemo } from 'react';
import Header from './components/Header';
import GenerationForm from './components/GenerationForm';
import QuestionList from './components/QuestionList';
import JsonPreview from './components/JsonPreview';
import QuestionEditor from './components/QuestionEditor';
import { EduCBTQuestion, GenerationConfig } from './types';
import { generateEduCBTQuestions, regenerateSingleQuestion } from './geminiService';
import { downloadSoalDoc, downloadKisiKisiDoc, downloadSoalPdf, downloadKisiKisiPdf } from './utils/exportUtils';

const App: React.FC = () => {
  const [questions, setQuestions] = useState<EduCBTQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'json'>('preview');
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  
  const [editingId, setEditingId] = useState<string | null>(null);

  // Mengurutkan soal berdasarkan properti 'order' secara otomatis
  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => {
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

  const handleGenerate = async (config: GenerationConfig) => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateEduCBTQuestions(config);
      const lastOrder = questions.length > 0 ? Math.max(...questions.map(q => q.order || 0)) : 0;
      const resultWithOrder = result.map((q, i) => ({ ...q, order: lastOrder + i + 1 }));
      
      setQuestions(prev => [...prev, ...resultWithOrder]);
    } catch (err) {
      setError("Gagal menghasilkan soal. Periksa koneksi atau API Key.");
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
        order: q.order || (prev.length + i + 1)
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
      alert("Gagal mengganti soal. Silakan coba lagi.");
      setQuestions(prev => prev.map(q => q.id === id ? { ...q, isRegenerating: false } : q));
    }
  };

  const handleUpdateQuestion = (updated: EduCBTQuestion) => {
    setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q));
    setEditingId(null);
  };

  // Fungsi khusus untuk update cepat (Order & Token)
  const handleQuickUpdate = (id: string, field: 'order' | 'quizToken', value: any) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === id) {
        // Jika field adalah order, pastikan disimpan sebagai angka jika memungkinkan
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
      const active = prev.filter(q => !q.isDeleted).sort((a, b) => (a.order || 0) - (b.order || 0));
      const trashed = prev.filter(q => q.isDeleted);
      
      const reorderedActive = active.map((q, i) => ({ ...q, order: i + 1 }));
      return [...reorderedActive, ...trashed];
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
            {error && <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
          </div>

          <div className="lg:col-span-7">
            {(questions.length > 0 || loading) ? (
              <div className="space-y-6">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-20 z-40">
                  <div className="flex items-center justify-between mb-4 gap-2">
                    <div className="flex bg-slate-200 p-1 rounded-lg">
                      <button onClick={() => setViewMode('preview')} className={`px-4 py-1 rounded-md text-sm font-bold ${viewMode === 'preview' ? 'bg-white text-indigo-600' : 'text-slate-600'}`}>Preview</button>
                      <button onClick={() => setViewMode('json')} className={`px-4 py-1 rounded-md text-sm font-bold ${viewMode === 'json' ? 'bg-white text-indigo-600' : 'text-slate-600'}`}>JSON</button>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <button 
                        onClick={reorderSequentially}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-100 transition-colors"
                        title="Urutkan nomor 1, 2, 3... secara otomatis"
                      >
                        Auto-Urut
                      </button>
                      <button onClick={() => downloadSoalPdf(activeQuestions)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase">Download PDF</button>
                    </div>
                  </div>
                  <div className="flex gap-4 border-t pt-4">
                    <button onClick={() => setActiveTab('active')} className={`text-sm font-bold pb-2 border-b-2 ${activeTab === 'active' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Soal Aktif ({activeQuestions.length})</button>
                    <button onClick={() => setActiveTab('trash')} className={`text-sm font-bold pb-2 border-b-2 ${activeTab === 'trash' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-400'}`}>Sampah ({trashQuestions.length})</button>
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
                    isTrashView={activeTab === 'trash'}
                  />
                ) : (
                  <JsonPreview questions={activeQuestions} />
                )}
                {loading && <div className="p-8 text-center animate-pulse text-indigo-600 font-black">MENAMBAH SOAL BARU...</div>}
              </div>
            ) : (
              <div className="h-[400px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-white text-slate-400 text-center px-8 italic">
                Belum ada soal aktif.<br/>Gunakan form di samping atau buka beberapa file JSON untuk menggabungkannya.
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
