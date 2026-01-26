
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

/**
 * Enhanced API Caller with Fallback and Retry
 */
async function smartGeminiCall(payload: any, maxRetries = 3) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let lastError: any;
  
  // Model priorities
  const models = ['gemini-3-pro-preview', 'gemini-3-flash-preview'];

  for (const modelName of models) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`Calling ${modelName}... (Attempt ${i + 1})`);
        const response = await ai.models.generateContent({
          ...payload,
          model: modelName
        });
        return response;
      } catch (error: any) {
        lastError = error;
        const msg = (error?.message || "").toLowerCase();
        
        // If it's a quota error (429) or overloaded (503/429)
        if (msg.includes("quota") || msg.includes("429") || msg.includes("overloaded") || msg.includes("limit")) {
          const wait = Math.pow(2, i) * 3000;
          console.warn(`Quota hit on ${modelName}. Waiting ${wait}ms...`);
          await new Promise(r => setTimeout(r, wait));
          continue; // Try next retry for the SAME model
        }
        
        // If it's another error, stop retrying this model
        break;
      }
    }
    // If we reach here, the current model failed all retries, move to next model (Flash)
    console.warn(`${modelName} failed after all retries. Switching to fallback...`);
  }

  throw lastError || new Error("Semua model Gemini sedang sibuk atau mencapai batas kuota.");
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
    throw new Error("Gagal memproses permintaan. Server Gemini sedang sangat sibuk (Quota Exceeded). Silakan coba lagi dalam 1-2 menit.");
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
    throw new Error("Gagal mengubah tipe soal karena batasan kuota API.");
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
    throw new Error("Gagal meregenerasi soal karena batasan kuota API.");
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
    const response = await smartGeminiCall({
      contents: { parts: [{ text: `High quality educational illustration: ${prompt}` }] }
    });
    const imgPart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
    return imgPart?.inlineData ? `data:image/png;base64,${imgPart.inlineData.data}` : "";
  } catch (error) { return ""; }
};
