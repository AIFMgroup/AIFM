/**
 * Input Sanitizer
 * 
 * Skyddar mot injection-attacker genom att validera och sanera input.
 * Inkluderar skydd mot:
 * - XSS (Cross-Site Scripting)
 * - SQL Injection
 * - NoSQL Injection
 * - Command Injection
 * - Path Traversal
 */

// ============ XSS Protection ============

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"'`=/]/g, char => HTML_ENTITIES[char] || char);
}

/**
 * Strip all HTML tags
 */
export function stripHtml(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
}

// ============ SQL/NoSQL Injection Protection ============

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/i,
  /(--)/, // SQL comment
  /(\/\*[\s\S]*?\*\/)/, // Block comment
  /(\bOR\b\s+\d+\s*=\s*\d+)/i, // OR 1=1 type patterns
  /(\bAND\b\s+\d+\s*=\s*\d+)/i,
  /(;\s*(SELECT|INSERT|UPDATE|DELETE|DROP))/i, // Stacked queries
  /(\bEXEC\b|\bEXECUTE\b)/i,
  /(\bxp_)/i, // SQL Server extended procedures
];

const NOSQL_INJECTION_PATTERNS = [
  /\$where/i,
  /\$gt/i,
  /\$lt/i,
  /\$ne/i,
  /\$regex/i,
  /\$or/i,
  /\$and/i,
  /\{\s*"\$\w+"/i, // JSON with $ operators
];

/**
 * Check for SQL injection patterns
 */
export function detectSqlInjection(str: string): boolean {
  if (typeof str !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(str));
}

/**
 * Check for NoSQL injection patterns
 */
export function detectNoSqlInjection(str: string): boolean {
  if (typeof str !== 'string') return false;
  return NOSQL_INJECTION_PATTERNS.some(pattern => pattern.test(str));
}

/**
 * Sanitize string for database queries
 */
export function sanitizeForDb(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/['"\\;]/g, '') // Remove quotes and semicolons
    .replace(/--/g, '')       // Remove SQL comments
    .trim();
}

// ============ Command Injection Protection ============

const COMMAND_INJECTION_CHARS = /[;&|`$(){}[\]<>!]/g;
const DANGEROUS_COMMANDS = /\b(rm|mv|cp|chmod|chown|sudo|su|wget|curl|nc|netcat|bash|sh|zsh|python|perl|ruby|php|node)\b/i;

/**
 * Detect command injection attempts
 */
export function detectCommandInjection(str: string): boolean {
  if (typeof str !== 'string') return false;
  return COMMAND_INJECTION_CHARS.test(str) || DANGEROUS_COMMANDS.test(str);
}

/**
 * Sanitize for shell commands (use with extreme caution)
 */
export function sanitizeForShell(str: string): string {
  if (typeof str !== 'string') return '';
  return str.replace(COMMAND_INJECTION_CHARS, '').trim();
}

// ============ Path Traversal Protection ============

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/, 
  /%2e%2e%2f/i,
  /%2e%2e%5c/i,
  /\.\.%2f/i,
  /\.\.%5c/i,
];

/**
 * Detect path traversal attempts
 */
export function detectPathTraversal(str: string): boolean {
  if (typeof str !== 'string') return false;
  return PATH_TRAVERSAL_PATTERNS.some(pattern => pattern.test(str));
}

/**
 * Sanitize file path
 */
export function sanitizePath(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\.\./g, '')
    .replace(/[<>:"|?*]/g, '') // Windows invalid chars
    .replace(/\/{2,}/g, '/')   // Multiple slashes
    .replace(/^\/+/, '')       // Leading slashes
    .trim();
}

// ============ General Sanitizers ============

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') return '';
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Only allow safe chars
    .replace(/\.{2,}/g, '.')          // No double dots
    .replace(/^\.+|\.+$/g, '')        // No leading/trailing dots
    .slice(0, 255);                   // Max length
}

/**
 * Sanitize email
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  const cleaned = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned) ? cleaned : '';
}

/**
 * Sanitize phone number (Swedish format)
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') return '';
  return phone.replace(/[^\d+\-\s()]/g, '').trim();
}

/**
 * Sanitize Swedish organization number
 */
export function sanitizeOrgNumber(orgNumber: string): string {
  if (typeof orgNumber !== 'string') return '';
  const cleaned = orgNumber.replace(/[^\d-]/g, '');
  // Swedish org number format: XXXXXX-XXXX
  const match = cleaned.match(/^(\d{6})-?(\d{4})$/);
  return match ? `${match[1]}-${match[2]}` : '';
}

/**
 * Sanitize currency amount
 */
export function sanitizeAmount(amount: string | number): number {
  if (typeof amount === 'number') {
    return isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
  }
  if (typeof amount !== 'string') return 0;
  
  // Handle Swedish number format (1 234,56)
  const cleaned = amount
    .replace(/\s/g, '')
    .replace(/,/g, '.')
    .replace(/[^\d.-]/g, '');
  
  const num = parseFloat(cleaned);
  return isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

/**
 * Sanitize date string
 */
export function sanitizeDate(date: string): string {
  if (typeof date !== 'string') return '';
  
  // Try to parse and format as ISO date
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return '';
  
  return parsed.toISOString().split('T')[0]; // YYYY-MM-DD
}

// ============ Validation Helpers ============

export interface ValidationResult {
  valid: boolean;
  sanitized: string;
  errors: string[];
  warnings: string[];
}

/**
 * Comprehensive input validation
 */
export function validateInput(
  input: string,
  options: {
    maxLength?: number;
    minLength?: number;
    allowHtml?: boolean;
    checkSql?: boolean;
    checkNoSql?: boolean;
    checkCommand?: boolean;
    checkPath?: boolean;
    customPattern?: RegExp;
    required?: boolean;
  } = {}
): ValidationResult {
  const {
    maxLength = 10000,
    minLength = 0,
    allowHtml = false,
    checkSql = true,
    checkNoSql = true,
    checkCommand = false,
    checkPath = true,
    customPattern,
    required = false,
  } = options;
  
  const errors: string[] = [];
  const warnings: string[] = [];
  let sanitized = typeof input === 'string' ? input : '';
  
  // Check required
  if (required && !sanitized.trim()) {
    errors.push('Fältet är obligatoriskt');
  }
  
  // Check length
  if (sanitized.length > maxLength) {
    errors.push(`Max längd är ${maxLength} tecken`);
    sanitized = sanitized.slice(0, maxLength);
  }
  
  if (sanitized.length < minLength && sanitized.length > 0) {
    errors.push(`Min längd är ${minLength} tecken`);
  }
  
  // Security checks
  if (checkSql && detectSqlInjection(sanitized)) {
    warnings.push('Potentiell SQL-injection upptäckt');
    sanitized = sanitizeForDb(sanitized);
  }
  
  if (checkNoSql && detectNoSqlInjection(sanitized)) {
    warnings.push('Potentiell NoSQL-injection upptäckt');
    sanitized = sanitizeForDb(sanitized);
  }
  
  if (checkCommand && detectCommandInjection(sanitized)) {
    errors.push('Otillåtna tecken upptäckta');
    sanitized = sanitizeForShell(sanitized);
  }
  
  if (checkPath && detectPathTraversal(sanitized)) {
    errors.push('Otillåten sökväg upptäckt');
    sanitized = sanitizePath(sanitized);
  }
  
  // HTML handling
  if (!allowHtml) {
    sanitized = stripHtml(sanitized);
  }
  
  // Custom pattern
  if (customPattern && !customPattern.test(sanitized)) {
    errors.push('Felaktigt format');
  }
  
  return {
    valid: errors.length === 0,
    sanitized,
    errors,
    warnings,
  };
}

/**
 * Sanitize an entire object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: Parameters<typeof validateInput>[1] = {}
): T {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Sanitize the key too
    const safeKey = sanitizeForDb(key);
    
    if (typeof value === 'string') {
      result[safeKey] = validateInput(value, options).sanitized;
    } else if (Array.isArray(value)) {
      result[safeKey] = value.map(item => 
        typeof item === 'string' 
          ? validateInput(item, options).sanitized
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>, options)
            : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[safeKey] = sanitizeObject(value as Record<string, unknown>, options);
    } else {
      result[safeKey] = value;
    }
  }
  
  return result as T;
}

/**
 * Middleware helper for sanitizing request body
 */
export function sanitizeRequestBody<T extends Record<string, unknown>>(body: T): T {
  return sanitizeObject(body, {
    maxLength: 50000,
    checkSql: true,
    checkNoSql: true,
    checkPath: true,
  });
}















