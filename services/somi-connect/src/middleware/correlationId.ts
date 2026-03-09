import { RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';

const CORRELATION_ID_HEADER = 'X-Correlation-Id';

export const correlationId: RequestHandler = (req, res, next) => {
  // Propagate an existing correlation ID from upstream, or generate a new one
  const existing = req.headers[CORRELATION_ID_HEADER.toLowerCase()];
  const id = Array.isArray(existing) ? existing[0] : (existing ?? uuidv4());

  req.correlationId = id;
  res.setHeader(CORRELATION_ID_HEADER, id);

  next();
}
