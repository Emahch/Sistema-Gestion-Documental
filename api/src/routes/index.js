const { Router } = require('express');
const healthRoutes = require('./health.routes');
const documentRoutes = require('./document.routes');

const router = Router();

router.use('/', healthRoutes);
router.use('/documents', documentRoutes);

module.exports = router;
