const request = require('supertest');
const app = require('./server/app');
const { closePool } = require('./server/config/db');

const ADMIN_EMAIL = 'admin@studentpredict.local';
const ADMIN_PASSWORD = 'AdminPass123!';

async function test() {
  const agent = request.agent(app);
  try {
    const res = await agent
      .post('/api/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    console.log('Login status:', res.status);
    console.log('Role:', res.body.data?.user?.role);
    console.log('Email matches:', res.body.data?.user?.email === ADMIN_EMAIL.toLowerCase());
    console.log('HttpOnly cookie:', res.headers['set-cookie'] ? 'Yes (set)' : 'No');
    // Test that /me works with the cookie
    const me = await agent.get('/api/auth/me');
    console.log('/me status:', me.status);
    console.log('/me role:', me.body.data?.user?.role);
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await closePool();
  }
}

test();