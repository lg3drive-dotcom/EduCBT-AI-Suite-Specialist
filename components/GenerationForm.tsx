
import React, { useState, useRef } from 'react';
import { GenerationConfig, QuestionType, EduCBTQuestion } from '../types';
import { downloadExcelTemplate } from '../utils/exportUtils';

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
}

const GenerationForm: React.FC<Props> = ({ onGenerate, onImportJson, isLoading }) => {
  const [formData, setFormData] = useState<Omit<GenerationConfig, 'referenceTexts' | 'referenceImages'>>({
    subject: 'Matematika',
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
    levelCounts: { 'L1': 2, 'L2': 2, 'L3': 1 },
    quizToken: '',
    specialInstructions: ''
  });

  const [attachedFiles, setAttachedFiles] = useState<FileRef[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  const processFile = async (file: File): Promise<FileRef | null> => {
    try {
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
              imageData: base64
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
        return { id: Math.random().toString(36).substring(7), name: file.name, type: 'pdf', text: fullText };
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        // @ts-ignore
        const mammoth = window.mammoth;
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return { id: Math.random().toString(36).substring(7), name: file.name, type: 'docx', text: result.value };
      } else {
        const text = await file.text();
        return { id: Math.random().toString(36).substring(7), name: file.name, type: 'txt', text: text };
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

          // Fuzzy Detection Tipe Soal
          if (rawType.includes('Jamak') || rawType.includes('MCMA') || rawType.includes('Kompleks')) {
            type = QuestionType.MCMA;
          } else if (rawType.includes('Benar') || rawType.includes('B/S')) {
            type = QuestionType.BenarSalah;
          } else if (rawType.includes('Sesuai') || rawType.includes('S/TS')) {
            type = QuestionType.SesuaiTidakSesuai;
          } else if (rawType.includes('ISIAN')) {
            type = QuestionType.Isian;
          } else if (rawType.includes('URAIAN')) {
            type = QuestionType.Uraian;
          } else {
            type = QuestionType.PilihanGanda;
          }

          // Parsing Opsi A-E
          const options = [
            row['Opsi A'], row['Opsi B'], row['Opsi C'], row['Opsi D'], row['Opsi E']
          ].map(opt => String(opt || "").trim()).filter(opt => opt !== "undefined" && opt !== "");

          let correctAnswer: any = row['Kunci Jawa'] || "";

          // Logic Parsing Kunci Jawaban
          if (type === QuestionType.PilihanGanda) {
            const letter = String(correctAnswer).trim().toUpperCase();
            correctAnswer = letter.charCodeAt(0) - 65; 
            if (isNaN(correctAnswer) || correctAnswer < 0) correctAnswer = 0;
          } else if (type === QuestionType.MCMA) {
            // Split by comma, space, or semicolon
            correctAnswer = String(correctAnswer).split(/[,\s;]+/).map(s => {
              const val = s.trim().toUpperCase();
              if (!isNaN(Number(val))) return Number(val) - 1; // Jika angka
              return val.charCodeAt(0) - 65; // Jika huruf
            }).filter(v => !isNaN(v) && v >= 0);
          } else if (type === QuestionType.BenarSalah || type === QuestionType.SesuaiTidakSesuai) {
            const parts = String(correctAnswer).split(/[,\s;]+/);
            correctAnswer = parts.map(s => {
              const val = s.trim().toUpperCase();
              // Cek label B (Benar), S (Sesuai), True
              return val === 'B' || val === 'S' || val === 'TRUE' || val === 'SESUAI' || val === 'BENAR';
            });
            // Sinkronkan panjang array kunci dengan jumlah opsi
            if (correctAnswer.length < options.length) {
              const padding = new Array(options.length - correctAnswer.length).fill(false);
              correctAnswer = [...correctAnswer, ...padding];
            }
          }

          return {
            id: `excel_${Date.now()}_${index}`,
            type: type,
            level: row['Level'] || 'L1',
            subject: row['Mata Pelaj'] || formData.subject,
            phase: formData.phase,
            material: row['Materi'] || formData.material,
            text: row['Teks Soal'] || "",
            image: row['URL Gamb'] || "",
            explanation: row['Pembahasa'] || "",
            options: options,
            correctAnswer: correctAnswer,
            order: parseInt(row['No']) || (index + 1),
            quizToken: (row['Token'] || formData.quizToken || "IMPORT").toUpperCase(),
            isDeleted: false,
            createdAt: Date.now(),
            tfLabels: type === QuestionType.BenarSalah ? { true: 'Benar', false: 'Salah' } : (type === QuestionType.SesuaiTidakSesuai ? { true: 'Sesuai', false: 'Tidak Sesuai' } : undefined)
          };
        });

        onImportJson(importedQuestions);
        alert(`Berhasil mengimpor ${importedQuestions.length} soal.`);
      } catch (err) {
        console.error(err);
        alert("Gagal membaca file Excel. Periksa kembali format kolom.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ""; 
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

  const removeFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const texts = attachedFiles.filter(f => f.text).map(f => f.text as string);
    const images = attachedFiles.filter(f => f.imageData).map(f => ({
      data: f.imageData as string,
      mimeType: "image/png"
    }));

    onGenerate({
      ...formData,
      referenceTexts: texts,
      referenceImages: images
    });
  };

  const totalTypes = (Object.values(formData.typeCounts) as number[]).reduce((a, b) => (a || 0) + (b || 0), 0);
  const totalLevels = (Object.values(formData.levelCounts) as number[]).reduce((a, b) => (a || 0) + (b || 0), 0);
  const isMismatch = totalTypes !== totalLevels;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col items-center justify-center gap-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer border border-slate-200 transition-all text-center">
           <span className="text-[9px] font-black uppercase tracking-tight leading-none">Buka JSON</span>
           <input type="file" className="hidden" accept=".json" multiple onChange={(e) => {
             const files = Array.from(e.target.files || []) as File[];
             files.forEach((f) => {
               const r = new FileReader();
               r.onload = (ev) => {
                 try {
                   const parsed = JSON.parse(ev.target?.result as string);
                   onImportJson(Array.isArray(parsed) ? parsed : [parsed]);
                 } catch (e) { alert("Format JSON tidak valid."); }
               };
               r.readAsText(f);
             });
           }} />
        </label>
        <label className="flex flex-col items-center justify-center gap-1 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl cursor-pointer border border-emerald-200 transition-all text-center">
           <span className="text-[9px] font-black uppercase tracking-tight leading-none">Import Excel</span>
           <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
        </label>
        <button type="button" onClick={downloadExcelTemplate} className="flex flex-col items-center justify-center gap-1 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl border border-amber-200 text-center">
           <span className="text-[9px] font-black uppercase tracking-tight">Template Excel</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
          <label className="block text-[10px] font-black text-blue-700 uppercase mb-2">Mata Pelajaran</label>
          <input required type="text" className="w-full px-4 py-2 rounded-lg border border-blue-200 bg-white text-sm font-bold outline-none" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
        </div>
        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
          <label className="block text-[10px] font-black text-blue-700 uppercase mb-2">Fase</label>
          <select className="w-full px-4 py-2 rounded-lg border border-blue-200 bg-white text-sm font-bold outline-none" value={formData.phase} onChange={(e) => setFormData({ ...formData, phase: e.target.value })}>
            <option value="Fase A">Fase A</option>
            <option value="Fase B">Fase B</option>
            <option value="Fase C">Fase C</option>
            <option value="Fase D">Fase D</option>
            <option value="Fase E">Fase E</option>
            <option value="Fase F">Fase F</option>
          </select>
        </div>
        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
          <label className="block text-[10px] font-black text-blue-700 uppercase mb-2">Token Paket</label>
          <input required type="text" className="w-full px-4 py-2 rounded-lg border border-blue-200 bg-white text-sm font-bold outline-none uppercase" value={formData.quizToken} onChange={(e) => setFormData({ ...formData, quizToken: e.target.value.toUpperCase() })} />
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Dokumen/Gambar Referensi (Multi-File)</label>
        <label className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isExtracting ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200 hover:border-indigo-400'}`}>
           {isExtracting ? (
             <div className="flex items-center gap-2">
               <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
               <span className="text-xs font-bold text-indigo-600 uppercase">Mengekstrak...</span>
             </div>
           ) : (
             <>
               <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
               <span className="text-xs font-bold text-slate-600 text-center uppercase tracking-wide">Klik/Tarik file ke sini</span>
               <span className="text-[9px] text-slate-400 mt-1 uppercase text-center">Bisa pilih banyak PDF, DOCX, JPG, PNG</span>
             </>
           )}
           <input type="file" className="hidden" accept=".pdf, .docx, .txt, .jpg, .jpeg, .png, .webp" multiple onChange={handleFileReference} />
        </label>

        {attachedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Terlampir ({attachedFiles.length}):</p>
            <div className="grid grid-cols-1 gap-2">
              {attachedFiles.map(file => (
                <div key={file.id} className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                  {file.preview ? (
                    <img src={file.preview} className="w-10 h-10 rounded object-cover border" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-indigo-50 flex items-center justify-center text-indigo-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                  )}
                  <div className="flex-grow min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 truncate">{file.name}</p>
                    <p className="text-[9px] text-slate-400 uppercase font-black">{file.type}</p>
                  </div>
                  <button type="button" onClick={() => removeFile(file.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
        <label className="block text-[10px] font-black text-emerald-800 uppercase mb-2">Materi Utama / CP</label>
        <textarea required rows={2} className="w-full px-4 py-2 rounded-lg border border-emerald-200 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-400" value={formData.material} onChange={(e) => setFormData({ ...formData, material: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
          <label className="block text-[10px] font-black text-amber-800 uppercase mb-3 tracking-widest">Level Kognitif</label>
          <div className="flex gap-2">
            {['L1', 'L2', 'L3'].map(lvl => (
              <div key={lvl} className="flex-1 bg-white p-2 rounded-xl border border-amber-200 text-center shadow-sm">
                <span className="block text-[10px] font-black text-amber-600 mb-1">{lvl}</span>
                <input type="number" min={0} className="w-full bg-transparent text-center font-black text-base outline-none text-slate-700" value={formData.levelCounts[lvl]} onChange={(e) => setFormData({...formData, levelCounts: {...formData.levelCounts, [lvl]: parseInt(e.target.value) || 0}})} />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-yellow-50/50 p-4 rounded-xl border border-yellow-100">
          <div className="flex justify-between items-center mb-3">
            <label className="block text-[10px] font-black text-yellow-800 uppercase tracking-widest">Tipe Soal</label>
            <span className="text-[10px] font-black bg-yellow-200 text-yellow-900 px-2 py-0.5 rounded-full">Total: {totalTypes}</span>
          </div>
          <div className="space-y-2 max-h-[140px] overflow-y-auto pr-2">
            {Object.values(QuestionType).map(type => (
              <div key={type} className="flex items-center justify-between gap-3 bg-white px-3 py-2 rounded-xl border border-yellow-200 shadow-sm">
                <span className="text-[10px] font-bold text-slate-600 uppercase leading-tight flex-grow">{type}</span>
                <input type="number" min={0} className="w-12 bg-yellow-50 text-center font-black text-sm outline-none rounded-lg py-0.5 text-yellow-800" value={formData.typeCounts[type]} onChange={(e) => setFormData({...formData, typeCounts: {...formData.typeCounts, [type]: parseInt(e.target.value) || 0}})} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {isMismatch && (
        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-center">
           <p className="text-[10px] font-bold text-rose-500">Selisih: {Math.abs(totalTypes - totalLevels)} item (Tipe & Level harus sama)</p>
        </div>
      )}

      <button disabled={isLoading || totalTypes === 0 || isMismatch} type="submit" className="w-full py-4 px-6 rounded-2xl font-black text-base uppercase tracking-widest text-white shadow-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 transition-all">
        {isLoading ? 'MENYUSUN...' : '✨ GENERATE DARI REFERENSI'}
      </button>
    </form>
  );
};

export default GenerationForm;
