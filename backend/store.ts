import { QuizSet, Question, Attempt, QuizGroup } from '@/types/quiz';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface UserData {
  quizSets: QuizSet[];
  questions: Question[];
  attempts: Attempt[];
  groups: QuizGroup[];
  lastSyncedAt: string;
}

const users = new Map<string, UserRecord>();
const userDataStore = new Map<string, UserData>();
const tokenToUserId = new Map<string, string>();

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function simpleHash(password: string): string {
  let hash = 0;
  const salt = 'quizsnap_salt_2024';
  const salted = salt + password + salt;
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + salted.length.toString(36);
}

export function registerUser(email: string, password: string): { user: UserRecord; token: string } | { error: string } {
  const normalizedEmail = email.toLowerCase().trim();

  for (const user of users.values()) {
    if (user.email === normalizedEmail) {
      return { error: 'An account with this email already exists' };
    }
  }

  const id = 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const user: UserRecord = {
    id,
    email: normalizedEmail,
    passwordHash: simpleHash(password),
    createdAt: new Date().toISOString(),
  };

  users.set(id, user);
  userDataStore.set(id, {
    quizSets: [],
    questions: [],
    attempts: [],
    groups: [],
    lastSyncedAt: new Date().toISOString(),
  });

  const token = generateToken();
  tokenToUserId.set(token, id);

  return { user, token };
}

export function loginUser(email: string, password: string): { user: UserRecord; token: string } | { error: string } {
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = simpleHash(password);

  for (const user of users.values()) {
    if (user.email === normalizedEmail && user.passwordHash === passwordHash) {
      const token = generateToken();
      tokenToUserId.set(token, user.id);
      return { user, token };
    }
  }

  return { error: 'Invalid email or password' };
}

export function getUserFromToken(token: string): UserRecord | null {
  const userId = tokenToUserId.get(token);
  if (!userId) return null;
  return users.get(userId) ?? null;
}

export function logoutUser(token: string): void {
  tokenToUserId.delete(token);
}

export function getUserData(userId: string): UserData | null {
  return userDataStore.get(userId) ?? null;
}

export function setUserData(userId: string, data: UserData): void {
  userDataStore.set(userId, {
    ...data,
    lastSyncedAt: new Date().toISOString(),
  });
}

export function mergeUserData(userId: string, localData: UserData): UserData {
  const existing = userDataStore.get(userId);

  if (!existing || (existing.quizSets.length === 0 && existing.questions.length === 0)) {
    const merged: UserData = {
      ...localData,
      lastSyncedAt: new Date().toISOString(),
    };
    userDataStore.set(userId, merged);
    return merged;
  }

  const existingSetIds = new Set(existing.quizSets.map(s => s.id));
  const existingQuestionIds = new Set(existing.questions.map(q => q.id));
  const existingAttemptIds = new Set(existing.attempts.map(a => a.id));
  const existingGroupIds = new Set(existing.groups.map(g => g.id));

  const merged: UserData = {
    quizSets: [
      ...existing.quizSets,
      ...localData.quizSets.filter(s => !existingSetIds.has(s.id)),
    ],
    questions: [
      ...existing.questions,
      ...localData.questions.filter(q => !existingQuestionIds.has(q.id)),
    ],
    attempts: [
      ...existing.attempts,
      ...localData.attempts.filter(a => !existingAttemptIds.has(a.id)),
    ],
    groups: [
      ...existing.groups,
      ...localData.groups.filter(g => !existingGroupIds.has(g.id)),
    ],
    lastSyncedAt: new Date().toISOString(),
  };

  userDataStore.set(userId, merged);
  return merged;
}
