export interface LogMeta {
  [key: string]: unknown;
}

const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'authorization',
  'cookie',
  'creditcard',
  'cvv',
]);

function sanitize(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitize(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export const logger = {
  info(message: string, meta?: LogMeta) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta ? sanitize(meta) : '');
  },
  warn(message: string, meta?: LogMeta) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta ? sanitize(meta) : '');
  },
  error(message: string, meta?: LogMeta) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, meta ? sanitize(meta) : '');
  },
  debug(message: string, meta?: LogMeta) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, meta ? sanitize(meta) : '');
    }
  },
};
