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

// Registers a student via the API, then activates it via a direct DB query
// (avoids relying on the list/search endpoint for the newly created id).
async function createActiveStudent(agent, suffix) {
  const email = `stu${suffix}@example.local`;
  await agent.post('/api/auth/register').send({
    username: `stuuser${suffix}`,
    email,
    password: 'Student123!',
    full_name: 'Test Student',
    enrollment_no: `STU${suffix}`,
    course: 'B.Tech CSE',
    semester: 4,
    section: 'A'
  });

  const row = await query(
    `SELECT s.student_id FROM students s JOIN users u ON u.user_id = s.user_id WHERE u.email = $1`,
    [email]
  );
  if (!row.rowCount) throw new Error('student was not created');
  const studentId = row.rows[0].student_id;

  await query(`UPDATE users SET is_active = TRUE WHERE user_id = (SELECT user_id FROM students WHERE student_id = $1)`, [studentId]);

  // Log in as the new student
  const sagent = request.agent(app);
  await sagent.post('/api/auth/login').send({ email, password: 'Student123!' });
  return { agent: sagent, student_id: studentId, email };
}

async function cleanup(emails) {
  if (emails.length) {
    await query('DELETE FROM users WHERE email = ANY($1)', [emails]);
  }
}

describe('Permissions and ownership', () => {
  afterAll(async () => {
    await closePool().catch(() => {});
  });

  it('student can access their own record but not another student (403)', async () => {
    const admin = await adminLogin();
    const s1 = await createActiveStudent(admin, Date.now());
    const s2 = await createActiveStudent(admin, Date.now() + 1);

    // Student 1 can access their own predictions
    const own = await s1.agent.get(`/api/students/${s1.student_id}/predictions`).expect(200);
    expect(own.body.data.predictions).toEqual([]);

    // Student 1 accessing student 2's predictions returns 403
    await s1.agent.get(`/api/students/${s2.student_id}/predictions`).expect(403);

    // Student 1 accessing student 2's report returns 403
    await s1.agent.get(`/api/reports/student/${s2.student_id}`).expect(403);

    // Student 1 accessing student 2's progress returns 403
    await s1.agent.get(`/api/students/${s2.student_id}/progress`).expect(403);

    // Admin can access both
    await admin.get(`/api/students/${s1.student_id}/predictions`).expect(200);
    await admin.get(`/api/students/${s2.student_id}/predictions`).expect(200);

    await cleanup([s1.email, s2.email]);
  });

  it('student cannot list all students (admin-only)', async () => {
    const admin = await adminLogin();
    const s = await createActiveStudent(admin, Date.now());

    await s.agent.get('/api/students').expect(403);

    await cleanup([s.email]);
  });

  it('inactive account cannot log in', async () => {
    const admin = await adminLogin();
    const suf = Date.now();
    const email = `inact${suf}@example.local`;
    await admin.post('/api/auth/register').send({
      username: `inactuser${suf}`,
      email,
      password: 'Student123!',
      full_name: 'Test Student',
      enrollment_no: `INACT${suf}`,
      course: 'B.Tech CSE',
      semester: 2
    });
    // Leave account inactive (registration default is inactive)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'Student123!' })
      .expect(403);

    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');

    await cleanup([email]);
  });

  it('admin can list and paginate students', async () => {
    const admin = await adminLogin();
    const s = await createActiveStudent(admin, Date.now());

    const res = await admin.get('/api/students').expect(200);
    expect(res.body.data.students.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.pagination.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.pagination.page).toBe(1);

    await cleanup([s.email]);
  });
});
