
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
- JANGAN GUNAKAN TAG HTML (seperti <p>, <br/>, <strong>, <b>, i, dll).
- Gunakan TEKS BIASA (Plain Text). 
- Untuk pemformatan baris baru, gunakan karakter newline (\n) standar.

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

async function smartGeminiCall(payload: any, maxRetries = 3) {
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
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 2000));
          continue;
        }
        break;
      }
    }
  }
  throw lastError || new Error("API Busy");
}

export const generateEduCBTQuestions = async (config: GenerationConfig): Promise<EduCBTQuestion[]> => {
  const typeRequirements = Object.entries(config.typeCounts)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => `${count} soal ${type}`)
    .join(', ');

  const levelRequirements = Object.entries(config.levelCounts)
    .filter(([_, count]) => count > 0)
    .map(([level, count]) => `${count} level ${level}`)
    .join(', ');

  const total = (Object.values(config.typeCounts) as number[]).reduce((a, b) => a + b, 0);

  const prompt = `Buat ${total} soal ${config.subject}. Materi: ${config.material}. 
  Komposisi: ${typeRequirements} & ${levelRequirements}. Token: ${config.quizToken}.
  ${config.referenceText ? `Referensi: ${config.referenceText.substring(0, 3000)}` : ''}
  Output PLAIN TEXT (No HTML).`;

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
    throw new Error("Server Gemini sedang sibuk. Silakan coba lagi.");
  }
};

/**
 * NEW: Repair missing data in questions (Material, Level, Explanation)
 */
export const repairQuestions = async (questions: EduCBTQuestion[]): Promise<EduCBTQuestion[]> => {
  const simplified = questions.map(q => ({
    id: q.id,
    type: q.type,
    text: q.text,
    options: q.options,
    material: q.material,
    level: q.level,
    explanation: q.explanation
  }));

  const prompt = `LENGKAPI DATA KOSONG. 
  Tinjau daftar soal berikut. Jika 'material', 'level', atau 'explanation' kosong atau tidak jelas, silakan isi/perbaiki secara cerdas berdasarkan konteks 'text' dan 'options'. 
  Pastikan level (L1-L3) akurat sesuai taksonomi Bloom. NO HTML.
  DATA: ${JSON.stringify(simplified)}`;

  try {
    const response = await smartGeminiCall({
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: QUESTIONS_ARRAY_SCHEMA
      }
    });

    const repairedData = JSON.parse(response.text || "[]");
    
    // Merge back
    return questions.map(original => {
      const repaired = repairedData.find((r: any) => r.id === original.id);
      if (repaired) {
        return {
          ...original,
          material: original.material || repaired.material,
          level: (original.level && original.level !== "L1") ? original.level : (repaired.level || "L1"),
          explanation: original.explanation || repaired.explanation
        };
      }
      return original;
    });
  } catch (err) {
    throw new Error("Gagal melengkapi data via AI.");
  }
};

export const changeQuestionType = async (oldQuestion: EduCBTQuestion, newType: QuestionType): Promise<EduCBTQuestion> => {
  const prompt = `UBAH TIPE SOAL. TOKEN TETAP: ${oldQuestion.quizToken}
  SOAL: "${oldQuestion.text}"
  TIPE BARU: ${newType}
  GUNAKAN "quizToken": "${oldQuestion.quizToken}" dalam JSON. NO HTML.`;

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
    throw new Error("Gagal mengubah tipe soal.");
  }
};

export const regenerateSingleQuestion = async (oldQuestion: EduCBTQuestion, customInstructions?: string): Promise<EduCBTQuestion> => {
  const prompt = `REGENERASI SOAL. TOKEN TETAP: ${oldQuestion.quizToken}
  MATERI: ${oldQuestion.material}
  ${customInstructions ? `INSTRUKSI: ${customInstructions}` : 'Buat lebih berkualitas.'}
  GUNAKAN "quizToken": "${oldQuestion.quizToken}" dalam JSON. NO HTML.`;

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

const normalizeQuestion = (q: any, config: any): EduCBTQuestion => {
  let correctedAnswer = q.correctAnswer;
  
  if (typeof correctedAnswer === 'string') {
    const trimmed = correctedAnswer.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try { correctedAnswer = JSON.parse(trimmed); } catch(e) {
        if (q.type === QuestionType.KompleksBS) {
           correctedAnswer = trimmed.replace(/[\[\]]/g, '').split(',').map(s => s.trim().toLowerCase() === 'true');
        }
      }
    } else if (trimmed.toLowerCase() === 'true') { correctedAnswer = true; }
    else if (trimmed.toLowerCase() === 'false') { correctedAnswer = false; }
    else if (!isNaN(parseInt(trimmed))) { correctedAnswer = parseInt(trimmed); }
  }

  if (q.type === QuestionType.PilihanGanda && typeof correctedAnswer !== 'number') {
    correctedAnswer = Array.isArray(correctedAnswer) ? (correctedAnswer[0] ?? 0) : parseInt(correctedAnswer as any) || 0;
  }

  if (q.type === QuestionType.KompleksBS) {
    if (!Array.isArray(correctedAnswer)) correctedAnswer = q.options?.map(() => false) || [];
    correctedAnswer = (correctedAnswer as any[]).map(val => val === true || val === "true");
    if (!q.tfLabels) q.tfLabels = { "true": "Benar", "false": "Salah" };
  }

  const finalQuizToken = (q.quizToken || config.quizToken || "").toString().toUpperCase();
  const cleanHtml = (str: string) => (str || "").replace(/<[^>]*>?/gm, '');

  return {
    ...q,
    id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    text: cleanHtml(q.text || q.question),
    explanation: cleanHtml(q.explanation),
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
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Create a high quality, clear educational illustration for a test question: ${prompt}`,
          },
        ],
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
    console.error("Image generation error:", error);
    return ""; 
  }
};
