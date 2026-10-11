import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserModel } from '../models/user.model';
import type { AuthUser, JwtPayload } from '../types/auth';
import { UnauthorizedError } from '../errors/http-error';

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export async function auth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(new UnauthorizedError('Token requerido'));
    return;
  }
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch {
    next(new UnauthorizedError('Token inválido o expirado'));
    return;
  }
  const user = await UserModel.findById(payload.sub);
  if (!user || !user.isActive) {
    next(new UnauthorizedError('Usuario inactivo o inexistente'));
    return;
  }
  req.user = { id: user._id.toString(), role: user.role };
  next();
}
