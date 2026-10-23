import { Router } from 'express';
import { ActivityController } from '../controllers/activity.controller';
import { auth } from '../middlewares/auth';

const router = Router();
const controller = new ActivityController();

router.get('/resource', auth, controller.resource);
router.get('/affected', auth, controller.affected);

export default router;
