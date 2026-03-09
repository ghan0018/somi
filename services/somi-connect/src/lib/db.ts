import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { logger } from './logger.js';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(config.MONGODB_URI);
    logger.info('MongoDB connected', { uri: redactUri(config.MONGODB_URI) });
  } catch (err) {
    logger.error('MongoDB connection failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function disconnectDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
  } catch (err) {
    logger.error('MongoDB disconnect failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// Redact credentials from URI before logging
function redactUri(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.password) parsed.password = '***';
    if (parsed.username) parsed.username = '***';
    return parsed.toString();
  } catch {
    return '[invalid uri]';
  }
}
