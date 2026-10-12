import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth';
import { UnauthorizedError } from '../errors/http-error';
import { UserService } from '../services/user.service';

export class UserController {
  private readonly userService = new UserService();

  updateSelf = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Token requerido');
      }
      const user = await this.userService.updateSelf(req.user.id, req.body);
      res.json(user);
    } catch (err) {
      next(err);
    }
  };

  list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.userService.listUsers(req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.createUser(req.body, req.user?.id ?? null);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  };
}
