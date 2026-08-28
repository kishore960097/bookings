import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter, startNotificationAndSlotScheduler } from './server/routes';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Standard middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'QGo API', timestamp: new Date().toISOString() });
  });

  // Mount API Router under /api/v1 and /api
  app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter);

  // Start Background Reminder Scheduler
  startNotificationAndSlotScheduler();

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  \x1b[32m✔\x1b[0m \x1b[1mQGo App is running!\x1b[0m`);
    console.log(`  \x1b[36m➜\x1b[0m  \x1b[1mLocal:\x1b[0m   \x1b[36mhttp://localhost:${PORT}/\x1b[0m`);
    console.log(`  \x1b[36m➜\x1b[0m  \x1b[1mNetwork:\x1b[0m \x1b[36mhttp://127.0.0.1:${PORT}/\x1b[0m\n`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start QGo server:', err);
});
