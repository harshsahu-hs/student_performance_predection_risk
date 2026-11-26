#!/usr/bin/env node
'use strict';

/**
 * Sanitized password-verification utility.
 * Reads the password from process.env only. Never hardcodes or logs secrets.
 *
 * Required env vars:
 *   TEST_PASSWORD  plaintext password to verify against a stored hash
 *   TEST_HASH      stored bcrypt hash (base64 or hex, as stored in DB)
 *
 * Usage:
 *   TEST_PASSWORD=... TEST_HASH=$2b$12$... node scripts/test-pw.js
 */

const bcrypt = require('bcrypt');

async function main() {
  const password = process.env.TEST_PASSWORD;
  const hash = process.env.TEST_HASH;

  if (!password) {
    throw new Error('TEST_PASSWORD is required');
  }
  if (!hash) {
    throw new Error('TEST_HASH is required');
  }

  const ok = await bcrypt.compare(password, hash);

  // Never log the password or hash; only report match status.
  console.log(`[test-pw] password match: ${ok}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(`[test-pw] ${err.message}`);
  process.exit(1);
});
