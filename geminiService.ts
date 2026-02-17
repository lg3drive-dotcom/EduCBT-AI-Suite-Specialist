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

export const normalizeQuestionType = (type: string): string => {
  const t = String(type).toUpperCase().trim();
  
  if (t.includes("PILIHAN GANDA") || t === "PG" || t === "PILIHAN_GANDA") return QuestionType.PilihanGanda;
  if (t.includes("JAMAK") || t.includes("MCMA") || t.includes("COMPLEX") || t.includes("PILIHAN JAMAK")) return QuestionType.MCMA;
  if (t.includes("BENAR") || t.includes("B/S") || t === "BENAR/SALAH" || t === "(BENAR/SALAH)") return QuestionType.BenarSalah;
  if (t.includes("SESUAI") || t.includes("S/TS") || t === "SESUAI/TIDAK SESUAI" || t === "(SESUAI/TIDAK SESUAI)") return QuestionType.SesuaiTidakSesuai;
  if (t.includes("ISIAN") || t === "SHORT_ANSWER") return QuestionType.Isian;
  if (t.includes("URAIAN") || t === "ESSAY") return QuestionType.Uraian;
  
  return QuestionType.PilihanGanda;
};

const SYSTEM_INSTRUCTION = `
Persona: Pakar Kurikulum Nasional & Pengembang EduCBT Pro.
Tugas: Membuat soal evaluasi format JSON array yang VALID, VARIATIF, dan KONSISTEN.

### ATURAN LEVEL KOGNITIF ###
DILARANG menggunakan level seperti "SD", "SMP", "SMA", atau "L1/L2".
HANYA gunakan label Bloom berikut secara eksak:
- "C1 Mengingat"
- "C2 Memahami"
- "C3 Menerapkan"
- "C4 Menganalisis"
- "C5 Mengevaluasi"
- "C6 Mencipta"

### ATURAN HTML ###
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

export const normalizeQuestion = (q: any, config: any): EduCBTQuestion => {
  let type = normalizeQuestionType(q.type);
  let correctedAnswer = q.correctAnswer;
  const options = Array.isArray(q.options) ? q.options.map(opt => unescapeHtml(String(opt))) : [];
  const text = unescapeHtml(q.text || "");
  const explanation = unescapeHtml(q.explanation || "");

  // Normalisasi Level
  let level = q.level || "C1 Mengingat";
  const levelUpper = String(level).toUpperCase();
  if (levelUpper.includes("L1") || levelUpper.includes("MUDAH") || levelUpper.includes("SEDANG") && !levelUpper.includes("HOTS")) {
    if (levelUpper.includes("L1")) level = "C1 Mengingat";
    else if (levelUpper.includes("L2") || levelUpper.includes("SEDANG")) level = "C3 Menerapkan";
  } else if (levelUpper.includes("L3") || levelUpper.includes("HOTS") || levelUpper.includes("SULIT") || levelUpper.includes("MENENGA")) {
    level = "C4 Menganalisis";
  }
  
  const foundValidLevel = VALID_LEVELS.find(v => level.includes(v.split(' ')[0]));
  if (foundValidLevel) level = foundValidLevel;

  // Handle Answer Key Strings from Excel
  if (typeof correctedAnswer === 'string') {
    const rawVal = correctedAnswer.trim();
    if (rawVal.startsWith('[') || rawVal.startsWith('{')) {
      try { correctedAnswer = JSON.parse(rawVal); } catch(e) {}
    } else if (type === QuestionType.PilihanGanda) {
      const charCode = rawVal.toUpperCase().charCodeAt(0);
      if (charCode >= 65 && charCode <= 69) correctedAnswer = charCode - 65;
      else correctedAnswer = parseInt(rawVal) || 0;
    } else if (type === QuestionType.MCMA) {
      correctedAnswer = rawVal.split(/[,\s;]+/).map(s => {
        const v = s.trim().toUpperCase();
        const code = v.charCodeAt(0);
        if (code >= 65 && code <= 69) return code - 65;
        return parseInt(v) - 1;
      }).filter(v => !isNaN(v) && v >= 0);
    } else if (type === QuestionType.BenarSalah || type === QuestionType.SesuaiTidakSesuai) {
      correctedAnswer = rawVal.split(/[,\s;]+/).map(s => {
        const val = s.trim().toUpperCase();
        // B, S, T, S...
        // T usually means "Tidak Sesuai" (False) or "True" in some weird maps.
        // Based on common Indonesian CBT: B=Benar (True), S=Salah (False). 
        // For Sesuai/Tidak: S=Sesuai (True), T/TS=Tidak Sesuai (False).
        if (type === QuestionType.BenarSalah) {
          return val === 'B' || val === 'BENAR' || val === 'TRUE' || val === 'T'; // Some use T for True (Ture)
        } else {
          return val === 'S' || val === 'SESUAI' || val === 'TRUE';
        }
      });
    }
  }

  // Final check for Boolean arrays (Benar/Salah)
  if ((type === QuestionType.BenarSalah || type === QuestionType.SesuaiTidakSesuai) && Array.isArray(correctedAnswer)) {
      correctedAnswer = (correctedAnswer as any[]).map(v => {
          if (typeof v === 'boolean') return v;
          const s = String(v).toUpperCase();
          if (type === QuestionType.BenarSalah) return s === 'B' || s === 'BENAR' || s === 'TRUE' || s === 'T' || v === 1;
          return s === 'S' || s === 'SESUAI' || s === 'TRUE' || v === 1;
      });
  }

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