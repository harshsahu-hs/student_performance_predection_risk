const express = require('express');
const {
  listStudents, getStudent, getOwnStudent, createStudent, updateStudent,
  setStudentStatus, deleteStudent, getProgress, getPredictions, getRecommendations
} = require('../controllers/studentController');
const { requireAuth, requireRole, requireSelfOrAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  studentCreateSchema, studentUpdateSchema, studentStatusSchema,
  paginationSchema, idParamsSchema, recommendationsQuerySchema
} = require('../utils/validators');

const router = express.Router();
router.use(requireAuth);

router.get('/', requireRole('admin'), validate({ query: paginationSchema }), listStudents);
router.post('/', requireRole('admin'), validate({ body: studentCreateSchema }), createStudent);

router.get('/me', getOwnStudent);

router.get('/:id', validate({ params: idParamsSchema }), requireSelfOrAdmin('id'), getStudent);
router.put('/:id', requireRole('admin'), validate({ params: idParamsSchema, body: studentUpdateSchema }), updateStudent);
router.patch('/:id/status', requireRole('admin'),
  validate({ params: idParamsSchema, body: studentStatusSchema }), setStudentStatus);
router.delete('/:id', requireRole('admin'), validate({ params: idParamsSchema }), deleteStudent);

router.get('/:id/progress', validate({ params: idParamsSchema }), requireSelfOrAdmin('id'), getProgress);
router.get('/:id/predictions', validate({ params: idParamsSchema }), requireSelfOrAdmin('id'), getPredictions);
router.get('/:id/recommendations', validate({ params: idParamsSchema, query: recommendationsQuerySchema }),
  requireSelfOrAdmin('id'), getRecommendations);

module.exports = router;
