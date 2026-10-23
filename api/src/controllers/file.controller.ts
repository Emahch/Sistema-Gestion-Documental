import type { NextFunction, Request, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth';
import { UnauthorizedError } from '../errors/http-error';
import { FileService } from '../services/file.service';
import { SearchService } from '../services/search.service';

export class FileController {
  private readonly fileService = new FileService();
  private readonly searchService = new SearchService();

  filter = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.searchService.filterFiles(userId(req), req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };

  upload = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = await this.fileService.uploadFile(userId(req), req);
      res.status(201).json(file);
    } catch (err) {
      next(err);
    }
  };

  getOne = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = await this.fileService.getFile(userId(req), routeParam(req));
      res.json(file);
    } catch (err) {
      next(err);
    }
  };

  download = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stream = await this.fileService.downloadFile(userId(req), routeParam(req), res);
      stream.on('error', (err: Error) => {
        this.fileService.logDownloadError(userId(req), routeParam(req), err.message).catch(() => undefined);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error al leer el contenido' });
        } else {
          res.destroy(err);
        }
      });
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  };

  preview = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stream = await this.fileService.previewFile(userId(req), routeParam(req), res);
      stream.on('error', (err: Error) => {
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error al leer el contenido' });
        } else {
          res.destroy(err);
        }
      });
      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  };

  edit = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = await this.fileService.editContent(userId(req), routeParam(req), req);
      res.json(file);
    } catch (err) {
      next(err);
    }
  };

  rename = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = await this.fileService.renameFile(userId(req), routeParam(req), req.body.name);
      res.json(file);
    } catch (err) {
      next(err);
    }
  };

  move = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = await this.fileService.moveFile(userId(req), routeParam(req), req.body.destinationId);
      res.json(file);
    } catch (err) {
      next(err);
    }
  };

  trash = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.fileService.trashFile(userId(req), routeParam(req));
      res.status(200).json(result);
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
