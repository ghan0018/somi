import { Router, RequestHandler } from 'express';

export const healthRouter = Router();

// GET /healthz — no authentication required
const getHealth: RequestHandler = (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
};

healthRouter.get('/healthz', getHealth);
