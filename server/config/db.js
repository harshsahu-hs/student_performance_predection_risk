const { Pool } = require('pg');
const env = require('./env');

const SSL_MODES = new Set(['require', 'prefer', 'verify-ca', 'verify-full', 'true', 'no-verify']);

function sanitizeUrl(raw) {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    // pg's URL parser warns about libpq sslmode semantics. SSL is configured
    // explicitly below instead, so drop the query parameter.
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return raw;
  }
}

function sslConfig() {
  if (!env.databaseUrl) return false;
  const mode = String(env.dbSslMode || 'require').toLowerCase();
  if (mode === 'disable' || mode === 'false' || mode === 'no') return false;
  if (mode === 'verify-full') return { rejectUnauthorized: true };
  if (SSL_MODES.has(mode) || mode === '') return { rejectUnauthorized: false };
  return { rejectUnauthorized: false };
}

const searchPathOption = env.dbSchema
  ? { options: `-c search_path=${env.dbSchema},public` }
  : {};

const pool = new Pool({
  connectionString: sanitizeUrl(env.databaseUrl),
  ssl: sslConfig(),
  max: env.isTest ? 6 : 12,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  ...searchPathOption
});

pool.on('error', (err) => {
  // Never log credentials or SQL parameters.
  console.error('[db] idle client error:', err.code || err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection already gone */ }
    throw err;
  } finally {
    client.release();
  }
}

async function closePool() {
  await pool.end();
}

module.exports = { pool, query, withTransaction, closePool, sslConfig, sanitizeUrl };
