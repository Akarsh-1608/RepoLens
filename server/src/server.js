import app from './app.js';
import { config } from './config.js';
import { testConnection } from './db/pool.js';
import { runMigrations } from './db/migrations.js';
import { initQueue, closeQueue } from './jobs/queue.js';

async function start() {
  console.log(`[server] Starting RepoLens server (${config.nodeEnv})...`);

  // Database connection
  const dbOk = await testConnection();
  if (!dbOk) {
    console.error('[server] Cannot connect to database. Exiting.');
    process.exit(1);
  }

  // Run migrations
  try {
    await runMigrations();
  } catch (err) {
    console.error('[server] Migration failed:', err.message);
    process.exit(1);
  }

  // Initialize job queue
  await initQueue();

  // Start HTTP server
  const server = app.listen(config.port, () => {
    console.log(`[server] Listening on port ${config.port}`);
    console.log(`[server] API: http://localhost:${config.port}`);
    console.log(`[server] Health: http://localhost:${config.port}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      await closeQueue();
      console.log('[server] Shutdown complete');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[server] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
