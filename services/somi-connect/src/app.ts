import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

import { correlationId } from './middleware/correlationId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rootRouter } from './routes/index.js';
import { testRouter } from './routes/test.routes.js';

export function createApp(): express.Application {
  const app = express();

  // ---------------------------------------------------------------------------
  // Security headers
  // ---------------------------------------------------------------------------
  app.use(helmet());

  // ---------------------------------------------------------------------------
  // Prevent proxy/CDN caching of API responses
  // ---------------------------------------------------------------------------
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'private');
    next();
  });

  // ---------------------------------------------------------------------------
  // CORS
  // ---------------------------------------------------------------------------
  app.use(cors());

  // ---------------------------------------------------------------------------
  // Body parsing
  // ---------------------------------------------------------------------------
  app.use(express.json());

  // ---------------------------------------------------------------------------
  // Request enrichment & observability
  // ---------------------------------------------------------------------------
  app.use(correlationId);
  app.use(requestLogger);

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------
  app.use(rootRouter);

  // ---------------------------------------------------------------------------
  // Test-only routes (never mounted in production)
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    app.use('/test', testRouter);
  }

  // ---------------------------------------------------------------------------
  // Fallthrough handlers (must come last)
  // ---------------------------------------------------------------------------
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
