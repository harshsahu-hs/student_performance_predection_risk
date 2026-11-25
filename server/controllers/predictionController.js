const { query, withTransaction } = require('../config/db');
const { HttpError } = require('../utils/httpError');
const { predict: mlPredict } = require('../services/ml');
const { buildRiskAnalysis } = require('../services/risk');

const DISCLAIMER = 'Predictions are estimates, not guarantees. Risk indicators describe current associations in the prototype data, not causes, and are never a permanent label. Accuracy for university students has not yet been validated.';
const BADGE = 'Prototype model (UCI dataset)';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function runPrediction(req, res, next) {
  try {
    const body = req.body;

    if (body.assessment_date && body.assessment_date > todayIso()) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Assessment date cannot be in the future.');
    }

    // Only the four features in the model metadata are sent to the Python
    // service. Assignment completion and participation are recorded and used
    // by the transparent risk rules, not by the model.
    const features = {
      attendance: Number(body.attendance),
      internal_marks: Number(body.internal_marks),
      study_hours: Number(body.study_hours),
      previous_marks: Number(body.previous_marks)
    };

    // Call the model before opening the write transaction. If the service is
    // unavailable, no assessment or prediction is written.
    const mlResult = await mlPredict(features);
    const risk = buildRiskAnalysis(body, mlResult);

    const saved = await withTransaction(async (client) => {
      const student = await client.query('SELECT student_id FROM students WHERE student_id = $1', [body.student_id]);
      if (!student.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Student not found.');

      let assessmentId = body.assessment_id || null;
      if (assessmentId) {
        const existing = await client.query(
          'SELECT assessment_id, student_id FROM assessments WHERE assessment_id = $1 FOR UPDATE',
          [assessmentId]
        );
        if (!existing.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Assessment not found.');
        if (existing.rows[0].student_id !== Number(body.student_id)) {
          throw new HttpError(400, 'VALIDATION_ERROR', 'This assessment does not belong to the selected student.');
        }
        await client.query(
          `UPDATE assessments
              SET attendance = $2, internal_marks = $3, study_hours = $4,
                  assignment_completion = $5, participation = $6, previous_marks = $7,
                  assessment_date = COALESCE($8::date, assessment_date)
            WHERE assessment_id = $1`,
          [assessmentId, body.attendance, body.internal_marks, body.study_hours,
            body.assignment_completion, body.participation, body.previous_marks, body.assessment_date || null]
        );
        await client.query('DELETE FROM predictions WHERE assessment_id = $1', [assessmentId]);
      } else {
        const inserted = await client.query(
          `INSERT INTO assessments
             (student_id, attendance, internal_marks, study_hours, assignment_completion,
              participation, previous_marks, assessment_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8::date, CURRENT_DATE))
           RETURNING assessment_id`,
          [body.student_id, body.attendance, body.internal_marks, body.study_hours,
            body.assignment_completion, body.participation, body.previous_marks, body.assessment_date || null]
        );
        assessmentId = inserted.rows[0].assessment_id;
      }

      const prediction = await client.query(
        `INSERT INTO predictions
           (assessment_id, predicted_marks, performance_category, risk_score, risk_level,
            model_used, is_mock, triggered_rules, explanation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
         RETURNING prediction_id`,
        [
          assessmentId,
          risk.predicted_marks,
          risk.performance_category,
          risk.risk_score,
          risk.risk_level,
          String(mlResult.model_used).slice(0, 100),
          Boolean(mlResult.is_mock),
          JSON.stringify(risk.triggered_rules),
          risk.explanation
        ]
      );

      for (const rec of risk.recommendations) {
        await client.query(
          `INSERT INTO recommendations (prediction_id, area, priority, recommendation_text)
           VALUES ($1,$2,$3,$4)`,
          [prediction.rows[0].prediction_id, rec.area.slice(0, 80), rec.priority, rec.recommendation_text]
        );
      }

      await client.query(
        `INSERT INTO progress_records (student_id, assessment_id, recorded_at)
         VALUES ($1,$2,NOW())
         ON CONFLICT (student_id, assessment_id) DO UPDATE SET recorded_at = NOW()`,
        [body.student_id, assessmentId]
      );

      return { assessmentId, predictionId: prediction.rows[0].prediction_id };
    });

    const detail = await query(
      `SELECT a.assessment_id, a.student_id, a.assessment_date,
              a.attendance::float8 AS attendance,
              a.internal_marks::float8 AS internal_marks,
              a.study_hours::float8 AS study_hours,
              a.assignment_completion::float8 AS assignment_completion,
              a.participation::float8 AS participation,
              a.previous_marks::float8 AS previous_marks,
              p.prediction_id,
              p.predicted_marks::float8 AS predicted_marks,
              p.performance_category,
              p.risk_score::float8 AS risk_score,
              p.risk_level,
              p.model_used,
              p.is_mock,
              p.triggered_rules,
              p.explanation,
              p.created_at,
              s.full_name, s.enrollment_no, s.course, s.semester, s.section
         FROM predictions p
         JOIN assessments a ON a.assessment_id = p.assessment_id
         JOIN students s ON s.student_id = a.student_id
        WHERE p.prediction_id = $1`,
      [saved.predictionId]
    );
    const recs = await query(
      `SELECT recommendation_id, area, priority, recommendation_text
         FROM recommendations WHERE prediction_id = $1
         ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, recommendation_id`,
      [saved.predictionId]
    );

    const row = detail.rows[0];
    return res.status(201).json({
      data: {
        assessment: {
          assessment_id: row.assessment_id,
          student_id: row.student_id,
          assessment_date: row.assessment_date,
          attendance: row.attendance,
          internal_marks: row.internal_marks,
          study_hours: row.study_hours,
          assignment_completion: row.assignment_completion,
          participation: row.participation,
          previous_marks: row.previous_marks
        },
        prediction: {
          prediction_id: row.prediction_id,
          predicted_marks: row.predicted_marks,
          performance_category: row.performance_category,
          risk_score: row.risk_score,
          risk_level: row.risk_level,
          model_used: row.model_used,
          is_mock: row.is_mock,
          created_at: row.created_at
        },
        student: {
          student_id: row.student_id,
          full_name: row.full_name,
          enrollment_no: row.enrollment_no,
          course: row.course,
          semester: row.semester,
          section: row.section
        },
        risk: {
          score: row.risk_score,
          level: row.risk_level,
          rules: row.triggered_rules,
          explanation: row.explanation
        },
        recommendations: recs.rows,
        model: {
          name: mlResult.model_used,
          version: mlResult.model_version,
          is_mock: mlResult.is_mock,
          is_prototype: true,
          university_validated: false,
          features_used: mlResult.features_used
        },
        disclaimer: DISCLAIMER,
        badge: BADGE,
        ...(mlResult.is_mock ? { mock_warning: 'MOCK - not real model output. Development only.' } : {})
      }
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { runPrediction, DISCLAIMER, BADGE };
