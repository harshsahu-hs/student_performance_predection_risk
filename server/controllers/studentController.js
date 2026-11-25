const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { query, withTransaction } = require('../config/db');
const { HttpError } = require('../utils/httpError');
const { logAuthEvent } = require('../services/authAudit');

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

function duplicateDetails(row) {
  const details = [];
  if (row.email_taken) details.push({ field: 'email', message: 'An account with this email already exists.' });
  if (row.username_taken) details.push({ field: 'username', message: 'This username is already taken.' });
  if (row.enrollment_taken) details.push({ field: 'enrollment_no', message: 'This enrollment number is already registered.' });
  return details;
}

const studentSelect = `
  SELECT s.student_id, s.user_id, s.enrollment_no, s.full_name, s.course, s.semester, s.section,
         s.created_at, s.updated_at, u.username, u.email, u.is_active,
         la.assessment_id AS latest_assessment_id,
         la.assessment_date AS latest_assessment_date,
         lp.prediction_id AS latest_prediction_id,
         lp.predicted_marks::float8 AS predicted_marks,
         lp.performance_category,
         lp.risk_score::float8 AS risk_score,
         lp.risk_level,
         lp.created_at AS predicted_at
    FROM students s
    JOIN users u ON u.user_id = s.user_id
    LEFT JOIN LATERAL (
      SELECT a.assessment_id, a.assessment_date
        FROM assessments a
       WHERE a.student_id = s.student_id
       ORDER BY a.assessment_date DESC, a.assessment_id DESC
       LIMIT 1
    ) la ON TRUE
    LEFT JOIN LATERAL (
      SELECT p.prediction_id, p.predicted_marks, p.performance_category,
             p.risk_score, p.risk_level, p.created_at
        FROM predictions p
        JOIN assessments a2 ON a2.assessment_id = p.assessment_id
       WHERE a2.student_id = s.student_id
       ORDER BY a2.assessment_date DESC, a2.assessment_id DESC
       LIMIT 1
    ) lp ON TRUE
`;

async function listStudents(req, res, next) {
  try {
    const { page, page_size: pageSize, search, status } = req.validatedQuery;
    const searchPattern = search ? `%${escapeLike(search)}%` : '';
    const where = `
      WHERE ($1 = '' OR s.full_name ILIKE $1 ESCAPE '\\' OR s.enrollment_no ILIKE $1 ESCAPE '\\'
             OR u.email ILIKE $1 ESCAPE '\\' OR s.course ILIKE $1 ESCAPE '\\')
        AND ($2 = 'all'
             OR ($2 = 'active' AND u.is_active = TRUE)
             OR ($2 = 'inactive' AND u.is_active = FALSE))
    `;

    const count = await query(
      `SELECT COUNT(*)::int AS total FROM students s JOIN users u ON u.user_id = s.user_id ${where}`,
      [searchPattern, status]
    );
    const offset = (page - 1) * pageSize;
    const rows = await query(
      `${studentSelect} ${where}
       ORDER BY s.created_at DESC, s.student_id DESC
       LIMIT $3 OFFSET $4`,
      [searchPattern, status, pageSize, offset]
    );

    return res.json({
      data: {
        students: rows.rows,
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

async function getStudent(req, res, next) {
  try {
    const id = req.params.id;
    const result = await query(`${studentSelect} WHERE s.student_id = $1`, [id]);
    if (!result.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Student not found.');

    const stats = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM assessments WHERE student_id = $1) AS assessment_count,
         (SELECT COUNT(*)::int FROM predictions p JOIN assessments a ON a.assessment_id = p.assessment_id
           WHERE a.student_id = $1) AS prediction_count,
         (SELECT AVG(p.predicted_marks)::float8 FROM predictions p
            JOIN assessments a ON a.assessment_id = p.assessment_id
           WHERE a.student_id = $1) AS average_predicted_marks`,
      [id]
    );

    return res.json({ data: { student: result.rows[0], stats: stats.rows[0] } });
  } catch (err) {
    return next(err);
  }
}

async function getOwnStudent(req, res, next) {
  try {
    if (!req.user.studentId) throw new HttpError(403, 'FORBIDDEN', 'This account has no student profile.');
    req.params.id = String(req.user.studentId);
    return getStudent(req, res, next);
  } catch (err) {
    return next(err);
  }
}

async function createStudent(req, res, next) {
  try {
    const { username, email, password, full_name, enrollment_no, course, semester, section } = req.body;

    const duplicate = await query(
      `SELECT
         EXISTS (SELECT 1 FROM users WHERE email = $1) AS email_taken,
         EXISTS (SELECT 1 FROM users WHERE username = $2) AS username_taken,
         EXISTS (SELECT 1 FROM students WHERE enrollment_no = $3) AS enrollment_taken`,
      [email, username, enrollment_no]
    );
    const details = duplicateDetails(duplicate.rows[0]);
    if (details.length) {
      throw new HttpError(409, 'DUPLICATE_ACCOUNT', 'An account with these details already exists.', details);
    }

    const temporaryPassword = password || `Sp-${crypto.randomBytes(6).toString('base64url')}9a`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const student = await withTransaction(async (client) => {
      const insertedUser = await client.query(
        `INSERT INTO users (username, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, 'student', TRUE)
         RETURNING user_id`,
        [username, email, passwordHash]
      );
      const row = await client.query(
        `INSERT INTO students (user_id, enrollment_no, full_name, course, semester, section)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING student_id`,
        [insertedUser.rows[0].user_id, enrollment_no, full_name, course, semester, section || null]
      );
      return row.rows[0];
    });

    await logAuthEvent({ userId: null, email, eventType: 'approval', ip: req.ip });
    const created = await query(`${studentSelect} WHERE s.student_id = $1`, [student.student_id]);

    return res.status(201).json({
      data: {
        student: created.rows[0],
        ...(password ? {} : {
          temporary_password: temporaryPassword,
          note: 'Temporary password is shown once. Share it securely and ask the student to change it.'
        })
      }
    });
  } catch (err) {
    if (err.code === '23505') {
      return next(new HttpError(409, 'DUPLICATE_ACCOUNT', 'An account with these details already exists.', [
        { field: 'account', message: 'Duplicate email, username or enrollment number.' }
      ]));
    }
    return next(err);
  }
}

async function updateStudent(req, res, next) {
  try {
    const id = req.params.id;
    const fields = [];
    const values = [];
    const allowed = ['full_name', 'course', 'semester', 'section'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        values.push(req.body[key] === '' ? null : req.body[key]);
        fields.push(`${key} = $${values.length}`);
      }
    }
    if (!fields.length) throw new HttpError(400, 'VALIDATION_ERROR', 'No editable fields were supplied.');

    values.push(id);
    const result = await query(
      `UPDATE students SET ${fields.join(', ')}, updated_at = NOW()
        WHERE student_id = $${values.length}
        RETURNING student_id`,
      values
    );
    if (!result.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Student not found.');

    const updated = await query(`${studentSelect} WHERE s.student_id = $1`, [id]);
    return res.json({ data: { student: updated.rows[0] } });
  } catch (err) {
    return next(err);
  }
}

async function setStudentStatus(req, res, next) {
  try {
    const id = req.params.id;
    const { is_active: isActive } = req.body;

    const result = await query(
      `UPDATE users u
          SET is_active = $2, updated_at = NOW()
         FROM students s
        WHERE s.user_id = u.user_id AND s.student_id = $1
        RETURNING u.user_id, u.email, u.is_active`,
      [id, isActive]
    );
    if (!result.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Student not found.');

    await logAuthEvent({
      userId: result.rows[0].user_id,
      email: result.rows[0].email,
      eventType: isActive ? 'approval' : 'deactivation',
      ip: req.ip
    });

    return res.json({
      data: {
        message: isActive ? 'Account activated.' : 'Account deactivated. Existing sessions lose access immediately.',
        student_id: Number(id),
        is_active: result.rows[0].is_active
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function deleteStudent(req, res, next) {
  try {
    const id = req.params.id;
    const existing = await query('SELECT user_id FROM students WHERE student_id = $1', [id]);
    if (!existing.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Student not found.');
    // Deleting the user cascades to the student, assessments, predictions and
    // recommendations through foreign keys with ON DELETE CASCADE.
    await query('DELETE FROM users WHERE user_id = $1', [existing.rows[0].user_id]);
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
}

async function getProgress(req, res, next) {
  try {
    const id = req.params.id;
    const exists = await query('SELECT 1 FROM students WHERE student_id = $1', [id]);
    if (!exists.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Student not found.');

    const result = await query(
      `SELECT a.assessment_id, a.assessment_date,
              a.attendance::float8 AS attendance,
              a.internal_marks::float8 AS internal_marks,
              a.study_hours::float8 AS study_hours,
              a.assignment_completion::float8 AS assignment_completion,
              a.participation::float8 AS participation,
              a.previous_marks::float8 AS previous_marks,
              a.created_at,
              p.prediction_id,
              p.predicted_marks::float8 AS predicted_marks,
              p.performance_category,
              p.risk_score::float8 AS risk_score,
              p.risk_level,
              p.is_mock,
              p.model_used,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'recommendation_id', r.recommendation_id,
                  'area', r.area,
                  'priority', r.priority,
                  'recommendation_text', r.recommendation_text
                ) ORDER BY CASE r.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END)
                  FROM recommendations r
                 WHERE r.prediction_id = p.prediction_id
              ), '[]'::json) AS recommendations
         FROM assessments a
    LEFT JOIN predictions p ON p.assessment_id = a.assessment_id
        WHERE a.student_id = $1
        ORDER BY a.assessment_date ASC, a.assessment_id ASC
        LIMIT 100`,
      [id]
    );

    return res.json({ data: { progress: result.rows } });
  } catch (err) {
    return next(err);
  }
}

async function getPredictions(req, res, next) {
  try {
    const id = req.params.id;
    const result = await query(
      `SELECT p.prediction_id, p.assessment_id,
              p.predicted_marks::float8 AS predicted_marks,
              p.performance_category, p.risk_score::float8 AS risk_score,
              p.risk_level, p.model_used, p.is_mock,
              p.triggered_rules, p.explanation, p.created_at,
              a.assessment_date,
              a.attendance::float8 AS attendance,
              a.internal_marks::float8 AS internal_marks,
              a.study_hours::float8 AS study_hours,
              a.assignment_completion::float8 AS assignment_completion,
              a.participation::float8 AS participation,
              a.previous_marks::float8 AS previous_marks,
              COALESCE((
                SELECT json_agg(json_build_object(
                  'recommendation_id', r.recommendation_id,
                  'area', r.area,
                  'priority', r.priority,
                  'recommendation_text', r.recommendation_text
                ) ORDER BY CASE r.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END)
                  FROM recommendations r
                 WHERE r.prediction_id = p.prediction_id
              ), '[]'::json) AS recommendations
         FROM predictions p
         JOIN assessments a ON a.assessment_id = p.assessment_id
        WHERE a.student_id = $1
        ORDER BY a.assessment_date DESC, a.assessment_id DESC, p.prediction_id DESC
        LIMIT 100`,
      [id]
    );
    return res.json({ data: { predictions: result.rows } });
  } catch (err) {
    return next(err);
  }
}

async function getRecommendations(req, res, next) {
  try {
    const id = req.params.id;
    const { limit } = req.validatedQuery;
    const result = await query(
      `SELECT r.recommendation_id, r.area, r.priority, r.recommendation_text, r.created_at,
              p.prediction_id, p.risk_level, p.performance_category,
              p.predicted_marks::float8 AS predicted_marks,
              a.assessment_date
         FROM recommendations r
         JOIN predictions p ON p.prediction_id = r.prediction_id
         JOIN assessments a ON a.assessment_id = p.assessment_id
        WHERE a.student_id = $1
        ORDER BY p.created_at DESC,
                 CASE r.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                 r.recommendation_id
        LIMIT $2`,
      [id, limit]
    );
    return res.json({ data: { recommendations: result.rows } });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listStudents,
  getStudent,
  getOwnStudent,
  createStudent,
  updateStudent,
  setStudentStatus,
  deleteStudent,
  getProgress,
  getPredictions,
  getRecommendations
};
