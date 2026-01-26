/**
 * Secure Logging Utility
 * 
 * Provides PII-safe logging with automatic redaction in production.
 */

const isProd = process.env.NODE_ENV === 'production';

/**
 * Keys that should always be redacted in logs
 */
const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'secret',
  'apiKey',
  'privateKey',
  'ssn',
  'socialSecurityNumber',
  'creditCard',
  'cardNumber',
  'cvv',
  'pin',
  'signature',
  'signatureImage',
] as const;

/**
 * PII keys that should be masked in production logs
 */
const PII_KEYS = [
  'email',
  'phone',
  'phoneNumber',
  'address',
  'streetAddress',
  'postalCode',
  'dateOfBirth',
  'birthDate',
] as const;

/**
 * Sanitize an object for logging by redacting sensitive fields
 */
export function sanitizeForLog(obj: any, maskPII = isProd): any {
  if (obj === null || obj === undefined) return obj;
  
  // Don't process primitives
  if (typeof obj !== 'object') return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLog(item, maskPII));
  }

  // Handle objects
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Always redact sensitive keys
    if (SENSITIVE_KEYS.some(k => lowerKey.includes(k))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    
    // Mask PII in production
    if (maskPII && PII_KEYS.some(k => lowerKey.includes(k))) {
      sanitized[key] = maskString(String(value));
      continue;
    }
    
    // Recursively sanitize nested objects
    if (value && typeof value === 'object') {
      sanitized[key] = sanitizeForLog(value, maskPII);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Mask a string for PII protection (keep first 2 and last 2 chars)
 */
function maskString(str: string): string {
  if (!str || str.length <= 4) return '***';
  return `${str.slice(0, 2)}***${str.slice(-2)}`;
}

/**
 * Safe console.log with automatic sanitization
 */
export function safeLog(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const sanitized = data ? sanitizeForLog(data) : undefined;
  const timestamp = new Date().toISOString();
  
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...(sanitized && { data: sanitized }),
  };
  
  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * Log an audit event (always includes minimal PII for traceability)
 */
export function logAudit(event: {
  action: string;
  userId?: string;
  companyId?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, any>;
}) {
  const timestamp = new Date().toISOString();
  
  console.log(JSON.stringify({
    type: 'AUDIT',
    timestamp,
    ...event,
    metadata: event.metadata ? sanitizeForLog(event.metadata, false) : undefined,
  }));
}

/**
 * Log API request (redact sensitive headers and body)
 */
export function logApiRequest(req: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  userId?: string;
}) {
  safeLog('info', 'API Request', {
    method: req.method,
    url: req.url,
    userId: req.userId,
    // Don't log full headers (may contain tokens)
    hasAuth: !!req.headers?.['authorization'],
    body: req.body ? sanitizeForLog(req.body) : undefined,
  });
}

/**
 * Log API response (redact sensitive data)
 */
export function logApiResponse(res: {
  status: number;
  url: string;
  body?: any;
  duration?: number;
}) {
  safeLog('info', 'API Response', {
    status: res.status,
    url: res.url,
    duration: res.duration,
    // Don't log full response body in prod
    bodySize: res.body ? JSON.stringify(res.body).length : 0,
  });
}







