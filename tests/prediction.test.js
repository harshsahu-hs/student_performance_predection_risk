const request = require('supertest');
const app = require('../server/app');
const { closePool, query } = require('../server/config/db');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@studentpredict.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function adminLogin() {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  return agent;
}

async function createActiveStudent(agent, suffix) {
  const email = `pred${suffix}@example.local`;
  await agent.post('/api/auth/register').send({
    username: `preduser${suffix}`,
    email,
    password: 'Student123!',
    full_name: 'Test Student',
    enrollment_no: `PRED${suffix}`,
    course: 'B.Tech CSE',
    semester: 4,
    section: 'A'
  });
  const row = await query(
    `SELECT s.student_id FROM students s JOIN users u ON u.user_id = s.user_id WHERE u.email = $1`,
    [email]
  );
  const studentId = row.rows[0].student_id;
  await query(`UPDATE users SET is_active = TRUE WHERE user_id = (SELECT user_id FROM students WHERE student_id = $1)`, [studentId]);
  return studentId;
}

function stamp() {
  return Date.now();
}

describe('Prediction pipeline', () => {
  afterAll(async () => {
    await closePool().catch(() => {});
  });

  it('creates assessment, prediction, recommendations and progress in one transaction', async () => {
    const agent = await adminLogin();
    const sid = await createActiveStudent(agent, stamp());

    const res = await agent
      .post('/api/predict')
      .send({
        student_id: sid,
        attendance: 58,
        internal_marks: 46,
        study_hours: 2,
        assignment_completion: 55,
        participation: 38,
        previous_marks: 48,
        assessment_date: '2026-02-10'
      })
      .expect(201);

    expect(res.body.data.prediction.predicted_marks).toBeGreaterThanOrEqual(0);
    expect(res.body.data.prediction.predicted_marks).toBeLessThanOrEqual(100);
    expect(['Excellent', 'Good', 'Average', 'Below Average', 'Needs Support']).toContain(res.body.data.prediction.performance_category);
    expect(['low', 'medium', 'high']).toContain(res.body.data.prediction.risk_level);
    expect(res.body.data.prediction.risk_score).toBeGreaterThanOrEqual(0);
    expect(res.body.data.prediction.risk_score).toBeLessThanOrEqual(100);
    expect(res.body.data.risk.rules.length).toBeGreaterThan(0);
    expect(res.body.data.recommendations.length).toBeGreaterThan(0);
    expect(res.body.data.disclaimer).toContain('not guarantees');
    expect(res.body.data.badge).toBe('Prototype model (UCI dataset)');
    expect(res.body.data.model.features_used).toContain('attendance');
    expect(res.body.data.model.features_used).toContain('internal_marks');
    expect(res.body.data.model.features_used).toContain('study_hours');
    expect(res.body.data.model.features_used).toContain('previous_marks');
    // Assignment completion and participation are recorded but not model features
    expect(res.body.data.model.features_used).not.toContain('assignment_completion');
    expect(res.body.data.model.features_used).not.toContain('participation');

    // Verify DB rows
    const assessment = await query(
      'SELECT * FROM assessments WHERE assessment_id = $1',
      [res.body.data.assessment.assessment_id]
    );
    expect(assessment.rowCount).toBe(1);
    expect(assessment.rows[0].student_id).toBe(sid);

    const prediction = await query(
      'SELECT * FROM predictions WHERE prediction_id = $1',
      [res.body.data.prediction.prediction_id]
    );
    expect(prediction.rowCount).toBe(1);
    expect(prediction.rows[0].assessment_id).toBe(res.body.data.assessment.assessment_id);

    const recs = await query(
      'SELECT * FROM recommendations WHERE prediction_id = $1',
      [res.body.data.prediction.prediction_id]
    );
    expect(recs.rowCount).toBe(res.body.data.recommendations.length);

    const progress = await query(
      'SELECT * FROM progress_records WHERE student_id = $1 AND assessment_id = $2',
      [sid, res.body.data.assessment.assessment_id]
    );
    expect(progress.rowCount).toBe(1);

    await query('DELETE FROM users WHERE user_id IN (SELECT user_id FROM students WHERE student_id = $1)', [sid]);
  });

  it('prediction for non-existent student returns 404', async () => {
    const agent = await adminLogin();
    const res = await agent
      .post('/api/predict')
      .send({
        student_id: 999999,
        attendance: 80,
        internal_marks: 50,
        study_hours: 5,
        assignment_completion: 80,
        participation: 70,
        previous_marks: 60,
        assessment_date: '2026-02-10'
      })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /api/predict/metadata returns feature definitions', async () => {
    const agent = await adminLogin();
    const res = await agent.get('/api/predict/metadata').expect(200);
    expect(res.body.data.metadata.features.length).toBe(4);
    const keys = res.body.data.metadata.features.map((f) => f.key);
    expect(keys).toEqual(['attendance', 'internal_marks', 'study_hours', 'previous_marks']);
    expect(res.body.data.badge).toBe('Prototype model (UCI dataset)');
  });

  it('GET /api/models/metrics returns real stored metrics', async () => {
    const agent = await adminLogin();
    const res = await agent.get('/api/models/metrics').expect(200);
    expect(res.body.data.metrics.length).toBeGreaterThan(0);
    const active = res.body.data.metrics.find((m) => m.is_active);
    expect(active).toBeDefined();
    expect(active.model_name).toBe('LinearRegression');
    expect(active.mae).toBeCloseTo(4.6736, 3);
    expect(active.rmse).toBeCloseTo(7.8896, 3);
    expect(active.r2).toBeCloseTo(0.8231, 3);
    expect(active.feature_importance.length).toBe(4);
    expect(res.body.data.badge).toBe('Prototype model (UCI dataset)');
    expect(res.body.data.university_validated).toBe(false);
  });

  it('GET /api/analytics/overview returns totals and risk distribution', async () => {
    const agent = await adminLogin();
    const sid = await createActiveStudent(agent, stamp());
    await agent
      .post('/api/predict')
      .send({
        student_id: sid,
        attendance: 58,
        internal_marks: 46,
        study_hours: 2,
        assignment_completion: 55,
        participation: 38,
        previous_marks: 48,
        assessment_date: '2026-02-10'
      });

    const res = await agent.get('/api/analytics/overview').expect(200);
    expect(res.body.data.totals.total_students).toBeGreaterThanOrEqual(1);
    expect(res.body.data.risk_distribution).toHaveProperty('low');
    expect(res.body.data.risk_distribution).toHaveProperty('medium');
    expect(res.body.data.risk_distribution).toHaveProperty('high');
    expect(res.body.data.badge).toBe('Prototype model (UCI dataset)');
    expect(res.body.data.disclaimer).toContain('not guarantees');

    await query('DELETE FROM users WHERE user_id IN (SELECT user_id FROM students WHERE student_id = $1)', [sid]);
  });

  it('GET /api/analytics/risk returns at-risk students with distribution', async () => {
    const agent = await adminLogin();
    const res = await agent.get('/api/analytics/risk').expect(200);
    expect(res.body.data).toHaveProperty('students');
    expect(res.body.data.risk_distribution).toHaveProperty('total');
    expect(res.body.data.badge).toBe('Prototype model (UCI dataset)');
  });
});
