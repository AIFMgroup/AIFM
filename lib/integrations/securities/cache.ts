/**
 * Security Data Cache
 * Uses DynamoDB for persistent caching of Yahoo Finance / market data
 * Falls back to in-memory cache if DynamoDB is not available
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.SECURITIES_CACHE_TABLE || 'aifm-securities-cache';
const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 24 hours

// In-memory fallback cache
const memoryCache = new Map<string, { data: any; expiresAt: number }>();

// DynamoDB client (lazy initialized)
let docClient: DynamoDBDocumentClient | null = null;
let dynamoAvailable: boolean | null = null;

function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'eu-north-1',
    });
    docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return docClient;
}

/**
 * Check if DynamoDB table exists and is accessible
 */
async function checkDynamoAvailable(): Promise<boolean> {
  if (dynamoAvailable !== null) return dynamoAvailable;
  
  try {
    // Try a simple get operation to check if table exists
    await getDocClient().send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { cacheKey: '__health_check__' },
    }));
    dynamoAvailable = true;
    console.log('[Cache] DynamoDB table available:', TABLE_NAME);
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      console.warn('[Cache] DynamoDB table not found, using in-memory cache');
      dynamoAvailable = false;
    } else if (error.name === 'AccessDeniedException') {
      console.warn('[Cache] DynamoDB access denied, using in-memory cache');
      dynamoAvailable = false;
    } else {
      // Other errors - try to use DynamoDB anyway
      console.warn('[Cache] DynamoDB check error, will retry:', error.message);
      dynamoAvailable = false;
    }
  }
  
  return dynamoAvailable;
}

export interface CacheOptions {
  ttlSeconds?: number;
  prefix?: string;
}

/**
 * Generate cache key
 */
function generateKey(key: string, prefix?: string): string {
  return prefix ? `${prefix}:${key}` : key;
}

/**
 * Get item from cache
 */
export async function getCached<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
  const cacheKey = generateKey(key, options.prefix);
  const now = Math.floor(Date.now() / 1000);

  // Try DynamoDB first
  if (await checkDynamoAvailable()) {
    try {
      const result = await getDocClient().send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { cacheKey },
      }));

      if (result.Item && result.Item.ttl > now) {
        console.log('[Cache] DynamoDB HIT:', cacheKey);
        return result.Item.data as T;
      }
    } catch (error) {
      console.warn('[Cache] DynamoDB get error:', error);
    }
  }

  // Fallback to memory cache
  const memItem = memoryCache.get(cacheKey);
  if (memItem && memItem.expiresAt > now) {
    console.log('[Cache] Memory HIT:', cacheKey);
    return memItem.data as T;
  }

  console.log('[Cache] MISS:', cacheKey);
  return null;
}

/**
 * Set item in cache
 */
export async function setCached<T>(
  key: string, 
  data: T, 
  options: CacheOptions = {}
): Promise<void> {
  const cacheKey = generateKey(key, options.prefix);
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  const ttl = now + ttlSeconds;

  // Always set in memory cache
  memoryCache.set(cacheKey, { data, expiresAt: ttl });

  // Try DynamoDB
  if (await checkDynamoAvailable()) {
    try {
      await getDocClient().send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          cacheKey,
          data,
          ttl,
          createdAt: new Date().toISOString(),
        },
      }));
      console.log('[Cache] DynamoDB SET:', cacheKey, 'TTL:', ttlSeconds, 's');
    } catch (error) {
      console.warn('[Cache] DynamoDB put error:', error);
    }
  } else {
    console.log('[Cache] Memory SET:', cacheKey, 'TTL:', ttlSeconds, 's');
  }
}

/**
 * Delete item from cache
 */
export async function deleteCached(key: string, options: CacheOptions = {}): Promise<void> {
  const cacheKey = generateKey(key, options.prefix);

  // Delete from memory
  memoryCache.delete(cacheKey);

  // Delete from DynamoDB
  if (await checkDynamoAvailable()) {
    try {
      await getDocClient().send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { cacheKey },
      }));
    } catch (error) {
      console.warn('[Cache] DynamoDB delete error:', error);
    }
  }
}

/**
 * Wrapper function: get from cache or fetch and cache
 */
export async function withCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try cache first
  const cached = await getCached<T>(key, options);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetchFn();

  // Cache the result (don't await to not block)
  setCached(key, data, options).catch(err => {
    console.warn('[Cache] Failed to cache result:', err);
  });

  return data;
}

/**
 * Clear expired items from memory cache (call periodically)
 */
export function clearExpiredMemoryCache(): number {
  const now = Math.floor(Date.now() / 1000);
  let cleared = 0;

  for (const [key, item] of memoryCache.entries()) {
    if (item.expiresAt <= now) {
      memoryCache.delete(key);
      cleared++;
    }
  }

  if (cleared > 0) {
    console.log('[Cache] Cleared', cleared, 'expired items from memory');
  }

  return cleared;
}

// Clear expired items every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(clearExpiredMemoryCache, 5 * 60 * 1000);
}
