const express = require('express');
const router = express.Router();

const cardController = require('../controllers/cardController');

router.get('/', cardController.index);

router.get('/:id', cardController.get);

router.get('/search/:query', cardController.find);

module.exports = router;
