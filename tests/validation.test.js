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
  const email = `val${suffix}@example.local`;
  const regRes = await agent.post('/api/auth/register').send({
    username: `valuser${suffix}`,
    email,
    password: 'Student123!',
    full_name: 'Test Student',
    enrollment_no: `VAL${suffix}`,
    course: 'B.Tech CSE',
    semester: 4,
    section: 'A'
  });
  if (regRes.status !== 201) {
    throw new Error(`registration failed: ${regRes.status} ${JSON.stringify(regRes.body)}`);
  }
  const row = await query(
    `SELECT s.student_id FROM students s JOIN users u ON u.user_id = s.user_id WHERE u.email = $1`,
    [email]
  );
  const studentId = row.rows[0].student_id;
  await query(`UPDATE users SET is_active = TRUE WHERE user_id = (SELECT user_id FROM students WHERE student_id = $1)`, [studentId]);
  return studentId;
}

describe('Validation', () => {
  afterAll(async () => {
    await closePool().catch(() => {});
  });

  it('rejects out-of-range attendance (>100)', async () => {
    const agent = await adminLogin();
    const sid = await createActiveStudent(agent, Date.now());
    const res = await agent
      .post('/api/predict')
      .send({
        student_id: sid,
        attendance: 110,
        internal_marks: 50,
        study_hours: 5,
        assignment_completion: 80,
        participation: 70,
        previous_marks: 60,
        assessment_date: '2026-01-15'
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const field = res.body.error.details.find((d) => d.field === 'attendance');
    expect(field).toBeDefined();

    await query('DELETE FROM users WHERE user_id IN (SELECT user_id FROM students WHERE student_id = $1)', [sid]);
  });

  it('rejects out-of-range study hours (>168)', async () => {
    const agent = await adminLogin();
    const sid = await createActiveStudent(agent, Date.now());
    const res = await agent
      .post('/api/predict')
      .send({
        student_id: sid,
        attendance: 80,
        internal_marks: 50,
        study_hours: 200,
        assignment_completion: 80,
        participation: 70,
        previous_marks: 60,
        assessment_date: '2026-01-15'
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const field = res.body.error.details.find((d) => d.field === 'study_hours');
    expect(field).toBeDefined();

    await query('DELETE FROM users WHERE user_id IN (SELECT user_id FROM students WHERE student_id = $1)', [sid]);
  });

  it('rejects missing required fields', async () => {
    const agent = await adminLogin();
    const sid = await createActiveStudent(agent, Date.now());
    const res = await agent
      .post('/api/predict')
      .send({ student_id: sid })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(0);

    await query('DELETE FROM users WHERE user_id IN (SELECT user_id FROM students WHERE student_id = $1)', [sid]);
  });

  it('rejects future assessment date', async () => {
    const agent = await adminLogin();
    const sid = await createActiveStudent(agent, Date.now());
    const res = await agent
      .post('/api/predict')
      .send({
        student_id: sid,
        attendance: 80,
        internal_marks: 50,
        study_hours: 5,
        assignment_completion: 80,
        participation: 70,
        previous_marks: 60,
        assessment_date: '2099-01-01'
      })
      .expect(400);

    expect(res.body.error.message).toContain('future');

    await query('DELETE FROM users WHERE user_id IN (SELECT user_id FROM students WHERE student_id = $1)', [sid]);
  });

  it('SQL injection in email is handled safely during login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: "admin@studentpredict.local' OR '1'='1", password: 'x' })
      .expect(401);

    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe('Invalid email or password.');
  });

  it('student creation with duplicate enrollment returns 409', async () => {
    const agent = await adminLogin();
    const suffix = Date.now();
    const enrollment = `DUPENR${suffix}`;
    await agent.post('/api/students').send({
      username: `dupuser${suffix}`,
      email: `dupemr${suffix}@example.local`,
      password: 'Student123!',
      full_name: 'Test Student',
      enrollment_no: enrollment,
      course: 'B.Tech CSE',
      semester: 4
    });

    const res = await agent.post('/api/students').send({
      username: `dupuser2${suffix}`,
      email: `dupemr2${suffix}@example.local`,
      password: 'Student123!',
      full_name: 'Test Student',
      enrollment_no: enrollment,
      course: 'B.Tech CSE',
      semester: 4
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_ACCOUNT');

    await query("DELETE FROM users WHERE email LIKE $1", [`%dupemr${suffix}@example.local`]);
    await query('DELETE FROM students WHERE enrollment_no = $1', [enrollment]);
  });
});
