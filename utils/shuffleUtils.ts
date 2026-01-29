
import { EduCBTQuestion, QuestionType } from "../types";

export const shuffleArray = <T>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const shuffleQuestions = (questions: EduCBTQuestion[]): EduCBTQuestion[] => {
  const shuffled = shuffleArray(questions);
  return shuffled.map((q, i) => ({ ...q, order: i + 1 }));
};

export const shuffleQuestionOptions = (q: EduCBTQuestion): EduCBTQuestion => {
  if (!q.options || q.options.length <= 1) return q;
  if (q.type === QuestionType.Isian || q.type === QuestionType.Uraian) return q;

  const n = q.options.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  const shuffledIndices = shuffleArray(indices);

  const newOptions = shuffledIndices.map(i => q.options[i]);
  let newCorrectAnswer = q.correctAnswer;

  if (q.type === QuestionType.PilihanGanda) {
    if (typeof q.correctAnswer === 'number') newCorrectAnswer = shuffledIndices.indexOf(q.correctAnswer);
  } else if (q.type === QuestionType.MCMA) {
    if (Array.isArray(q.correctAnswer)) {
      newCorrectAnswer = (q.correctAnswer as number[]).map(oldIdx => shuffledIndices.indexOf(oldIdx)).sort((a, b) => a - b);
    }
  } else if (q.type === QuestionType.BenarSalah || q.type === QuestionType.SesuaiTidakSesuai) {
    if (Array.isArray(q.correctAnswer)) {
      newCorrectAnswer = shuffledIndices.map(i => (q.correctAnswer as boolean[])[i]);
    }
  }

  return { ...q, options: newOptions, correctAnswer: newCorrectAnswer };
};

export const shuffleAllOptions = (questions: EduCBTQuestion[]): EduCBTQuestion[] => {
  return questions.map(q => shuffleQuestionOptions(q));
};
