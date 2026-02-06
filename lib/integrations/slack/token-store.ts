// In-memory token store for Slack tokens
// In production, use DynamoDB or another persistent store

import type { SlackTokens } from './slack-client';

// Using a module-level Map that persists across requests
const tokenStore = new Map<string, SlackTokens>();

export function getSlackToken(userId: string): SlackTokens | undefined {
  return tokenStore.get(userId);
}

export function setSlackToken(userId: string, token: SlackTokens): void {
  tokenStore.set(userId, token);
}

export function deleteSlackToken(userId: string): boolean {
  return tokenStore.delete(userId);
}

export function hasSlackToken(userId: string): boolean {
  return tokenStore.has(userId);
}
