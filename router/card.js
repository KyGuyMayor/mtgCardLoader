const express = require('express');
const { card } = require('mtgsdk');
const router = express.Router();

const cardController = require('../controllers/cardController');

router.get('/', cardController.index);

router.get('/:id', cardController.get);

router.get('/search/:query', cardController.find);

router.get('/format/commander', cardController.commander);

module.exports = router;