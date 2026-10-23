import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { auth } from '../middlewares/auth';

const router = Router();
const controller = new SearchController();

router.get('/', auth, controller.search);

export default router;
