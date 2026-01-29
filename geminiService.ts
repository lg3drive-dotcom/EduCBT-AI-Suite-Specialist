
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

### ATURAN TEKNIS ###
- UNTUK TIPE TABEL (Benar/Salah & Sesuai/Tidak Sesuai): 'options' berisi daftar pernyataan, dan 'correctAnswer' HARUS array boolean dengan panjang yang sama.
- JANGAN gunakan Markdown (**, *) atau HTML.
- Gunakan teks polos (Plain Text).
`;

const SINGLE_QUESTION_SCHEMA = {
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
    correctAnswer: { type: Type.STRING, description: "Indeks (PG), Array Indeks (MCMA), Array Boolean (Tabel), atau String" },
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
    .replace(/#{1,6}\s?/g, '')
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
        if (msg.includes("quota") || msg.includes("429") || msg.includes("overloaded") || msg.includes("rate limit")) {
          if (i === maxRetries - 1) continue;
          const waitTime = (i + 1) * 3000;
          await new Promise(r => setTimeout(r, waitTime));
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
    .map(([type, count]) => `- ${type}: HARUS ${count} SOAL`)
    .join('\n');

  const total = (Object.values(config.typeCounts) as number[]).reduce((a, b) => a + b, 0);

  const prompt = `BUAT TOTAL ${total} SOAL untuk ${config.subject}.
  
### PEMBAGIAN TIPE WAJIB:
${requestedTypes}

### KONTEKS:
Materi: ${config.material}
Token: ${config.quizToken}
${config.specialInstructions ? `Instruksi Khusus: ${config.specialInstructions}` : ''}

### PERINTAH KRUSIAL:
Untuk tipe "(Benar/Salah)" dan "(Sesuai/Tidak Sesuai)", 'correctAnswer' WAJIB berupa array boolean [true, false, ...] yang memetakan setiap baris pernyataan di 'options'.`;

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
    throw new Error("Gagal generate soal. AI sedang sibuk atau limit tercapai.");
  }
};

const normalizeQuestion = (q: any, config: any): EduCBTQuestion => {
  let type = q.type;
  let correctedAnswer = q.correctAnswer;
  const optionsCount = q.options?.length || 4;
  
  if (typeof correctedAnswer === 'string') {
    const trimmed = correctedAnswer.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try { correctedAnswer = JSON.parse(trimmed); } catch(e) {}
    }
  }

  // Normalisasi Tipe Tabel Boolean
  if (type === QuestionType.BenarSalah || type === QuestionType.SesuaiTidakSesuai) {
    if (!Array.isArray(correctedAnswer)) {
      const arr = new Array(optionsCount).fill(false);
      if (typeof correctedAnswer === 'string') {
        correctedAnswer.split(/[,;|]/).forEach((p, i) => {
          const s = p.trim().toUpperCase();
          if (s === 'B' || s === 'TRUE' || s === 'Y' || s === 'Sesuai' || s === 'S') arr[i] = true;
        });
      }
      correctedAnswer = arr;
    } else if (correctedAnswer.length > 0 && typeof correctedAnswer[0] !== 'boolean') {
      const arr = new Array(optionsCount).fill(false);
      correctedAnswer.forEach((val: any, i: number) => {
        if (typeof val === 'number') { if (val < optionsCount) arr[val] = true; }
        else {
           const s = String(val).toUpperCase();
           if (s === 'B' || s === 'TRUE' || s === 'Sesuai' || s === 'S') arr[i] = true;
        }
      });
      correctedAnswer = arr;
    }

    if (correctedAnswer.length !== optionsCount) {
      const arr = new Array(optionsCount).fill(false);
      for(let i=0; i < optionsCount; i++) if(correctedAnswer[i] === true) arr[i] = true;
      correctedAnswer = arr;
    }

    if (!q.tfLabels) {
      if (type === QuestionType.BenarSalah) q.tfLabels = { "true": "Benar", "false": "Salah" };
      else q.tfLabels = { "true": "Sesuai", "false": "Tidak Sesuai" };
    }
  }

  // Normalisasi MCMA
  else if (type === QuestionType.MCMA) {
    if (!Array.isArray(correctedAnswer)) {
      if (typeof correctedAnswer === 'string') {
        correctedAnswer = correctedAnswer.split(/[,;|]/).map(p => {
          const s = p.trim().toUpperCase();
          if (!isNaN(parseInt(s))) return parseInt(s);
          return s.charCodeAt(0) - 65;
        }).filter(n => !isNaN(n) && n >= 0 && n < optionsCount);
      } else {
        correctedAnswer = [Number(correctedAnswer) || 0];
      }
    }
    if (correctedAnswer.length === 0) correctedAnswer = [0];
  }

  // Normalisasi PG
  else if (type === QuestionType.PilihanGanda) {
    if (Array.isArray(correctedAnswer)) {
      correctedAnswer = typeof correctedAnswer[0] === 'boolean' ? correctedAnswer.findIndex(v => v === true) : Number(correctedAnswer[0]);
    } else if (typeof correctedAnswer === 'string') {
      const s = correctedAnswer.trim().toUpperCase();
      correctedAnswer = !isNaN(parseInt(s)) ? parseInt(s) : s.charCodeAt(0) - 65;
    }
    if (isNaN(correctedAnswer as number)) correctedAnswer = 0;
  }

  return {
    ...q,
    id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: type,
    text: cleanFormatting(q.text || q.question),
    explanation: cleanFormatting(q.explanation),
    correctAnswer: correctedAnswer,
    subject: q.subject || config.subject,
    phase: q.phase || config.phase,
    quizToken: (q.quizToken || config.quizToken || "").toString().toUpperCase(),
    material: q.material || config.material,
    isDeleted: false,
    createdAt: q.createdAt || Date.now(),
    order: q.order || 1
  };
};

export const generateExplanationForQuestion = async (q: EduCBTQuestion): Promise<string> => {
  const prompt = `Jelaskan secara logis kenapa kunci jawaban berikut benar untuk soal ini:
  SOAL: "${q.text}"
  KUNCI: ${JSON.stringify(q.correctAnswer)}
  TIPE: ${q.type}`;

  try {
    const response = await smartGeminiCall({
      contents: prompt,
      config: {
        systemInstruction: "Berikan penjelasan singkat 1-2 kalimat dalam teks polos."
      }
    });
    return cleanFormatting(response.text || "");
  } catch (err) {
    return "Analisis otomatis tidak tersedia.";
  }
};

export const analyzeLevelForQuestion = async (q: EduCBTQuestion): Promise<string> => {
  const prompt = `Analisis LEVEL KOGNITIF (L1/L2/L3) soal berikut:
  SOAL: "${q.text}"`;

  try {
    const response = await smartGeminiCall({
      contents: prompt,
      config: {
        systemInstruction: "Balas hanya dengan satu kode: L1, L2, atau L3."
      }
    });
    const result = response.text?.trim().toUpperCase();
    return ["L1", "L2", "L3"].includes(result || "") ? (result || "L1") : "L1";
  } catch (err) {
    return "L1";
  }
};

export const repairQuestions = async (questions: EduCBTQuestion[]): Promise<EduCBTQuestion[]> => {
  const batchSize = 5;
  const repairedQuestions = [...questions];
  
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    const simplified = batch.map(q => ({
      id: q.id,
      type: q.type,
      text: q.text,
      options: q.options,
      material: q.material,
      level: q.level,
      explanation: q.explanation,
      correctAnswer: q.correctAnswer
    }));

    const prompt = `LENGKAPI & PERBAIKI DATA SOAL.
    DATA SOAL: ${JSON.stringify(simplified)}`;

    try {
      const response = await smartGeminiCall({
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: QUESTIONS_ARRAY_SCHEMA
        }
      });

      const repairedBatch = JSON.parse(response.text || "[]");
      
      repairedBatch.forEach((repaired: any) => {
        const index = repairedQuestions.findIndex(q => q.id === repaired.id || q.text === repaired.text);
        if (index !== -1) {
          repairedQuestions[index] = {
            ...repairedQuestions[index],
            material: (!repairedQuestions[index].material || repairedQuestions[index].material === "Materi Belum Terisi") ? repaired.material : repairedQuestions[index].material,
            level: (!repairedQuestions[index].level || repairedQuestions[index].level === "L1") ? (repaired.level || "L1") : repairedQuestions[index].level,
            explanation: !repairedQuestions[index].explanation ? cleanFormatting(repaired.explanation) : repairedQuestions[index].explanation,
            type: repairedQuestions[index].type === "Tipe Tidak Diketahui" ? repaired.type : repairedQuestions[index].type
          };
        }
      });

      if (i + batchSize < questions.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {}
  }
  
  return repairedQuestions;
};

export const regenerateSingleQuestion = async (oldQuestion: EduCBTQuestion, customInstructions?: string): Promise<EduCBTQuestion> => {
  const prompt = `REGENERASI SOAL TIPE ${oldQuestion.type}.
  MATERI: ${oldQuestion.material}
  ${customInstructions ? `INSTRUKSI: ${customInstructions}` : 'Tingkatkan kualitas soal.'}
  GUNAKAN "quizToken": "${oldQuestion.quizToken}" dalam JSON.`;

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
    const normalized = normalizeQuestion({ ...parsed, id: oldQuestion.id, order: oldQuestion.order }, {
      subject: oldQuestion.subject,
      phase: oldQuestion.phase,
      material: oldQuestion.material,
      quizToken: oldQuestion.quizToken,
      typeCounts: {},
      levelCounts: {}
    });

    return { ...normalized, quizToken: oldQuestion.quizToken };
  } catch (error) {
    throw new Error("Gagal meregenerasi soal.");
  }
};

export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Create a high quality, clear educational illustration for a test question: ${prompt}` }],
      },
    });

    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString: string = part.inlineData.data;
          return `data:image/png;base64,${base64EncodeString}`;
        }
      }
    }
    return "";
  } catch (error) { 
    return ""; 
  }
};
