import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth';
import { UserService } from '../services/user.service';

export class UserController {
  private readonly userService = new UserService();

  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.createUser(req.body, req.user?.id ?? null);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  };
}
