const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const env = require('../config/env');
const { sanitizeUrl, sslConfig } = require('../config/db');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function quoteIdent(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error('Invalid database schema name');
  }
  return `"${name}"`;
}

async function runMigrations({ silent = false, schema = env.dbSchema } = {}) {
  if (schema && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error('Invalid database schema name');
  }

  const client = new Client({
    connectionString: sanitizeUrl(env.databaseUrl),
    ssl: sslConfig(),
    connectionTimeoutMillis: 15000
  });

  await client.connect();
  const appliedNow = [];
  try {
    if (schema) {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)}`);
      await client.query(`SET search_path TO ${quoteIdent(schema)}, public`);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query("SELECT pg_advisory_lock(hashtext('student_performance_schema_migrations'))");
    const applied = new Set(
      (await client.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version)
    );
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        appliedNow.push(file);
        if (!silent) console.log(`[migrate] applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }

    await client.query("SELECT pg_advisory_unlock(hashtext('student_performance_schema_migrations'))");
    if (!silent) {
      console.log(appliedNow.length
        ? `[migrate] ${appliedNow.length} migration(s) applied${schema ? ` in schema ${schema}` : ''}.`
        : `[migrate] database is up to date${schema ? ` (schema ${schema})` : ''}.`);
    }
    return appliedNow;
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`[migrate] ${err.message}`);
      process.exit(1);
    });
}

module.exports = { runMigrations };
