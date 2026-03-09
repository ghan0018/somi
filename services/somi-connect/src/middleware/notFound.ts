import { RequestHandler } from 'express';
import { ERROR_CODES } from '../lib/errors.js';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `Route not found: ${req.method} ${req.path}`,
      details: {},
    },
  });
}
