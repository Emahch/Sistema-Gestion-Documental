import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth';
import { ForbiddenError, UnauthorizedError } from '../errors/http-error';

export function requireSelfOrAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const paramsId = typeof req.params.id === 'string' ? req.params.id : '';
  if (!req.user) {
    next(new UnauthorizedError('Token requerido'));
    return;
  }
  if (req.user.role !== 'admin' && req.user.id !== paramsId) {
    next(new ForbiddenError('Solo puedes consultar tu propia información'));
    return;
  }
  next();
}
