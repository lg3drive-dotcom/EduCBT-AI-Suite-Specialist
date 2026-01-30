
import { GoogleGenAI, Type } from "@google/genai";
import { EduCBTQuestion, GenerationConfig, QuestionType } from "./types";

const SYSTEM_INSTRUCTION = `
Persona: Pakar Kurikulum Nasional (AKM/HOTS) & Pengembang Sistem EduCBT Pro.
Tugas: Membuat soal evaluasi berkualitas tinggi dalam format JSON array yang VALID dan VARIATIF.

### FITUR STIMULUS BERSAMA (AKM STYLE) ###
- Jika ada bacaan/teks panjang yang mendasari beberapa soal, masukkan teks tersebut ke dalam field 'stimulusText'.
- Soal-soal yang merujuk pada bacaan yang sama HARUS memiliki nilai 'stimulusText' yang IDENTIK agar sistem bisa mengelompokkannya.
- Jika soal berdiri sendiri tanpa bacaan panjang, biarkan 'stimulusText' kosong atau null.

### DAFTAR TIPE SOAL (STRICT) ###
1. Pilihan Ganda: 
   - 'type': "Pilihan Ganda"
   - 'correctAnswer': Integer (0-4) sebagai indeks.
2. Pilihan Jamak (MCMA):
   - 'type': "Pilihan Jamak (MCMA)"
   - 'correctAnswer': Array of Integer (indeks yang benar).
3. (Benar/Salah):
   - 'type': "(Benar/Salah)"
   - 'correctAnswer': Array of Boolean (true/false) untuk tiap baris pernyataan di 'options'.
   - 'tfLabels': {"true": "Benar", "false": "Salah"}.
4. (Sesuai/Tidak Sesuai):
   - 'type': "(Sesuai/Tidak Sesuai)"
   - 'correctAnswer': Array of Boolean (true/false) untuk tiap baris pernyataan di 'options'.
   - 'tfLabels': {"true": "Sesuai", "false": "Tidak Sesuai"}.
5. ISIAN:
   - 'type': "ISIAN"
   - 'correctAnswer': String jawaban singkat.
6. URAIAN:
   - 'type': "URAIAN"
   - 'correctAnswer': String penjelasan kunci.

### ATURAN TEKNIS KRUSIAL ###
- UNTUK TIPE TABEL: 'options' berisi daftar pernyataan, dan 'correctAnswer' HARUS array boolean.
- 'stimulusText' HARUS berisi teks narasi, data, atau konteks sebelum pertanyaan inti.
- 'text' HARUS berisi pertanyaan spesifiknya saja.
- Gunakan teks polos (Plain Text), hindari Markdown berlebihan.
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
        const response = await ai.models.generateContent({
          ...payload,
          model: modelName
        });
        return response;
      } catch (error: any) {
        lastError = error;
        const msg = (error?.message || "").toLowerCase();
        if (msg.includes("quota") || msg.includes("429") || msg.includes("overloaded")) {
          if (i === maxRetries - 1) continue;
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
  const prompt = `BUAT TOTAL SOAL UNTUK ${config.subject}.
  MATERI: ${config.material}
  TOKEN: ${config.quizToken}
  ${config.referenceText ? `REFERENSI: ${config.referenceText.substring(0, 5000)}` : ''}
  
  INSTRUKSI KHUSUS: 
  Jika materi memungkinkan, buatlah kelompok soal (2-3 soal) yang menggunakan 'stimulusText' yang sama (seperti tipe soal AKM/literasi).`;

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

export const suggestLevel = async (questionText: string, options: string[]): Promise<string> => {
  const prompt = `Analisis tingkat kognitif soal berikut:
  Soal: ${questionText}
  Opsi: ${options.join(', ')}
  
  Tentukan levelnya: L1 (Pemahaman/Ingatan), L2 (Aplikasi), atau L3 (Penalaran/HOTS). 
  HANYA BALAS DENGAN KODE LEVELNYA SAJA (Contoh: L3).`;

  try {
    const response = await smartGeminiCall({
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah pakar asesmen pendidikan. Balas hanya dengan 'L1', 'L2', atau 'L3'."
      }
    });
    return response.text.trim().substring(0, 2).toUpperCase() || "L1";
  } catch {
    return "L1";
  }
};

export const generateSingleExplanation = async (question: EduCBTQuestion): Promise<string> => {
  const prompt = `Buatlah analisis jawaban (pembahasan) yang mendalam dan edukatif untuk soal berikut:
  Pertanyaan: ${question.text}
  Opsi: ${question.options.join(' | ')}
  Tipe: ${question.type}
  Kunci Jawaban: ${JSON.stringify(question.correctAnswer)}
  
  Berikan penjelasan mengapa jawaban tersebut benar dan mengapa opsi lain salah (jika relevan). Gunakan bahasa Indonesia yang baku dan profesional. Maksimal 3-4 kalimat.`;

  try {
    const response = await smartGeminiCall({
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah pakar pedagogi. Buatlah pembahasan soal yang membantu siswa memahami konsep."
      }
    });
    return cleanFormatting(response.text);
  } catch {
    return "Gagal membuat pembahasan otomatis.";
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

/**
 * Fix: Implementing regenerateSingleQuestion to replace a question with AI generation.
 */
export const regenerateSingleQuestion = async (oldQuestion: EduCBTQuestion, customInstructions?: string): Promise<EduCBTQuestion> => {
    const prompt = `Regenerasi soal berikut dengan materi dan level yang sama namun teks dan variasi berbeda.
    SOAL LAMA: ${JSON.stringify(oldQuestion)}
    ${customInstructions ? `INSTRUKSI KHUSUS: ${customInstructions}` : ''}
    
    KEMBALIKAN DALAM FORMAT JSON OBJEK SOAL YANG VALID.`;

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
      return normalizeQuestion(parsed, { subject: oldQuestion.subject, phase: oldQuestion.phase, material: oldQuestion.material, quizToken: oldQuestion.quizToken });
    } catch (err) {
      console.error(err);
      throw new Error("Gagal regenerasi soal.");
    }
};

/**
 * Fix: Implementing repairQuestions to complement missing fields in question data via AI.
 */
export const repairQuestions = async (questions: EduCBTQuestion[]): Promise<EduCBTQuestion[]> => {
    const prompt = `Lengkapi field yang kosong atau kurang tepat (seperti pembahasan, materi, level) pada daftar soal berikut.
    DATA: ${JSON.stringify(questions)}
    
    KEMBALIKAN DALAM FORMAT JSON ARRAY SOAL YANG LENGKAP.`;

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
      return parsed.map((q: any) => normalizeQuestion(q, { subject: q.subject, phase: q.phase, material: q.material, quizToken: q.quizToken }));
    } catch (err) {
      console.error(err);
      throw new Error("Gagal perbaikan data.");
    }
};
