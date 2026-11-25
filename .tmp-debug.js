require('dotenv').config({ path: '.env' });
process.env.NODE_ENV = 'test';
process.env.DB_SCHEMA = 'student_performance_test';
process.env.ML_MOCK = 'true';
const request = require('supertest');
const app = require('./server/app');
const { query, closePool } = require('./server/config/db');

(async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  console.log('logged in as admin');

  const suffix = Date.now();
  const email = `debug${suffix}@example.local`;
  const reg = await agent.post('/api/auth/register').send({
    username: `debuguser${suffix}`, email, password: 'Student123!',
    full_name: 'Debug User', enrollment_no: `DEBUG${suffix}`, course: 'B.Tech CSE', semester: 4
  });
  console.log('register status:', reg.status, reg.body.error || JSON.stringify(reg.body.data));

  const list = await agent.get('/api/students').query({ search: email });
  console.log('list status:', list.status);
  console.log('list body:', JSON.stringify(list.body.data, null, 2));

  await query('DELETE FROM users WHERE email = $1', [email]);
  await closePool();
})().catch(e => { console.error(e); process.exit(1); });
