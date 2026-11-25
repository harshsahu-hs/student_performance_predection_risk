const { query } = require('../config/db');

async function logAuthEvent({ userId = null, email = null, eventType, ip = null }) {
  try {
    await query(
      `INSERT INTO auth_events (user_id, email, event_type, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [userId, email ? String(email).slice(0, 255) : null, eventType, ip ? String(ip).slice(0, 64) : null]
    );
  } catch {
    // Auditing must never prevent a login or reveal auth details.
  }
}

module.exports = { logAuthEvent };
