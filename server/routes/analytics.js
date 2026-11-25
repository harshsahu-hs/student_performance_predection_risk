const express = require('express');
const { z } = require('zod');
const { overview, riskList } = require('../controllers/analyticsController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const riskQuery = z.object({
  level: z.enum(['all', 'medium', 'high']).default('all')
}).strict();

const router = express.Router();
router.use(requireAuth, requireRole('admin'));
router.get('/overview', overview);
router.get('/risk', validate({ query: riskQuery }), riskList);

module.exports = router;
