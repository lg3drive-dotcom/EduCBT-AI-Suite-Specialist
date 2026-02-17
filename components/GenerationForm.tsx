
import React, { useState, useRef } from 'react';
import { GenerationConfig, QuestionType, EduCBTQuestion } from '../types';
import { downloadExcelTemplate } from '../utils/exportUtils';
import { extractQuestionsFromMedia } from '../geminiService';

interface Props {
  onGenerate: (config: GenerationConfig) => void;
  onImportJson: (questions: EduCBTQuestion[]) => void;
  isLoading: boolean;
}

interface FileRef {
  id: string;
  name: string;
  type: string;
  preview?: string;
  text?: string;
  imageData?: string;
  mimeType: string;
}

const GenerationForm: React.FC<Props> = ({ onGenerate, onImportJson, isLoading }) => {
  const [formData, setFormData] = useState<Omit<GenerationConfig, 'referenceTexts' | 'referenceImages'>>({
    subject: 'Mata Pelajaran',
    phase: 'Fase C',
    material: '',
    typeCounts: {
      [QuestionType.PilihanGanda]: 5,
      [QuestionType.MCMA]: 0,
      [QuestionType.BenarSalah]: 0,
      [QuestionType.SesuaiTidakSesuai]: 0,
      [QuestionType.Isian]: 0,
      [QuestionType.Uraian]: 0,
    },
    // Kembali menggunakan L1, L2, L3 untuk mapping yang lebih sederhana bagi guru
    levelCounts: { 
      'L1': 2, 
      'L2': 2, 
      'L3': 1 
    },
    quizToken: '',
    specialInstructions: ''
  });

  const [attachedFiles, setAttachedFiles] = useState<FileRef[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const processFile = async (file: File): Promise<FileRef | null> => {
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      
      if (file.type.startsWith("image/")) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const base64 = (evt.target?.result as string).split(',')[1];
            resolve({
              id: Math.random().toString(36).substring(7),
              name: file.name,
              type: 'image',
              preview: evt.target?.result as string,
              imageData: base64,
              mimeType: file.type
            });
          };
          reader.readAsDataURL(file);
        });
      } else if (file.type === "application/pdf") {
        // @ts-ignore
        const pdfJS = window.pdfjsLib;
        pdfJS.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfJS.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
        }
        return { id: Math.random().toString(36).substring(7), name: file.name, type: 'pdf', text: fullText, mimeType: file.type };
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        // @ts-ignore
        const mammoth = window.mammoth;
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return { id: Math.random().toString(36).substring(7), name: file.name, type: 'docx', text: result.value, mimeType: file.type };
      } else if (fileExt === 'xlsx' || fileExt === 'xls' || file.type.includes('excel') || file.type.includes('spreadsheetml')) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const data = e.target?.result;
              // @ts-ignore
              const XLSX = window.XLSX;
              const workbook = XLSX.read(data, { type: 'binary' });
              let excelText = `ISI FILE EXCEL (${file.name}):\n`;
              
              workbook.SheetNames.forEach((sheetName: string) => {
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                excelText += `\n--- Sheet: ${sheetName} ---\n`;
                excelText += JSON.stringify(json, null, 2);
              });
              
              resolve({
                id: Math.random().toString(36).substring(7),
                name: file.name,
                type: 'excel',
                text: excelText,
                mimeType: file.type
              });
            } catch (err) {
              console.error("Gagal baca excel:", err);
              resolve(null);
            }
          };
          reader.readAsBinaryString(file);
        });
      } else {
        const text = await file.text();
        return { id: Math.random().toString(36).substring(7), name: file.name, type: 'txt', text: text, mimeType: file.type || 'text/plain' };
      }
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const binaryStr = evt.target?.result;
        // @ts-ignore
        const XLSX = window.XLSX;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        const importedQuestions: EduCBTQuestion[] = data.map((row: any, index: number) => {
          const rawType = String(row['Tipe Soal'] || "").trim();
          let type = QuestionType.PilihanGanda;

          if (rawType.includes('Jamak') || rawType.includes('MCMA')) type = QuestionType.MCMA;
          else if (rawType.includes('Benar') || rawType.includes('B/S')) type = QuestionType.BenarSalah;
          else if (rawType.includes('Sesuai') || rawType.includes('S/TS')) type = QuestionType.SesuaiTidakSesuai;
          else if (rawType.includes('ISIAN')) type = QuestionType.Isian;
          else if (rawType.includes('URAIAN')) type = QuestionType.Uraian;

          const options = [row['Opsi A'], row['Opsi B'], row['Opsi C'], row['Opsi D'], row['Opsi E']]
            .map(opt => String(opt || "").trim()).filter(opt => opt !== "undefined" && opt !== "");

          const rawKunci = String(row['Kunci Jawa'] || "").trim();
          let correctAnswer: any = rawKunci;

          if (type === QuestionType.PilihanGanda) {
            correctAnswer = rawKunci.toUpperCase().charCodeAt(0) - 65;
            if (isNaN(correctAnswer) || correctAnswer < 0) correctAnswer = 0;
          } else if (type === QuestionType.MCMA) {
            correctAnswer = rawKunci.split(/[,\s;]+/).map(s => {
              const v = s.trim().toUpperCase();
              return !isNaN(Number(v)) ? Number(v)-1 : v.charCodeAt(0)-65;
            }).filter(v => v >= 0);
          } else if (type === QuestionType.BenarSalah) {
            correctAnswer = rawKunci.split(/[,\s;]+/).map(s => s.trim().toUpperCase().startsWith('B'));
          } else if (type === QuestionType.SesuaiTidakSesuai) {
            correctAnswer = rawKunci.split(/[,\s;]+/).map(s => s.trim().toUpperCase().startsWith('S'));
          }

          return {
            id: `excel_${Date.now()}_${index}`,
            type, level: row['Level'] || 'C1 Mengingat', subject: row['Mata Pelaj'] || formData.subject,
            phase: formData.phase, material: row['Materi'] || formData.material, text: row['Teks Soal'] || "",
            image: row['URL Gamb'] || "", explanation: row['Pembahasa'] || "", options, correctAnswer,
            order: parseInt(row['No']) || (index + 1), quizToken: (row['Token'] || formData.quizToken || "IMPORT").toUpperCase(),
            isDeleted: false, createdAt: Date.now(),
            tfLabels: type === QuestionType.BenarSalah ? { true: 'Benar', false: 'Salah' } : (type === QuestionType.SesuaiTidakSesuai ? { true: 'Sesuai', false: 'Tidak Sesuai' } : undefined)
          };
        });
        onImportJson(importedQuestions);
      } catch (err) { alert("Gagal membaca Excel."); }
    };
    reader.readAsBinaryString(file);
    e.target.value = ""; 
  };

  const handleSmartScan = async () => {
    if (attachedFiles.length === 0) {
      alert("Lampirkan foto atau dokumen soal terlebih dahulu.");
      return;
    }
    
    setIsScanning(true);
    try {
      const config: GenerationConfig = {
        ...formData,
        referenceImages: attachedFiles.filter(f => f.imageData).map(f => ({
          data: f.imageData as string,
          mimeType: f.mimeType
        })),
        referenceTexts: attachedFiles.filter(f => f.text).map(f => f.text as string)
      };
      const result = await extractQuestionsFromMedia(config);
      onImportJson(result);
      alert(`Berhasil memindai ${result.length} soal otomatis.`);
    } catch (err) {
      alert("Gagal memindai dokumen. Coba unggah gambar yang lebih jelas.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsExtracting(true);
    const newRefs: FileRef[] = [];
    for (let i = 0; i < files.length; i++) {
      const processed = await processFile(files[i]);
      if (processed) newRefs.push(processed);
    }
    setAttachedFiles(prev => [...prev, ...newRefs]);
    setIsExtracting(false);
    e.target.value = ""; 
  };

  const removeFile = (id: string) => setAttachedFiles(prev => prev.filter(f => f.id !== id));

  const totalTypes = (Object.values(formData.typeCounts) as number[]).reduce((a, b) => (a || 0) + (b || 0), 0);
  const totalLevels = (Object.values(formData.levelCounts) as number[]).reduce((a, b) => (a || 0) + (b || 0), 0);
  const isMismatch = totalTypes !== totalLevels;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onGenerate({ ...formData, referenceTexts: attachedFiles.filter(f => f.text).map(f => f.text as string), referenceImages: attachedFiles.filter(f => f.imageData).map(f => ({ data: f.imageData as string, mimeType: f.mimeType })) }); }} className="space-y-6">
      
      {/* Tombol Atas */}
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col items-center justify-center gap-1 py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-xl cursor-pointer border border-slate-200 transition-all text-center shadow-sm">
           <span className="text-[9px] font-black uppercase tracking-tight leading-none">Buka JSON</span>
           <input type="file" className="hidden" accept=".json" multiple onChange={(e) => {
             const files = Array.from(e.target.files || []) as File[];
             files.forEach((f) => {
               const r = new FileReader();
               r.onload = (ev) => { try { onImportJson(JSON.parse(ev.target?.result as string)); } catch (e) { alert("Invalid JSON"); } };
               r.readAsText(f);
             });
           }} />
        </label>
        <label className="flex flex-col items-center justify-center gap-1 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl cursor-pointer border border-emerald-100 transition-all text-center shadow-sm">
           <span className="text-[9px] font-black uppercase tracking-tight leading-none">Import Excel</span>
           <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
        </label>
        <button type="button" onClick={downloadExcelTemplate} className="flex flex-col items-center justify-center gap-1 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl border border-amber-100 text-center shadow-sm">
           <span className="text-[9px] font-black uppercase tracking-tight">Template Excel</span>
        </button>
      </div>

      {/* Metadata Paket */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Mata Pelajaran</label>
          <input required type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-indigo-500" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Fase</label>
          <select className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none focus:border-indigo-500" value={formData.phase} onChange={(e) => setFormData({ ...formData, phase: e.target.value })}>
            <option value="Fase A">Fase A</option><option value="Fase B">Fase B</option><option value="Fase C">Fase C</option><option value="Fase D">Fase D</option><option value="Fase E">Fase E</option><option value="Fase F">Fase F</option>
          </select>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Token Paket</label>
          <input required type="text" className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-900 outline-none uppercase focus:border-indigo-500" value={formData.quizToken} onChange={(e) => setFormData({ ...formData, quizToken: e.target.value.toUpperCase() })} />
        </div>
      </div>

      {/* Area Upload */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <label className="block text-[10px] font-black text-slate-500 uppercase">Dokumen Referensi (Mendukung Excel/Word/PDF/Foto)</label>
          {attachedFiles.length > 0 && (
            <button type="button" onClick={handleSmartScan} disabled={isScanning} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg disabled:bg-slate-300">
              {isScanning ? <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
              {isScanning ? 'Memindai...' : 'Pindai & Ekstrak (AI)'}
            </button>
          )}
        </div>
        <label className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isExtracting ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-200 hover:border-indigo-400 hover:bg-white'}`}>
           {isExtracting ? <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div><span className="text-xs font-bold text-indigo-600 uppercase">Mengekstrak...</span></div> : <>
             <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
             <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Pilih Dokumen / Foto / Excel</span>
             <span className="text-[9px] text-slate-400 mt-1 uppercase font-bold">PDF, DOCX, XLSX, JPG, PNG</span>
           </>}
           <input type="file" className="hidden" accept=".pdf, .docx, .txt, .jpg, .jpeg, .png, .xlsx, .xls" multiple onChange={handleFileReference} />
        </label>

        {attachedFiles.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {attachedFiles.map(file => (
              <div key={file.id} className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                {file.preview ? <img src={file.preview} className="w-10 h-10 rounded object-cover border border-slate-100" /> : (
                  <div className={`w-10 h-10 rounded flex items-center justify-center ${file.type === 'excel' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-500'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                )}
                <div className="flex-grow min-w-0"><p className="text-[11px] font-bold text-slate-700 truncate">{file.name}</p></div>
                <button type="button" onClick={() => removeFile(file.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Materi / Topik Soal</label>
        <textarea required rows={1} className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-indigo-500" value={formData.material} onChange={(e) => setFormData({ ...formData, material: e.target.value })} placeholder="Masukkan materi pembahasan..." />
      </div>

      {/* Manual Levels - Kembali ke format L1, L2, L3 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 shadow-sm">
          <label className="block text-[10px] font-black text-amber-700 uppercase mb-3 tracking-widest">Level Kognitif (Manual)</label>
          <div className="flex gap-2">
            {[
              { id: 'L1', sub: 'C1-C2' },
              { id: 'L2', sub: 'C3' },
              { id: 'L3', sub: 'C4-C6' }
            ].map(lvl => (
              <div key={lvl.id} className="flex-1 bg-white p-2 rounded-xl border border-amber-200 text-center shadow-sm">
                <span className="block text-[10px] font-black text-amber-600 leading-tight">{lvl.id}</span>
                <span className="block text-[8px] font-bold text-slate-400 uppercase mb-1">{lvl.sub}</span>
                <input type="number" min={0} className="w-full text-center font-black text-slate-900 outline-none bg-transparent text-base" value={formData.levelCounts[lvl.id] || 0} onChange={(e) => setFormData({...formData, levelCounts: {...formData.levelCounts, [lvl.id]: parseInt(e.target.value) || 0}})} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[8px] text-amber-600 font-bold uppercase text-center italic">* AI akan memetakan L1 ke C1/C2, L2 ke C3, dan L3 ke C4/C5/C6 otomatis.</p>
        </div>
        <div className="bg-yellow-50/50 p-4 rounded-xl border border-yellow-100 shadow-sm">
          <label className="block text-[10px] font-black text-yellow-700 uppercase mb-3 tracking-widest">Tipe Soal (Manual)</label>
          <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {Object.values(QuestionType).map(type => (
              <div key={type} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-yellow-200 shadow-sm">
                <span className="text-[10px] font-bold text-slate-600 uppercase leading-tight">{type}</span>
                <input type="number" min={0} className="w-10 text-center font-black text-slate-900 text-sm outline-none bg-transparent" value={formData.typeCounts[type]} onChange={(e) => setFormData({...formData, typeCounts: {...formData.typeCounts, [type]: parseInt(e.target.value) || 0}})} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {isMismatch && (
        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-center animate-pulse">
           <p className="text-[10px] font-bold text-rose-500 uppercase tracking-tighter">⚠️ Selisih: {Math.abs(totalTypes - totalLevels)} item (Jumlah Tipe & Level harus sama)</p>
        </div>
      )}

      <button disabled={isLoading || isScanning || isExtracting || (totalTypes === 0 && attachedFiles.length === 0) || (totalTypes > 0 && isMismatch)} type="submit" className="w-full py-4 px-6 rounded-2xl font-black text-base uppercase tracking-widest text-white shadow-xl shadow-indigo-100 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:bg-slate-300">
        {isLoading ? 'SEDANG MENYUSUN...' : '✨ GENERATE PAKET SOAL'}
      </button>
    </form>
  );
};

export default GenerationForm;
