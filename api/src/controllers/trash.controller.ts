import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth';
import { UnauthorizedError } from '../errors/http-error';
import { TrashService } from '../services/trash.service';

export class TrashController {
  private readonly trashService = new TrashService();

  list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const entries = await this.trashService.list(userId(req));
      res.json(entries);
    } catch (err) {
      next(err);
    }
  };

  contents = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.trashService.contents(userId(req), routeParam(req));
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  restore = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.trashService.restore(
        userId(req),
        routeParam(req),
        bodyValue(req, 'destinationId')
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  restoreItem = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.trashService.restoreItem(
        userId(req),
        routeParam(req),
        bodyValue(req, 'destinationId')
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.trashService.deletePermanent(userId(req), routeParam(req));
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}

function userId(req: AuthRequest): string {
  if (!req.user) {
    throw new UnauthorizedError('Token requerido');
  }
  return req.user.id;
}

function routeParam(req: AuthRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
}

function bodyValue(req: AuthRequest, key: string): string {
  const value = req.body?.[key];
  return typeof value === 'string' ? value : '';
}
