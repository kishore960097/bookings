import 'dotenv/config';

process.on('unhandledRejection', (reason: any) => {
  console.warn('[Server Warning] Unhandled Promise Rejection intercepted:', reason?.message || reason);
});

process.on('uncaughtException', (err: any) => {
  console.error('[FATAL] Uncaught Exception:', err?.message || err);
  process.exit(1);
});

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter, startNotificationAndSlotScheduler } from './server/routes';
import { validateServerConfig } from './server/config';
import {
  helmetMiddleware,
  generalApiLimiter,
  authLimiter,
  otpRequestLimiter,
  checkinLimiter,
  writeLimiter,
  adminLimiter,
  payloadTooLargeHandler,
  globalErrorHandler,
} from './server/middleware/security';

async function startServer() {
  // Fail-fast validate environment secrets and configuration before booting
  validateServerConfig();

  const app = express();

  // Explicitly remove X-Powered-By fingerprint
  app.disable('x-powered-by');

  // Trust first proxy (Render, Cloud Run, Reverse Proxies, local dev tunnels) for accurate client IP detection
  app.set('trust proxy', 1);

  // 1. Helmet security headers (Content Security Policy, HSTS, No-Sniff, Referrer Policy)
  app.use(helmetMiddleware);

  // 2. Strict CORS Middleware (Allow-list from environment, no insecure wildcards)
  // Required Capacitor APK origins: https://qgo.app, capacitor://localhost, http://localhost
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const defaultOrigins = [
        'https://qgo.app',
        'capacitor://localhost',
        'http://localhost',
        'http://localhost:3000',
        'https://localhost',
      ];
      const configuredOrigins = (process.env.QGO_ALLOWED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

      const frontendUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.trim().replace(/\/+$/, '') : null;
      const appUrl = process.env.APP_URL ? process.env.APP_URL.trim().replace(/\/+$/, '') : null;

      const allowedOrigins = new Set([
        ...defaultOrigins,
        ...configuredOrigins,
        ...(frontendUrl ? [frontendUrl] : []),
        ...(appUrl ? [appUrl] : []),
      ]);

      const isDevLanOrigin =
        process.env.NODE_ENV !== 'production' &&
        /^http:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):3000$/.test(origin);

      const isDevTunnelOrigin =
        process.env.NODE_ENV !== 'production' &&
        (/^https:\/\/.*\.devtunnels\.ms$/.test(origin) ||
         /^https:\/\/.*\.ngrok-free\.app$/.test(origin) ||
         /^https:\/\/.*\.loca\.lt$/.test(origin) ||
         /^https:\/\/.*\.trycloudflare\.com$/.test(origin));

      if (allowedOrigins.has(origin) || isDevLanOrigin || isDevTunnelOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Request-Id');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
      }
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  });

  // 3. Health check (lightweight unparsed monitoring endpoint)
  app.get(['/health', '/api/health', '/api/v1/health'], (_req, res) => {
    res.json({
      status: 'ok',
      service: 'qgo-backend',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    });
  });

  // 4. Rate Limiters
  // Strict SMS OTP Request Limiter: 5 requests / 15 minutes per IP
  app.use(['/api/v1/auth/otp/request', '/api/auth/otp/request'], otpRequestLimiter);

  // Strict Auth Limiter: 20 requests / 15 minutes per IP
  app.use(['/api/v1/auth', '/api/auth'], authLimiter);

  // Ticket & QR Scanner Check-in Limiter: 60 requests / minute per IP
  app.use([
    '/api/v1/vendor/bookings/verify-ticket',
    '/api/vendor/bookings/verify-ticket',
    '/api/v1/owner/tickets',
    '/api/owner/tickets',
    '/api/v1/checkin',
    '/api/checkin',
  ], checkinLimiter);

  // Write Limiter: 30 mutating requests / minute per IP (skips GET polling)
  app.use(['/api/v1/bookings', '/api/bookings'], writeLimiter);
  app.use(['/api/v1/queue', '/api/queue'], writeLimiter);
  app.use(['/api/v1/support-tickets', '/api/support-tickets'], writeLimiter);

  // Admin Limiter: 60 requests / minute per IP
  app.use(['/api/v1/admin', '/api/admin'], adminLimiter);

  // General API Limiter: 300 requests / minute per IP
  app.use(['/api/v1', '/api'], generalApiLimiter);

  // 5. Body Parsers (Tightly scoped limit 200kb to prevent memory exhaustion DoS)
  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ extended: true, limit: '200kb' }));

  // 6. Payload too large error handler
  app.use(payloadTooLargeHandler);

  // 7. Initialize Database
  const { db } = await import('./server/db');
  await db.initializeAll();

  const PORT = Number(process.env.PORT) || 3000;

  // 8. Ensure UTF-8 charset is explicitly declared on text, javascript, css, and json responses
  app.use((req, res, next) => {
    const originalSetHeader = res.setHeader.bind(res);
    res.setHeader = (name: string, value: any) => {
      if (typeof name === 'string' && name.toLowerCase() === 'content-type' && typeof value === 'string') {
        if (
          (value.startsWith('text/') ||
           value.startsWith('application/javascript') ||
           value.startsWith('application/json')) &&
          !value.toLowerCase().includes('charset')
        ) {
          value = `${value}; charset=utf-8`;
        }
      }
      return originalSetHeader(name, value);
    };
    next();
  });

  // 9. Mount API Router under /api/v1 and /api
  app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter);

  // 10. Start Background Scheduler
  startNotificationAndSlotScheduler();

  // 11. Strict 404 handler for API routes (Never return index.html for API requests)
  app.use(['/api/v1/*', '/api/*'], (_req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
  });

  // 12. Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      dotfiles: 'ignore',
      index: false,
      fallthrough: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
        } else if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        } else if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
        }
      }
    }));
    app.get('*', (_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 13. Global sanitized production error handler (No stack trace or internal path leaks)
  app.use(globalErrorHandler);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  \x1b[32m✔\x1b[0m \x1b[1mQGo App is running!\x1b[0m`);
    console.log(`  \x1b[36m➜\x1b[0m  \x1b[1mLocal:\x1b[0m   \x1b[36mhttp://localhost:${PORT}/\x1b[0m`);
    console.log(`  \x1b[36m➜\x1b[0m  \x1b[1mNetwork:\x1b[0m \x1b[36mhttp://127.0.0.1:${PORT}/\x1b[0m`);
    console.log(`  \x1b[35m📱\x1b[0m \x1b[1mPhone:\x1b[0m   Run \x1b[33mnpm run dev:phone\x1b[0m (Android USB: adb reverse), then open \x1b[36mhttp://localhost:${PORT}/\x1b[0m\n`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start QGo server:', err);
});
