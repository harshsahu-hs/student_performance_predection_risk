const { query } = require('../config/db');
const { HttpError } = require('../utils/httpError');
const { buildReportPdf } = require('../services/pdf');

async function studentReport(req, res, next) {
  try {
    const studentId = req.params.id;
    const studentResult = await query(
      `SELECT s.student_id, s.enrollment_no, s.full_name, s.course, s.semester, s.section,
              u.email, u.is_active, s.created_at
         FROM students s JOIN users u ON u.user_id = s.user_id
        WHERE s.student_id = $1`,
      [studentId]
    );
    if (!studentResult.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Student not found.');
    const student = studentResult.rows[0];

    const latestResult = await query(
      `SELECT a.assessment_id, a.assessment_date,
              a.attendance::float8 AS attendance,
              a.internal_marks::float8 AS internal_marks,
              a.study_hours::float8 AS study_hours,
              a.assignment_completion::float8 AS assignment_completion,
              a.participation::float8 AS participation,
              a.previous_marks::float8 AS previous_marks,
              p.prediction_id, p.predicted_marks::float8 AS predicted_marks,
              p.performance_category, p.risk_score::float8 AS risk_score,
              p.risk_level, p.model_used, p.is_mock, p.triggered_rules, p.explanation
         FROM assessments a
    LEFT JOIN predictions p ON p.assessment_id = a.assessment_id
        WHERE a.student_id = $1
        ORDER BY a.assessment_date DESC, a.assessment_id DESC
        LIMIT 1`,
      [studentId]
    );
    const latest = latestResult.rows[0] || null;

    let recommendations = [];
    if (latest && latest.prediction_id) {
      const recs = await query(
        `SELECT area, priority, recommendation_text FROM recommendations
          WHERE prediction_id = $1
          ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, recommendation_id`,
        [latest.prediction_id]
      );
      recommendations = recs.rows;
    }

    const metricsResult = await query(
      `SELECT model_name, mae::float8 AS mae, rmse::float8 AS rmse, r2::float8 AS r2,
              dataset_name, dataset_rows, test_rows, is_active, metadata
         FROM model_metrics
        ORDER BY is_active DESC, rmse ASC`
    );
    const metrics = metricsResult.rows;
    const active = metrics.find((m) => m.is_active);
    const activeMetadata = active && active.metadata && typeof active.metadata === 'object' ? active.metadata : null;

    const generatedAt = new Date().toISOString().slice(0, 10);
    const doc = buildReportPdf({ student, latest, recommendations, metrics, activeMetadata, generatedAt });

    const safeEnrollment = String(student.enrollment_no).replace(/[^A-Za-z0-9._-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="student-report-${safeEnrollment}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    doc.on('error', (err) => {
      if (!res.headersSent) return next(err);
      return res.destroy(err);
    });
    doc.pipe(res);
    doc.end();
  } catch (err) {
    return next(err);
  }
}

module.exports = { studentReport };
