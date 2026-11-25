const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: true });

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const isTest = process.env.NODE_ENV === 'test';

// Tests never touch the public schema. They run in a disposable schema on the
// same InsForge database, or in TEST_DATABASE_URL when one is supplied.
const dbSchema = isTest
  ? (process.env.DB_SCHEMA || 'student_performance_test')
  : (process.env.DB_SCHEMA || null);

const databaseUrl = (() => {
  if (isTest && process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.DB_HOST) {
    const user = encodeURIComponent(process.env.DB_USER || 'postgres');
    const password = encodeURIComponent(process.env.DB_PASSWORD || '');
    const port = process.env.DB_PORT || '5432';
    const name = process.env.DB_NAME || 'insforge';
    return `postgresql://${user}:${password}@${process.env.DB_HOST}:${port}/${name}`;
  }
  return null;
})();

const jwtSecret = process.env.JWT_SECRET || (isTest ? crypto.randomBytes(32).toString('hex') : null);

if (!isTest) {
  if (!databaseUrl) throw new Error('DATABASE_URL (or DB_HOST/DB_USER/DB_PASSWORD) is required');
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to a long random string (32+ characters)');
  }
}

const appOrigin = process.env.APP_ORIGIN || 'http://localhost:3000';
const allowedOrigins = appOrigin.split(',').map((s) => s.trim()).filter(Boolean);

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isTest,
  isProduction: process.env.NODE_ENV === 'production',
  port: int(process.env.PORT, 3000),
  appOrigin,
  allowedOrigins,
  databaseUrl,
  dbSchema,
  dbSslMode: process.env.DB_SSL || 'require',
  insforgeApiKey: process.env.INSFORGE_API_KEY || null,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  cookieName: 'sp_token',
  cookieSecure: bool(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
  admin: {
    email: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || '',
    username: process.env.ADMIN_USERNAME || 'admin'
  },
  ml: {
    url: (process.env.PYTHON_ML_URL || 'http://localhost:8000').replace(/\/+$/, ''),
    mock: bool(process.env.ML_MOCK, false),
    timeoutMs: int(process.env.ML_TIMEOUT_MS, 8000)
  }
};
