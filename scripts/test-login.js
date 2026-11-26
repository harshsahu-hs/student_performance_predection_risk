#!/usr/bin/env node
'use strict';

/**
 * Sanitized login smoke test.
 * Reads credentials from process.env only. Never hardcodes or logs secrets.
 *
 * Required env vars:
 *   LOGIN_EMAIL    email to authenticate
 *   LOGIN_PASSWORD password to authenticate
 *   BASE_URL       base URL of the running API (default http://localhost:3000)
 *
 * Usage:
 *   LOGIN_EMAIL=admin@studentpredict.local LOGIN_PASSWORD=... BASE_URL=http://localhost:3000 node scripts/test-login.js
 */

const http = require('http');

async function main() {
  const email = process.env.LOGIN_EMAIL;
  const password = process.env.LOGIN_PASSWORD;
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  if (!email || !password) {
    throw new Error('LOGIN_EMAIL and LOGIN_PASSWORD are required');
  }

  const body = JSON.stringify({ email, password });
  const url = new URL('/api/auth/login', baseUrl);

  const res = await new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => resolve({ status: response.statusCode, body: data, headers: response.headers }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  if (res.status !== 200) {
    throw new Error(`login failed with status ${res.status}: ${res.body}`);
  }

  const parsed = JSON.parse(res.body);
  const setCookie = res.headers['set-cookie'] || [];
  const hasHttpOnly = setCookie.some((c) => c.toLowerCase().includes('httponly'));
  if (!parsed.data || !parsed.data.user) {
    throw new Error('unexpected login response shape');
  }

  // Never log the cookie value.
  console.log(
    `[test-login] login OK for ${parsed.data.user.email} (role ${parsed.data.user.role}), ` +
    `httpOnly cookie=${hasHttpOnly}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`[test-login] ${err.message}`);
    process.exit(1);
  });
