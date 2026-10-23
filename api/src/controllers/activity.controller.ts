import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth';
import { UnauthorizedError } from '../errors/http-error';
import { ActivityService } from '../services/activity.service';

export class ActivityController {
  private readonly activityService = new ActivityService();

  resource = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isAdmin = req.user?.role === 'admin';
      const result = await this.activityService.resourceHistory(
        userId(req),
        req.query.resourceType,
        req.query.resourceId,
        req.query,
        isAdmin
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  affected = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.activityService.affected(userId(req), req.query);
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
