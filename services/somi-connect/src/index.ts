// Must be the very first import so env vars are populated before any other
// module reads from process.env.
import 'dotenv/config';

import http from 'http';
import { config } from './config/env.js';
import { connectDB, disconnectDB } from './lib/db.js';
import { logger } from './lib/logger.js';
import { createApp } from './app.js';

async function main(): Promise<void> {
  // Connect to MongoDB before accepting traffic
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  server.listen(config.PORT, () => {
    logger.info('Server started', {
      port: config.PORT,
      environment: config.NODE_ENV,
    });
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown
  // ---------------------------------------------------------------------------
  async function shutdown(signal: string): Promise<void> {
    logger.info('Shutdown signal received', { signal });

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await disconnectDB();
      } catch (err) {
        logger.error('Error during shutdown', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      process.exit(0);
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT',  () => { void shutdown('SIGINT'); });
}

main().catch((err: unknown) => {
  logger.error('Fatal startup error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
