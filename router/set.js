const express = require('express');
const router = express.Router();

const setController = require('../controllers/setController');

router.get('/search/:query',  setController.find);

router.get('/:id', setController.get);

router.get('/', setController.index);

module.exports = router;