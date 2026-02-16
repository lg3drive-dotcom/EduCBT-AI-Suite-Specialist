
import { GoogleGenAI, Type } from "@google/genai";
import { EduCBTQuestion, GenerationConfig, QuestionType } from "./types";

const SYSTEM_INSTRUCTION = `
Persona: Pakar Kurikulum Nasional (Bloom/HOTS) & Pengembang Sistem EduCBT Pro.
Tugas: Membuat soal evaluasi berkualitas tinggi dalam format JSON array yang VALID, VARIATIF, dan KONSISTENsecara Logis.

### DUKUNGAN FORMAT (HTML & LATEX) ###
- Anda diperbolehkan dan DISARANKAN menggunakan tag HTML dasar untuk pemformatan teks pada field 'text' dan 'explanation' (contoh: <b>teks</b>, <i>teks</i>, <u>teks</u>, <br>, <ul><li>item</li></ul>).
- Untuk rumus matematika, gunakan LaTeX dengan pembungkus single dollar sign ($...$).

### ATURAN LEVEL KOGNITIF (STRICT - CASE SENSITIVE) ###
- Field 'level' WAJIB diisi secara eksak: "C1 Mengingat", "C2 Memahami", "C3 Menerapkan", "C4 Menganalisis", "C5 Mengevaluasi", atau "C6 Mencipta".
- Pemetaan Input: L1 -> C1/C2, L2 -> C3, L3 -> C4/C5/C6.

### VALIDASI KUNCI JAWABAN (SANGAT PENTING) ###
Anda harus memastikan KUNCI JAWABAN sinkron 100% dengan PEMBAHASAN.
1. (Benar/Salah) & (Sesuai/Tidak Sesuai): 
   - 'correctAnswer' HARUS berupa Array of Boolean [true, false, ...].
   - Panjang array HARUS sama dengan jumlah item di 'options'.
   - JANGAN memberikan nilai seragam (semua false atau semua true) kecuali jika soal memang menuntut demikian. Periksa setiap pernyataan satu per satu.
2. Pilihan Jamak (MCMA):
   - 'correctAnswer' HARUS berupa Array of Integer (indeks 0, 1, 2...).
   - Minimal ada 2 jawaban benar.
3. Pilihan Ganda: 'correctAnswer' adalah Integer tunggal (0-4).

### DAFTAR TIPE SOAL ###
- "Pilihan Ganda"
- "Pilihan Jamak (MCMA)"
- "(Benar/Salah)"
- "(Sesuai/Tidak Sesuai)"
- "ISIAN"
- "URAIAN"
`;

const VALID_LEVELS = [
  "C1 Mengingat",
  "C2 Memahami",
  "C3 Menerapkan",
  "C4 Menganalisis",
  "C5 Mengevaluasi",
  "C6 Mencipta"
];

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
      correctAnswer: { type: Type.STRING, description: "Bisa berupa integer, array of integer, array of boolean, atau string tergantung tipe soal." },
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

async function smartGeminiCall(payload: any, maxRetries = 4) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let lastError: any;
  const models = ['gemini-3-pro-preview', 'gemini-3-flash-preview'];

  for (const modelName of models) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await ai.models.generateContent({
          ...payload,
          model: modelName,
          config: {
            ...payload.config,
            thinkingConfig: modelName.includes('pro') ? { thinkingBudget: 4000 } : undefined
          }
        });
        return response;
      } catch (error: any) {
        lastError = error;
        await new Promise(r => setTimeout(r, (i + 1) * 2000));
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

  const requestedLevels = Object.entries(config.levelCounts)
    .filter(([_, count]) => count > 0)
    .map(([level, count]) => `- ${level}: ${count} SOAL`)
    .join('\n');

  const total = (Object.values(config.typeCounts) as number[]).reduce((a, b) => a + b, 0);

  const textPrompt = `BUAT TOTAL ${total} SOAL untuk ${config.subject}.
  Materi: ${config.material}
  Fase: ${config.phase}
  Token: ${config.quizToken}
  
### PEMBAGIAN TIPE SOAL:
${requestedTypes}

### PEMBAGIAN LEVEL KOGNITIF (Input Guru):
${requestedLevels}

### KONTEKS REFERENSI TEKS:
${config.referenceTexts.join("\n\n--- DOKUMEN LAIN ---\n\n")}

Lakukan verifikasi silang: Pastikan 'correctAnswer' benar-benar mencerminkan kebenaran yang dijelaskan di 'explanation'.`;

  const parts: any[] = [{ text: textPrompt }];
  
  config.referenceImages.forEach(img => {
    parts.push({
      inlineData: { data: img.data, mimeType: img.mimeType }
    });
  });

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
    throw new Error("Gagal generate soal.");
  }
};

export const extractQuestionsFromMedia = async (config: GenerationConfig): Promise<EduCBTQuestion[]> => {
  const prompt = `PINDAI SEMUA SOAL dari media terlampir. Dukung pemformatan HTML jika teks asli memiliki format tebal/miring. Pastikan level kognitif sesuai standar C1-C6.`;
  const parts: any[] = [{ text: prompt }];
  config.referenceImages.forEach(img => parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } }));
  config.referenceTexts.forEach(txt => parts.push({ text: txt }));

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
  } catch (error) { throw new Error("Gagal ekstraksi."); }
};

export const analyzeCognitiveLevel = async (q: EduCBTQuestion): Promise<string> => {
  const prompt = `Tentukan level kognitif (C1-C6 + Deskripsi) untuk soal ini: ${q.text}`;
  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: prompt }] },
      config: { systemInstruction: "Hanya balas dengan label eksak." }
    });
    const result = response.text?.trim() || "C1 Mengingat";
    return VALID_LEVELS.includes(result) ? result : "C1 Mengingat";
  } catch { return q.level; }
};

export const convertTextToLatex = async (text: string): Promise<string> => {
  if (!text.trim()) return "";
  const prompt = `Ubah ekspresi matematika ke LaTeX: ${text}`;
  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: prompt }] },
      config: { systemInstruction: "Pakar LaTeX." }
    });
    return response.text?.trim() || text;
  } catch { return text; }
};

const normalizeQuestion = (q: any, config: any): EduCBTQuestion => {
  let type = q.type;
  let correctedAnswer = q.correctAnswer;
  const options = Array.isArray(q.options) ? q.options : [];
  const optionsCount = options.length;

  // Normalisasi Level
  let level = q.level || "C1 Mengingat";
  if (!VALID_LEVELS.includes(level)) {
    if (level.includes("C1")) level = "C1 Mengingat";
    else if (level.includes("C2")) level = "C2 Memahami";
    else if (level.includes("C3")) level = "C3 Menerapkan";
    else if (level.includes("C4")) level = "C4 Menganalisis";
    else if (level.includes("C5")) level = "C5 Mengevaluasi";
    else if (level.includes("C6")) level = "C6 Mencipta";
    else level = "C1 Mengingat";
  }

  // Koreksi Tipe Kunci Jawaban jika AI mengirimkan Stringified JSON
  if (typeof correctedAnswer === 'string' && (correctedAnswer.startsWith('[') || correctedAnswer.startsWith('{'))) {
    try { correctedAnswer = JSON.parse(correctedAnswer); } catch(e) {}
  }

  if (type === QuestionType.BenarSalah || type === QuestionType.SesuaiTidakSesuai) {
    q.tfLabels = type === QuestionType.BenarSalah ? { "true": "Benar", "false": "Salah" } : { "true": "Sesuai", "false": "Tidak Sesuai" };
    if (!Array.isArray(correctedAnswer)) {
        correctedAnswer = new Array(optionsCount).fill(false);
    } else {
        // Pastikan isi array adalah boolean, bukan string "true"/"false"
        correctedAnswer = correctedAnswer.map(v => v === true || v === 'true' || String(v).toLowerCase() === 'benar' || String(v).toLowerCase() === 'sesuai');
    }
  } else if (type === QuestionType.MCMA) {
    if (!Array.isArray(correctedAnswer)) {
        correctedAnswer = [0];
    } else {
        correctedAnswer = correctedAnswer.map(v => parseInt(v)).filter(v => !isNaN(v));
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
    text: q.text || "",
    explanation: q.explanation || "",
    correctAnswer: correctedAnswer,
    options: options,
    subject: config.subject,
    phase: config.phase,
    quizToken: (q.quizToken || config.quizToken || "AUTO").toString().toUpperCase(),
    material: q.material || config.material,
    level: level,
    isDeleted: false,
    createdAt: Date.now(),
    order: q.order || 1,
    tfLabels: q.tfLabels
  };
};

export const generateExplanationForQuestion = async (q: any): Promise<string> => {
  const prompt = `Berikan penjelasan logis dalam format HTML/LaTeX untuk soal ini: ${JSON.stringify(q)}`;
  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: prompt }] },
      config: { systemInstruction: "Pakar pedagogi. Gunakan format HTML/LaTeX." }
    });
    return response.text?.trim() || "Penjelasan tidak tersedia.";
  } catch { return "Gagal generate pembahasan."; }
};

export const regenerateSingleQuestion = async (q: EduCBTQuestion, instructions?: string): Promise<EduCBTQuestion> => {
  const prompt = `Revisi soal ini: ${JSON.stringify(q)}\nInstruksi: ${instructions || "Perbaiki kualitas dan pastikan kunci jawaban tepat."}`;
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
  } catch { return q; }
};
