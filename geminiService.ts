
import { GoogleGenAI, Type } from "@google/genai";
import { EduCBTQuestion, GenerationConfig, QuestionType } from "./types";

const SYSTEM_INSTRUCTION = `
Persona: Pakar Kurikulum Nasional (Bloom/HOTS) & Pengembang Sistem EduCBT Pro.
Tugas: Membuat soal evaluasi berkualitas tinggi dalam format JSON array yang VALID dan VARIATIF.

### ATURAN LEVEL KOGNITIF (STRICT - CASE SENSITIVE) ###
- Field 'level' WAJIB diisi secara eksak dengan salah satu nilai dari daftar berikut:
  1. "C1 Mengingat"
  2. "C2 Memahami"
  3. "C3 Menerapkan"
  4. "C4 Menganalisis"
  5. "C5 Mengevaluasi"
  6. "C6 Mencipta"
- JANGAN gunakan singkatan (seperti "C1" atau "L1" saja). 
- JANGAN gunakan format lain. Teks harus sama persis termasuk spasi dan huruf besarnya.

### PEMETAAN DARI INPUT USER:
- Jika user meminta "L1" atau "Level 1": Gunakan "C1 Mengingat" atau "C2 Memahami".
- Jika user meminta "L2" atau "Level 2": Gunakan "C3 Menerapkan".
- Jika user meminta "L3" atau "Level 3": Gunakan "C4 Menganalisis", "C5 Mengevaluasi", atau "C6 Mencipta".

### DAFTAR TIPE SOAL (STRICT) ###
1. Pilihan Ganda: 'type': "Pilihan Ganda", 'correctAnswer': Integer (0-4).
2. Pilihan Jamak (MCMA): 'type': "Pilihan Jamak (MCMA)", 'correctAnswer': Array of Integer.
3. (Benar/Salah): 'type': "(Benar/Salah)", 'correctAnswer': Array of Boolean.
4. (Sesuai/Tidak Sesuai): 'type': "(Sesuai/Tidak Sesuai)", 'correctAnswer': Array of Boolean.
5. ISIAN: 'type': "ISIAN", 'correctAnswer': String jawaban singkat.
6. URAIAN: 'type': "URAIAN", 'correctAnswer': String penjelasan kunci.

### ATURAN TEKNIS KRUSIAL ###
- UNTUK TIPE TABEL: 'options' berisi daftar pernyataan, 'correctAnswer' HARUS array boolean dengan panjang yang sama.
- JIKA ada ekspresi matematika, gunakan format LaTeX dengan pembungkus single dollar sign ($...$).
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
      level: { 
        type: Type.STRING,
        description: "Level kognitif wajib eksak: C1 Mengingat, C2 Memahami, C3 Menerapkan, C4 Menganalisis, C5 Mengevaluasi, atau C6 Mencipta." 
      },
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
          model: modelName
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
(Ingat pemetaan L1->C1/C2, L2->C3, L3->C4/C5/C6)

### KONTEKS REFERENSI TEKS:
${config.referenceTexts.join("\n\n--- DOKUMEN LAIN ---\n\n")}

${config.specialInstructions ? `### INSTRUKSI KHUSUS:\n${config.specialInstructions}` : ''}`;

  const parts: any[] = [{ text: textPrompt }];
  
  config.referenceImages.forEach(img => {
    parts.push({
      inlineData: {
        data: img.data,
        mimeType: img.mimeType
      }
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
    throw new Error("Gagal generate soal. Pastikan referensi tidak terlalu besar.");
  }
};

export const extractQuestionsFromMedia = async (config: GenerationConfig): Promise<EduCBTQuestion[]> => {
  const prompt = `PINDAI SEMUA SOAL yang ada pada gambar/dokumen terlampir.
  
  Tugas Anda:
  1. Identifikasi SETIAP soal secara utuh.
  2. Tentukan TIPE SOAL secara otomatis.
  3. Tentukan LEVEL KOGNITIF (C1-C6 Lengkap dengan Deskripsi) secara objektif.
  4. Ambil teks soal, opsi, dan kunci jawaban.
  5. Masukkan ke materi: ${config.material || "Sesuai Dokumen"}.
  6. Gunakan Token: ${config.quizToken || "SCAN-AUTO"}.
  
  Kembalikan dalam format JSON array yang valid sesuai schema.`;

  const parts: any[] = [{ text: prompt }];
  
  config.referenceImages.forEach(img => {
    parts.push({
      inlineData: { data: img.data, mimeType: img.mimeType }
    });
  });
  
  config.referenceTexts.forEach(txt => {
    parts.push({ text: `KONTEN DOKUMEN: ${txt}` });
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
    console.error("Extraction error:", error);
    throw new Error("Gagal mengekstrak soal dari media.");
  }
};

export const analyzeCognitiveLevel = async (q: EduCBTQuestion): Promise<string> => {
  const prompt = `Analisis tingkat kognitif soal berikut dan tentukan level eksaknya dari daftar: [C1 Mengingat, C2 Memahami, C3 Menerapkan, C4 Menganalisis, C5 Mengevaluasi, C6 Mencipta].
  Kembalikan HANYA label level lengkapnya saja (Contoh: C4 Menganalisis).
  Soal: ${q.text}`;
  
  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: "Anda adalah pakar penentu Level Kognitif kurikulum Indonesia. Gunakan standar C1-C6 dengan teks deskripsi lengkap. Balas HANYA label eksak.",
      }
    });
    const result = response.text?.trim() || "C1 Mengingat";
    return VALID_LEVELS.includes(result) ? result : "C1 Mengingat";
  } catch {
    return q.level;
  }
};

export const convertTextToLatex = async (text: string): Promise<string> => {
  if (!text.trim()) return "";
  const prompt = `Ubah semua ekspresi matematika dalam teks berikut menjadi format LaTeX ($...$).\nTeks: ${text}`;
  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: "Anda adalah pakar penulisan rumus matematika LaTeX.",
      }
    });
    return response.text?.trim() || text;
  } catch {
    return text;
  }
};

const normalizeQuestion = (q: any, config: any): EduCBTQuestion => {
  let type = q.type;
  let correctedAnswer = q.correctAnswer;
  const optionsCount = q.options?.length || 4;

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

  if (type === QuestionType.BenarSalah || type === QuestionType.SesuaiTidakSesuai) {
    q.tfLabels = type === QuestionType.BenarSalah ? { "true": "Benar", "false": "Salah" } : { "true": "Sesuai", "false": "Tidak Sesuai" };
    if (!Array.isArray(correctedAnswer)) {
        correctedAnswer = new Array(optionsCount).fill(false);
    }
  } else if (type === QuestionType.MCMA) {
    if (!Array.isArray(correctedAnswer)) {
        correctedAnswer = [0];
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
  const prompt = `Berikan penjelasan logis untuk kunci jawaban soal berikut:\n${JSON.stringify(q)}`;
  try {
    const response = await smartGeminiCall({
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: "Pakar pedagogi.",
      }
    });
    return response.text?.trim() || "Penjelasan tidak tersedia.";
  } catch {
    return "Gagal menghasilkan penjelasan.";
  }
};

export const regenerateSingleQuestion = async (q: EduCBTQuestion, instructions?: string): Promise<EduCBTQuestion> => {
  const prompt = `Revisi soal ini: ${JSON.stringify(q)}\nInstruksi: ${instructions || "Perbaiki kualitas."}`;
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
