import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { setAuthToken, trpcClient } from '@/lib/trpc';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

async function storeToken(token: string) {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch (e) {
    console.log('Error storing token:', e);
  }
}

async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (e) {
    console.log('Error getting token:', e);
    return null;
  }
}

async function removeToken() {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (e) {
    console.log('Error removing token:', e);
  }
}

async function storeUser(user: AuthUser) {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.log('Error storing user:', e);
  }
}

async function getStoredUser(): Promise<AuthUser | null> {
  try {
    const data = await AsyncStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.log('Error getting user:', e);
    return null;
  }
}

async function removeUser() {
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch (e) {
    console.log('Error removing user:', e);
  }
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await getStoredToken();
        const storedUser = await getStoredUser();
        if (storedToken && storedUser) {
          setAuthToken(storedToken);
          setToken(storedToken);
          setUser(storedUser);
          console.log('Auth restored for:', storedUser.email);
        }
      } catch (e) {
        console.log('Error restoring auth:', e);
      } finally {
        setIsInitialized(true);
      }
    })();
  }, []);

  const registerMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const result = await trpcClient.auth.register.mutate({ email, password });
      return result;
    },
    onSuccess: async (data) => {
      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
      await storeToken(data.token);
      await storeUser(data.user);
      console.log('Registered successfully:', data.user.email);
    },
  });

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const result = await trpcClient.auth.login.mutate({ email, password });
      return result;
    },
    onSuccess: async (data) => {
      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
      await storeToken(data.token);
      await storeUser(data.user);
      console.log('Logged in successfully:', data.user.email);
    },
  });

  const logout = useCallback(async () => {
    try {
      if (token) {
        await trpcClient.auth.logout.mutate();
      }
    } catch (e) {
      console.log('Error calling logout endpoint:', e);
    } finally {
      setAuthToken(null);
      setToken(null);
      setUser(null);
      await removeToken();
      await removeUser();
      setLastSyncedAt(null);
      queryClient.invalidateQueries();
      console.log('Logged out');
    }
  }, [token, queryClient]);

  const syncToCloud = useCallback(async () => {
    if (!token || !user) {
      console.log('syncToCloud: not authenticated');
      return;
    }
    setIsSyncing(true);
    try {
      const quizSetsData = await AsyncStorage.getItem('pdf_quiz_sets');
      const questionsData = await AsyncStorage.getItem('pdf_quiz_questions');
      const attemptsData = await AsyncStorage.getItem('pdf_quiz_attempts');
      const groupsData = await AsyncStorage.getItem('pdf_quiz_groups');

      const rawQuestions = questionsData ? JSON.parse(questionsData) : [];
      const cleanedQuestions = rawQuestions.map((q: any) => ({
        id: q.id,
        quizSetId: q.quizSetId,
        type: q.type,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        pageRef: q.pageRef,
        verified: q.verified,
        section: q.section,
        imageUri: q.imageUri && q.imageUri.length < 5000 ? q.imageUri : undefined,
      }));

      const localData = {
        quizSets: quizSetsData ? JSON.parse(quizSetsData) : [],
        questions: cleanedQuestions,
        attempts: attemptsData ? JSON.parse(attemptsData) : [],
        groups: groupsData ? JSON.parse(groupsData) : [],
      };

      console.log('syncToCloud: pushing data...', {
        sets: localData.quizSets.length,
        questions: localData.questions.length,
        attempts: localData.attempts.length,
        groups: localData.groups.length,
      });

      const result = await trpcClient.sync.push.mutate(localData);
      setLastSyncedAt(result.lastSyncedAt);
      console.log('syncToCloud: done at', result.lastSyncedAt);
    } catch (e: any) {
      console.log('syncToCloud error:', e);
      const msg = e?.message || '';
      if (msg.includes('Unexpected token') || msg.includes('unexpected character')) {
        throw new Error('Sync data is too large. Try removing some quizzes or images and try again.');
      }
      throw e;
    } finally {
      setIsSyncing(false);
    }
  }, [token, user]);

  const syncFromCloud = useCallback(async () => {
    if (!token || !user) {
      console.log('syncFromCloud: not authenticated');
      return;
    }
    setIsSyncing(true);
    try {
      const cloudData = await trpcClient.sync.pull.query();
      console.log('syncFromCloud: received data', {
        sets: cloudData.quizSets.length,
        questions: cloudData.questions.length,
        attempts: cloudData.attempts.length,
        groups: cloudData.groups.length,
      });

      await AsyncStorage.setItem('pdf_quiz_sets', JSON.stringify(cloudData.quizSets));
      await AsyncStorage.setItem('pdf_quiz_questions', JSON.stringify(cloudData.questions));
      await AsyncStorage.setItem('pdf_quiz_attempts', JSON.stringify(cloudData.attempts));
      await AsyncStorage.setItem('pdf_quiz_groups', JSON.stringify(cloudData.groups));

      setLastSyncedAt(cloudData.lastSyncedAt);
      queryClient.invalidateQueries({ queryKey: ['quizSets'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['attempts'] });
      queryClient.invalidateQueries({ queryKey: ['quizGroups'] });
      console.log('syncFromCloud: done');
    } catch (e) {
      console.log('syncFromCloud error:', e);
      throw e;
    } finally {
      setIsSyncing(false);
    }
  }, [token, user, queryClient]);

  const mergeAndSync = useCallback(async () => {
    if (!token || !user) {
      console.log('mergeAndSync: not authenticated');
      return;
    }
    setIsSyncing(true);
    try {
      const quizSetsData = await AsyncStorage.getItem('pdf_quiz_sets');
      const questionsData = await AsyncStorage.getItem('pdf_quiz_questions');
      const attemptsData = await AsyncStorage.getItem('pdf_quiz_attempts');
      const groupsData = await AsyncStorage.getItem('pdf_quiz_groups');

      const rawQuestions = questionsData ? JSON.parse(questionsData) : [];
      const cleanedQuestions = rawQuestions.map((q: any) => ({
        id: q.id,
        quizSetId: q.quizSetId,
        type: q.type,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        pageRef: q.pageRef,
        verified: q.verified,
        section: q.section,
        imageUri: q.imageUri && q.imageUri.length < 5000 ? q.imageUri : undefined,
      }));

      const localData = {
        quizSets: quizSetsData ? JSON.parse(quizSetsData) : [],
        questions: cleanedQuestions,
        attempts: attemptsData ? JSON.parse(attemptsData) : [],
        groups: groupsData ? JSON.parse(groupsData) : [],
      };

      console.log('mergeAndSync: merging local data with cloud...', {
        localSets: localData.quizSets.length,
        localQuestions: localData.questions.length,
      });

      const merged = await trpcClient.sync.mergeLocal.mutate(localData);

      await AsyncStorage.setItem('pdf_quiz_sets', JSON.stringify(merged.quizSets));
      await AsyncStorage.setItem('pdf_quiz_questions', JSON.stringify(merged.questions));
      await AsyncStorage.setItem('pdf_quiz_attempts', JSON.stringify(merged.attempts));
      await AsyncStorage.setItem('pdf_quiz_groups', JSON.stringify(merged.groups));

      setLastSyncedAt(merged.lastSyncedAt);
      queryClient.invalidateQueries({ queryKey: ['quizSets'] });
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      queryClient.invalidateQueries({ queryKey: ['attempts'] });
      queryClient.invalidateQueries({ queryKey: ['quizGroups'] });
      console.log('mergeAndSync: done, merged sets:', merged.quizSets.length);
    } catch (e: any) {
      console.log('mergeAndSync error:', e);
      const msg = e?.message || '';
      if (msg.includes('Unexpected token') || msg.includes('unexpected character')) {
        throw new Error('Sync data is too large. Try removing some quizzes or images and try again.');
      }
      throw e;
    } finally {
      setIsSyncing(false);
    }
  }, [token, user, queryClient]);

  return {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isInitialized,
    isSyncing,
    lastSyncedAt,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error?.message ?? null,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error?.message ?? null,
    logout,
    syncToCloud,
    syncFromCloud,
    mergeAndSync,
  };
});
