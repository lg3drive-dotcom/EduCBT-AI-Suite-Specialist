
import { GoogleGenAI, Type } from "@google/genai";
import { EduCBTQuestion, GenerationConfig, QuestionType } from "./types";

// Fungsi untuk memastikan HTML tidak ter-escape (mengubah &lt; kembali jadi <)
const unescapeHtml = (html: string) => {
  const doc = new HTMLElement(); // Dummy element for decoding if needed, but simple replace usually works
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
};

const SYSTEM_INSTRUCTION = `
Persona: Pakar Kurikulum Nasional (Bloom/HOTS) & Pengembang EduCBT Pro.
Tugas: Membuat soal evaluasi berkualitas tinggi dalam format JSON array yang VALID, VARIATIF, dan KONSISTEN.

### ATURAN FORMAT HTML (PENTING) ###
- Gunakan tag HTML RAW (<b>, <i>, <br>, <ul>, <div style="...">) untuk mempercantik soal. 
- JANGAN meng-escape tag HTML (Gunakan < dan > secara langsung).
- Berikan styling CSS inline pada tag <div> jika diperlukan untuk teks stimulus/bacaan.

### LOGIKA KUNCI JAWABAN (WAJIB SINKRON) ###
Setiap soal harus melalui proses "Thinking Step" internal:
1. Tentukan jawaban yang benar berdasarkan materi.
2. Tulis Pembahasan (explanation) yang menjelaskan MENGAPA jawaban tersebut benar.
3. Petakan jawaban tersebut ke field 'correctAnswer' dengan presisi:
   - Pilihan Ganda: Integer (0 untuk A, 1 untuk B, dst).
   - MCMA: Array of Integer [0, 2] jika A dan C benar. HARUS SAMA dengan isi pembahasan.
   - (Benar/Salah) atau (Sesuai/Tidak Sesuai): Array of Boolean [true, false, true]. Panjang array HARUS PERSIS sama dengan jumlah baris di 'options'.

### LARANGAN KERAS ###
- DILARANG memberikan kunci jawaban [0] atau [true, true, true] secara asal.
- Setiap baris pada soal tabel (Benar/Salah) HARUS dicek kebenarannya satu per satu.
`;

const VALID_LEVELS = [
  "C1 Mengingat", "C2 Memahami", "C3 Menerapkan", 
  "C4 Menganalisis", "C5 Mengevaluasi", "C6 Mencipta"
];

const QUESTIONS_ARRAY_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      type: { type: Type.STRING },
      level: { type: Type.STRING },
      text: { type: Type.STRING },
      explanation: { type: Type.STRING },
      material: { type: Type.STRING },
      quizToken: { type: Type.STRING },
      order: { type: Type.INTEGER },
      options: { type: Type.ARRAY, items: { type: Type.STRING } },
      correctAnswer: { type: Type.STRING, description: "Indeks jawaban (0-4), array indeks [0,1], atau array boolean [true,false]." },
      tfLabels: {
        type: Type.OBJECT,
        properties: { true: { type: Type.STRING }, false: { type: Type.STRING } }
      }
    },
    required: ["type", "level", "text", "options", "correctAnswer", "explanation", "material", "quizToken", "order"]
  }
};

async function smartGeminiCall(payload: any, maxRetries = 4) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let lastError: any;
  const models = ['gemini-3-pro-preview', 'gemini-3-flash-preview'];

  for (const modelName of models) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await ai.models.generateContent({
          ...payload,
          model: modelName,
          config: {
            ...payload.config,
            thinkingConfig: { thinkingBudget: 16000 } // Budget besar untuk akurasi logika
          }
        });
        return response;
      } catch (error: any) {
        lastError = error;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  throw lastError;
}

export const generateEduCBTQuestions = async (config: GenerationConfig): Promise<EduCBTQuestion[]> => {
  const total = (Object.values(config.typeCounts) as number[]).reduce((a, b) => a + b, 0);
  const textPrompt = `BUAT TOTAL ${total} SOAL untuk ${config.subject}. Materi: ${config.material}. 
  Pastikan field 'correctAnswer' sinkron dengan 'explanation'. JANGAN MALAS MENGECEK INDEKS.`;

  const parts: any[] = [{ text: textPrompt }];
  config.referenceImages.forEach(img => parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } }));
  config.referenceTexts.forEach(txt => parts.push({ text: txt }));

  try {
    const response = await smartGeminiCall({
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: QUESTIONS_ARRAY_SCHEMA
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    return parsed.map((q: any) => normalizeQuestion(q, config));
  } catch (error: any) {
    throw new Error("Gagal generate soal.");
  }
};

export const extractQuestionsFromMedia = async (config: GenerationConfig): Promise<EduCBTQuestion[]> => {
  const prompt = `EKSTRAK SEMUA SOAL. Pertahankan format HTML jika ada. Tentukan kunci jawaban yang benar sesuai isi dokumen.`;
  const parts: any[] = [{ text: prompt }];
  config.referenceImages.forEach(img => parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } }));
  config.referenceTexts.forEach(txt => parts.push({ text: txt }));

  try {
    const response = await smartGeminiCall({
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: QUESTIONS_ARRAY_SCHEMA
      }
    });
    const parsed = JSON.parse(response.text || "[]");
    return parsed.map((q: any) => normalizeQuestion(q, config));
  } catch (error) { throw new Error("Gagal ekstraksi."); }
};

export const analyzeCognitiveLevel = async (q: EduCBTQuestion): Promise<string> => {
  const prompt = `Tentukan level C1-C6 untuk soal ini: ${q.text}`;
  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: prompt }] },
      config: { systemInstruction: "Hanya label level kognitif lengkap." }
    });
    return response.text?.trim() || "C1 Mengingat";
  } catch { return q.level; }
};

export const convertTextToLatex = async (text: string): Promise<string> => {
  if (!text.trim()) return "";
  const prompt = `Ubah teks matematika ke LaTeX: ${text}`;
  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: prompt }] },
      config: { systemInstruction: "Output LaTeX saja." }
    });
    return response.text?.trim() || text;
  } catch { return text; }
};

const normalizeQuestion = (q: any, config: any): EduCBTQuestion => {
  let type = q.type;
  let correctedAnswer = q.correctAnswer;
  const options = Array.isArray(q.options) ? q.options.map(opt => unescapeHtml(String(opt))) : [];
  
  // Perbaikan Teks HTML yang ter-escape
  const text = unescapeHtml(q.text || "");
  const explanation = unescapeHtml(q.explanation || "");

  // Normalisasi Level
  let level = q.level || "C1 Mengingat";
  if (!VALID_LEVELS.includes(level)) level = "C1 Mengingat";

  // Parsing Kunci Jawaban yang mungkin dikirim AI sebagai string/JSON-string
  if (typeof correctedAnswer === 'string') {
    if (correctedAnswer.startsWith('[') || correctedAnswer.startsWith('{')) {
      try { correctedAnswer = JSON.parse(correctedAnswer); } catch(e) {}
    } else if (correctedAnswer.includes(',')) {
      // Jika AI mengirim "0, 2" untuk MCMA
      correctedAnswer = correctedAnswer.split(',').map(s => {
        const val = s.trim().toUpperCase();
        if (val === 'A') return 0; if (val === 'B') return 1; if (val === 'C') return 2;
        if (val === 'D') return 3; if (val === 'E') return 4;
        return parseInt(val);
      }).filter(n => !isNaN(n));
    }
  }

  // Validasi tipe data akhir
  if (type === QuestionType.BenarSalah || type === QuestionType.SesuaiTidakSesuai) {
    if (!Array.isArray(correctedAnswer)) {
      correctedAnswer = new Array(options.length).fill(false);
    } else {
      correctedAnswer = correctedAnswer.map(v => 
        v === true || v === 'true' || String(v).toLowerCase() === 'benar' || String(v).toLowerCase() === 'sesuai' || String(v).toLowerCase() === 'b' || String(v).toLowerCase() === 's'
      );
    }
  } else if (type === QuestionType.MCMA) {
    if (!Array.isArray(correctedAnswer)) {
      correctedAnswer = [typeof correctedAnswer === 'number' ? correctedAnswer : 0];
    }
  } else if (type === QuestionType.PilihanGanda) {
    if (typeof correctedAnswer !== 'number') {
      const p = parseInt(correctedAnswer);
      correctedAnswer = isNaN(p) ? 0 : p;
    }
  }

  return {
    ...q,
    id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    text,
    explanation,
    options,
    correctAnswer: correctedAnswer,
    subject: config.subject,
    phase: config.phase,
    quizToken: (q.quizToken || config.quizToken || "AUTO").toString().toUpperCase(),
    material: q.material || config.material,
    level,
    isDeleted: false,
    createdAt: Date.now(),
    order: q.order || 1,
    tfLabels: q.tfLabels || (type === QuestionType.BenarSalah ? { true: 'Benar', false: 'Salah' } : { true: 'Sesuai', false: 'Tidak Sesuai' })
  };
};

export const generateExplanationForQuestion = async (q: any): Promise<string> => {
  const prompt = `Bahas soal ini secara mendalam dengan format HTML: ${JSON.stringify(q)}`;
  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: prompt }] },
      config: { systemInstruction: "Pakar pedagogi. Gunakan HTML." }
    });
    return unescapeHtml(response.text?.trim() || "");
  } catch { return "Gagal generate pembahasan."; }
};

export const regenerateSingleQuestion = async (q: EduCBTQuestion, instructions?: string): Promise<EduCBTQuestion> => {
  const prompt = `Revisi soal ini: ${JSON.stringify(q)}\nInstruksi: ${instructions || "Perbaiki kualitas."}`;
  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: QUESTIONS_ARRAY_SCHEMA
      }
    });
    const parsed = JSON.parse(response.text || "[]");
    const newQ = Array.isArray(parsed) ? parsed[0] : parsed;
    return normalizeQuestion(newQ, { subject: q.subject, phase: q.phase, material: q.material, quizToken: q.quizToken });
  } catch { return q; }
};
