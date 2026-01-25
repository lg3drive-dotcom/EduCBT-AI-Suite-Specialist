
export enum QuestionType {
  PilihanGanda = 'Pilihan Ganda',
  MCMA = 'Pilihan Jamak (MCMA)',
  Kompleks = 'Pilihan Ganda Kompleks',
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
  isDeleted: boolean;
  createdAt: number;
  order: number;
  quizToken: string;
  image?: string; 
  optionImages?: (string | null)[];
  isRegenerating?: boolean; // New: tracking loading per card
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
