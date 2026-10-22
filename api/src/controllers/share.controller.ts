import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth';
import { UnauthorizedError } from '../errors/http-error';
import { ShareService } from '../services/share.service';

export class ShareController {
  private readonly shareService = new ShareService();

  share = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { share, created } = await this.shareService.shareResource(userId(req), req.body, 'manual');
      res.status(created ? 201 : 200).json(share);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const share = await this.shareService.updatePermission(userId(req), req.body);
      res.json(share);
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.shareService.removeShare(userId(req), req.body);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  forResource = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shares = await this.shareService.listForResource(
        userId(req),
        req.query.resourceType,
        req.query.resourceId
      );
      res.json(shares);
    } catch (err) {
      next(err);
    }
  };

  withMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.shareService.sharedWithMe(userId(req), req.query.page, req.query.limit);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  byMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.shareService.sharedByMe(userId(req), req.query.page, req.query.limit);
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
