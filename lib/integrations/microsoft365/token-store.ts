// In-memory token store for MS365 tokens
// In production, use DynamoDB or another persistent store

import type { MS365Tokens, MS365User } from './ms365-client';

export interface StoredMS365Token extends MS365Tokens {
  user?: MS365User;
}

// Using a module-level Map that persists across requests
const tokenStore = new Map<string, StoredMS365Token>();

export function getToken(userId: string): StoredMS365Token | undefined {
  return tokenStore.get(userId);
}

export function setToken(userId: string, token: StoredMS365Token): void {
  tokenStore.set(userId, token);
}

export function deleteToken(userId: string): boolean {
  return tokenStore.delete(userId);
}

export function hasToken(userId: string): boolean {
  return tokenStore.has(userId);
}
