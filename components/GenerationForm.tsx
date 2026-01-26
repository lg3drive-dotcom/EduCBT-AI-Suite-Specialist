
import React, { useState } from 'react';
import { GenerationConfig, QuestionType, EduCBTQuestion } from '../types';
import { downloadExcelTemplate } from '../utils/exportUtils';

interface Props {
  onGenerate: (config: GenerationConfig) => void;
  onImportJson: (questions: EduCBTQuestion[]) => void;
  isLoading: boolean;
}

const GenerationForm: React.FC<Props> = ({ onGenerate, onImportJson, isLoading }) => {
  const [formData, setFormData] = useState<GenerationConfig>({
    subject: 'Bahasa Indonesia',
    phase: 'Fase C',
    material: '',
    typeCounts: {
      [QuestionType.PilihanGanda]: 5,
      [QuestionType.MCMA]: 0,
      [QuestionType.Kompleks]: 0,
      [QuestionType.KompleksBS]: 0,
      [QuestionType.Isian]: 0,
      [QuestionType.Uraian]: 0,
    },
    levelCounts: {
      'L1': 2,
      'L2': 2,
      'L3': 1,
    },
    quizToken: '',
    referenceText: '',
    specialInstructions: ''
  });

  const [fileName, setFileName] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const phaseDescriptions: Record<string, string> = {
    'Fase A': '(Kelas 1-2 SD)',
    'Fase B': '(Kelas 3-4 SD)',
    'Fase C': '(Kelas 5-6 SD)',
    'Fase D': '(Kelas 7-9 SMP)',
    'Fase E': '(Kelas 10 SMA)',
    'Fase F': '(Kelas 11-12 SMA)',
  };

  const parseExcelQuestions = (data: any[]): EduCBTQuestion[] => {
    return data.map((row, i) => {
      const tipe = (row["Tipe Soal"] || row["Tipe"] || row["tipe"] || "Pilihan Ganda").toString();
      const level = (row["Level"] || row["level"] || "L1").toString();
      const teks = (row["Teks Soal"] || row["Soal"] || row["soal"] || "").toString();
      const material = (row["Materi"] || row["materi"] || "").toString();
      const explanation = (row["Pembahasan"] || row["penjelasan"] || "").toString();
      const token = (row["Token Paket"] || row["Token"] || row["token"] || "").toString();
      
      // Link Gambar Soal
      const mainImage = (row["Gambar Soal (URL)"] || row["Gambar Soal"] || "").toString();

      const options = [
        row["Opsi A"], row["Opsi B"], row["Opsi C"], row["Opsi D"], row["Opsi E"]
      ].filter(o => o !== undefined && o !== null && o !== "").map(o => o.toString());

      // Link Gambar Opsi
      const optionImages = [
        row["Gambar Opsi A (URL)"] || row["Gambar Opsi A"] || null,
        row["Gambar Opsi B (URL)"] || row["Gambar Opsi B"] || null,
        row["Gambar Opsi C (URL)"] || row["Gambar Opsi C"] || null,
        row["Gambar Opsi D (URL)"] || row["Gambar Opsi D"] || null,
        row["Gambar Opsi E (URL)"] || row["Gambar Opsi E"] || null,
      ].map(o => o ? o.toString() : null);

      let kunci = (row["Kunci Jawaban"] || row["Kunci"] || row["kunci"] || "").toString();
      let correctAnswer: any = 0;

      // Normalisasi Kunci Jawaban
      if (tipe === QuestionType.PilihanGanda) {
        correctAnswer = (kunci.toUpperCase().charCodeAt(0) - 65); // A=0, B=1, dst
        if (isNaN(correctAnswer) || correctAnswer < 0) correctAnswer = 0;
      } else if (tipe === QuestionType.MCMA) {
        correctAnswer = kunci.split(/[,;|]/).map(k => k.trim().toUpperCase().charCodeAt(0) - 65).filter(n => !isNaN(n) && n >= 0);
      } else if (tipe === QuestionType.KompleksBS) {
        correctAnswer = kunci.split(/[,;|]/).map(k => {
          const val = k.trim().toUpperCase();
          return val === 'B' || val === 'TRUE' || val === 'BENAR' || val === 'S' ? (val !== 'S') : false;
        });
      } else {
        correctAnswer = kunci;
      }

      return {
        id: `xl_${Date.now()}_${i}`,
        type: tipe,
        level: level,
        subject: formData.subject,
        phase: formData.phase,
        material: material,
        text: teks,
        explanation: explanation,
        options: options,
        optionImages: optionImages,
        image: mainImage || undefined,
        correctAnswer: correctAnswer,
        isDeleted: false,
        createdAt: Date.now(),
        order: parseInt(row["No"]) || (i + 1),
        quizToken: token || formData.quizToken,
        tfLabels: tipe === QuestionType.KompleksBS ? { true: 'Benar', false: 'Salah' } : undefined
      };
    });
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        // @ts-ignore
        const bstr = evt.target.result;
        // @ts-ignore
        const wb = window.XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // @ts-ignore
        const data = window.XLSX.utils.sheet_to_json(ws);
        
        const imported = parseExcelQuestions(data);
        if (imported.length > 0) {
          onImportJson(imported);
          alert(`${imported.length} soal dari Excel berhasil diimport.`);
        }
      } catch (err) {
        console.error(err);
        alert("Gagal membaca file Excel. Pastikan format kolom sesuai template.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let allQuestions: EduCBTQuestion[] = [];
    const filePromises = Array.from(files).map((file: File) => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const json = JSON.parse(event.target?.result as string);
            if (Array.isArray(json)) {
              allQuestions = [...allQuestions, ...json];
            } else if (json && typeof json === 'object') {
              allQuestions.push(json as EduCBTQuestion);
            }
          } catch (err) {
            console.error(`Gagal membaca file: ${file.name}`);
          }
          resolve();
        };
        reader.readAsText(file);
      });
    });

    await Promise.all(filePromises);
    if (allQuestions.length > 0) {
      onImportJson(allQuestions);
      alert(`${allQuestions.length} soal berhasil digabungkan.`);
    }
    e.target.value = '';
  };

  const extractPdfText = async (data: ArrayBuffer): Promise<string> => {
    // @ts-ignore
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const strings = content.items.map((item: any) => item.str);
      fullText += strings.join(' ') + '\n';
    }
    return fullText;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsExtracting(true);

    try {
      const reader = new FileReader();
      
      if (file.type === 'application/pdf') {
        reader.onload = async (event) => {
          const text = await extractPdfText(event.target?.result as ArrayBuffer);
          setFormData(prev => ({ ...prev, referenceText: text }));
          setIsExtracting(false);
        };
        reader.readAsArrayBuffer(file);
      } 
      else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        reader.onload = async (event) => {
          // @ts-ignore
          const result = await window.mammoth.extractRawText({ arrayBuffer: event.target?.result });
          setFormData(prev => ({ ...prev, referenceText: result.value }));
          setIsExtracting(false);
        };
        reader.readAsArrayBuffer(file);
      }
      else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'application/vnd.ms-excel') {
        reader.onload = (event) => {
          // @ts-ignore
          const workbook = window.XLSX.read(event.target?.result, { type: 'array' });
          let sheetText = '';
          workbook.SheetNames.forEach((name: string) => {
            // @ts-ignore
            const csv = window.XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
            sheetText += `--- Sheet: ${name} ---\n${csv}\n`;
          });
          setFormData(prev => ({ ...prev, referenceText: sheetText }));
          setIsExtracting(false);
        };
        reader.readAsArrayBuffer(file);
      }
      else {
        alert("Format file tidak didukung. Harap gunakan PDF, Word (.docx), atau Excel (.xlsx)");
        setIsExtracting(false);
      }
    } catch (err) {
      console.error(err);
      alert("Gagal membaca file.");
      setIsExtracting(false);
    }
  };

  const totalTypes = (Object.values(formData.typeCounts) as number[]).reduce((a, b) => a + b, 0);
  const totalLevels = (Object.values(formData.levelCounts) as number[]).reduce((a, b) => a + b, 0);
  const isSync = totalTypes === totalLevels;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalTypes === 0) {
      alert("Pilih setidaknya 1 jumlah soal untuk salah satu tipe.");
      return;
    }
    if (!isSync) {
      alert(`Total tipe soal (${totalTypes}) harus sama dengan total level kognitif (${totalLevels}).`);
      return;
    }
    onGenerate(formData);
  };

  const updateTypeCount = (type: string, value: string) => {
    const count = parseInt(value) || 0;
    setFormData({
      ...formData,
      typeCounts: {
        ...formData.typeCounts,
        [type]: count
      }
    });
  };

  const updateLevelCount = (level: string, value: string) => {
    const count = parseInt(value) || 0;
    setFormData({
      ...formData,
      levelCounts: {
        ...formData.levelCounts,
        [level]: count
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border-2 border-blue-100 shadow-xl space-y-6">
      <div className="space-y-2">
        <div className="flex gap-2">
          <label className="flex-1 flex items-center justify-center gap-2 py-3 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer transition-all border border-slate-200">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9l-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
             <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase tracking-widest leading-none">Buka JSON</span>
             </div>
             <input type="file" className="hidden" accept=".json" multiple onChange={handleJsonUpload} />
          </label>
          <label className="flex-1 flex items-center justify-center gap-2 py-3 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl cursor-pointer transition-all border border-emerald-200">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
             <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase tracking-widest leading-none">Import Excel</span>
             </div>
             <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleExcelImport} />
          </label>
        </div>
        <button 
          type="button"
          onClick={downloadExcelTemplate}
          className="w-full flex items-center justify-center gap-2 py-2 text-[9px] font-black uppercase text-indigo-500 hover:text-indigo-700 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
          Unduh Template Excel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200">
          <label className="block text-xs font-black text-blue-700 uppercase tracking-wider mb-2">Mata Pelajaran</label>
          <input
            required
            type="text"
            className="w-full px-4 py-3 rounded-lg border-2 border-blue-300 bg-white text-blue-900 font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
            placeholder="Ketik Mapel..."
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          />
        </div>
        <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200">
          <label className="block text-xs font-black text-blue-700 uppercase tracking-wider mb-2">Fase Kurikulum</label>
          <select
            className="w-full px-4 py-3 rounded-lg border-2 border-blue-300 bg-white text-blue-900 font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
            value={formData.phase}
            onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
          >
            {Object.keys(phaseDescriptions).map(f => (
              <option key={f} value={f}>{f} {phaseDescriptions[f]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-cyan-50 p-4 rounded-xl border-2 border-cyan-200 relative">
          <label className="block text-xs font-black text-cyan-800 uppercase tracking-wider mb-2">Unggah Referensi (PDF/DOC/XLS)</label>
          <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-cyan-300 rounded-lg bg-white cursor-pointer hover:bg-cyan-50 transition-all">
            <div className="flex flex-col items-center justify-center pt-2 pb-3">
              <svg className="w-8 h-8 mb-1 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-[10px] text-cyan-600 font-bold">{fileName || "Pilih File Referensi"}</p>
            </div>
            <input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.xls" onChange={handleFileUpload} />
          </label>
          {isExtracting && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-xl">
               <span className="text-[10px] font-black text-cyan-700 animate-pulse">MEMBACA DOKUMEN...</span>
            </div>
          )}
        </div>

        <div className="bg-amber-50 p-4 rounded-xl border-2 border-amber-200">
          <label className="block text-xs font-black text-amber-800 uppercase tracking-wider mb-2">Instruksi Khusus (Opsional)</label>
          <textarea
            rows={3}
            className="w-full px-4 py-3 rounded-lg border-2 border-amber-300 bg-white text-amber-900 font-medium focus:ring-4 focus:ring-amber-100 focus:border-amber-500 outline-none transition-all text-sm"
            placeholder="Misal: Gunakan konteks kearifan lokal..."
            value={formData.specialInstructions}
            onChange={(e) => setFormData({ ...formData, specialInstructions: e.target.value })}
          />
        </div>
      </div>

      <div className="bg-emerald-50 p-4 rounded-xl border-2 border-emerald-200">
        <label className="block text-xs font-black text-emerald-800 uppercase tracking-wider mb-2">Materi / Indikator CP</label>
        <textarea
          required
          rows={2}
          className="w-full px-4 py-3 rounded-lg border-2 border-emerald-300 bg-white text-emerald-900 font-medium focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all text-sm"
          placeholder="Tulis topik atau tujuan pembelajaran soal..."
          value={formData.material}
          onChange={(e) => setFormData({ ...formData, material: e.target.value })}
        />
      </div>

      <div className="space-y-6">
        <div className="bg-yellow-50 p-4 rounded-xl border-2 border-yellow-200 space-y-4">
          <div className="flex justify-between items-end border-b-2 border-yellow-200 pb-2">
            <label className="text-sm font-black text-yellow-900 uppercase tracking-widest">Tipe Soal</label>
            <span className="bg-yellow-200 px-3 py-1 rounded-full text-xs font-black text-yellow-900">TOTAL: {totalTypes}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.values(QuestionType).map(type => (
              <div key={type} className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border-2 border-yellow-100 shadow-sm hover:border-yellow-400 transition-colors">
                <span className="text-[10px] font-black text-yellow-800 uppercase leading-tight flex-1">
                  {type}
                </span>
                <input
                  type="number"
                  min={0}
                  className="w-14 shrink-0 px-2 py-2 rounded-lg border-2 border-yellow-200 bg-yellow-50 text-center text-sm font-black text-yellow-900 focus:ring-2 focus:ring-yellow-500 outline-none"
                  value={formData.typeCounts[type]}
                  onChange={(e) => updateTypeCount(type, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-pink-50 p-4 rounded-xl border-2 border-pink-200 space-y-4">
          <div className="flex justify-between items-end border-b-2 border-pink-200 pb-2">
            <label className="text-sm font-black text-pink-900 uppercase tracking-widest">Level Kognitif</label>
            <span className={`px-3 py-1 rounded-full text-xs font-black shadow-sm ${isSync ? 'bg-pink-200 text-pink-900' : 'bg-red-500 text-white animate-bounce'}`}>
              TOTAL: {totalLevels} {isSync ? '' : `(!)`}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {['L1', 'L2', 'L3'].map(level => (
              <div key={level} className="flex flex-col gap-2 bg-white p-3 rounded-xl border-2 border-pink-100 shadow-sm hover:border-pink-400 transition-colors">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-black text-pink-600">{level}</span>
                  <input
                    type="number"
                    min={0}
                    className="w-14 px-2 py-2 rounded-lg border-2 border-pink-200 bg-pink-50 text-center text-sm font-black text-pink-900 focus:ring-2 focus:ring-pink-500 outline-none"
                    value={formData.levelCounts[level]}
                    onChange={(e) => updateLevelCount(level, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border-2 border-indigo-200 shadow-sm">
        <label className="block text-xs font-black text-indigo-900 uppercase tracking-wider mb-2">Quiz Token (ID Paket)</label>
        <input
          type="text"
          className="w-full px-4 py-3 rounded-lg border-2 border-indigo-100 bg-indigo-50/30 text-indigo-900 font-bold focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all placeholder:text-indigo-300 font-mono"
          placeholder="CONTOH: BIND-C-01"
          value={formData.quizToken}
          onChange={(e) => setFormData({ ...formData, quizToken: e.target.value })}
        />
      </div>

      <button
        disabled={isLoading || !isSync || isExtracting}
        type="submit"
        className={`w-full py-5 px-6 rounded-2xl font-black text-base uppercase tracking-widest text-white shadow-2xl transition-all active:scale-95 ${
          isLoading || !isSync || isExtracting
            ? 'bg-slate-300 cursor-not-allowed border-b-0 opacity-80' 
            : 'bg-indigo-600 hover:bg-indigo-700 border-b-4 border-indigo-900 shadow-indigo-200'
        }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-3">
            <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            PROSES GENERATE...
          </span>
        ) : isExtracting ? 'MEMBACA FILE...' : 'PROSES SEKARANG'}
      </button>
    </form>
  );
};

export default GenerationForm;
