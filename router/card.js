const express = require('express');
const router = express.Router();

const cardController = require('../controllers/cardController');

router.get('/', cardController.index);

router.post('/collection', cardController.collection);

router.get('/named', cardController.named);

router.get('/:id/printings', cardController.printings);

router.get('/:id/rulings', cardController.rulings);

router.get('/:id', cardController.get);

router.get('/search/:query', cardController.find);

router.get('/random', cardController.random);

module.exports = router;
