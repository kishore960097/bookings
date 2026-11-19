import fs from 'node:fs';

const MIN_SECRET_LENGTH = 32;
const DISALLOWED_DEFAULT_SECRETS = new Set([
  'change-me-min-32-chars-long-secret',
  'change-me',
  'default-secret',
  '12345678901234567890123456789012',
  'secret',
]);

export const DEFAULT_SUPER_ADMIN_EMAIL = 'cjkishore35@gmail.com';

/**
 * Super Admin allowlist. Always includes the verified platform administrator email,
 * plus any additional comma-separated emails from ADMIN_EMAILS or QGO_ADMIN_EMAILS.
 */
export const ADMIN_EMAILS: Set<string> = new Set([
  DEFAULT_SUPER_ADMIN_EMAIL,
  ...(process.env.ADMIN_EMAILS || process.env.QGO_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
]);

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

/**
 * Validates and retrieves the QGO_SESSION_SECRET.
 * Throws immediately at startup if missing, shorter than 32 characters, or using a known insecure default.
 * No fallback default is provided in any environment.
 * The secret value is never printed or included in logs/error messages.
 */
export function getSessionSecret(): string {
  const secret = process.env.QGO_SESSION_SECRET;
  if (!secret || secret.trim().length < MIN_SECRET_LENGTH) {
    throw new Error(
      `[Config Error] QGO_SESSION_SECRET is missing or too short (minimum ${MIN_SECRET_LENGTH} characters required). Set a high-entropy secret in your environment.`
    );
  }

  const cleanSecret = secret.trim();
  if (DISALLOWED_DEFAULT_SECRETS.has(cleanSecret.toLowerCase())) {
    throw new Error(
      '[Config Error] Insecure default detected for QGO_SESSION_SECRET. You must generate a unique, cryptographically strong secret.'
    );
  }

  return cleanSecret;
}

/**
 * Comprehensive startup environment validation.
 * Fails fast with clear descriptive errors on critical misconfigurations.
 */
export function validateServerConfig(): void {
  // 1. Session Secret validation
  getSessionSecret();

  // 2. Port validation
  if (process.env.PORT) {
    const portNum = Number(process.env.PORT);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      throw new Error(`[Config Error] Invalid PORT environment variable: "${process.env.PORT}". Must be an integer between 1 and 65535.`);
    }
  }

  // 3. Node environment validation
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    console.warn(`[Config Warning] Non-standard NODE_ENV "${nodeEnv}". Expected 'development', 'production', or 'test'.`);
  }

  // 4. Production credential safety check
  if (nodeEnv === 'production') {
    const hasCreds =
      Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) ||
      Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) ||
      process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS === 'true';

    if (!hasCreds) {
      console.warn(
        '\x1b[33m[Config Warning] Running in production without configured Firebase Admin credentials.\x1b[0m\n' +
        'Ensure FIREBASE_SERVICE_ACCOUNT_JSON, GOOGLE_APPLICATION_CREDENTIALS, or Application Default Credentials are set.'
      );
    }
  }
}
