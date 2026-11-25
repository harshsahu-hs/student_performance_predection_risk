const express = require('express');
const { studentReport } = require('../controllers/reportController');
const { requireAuth, requireSelfOrAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParamsSchema } = require('../utils/validators');
const { reportLimiter } = require('../middleware/rateLimit');

const router = express.Router();
router.get('/student/:id',
  requireAuth,
  reportLimiter,
  validate({ params: idParamsSchema }),
  requireSelfOrAdmin('id'),
  studentReport);

module.exports = router;
