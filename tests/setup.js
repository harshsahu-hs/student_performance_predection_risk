const bcrypt = require('bcrypt');
const { pool, query, withTransaction } = require('../server/config/db');
const { runMigrations } = require('../server/db/migrate');
const { seedAdmin } = require('../server/db/seed-admin');
const { seedMetrics } = require('../server/db/seed-metrics');

// Tests use the mock model so the prediction pipeline works without the Python
// service. The real (live) service is verified manually.
process.env.ML_MOCK = 'true';

const TABLES = [
  'auth_events',
  'recommendations',
  'progress_records',
  'predictions',
  'assessments',
  'students',
  'users',
  'model_metrics'
];

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await runMigrations({ silent: true });
  await seedAdmin();
  await seedMetrics();
  schemaReady = true;
}

async function truncateTables() {
  // Truncate all app tables in dependency order, restarting identities so IDs
  // stay predictable across tests.
  await query(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
  // Re-seed the admin user and stored metrics after truncation.
  await seedAdmin();
  await seedMetrics();
}

beforeAll(async () => {
  await ensureSchema();
});

beforeEach(async () => {
  await truncateTables();
});

afterAll(async () => {
  await pool.end().catch(() => {});
});

// Expose helpers for tests that need a fresh admin token or custom data.
global.__testHelpers = {
  TABLES,
  truncateTables,
  hashPassword: (password) => bcrypt.hash(password, 12)
};
