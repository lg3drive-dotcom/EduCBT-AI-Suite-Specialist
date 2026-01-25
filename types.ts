
export enum QuestionType {
  PilihanGanda = 'Pilihan Ganda',
  MCMA = 'Pilihan Jamak (MCMA)',
  Kompleks = 'Pilihan Ganda Kompleks',
  KompleksBS = 'Pilihan Ganda Kompleks (B/S)',
  Isian = 'ISIAN',
  Uraian = 'URAIAN'
}

export type EduCBTQuestion = {
  id: string;
  type: string;
  level: string;
  subject: string;
  phase: string;
  material: string;
  text: string;
  explanation: string;
  options: string[];
  correctAnswer: number | number[] | boolean[];
  tfLabels?: {
    true: string;
    false: string;
  };
  isDeleted: boolean;
  createdAt: number;
  order: number;
  quizToken: string;
  image?: string; 
  optionImages?: (string | null)[];
  isRegenerating?: boolean;
};

export interface GenerationConfig {
  subject: string;
  phase: string;
  material: string;
  typeCounts: Record<string, number>;
  levelCounts: Record<string, number>;
  quizToken: string;
  referenceText?: string;
  specialInstructions?: string;
}
