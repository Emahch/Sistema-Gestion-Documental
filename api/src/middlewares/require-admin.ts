import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth';
import { ForbiddenError } from '../errors/http-error';

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    next(new ForbiddenError('Se requiere rol de administrador'));
    return;
  }
  next();
}
