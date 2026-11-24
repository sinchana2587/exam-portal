const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'mitm_ems',
});

async function run() {
  const pHash = await bcrypt.hash('PRINCIPAL@7658', 10);
  const cHash = await bcrypt.hash('COE@5828', 10);
  const hHash = await bcrypt.hash('Hod@cs123', 10);

  await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2;', [pHash, 'principal']);
  await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2;', [cHash, 'coe']);
  await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2;', [cHash, 'coe.mitm']);
  await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2;', [hHash, 'hod.cs']);

  console.log('Successfully updated password hashes in mitm_ems!');

  const testUsers = [
    { u: 'principal', p: 'PRINCIPAL@7658' },
    { u: 'principal', p: 'principal@7658' },
    { u: 'coe', p: 'COE@5828' },
    { u: 'coe', p: 'coe@5828' },
    { u: 'coe.mitm', p: 'COE@5828' },
    { u: 'coe.mitm', p: 'coe@5828' },
    { u: 'hod.cs', p: 'Hod@cs123' },
  ];

  for (const t of testUsers) {
    const res = await pool.query('SELECT password_hash FROM users WHERE username = $1;', [t.u]);
    const matched = await bcrypt.compare(t.p, res.rows[0].password_hash);
    console.log(`User: ${t.u} | Input: ${t.p} | Matches: ${matched}`);
  }

  await pool.end();
}

run().catch(console.error);
