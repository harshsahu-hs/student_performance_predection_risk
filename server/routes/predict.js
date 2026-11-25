const express = require('express');
const { runPrediction } = require('../controllers/predictionController');
const { metadata } = require('../controllers/modelController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { predictSchema } = require('../utils/validators');
const { predictLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/', requireAuth, requireRole('admin'), predictLimiter,
  validate({ body: predictSchema }), runPrediction);
router.get('/metadata', requireAuth, metadata);

module.exports = router;
