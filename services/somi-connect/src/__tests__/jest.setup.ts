/**
 * jest.setup.ts — runs via Jest's `setupFiles` option, before any test modules
 * are imported. This is the correct place to set env vars that config/env.ts
 * reads at import time.
 */
process.env['NODE_ENV'] = 'test';
process.env['MONGODB_URI'] = 'mongodb://127.0.0.1:27017/somi-test-placeholder';
process.env['JWT_ACCESS_SECRET'] = 'test-access-secret-at-least-32-chars-long';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-at-least-32-chars-long';
process.env['JWT_ACCESS_EXPIRES_IN'] = '3600';
process.env['JWT_REFRESH_EXPIRES_IN'] = '604800';
process.env['PORT'] = '0';
