/**
 * Rate Limiter
 * 
 * Begränsar API-anrop per användare/IP för att skydda mot missbruk.
 * Använder sliding window algorithm med DynamoDB för distribuerad rate limiting.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { headers } from 'next/headers';

const REGION = process.env.AWS_REGION || 'eu-north-1';
const TABLE_NAME = 'aifm-rate-limits';

// Rate limit configurations per endpoint type
export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  blockDurationMs: number; // How long to block after exceeding limit
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Strict limits for expensive operations
  'accounting-ingest': {
    windowMs: 60 * 1000,        // 1 minute
    maxRequests: 20,            // 20 uploads per minute
    blockDurationMs: 5 * 60 * 1000, // 5 min block
  },
  'accounting-batch': {
    windowMs: 60 * 1000,
    maxRequests: 10,
    blockDurationMs: 5 * 60 * 1000,
  },
  'ai-classification': {
    windowMs: 60 * 1000,
    maxRequests: 30,
    blockDurationMs: 2 * 60 * 1000,
  },
  'compliance-chat': {
    windowMs: 60 * 1000,
    maxRequests: 20,
    blockDurationMs: 2 * 60 * 1000,
  },
  // Standard API limits
  'api-read': {
    windowMs: 60 * 1000,
    maxRequests: 100,
    blockDurationMs: 60 * 1000,
  },
  'api-write': {
    windowMs: 60 * 1000,
    maxRequests: 50,
    blockDurationMs: 2 * 60 * 1000,
  },
  // Auth limits (strict)
  'auth': {
    windowMs: 15 * 60 * 1000,   // 15 minutes
    maxRequests: 10,            // 10 attempts
    blockDurationMs: 30 * 60 * 1000, // 30 min block
  },
  // Default
  'default': {
    windowMs: 60 * 1000,
    maxRequests: 60,
    blockDurationMs: 60 * 1000,
  },
};

// In-memory fallback for when DynamoDB is unavailable
const memoryStore = new Map<string, { count: number; resetAt: number; blockedUntil?: number }>();

/**
 * Environment variable to control fallback behavior:
 * - 'true' = in prod, if DynamoDB fails, throw error instead of falling back to in-memory
 * - 'false' or unset = allow fallback to in-memory (dev/testing)
 */
const REQUIRE_DYNAMO = process.env.AIFM_REQUIRE_DYNAMO_RATE_LIMIT === 'true';

let docClient: DynamoDBDocumentClient | null = null;
let usingMemoryFallback = false;
let lastDynamoErrorLogged = 0;

function getDocClient(): DynamoDBDocumentClient | null {
  if (!docClient) {
    try {
      const dynamoClient = new DynamoDBClient({ region: REGION });
      docClient = DynamoDBDocumentClient.from(dynamoClient);
    } catch (error) {
      const now = Date.now();
      // Rate-limit the warning log to once per minute
      if (now - lastDynamoErrorLogged > 60_000) {
        console.error('[RateLimiter] DynamoDB client initialization failed:', error);
        lastDynamoErrorLogged = now;
      }
      
      if (REQUIRE_DYNAMO) {
        throw new Error('[RateLimiter] AIFM_REQUIRE_DYNAMO_RATE_LIMIT is set but DynamoDB is unavailable. Aborting request.');
      }
      
      if (!usingMemoryFallback) {
        console.warn('[RateLimiter] ⚠️ Falling back to IN-MEMORY rate limiting. This is NOT suitable for production with multiple instances!');
        usingMemoryFallback = true;
      }
      return null;
    }
  }
  return docClient;
}

/**
 * Returns true if the rate limiter is currently using in-memory fallback.
 * Useful for health checks and monitoring.
 */
export function isUsingMemoryFallback(): boolean {
  return usingMemoryFallback;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number; // Seconds until can retry
}

/**
 * Get client identifier (user ID or IP)
 */
export async function getClientId(): Promise<string> {
  try {
    const headersList = await headers();
    
    // Try to get user ID from session/auth header
    const userId = headersList.get('x-user-id');
    if (userId) return `user:${userId}`;
    
    // Fall back to IP address
    const forwarded = headersList.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim() || 
               headersList.get('x-real-ip') || 
               'unknown';
    
    return `ip:${ip}`;
  } catch {
    return `ip:unknown-${Date.now()}`;
  }
}

/**
 * Check rate limit using DynamoDB (distributed) or in-memory (fallback)
 */
export async function checkRateLimit(
  clientId: string,
  endpoint: string,
  config?: RateLimitConfig
): Promise<RateLimitResult> {
  const limitConfig = config || RATE_LIMITS[endpoint] || RATE_LIMITS['default'];
  const key = `${clientId}:${endpoint}`;
  const now = Date.now();
  
  const client = getDocClient();
  
  if (client) {
    return checkRateLimitDynamoDB(client, key, limitConfig, now);
  } else {
    return checkRateLimitMemory(key, limitConfig, now);
  }
}

async function checkRateLimitDynamoDB(
  client: DynamoDBDocumentClient,
  key: string,
  config: RateLimitConfig,
  now: number
): Promise<RateLimitResult> {
  try {
    // Get current state
    const result = await client.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: key },
    }));
    
    const item = result.Item;
    
    // Check if blocked
    if (item?.blockedUntil && item.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: item.blockedUntil,
        retryAfter: Math.ceil((item.blockedUntil - now) / 1000),
      };
    }
    
    // Check if window has expired
    const windowStart = now - config.windowMs;
    
    if (!item || item.windowStart < windowStart) {
      // New window - allow and reset count
      await client.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: key,
          count: 1,
          windowStart: now,
          ttl: Math.floor((now + config.windowMs * 2) / 1000), // Auto-expire
        },
      }));
      
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt: now + config.windowMs,
      };
    }
    
    // Within window - check count
    if (item.count >= config.maxRequests) {
      // Rate limited - block the client
      const blockedUntil = now + config.blockDurationMs;
      
      await client.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: key },
        UpdateExpression: 'SET blockedUntil = :blocked, ttl = :ttl',
        ExpressionAttributeValues: {
          ':blocked': blockedUntil,
          ':ttl': Math.floor((blockedUntil + 60000) / 1000),
        },
      }));
      
      console.warn(`[RateLimiter] Client ${key} blocked until ${new Date(blockedUntil).toISOString()}`);
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: blockedUntil,
        retryAfter: Math.ceil(config.blockDurationMs / 1000),
      };
    }
    
    // Increment count
    await client.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: key },
      UpdateExpression: 'SET #count = #count + :inc',
      ExpressionAttributeNames: { '#count': 'count' },
      ExpressionAttributeValues: { ':inc': 1 },
    }));
    
    return {
      allowed: true,
      remaining: config.maxRequests - item.count - 1,
      resetAt: item.windowStart + config.windowMs,
    };
  } catch (error) {
    console.error('[RateLimiter] DynamoDB error:', error);
    
    if (REQUIRE_DYNAMO) {
      throw new Error('[RateLimiter] AIFM_REQUIRE_DYNAMO_RATE_LIMIT is set but DynamoDB operation failed. Aborting request.');
    }
    
    // On error in non-strict mode, allow the request but log it
    console.warn('[RateLimiter] Allowing request due to DynamoDB error (non-strict mode)');
    return {
      allowed: true,
      remaining: -1,
      resetAt: now + config.windowMs,
    };
  }
}

function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig,
  now: number
): RateLimitResult {
  const existing = memoryStore.get(key);
  
  // Check if blocked
  if (existing?.blockedUntil && existing.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.blockedUntil,
      retryAfter: Math.ceil((existing.blockedUntil - now) / 1000),
    };
  }
  
  // Check if window expired
  if (!existing || existing.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }
  
  // Within window
  if (existing.count >= config.maxRequests) {
    const blockedUntil = now + config.blockDurationMs;
    memoryStore.set(key, { ...existing, blockedUntil });
    
    return {
      allowed: false,
      remaining: 0,
      resetAt: blockedUntil,
      retryAfter: Math.ceil(config.blockDurationMs / 1000),
    };
  }
  
  existing.count += 1;
  memoryStore.set(key, existing);
  
  return {
    allowed: true,
    remaining: config.maxRequests - existing.count,
    resetAt: existing.resetAt,
  };
}

/**
 * Middleware helper for Next.js API routes
 */
export async function withRateLimit(
  endpoint: string,
  handler: () => Promise<Response>
): Promise<Response> {
  const clientId = await getClientId();
  const result = await checkRateLimit(clientId, endpoint);
  
  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Du har gjort för många förfrågningar. Vänta innan du försöker igen.',
        retryAfter: result.retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfter || 60),
          'X-RateLimit-Limit': String(RATE_LIMITS[endpoint]?.maxRequests || 60),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
        },
      }
    );
  }
  
  // Add rate limit headers to successful response
  const response = await handler();
  
  // Clone response to add headers
  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-RateLimit-Remaining', String(result.remaining));
  newHeaders.set('X-RateLimit-Reset', String(Math.floor(result.resetAt / 1000)));
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Reset rate limit for a client (admin function)
 */
export async function resetRateLimit(clientId: string, endpoint: string): Promise<void> {
  const key = `${clientId}:${endpoint}`;
  const client = getDocClient();
  
  if (client) {
    try {
      await client.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: key,
          count: 0,
          windowStart: Date.now(),
          ttl: Math.floor((Date.now() + 3600000) / 1000),
        },
      }));
    } catch (error) {
      console.error('[RateLimiter] Failed to reset:', error);
    }
  } else {
    memoryStore.delete(key);
  }
}

// Cleanup old entries from memory store periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
      if (value.resetAt < now && (!value.blockedUntil || value.blockedUntil < now)) {
        memoryStore.delete(key);
      }
    }
  }, 60000); // Every minute
}








