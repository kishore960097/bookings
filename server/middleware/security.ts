import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

const envOrigins = (process.env.QGO_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const connectSrcDirectives = Array.from(
  new Set([
    "'self'",
    'https://accounts.google.com',
    'https://apis.google.com',
    'https://www.google.com',
    'https://www.gstatic.com',
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
    'https://firestore.googleapis.com',
    'https://*.firebaseapp.com',
    'https://*.firebaseio.com',
    'https://*.googleapis.com',
    'https://qgo.app',
    'capacitor://*',
    'http://localhost:*',
    'ws://localhost:*',
    'ws://127.0.0.1:*',
    ...(process.env.NODE_ENV !== 'production'
      ? [
          'https://*.devtunnels.ms',
          'wss://*.devtunnels.ms',
          'https://*.ngrok-free.app',
          'https://*.trycloudflare.com',
        ]
      : []),
    ...envOrigins,
  ])
);

/**
 * Helmet Security Middleware Configuration
 * Hardened security headers protecting against clickjacking, MIME-sniffing, XSS, and referrer leaks.
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    reportOnly: process.env.NODE_ENV !== 'production' || process.env.CSP_REPORT_ONLY === 'true',
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        'https://apis.google.com',
        'https://accounts.google.com',
        'https://www.gstatic.com',
        'https://*.firebaseapp.com',
        'https://identitytoolkit.googleapis.com',
        'https://securetoken.googleapis.com',
        'https://*.googleapis.com',
        'https://www.google.com',
      ],
      connectSrc: connectSrcDirectives,
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: [
        "'self'",
        'data:',
        'blob:',
        'https:',
      ],
      mediaSrc: [
        "'self'",
        'blob:',
        'data:',
        'https:',
      ],
      frameSrc: [
        "'self'",
        'https://accounts.google.com',
        'https://*.firebaseapp.com',
        'https://*.google.com',
        'https://www.google.com',
        'https://apis.google.com',
        'https://identitytoolkit.googleapis.com',
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  xContentTypeOptions: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // Required for Firebase Auth & Google Sign-In popup communication
  crossOriginEmbedderPolicy: false,
});

/**
 * Standard JSON 429 Rate Limit Response Handler
 */
const rateLimitHandler = (req: Request, res: Response) => {
  res.status(429).json({ success: false, error: 'Too many requests, please try again later.' });
};

/**
 * 1. General API Limiter: 300 req / minute per IP
 * Configured high enough for client polling (~4-5s interval across views).
 */
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req: Request) => req.path === '/api/health' || req.path === '/health',
});

/**
 * 2. Strict Auth Limiter: 20 req / 15 minutes per IP
 * Protects login, registration, and OTP endpoints against brute-force.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request) => req.ip || req.socket.remoteAddress || 'unknown-ip',
  skip: (req: Request) =>
    req.method === 'GET' ||
    req.path === '/firebase/session' ||
    req.path.endsWith('/firebase/session') ||
    req.originalUrl?.includes('/auth/firebase/session'),
});

/**
 * 3. Dedicated OTP Request Limiter: 5 req / 15 minutes per IP
 * Strict limit on generating new SMS verification codes to prevent SMS pumping / exhaustion.
 */
export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request) => req.ip || req.socket.remoteAddress || 'unknown-ip',
});

/**
 * 4. Ticket Verification / Check-in Limiter: 60 req / minute per IP
 * Prevents automated enumeration of QR signatures or short booking codes.
 */
export const checkinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * 5. Write Limiter: 30 req / minute per IP
 * Throttles state-changing mutation requests (booking creation, queue joins, ticket creation).
 */
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: (req: Request) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS',
});

/**
 * 6. Admin Limiter: 60 req / minute per IP
 * Protects administrative back-office queries and status mutations.
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Clean 413 Payload Too Large Error Handler
 */
export function payloadTooLargeHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err && (err.type === 'entity.too.large' || err.status === 413 || err.statusCode === 413)) {
    return res.status(413).json({ success: false, error: 'Payload too large' });
  }
  next(err);
}

/**
 * Global Production Error Handler
 * Sanitizes uncaught errors to prevent stack trace or file system path leakage.
 */
export function globalErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = Number(err.status || err.statusCode) || 500;
  console.error(`[Server Error] ${req.method} ${req.originalUrl || req.url} -> ${statusCode}:`, err?.message || err);

  const isProd = process.env.NODE_ENV === 'production';
  return res.status(statusCode).json({
    success: false,
    error: isProd
      ? 'An unexpected error occurred. Please try again later.'
      : (err?.message || 'Internal server error'),
  });
}
