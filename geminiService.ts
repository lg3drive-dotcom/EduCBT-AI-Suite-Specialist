
import { GoogleGenAI, Type } from "@google/genai";
import { EduCBTQuestion, GenerationConfig, QuestionType } from "./types";

const unescapeHtml = (html: string) => {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
};

const VALID_LEVELS = [
  "C1 Mengingat", "C2 Memahami", "C3 Menerapkan", 
  "C4 Menganalisis", "C5 Mengevaluasi", "C6 Mencipta"
];

// Helper untuk menormalkan tipe soal dari berbagai variasi teks
export const normalizeQuestionType = (type: string): string => {
  const t = String(type).toUpperCase();
  if (t.includes("PILIHAN GANDA") || t.includes("MULTIPLE_CHOICE") || t === "PG") return QuestionType.PilihanGanda;
  if (t.includes("JAMAK") || t.includes("MCMA") || t.includes("COMPLEX")) return QuestionType.MCMA;
  if (t.includes("BENAR") || t.includes("B/S") || t.includes("TRUE_FALSE") || t.includes("BENARSALAH")) return QuestionType.BenarSalah;
  if (t.includes("SESUAI") || t.includes("S/TS") || t.includes("MATCHING")) return QuestionType.SesuaiTidakSesuai;
  if (t.includes("ISIAN") || t.includes("SHORT_ANSWER")) return QuestionType.Isian;
  if (t.includes("URAIAN") || t.includes("ESSAY")) return QuestionType.Uraian;
  return QuestionType.PilihanGanda; // Default
};

const SYSTEM_INSTRUCTION = `
Persona: Pakar Kurikulum Nasional & Pengembang EduCBT Pro.
Tugas: Membuat soal evaluasi format JSON array yang VALID, VARIATIF, dan KONSISTEN.

### ATURAN LEVEL KOGNITIF (SANGAT PENTING) ###
DILARANG menggunakan level seperti "SD", "SMP", "SMA", atau "L1/L2".
HANYA gunakan label Bloom berikut secara eksak:
- "C1 Mengingat" (Untuk soal hafalan)
- "C2 Memahami" (Untuk soal konsep)
- "C3 Menerapkan" (Untuk soal aplikasi)
- "C4 Menganalisis" (HOTS - Analisis stimulus)
- "C5 Mengevaluasi" (HOTS - Menilai argumen)
- "C6 Mencipta" (HOTS - Membuat solusi)

### ATURAN HTML (KRUSIAL) ###
- Gunakan tag HTML RAW (<b>, <i>, <br>, <ul>, <div style="...">).
- JANGAN meng-escape tag HTML. Gunakan < dan > secara langsung.

### LOGIKA KUNCI JAWABAN ###
- Pilihan Ganda: Integer (0 untuk A, 1 untuk B, dst).
- MCMA: Array of Integer [0, 2].
- Benar/Salah: Array of Boolean [true, false, true].
`;

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
      correctAnswer: { type: Type.STRING },
      tfLabels: {
        type: Type.OBJECT,
        properties: { true: { type: Type.STRING }, false: { type: Type.STRING } }
      }
    },
    required: ["type", "level", "text", "options", "correctAnswer", "explanation", "material", "quizToken", "order"]
  }
};

async function smartGeminiCall(payload: any, maxRetries = 3) {
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
            thinkingConfig: { thinkingBudget: 16000 }
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
  Petakan level L1 ke C1-C2, L2 ke C3, dan L3 ke C4-C6. 
  Pastikan field 'quizToken' di JSON bernilai "${config.quizToken}".`;

  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: textPrompt }] },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: QUESTIONS_ARRAY_SCHEMA
      }
    });
    const parsed = JSON.parse(response.text || "[]");
    return parsed.map((q: any) => normalizeQuestion(q, config));
  } catch (error) { throw new Error("Gagal generate soal."); }
};

export const extractQuestionsFromMedia = async (config: GenerationConfig): Promise<EduCBTQuestion[]> => {
  const prompt = `EKSTRAK SEMUA SOAL. Pastikan label level kognitif sesuai format C1-C6.`;
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
  const prompt = `Tentukan level kognitif Bloom (C1-C6) untuk soal ini: ${q.text}`;
  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: prompt }] },
      config: { systemInstruction: "Output HANYA label level kognitif lengkap seperti 'C4 Menganalisis'." }
    });
    const result = response.text?.trim() || "C1 Mengingat";
    return VALID_LEVELS.find(v => result.includes(v.split(' ')[0])) || result;
  } catch { return q.level; }
};

export const convertTextToLatex = async (text: string): Promise<string> => {
  if (!text.trim()) return "";
  const prompt = `Ubah ke LaTeX: ${text}`;
  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: prompt }] },
      config: { systemInstruction: "Output LaTeX saja." }
    });
    return response.text?.trim() || text;
  } catch { return text; }
};

const normalizeQuestion = (q: any, config: any): EduCBTQuestion => {
  let type = normalizeQuestionType(q.type);
  let correctedAnswer = q.correctAnswer;
  const options = Array.isArray(q.options) ? q.options.map(opt => unescapeHtml(String(opt))) : [];
  const text = unescapeHtml(q.text || "");
  const explanation = unescapeHtml(q.explanation || "");

  // Normalisasi Level - Cegah "SD" atau level salah lainnya
  let level = q.level || "C1 Mengingat";
  const foundValidLevel = VALID_LEVELS.find(v => level.includes(v.split(' ')[0]));
  if (foundValidLevel) {
    level = foundValidLevel;
  } else if (level.includes("L1")) level = "C1 Mengingat";
  else if (level.includes("L2")) level = "C3 Menerapkan";
  else if (level.includes("L3")) level = "C4 Menganalisis";
  else level = "C1 Mengingat"; // Fallback jika tetap aneh

  if (typeof correctedAnswer === 'string') {
    if (correctedAnswer.startsWith('[') || correctedAnswer.startsWith('{')) {
      try { correctedAnswer = JSON.parse(correctedAnswer); } catch(e) {}
    } else if (correctedAnswer.includes(',')) {
      correctedAnswer = correctedAnswer.split(',').map(s => {
        const val = s.trim().toUpperCase();
        if (val === 'A') return 0; if (val === 'B') return 1; if (val === 'C') return 2;
        if (val === 'D') return 3; if (val === 'E') return 4;
        return parseInt(val);
      }).filter(n => !isNaN(n));
    }
  }

  if (type === QuestionType.BenarSalah || type === QuestionType.SesuaiTidakSesuai) {
    if (!Array.isArray(correctedAnswer)) correctedAnswer = new Array(options.length).fill(false);
    else correctedAnswer = correctedAnswer.map(v => v === true || v === 'true' || String(v).toLowerCase() === 'benar' || String(v).toLowerCase() === 'sesuai' || String(v).toLowerCase() === 'b' || String(v).toLowerCase() === 's');
  } else if (type === QuestionType.MCMA) {
    if (!Array.isArray(correctedAnswer)) {
      const p = parseInt(correctedAnswer);
      correctedAnswer = isNaN(p) ? [] : [p];
    } else {
      correctedAnswer = correctedAnswer.map(v => parseInt(v)).filter(v => !isNaN(v));
    }
  } else if (type === QuestionType.PilihanGanda) {
    correctedAnswer = parseInt(correctedAnswer);
    if (isNaN(correctedAnswer)) correctedAnswer = 0;
  }

  // Prioritas Token: Gunakan token dari config user jika ada, jika tidak pakai dari AI
  const finalToken = (config.quizToken || q.quizToken || "AUTO").toString().toUpperCase();

  return {
    ...q,
    id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type, text, explanation, options, correctAnswer: correctedAnswer,
    subject: config.subject, phase: config.phase, material: q.material || config.material,
    quizToken: finalToken,
    level, isDeleted: false, createdAt: Date.now(), order: q.order || 1,
    tfLabels: q.tfLabels || (type === QuestionType.BenarSalah ? { true: 'Benar', false: 'Salah' } : { true: 'Sesuai', false: 'Tidak Sesuai' })
  };
};

export const generateExplanationForQuestion = async (q: any): Promise<string> => {
  const prompt = `Berikan pembahasan HTML untuk soal: ${JSON.stringify(q)}`;
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
    return normalizeQuestion(Array.isArray(parsed) ? parsed[0] : parsed, { subject: q.subject, phase: q.phase, material: q.material, quizToken: q.quizToken });
  } catch { return q; }
};
