const express = require('express');
const router = express.Router();

const sharedCollectionController = require('../controllers/sharedCollectionController');
const optionalAuth = require('../middleware/optionalAuth');

// Apply optional auth middleware to all routes
router.use(optionalAuth);

// GET /shared/collections/:slug
router.get('/collections/:slug', sharedCollectionController.getBySlug);

module.exports = router;
