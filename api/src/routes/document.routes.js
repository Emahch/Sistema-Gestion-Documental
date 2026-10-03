const { Router } = require('express');
const controller = require('../controllers/document.controller');

const router = Router();

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', controller.create);
router.delete('/:id', controller.remove);

module.exports = router;
