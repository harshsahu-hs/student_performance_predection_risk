const bcrypt = require('bcrypt');
const env = require('../config/env');
const { pool, withTransaction } = require('../config/db');

async function seedAdmin() {
  const email = (env.admin.email || '').trim().toLowerCase();
  const username = (env.admin.username || 'admin').trim();
  const password = env.admin.password;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
  }
  if (password.length < 10) {
    throw new Error('ADMIN_PASSWORD must be at least 10 characters');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await withTransaction(async (client) => {
    const existing = await client.query('SELECT user_id FROM users WHERE email = $1', [email]);
    if (existing.rowCount) {
      const row = await client.query(
        `UPDATE users
            SET username = $2, password_hash = $3, role = 'admin', is_active = TRUE, updated_at = NOW()
          WHERE email = $1
          RETURNING user_id, email, username, role, is_active`,
        [email, username, passwordHash]
      );
      return { action: 'updated', user: row.rows[0] };
    }

    const usernameTaken = await client.query('SELECT 1 FROM users WHERE username = $1', [username]);
    if (usernameTaken.rowCount) {
      // Username already exists — update it so the admin can always be re-seeded
      const row = await client.query(
        `UPDATE users
            SET password_hash = $2, role = 'admin', is_active = TRUE, updated_at = NOW()
          WHERE username = $1
          RETURNING user_id, email, username, role, is_active`,
        [username, passwordHash]
      );
      return { action: 'updated', user: row.rows[0] };
    }

    const created = await client.query(
      `INSERT INTO users (username, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'admin', TRUE)
       RETURNING user_id, email, username, role, is_active`,
      [username, email, passwordHash]
    );
    return { action: 'created', user: created.rows[0] };
  });

  console.log(`[seed:admin] ${result.action} administrator ${result.user.email} (id ${result.user.user_id}).`);
  console.log('[seed:admin] Password was read from ADMIN_PASSWORD in .env and is never logged.');
}

if (require.main === module) {
  seedAdmin()
    .then(async () => { await pool.end(); process.exit(0); })
    .catch(async (err) => {
      console.error(`[seed:admin] ${err.message}`);
      await pool.end().catch(() => {});
      process.exit(1);
    });
}

module.exports = { seedAdmin };
