const { query } = require('../config/db');
const { DISCLAIMER, BADGE } = require('./predictionController');

const LATEST_CTE = `
WITH latest AS (
  SELECT DISTINCT ON (a.student_id)
         a.student_id, a.assessment_id, a.assessment_date,
         p.prediction_id, p.predicted_marks, p.performance_category,
         p.risk_score, p.risk_level, p.triggered_rules, p.is_mock, p.created_at
    FROM assessments a
    JOIN predictions p ON p.assessment_id = a.assessment_id
    JOIN students s ON s.student_id = a.student_id
    JOIN users u ON u.user_id = s.user_id AND u.is_active = TRUE
   ORDER BY a.student_id, a.assessment_date DESC, a.assessment_id DESC
)
`;

async function overview(_req, res, next) {
  try {
    const totalsResult = await query(
      `${LATEST_CTE}
       SELECT
         (SELECT COUNT(*)::int FROM students) AS total_students,
         (SELECT COUNT(*)::int FROM students s JOIN users u ON u.user_id = s.user_id WHERE u.is_active) AS active_students,
         (SELECT COUNT(*)::int FROM students s JOIN users u ON u.user_id = s.user_id WHERE NOT u.is_active) AS inactive_students,
         (SELECT COUNT(*)::int FROM assessments) AS total_assessments,
         (SELECT COUNT(*)::int FROM predictions) AS total_predictions,
         (SELECT AVG(predicted_marks)::float8 FROM latest) AS average_predicted_marks,
         (SELECT COUNT(*)::int FROM latest) AS students_with_predictions`
    );

    const riskResult = await query(
      `${LATEST_CTE}
       SELECT risk_level, COUNT(*)::int AS count
         FROM latest GROUP BY risk_level`
    );
    const categoryResult = await query(
      `${LATEST_CTE}
       SELECT performance_category, COUNT(*)::int AS count
         FROM latest GROUP BY performance_category`
    );
    const trendResult = await query(
      `SELECT to_char(date_trunc('month', a.assessment_date), 'YYYY-MM') AS month,
              AVG(p.predicted_marks)::float8 AS average_predicted_marks,
              COUNT(*)::int AS count
         FROM assessments a
         JOIN predictions p ON p.assessment_id = a.assessment_id
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 8`
    );
    const recentResult = await query(
      `SELECT a.assessment_id, a.assessment_date, a.attendance::float8 AS attendance,
              a.internal_marks::float8 AS internal_marks,
              s.student_id, s.full_name, s.enrollment_no, s.course,
              p.prediction_id, p.predicted_marks::float8 AS predicted_marks,
              p.performance_category, p.risk_level, p.risk_score::float8 AS risk_score,
              p.is_mock
         FROM assessments a
         JOIN students s ON s.student_id = a.student_id
    LEFT JOIN predictions p ON p.assessment_id = a.assessment_id
        ORDER BY a.assessment_date DESC, a.assessment_id DESC
        LIMIT 8`
    );
    const atRiskResult = await query(
      `${LATEST_CTE}
       SELECT l.student_id, l.assessment_id, l.assessment_date,
              l.predicted_marks::float8 AS predicted_marks,
              l.performance_category, l.risk_score::float8 AS risk_score,
              l.risk_level, l.triggered_rules, l.is_mock,
              s.full_name, s.enrollment_no, s.course, s.semester, s.section, u.email
         FROM latest l
         JOIN students s ON s.student_id = l.student_id
         JOIN users u ON u.user_id = s.user_id
        WHERE l.risk_level IN ('medium', 'high')
        ORDER BY l.risk_score DESC, l.predicted_marks ASC
        LIMIT 10`
    );

    const riskDistribution = { low: 0, medium: 0, high: 0, total: 0 };
    for (const row of riskResult.rows) {
      riskDistribution[row.risk_level] = row.count;
      riskDistribution.total += row.count;
    }
    const categoryDistribution = categoryResult.rows
      .map((r) => ({ category: r.performance_category, count: r.count }))
      .sort((a, b) => b.count - a.count);

    const totals = totalsResult.rows[0];
    totals.average_predicted_marks = totals.average_predicted_marks === null
      ? null
      : Math.round(totals.average_predicted_marks * 100) / 100;

    return res.json({
      data: {
        totals,
        risk_distribution: riskDistribution,
        category_distribution: categoryDistribution,
        recent_assessments: recentResult.rows,
        at_risk_students: atRiskResult.rows,
        trend: trendResult.rows.reverse(),
        empty: totals.total_predictions === 0,
        badge: BADGE,
        disclaimer: DISCLAIMER,
        university_validated: false
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function riskList(req, res, next) {
  try {
    const level = req.validatedQuery.level || 'all';
    const params = [];
    let filter = "WHERE l.risk_level IN ('medium', 'high')";
    if (level === 'medium' || level === 'high') {
      params.push(level);
      filter = `WHERE l.risk_level = $1`;
    }

    const rows = await query(
      `${LATEST_CTE}
       SELECT l.student_id, l.assessment_id, l.assessment_date,
              l.predicted_marks::float8 AS predicted_marks,
              l.performance_category, l.risk_score::float8 AS risk_score,
              l.risk_level, l.triggered_rules, l.is_mock,
              s.full_name, s.enrollment_no, s.course, s.semester, s.section, u.email,
              (SELECT COUNT(*)::int FROM recommendations r WHERE r.prediction_id = l.prediction_id) AS recommendation_count
         FROM latest l
         JOIN students s ON s.student_id = l.student_id
         JOIN users u ON u.user_id = s.user_id
         ${filter}
        ORDER BY CASE l.risk_level WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                 l.risk_score DESC
        LIMIT 100`,
      params
    );

    const distribution = await query(
      `${LATEST_CTE}
       SELECT risk_level, COUNT(*)::int AS count FROM latest GROUP BY risk_level`
    );
    const counts = { low: 0, medium: 0, high: 0, total: 0 };
    for (const row of distribution.rows) {
      counts[row.risk_level] = row.count;
      counts.total += row.count;
    }

    return res.json({
      data: {
        students: rows.rows,
        risk_distribution: counts,
        empty: rows.rows.length === 0,
        badge: BADGE,
        disclaimer: DISCLAIMER,
        university_validated: false
      }
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { overview, riskList };
