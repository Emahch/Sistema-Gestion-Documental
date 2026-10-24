import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth';
import { ReportService } from '../services/report.service';

export class ReportController {
  private readonly reportService = new ReportService();

  filesByCategory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json(await this.reportService.filesByCategory());
    } catch (err) {
      next(err);
    }
  };

  filesByDate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json(await this.reportService.filesByDate(req.query));
    } catch (err) {
      next(err);
    }
  };

  topFiles = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.reportService.topFilesByOperations(req.query));
    } catch (err) {
      next(err);
    }
  };

  topUsersByFiles = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json(await this.reportService.topUsersByFiles());
    } catch (err) {
      next(err);
    }
  };

  topUsersByShared = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json(await this.reportService.topUsersBySharedResources(req.query));
    } catch (err) {
      next(err);
    }
  };

  topSharedFiles = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json(await this.reportService.topSharedFiles(req.query));
    } catch (err) {
      next(err);
    }
  };

  sharedByUser = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json(await this.reportService.sharedByUser(req.query.userId, req.query));
    } catch (err) {
      next(err);
    }
  };

  receivedByUser = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json(await this.reportService.receivedByUser(req.query.userId, req.query));
    } catch (err) {
      next(err);
    }
  };

  userActivity = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json(await this.reportService.userActivity(req.query.userId, req.query));
    } catch (err) {
      next(err);
    }
  };

  operationsByAction = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json(await this.reportService.operationsByAction());
    } catch (err) {
      next(err);
    }
  };

  operationsByPeriod = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      res.json(await this.reportService.operationsByPeriod(req.query));
    } catch (err) {
      next(err);
    }
  };

  users = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json(await this.reportService.listUsers());
    } catch (err) {
      next(err);
    }
  };
}
