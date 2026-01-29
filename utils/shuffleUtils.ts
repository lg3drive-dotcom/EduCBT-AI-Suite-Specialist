
import { EduCBTQuestion, QuestionType } from "../types";

/**
 * Fisher-Yates Shuffle Algorithm
 */
export const shuffleArray = <T>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/**
 * Mengacak urutan soal dalam daftar
 */
export const shuffleQuestions = (questions: EduCBTQuestion[]): EduCBTQuestion[] => {
  const shuffled = shuffleArray(questions);
  // Re-assign order based on new position
  return shuffled.map((q, i) => ({
    ...q,
    order: i + 1
  }));
};

/**
 * Mengacak opsi jawaban untuk satu soal dan menyesuaikan kunci jawaban
 */
export const shuffleQuestionOptions = (q: EduCBTQuestion): EduCBTQuestion => {
  if (!q.options || q.options.length <= 1) return q;
  if (q.type === QuestionType.Isian || q.type === QuestionType.Uraian) return q;

  const n = q.options.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  const shuffledIndices = shuffleArray(indices);

  const newOptions = shuffledIndices.map(i => q.options[i]);
  const newOptionImages = q.optionImages ? shuffledIndices.map(i => q.optionImages![i]) : undefined;

  let newCorrectAnswer = q.correctAnswer;

  if (q.type === QuestionType.PilihanGanda) {
    if (typeof q.correctAnswer === 'number') {
      // Find where the old index moved to
      newCorrectAnswer = shuffledIndices.indexOf(q.correctAnswer);
    }
  } else if (q.type === QuestionType.MCMA) {
    if (Array.isArray(q.correctAnswer)) {
      // Each index in the array must be mapped to its new position
      newCorrectAnswer = (q.correctAnswer as number[])
        .map(oldIdx => shuffledIndices.indexOf(oldIdx))
        .sort((a, b) => a - b);
    }
  } else if (q.type === QuestionType.Kompleks || q.type === QuestionType.KompleksBS) {
    if (Array.isArray(q.correctAnswer)) {
      // Rearrange the boolean array to match the new option order
      newCorrectAnswer = shuffledIndices.map(i => (q.correctAnswer as boolean[])[i]);
    }
  }

  return {
    ...q,
    options: newOptions,
    optionImages: newOptionImages,
    correctAnswer: newCorrectAnswer
  };
};

/**
 * Mengacak opsi untuk semua soal yang diberikan
 */
export const shuffleAllOptions = (questions: EduCBTQuestion[]): EduCBTQuestion[] => {
  return questions.map(q => shuffleQuestionOptions(q));
};
