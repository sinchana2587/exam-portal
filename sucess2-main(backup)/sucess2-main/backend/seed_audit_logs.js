const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'mitm_ems',
});

async function run() {
  const countRes = await pool.query('SELECT COUNT(*) FROM audit_logs;');
  if (parseInt(countRes.rows[0].count, 10) === 0) {
    const logs = [
      {
        id: 'log-001',
        activity: 'Examination Schedule CS501 Published & Verified',
        user_name: 'Dr. K. S. Manjunath',
        user_role: 'COE',
        examination_ref: 'CS',
        action_status: 'Completed',
        category: 'Examination Scheduling',
        details: 'Scheduled CS501 Database Management Systems for 5th Semester.',
      },
      {
        id: 'log-002',
        activity: 'Eligible Student Roster Uploaded & Validated',
        user_name: 'Dr. HOD Computer Science',
        user_role: 'HOD',
        examination_ref: 'CS',
        action_status: 'Completed',
        category: 'Student Enrollment',
        details: 'Uploaded 45 candidates for 5th Sem Computer Science.',
      },
      {
        id: 'log-003',
        activity: 'Examination CS502 Results Released and Published',
        user_name: 'Dr. K. S. Manjunath',
        user_role: 'COE',
        examination_ref: 'CS',
        action_status: 'Completed',
        category: 'Results Management',
        details: 'Approved and published provisional examination scores.',
      },
      {
        id: 'log-004',
        activity: 'System Security Audit & Database Integrity Verification',
        user_name: 'Dr. Principal MITM',
        user_role: 'Principal',
        examination_ref: 'CS',
        action_status: 'Completed',
        category: 'Security',
        details: 'Verified relational integrity across all 5 cross-portal connections.',
      },
    ];

    for (const log of logs) {
      await pool.query(
        `INSERT INTO audit_logs (id, activity, user_name, user_role, examination_ref, action_status, category, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING;`,
        [log.id, log.activity, log.user_name, log.user_role, log.examination_ref, log.action_status, log.category, log.details]
      );
    }
    console.log('Seeded audit logs successfully.');
  } else {
    console.log('Audit logs already present:', countRes.rows[0].count);
  }
  await pool.end();
}

run().catch(console.error);
