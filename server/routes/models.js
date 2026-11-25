const express = require('express');
const { metrics } = require('../controllers/modelController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.get('/metrics', requireAuth, requireRole('admin'), metrics);

module.exports = router;
