import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors/http-error';

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ message: 'Ruta no encontrada' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  const status = err instanceof HttpError ? err.statusCode : 500;
  res.status(status).json({ message: err.message || 'Error interno' });
}
