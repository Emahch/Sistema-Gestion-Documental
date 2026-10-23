import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth';
import { UnauthorizedError } from '../errors/http-error';
import { SearchService } from '../services/search.service';

export class SearchController {
  private readonly searchService = new SearchService();

  search = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Token requerido');
      }
      const result = await this.searchService.search(req.user.id, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
