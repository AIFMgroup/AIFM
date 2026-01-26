/**
 * Rate Limiting Service
 * 
 * Simple in-memory rate limiter with sliding window.
 * For production: consider Redis or DynamoDB for distributed rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  maxRequests: number;
  /**
   * Time window in seconds
   */
  windowSeconds: number;
  /**
   * Key to use for rate limiting (e.g., IP, email, token)
   */
  keyPrefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request is allowed based on rate limiting
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${config.keyPrefix}:${identifier}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  let entry = rateLimitStore.get(key);

  // Initialize or reset if window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    allowed,
    limit: config.maxRequests,
    remaining,
    resetAt: entry.resetAt,
  };
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
  };
}

/**
 * Preset configurations for common use cases
 */
export const RateLimitPresets = {
  /**
   * Public endpoints: 30 requests per minute per IP
   */
  PUBLIC: {
    maxRequests: 30,
    windowSeconds: 60,
    keyPrefix: 'public',
  },
  /**
   * Shared link access: 60 requests per hour per token
   */
  SHARED_LINK: {
    maxRequests: 60,
    windowSeconds: 3600,
    keyPrefix: 'shared-link',
  },
  /**
   * NDA signing: 5 attempts per hour per email
   */
  NDA_SIGN: {
    maxRequests: 5,
    windowSeconds: 3600,
    keyPrefix: 'nda-sign',
  },
  /**
   * Password attempts: 10 per hour per token
   */
  PASSWORD_ATTEMPT: {
    maxRequests: 10,
    windowSeconds: 3600,
    keyPrefix: 'password',
  },
} as const;

/**
 * Extract client identifier from request (IP address)
 */
export function getClientIdentifier(request: Request): string {
  // Try various headers for IP (reverse proxy support)
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const cfConnectingIp = headers.get('cf-connecting-ip');

  // Use first IP from x-forwarded-for if available
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (cfConnectingIp) return cfConnectingIp;
  if (realIp) return realIp;

  // Fallback to generic identifier
  return 'unknown';
}







