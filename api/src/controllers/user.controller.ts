import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth';
import { UnauthorizedError } from '../errors/http-error';
import { UserService } from '../services/user.service';

function routeParam(req: AuthRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
}

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

  findByEmail = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = typeof req.query.email === 'string' ? req.query.email : '';
      const user = await this.userService.findByEmail(email);
      res.json(user);
    } catch (err) {
      next(err);
    }
  };

  search = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Token requerido');
      }
      const query = typeof req.query.q === 'string' ? req.query.q : '';
      const users = await this.userService.searchUsers(query, req.user.id);
      res.json(users);
    } catch (err) {
      next(err);
    }
  };

  setStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.setActiveStatus(routeParam(req), req.body.isActive, req.user?.id ?? null);
      res.json(user);
    } catch (err) {
      next(err);
    }
  };

  setQuota = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.updateQuota(routeParam(req), req.body.quotaBytes, req.user?.id ?? null);
      res.json(user);
    } catch (err) {
      next(err);
    }
  };

  storage = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const info = await this.userService.getStorage(routeParam(req), req.query.reconcile === 'true');
      res.json(info);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.updateUser(routeParam(req), req.body, req.user?.id ?? null);
      res.json(user);
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
