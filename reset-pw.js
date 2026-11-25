const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const NEW_PASSWORD = 'AdminPass123!';

async function reset() {
  const hash = await bcrypt.hash(NEW_PASSWORD, 12);
  console.log('New hash:', hash);
  
  const pool = new Pool({
    connectionString: 'postgresql://postgres:db098691c7c33a33ab09fba42641fe0f@tw3atypa.ap-southeast.database.insforge.app:5432/insforge?sslmode=require'
  });
  
  const client = await pool.connect();
  try {
    await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'admin@studentpredict.local']);
    console.log('Password updated in database for admin@studentpredict.local');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

reset();