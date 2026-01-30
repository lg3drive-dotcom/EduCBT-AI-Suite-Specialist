
import { GoogleGenAI, Type } from "@google/genai";
import { EduCBTQuestion, GenerationConfig, QuestionType } from "./types";

const SYSTEM_INSTRUCTION = `
Persona: Pakar Kurikulum Nasional (AKM/HOTS) & Pengembang Sistem EduCBT Pro.
Tugas: Membuat soal evaluasi berkualitas tinggi dalam format JSON array yang VALID dan VARIATIF.

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
- UNTUK TIPE TABEL (Benar/Salah & Sesuai/Tidak Sesuai): 'options' berisi daftar pernyataan (minimal 3), dan 'correctAnswer' HARUS array boolean dengan panjang yang sama.
- DILARANG memasukkan teks instruksi atau penjelasan format ke dalam nilai field JSON manapun.
- 'tfLabels' HARUS HANYA berisi kata "Benar" & "Salah" atau "Sesuai" & "Tidak Sesuai".
- Gunakan teks polos (Plain Text), hindari Markdown.
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
      // correctAnswer is kept as STRING in schema for flexibility, normalizeQuestion handles type conversion.
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
  }
};

const cleanFormatting = (str: string) => {
  if (!str) return "";
  return str
    .replace(/<[^>]*>?/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__/g, '')
    .replace(/#{1,6}\s?/g, '')
    .replace(/`{1,3}/g, '')
    .trim();
};

// Internal helper for making Gemini API calls with retries and model rotation.
async function smartGeminiCall(payload: any, maxRetries = 4) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let lastError: any;
  // Complex reasoning tasks use 'gemini-3-pro-preview'.
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
  const requestedTypes = Object.entries(config.typeCounts)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => `- ${type}: ${count} SOAL`)
    .join('\n');

  const total = (Object.values(config.typeCounts) as number[]).reduce((a, b) => a + b, 0);

  const textPrompt = `BUAT TOTAL ${total} SOAL untuk ${config.subject}.
  Materi: ${config.material}
  Token: ${config.quizToken}
  
### PEMBAGIAN TIPE:
${requestedTypes}

### KONTEKS REFERENSI:
${config.referenceText ? `Gunakan teks ini sebagai dasar: ${config.referenceText.substring(0, 5000)}` : ''}
${config.referenceImage ? `Lihat gambar yang saya lampirkan untuk membuat soal berdasarkan stimulus visual (grafik/tabel/infografis/buku paket) tersebut.` : ''}
${config.specialInstructions ? `Instruksi Khusus: ${config.specialInstructions}` : ''}`;

  const parts: any[] = [{ text: textPrompt }];
  
  if (config.referenceImage) {
    parts.push({
      inlineData: {
        data: config.referenceImage.data,
        mimeType: config.referenceImage.mimeType
      }
    });
  }

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
    throw new Error("Gagal generate soal. Pastikan koneksi stabil.");
  }
};

const normalizeQuestion = (q: any, config: any): EduCBTQuestion => {
  let type = q.type;
  let correctedAnswer = q.correctAnswer;
  const optionsCount = q.options?.length || 4;

  // Handle various response types for correctAnswer from Gemini.
  if (type === QuestionType.BenarSalah || type === QuestionType.SesuaiTidakSesuai) {
    q.tfLabels = type === QuestionType.BenarSalah ? { "true": "Benar", "false": "Salah" } : { "true": "Sesuai", "false": "Tidak Sesuai" };
    if (!Array.isArray(correctedAnswer)) {
      if (typeof correctedAnswer === 'string' && (correctedAnswer.includes('[') || correctedAnswer.includes(','))) {
        try {
          correctedAnswer = JSON.parse(correctedAnswer.includes('[') ? correctedAnswer : `[${correctedAnswer}]`);
        } catch {
          correctedAnswer = new Array(optionsCount).fill(false);
        }
      } else {
        correctedAnswer = new Array(optionsCount).fill(false);
      }
    }
  } else if (type === QuestionType.MCMA) {
    if (!Array.isArray(correctedAnswer)) {
      if (typeof correctedAnswer === 'string' && (correctedAnswer.includes('[') || correctedAnswer.includes(','))) {
        try {
          correctedAnswer = JSON.parse(correctedAnswer.includes('[') ? correctedAnswer : `[${correctedAnswer}]`);
        } catch {
          correctedAnswer = [0];
        }
      } else if (typeof correctedAnswer === 'number') {
        correctedAnswer = [correctedAnswer];
      } else {
        correctedAnswer = [0];
      }
    }
  } else if (type === QuestionType.PilihanGanda) {
    if (typeof correctedAnswer !== 'number') {
      const parsed = parseInt(correctedAnswer);
      correctedAnswer = isNaN(parsed) ? 0 : parsed;
    }
  }

  return {
    ...q,
    id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    text: cleanFormatting(q.text || ""),
    explanation: cleanFormatting(q.explanation),
    correctAnswer: correctedAnswer,
    subject: config.subject,
    phase: config.phase,
    quizToken: (q.quizToken || config.quizToken || "").toString().toUpperCase(),
    material: q.material || config.material,
    isDeleted: false,
    createdAt: Date.now(),
    order: q.order || 1,
    tfLabels: q.tfLabels
  };
};

/**
 * Generates an explanation for a given question using AI.
 */
export const generateExplanationForQuestion = async (q: any): Promise<string> => {
  const prompt = `Berikan penjelasan ringkas dan logis untuk kunci jawaban soal berikut ini:\n\n${JSON.stringify(q)}`;
  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: "Anda adalah pakar pedagogi yang memberikan penjelasan kunci jawaban yang mendalam namun mudah dipahami.",
      }
    });
    return response.text?.trim() || "Penjelasan tidak tersedia.";
  } catch {
    return "Gagal menghasilkan penjelasan.";
  }
};

/**
 * Analyzes the cognitive level (L1, L2, L3) of a question using AI.
 */
export const analyzeLevelForQuestion = async (q: any): Promise<string> => {
  const prompt = `Analisis level kognitif soal ini (L1, L2, atau L3). Berikan HANYA label levelnya saja.\n\n${JSON.stringify(q)}`;
  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: "Anda adalah pakar asesmen nasional. L1: Pemahaman, L2: Aplikasi, L3: Penalaran/HOTS.",
      }
    });
    const result = response.text?.trim() || "L1";
    return ["L1", "L2", "L3"].includes(result) ? result : "L1";
  } catch {
    return "L1";
  }
};

/**
 * Repairs missing fields in a list of questions using AI.
 */
export const repairQuestions = async (qs: EduCBTQuestion[]): Promise<EduCBTQuestion[]> => {
  const prompt = `Lengkapi field yang kosong atau tidak valid (explanation, material, level) pada daftar soal JSON berikut. Pastikan outputnya tetap berupa JSON array yang valid:\n\n${JSON.stringify(qs)}`;
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
    return parsed.map((q: any, i: number) => normalizeQuestion({ ...qs[i], ...q }, { subject: qs[i].subject, phase: qs[i].phase, material: qs[i].material, quizToken: qs[i].quizToken }));
  } catch {
    return qs;
  }
};

/**
 * Regenerates a single question based on instructions.
 * Fixed the signature to accept (target, instructions) as called in App.tsx.
 */
export const regenerateSingleQuestion = async (q: EduCBTQuestion, instructions?: string): Promise<EduCBTQuestion> => {
  const prompt = `Revisi soal berikut ini:\n${JSON.stringify(q)}\n\nInstruksi Khusus: ${instructions || "Perbaiki kualitas soal namun tetap pertahankan format JSON yang sama."}`;
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
  } catch {
    return q;
  }
};

/**
 * Generates an image using Gemini's image generation model.
 */
export const generateImage = async (p: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: p }] },
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (error) {
    console.error("Image generation failed", error);
  }
  return "";
};
