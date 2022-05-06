const express = require('express');
const router = express.Router();

const setController = require('../controllers/setController');

router.get('/search/:query',  setController.search);

module.exports = router;