const express = require('express');
const { createAssessment, updateAssessment, listAssessments, getAssessment } = require('../controllers/assessmentController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  assessmentSchema, assessmentUpdateSchema, idParamsSchema, assessmentListQuerySchema
} = require('../utils/validators');

const router = express.Router();
router.use(requireAuth);

router.post('/', requireRole('admin'), validate({ body: assessmentSchema }), createAssessment);
router.put('/:id', requireRole('admin'),
  validate({ params: idParamsSchema, body: assessmentUpdateSchema }), updateAssessment);
router.get('/', validate({ query: assessmentListQuerySchema }), listAssessments);
router.get('/:id', validate({ params: idParamsSchema }), getAssessment);

module.exports = router;
