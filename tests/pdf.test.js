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

async function createActiveStudentWithPrediction(agent, suffix) {
  const email = `pdf${suffix}@example.local`;
  await agent.post('/api/auth/register').send({
    username: `pdfuser${suffix}`,
    email,
    password: 'Student123!',
    full_name: 'Test Student',
    enrollment_no: `PDF${suffix}`,
    course: 'B.Tech CSE',
    semester: 4,
    section: 'A'
  });
  const row = await query(
    `SELECT s.student_id, s.user_id FROM students s JOIN users u ON u.user_id = s.user_id WHERE u.email = $1`,
    [email]
  );
  const studentId = row.rows[0].student_id;
  const userId = row.rows[0].user_id;
  await query(`UPDATE users SET is_active = TRUE WHERE user_id = $1`, [userId]);

  await agent.post('/api/predict').send({
    student_id: studentId,
    attendance: 80,
    internal_marks: 70,
    study_hours: 10,
    assignment_completion: 85,
    participation: 75,
    previous_marks: 65,
    assessment_date: '2026-03-01'
  });

  return { student_id: studentId, email };
}

async function cleanup(emails) {
  if (emails.length) {
    await query('DELETE FROM users WHERE email = ANY($1)', [emails]);
  }
}

function stamp() {
  return Date.now();
}

describe('PDF reports', () => {
  afterAll(async () => {
    await closePool().catch(() => {});
  });

  it('generates a PDF for a valid student request', async () => {
    const agent = await adminLogin();
    const { student_id: sid, email } = await createActiveStudentWithPrediction(agent, stamp());

    const res = await agent.get(`/api/reports/student/${sid}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');

    const body = Buffer.from(res.body, 'binary');
    // PDF magic bytes
    expect(body.slice(0, 4).toString('ascii')).toBe('%PDF');

    await cleanup([email]);
  });

  it('student can download their own PDF', async () => {
    const admin = await adminLogin();
    const { student_id: sid, email } = await createActiveStudentWithPrediction(admin, stamp());

    const sagent = request.agent(app);
    await sagent.post('/api/auth/login').send({ email, password: 'Student123!' });

    const res = await sagent.get(`/api/reports/student/${sid}`);
    expect(res.status).toBe(200);
    const body = Buffer.from(res.body, 'binary');
    expect(body.slice(0, 4).toString('ascii')).toBe('%PDF');

    await cleanup([email]);
  });

  it('student cannot download another student PDF (403)', async () => {
    const admin = await adminLogin();
    const s1 = await createActiveStudentWithPrediction(admin, stamp());
    const s2 = await createActiveStudentWithPrediction(admin, stamp() + 1);

    const sagent = request.agent(app);
    await sagent.post('/api/auth/login').send({ email: s1.email, password: 'Student123!' });

    await sagent.get(`/api/reports/student/${s2.student_id}`).expect(403);

    await cleanup([s1.email, s2.email]);
  });

  it('PDF for non-existent student returns 404', async () => {
    const agent = await adminLogin();
    await agent.get('/api/reports/student/999999').expect(404);
  });
});
