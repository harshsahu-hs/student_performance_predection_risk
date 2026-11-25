const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');
const { unauthorized, forbidden } = require('../utils/httpError');

const JWT_ISSUER = 'student-performance-api';
const JWT_AUDIENCE = 'student-performance-web';

function readToken(req) {
  const header = req.get('authorization');
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies && req.cookies[env.cookieName]) return req.cookies[env.cookieName];
  return null;
}

async function requireAuth(req, _res, next) {
  try {
    const token = readToken(req);
    if (!token) return next(unauthorized());

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret, { issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
    } catch {
      return next(unauthorized('Your session has expired. Please sign in again.'));
    }

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) return next(unauthorized());

    const result = await query(
      `SELECT u.user_id, u.username, u.email, u.role, u.is_active, u.created_at,
              s.student_id, s.enrollment_no, s.full_name, s.course, s.semester, s.section
         FROM users u
    LEFT JOIN students s ON s.user_id = u.user_id
        WHERE u.user_id = $1`,
      [userId]
    );
    if (!result.rowCount) return next(unauthorized('Your session is no longer valid.'));

    const row = result.rows[0];
    if (!row.is_active) {
      return next(Object.assign(unauthorized('This account is inactive. Please contact an administrator.'), {
        code: 'ACCOUNT_INACTIVE'
      }));
    }

    req.user = {
      userId: row.user_id,
      username: row.username,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
      studentId: row.student_id || null,
      profile: row.student_id ? {
        student_id: row.student_id,
        enrollment_no: row.enrollment_no,
        full_name: row.full_name,
        course: row.course,
        semester: row.semester,
        section: row.section
      } : null
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden('This action requires a different account role.'));
    return next();
  };
}

/**
 * Admin OR the student that owns the record. Uses 403 (not 404) for another
 * student's record so the rule is explicit and testable.
 */
function requireSelfOrAdmin(paramName = 'id') {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role === 'admin') return next();

    const raw = req.params[paramName];
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) return next(forbidden());
    if (!req.user.studentId || req.user.studentId !== id) {
      return next(forbidden('Students may only access their own records.'));
    }
    return next();
  };
}

function signToken(user) {
  return jwt.sign(
    { sub: String(user.user_id), role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn, issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
  );
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: '/'
  };
}

function parseDurationMs(value, fallback = 8 * 60 * 60 * 1000) {
  const m = String(value || '').trim().match(/^(\d+)\s*([smhd])?$/i);
  if (!m) return fallback;
  const n = Number(m[1]);
  const unit = (m[2] || 's').toLowerCase();
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  return n * mult;
}

function setAuthCookie(res, token) {
  res.cookie(env.cookieName, token, {
    ...cookieOptions(),
    maxAge: parseDurationMs(env.jwtExpiresIn)
  });
}

function clearAuthCookie(res) {
  res.clearCookie(env.cookieName, cookieOptions());
}

module.exports = {
  requireAuth,
  requireRole,
  requireSelfOrAdmin,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  readToken,
  parseDurationMs
};
