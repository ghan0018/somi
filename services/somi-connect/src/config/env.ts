// ---------------------------------------------------------------------------
// Environment configuration
// Validates required vars at startup and exports a typed config object.
// dotenv must be loaded before this module is imported (done in index.ts).
// ---------------------------------------------------------------------------

interface Config {
  // Server
  NODE_ENV: string;
  PORT: number;

  // Database
  MONGODB_URI: string;

  // JWT
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: number;  // seconds
  JWT_REFRESH_EXPIRES_IN: number; // seconds

  // AWS (optional)
  AWS_REGION: string | undefined;
  AWS_S3_LIBRARY_BUCKET: string | undefined;
  AWS_S3_PATIENT_BUCKET: string | undefined;

  // Test helpers (non-production only)
  TEST_SECRET: string | undefined;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name] ?? undefined;
}

function optionalEnvInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${raw}`);
  }
  return parsed;
}

export const config: Config = {
  NODE_ENV: requireEnv('NODE_ENV'),
  PORT: optionalEnvInt('PORT', 3000),

  MONGODB_URI: requireEnv('MONGODB_URI'),

  JWT_ACCESS_SECRET: requireEnv('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: optionalEnvInt('JWT_ACCESS_EXPIRES_IN', 3600),
  JWT_REFRESH_EXPIRES_IN: optionalEnvInt('JWT_REFRESH_EXPIRES_IN', 604800),

  AWS_REGION: optionalEnv('AWS_REGION'),
  AWS_S3_LIBRARY_BUCKET: optionalEnv('AWS_S3_LIBRARY_BUCKET'),
  AWS_S3_PATIENT_BUCKET: optionalEnv('AWS_S3_PATIENT_BUCKET'),

  TEST_SECRET: process.env['NODE_ENV'] !== 'production'
    ? (process.env['TEST_SECRET'] ?? 'test-secret-dev')
    : optionalEnv('TEST_SECRET'),
};
