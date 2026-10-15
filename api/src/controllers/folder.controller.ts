import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth';
import { UnauthorizedError } from '../errors/http-error';
import { FolderService } from '../services/folder.service';

export class FolderController {
  private readonly folderService = new FolderService();

  list = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parentId = typeof req.query.parentId === 'string' ? req.query.parentId : null;
      const result = await this.folderService.listChildren(userId(req), parentId, req.query.page, req.query.limit);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  root = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const folder = await this.folderService.root(userId(req));
      res.json(folder);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const folder = await this.folderService.createFolder(userId(req), req.body.parentId, req.body.name);
      res.status(201).json(folder);
    } catch (err) {
      next(err);
    }
  };

  rename = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const folder = await this.folderService.renameFolder(userId(req), routeParam(req), req.body.name);
      res.json(folder);
    } catch (err) {
      next(err);
    }
  };

  move = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const folder = await this.folderService.moveFolder(userId(req), routeParam(req), req.body.destinationId);
      res.json(folder);
    } catch (err) {
      next(err);
    }
  };

  breadcrumb = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const chain = await this.folderService.breadcrumb(userId(req), routeParam(req));
      res.json(chain);
    } catch (err) {
      next(err);
    }
  };

  trash = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.folderService.trashFolder(userId(req), routeParam(req));
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
