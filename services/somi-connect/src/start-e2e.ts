/**
 * E2E server bootstrap
 *
 * Starts an in-process MongoMemoryServer, then loads the main Express app.
 * This means you do NOT need a real MongoDB running locally or in CI.
 *
 * Usage:
 *   npm run start:e2e -w somi-connect
 *
 *   # Or via the repo-root helper (preferred — also waits for the server):
 *   ./scripts/test-ios-uitests.sh
 *
 * Never use this in production.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';

if (process.env.NODE_ENV === 'production') {
  throw new Error('start-e2e must not be used in production');
}

async function main(): Promise<void> {
  // Provide safe defaults so the Express env validator passes.
  // Existing values (e.g. injected by CI secrets) always take priority.
  process.env.NODE_ENV ||= 'development';
  process.env.JWT_ACCESS_SECRET ||= 'e2e-access-secret-not-for-production';
  process.env.JWT_REFRESH_SECRET ||= 'e2e-refresh-secret-not-for-production';
  process.env.TEST_SECRET ||= 'test-secret-dev';
  process.env.PORT ||= '3000';

  // Start in-process MongoDB and inject its URI *before* index.ts loads.
  // dotenv (called in index.ts) won't override an already-set env var,
  // so MONGODB_URI will correctly point at our ephemeral instance.
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  // Boot the real Express server
  await import('./index.js');

  const stop = async () => {
    await mongod.stop();
    process.exit(0);
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

main().catch(err => {
  console.error('Failed to start e2e server:', err);
  process.exit(1);
});
