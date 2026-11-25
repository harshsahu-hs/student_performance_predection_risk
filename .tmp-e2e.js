process.env.ML_MOCK = 'true';
const request = require('supertest');
const app = require('./server/app');
const { closePool, query } = require('./server/config/db');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@studentpredict.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

(async () => {
  const agent = request.agent(app);

  const login = await agent.post('/api/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  console.log('1. Login:', login.status, login.body.data.user.role);

  const stamp = Date.now();
  const email = `e2e${stamp}@example.local`;
  const created = await agent.post('/api/students').send({
    username: `e2euser${stamp}`, email, password: 'Student123!',
    full_name: 'Test Student', enrollment_no: `E2E${stamp}`, course: 'B.Tech CSE', semester: 4, section: 'A'
  });
  const sid = created.body.data.student.student_id;
  console.log('2. Student created:', sid);

  await agent.patch(`/api/students/${sid}/status`).send({ is_active: true });
  console.log('3. Student activated');

  const pred = await agent.post('/api/predict').send({
    student_id: sid, attendance: 58, internal_marks: 46, study_hours: 2,
    assignment_completion: 55, participation: 38, previous_marks: 48,
    assessment_date: '2026-02-10'
  });
  console.log('4. Prediction:', pred.status, 'marks:', pred.body.data.prediction.predicted_marks,
    'category:', pred.body.data.prediction.performance_category,
    'risk:', pred.body.data.prediction.risk_level, pred.body.data.prediction.risk_score,
    'mock:', pred.body.data.prediction.is_mock);
  console.log('   Badge:', pred.body.data.badge);

  const overview = await agent.get('/api/analytics/overview');
  console.log('5. Overview:', overview.status, 'students:', overview.body.data.totals.total_students,
    'risk dist:', JSON.stringify(overview.body.data.risk_distribution));

  const metrics = await agent.get('/api/models/metrics');
  console.log('6. Metrics active:', metrics.body.data.active_model, 'MAE:', metrics.body.data.metrics[0]?.mae);

  const pdf = await agent.get(`/api/reports/student/${sid}`);
  const body = Buffer.from(pdf.body, 'binary');
  console.log('7. PDF:', pdf.status, 'magic:', body.slice(0, 4).toString('ascii'));

  await agent.post('/api/auth/logout');
  const sagent = request.agent(app);
  await sagent.post('/api/auth/login').send({ email, password: 'Student123!' });
  const own = await sagent.get(`/api/students/${sid}/predictions`);
  console.log('8. Student own predictions:', own.status, 'count:', own.body.data.predictions.length);

  await agent.post('/api/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const otherSid = (await agent.post('/api/students').send({
    username: `e2eother${stamp}`, email: `e2eo${stamp}@example.local`, password: 'Student123!',
    full_name: 'Other Student', enrollment_no: `E2EO${stamp}`, course: 'B.Tech CSE', semester: 2
  })).body.data.student.student_id;
  await agent.patch(`/api/students/${otherSid}/status`).send({ is_active: true });
  const forbidden = await sagent.get(`/api/students/${otherSid}/predictions`);
  console.log('9. Cross-student 403:', forbidden.status, forbidden.body.error?.code);

  await query('DELETE FROM users WHERE email = ANY($1)', [[email, `e2eo${stamp}@example.local`]]);
  await closePool();
  console.log('\nAll end-to-end checks passed!');
})().catch(e => { console.error(e); process.exit(1); });
