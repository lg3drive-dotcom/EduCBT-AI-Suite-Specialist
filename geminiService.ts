
import { GoogleGenAI, Type } from "@google/genai";
import { EduCBTQuestion, GenerationConfig, QuestionType } from "./types";

const SYSTEM_INSTRUCTION = `
Persona: Pakar Kurikulum Nasional (AKM/HOTS) & Pengembang Sistem EduCBT Pro.
Tugas: Membuat soal evaluasi berkualitas tinggi dalam format JSON array yang VALID dan VARIATIF.

### ATURAN TIAP TIPE SOAL (WAJIB DIPATUHI) ###
1. Pilihan Ganda: 
   - 'type': "Pilihan Ganda"
   - 'correctAnswer': Integer (0-4) sebagai indeks.
2. Pilihan Jamak (MCMA):
   - 'type': "Pilihan Jamak (MCMA)"
   - 'correctAnswer': Array of Integer (indeks yang benar).
3. Pilihan Ganda Kompleks:
   - 'type': "Pilihan Ganda Kompleks"
   - 'correctAnswer': Array of Boolean (true/false) sepanjang jumlah opsi.
4. Pilihan Ganda Kompleks (B/S):
   - 'type': "Pilihan Ganda Kompleks (B/S)"
   - 'correctAnswer': Array of Boolean.
   - 'tfLabels': {"true": "Benar", "false": "Salah"} atau preset lain yang relevan.
5. ISIAN:
   - 'type': "ISIAN"
   - 'options': [] (kosong)
   - 'correctAnswer': String jawaban singkat.
6. URAIAN:
   - 'type': "URAIAN"
   - 'options': [] (kosong)
   - 'correctAnswer': String penjelasan kunci.

### INSTRUKSI TEKNIS ###
- Field 'type' HARUS sama persis dengan nama tipe di atas.
- JANGAN gunakan Markdown (**, *) atau HTML.
- Gunakan teks polos (Plain Text).
- Pembahasan harus singkat, padat, dan mencakup logika kenapa kunci tersebut benar.
- JANGAN membulatkan semua tipe menjadi Pilihan Ganda. Jika diminta Kompleks, buat Kompleks.
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
    correctAnswer: { type: Type.STRING, description: "Bisa berupa index angka, array angka, array boolean, atau string" },
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

  // Prompt dibuat jauh lebih eksplisit tentang pembagian tipe
  const prompt = `BUAT TOTAL ${total} SOAL untuk ${config.subject}.
  
### PEMBAGIAN TIPE WAJIB (STRICT):
${requestedTypes}

### KONTEKS:
Materi: ${config.material}
Fase: ${config.phase}
Token: ${config.quizToken}
${config.specialInstructions ? `Catatan Tambahan: ${config.specialInstructions}` : ''}
${config.referenceText ? `Referensi Teks: ${config.referenceText.substring(0, 4000)}` : ''}

### PERINTAH:
Hasilkan soal dengan variasi tipe DI ATAS. JANGAN buat semuanya menjadi Pilihan Ganda.
Pastikan format 'correctAnswer' sesuai dengan tipenya (Index, Array Index, atau Array Boolean).`;

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
    const msg = (error?.message || "").toLowerCase();
    if (msg.includes("quota") || msg.includes("429")) {
      throw new Error("Kapasitas AI sedang penuh. Harap tunggu sebentar.");
    }
    throw new Error("Gagal generate soal. Pastikan instruksi tidak melanggar kebijakan konten.");
  }
};

const normalizeQuestion = (q: any, config: any): EduCBTQuestion => {
  let type = q.type;
  let correctedAnswer = q.correctAnswer;
  
  // Kecerdasan Buatan untuk mendeteksi tipe yang salah label namun isinya benar
  if (Array.isArray(correctedAnswer)) {
    if (typeof correctedAnswer[0] === 'boolean' && !type.includes('Kompleks')) {
       type = QuestionType.KompleksBS;
    } else if (typeof correctedAnswer[0] === 'number' && type === QuestionType.PilihanGanda) {
       type = QuestionType.MCMA;
    }
  }

  // Parsing string ke data asli jika AI mengirim string JSON
  if (typeof correctedAnswer === 'string') {
    const trimmed = correctedAnswer.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try { correctedAnswer = JSON.parse(trimmed); } catch(e) {}
    } else if (trimmed.toLowerCase() === 'true') { correctedAnswer = true; }
    else if (trimmed.toLowerCase() === 'false') { correctedAnswer = false; }
    else if (!isNaN(parseInt(trimmed)) && type === QuestionType.PilihanGanda) { 
      correctedAnswer = parseInt(trimmed); 
    }
  }

  // Final check untuk Pilihan Ganda (Harus angka)
  if (type === QuestionType.PilihanGanda && typeof correctedAnswer !== 'number') {
    correctedAnswer = Array.isArray(correctedAnswer) ? (correctedAnswer[0] ?? 0) : parseInt(correctedAnswer as any) || 0;
  }

  // Final check untuk Kompleks BS
  if (type === QuestionType.KompleksBS) {
    if (!Array.isArray(correctedAnswer)) correctedAnswer = q.options?.map(() => false) || [];
    correctedAnswer = (correctedAnswer as any[]).map(val => val === true || val === "true" || val === 1 || val === "B" || val === "Benar");
    if (!q.tfLabels) q.tfLabels = { "true": "Benar", "false": "Salah" };
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
  const prompt = `Hasilkan PEMBAHASAN SINGKAT untuk soal berikut:
  SOAL: "${q.text}"
  KUNCI: ${JSON.stringify(q.correctAnswer)}
  TIPE: ${q.type}`;

  try {
    const response = await smartGeminiCall({
      contents: prompt,
      config: {
        systemInstruction: "Berikan penjelasan logis 1-2 kalimat saja dalam teks polos."
      }
    });
    return cleanFormatting(response.text || "");
  } catch (err) {
    return "Pembahasan belum tersedia.";
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
