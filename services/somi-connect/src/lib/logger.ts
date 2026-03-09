// ---------------------------------------------------------------------------
// Structured JSON logger
// Outputs to stdout/stderr — Datadog agent picks these up automatically.
// ---------------------------------------------------------------------------

const SERVICE = 'somi-connect';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  [key: string]: unknown;
}

function buildEntry(
  level: LogLevel,
  message: string,
  context: Record<string, unknown> = {},
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: SERVICE,
    environment: process.env['NODE_ENV'] ?? 'development',
    ...context,
  };
}

export const logger = {
  debug(message: string, context: Record<string, unknown> = {}): void {
    // Suppress debug logs in production
    if (process.env['NODE_ENV'] === 'production') return;
    console.log(JSON.stringify(buildEntry('debug', message, context)));
  },

  info(message: string, context: Record<string, unknown> = {}): void {
    console.log(JSON.stringify(buildEntry('info', message, context)));
  },

  warn(message: string, context: Record<string, unknown> = {}): void {
    console.warn(JSON.stringify(buildEntry('warn', message, context)));
  },

  error(message: string, context: Record<string, unknown> = {}): void {
    console.error(JSON.stringify(buildEntry('error', message, context)));
  },
};
