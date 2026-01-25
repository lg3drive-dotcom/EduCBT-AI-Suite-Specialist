
import { GoogleGenAI, Type } from "@google/genai";
import { EduCBTQuestion, GenerationConfig, QuestionType } from "./types";

const SYSTEM_INSTRUCTION = `
Persona: pakar kurikulum Indonesia & pengembang EduCBT.
Tugas: Buat soal AKM/HOTS dalam JSON array yang valid.

Field Utama yang WAJIB ada:
1. "text": Narasi atau pertanyaan soal (JANGAN GUNAKAN FIELD 'question').
2. "options": Array string pilihan jawaban (minimal 4 untuk PG, minimal 3 untuk Kompleks B/S).
3. "correctAnswer": Indeks jawaban benar (0-n), atau array sesuai tipe.
4. "type": Tipe soal.
5. "level": Level kognitif (L1, L2, atau L3).
6. "explanation": Penjelasan rinci.
7. "tfLabels": (Hanya untuk tipe 'Pilihan Ganda Kompleks (B/S)') Objek berisi {"true": "Benar", "false": "Salah"} atau variasi lainnya.

### ATURAN KHUSUS TIPE "Pilihan Ganda Kompleks (B/S)" ###
- "options": Array berisi daftar pernyataan yang harus dievaluasi (minimal 3, maksimal 5).
- "correctAnswer": Array boolean [true, false, ...] yang urutannya sesuai dengan "options".
- "tfLabels": Objek wajib berisi {"true": "...", "false": "..."}.
  - Gunakan "true": "Benar", "false": "Salah" (untuk pernyataan fakta).
  - Gunakan "true": "Sesuai", "false": "Tidak Sesuai" (untuk analisis stimulus).
  - Gunakan "true": "Fakta", "false": "Opini" (untuk soal literasi).

Contoh JSON Valid untuk Kompleks B/S:
{
  "text": "Berdasarkan stimulus di atas, tentukan kesesuaian pernyataan berikut!",
  "type": "Pilihan Ganda Kompleks (B/S)",
  "options": ["Suhu meningkat pada pukul 12:00", "Suhu terendah terjadi di malam hari"],
  "correctAnswer": [true, false],
  "tfLabels": {"true": "Sesuai", "false": "Tidak Sesuai"},
  "explanation": "Penjelasan detail mengapa pernyataan tersebut sesuai atau tidak."
}
`;

const SINGLE_QUESTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING },
    level: { type: Type.STRING },
    text: { type: Type.STRING },
    explanation: { type: Type.STRING },
    options: { type: Type.ARRAY, items: { type: Type.STRING } },
    correctAnswer: { 
      type: Type.STRING, 
      description: "Untuk PG: indeks (0-n). Untuk Jamak: array indeks [0,1]. Untuk B/S: array boolean stringified [true, false]." 
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
  required: ["type", "level", "text", "options", "correctAnswer", "explanation"]
};

const QUESTIONS_ARRAY_SCHEMA = {
  type: Type.ARRAY,
  items: SINGLE_QUESTION_SCHEMA
};

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
  ${config.referenceText ? `Referensi: ${config.referenceText.substring(0, 3000)}` : ''}
  ${config.specialInstructions ? `Instruksi Tambahan: ${config.specialInstructions}` : ''}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: QUESTIONS_ARRAY_SCHEMA
      }
    });

    const parsed = JSON.parse(response.text || "[]");
    return parsed.map((q: any) => normalizeQuestion(q, config));
  } catch (error) {
    console.error("Generation error:", error);
    throw error;
  }
};

export const changeQuestionType = async (oldQuestion: EduCBTQuestion, newType: QuestionType): Promise<EduCBTQuestion> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `TUGAS: UBAH TIPE SOAL INI.
  TEKS SOAL ASLI: "${oldQuestion.text}"
  TIPE ASLI: ${oldQuestion.type}
  TIPE BARU YANG DIMINTA: ${newType}
  
  INSTRUKSI:
  1. Pertahankan teks soal asli semaksimal mungkin.
  2. Rancang ulang "options" dan "correctAnswer" agar sesuai dengan format ${newType}.
  3. Jika format baru adalah Pilihan Jamak/MCMA, buat minimal 2 jawaban benar.
  4. Jika format baru adalah Pilihan Ganda Kompleks (B/S), buat minimal 3 pernyataan di options, correctAnswer berupa array boolean, dan sertakan tfLabels (Benar/Salah, Sesuai/Tidak Sesuai, atau Fakta/Opini).
  5. Jika format baru adalah Isian/Uraian, kosongkan "options" dan berikan kunci jawaban yang sesuai di "correctAnswer".
  6. Perbarui "explanation" agar relevan dengan kunci jawaban baru.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: SINGLE_QUESTION_SCHEMA
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return normalizeQuestion({ 
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
  } catch (error) {
    console.error("Type Change Error:", error);
    throw error;
  }
};

export const regenerateSingleQuestion = async (oldQuestion: EduCBTQuestion, customInstructions?: string): Promise<EduCBTQuestion> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Buat 1 soal PENGGANTI yang baru.
  KONTEKS AWAL:
  - Materi: ${oldQuestion.material}
  - Tipe: ${oldQuestion.type}
  - Level: ${oldQuestion.level}
  - Mapel: ${oldQuestion.subject} (${oldQuestion.phase})

  ${customInstructions ? `INSTRUKSI PERBAIKAN KHUSUS DARI PENGGUNA: "${customInstructions}"` : 'Buat soal baru yang lebih berkualitas dan menantang (HOTS) dibandingkan soal sebelumnya.'}
  
  Pastikan tetap dalam format JSON yang valid.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: SINGLE_QUESTION_SCHEMA
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return normalizeQuestion({ ...parsed, id: oldQuestion.id, order: oldQuestion.order }, {
      subject: oldQuestion.subject,
      phase: oldQuestion.phase,
      material: oldQuestion.material,
      quizToken: oldQuestion.quizToken,
      typeCounts: {},
      levelCounts: {}
    });
  } catch (error) {
    console.error("Regeneration error:", error);
    throw error;
  }
};

const normalizeQuestion = (q: any, config: any): EduCBTQuestion => {
  let correctedAnswer = q.correctAnswer;
  
  if (typeof correctedAnswer === 'string') {
    if (correctedAnswer.startsWith('[') || correctedAnswer.startsWith('{')) {
      try { correctedAnswer = JSON.parse(correctedAnswer); } catch(e) {}
    } else if (correctedAnswer.toLowerCase() === 'true') {
      correctedAnswer = true;
    } else if (correctedAnswer.toLowerCase() === 'false') {
      correctedAnswer = false;
    }
  }

  if (q.type === QuestionType.PilihanGanda && typeof correctedAnswer !== 'number') {
    correctedAnswer = parseInt(correctedAnswer) || 0;
  }

  if (q.type === QuestionType.KompleksBS) {
    if (!Array.isArray(correctedAnswer)) {
      correctedAnswer = q.options.map(() => false);
    }
    if (!q.tfLabels) {
      q.tfLabels = { "true": "Benar", "false": "Salah" };
    }
  }

  return {
    ...q,
    id: q.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    text: q.text || q.question || "Teks soal tidak ter-generate.",
    correctAnswer: correctedAnswer,
    subject: config.subject,
    phase: config.phase,
    quizToken: config.quizToken,
    material: config.material,
    isDeleted: false,
    createdAt: q.createdAt || Date.now(),
    order: q.order || 1
  };
};

export const generateImage = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `High quality educational vector illustration: ${prompt}` }] }
    });
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return imgPart?.inlineData ? `data:image/png;base64,${imgPart.inlineData.data}` : "";
  } catch (error) { return ""; }
};
