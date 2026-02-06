const express = require('express');
const router = express.Router();

const collectionController = require('../controllers/collectionController');
const entryController = require('../controllers/entryController');
const authenticate = require('../middleware/auth');

router.use(authenticate);

router.get('/', collectionController.list);
router.get('/:id', collectionController.getById);
router.post('/', collectionController.create);
router.put('/:id', collectionController.update);
router.delete('/:id', collectionController.remove);

router.post('/:id/entries', entryController.create);
router.put('/:id/entries/:entryId', entryController.update);
router.delete('/:id/entries/:entryId', entryController.remove);

module.exports = router;
