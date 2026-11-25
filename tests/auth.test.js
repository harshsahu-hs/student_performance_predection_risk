const request = require('supertest');
const app = require('../server/app');
const { closePool, query } = require('../server/config/db');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@studentpredict.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function cleanup(emails) {
  if (emails.length) {
    await query('DELETE FROM users WHERE email = ANY($1)', [emails]);
  }
}

describe('Auth', () => {
  afterAll(async () => {
    await closePool().catch(() => {});
  });

  it('login with valid admin credentials returns 200 and sets a cookie', async () => {
    const agent = request.agent(app);
    const res = await agent
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect('Content-Type', /json/);

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('admin');
    expect(res.body.data.user.email).toBe(ADMIN_EMAIL.toLowerCase());

    // httpOnly cookie should be set
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(setCookie.join(';')).toContain('HttpOnly');
    expect(setCookie.join(';')).toContain('SameSite=Lax');
  });

  it('login with invalid credentials returns generic 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'wrong-password-xyz' })
      .expect(401);

    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe('Invalid email or password.');
    // Generic message - same for wrong password and unknown email, no hint
    expect(res.body.error.message).not.toContain('user not found');
    expect(res.body.error.message).not.toContain('password incorrect');
  });

  it('login for non-existent email returns the same generic 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-such-user@example.local', password: 'whatever123' })
      .expect(401);

    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).toBe('Invalid email or password.');
  });

  it('GET /api/auth/me without a cookie returns 401', async () => {
    await request(app).get('/api/auth/me').expect(401);
  });

  it('GET /api/auth/me with a valid cookie returns the user', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    const res = await agent.get('/api/auth/me').expect(200);
    expect(res.body.data.user.role).toBe('admin');
    expect(res.body.data.security.cookie).toContain('httpOnly');
  });

  it('POST /api/auth/logout clears the session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    const res = await agent.post('/api/auth/logout').expect(200);
    expect(res.body.data.message).toBe('Signed out.');

    // After logout, /me should fail
    await agent.get('/api/auth/me').expect(401);
  });

  it('registration creates an inactive student account', async () => {
    const stamp = Date.now();
    const email = `reg${stamp}@example.local`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: `reg${stamp}`,
        email,
        password: 'Student123!',
        full_name: 'Reg User',
        enrollment_no: `REG${stamp}`,
        course: 'B.Tech CSE',
        semester: 3,
        section: 'A'
      })
      .expect(201);

    expect(res.body.data.message).toContain('approve');
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.user.is_active).toBe(false);

    await cleanup([email]);
  });

  it('registration with duplicate email returns 409', async () => {
    const stamp = Date.now();
    const email = `dup${stamp}@example.local`;
    // Create first account
    await request(app)
      .post('/api/auth/register')
      .send({
        username: `dup1${stamp}`,
        email,
        password: 'Student123!',
        full_name: 'Dup User',
        enrollment_no: `DUP1${stamp}`,
        course: 'B.Tech CSE',
        semester: 3
      })
      .expect(201);

    // Duplicate email
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: `dup2${stamp}`,
        email,
        password: 'Student123!',
        full_name: 'Dup User Two',
        enrollment_no: `DUP2${stamp}`,
        course: 'B.Tech CSE',
        semester: 3
      })
      .expect(409);

    expect(res.body.error.code).toBe('DUPLICATE_ACCOUNT');

    await cleanup([email]);
  });
});
