export type QuestionType = 'multiple-choice' | 'multiple-select' | 'true-false' | 'short-answer';
export type QuizMode = 'study' | 'exam';

export interface QuizGroup {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface QuizSet {
  id: string;
  title: string;
  description: string;
  sourcePdfName: string;
  createdAt: string;
  questionCount: number;
  groupId?: string;
}

export interface QuestionImageRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  description?: string;
}

export interface Question {
  id: string;
  quizSetId: string;
  type: QuestionType;
  text: string;
  options: string[];
  correctAnswer: string | string[];
  pageRef?: number;
  verified: boolean;
  section?: string;
  imageUri?: string;
  imageRegion?: QuestionImageRegion;
}

export interface ScoringConfig {
  enabled: boolean;
  pointsPerCorrect: number;
  penaltyPerWrong: number;
}

export interface Attempt {
  id: string;
  quizSetId: string;
  quizSetTitle: string;
  startedAt: string;
  endedAt: string;
  score: number;
  totalQuestions: number;
  mode: QuizMode;
  answers: AnswerRecord[];
  scoring?: ScoringConfig;
  totalPoints?: number;
}

export interface AnswerRecord {
  questionId: string;
  questionText: string;
  options: string[];
  correctAnswer: string | string[];
  userAnswer: string | string[];
  isCorrect: boolean;
  timeSpent: number;
  pointsEarned?: number;
}

export interface QuizSettings {
  mode: QuizMode;
  timerEnabled: boolean;
  timerMinutes: number;
  randomize: boolean;
  questionCount: number | 'all';
}

export interface ParsedQuestion {
  text: string;
  options: string[];
  correctAnswer: string | string[];
  type: QuestionType;
  verified: boolean;
  section?: string;
  pageRef?: number;
  imageUri?: string;
  imageRegion?: QuestionImageRegion;
}
