const bcrypt = require('bcrypt');
const env = require('../config/env');
const { query, withTransaction } = require('../config/db');
const { HttpError } = require('../utils/httpError');
const { signToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { logAuthEvent } = require('../services/authAudit');

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-value', 10);

function safeUser(row) {
  const user = {
    user_id: row.user_id,
    username: row.username,
    email: row.email,
    role: row.role,
    is_active: row.is_active,
    created_at: row.created_at
  };
  if (row.student_id) {
    user.student = {
      student_id: row.student_id,
      enrollment_no: row.enrollment_no,
      full_name: row.full_name,
      course: row.course,
      semester: row.semester,
      section: row.section
    };
  }
  return user;
}

async function register(req, res, next) {
  try {
    const { username, email, password, full_name, enrollment_no, course, semester, section } = req.body;

    const duplicate = await query(
      `SELECT
         EXISTS (SELECT 1 FROM users WHERE email = $1) AS email_taken,
         EXISTS (SELECT 1 FROM users WHERE username = $2) AS username_taken,
         EXISTS (SELECT 1 FROM students WHERE enrollment_no = $3) AS enrollment_taken`,
      [email, username, enrollment_no]
    );

    const taken = duplicate.rows[0];
    const details = [];
    if (taken.email_taken) details.push({ field: 'email', message: 'An account with this email already exists.' });
    if (taken.username_taken) details.push({ field: 'username', message: 'This username is already taken.' });
    if (taken.enrollment_taken) details.push({ field: 'enrollment_no', message: 'This enrollment number is already registered.' });
    if (details.length) {
      throw new HttpError(409, 'DUPLICATE_ACCOUNT', 'An account with these details already exists.', details);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO users (username, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, 'student', FALSE)
         RETURNING user_id, username, email, role, is_active, created_at`,
        [username, email, passwordHash]
      );
      const u = inserted.rows[0];
      await client.query(
        `INSERT INTO students (user_id, enrollment_no, full_name, course, semester, section)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [u.user_id, enrollment_no, full_name, course, semester, section || null]
      );
      return u;
    });

    await logAuthEvent({ userId: user.user_id, email, eventType: 'register', ip: req.ip });

    return res.status(201).json({
      data: {
        message: 'Registration received. An administrator must approve the account before you can sign in.',
        user: safeUser(user)
      }
    });
  } catch (err) {
    if (err.code === '23505') {
      const map = {
        users_email_key: { field: 'email', message: 'An account with this email already exists.' },
        users_username_key: { field: 'username', message: 'This username is already taken.' },
        students_enrollment_no_key: { field: 'enrollment_no', message: 'This enrollment number is already registered.' }
      };
      return next(new HttpError(409, 'DUPLICATE_ACCOUNT', 'An account with these details already exists.',
        [map[err.constraint] || { field: 'account', message: 'Duplicate account details.' }]));
    }
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const result = await query(
      `SELECT u.user_id, u.username, u.email, u.password_hash, u.role, u.is_active, u.created_at,
              s.student_id, s.enrollment_no, s.full_name, s.course, s.semester, s.section
         FROM users u
    LEFT JOIN students s ON s.user_id = u.user_id
        WHERE u.email = $1`,
      [email]
    );

    const row = result.rows[0];
    const passwordOk = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);

    if (!row || !passwordOk) {
      await logAuthEvent({ email, eventType: 'login_failed', ip: req.ip });
      return next(new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.'));
    }

    if (!row.is_active) {
      await logAuthEvent({ userId: row.user_id, email, eventType: 'login_failed', ip: req.ip });
      return next(new HttpError(403, 'ACCOUNT_INACTIVE', 'This account is inactive. Please contact an administrator.'));
    }

    const token = signToken(row);
    setAuthCookie(res, token);
    await logAuthEvent({ userId: row.user_id, email, eventType: 'login_success', ip: req.ip });

    return res.json({ data: { user: safeUser(row) } });
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res) {
  clearAuthCookie(res);
  if (req.user) {
    await logAuthEvent({ userId: req.user.userId, email: req.user.email, eventType: 'logout', ip: req.ip });
  }
  return res.json({ data: { message: 'Signed out.' } });
}

async function me(req, res) {
  res.set('Cache-Control', 'no-store');
  return res.json({
    data: {
      user: {
        user_id: req.user.userId,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        is_active: true,
        created_at: req.user.createdAt,
        ...(req.user.profile ? { student: req.user.profile } : {})
      },
      security: {
        cookie: 'httpOnly, sameSite=lax',
        database: 'server-side only',
        prototypeModelWarning: 'Prototype model (UCI dataset) - accuracy for university students is not yet validated.'
      },
      modelBadge: (env.isTest ? '' : '') || 'Prototype model (UCI dataset)'
    }
  });
}

module.exports = { register, login, logout, me, safeUser };
