import { S3Client } from '@aws-sdk/client-s3';
import { config } from '../config/env.js';

// ---------------------------------------------------------------------------
// S3 Client singleton
// ---------------------------------------------------------------------------

/**
 * True when all required AWS config is present (region + at least one bucket).
 * When false, the upload service falls back to mock pre-signed URLs.
 * This allows the test suite and local-dev-without-AWS to work unchanged.
 */
export const isS3Configured = Boolean(
  config.AWS_REGION && (config.AWS_S3_LIBRARY_BUCKET || config.AWS_S3_PATIENT_BUCKET),
);

/**
 * Singleton S3 client. Only created when AWS config is present.
 * The SDK automatically picks up AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
 * from process.env (or IAM role credentials in ECS/EC2).
 */
export const s3Client: S3Client | null = isS3Configured
  ? new S3Client({ region: config.AWS_REGION! })
  : null;

// ---------------------------------------------------------------------------
// Bucket resolution
// ---------------------------------------------------------------------------

/**
 * Map an upload purpose to the correct S3 bucket.
 *
 * - `exercise_media` → library bucket (non-PHI, public exercise VOD)
 * - Everything else  → patient bucket (PHI)
 */
export function getBucketForPurpose(purpose: string): string {
  if (purpose === 'exercise_media') {
    return config.AWS_S3_LIBRARY_BUCKET ?? 'somi-uploads';
  }
  return config.AWS_S3_PATIENT_BUCKET ?? 'somi-uploads';
}
