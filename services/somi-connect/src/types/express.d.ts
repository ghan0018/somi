import 'express';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      userId?: string;
      role?: 'client' | 'therapist' | 'admin';
    }
  }
}

export {};
