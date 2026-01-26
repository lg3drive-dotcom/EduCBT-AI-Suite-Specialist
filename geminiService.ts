
import { GoogleGenAI, Type } from "@google/genai";
import { EduCBTQuestion, GenerationConfig, QuestionType } from "./types";

const SYSTEM_INSTRUCTION = `
Persona: Pakar Kurikulum Nasional & Pengembang Sistem EduCBT Pro.
Tugas: Membuat atau memperbaiki soal evaluasi pendidikan dalam format JSON array.

### ATURAN ANALISIS (SMART REPAIR) ###
Jika Anda menerima soal dengan kolom kosong (Materi, Level, Pembahasan):
1. MATERI: Dapatkan topik spesifik dari teks soal (Contoh: "Fotosintesis", "Persamaan Kuadrat").
2. LEVEL: 
   - L1: Mengingat/Memahami (Faktual).
   - L2: Menerapkan (Prosedural).
   - L3: Menganalisis/Mengevaluasi (HOTS/Penalaran).
3. PEMBAHASAN: Wajib mendalam, menjelaskan langkah logika menuju jawaban benar. NO HTML.

### STANDAR OUTPUT JSON ###
Setiap response berupa ARRAY JSON dengan field:
- "type": (Pilihan Ganda, Pilihan Jamak (MCMA), Pilihan Ganda Kompleks, Pilihan Ganda Kompleks (B/S), ISIAN, URAIAN)
- "level": (L1, L2, L3)
- "text": Teks soal (Plain Text)
- "material": Materi soal
- "explanation": Pembahasan kunci
- "options": Array string (Kosongkan [] untuk ISIAN/URAIAN)
- "correctAnswer": 
  - PG: index (0,1,...)
  - MCMA: array index ([0,2])
  - B/S: array boolean ([true, false])
  - ISIAN/URAIAN: string jawaban
- "quizToken": Kode paket (Uppercase)
- "order": Nomor urut

JANGAN gunakan tag HTML. Gunakan \n untuk baris baru.
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
      }
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

// Fungsi baru untuk generate pembahasan saja
export const generateExplanationForQuestion = async (q: EduCBTQuestion): Promise<string> => {
  const prompt = `Hasilkan PEMBAHASAN MENDALAM untuk soal berikut:
  SOAL: "${q.text}"
  OPSI: ${JSON.stringify(q.options)}
  KUNCI: ${JSON.stringify(q.correctAnswer)}
  TIPE: ${q.type}
  
  Format jawaban: Berikan hanya teks pembahasan tanpa label "Pembahasan:". NO HTML.`;

  try {
    const response = await smartGeminiCall({
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah pakar edukasi. Berikan penjelasan logis dan mendidik."
      }
    });
    return response.text?.trim() || "";
  } catch (err) {
    throw new Error("Gagal generate pembahasan.");
  }
};

// Fungsi baru untuk analisis level saja
export const analyzeLevelForQuestion = async (q: EduCBTQuestion): Promise<string> => {
  const prompt = `Analisis LEVEL KOGNITIF (L1/L2/L3) soal berikut berdasarkan Taksonomi Bloom:
  SOAL: "${q.text}"
  Format jawaban: Hanya balas dengan "L1", "L2", atau "L3".`;

  try {
    const response = await smartGeminiCall({
      contents: prompt,
      config: {
        systemInstruction: "Balas hanya dengan satu kode level: L1, L2, atau L3."
      }
    });
    const result = response.text?.trim().toUpperCase();
    return ["L1", "L2", "L3"].includes(result || "") ? (result || "L1") : "L1";
  } catch (err) {
    throw new Error("Gagal analisis level.");
  }
};

export const repairQuestions = async (questions: EduCBTQuestion[]): Promise<EduCBTQuestion[]> => {
  const simplified = questions.map(q => ({
    id: q.id,
    type: q.type,
    text: q.text,
    options: q.options,
    material: q.material,
    level: q.level,
    explanation: q.explanation,
    correctAnswer: q.correctAnswer
  }));

  const prompt = `LENGKAPI & PERBAIKI DATA SOAL (SMART REPAIR). 
  Tinjau daftar soal di bawah. Untuk setiap soal:
  1. Jika 'material' berisi "Materi Belum Terisi" atau kosong, tentukan materi yang tepat berdasarkan teks.
  2. Jika 'explanation' (pembahasan) kosong, buatkan penjelasan mendalam.
  3. Validasi 'level' (L1-L3). Sesuaikan dengan kesulitan soal.
  4. Pastikan 'type' sesuai dengan format soal tersebut.

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

    const repairedData = JSON.parse(response.text || "[]");
    
    return questions.map(original => {
      const repaired = repairedData.find((r: any) => 
        r.text === original.text || (r.id && r.id === original.id)
      );

      if (repaired) {
        return {
          ...original,
          material: (!original.material || original.material === "Materi Belum Terisi") ? repaired.material : original.material,
          level: (!original.level || original.level === "L1") ? (repaired.level || "L1") : original.level,
          explanation: !original.explanation ? repaired.explanation : original.explanation,
          type: original.type === "Tipe Tidak Diketahui" ? repaired.type : original.type
        };
      }
      return original;
    });
  } catch (err) {
    console.error("Repair error:", err);
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
    else if (!isNaN(parseInt(trimmed)) && q.type !== QuestionType.Isian && q.type !== QuestionType.Uraian) { 
      correctedAnswer = parseInt(trimmed); 
    }
  }

  if (q.type === QuestionType.PilihanGanda && typeof correctedAnswer !== 'number') {
    correctedAnswer = Array.isArray(correctedAnswer) ? (correctedAnswer[0] ?? 0) : parseInt(correctedAnswer as any) || 0;
  }

  if (q.type === QuestionType.KompleksBS) {
    if (!Array.isArray(correctedAnswer)) correctedAnswer = q.options?.map(() => false) || [];
    correctedAnswer = (correctedAnswer as any[]).map(val => val === true || val === "true" || val === 1);
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
