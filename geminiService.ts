
import { GoogleGenAI, Type } from "@google/genai";
import { EduCBTQuestion, GenerationConfig, QuestionType } from "./types";

const SYSTEM_INSTRUCTION = `
Persona: pakar kurikulum Indonesia & pengembang EduCBT.
Tugas: Buat soal AKM/HOTS dalam JSON array yang valid.

### STANDAR OUTPUT JSON EDU-CBT PRO ###

Setiap response WAJIB berupa ARRAY JSON. Gunakan standar value berikut:

1. "type": WAJIB menggunakan salah satu string ini:
   - "Pilihan Ganda"
   - "Pilihan Jamak (MCMA)"
   - "Pilihan Ganda Kompleks"
   - "Pilihan Ganda Kompleks (B/S)"

2. "level": Gunakan kode ringkas ini:
   - "L1" (Pengetahuan/Pemahaman)
   - "L2" (Aplikasi)
   - "L3" (Penalaran/HOTS)

3. "correctAnswer":
   - Jika "Pilihan Ganda": Berikan angka index (contoh: 0 atau 1 atau 2).
   - Jika "Pilihan Jamak (MCMA)": Berikan array index (contoh: [0, 2]).
   - Jika tipe Kompleks (B/S): Berikan array boolean (contoh: [true, false, true]).

4. "tfLabels": (WAJIB untuk tipe B/S)
   - Contoh: {"true": "Benar", "false": "Salah"} atau {"true": "Sesuai", "false": "Tidak Sesuai"}.

5. "quizToken": Masukkan kode paket (Uppercase).

6. "material": Masukkan indikator soal atau ringkasan materi.

7. "explanation": Masukkan pembahasan kunci jawaban yang mendalam.

8. "order": Nomor urut soal (Integer).

### ATURAN FORMAT TEKS (PENTING!) ###
- JANGAN GUNAKAN TAG HTML (seperti <p>, <br/>, <strong>, <b>, <i>, dll).
- Gunakan TEKS BIASA (Plain Text). 
- Untuk pemformatan baris baru, gunakan karakter newline (\n) standar.
- Pastikan teks bersih dari kode-kode pemrograman atau tag web.

### ATURAN KHUSUS TIPE "Pilihan Ganda Kompleks (B/S)" ###
- "options": Array berisi daftar pernyataan yang harus dievaluasi (minimal 3, maksimal 5).
- "correctAnswer": Array boolean [true, false, ...] yang urutannya sesuai dengan "options".
- "tfLabels": Objek wajib berisi {"true": "...", "false": "..."}.

JANGAN gunakan field 'question', gunakan 'text'. JANGAN sertakan markdown code block di luar JSON string.
`;

const SINGLE_QUESTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING },
    level: { type: Type.STRING },
    text: { 
      type: Type.STRING,
      description: "Teks soal dalam format PLAIN TEXT. Tanpa tag HTML."
    },
    explanation: { 
      type: Type.STRING,
      description: "Penjelasan dalam format PLAIN TEXT. Tanpa tag HTML."
    },
    material: { type: Type.STRING },
    quizToken: { type: Type.STRING },
    order: { type: Type.INTEGER },
    options: { type: Type.ARRAY, items: { type: Type.STRING } },
    correctAnswer: { 
      type: Type.STRING, 
      description: "PG: 0-n. MCMA: [0,1]. B/S: [true, false]." 
    },
    tfLabels: {
      type: Type.OBJECT,
      properties: {
        true: { type: Type.STRING },
        false: { type: Type.STRING }
      },
      required: ["true", "false"]
    }
  },
  required: ["type", "level", "text", "options", "correctAnswer", "explanation", "material", "quizToken", "order"]
};

const QUESTIONS_ARRAY_SCHEMA = {
  type: Type.ARRAY,
  items: SINGLE_QUESTION_SCHEMA
};

/**
 * Utility function to handle API calls with exponential backoff for 429/500 errors
 */
async function callGeminiWithRetry(fn: () => Promise<any>, maxRetries = 3): Promise<any> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || "";
      const isQuotaError = errorMessage.toLowerCase().includes("quota") || errorMessage.includes("429");
      const isServerError = errorMessage.includes("500") || errorMessage.includes("503");

      if (isQuotaError || isServerError) {
        const waitTime = Math.pow(2, i) * 2000; // 2s, 4s, 8s
        console.warn(`Gemini API Quota/Server error. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export const generateEduCBTQuestions = async (config: GenerationConfig): Promise<EduCBTQuestion[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const typeRequirements = Object.entries(config.typeCounts)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => `${count} soal ${type}`)
    .join(', ');

  const levelRequirements = Object.entries(config.levelCounts)
    .filter(([_, count]) => count > 0)
    .map(([level, count]) => `${count} level ${level}`)
    .join(', ');

  const totalQuestionsCount = (Object.values(config.typeCounts) as number[]).reduce((a, b) => a + b, 0);

  const prompt = `Buat ${totalQuestionsCount} soal ${config.subject} (${config.phase}). 
  Materi: ${config.material}. Komposisi: ${typeRequirements} & ${levelRequirements}. Token: ${config.quizToken}.
  ${config.referenceText ? `Referensi Stimulus: ${config.referenceText.substring(0, 3000)}` : ''}
  ${config.specialInstructions ? `Instruksi Tambahan: ${config.specialInstructions}` : ''}
  INGAT: Output 'text' dan 'explanation' harus PLAIN TEXT murni, dilarang ada tag HTML <p>, <br>, dll.`;

  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: QUESTIONS_ARRAY_SCHEMA
      }
    }));

    const parsed = JSON.parse(response.text || "[]");
    return parsed.map((q: any) => normalizeQuestion(q, config));
  } catch (error: any) {
    if (error?.message?.includes("quota")) {
      throw new Error("Batas penggunaan (Quota) tercapai. Silakan tunggu 1 menit lalu coba lagi.");
    }
    throw error;
  }
};

export const changeQuestionType = async (oldQuestion: EduCBTQuestion, newType: QuestionType): Promise<EduCBTQuestion> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `TUGAS: UBAH TIPE SOAL INI.
  TOKEN HARUS TETAP: ${oldQuestion.quizToken}
  TEKS SOAL ASLI: "${oldQuestion.text}"
  TIPE ASLI: ${oldQuestion.type}
  TIPE BARU YANG DIMINTA: ${newType}
  
  INSTRUKSI:
  1. Pertahankan teks soal asli semaksimal mungkin dalam format PLAIN TEXT.
  2. Rancang ulang "options" dan "correctAnswer" agar sesuai dengan format ${newType}.
  3. Gunakan "quizToken": "${oldQuestion.quizToken}" dalam output JSON.`;

  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: SINGLE_QUESTION_SCHEMA
      }
    }));

    const parsed = JSON.parse(response.text || "{}");
    const normalized = normalizeQuestion({ 
      ...parsed, 
      id: oldQuestion.id, 
      order: oldQuestion.order,
      type: newType 
    }, {
      subject: oldQuestion.subject,
      phase: oldQuestion.phase,
      material: oldQuestion.material,
      quizToken: oldQuestion.quizToken,
      typeCounts: {},
      levelCounts: {}
    });

    return { ...normalized, quizToken: oldQuestion.quizToken };
  } catch (error) {
    console.error("Type Change Error:", error);
    throw error;
  }
};

export const regenerateSingleQuestion = async (oldQuestion: EduCBTQuestion, customInstructions?: string): Promise<EduCBTQuestion> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Buat 1 soal PENGGANTI yang baru dalam format PLAIN TEXT.
  TOKEN HARUS TETAP: ${oldQuestion.quizToken}
  KONTEKS AWAL:
  - Materi: ${oldQuestion.material}
  - Tipe: ${oldQuestion.type}
  - Level: ${oldQuestion.level}
  - Mapel: ${oldQuestion.subject} (${oldQuestion.phase})

  ${customInstructions ? `INSTRUKSI PERBAIKAN KHUSUS: "${customInstructions}"` : 'Buat soal baru yang lebih berkualitas.'}
  
  PENTING: Gunakan "quizToken": "${oldQuestion.quizToken}" dalam output JSON.`;

  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: SINGLE_QUESTION_SCHEMA
      }
    }));

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
    console.error("Regeneration error:", error);
    throw error;
  }
};

const normalizeQuestion = (q: any, config: any): EduCBTQuestion => {
  let correctedAnswer = q.correctAnswer;
  
  if (typeof correctedAnswer === 'string') {
    const trimmed = correctedAnswer.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try { 
        correctedAnswer = JSON.parse(trimmed); 
      } catch(e) {
        if (q.type === QuestionType.KompleksBS) {
           correctedAnswer = trimmed.replace(/[\[\]]/g, '').split(',').map(s => s.trim().toLowerCase() === 'true');
        }
      }
    } else if (trimmed.toLowerCase() === 'true') {
      correctedAnswer = true;
    } else if (trimmed.toLowerCase() === 'false') {
      correctedAnswer = false;
    } else if (!isNaN(parseInt(trimmed))) {
      correctedAnswer = parseInt(trimmed);
    }
  }

  if (q.type === QuestionType.PilihanGanda && typeof correctedAnswer !== 'number') {
    correctedAnswer = Array.isArray(correctedAnswer) ? (correctedAnswer[0] ?? 0) : parseInt(correctedAnswer as any) || 0;
  }

  if (q.type === QuestionType.KompleksBS) {
    if (!Array.isArray(correctedAnswer)) {
      correctedAnswer = q.options?.map(() => false) || [];
    }
    correctedAnswer = (correctedAnswer as any[]).map(val => val === true || val === "true");
    
    if (!q.tfLabels) {
      q.tfLabels = { "true": "Benar", "false": "Salah" };
    }
  }

  if (q.type === QuestionType.MCMA && !Array.isArray(correctedAnswer)) {
    correctedAnswer = [parseInt(correctedAnswer as any) || 0];
  }

  const finalQuizToken = (q.quizToken || config.quizToken || "").toString().toUpperCase();

  const cleanHtml = (str: string) => {
    return str.replace(/<[^>]*>?/gm, '');
  };

  return {
    ...q,
    id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    text: cleanHtml(q.text || q.question || "Teks soal tidak ter-generate."),
    explanation: cleanHtml(q.explanation || ""),
    correctAnswer: correctedAnswer,
    subject: q.subject || config.subject,
    phase: q.phase || config.phase,
    quizToken: finalQuizToken,
    material: q.material || config.material,
    isDeleted: false,
    createdAt: q.createdAt || Date.now(),
    order: q.order || 1
  };
};

export const generateImage = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `High quality educational vector illustration: ${prompt}` }] }
    }));
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return imgPart?.inlineData ? `data:image/png;base64,${imgPart.inlineData.data}` : "";
  } catch (error) { return ""; }
};
