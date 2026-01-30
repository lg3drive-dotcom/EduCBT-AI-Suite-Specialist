
import React, { useState, useRef } from 'react';
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
      [QuestionType.BenarSalah]: 0,
      [QuestionType.SesuaiTidakSesuai]: 0,
      [QuestionType.Isian]: 0,
      [QuestionType.Uraian]: 0,
    },
    levelCounts: { 'L1': 2, 'L2': 2, 'L3': 1 },
    quizToken: '',
    referenceText: '',
    specialInstructions: ''
  });

  const [refFileName, setRefFileName] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRefFileName(file.name);
    setIsExtracting(true);

    try {
      let text = "";
      if (file.type === "application/pdf") {
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
        text = fullText;
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        // @ts-ignore
        const mammoth = window.mammoth;
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        text = await file.text();
      }
      
      setFormData(prev => ({ ...prev, referenceText: text }));
      alert("Teks berhasil diekstrak dari dokumen.");
    } catch (err) {
      console.error(err);
      alert("Gagal membaca dokumen.");
    } finally {
      setIsExtracting(false);
    }
  };

  const mapExcelType = (raw: string): QuestionType => {
    const s = raw.toString().toLowerCase().trim();
    if (s.includes('b/s') || s.includes('bs') || s.includes('benar') || s.includes('salah')) return QuestionType.BenarSalah;
    if (s.includes('sesuai') || s.includes('tidak sesuai')) return QuestionType.SesuaiTidakSesuai;
    if (s.includes('jamak') || s.includes('mcma')) return QuestionType.MCMA;
    if (s.includes('isian')) return QuestionType.Isian;
    if (s.includes('uraian')) return QuestionType.Uraian;
    return QuestionType.PilihanGanda;
  };

  const parseExcelQuestions = (data: any[]): EduCBTQuestion[] => {
    return data.map((row, i) => {
      const tipeRaw = row["Tipe Soal"] || row["tipe"] || "";
      const teks = (row["Teks Soal"] || row["soal"] || "").toString();
      const options = [row["Opsi A"], row["Opsi B"], row["Opsi C"], row["Opsi D"], row["Opsi E"]].filter(o => o).map(o => o.toString());
      let kunci = (row["Kunci Jawaban"] || "").toString();
      let tipe = mapExcelType(tipeRaw);
      let correctAnswer: any;

      if (tipe === QuestionType.PilihanGanda) {
        correctAnswer = (kunci.toUpperCase().trim().charCodeAt(0) - 65);
      } else if (tipe === QuestionType.MCMA) {
        correctAnswer = kunci.split(/[,;|]/).map(k => k.trim().toUpperCase().charCodeAt(0) - 65).filter(n => n >= 0);
      } else if (tipe === QuestionType.BenarSalah || tipe === QuestionType.SesuaiTidakSesuai) {
        correctAnswer = kunci.split(/[,;|]/).map(k => {
          const val = k.trim().toUpperCase();
          return (val === 'B' || val === 'TRUE' || val === 'S' || val === 'BENAR' || val === 'SESUAI');
        });
        if (correctAnswer.length < options.length) {
          correctAnswer = [...correctAnswer, ...new Array(options.length - correctAnswer.length).fill(false)];
        }
      } else {
        correctAnswer = kunci;
      }

      return {
        id: `xl_${Date.now()}_${i}`,
        type: tipe,
        level: (row["Level"] || "L1").toString(),
        subject: formData.subject,
        phase: formData.phase,
        material: (row["Materi"] || "Materi Belum Terisi").toString(),
        text: teks,
        explanation: (row["Pembahasan"] || "").toString(),
        options,
        correctAnswer,
        isDeleted: false,
        createdAt: Date.now(),
        order: parseInt(row["No"]) || (i + 1),
        quizToken: (row["Token Paket"] || formData.quizToken).toString(),
        tfLabels: tipe === QuestionType.BenarSalah ? { true: 'Benar', false: 'Salah' } : (tipe === QuestionType.SesuaiTidakSesuai ? { true: 'Sesuai', false: 'Tidak Sesuai' } : undefined)
      };
    });
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      // @ts-ignore
      const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
      // @ts-ignore
      const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      onImportJson(parseExcelQuestions(data));
      alert("Import Excel berhasil.");
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const totalTypes = (Object.values(formData.typeCounts) as number[]).reduce((a, b) => a + b, 0);
  const totalLevels = (Object.values(formData.levelCounts) as number[]).reduce((a, b) => a + b, 0);
  const isMismatch = totalTypes !== totalLevels;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onGenerate(formData); }} className="space-y-6">
      <div className="flex gap-2">
        <label className="flex-1 flex items-center justify-center gap-2 py-3 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer border border-slate-200 transition-all">
           <span className="text-[10px] font-black uppercase tracking-widest leading-none">Buka JSON</span>
           <input type="file" className="hidden" accept=".json" multiple onChange={(e) => {
             const files = Array.from(e.target.files || []) as File[];
             files.forEach((f) => {
               const r = new FileReader();
               r.onload = (ev) => onImportJson(JSON.parse(ev.target?.result as string));
               r.readAsText(f);
             });
           }} />
        </label>
        <label className="flex-1 flex items-center justify-center gap-2 py-3 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl cursor-pointer border border-emerald-200 transition-all">
           <span className="text-[10px] font-black uppercase tracking-widest leading-none">Import Excel</span>
           <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
        </label>
        <button type="button" onClick={downloadExcelTemplate} className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl hover:text-indigo-600 hover:border-indigo-200 transition-all" title="Unduh Template Excel">
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 8m4-4v12" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
          <label className="block text-[10px] font-black text-blue-700 uppercase mb-2">Mata Pelajaran</label>
          <input required type="text" className="w-full px-4 py-2 rounded-lg border border-blue-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
        </div>
        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
          <label className="block text-[10px] font-black text-blue-700 uppercase mb-2">Fase</label>
          <select className="w-full px-4 py-2 rounded-lg border border-blue-200 bg-white text-sm font-bold outline-none" value={formData.phase} onChange={(e) => setFormData({ ...formData, phase: e.target.value })}>
            <option value="Fase A">Fase A (Kelas 1-2)</option>
            <option value="Fase B">Fase B (Kelas 3-4)</option>
            <option value="Fase C">Fase C (Kelas 5-6)</option>
            <option value="Fase D">Fase D (SMP)</option>
            <option value="Fase E">Fase E (SMA 10)</option>
            <option value="Fase F">Fase F (SMA 11-12)</option>
          </select>
        </div>
        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
          <label className="block text-[10px] font-black text-blue-700 uppercase mb-2">Token Paket</label>
          <input required type="text" placeholder="Contoh: PAS-01" className="w-full px-4 py-2 rounded-lg border border-blue-200 bg-white text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400 uppercase" value={formData.quizToken} onChange={(e) => setFormData({ ...formData, quizToken: e.target.value.toUpperCase() })} />
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-[10px] font-black text-slate-500 uppercase">Dokumen Referensi (Optional)</label>
          {refFileName && <button type="button" onClick={() => { setRefFileName(null); setFormData(p => ({...p, referenceText: ''})); }} className="text-[9px] font-bold text-rose-500">Hapus</button>}
        </div>
        <label className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isExtracting ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-slate-200 hover:border-indigo-400'}`}>
           {isExtracting ? (
             <div className="flex items-center gap-2">
               <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
               <span className="text-xs font-bold text-indigo-600">Mengekstrak Teks...</span>
             </div>
           ) : (
             <>
               <span className="text-xs font-bold text-slate-600">{refFileName || "Upload PDF/Docx/Text"}</span>
               <span className="text-[9px] text-slate-400 mt-1 uppercase">AI akan membuat soal berdasarkan isi dokumen ini</span>
             </>
           )}
           <input type="file" className="hidden" accept=".pdf, .docx, .txt" onChange={handleFileReference} />
        </label>
      </div>

      <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
        <label className="block text-[10px] font-black text-emerald-800 uppercase mb-2">Materi / Indikator CP</label>
        <textarea required rows={2} className="w-full px-4 py-2 rounded-lg border border-emerald-200 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-400" value={formData.material} onChange={(e) => setFormData({ ...formData, material: e.target.value })} />
      </div>

      <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100">
        <div className="flex justify-between items-center mb-3">
          <label className="block text-[10px] font-black text-amber-800 uppercase">Level Kognitif</label>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isMismatch ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
            Total: {totalLevels}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['L1', 'L2', 'L3'].map(lvl => (
            <div key={lvl} className="bg-white p-2 rounded-lg border border-amber-200 text-center">
              <span className="block text-[9px] font-black text-amber-600 mb-1">{lvl}</span>
              <input type="number" min={0} className="w-full bg-transparent text-center font-black text-sm outline-none" value={formData.levelCounts[lvl]} onChange={(e) => setFormData({...formData, levelCounts: {...formData.levelCounts, [lvl]: parseInt(e.target.value) || 0}})} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-yellow-50/50 p-4 rounded-xl border border-yellow-100">
        <div className="flex justify-between items-center mb-3">
          <label className="block text-[10px] font-black text-yellow-800 uppercase">Tipe Soal</label>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${isMismatch ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
            Total: {totalTypes}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(QuestionType).map(type => (
            <div key={type} className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-yellow-200">
              <span className="text-[9px] font-black text-yellow-800 uppercase flex-1 truncate">{type}</span>
              <input type="number" min={0} className="w-10 bg-transparent text-center font-black text-xs outline-none" value={formData.typeCounts[type]} onChange={(e) => setFormData({...formData, typeCounts: {...formData.typeCounts, [type]: parseInt(e.target.value) || 0}})} />
            </div>
          ))}
        </div>
      </div>

      {isMismatch && (
        <p className="text-[10px] font-bold text-rose-500 text-center animate-pulse">
          ⚠ Total Tipe ({totalTypes}) dan Total Level ({totalLevels}) harus sama!
        </p>
      )}

      <button disabled={isLoading || totalTypes === 0 || isMismatch} type="submit" className="w-full py-4 px-6 rounded-2xl font-black text-base uppercase tracking-widest text-white shadow-xl bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-95 disabled:bg-slate-300 disabled:shadow-none">
        {isLoading ? 'MEMPROSES...' : 'GENERATE SOAL AI'}
      </button>
    </form>
  );
};

export default GenerationForm;
