#!/usr/bin/env node
'use strict';

/**
 * Sanitized password-reset utility.
 * Reads all credentials from process.env only. Never hardcodes or logs secrets.
 *
 * Required env vars:
 *   DATABASE_URL  (or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME/DB_SSL)
 *   RESET_EMAIL   email of the account whose password should be reset
 *   RESET_PASSWORD new password (must meet policy: 8+ chars, letter + number)
 *
 * Usage:
 *   DATABASE_URL=... RESET_EMAIL=admin@studentpredict.local RESET_PASSWORD=NewPass1234! node scripts/reset-pw.js
 */

const bcrypt = require('bcrypt');
const env = require('./server/config/env');
const { query, closePool } = require('./server/config/db');

async function main() {
  const email = (process.env.RESET_EMAIL || '').trim().toLowerCase();
  const password = process.env.RESET_PASSWORD || '';

  if (!email) {
    throw new Error('RESET_EMAIL is required');
  }
  if (!password) {
    throw new Error('RESET_PASSWORD is required');
  }
  if (password.length < 8) {
    throw new Error('RESET_PASSWORD must be at least 8 characters');
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('RESET_PASSWORD must include at least one letter and one number');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await query(
    `UPDATE users SET password_hash = $1, updated_at = NOW()
     WHERE email = $2
     RETURNING user_id, email, username, role, is_active`,
    [passwordHash, email]
  );

  if (!result.rowCount) {
    throw new Error(`No account found for email: ${email}`);
  }

  // Never log the password or hash.
  console.log(`[reset-pw] password updated for ${result.rows[0].email} (id ${result.rows[0].user_id}).`);
}

main()
  .then(async () => { await closePool(); process.exit(0); })
  .catch(async (err) => {
    console.error(`[reset-pw] ${err.message}`);
    await closePool().catch(() => {});
    process.exit(1);
  });
