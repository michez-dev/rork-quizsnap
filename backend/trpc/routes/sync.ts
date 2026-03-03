import * as z from "zod";
import { createTRPCRouter, protectedProcedure } from "../create-context";
import { getUserData, setUserData, mergeUserData, UserData } from "@/backend/store";

const quizSetSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  sourcePdfName: z.string(),
  createdAt: z.string(),
  questionCount: z.number(),
  groupId: z.string().optional(),
});

const questionSchema = z.object({
  id: z.string(),
  quizSetId: z.string(),
  type: z.enum(["multiple-choice", "multiple-select", "true-false", "short-answer"]),
  text: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  pageRef: z.number().optional(),
  verified: z.boolean(),
  section: z.string().optional(),
  imageUri: z.string().optional(),
});

const attemptSchema = z.object({
  id: z.string(),
  quizSetId: z.string(),
  quizSetTitle: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  score: z.number(),
  totalQuestions: z.number(),
  mode: z.enum(["study", "exam"]),
  answers: z.array(z.object({
    questionId: z.string(),
    questionText: z.string(),
    options: z.array(z.string()),
    correctAnswer: z.union([z.string(), z.array(z.string())]),
    userAnswer: z.union([z.string(), z.array(z.string())]),
    isCorrect: z.boolean(),
    timeSpent: z.number(),
    pointsEarned: z.number().optional(),
  })),
  scoring: z.object({
    enabled: z.boolean(),
    pointsPerCorrect: z.number(),
    penaltyPerWrong: z.number(),
  }).optional(),
  totalPoints: z.number().optional(),
});

const groupSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  createdAt: z.string(),
});

const userDataSchema = z.object({
  quizSets: z.array(quizSetSchema),
  questions: z.array(questionSchema),
  attempts: z.array(attemptSchema),
  groups: z.array(groupSchema),
});

export const syncRouter = createTRPCRouter({
  pull: protectedProcedure.query(({ ctx }) => {
    const data = getUserData(ctx.user.id);
    if (!data) {
      return {
        quizSets: [],
        questions: [],
        attempts: [],
        groups: [],
        lastSyncedAt: new Date().toISOString(),
      } as UserData;
    }
    return data;
  }),

  push: protectedProcedure
    .input(userDataSchema)
    .mutation(({ ctx, input }) => {
      const data: UserData = {
        ...input,
        lastSyncedAt: new Date().toISOString(),
      };
      setUserData(ctx.user.id, data);
      return { success: true, lastSyncedAt: data.lastSyncedAt };
    }),

  mergeLocal: protectedProcedure
    .input(userDataSchema)
    .mutation(({ ctx, input }) => {
      const localData: UserData = {
        ...input,
        lastSyncedAt: new Date().toISOString(),
      };
      const merged = mergeUserData(ctx.user.id, localData);
      return merged;
    }),
});
