import os

path = r'c:\Users\Dhanush K N\Downloads\ALL 3 PORTALS\backend\server.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_code_start = '// GET /principal/dashboard'
old_code_end = '// GET /principal/reports/results'

start_idx = content.find(old_code_start)
end_idx = content.find(old_code_end)

new_code = """// GET /principal/dashboard
router.get('/principal/dashboard', async (req, res) => {
  try {
    const deptCount = await dbPool.query("SELECT COUNT(*) FROM departments WHERE status = 'Active';");
    const hodCount = await dbPool.query("SELECT COUNT(*) FROM users WHERE role = 'HOD' AND account_status = 'Active';");
    const totalHodCount = await dbPool.query("SELECT COUNT(*) FROM users WHERE role = 'HOD';");
    const stuCount = await dbPool.query("SELECT COUNT(DISTINCT usn) FROM students;");
    const upcomingExams = await dbPool.query("SELECT COUNT(*) FROM examinations WHERE status = 'Scheduled';");
    const inProgExams = await dbPool.query("SELECT COUNT(*) FROM examinations WHERE status = 'In Progress';");
    const completedExams = await dbPool.query("SELECT COUNT(*) FROM examinations WHERE status = 'Exam Completed';");

    const examActivity = await dbPool.query(`
      SELECT e.*,
             json_build_object(
               'sittingId', es.id,
               'studentCount', es.student_count,
               'assignedStudentUsns', es.assigned_student_usns
             ) as morning_sitting
      FROM examinations e
      LEFT JOIN examination_sittings es ON e.id = es.examination_id AND es.sitting_name = 'Morning'
      ORDER BY e.exam_date DESC LIMIT 10;
    `);

    const auditLogs = await dbPool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 10;');

    res.json({
      data: {
        summary: {
          totalDepartments: parseInt(deptCount.rows[0].count, 10),
          totalHodAccounts: parseInt(totalHodCount.rows[0].count, 10),
          activeHodAccounts: parseInt(hodCount.rows[0].count, 10),
          totalRegisteredStudents: parseInt(stuCount.rows[0].count, 10),
          upcomingExaminations: parseInt(upcomingExams.rows[0].count, 10),
          examinationsInProgress: parseInt(inProgExams.rows[0].count, 10),
          completedExaminations: parseInt(completedExams.rows[0].count, 10),
        },
        examinationActivity: examActivity.rows.map(r => ({
          id: r.id,
          subjectCode: r.subject_code,
          subjectName: r.subject_name,
          departmentCode: r.department_code,
          semesterNumber: r.semester_number,
          examDate: r.exam_date,
          startTime: r.start_time,
          durationMinutes: r.duration_minutes,
          status: r.status,
          labReadiness: r.lab_readiness,
          morningSitting: r.morning_sitting || { sittingId: '', studentCount: 0, assignedStudentUsns: [] },
          afternoonSitting: { sittingId: '', studentCount: 0, assignedStudentUsns: [] },
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
        recentAdministrativeActivities: auditLogs.rows.map(r => ({
          id: r.id,
          timestamp: r.timestamp,
          activity: r.activity,
          userName: r.user_name,
          userRole: r.user_role,
          category: r.category,
          actionStatus: r.action_status,
          examinationRef: r.examination_ref,
          studentUsn: r.student_usn,
          details: r.details,
        })),
      },
    });
  } catch (err) {
    console.error('Principal dashboard error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /principal/hods
router.get('/principal/hods', async (req, res) => {
  try {
    const depts = await dbPool.query("SELECT * FROM departments ORDER BY code;");
    const hods = await dbPool.query(`
      SELECT u.id, u.employee_id, u.full_name, u.email, u.contact_number, u.designation,
             u.department_id, d.code as department_code, d.name as department_name,
             u.account_status as status, u.created_at as assigned_at
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.role = 'HOD'
      ORDER BY d.code;
    `);

    res.json({
      data: {
        departments: depts.rows.map(d => ({
          id: d.id,
          code: d.code,
          name: d.name,
          identificationNumber: d.identification_number,
          status: d.status,
          createdAt: d.created_at,
        })),
        hodAccounts: hods.rows.map(r => ({
          id: r.id,
          employeeId: r.employee_id,
          fullName: r.full_name,
          email: r.email,
          contactNumber: r.contact_number || '',
          designation: r.designation,
          departmentId: r.department_id,
          departmentCode: r.department_code,
          departmentName: r.department_name,
          status: r.status,
          assignedAt: r.assigned_at,
          assignmentHistory: [],
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

"""

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_code + content[end_idx:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Updated server.js successfully!')
else:
    print('Indices not found:', start_idx, end_idx)
