const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function updateCredentials() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'mitm_ems',
  });

  const hashPrincipal = await bcrypt.hash('PRINCIPAL@7658', 10);
  const hashCoe = await bcrypt.hash('COE@5828', 10);

  // 1. Update Principal
  await pool.query(
    "UPDATE users SET password_hash = $1 WHERE username = 'principal';",
    [hashPrincipal]
  );
  console.log('✅ Updated Principal (user: principal, pw: PRINCIPAL@7658)');

  // 2. Update COE user to username 'coe'
  await pool.query(
    "UPDATE users SET username = 'coe', password_hash = $1 WHERE id = 'usr-coe-01';",
    [hashCoe]
  );
  console.log('✅ Updated COE account (user: coe, pw: COE@5828)');

  // 3. Also allow 'coe.mitm' as an alternate login
  await pool.query(`
    INSERT INTO users (id, employee_id, full_name, email, username, password_hash, role, designation, account_status)
    VALUES ('usr-coe-mitm', 'EMP-COE-01B', 'Controller of Examinations', 'coe.mitm@mitmysore.in', 'coe.mitm', $1, 'COE', 'Controller of Examinations', 'Active')
    ON CONFLICT (username) DO UPDATE SET password_hash = $1, account_status = 'Active';
  `, [hashCoe]);
  console.log('✅ Added alternate COE login (user: coe.mitm, pw: COE@5828)');

  const res = await pool.query(
    "SELECT id, username, role, full_name, account_status FROM users WHERE username IN ('principal', 'coe', 'coe.mitm') ORDER BY username;"
  );
  console.log('\nVerified accounts in PostgreSQL database "mitm_ems":');
  console.table(res.rows);

  await pool.end();
}

updateCredentials().catch(console.error);
