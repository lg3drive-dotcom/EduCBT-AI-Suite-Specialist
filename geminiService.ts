
import { GoogleGenAI, Type } from "@google/genai";
import { EduCBTQuestion, GenerationConfig, QuestionType } from "./types";

const SYSTEM_INSTRUCTION = `
Persona: Pakar Kurikulum Nasional & Pengembang EduCBT Pro.
Tugas: Membuat soal berkualitas tinggi dalam format JSON.

### ATURAN NOTASI MATEMATIKA & SAINS (WAJIB) ###
- Gunakan standar LaTeX untuk semua rumus, angka berpangkat, akar, pecahan, dan simbol kimia.
- Bungkus rumus dengan tanda dollar satu ($) untuk inline, atau dollar ganda ($$) untuk baris baru/penting.
- Contoh: $x^2$, $\frac{1}{2}$, $\sqrt{25}$, $H_2O$, $\int_0^\infty$.
- Hindari penggunaan karakter ^ atau / biasa jika itu dimaksudkan sebagai notasi matematika formal.

### FITUR STIMULUS BERSAMA ###
- Jika soal merujuk bacaan yang sama, isi 'stimulusText' dengan teks identik.

### DAFTAR TIPE SOAL ###
1. Pilihan Ganda (PG)
2. Pilihan Jamak (MCMA)
3. (Benar/Salah)
4. (Sesuai/Tidak Sesuai)
5. ISIAN
6. URAIAN

### ATURAN TEKNIS ###
- JSON HARUS VALID.
- 'correctAnswer' sesuai tipe soal (Indeks, Array Indeks, atau Array Boolean).
- 'tfLabels' harus bersih.
`;

const SINGLE_QUESTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING },
    level: { type: Type.STRING },
    stimulusText: { type: Type.STRING },
    text: { type: Type.STRING },
    explanation: { type: Type.STRING },
    material: { type: Type.STRING },
    quizToken: { type: Type.STRING },
    order: { type: Type.INTEGER },
    options: { type: Type.ARRAY, items: { type: Type.STRING } },
    correctAnswer: { type: Type.STRING },
    tfLabels: {
      type: Type.OBJECT,
      properties: {
        true: { type: Type.STRING },
        false: { type: Type.STRING }
      }
    }
  },
  required: ["type", "level", "text", "options", "correctAnswer", "explanation", "material", "quizToken", "order"]
};

const QUESTIONS_ARRAY_SCHEMA = {
  type: Type.ARRAY,
  items: SINGLE_QUESTION_SCHEMA
};

const cleanFormatting = (str: string) => {
  if (!str) return "";
  return str
    .replace(/<[^>]*>?/gm, '')
    // Jangan hapus $ karena digunakan untuk KaTeX
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__/g, '')
    .replace(/`{1,3}/g, '')
    .trim();
};

async function smartGeminiCall(payload: any, maxRetries = 4) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let lastError: any;
  const models = ['gemini-3-pro-preview', 'gemini-3-flash-preview'];
  for (const modelName of models) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await ai.models.generateContent({ ...payload, model: modelName });
        return response;
      } catch (error: any) {
        lastError = error;
        const msg = (error?.message || "").toLowerCase();
        if (msg.includes("quota") || msg.includes("429")) {
          await new Promise(r => setTimeout(r, (i + 1) * 3000));
          continue;
        }
        throw error;
      }
    }
  }
  throw lastError;
}

export const generateEduCBTQuestions = async (config: GenerationConfig): Promise<EduCBTQuestion[]> => {
  const prompt = `BUAT SOAL UNTUK ${config.subject}. MATERI: ${config.material}. TOKEN: ${config.quizToken}. 
  ${config.referenceText ? `REFERENSI TEKS: ${config.referenceText}` : ''}
  ${config.specialInstructions ? `INSTRUKSI KHUSUS: ${config.specialInstructions}` : ''}
  Gunakan notasi LaTeX $ ... $ untuk setiap rumus matematika/sains agar terbaca sistem.`;
  try {
    const response = await smartGeminiCall({
      contents: prompt,
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

const normalizeQuestion = (q: any, config: any): EduCBTQuestion => {
  let type = q.type;
  let correctedAnswer = q.correctAnswer;
  const optionsCount = q.options?.length || 4;

  if (type === QuestionType.BenarSalah || type === QuestionType.SesuaiTidakSesuai) {
    q.tfLabels = type === QuestionType.BenarSalah ? { "true": "Benar", "false": "Salah" } : { "true": "Sesuai", "false": "Tidak Sesuai" };
    if (!Array.isArray(correctedAnswer)) {
      correctedAnswer = new Array(optionsCount).fill(false);
    }
  }

  return {
    ...q,
    id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    text: cleanFormatting(q.text || ""),
    stimulusText: q.stimulusText ? cleanFormatting(q.stimulusText) : undefined,
    explanation: cleanFormatting(q.explanation),
    correctAnswer: correctedAnswer,
    subject: config.subject,
    phase: config.phase,
    quizToken: (q.quizToken || config.quizToken || "").toString().toUpperCase(),
    material: q.material || config.material,
    isDeleted: false,
    createdAt: Date.now(),
    order: q.order || 1
  };
};

export const suggestLevel = async (questionText: string, options: string[]): Promise<string> => {
  const prompt = `Analisis level kognitif untuk soal: ${questionText}. Opsi: ${options.join(", ")}. Balas L1, L2, atau L3 saja.`;
  try {
    const response = await smartGeminiCall({ contents: prompt, config: { systemInstruction: "Pakar asesmen." } });
    return response.text.trim().substring(0, 2) || "L1";
  } catch { return "L1"; }
};

export const generateSingleExplanation = async (question: EduCBTQuestion): Promise<string> => {
  const prompt = `Buat pembahasan untuk: ${question.text} dengan kunci: ${JSON.stringify(question.correctAnswer)}. Gunakan LaTeX jika ada rumus.`;
  try {
    const response = await smartGeminiCall({ contents: prompt, config: { systemInstruction: "Pakar pedagogi." } });
    return cleanFormatting(response.text);
  } catch { return "Pembahasan gagal dibuat."; }
};

// Fixed repairQuestions: Implemented AI-driven data completion for missing fields.
export const repairQuestions = async (qs: EduCBTQuestion[]): Promise<EduCBTQuestion[]> => {
  const prompt = `LENGKAPI DATA KOSONG (pembahasan, level, atau materi) pada kumpulan soal berikut tanpa mengubah teks soal asli:
  ${JSON.stringify(qs)}
  
  Kembalikan array objek JSON lengkap sesuai skema yang diberikan.`;
  
  try {
    const response = await smartGeminiCall({
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: QUESTIONS_ARRAY_SCHEMA
      }
    });
    const parsed = JSON.parse(response.text || "[]");
    return parsed.map((q: any, i: number) => {
      const original = qs[i] || {};
      return normalizeQuestion(q, { 
        subject: original.subject, 
        phase: original.phase, 
        quizToken: original.quizToken, 
        material: original.material 
      });
    });
  } catch (error) {
    throw new Error("Gagal melakukan perbaikan data via AI.");
  }
};

// Fixed regenerateSingleQuestion: Added optional instructions parameter and implemented AI generation logic.
export const regenerateSingleQuestion = async (q: EduCBTQuestion, instructions?: string): Promise<EduCBTQuestion> => {
  const prompt = `REGENERATE SOAL BERIKUT.
  Data Asli: ${JSON.stringify(q)}
  Instruksi Tambahan: ${instructions || "Buat soal serupa dengan kualitas lebih baik."}
  
  Kembalikan dalam format JSON sesuai skema.`;
  
  try {
    const response = await smartGeminiCall({
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: SINGLE_QUESTION_SCHEMA
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    const regenerated = normalizeQuestion(parsed, { 
      subject: q.subject, 
      phase: q.phase, 
      quizToken: q.quizToken, 
      material: q.material 
    });
    // Preserve original ID and order
    return { ...regenerated, id: q.id, order: q.order };
  } catch (error) {
    throw new Error("Gagal regenerasi soal.");
  }
};
