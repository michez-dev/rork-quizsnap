import React, { useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Share, Platform, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { QuizSet, Question, Attempt, AnswerRecord, ParsedQuestion, QuizGroup } from '@/types/quiz';
import { generateId } from '@/utils/generateId';

const STORAGE_KEYS = {
  QUIZ_SETS: 'pdf_quiz_sets',
  QUESTIONS: 'pdf_quiz_questions',
  ATTEMPTS: 'pdf_quiz_attempts',
  GROUPS: 'pdf_quiz_groups',
};

async function loadFromStorage<T>(key: string): Promise<T[]> {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.log('Error loading from storage:', key, e);
    return [];
  }
}

async function saveToStorage<T>(key: string, data: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.log('Error saving to storage:', key, e);
  }
}

export const [QuizProvider, useQuiz] = createContextHook(() => {
  const queryClient = useQueryClient();

  const [pendingQuestions, setPendingQuestions] = useState<ParsedQuestion[]>([]);
  const [pendingTitle, setPendingTitle] = useState<string>('');
  const [pendingSource, setPendingSource] = useState<string>('');

  const quizSetsQuery = useQuery({
    queryKey: ['quizSets'],
    queryFn: () => loadFromStorage<QuizSet>(STORAGE_KEYS.QUIZ_SETS),
  });

  const questionsQuery = useQuery({
    queryKey: ['questions'],
    queryFn: () => loadFromStorage<Question>(STORAGE_KEYS.QUESTIONS),
  });

  const attemptsQuery = useQuery({
    queryKey: ['attempts'],
    queryFn: () => loadFromStorage<Attempt>(STORAGE_KEYS.ATTEMPTS),
  });

  const groupsQuery = useQuery({
    queryKey: ['quizGroups'],
    queryFn: () => loadFromStorage<QuizGroup>(STORAGE_KEYS.GROUPS),
  });

  const quizSets = useMemo(() => quizSetsQuery.data ?? [], [quizSetsQuery.data]);
  const allQuestions = useMemo(() => questionsQuery.data ?? [], [questionsQuery.data]);
  const allAttempts = useMemo(() => attemptsQuery.data ?? [], [attemptsQuery.data]);
  const quizGroups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);

  const createQuizSetMutation = useMutation({
    mutationFn: async ({ title, description, sourcePdfName, questions }: {
      title: string;
      description: string;
      sourcePdfName: string;
      questions: ParsedQuestion[];
    }) => {
      const quizSetId = generateId();
      const newQuizSet: QuizSet = {
        id: quizSetId,
        title,
        description,
        sourcePdfName,
        createdAt: new Date().toISOString(),
        questionCount: questions.length,
      };

      const newQuestions: Question[] = questions.map((q) => ({
        id: generateId(),
        quizSetId,
        type: q.type,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        verified: q.verified,
        section: q.section,
        pageRef: q.pageRef,
        imageUri: q.imageUri,
      }));

      const updatedSets = [...quizSets, newQuizSet];
      const updatedQuestions = [...allQuestions, ...newQuestions];

      await saveToStorage(STORAGE_KEYS.QUIZ_SETS, updatedSets);
      await saveToStorage(STORAGE_KEYS.QUESTIONS, updatedQuestions);

      return { quizSet: newQuizSet, questions: newQuestions };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizSets'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });

  const updateQuizSetMutation = useMutation({
    mutationFn: async ({ quizSetId, updates }: { quizSetId: string; updates: Partial<Pick<QuizSet, 'title' | 'description'>> }) => {
      const updatedSets = quizSets.map(s =>
        s.id === quizSetId ? { ...s, ...updates } : s
      );
      await saveToStorage(STORAGE_KEYS.QUIZ_SETS, updatedSets);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizSets'] });
    },
  });

  const updateQuestionsForSetMutation = useMutation({
    mutationFn: async ({ quizSetId, questions }: {
      quizSetId: string;
      questions: ParsedQuestion[];
    }) => {
      const otherQuestions = allQuestions.filter(q => q.quizSetId !== quizSetId);
      const newQuestions: Question[] = questions.map((q) => ({
        id: generateId(),
        quizSetId,
        type: q.type,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        verified: q.verified,
        section: q.section,
        pageRef: q.pageRef,
        imageUri: q.imageUri,
      }));

      const updatedQuestions = [...otherQuestions, ...newQuestions];
      await saveToStorage(STORAGE_KEYS.QUESTIONS, updatedQuestions);

      const updatedSets = quizSets.map(s =>
        s.id === quizSetId ? { ...s, questionCount: questions.length } : s
      );
      await saveToStorage(STORAGE_KEYS.QUIZ_SETS, updatedSets);

      return { questions: newQuestions };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizSets'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });

  const duplicateQuizSetMutation = useMutation({
    mutationFn: async (quizSetId: string) => {
      const original = quizSets.find(s => s.id === quizSetId);
      if (!original) throw new Error('Quiz set not found');

      const originalQuestions = allQuestions.filter(q => q.quizSetId === quizSetId);
      const newQuizSetId = generateId();
      const newQuizSet: QuizSet = {
        ...original,
        id: newQuizSetId,
        title: `${original.title} (Copy)`,
        createdAt: new Date().toISOString(),
      };

      const newQuestions: Question[] = originalQuestions.map(q => ({
        ...q,
        id: generateId(),
        quizSetId: newQuizSetId,
      }));

      await saveToStorage(STORAGE_KEYS.QUIZ_SETS, [...quizSets, newQuizSet]);
      await saveToStorage(STORAGE_KEYS.QUESTIONS, [...allQuestions, ...newQuestions]);

      return newQuizSet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizSets'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });

  const deleteQuizSetMutation = useMutation({
    mutationFn: async (quizSetId: string) => {
      const updatedSets = quizSets.filter(s => s.id !== quizSetId);
      const updatedQuestions = allQuestions.filter(q => q.quizSetId !== quizSetId);
      const updatedAttempts = allAttempts.filter(a => a.quizSetId !== quizSetId);

      await saveToStorage(STORAGE_KEYS.QUIZ_SETS, updatedSets);
      await saveToStorage(STORAGE_KEYS.QUESTIONS, updatedQuestions);
      await saveToStorage(STORAGE_KEYS.ATTEMPTS, updatedAttempts);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizSets'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['attempts'] });
    },
  });

  const saveAttemptMutation = useMutation({
    mutationFn: async (attempt: Attempt) => {
      const updated = [...allAttempts, attempt];
      await saveToStorage(STORAGE_KEYS.ATTEMPTS, updated);
      return attempt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attempts'] });
    },
  });

  const deleteMultipleQuizSetsMutation = useMutation({
    mutationFn: async (quizSetIds: string[]) => {
      const idSet = new Set(quizSetIds);
      const updatedSets = quizSets.filter(s => !idSet.has(s.id));
      const updatedQuestions = allQuestions.filter(q => !idSet.has(q.quizSetId));
      const updatedAttempts = allAttempts.filter(a => !idSet.has(a.quizSetId));

      await saveToStorage(STORAGE_KEYS.QUIZ_SETS, updatedSets);
      await saveToStorage(STORAGE_KEYS.QUESTIONS, updatedQuestions);
      await saveToStorage(STORAGE_KEYS.ATTEMPTS, updatedAttempts);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizSets'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['attempts'] });
    },
  });

  const mergeQuizSetsMutation = useMutation({
    mutationFn: async ({ quizSetIds, newTitle }: { quizSetIds: string[]; newTitle: string }) => {
      const idSet = new Set(quizSetIds);
      const setsToMerge = quizSets.filter(s => idSet.has(s.id));
      const questionsToMerge = allQuestions.filter(q => idSet.has(q.quizSetId));

      const mergedSetId = generateId();
      const mergedSet: QuizSet = {
        id: mergedSetId,
        title: newTitle,
        description: setsToMerge.map(s => s.title).join(' + '),
        sourcePdfName: setsToMerge.map(s => s.sourcePdfName).filter(Boolean).join(', '),
        createdAt: new Date().toISOString(),
        questionCount: questionsToMerge.length,
      };

      const mergedQuestions: Question[] = questionsToMerge.map(q => ({
        ...q,
        id: generateId(),
        quizSetId: mergedSetId,
      }));

      const remainingSets = quizSets.filter(s => !idSet.has(s.id));
      const remainingQuestions = allQuestions.filter(q => !idSet.has(q.quizSetId));
      const remainingAttempts = allAttempts.filter(a => !idSet.has(a.quizSetId));

      await saveToStorage(STORAGE_KEYS.QUIZ_SETS, [...remainingSets, mergedSet]);
      await saveToStorage(STORAGE_KEYS.QUESTIONS, [...remainingQuestions, ...mergedQuestions]);
      await saveToStorage(STORAGE_KEYS.ATTEMPTS, remainingAttempts);

      return mergedSet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizSets'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['attempts'] });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const group: QuizGroup = {
        id: generateId(),
        name,
        color,
        createdAt: new Date().toISOString(),
      };
      const updated = [...quizGroups, group];
      await saveToStorage(STORAGE_KEYS.GROUPS, updated);
      return group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizGroups'] });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ groupId, updates }: { groupId: string; updates: Partial<Pick<QuizGroup, 'name' | 'color'>> }) => {
      const updated = quizGroups.map(g => g.id === groupId ? { ...g, ...updates } : g);
      await saveToStorage(STORAGE_KEYS.GROUPS, updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizGroups'] });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const updated = quizGroups.filter(g => g.id !== groupId);
      await saveToStorage(STORAGE_KEYS.GROUPS, updated);
      const updatedSets = quizSets.map(s => s.groupId === groupId ? { ...s, groupId: undefined } : s);
      await saveToStorage(STORAGE_KEYS.QUIZ_SETS, updatedSets);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizGroups'] });
      queryClient.invalidateQueries({ queryKey: ['quizSets'] });
    },
  });

  const moveQuizToGroupMutation = useMutation({
    mutationFn: async ({ quizSetId, groupId }: { quizSetId: string; groupId: string | undefined }) => {
      const updatedSets = quizSets.map(s =>
        s.id === quizSetId ? { ...s, groupId } : s
      );
      await saveToStorage(STORAGE_KEYS.QUIZ_SETS, updatedSets);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizSets'] });
    },
  });

  const moveMultipleQuizzesToGroupMutation = useMutation({
    mutationFn: async ({ quizSetIds, groupId }: { quizSetIds: string[]; groupId: string | undefined }) => {
      const idSet = new Set(quizSetIds);
      const updatedSets = quizSets.map(s =>
        idSet.has(s.id) ? { ...s, groupId } : s
      );
      await saveToStorage(STORAGE_KEYS.QUIZ_SETS, updatedSets);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizSets'] });
    },
  });

  const clearAllDataMutation = useMutation({
    mutationFn: async () => {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.QUIZ_SETS,
        STORAGE_KEYS.QUESTIONS,
        STORAGE_KEYS.ATTEMPTS,
        STORAGE_KEYS.GROUPS,
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizSets'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['attempts'] });
      queryClient.invalidateQueries({ queryKey: ['quizGroups'] });
    },
  });

  const getQuestionsForSet = useCallback((quizSetId: string): Question[] => {
    return allQuestions.filter(q => q.quizSetId === quizSetId);
  }, [allQuestions]);

  const getAttemptsForSet = useCallback((quizSetId: string): Attempt[] => {
    return allAttempts.filter(a => a.quizSetId === quizSetId).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }, [allAttempts]);

  const getQuizSetById = useCallback((id: string): QuizSet | undefined => {
    return quizSets.find(s => s.id === id);
  }, [quizSets]);

  const exportQuizData = useCallback((quizSetIds: string[]): string | null => {
    try {
      const sets = quizSets.filter(s => quizSetIds.includes(s.id));
      console.log('exportQuizData: found sets:', sets.length, 'for ids:', quizSetIds);
      if (sets.length === 0) return null;
      const questions = allQuestions.filter(q => quizSetIds.includes(q.quizSetId));
      console.log('exportQuizData: found questions:', questions.length);
      const exportData = {
        v: 2,
        s: sets.map(s => ({
          t: s.title,
          ...(s.description ? { d: s.description } : {}),
          ...(s.sourcePdfName ? { p: s.sourcePdfName } : {}),
          n: s.questionCount,
        })),
        q: questions.map(q => {
          const entry: Record<string, any> = {
            i: sets.findIndex(s => s.id === q.quizSetId),
            x: q.text,
            o: q.options,
            a: q.correctAnswer,
          };
          if (q.type !== 'multiple-choice') entry.y = q.type;
          if (q.section) entry.c = q.section;
          if (q.pageRef) entry.r = q.pageRef;
          if (q.verified === false) entry.f = 0;
          return entry;
        }),
      };
      const json = JSON.stringify(exportData);
      console.log('exportQuizData: json length:', json.length);
      let encoded: string;
      try {
        encoded = btoa(unescape(encodeURIComponent(json)));
      } catch {
        console.log('exportQuizData: btoa failed, using raw json');
        encoded = encodeURIComponent(json);
      }
      const result = `QUIZSHARE:${encoded}`;
      console.log('exportQuizData: result length:', result.length);
      return result;
    } catch (e) {
      console.log('Error exporting quiz data:', e);
      return null;
    }
  }, [quizSets, allQuestions]);

  const shareQuizSets = useCallback(async (quizSetIds: string[]) => {
    console.log('shareQuizSets called with ids:', quizSetIds);
    const data = exportQuizData(quizSetIds);
    console.log('shareQuizSets: exportQuizData result:', data ? `string of length ${data.length}` : 'null');
    if (!data) {
      Alert.alert('Error', 'Could not generate share data for this quiz.');
      return;
    }
    const sets = quizSets.filter(s => quizSetIds.includes(s.id));
    const title = sets.length === 1 ? sets[0].title : `${sets.length} Quizzes`;
    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(data);
        Alert.alert('Copied!', 'Quiz share code copied to clipboard. Send it to your friends!');
      } else {
        console.log('shareQuizSets: calling Share.share...');
        const result = await Share.share({
          message: data,
        });
        console.log('shareQuizSets: Share.share result:', result);
      }
    } catch (e: any) {
      console.log('Error sharing quiz:', e?.message || e);
      try {
        await Clipboard.setStringAsync(data);
        Alert.alert('Copied!', 'Quiz share code copied to clipboard. Send it to your friends!');
      } catch (clipErr) {
        console.log('Error copying to clipboard:', clipErr);
        Alert.alert('Error', 'Could not share or copy the quiz data.');
      }
    }
  }, [exportQuizData, quizSets]);

  const importQuizSetsMutation = useMutation({
    mutationFn: async (shareString: string) => {
      let encoded: string;
      let isV2 = false;
      if (shareString.startsWith('QUIZSHARE:')) {
        encoded = shareString.slice(10);
        isV2 = true;
      } else if (shareString.startsWith('QuickShare:')) {
        encoded = shareString.slice(11);
        isV2 = true;
      } else {
        throw new Error('Invalid share format');
      }
      let json: string;
      try {
        json = decodeURIComponent(escape(atob(encoded)));
      } catch {
        json = encoded;
      }
      const data = JSON.parse(json);

      const newSets: QuizSet[] = [];
      const newQuestions: Question[] = [];

      if (data.v === 2 || isV2) {
        if (!data.s || !data.q) throw new Error('Invalid quiz data');
        for (let i = 0; i < data.s.length; i++) {
          const s = data.s[i];
          const setId = generateId();
          newSets.push({
            id: setId,
            title: s.t,
            description: s.d || '',
            sourcePdfName: s.p || '',
            createdAt: new Date().toISOString(),
            questionCount: s.n,
          });
          const setQuestions = data.q.filter((q: any) => q.i === i);
          for (const q of setQuestions) {
            newQuestions.push({
              id: generateId(),
              quizSetId: setId,
              type: q.y || 'multiple-choice',
              text: q.x,
              options: q.o,
              correctAnswer: q.a,
              verified: q.f === 0 ? false : true,
              section: q.c,
              pageRef: q.r,
            });
          }
        }
      } else {
        if (!data.sets || !data.questions) throw new Error('Invalid quiz data');
        for (let i = 0; i < data.sets.length; i++) {
          const s = data.sets[i];
          const setId = generateId();
          newSets.push({
            id: setId,
            title: s.title,
            description: s.description || '',
            sourcePdfName: s.sourcePdfName || '',
            createdAt: new Date().toISOString(),
            questionCount: s.questionCount,
          });
          const setQuestions = data.questions.filter((q: any) => q.setIndex === i);
          for (const q of setQuestions) {
            newQuestions.push({
              id: generateId(),
              quizSetId: setId,
              type: q.type,
              text: q.text,
              options: q.options,
              correctAnswer: q.correctAnswer,
              verified: q.verified ?? true,
              section: q.section,
              pageRef: q.pageRef,
            });
          }
        }
      }

      const updatedSets = [...quizSets, ...newSets];
      const updatedQuestions = [...allQuestions, ...newQuestions];
      await saveToStorage(STORAGE_KEYS.QUIZ_SETS, updatedSets);
      await saveToStorage(STORAGE_KEYS.QUESTIONS, updatedQuestions);

      return newSets;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizSets'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });

  const isLoading = quizSetsQuery.isLoading || questionsQuery.isLoading || attemptsQuery.isLoading || groupsQuery.isLoading;

  return {
    quizSets,
    allQuestions,
    allAttempts,
    quizGroups,
    isLoading,
    pendingQuestions,
    pendingTitle,
    pendingSource,
    setPendingQuestions,
    setPendingTitle,
    setPendingSource,
    createQuizSet: createQuizSetMutation.mutateAsync,
    isCreating: createQuizSetMutation.isPending,
    updateQuizSet: updateQuizSetMutation.mutateAsync,
    deleteQuizSet: deleteQuizSetMutation.mutateAsync,
    isDeleting: deleteQuizSetMutation.isPending,
    saveAttempt: saveAttemptMutation.mutateAsync,
    clearAllData: clearAllDataMutation.mutateAsync,
    getQuestionsForSet,
    getAttemptsForSet,
    getQuizSetById,
    updateQuestionsForSet: updateQuestionsForSetMutation.mutateAsync,
    duplicateQuizSet: duplicateQuizSetMutation.mutateAsync,
    deleteMultipleQuizSets: deleteMultipleQuizSetsMutation.mutateAsync,
    mergeQuizSets: mergeQuizSetsMutation.mutateAsync,
    shareQuizSets,
    importQuizSets: importQuizSetsMutation.mutateAsync,
    isImporting: importQuizSetsMutation.isPending,
    createGroup: createGroupMutation.mutateAsync,
    updateGroup: updateGroupMutation.mutateAsync,
    deleteGroup: deleteGroupMutation.mutateAsync,
    moveQuizToGroup: moveQuizToGroupMutation.mutateAsync,
    moveMultipleQuizzesToGroup: moveMultipleQuizzesToGroupMutation.mutateAsync,
  };
});
