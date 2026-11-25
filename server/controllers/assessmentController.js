const { query, withTransaction } = require('../config/db');
const { HttpError } = require('../utils/httpError');

const ASSESSMENT_FIELDS = [
  'attendance', 'internal_marks', 'study_hours',
  'assignment_completion', 'participation', 'previous_marks'
];

function assessmentSelect(whereClause = '') {
  return `
    SELECT a.assessment_id, a.student_id, a.assessment_date,
           a.attendance::float8 AS attendance,
           a.internal_marks::float8 AS internal_marks,
           a.study_hours::float8 AS study_hours,
           a.assignment_completion::float8 AS assignment_completion,
           a.participation::float8 AS participation,
           a.previous_marks::float8 AS previous_marks,
           a.created_at,
           s.full_name, s.enrollment_no, s.course, s.semester, s.section,
           p.prediction_id,
           p.predicted_marks::float8 AS predicted_marks,
           p.performance_category,
           p.risk_score::float8 AS risk_score,
           p.risk_level,
           p.is_mock,
           p.model_used
      FROM assessments a
      JOIN students s ON s.student_id = a.student_id
 LEFT JOIN predictions p ON p.assessment_id = a.assessment_id
      ${whereClause}
  `;
}

async function assertStudentExists(studentId) {
  const r = await query('SELECT 1 FROM students WHERE student_id = $1', [studentId]);
  if (!r.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Student not found.');
}

async function accessInfo(assessmentId) {
  const r = await query(
    `SELECT a.assessment_id, a.student_id FROM assessments a WHERE a.assessment_id = $1`,
    [assessmentId]
  );
  if (!r.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Assessment not found.');
  return r.rows[0];
}

async function createAssessment(req, res, next) {
  try {
    const { student_id: studentId, assessment_date: assessmentDate, ...values } = req.body;
    await assertStudentExists(studentId);

    const result = await query(
      `INSERT INTO assessments
         (student_id, attendance, internal_marks, study_hours, assignment_completion,
          participation, previous_marks, assessment_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8::date, CURRENT_DATE))
       RETURNING assessment_id`,
      [studentId, values.attendance, values.internal_marks, values.study_hours,
        values.assignment_completion, values.participation, values.previous_marks, assessmentDate || null]
    );

    const created = await query(assessmentSelect('WHERE a.assessment_id = $1'), [result.rows[0].assessment_id]);
    return res.status(201).json({
      data: {
        assessment: created.rows[0],
        requires_prediction: true,
        message: 'Assessment saved. Run a prediction to generate risk analysis and recommendations.'
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function updateAssessment(req, res, next) {
  try {
    const id = req.params.id;
    const existing = await accessInfo(id);
    if (req.user.role !== 'admin' && req.user.studentId !== existing.student_id) {
      throw new HttpError(403, 'FORBIDDEN', 'Students may only access their own records.');
    }

    const assignments = [];
    const values = [];
    for (const key of ASSESSMENT_FIELDS) {
      if (req.body[key] !== undefined) {
        values.push(req.body[key]);
        assignments.push(`${key} = $${values.length}`);
      }
    }
    if (req.body.assessment_date !== undefined) {
      values.push(req.body.assessment_date);
      assignments.push(`assessment_date = $${values.length}::date`);
    }
    if (!assignments.length) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'No assessment fields were supplied.');
    }

    values.push(id);
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE assessments SET ${assignments.join(', ')} WHERE assessment_id = $${values.length}`,
        values
      );
      // A prediction belongs to the exact inputs that produced it. Editing an
      // assessment invalidates the old prediction and its recommendations.
      await client.query('DELETE FROM predictions WHERE assessment_id = $1', [id]);
      await client.query('DELETE FROM progress_records WHERE assessment_id = $1', [id]);
    });

    const updated = await query(assessmentSelect('WHERE a.assessment_id = $1'), [id]);
    return res.json({
      data: {
        assessment: updated.rows[0],
        requires_prediction: true,
        message: 'Assessment updated. The previous prediction was removed because the inputs changed.'
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function listAssessments(req, res, next) {
  try {
    const { page, page_size: pageSize, student_id: studentId } = req.validatedQuery;
    const isAdmin = req.user.role === 'admin';
    let effectiveStudentId = studentId;

    if (!isAdmin) {
      if (!req.user.studentId) throw new HttpError(403, 'FORBIDDEN', 'This account has no student profile.');
      if (effectiveStudentId && effectiveStudentId !== req.user.studentId) {
        throw new HttpError(403, 'FORBIDDEN', 'Students may only access their own records.');
      }
      effectiveStudentId = req.user.studentId;
    }

    const offset = (page - 1) * pageSize;
    const where = effectiveStudentId ? 'WHERE a.student_id = $1' : '';
    const params = effectiveStudentId ? [effectiveStudentId] : [];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

    const count = await query(
      `SELECT COUNT(*)::int AS total FROM assessments a ${where}`,
      params
    );
    const rows = await query(
      `${assessmentSelect(where)}
       ORDER BY a.assessment_date DESC, a.assessment_id DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, pageSize, offset]
    );

    return res.json({
      data: {
        assessments: rows.rows,
        pagination: {
          page,
          page_size: pageSize,
          total: count.rows[0].total,
          total_pages: Math.max(1, Math.ceil(count.rows[0].total / pageSize))
        }
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function getAssessment(req, res, next) {
  try {
    const info = await accessInfo(req.params.id);
    if (req.user.role !== 'admin' && req.user.studentId !== info.student_id) {
      throw new HttpError(403, 'FORBIDDEN', 'Students may only access their own records.');
    }
    const row = await query(assessmentSelect('WHERE a.assessment_id = $1'), [req.params.id]);
    return res.json({ data: { assessment: row.rows[0] } });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createAssessment, updateAssessment, listAssessments, getAssessment };
