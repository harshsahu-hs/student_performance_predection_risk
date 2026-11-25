require('dotenv').config({ path: '.env' });
process.env.NODE_ENV = 'test';
process.env.DB_SCHEMA = 'student_performance_test';
process.env.ML_MOCK = 'true';
const request = require('supertest');
const app = require('./server/app');
const { query, closePool } = require('./server/config/db');

(async () => {
  const email = `dup${Date.now()}@example.local`;

  // First registration
  const r1 = await request(app).post('/api/auth/register').send({
    username: `dup1${Date.now()}`, email, password: 'Student123!',
    full_name: 'Dup User', enrollment_no: `DUP1${Date.now()}`, course: 'B.Tech CSE', semester: 3
  });
  console.log('First register status:', r1.status, r1.body.error || r1.body.data);

  // Second registration with same email
  const r2 = await request(app).post('/api/auth/register').send({
    username: `dup2${Date.now()}`, email, password: 'Student123!',
    full_name: 'Dup User 2', enrollment_no: `DUP2${Date.now()}`, course: 'B.Tech CSE', semester: 3
  });
  console.log('Second register status:', r2.status, r2.body.error || r2.body.data);

  await query('DELETE FROM users WHERE email = $1', [email]);
  await closePool();
})().catch(e => { console.error(e); process.exit(1); });
