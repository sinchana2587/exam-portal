const { Client, Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DB_CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
};

const TARGET_DB = process.env.PG_DATABASE || 'mitm_ems';

async function setupDatabase() {
  console.log(`[DB Setup] Connecting to PostgreSQL at ${DB_CONFIG.host}:${DB_CONFIG.port} as ${DB_CONFIG.user}...`);

  // Step 1: Ensure database exists
  const rootClient = new Client({ ...DB_CONFIG, database: 'postgres' });
  await rootClient.connect();

  const checkDb = await rootClient.query(
    "SELECT 1 FROM pg_database WHERE datname = $1;",
    [TARGET_DB]
  );

  if (checkDb.rows.length === 0) {
    console.log(`[DB Setup] Creating database "${TARGET_DB}"...`);
    await rootClient.query(`CREATE DATABASE "${TARGET_DB}";`);
    console.log(`[DB Setup] Database "${TARGET_DB}" created.`);
  } else {
    console.log(`[DB Setup] Database "${TARGET_DB}" already exists.`);
  }
  await rootClient.end();

  // Step 2: Connect to target database and create tables
  const dbPool = new Pool({ ...DB_CONFIG, database: TARGET_DB });

  console.log(`[DB Setup] Creating schema tables in "${TARGET_DB}"...`);

  await dbPool.query(`
    -- Core Reference Tables
    CREATE TABLE IF NOT EXISTS academic_years (
      id VARCHAR(36) PRIMARY KEY,
      label VARCHAR(50) NOT NULL,
      start_year INT NOT NULL,
      end_year INT NOT NULL,
      is_current BOOLEAN NOT NULL DEFAULT false,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS departments (
      id VARCHAR(36) PRIMARY KEY,
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(150) NOT NULL,
      identification_number VARCHAR(50),
      hod_id VARCHAR(36),
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      employee_id VARCHAR(50) UNIQUE NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('PRINCIPAL', 'HOD', 'COE', 'STUDENT', 'INVIGILATOR', 'SYSTEM')),
      designation VARCHAR(100),
      department_id VARCHAR(36) REFERENCES departments(id) ON DELETE SET NULL,
      contact_number VARCHAR(20),
      last_login_at TIMESTAMPTZ,
      theme_preference VARCHAR(10) NOT NULL DEFAULT 'light',
      account_status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS semester_records (
      id VARCHAR(36) PRIMARY KEY,
      semester_number INT NOT NULL CHECK (semester_number BETWEEN 1 AND 8),
      label VARCHAR(50) NOT NULL,
      short_label VARCHAR(20) NOT NULL,
      department_id VARCHAR(36) REFERENCES departments(id) ON DELETE CASCADE,
      academic_year_id VARCHAR(36) REFERENCES academic_years(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_dept_year_semester UNIQUE (department_id, academic_year_id, semester_number)
    );

    CREATE TABLE IF NOT EXISTS department_sections (
      id VARCHAR(36) PRIMARY KEY,
      department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      semester_number INT NOT NULL CHECK (semester_number BETWEEN 1 AND 8),
      name VARCHAR(10) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_dept_sem_sec UNIQUE (department_id, semester_number, name)
    );

    CREATE TABLE IF NOT EXISTS students (
      id VARCHAR(36) PRIMARY KEY,
      usn VARCHAR(20) UNIQUE NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      dob DATE NOT NULL,
      department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
      semester_number INT NOT NULL CHECK (semester_number BETWEEN 1 AND 8),
      section VARCHAR(10) NOT NULL,
      is_eligible BOOLEAN NOT NULL DEFAULT true,
      enrollment_status VARCHAR(20) NOT NULL DEFAULT 'Enrolled',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS student_list_revisions (
      id VARCHAR(36) PRIMARY KEY,
      department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      academic_year_id VARCHAR(36) NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
      semester_number INT NOT NULL CHECK (semester_number BETWEEN 1 AND 8),
      section VARCHAR(10) NOT NULL,
      file_name VARCHAR(255),
      source_type VARCHAR(50) NOT NULL DEFAULT 'EXCEL_UPLOAD',
      revision_number VARCHAR(20) NOT NULL,
      total_students INT NOT NULL DEFAULT 0,
      valid_students INT NOT NULL DEFAULT 0,
      invalid_students INT NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'Active',
      uploaded_by VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id VARCHAR(36) PRIMARY KEY,
      code VARCHAR(20) NOT NULL,
      name VARCHAR(150) NOT NULL,
      department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
      semester_number INT NOT NULL CHECK (semester_number BETWEEN 1 AND 8),
      academic_year_id VARCHAR(36) NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
      module_count INT NOT NULL DEFAULT 5,
      applicable_sections TEXT[] NOT NULL DEFAULT '{"A"}',
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_subject_code_dept UNIQUE (code, department_id, academic_year_id)
    );

    CREATE TABLE IF NOT EXISTS question_banks (
      id VARCHAR(36) PRIMARY KEY,
      subject_id VARCHAR(36) NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
      semester_number INT NOT NULL CHECK (semester_number BETWEEN 1 AND 8),
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      total_questions INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id VARCHAR(36) PRIMARY KEY,
      question_bank_id VARCHAR(36) NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
      subject_id VARCHAR(36) NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      module_number INT NOT NULL,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_option VARCHAR(5) NOT NULL,
      marks NUMERIC(4,2) NOT NULL DEFAULT 1.0,
      status VARCHAR(20) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS question_sets (
      id VARCHAR(36) PRIMARY KEY,
      subject_id VARCHAR(36) NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      set_number VARCHAR(20) NOT NULL,
      total_questions INT NOT NULL DEFAULT 0,
      is_published BOOLEAN NOT NULL DEFAULT false,
      published_at TIMESTAMPTZ,
      published_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lab_servers (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      ip_address VARCHAR(45) NOT NULL,
      port INT NOT NULL DEFAULT 8443,
      capacity INT NOT NULL DEFAULT 60,
      is_online BOOLEAN NOT NULL DEFAULT true,
      last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS examinations (
      id VARCHAR(36) PRIMARY KEY,
      subject_id VARCHAR(36) NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
      subject_code VARCHAR(20) NOT NULL,
      subject_name VARCHAR(150) NOT NULL,
      department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
      department_code VARCHAR(10) NOT NULL,
      semester_number INT NOT NULL CHECK (semester_number BETWEEN 1 AND 8),
      exam_date DATE NOT NULL,
      start_time VARCHAR(10) NOT NULL,
      duration_minutes INT NOT NULL DEFAULT 90,
      passing_marks INT NOT NULL DEFAULT 20,
      maximum_marks INT NOT NULL DEFAULT 50,
      status VARCHAR(30) NOT NULL DEFAULT 'Scheduled',
      lab_readiness VARCHAR(20) NOT NULL DEFAULT 'Ready',
      is_finalized_and_frozen BOOLEAN NOT NULL DEFAULT false,
      revision_number INT NOT NULL DEFAULT 1,
      created_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS examination_sittings (
      id VARCHAR(36) PRIMARY KEY,
      examination_id VARCHAR(36) NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
      sitting_name VARCHAR(50) NOT NULL, -- 'Morning' or 'Afternoon'
      exam_date DATE NOT NULL,
      start_time VARCHAR(10) NOT NULL,
      duration_minutes INT NOT NULL DEFAULT 90,
      lab_id VARCHAR(36) REFERENCES lab_servers(id) ON DELETE SET NULL,
      student_count INT NOT NULL DEFAULT 0,
      assigned_student_usns TEXT[] NOT NULL DEFAULT '{}',
      selected_set_id VARCHAR(36) REFERENCES question_sets(id) ON DELETE SET NULL,
      selected_set_number VARCHAR(20),
      versions_generated BOOLEAN NOT NULL DEFAULT false,
      package_status VARCHAR(30) NOT NULL DEFAULT 'Not Prepared',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS session_monitoring (
      id VARCHAR(36) PRIMARY KEY,
      examination_id VARCHAR(36) NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
      sitting_id VARCHAR(36) NOT NULL REFERENCES examination_sittings(id) ON DELETE CASCADE,
      sitting_name VARCHAR(50) NOT NULL,
      total_allocated INT NOT NULL DEFAULT 0,
      students_logged_in INT NOT NULL DEFAULT 0,
      students_started INT NOT NULL DEFAULT 0,
      students_submitted INT NOT NULL DEFAULT 0,
      students_recovering INT NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ,
      last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS student_exam_sessions (
      id VARCHAR(36) PRIMARY KEY,
      examination_id VARCHAR(36) NOT NULL REFERENCES examinations(id) ON DELETE RESTRICT,
      sitting_id VARCHAR(36) NOT NULL REFERENCES examination_sittings(id) ON DELETE RESTRICT,
      student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
      usn VARCHAR(20) NOT NULL,
      student_name VARCHAR(150) NOT NULL,
      workstation_id VARCHAR(50),
      status VARCHAR(30) NOT NULL DEFAULT 'LoggedIn', -- LoggedIn, Started, Submitted, Disconnected
      session_token VARCHAR(255),
      started_at TIMESTAMPTZ,
      submitted_at TIMESTAMPTZ,
      last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS examination_results (
      id VARCHAR(36) PRIMARY KEY,
      examination_id VARCHAR(36) NOT NULL REFERENCES examinations(id) ON DELETE RESTRICT,
      subject_code VARCHAR(20) NOT NULL,
      subject_name VARCHAR(150) NOT NULL,
      department_id VARCHAR(36) NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
      department_code VARCHAR(10) NOT NULL,
      semester_number INT NOT NULL,
      academic_year_id VARCHAR(36) NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
      sitting_name VARCHAR(50) NOT NULL,
      total_students INT NOT NULL DEFAULT 0,
      pass_count INT NOT NULL DEFAULT 0,
      fail_count INT NOT NULL DEFAULT 0,
      absent_count INT NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'Awaiting COE Approval', -- Awaiting COE Approval, Released, Correction Pending
      imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approved_at TIMESTAMPTZ,
      approved_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS student_exam_results (
      id VARCHAR(36) PRIMARY KEY,
      examination_result_id VARCHAR(36) NOT NULL REFERENCES examination_results(id) ON DELETE CASCADE,
      examination_id VARCHAR(36) NOT NULL REFERENCES examinations(id) ON DELETE RESTRICT,
      student_id VARCHAR(36) NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
      usn VARCHAR(20) NOT NULL,
      student_name VARCHAR(150) NOT NULL,
      department_id VARCHAR(36) NOT NULL,
      department_code VARCHAR(10) NOT NULL,
      semester_number INT NOT NULL,
      section VARCHAR(10) NOT NULL,
      subject_code VARCHAR(20) NOT NULL,
      subject_name VARCHAR(150) NOT NULL,
      academic_year_id VARCHAR(36) NOT NULL,
      marks_obtained NUMERIC(5,2) NOT NULL DEFAULT 0,
      maximum_marks NUMERIC(5,2) NOT NULL DEFAULT 50,
      passing_marks NUMERIC(5,2) NOT NULL DEFAULT 20,
      grade VARCHAR(5) NOT NULL DEFAULT 'F',
      result VARCHAR(10) NOT NULL DEFAULT 'Pass', -- Pass, Fail, Absent
      approval_status VARCHAR(20) NOT NULL DEFAULT 'Released',
      released_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS answer_key_corrections (
      id VARCHAR(36) PRIMARY KEY,
      examination_id VARCHAR(36) NOT NULL REFERENCES examinations(id) ON DELETE RESTRICT,
      subject_code VARCHAR(20) NOT NULL,
      question_id VARCHAR(36) NOT NULL,
      question_text TEXT,
      original_answer VARCHAR(5) NOT NULL,
      corrected_answer VARCHAR(5) NOT NULL,
      reason TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'Pending COE Review', -- Pending COE Review, Approved & Recalculated, Rejected
      requested_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      decision_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(36) PRIMARY KEY,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      activity VARCHAR(255) NOT NULL,
      user_name VARCHAR(150) NOT NULL,
      user_role VARCHAR(30) NOT NULL,
      examination_ref VARCHAR(100),
      student_usn VARCHAR(30),
      action_status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
      category VARCHAR(50) NOT NULL,
      details TEXT
    );
  `);

  console.log('[DB Setup] Tables created successfully. Inserting seed data...');

  // Step 3: Insert Reference Data
  // Academic Year
  await dbPool.query(`
    INSERT INTO academic_years (id, label, start_year, end_year, is_current, status)
    VALUES ('ay-2024-25', '2024-25', 2024, 2025, true, 'Active')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Departments
  const departments = [
    { id: 'CS', code: 'CS', name: 'Computer Science & Engineering', identificationNumber: 'DEPT-CSE-01' },
    { id: 'IS', code: 'IS', name: 'Information Science & Engineering', identificationNumber: 'DEPT-ISE-02' },
    { id: 'EC', code: 'EC', name: 'Electronics & Communication Engineering', identificationNumber: 'DEPT-ECE-03' },
    { id: 'ME', code: 'ME', name: 'Mechanical Engineering', identificationNumber: 'DEPT-MECH-04' },
    { id: 'CV', code: 'CV', name: 'Civil Engineering', identificationNumber: 'DEPT-CIVIL-05' },
  ];

  for (const dept of departments) {
    await dbPool.query(`
      INSERT INTO departments (id, code, name, identification_number, status)
      VALUES ($1, $2, $3, $4, 'Active')
      ON CONFLICT (id) DO UPDATE SET name = $3, code = $2;
    `, [dept.id, dept.code, dept.name, dept.identificationNumber]);

    // Semesters 1 to 8 and sections A, B for each
    for (let sem = 1; sem <= 8; sem++) {
      const semLabels = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
      await dbPool.query(`
        INSERT INTO semester_records (id, semester_number, label, short_label, department_id, academic_year_id, status)
        VALUES ($1, $2, $3, $4, $5, 'ay-2024-25', 'Active')
        ON CONFLICT (department_id, academic_year_id, semester_number) DO NOTHING;
      `, [`sem-${dept.code}-${sem}`, sem, `${semLabels[sem-1]} Semester`, `${semLabels[sem-1]}`, dept.id]);

      for (const sec of ['A', 'B']) {
        await dbPool.query(`
          INSERT INTO department_sections (id, department_id, semester_number, name)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (department_id, semester_number, name) DO NOTHING;
        `, [`sec-${dept.code}-${sem}-${sec}`, dept.id, sem, sec]);
      }
    }
  }

  // Users (Principal, HODs, COE)
  const passwordHashPrincipal = await bcrypt.hash('PRINCIPAL@7658', 10);
  const passwordHashHodCs = await bcrypt.hash('Hod@cs123', 10);
  const passwordHashHodIs = await bcrypt.hash('Hod@is123', 10);
  const passwordHashHodEc = await bcrypt.hash('Hod@ec123', 10);
  const passwordHashCoe = await bcrypt.hash('COE@5828', 10);

  const users = [
    {
      id: 'usr-principal-01',
      employeeId: 'EMP-PRIN-01',
      fullName: 'Dr. Principal MITM',
      email: 'principal@mitmysore.in',
      username: 'principal',
      passwordHash: passwordHashPrincipal,
      role: 'PRINCIPAL',
      designation: 'Principal & Professor',
      departmentId: null,
    },
    {
      id: 'usr-hod-cs-01',
      employeeId: 'EMP-HOD-CS',
      fullName: 'Dr. HOD Computer Science',
      email: 'hod.cs@mitmysore.in',
      username: 'hod.cs',
      passwordHash: passwordHashHodCs,
      role: 'HOD',
      designation: 'Professor & Head (CSE)',
      departmentId: 'CS',
    },
    {
      id: 'usr-hod-is-01',
      employeeId: 'EMP-HOD-IS',
      fullName: 'Dr. HOD Information Science',
      email: 'hod.is@mitmysore.in',
      username: 'hod.is',
      passwordHash: passwordHashHodIs,
      role: 'HOD',
      designation: 'Professor & Head (ISE)',
      departmentId: 'IS',
    },
    {
      id: 'usr-hod-ec-01',
      employeeId: 'EMP-HOD-EC',
      fullName: 'Dr. HOD Electronics',
      email: 'hod.ec@mitmysore.in',
      username: 'hod.ec',
      passwordHash: passwordHashHodEc,
      role: 'HOD',
      designation: 'Professor & Head (ECE)',
      departmentId: 'EC',
    },
    {
      id: 'usr-coe-01',
      employeeId: 'EMP-COE-01',
      fullName: 'Controller of Examinations',
      email: 'coe@mitmysore.in',
      username: 'coe',
      passwordHash: passwordHashCoe,
      role: 'COE',
      designation: 'Controller of Examinations',
      departmentId: null,
    },
    {
      id: 'usr-coe-mitm',
      employeeId: 'EMP-COE-01B',
      fullName: 'Controller of Examinations',
      email: 'coe.mitm@mitmysore.in',
      username: 'coe.mitm',
      passwordHash: passwordHashCoe,
      role: 'COE',
      designation: 'Controller of Examinations',
      departmentId: null,
    },
  ];

  for (const u of users) {
    await dbPool.query(`
      INSERT INTO users (id, employee_id, full_name, email, username, password_hash, role, designation, department_id, account_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Active')
      ON CONFLICT (username) DO UPDATE SET password_hash = $6, role = $7, department_id = $9;
    `, [u.id, u.employeeId, u.fullName, u.email, u.username, u.passwordHash, u.role, u.designation, u.departmentId]);
  }

  // Update HOD IDs on departments
  await dbPool.query(`UPDATE departments SET hod_id = 'usr-hod-cs-01' WHERE id = 'CS';`);
  await dbPool.query(`UPDATE departments SET hod_id = 'usr-hod-is-01' WHERE id = 'IS';`);
  await dbPool.query(`UPDATE departments SET hod_id = 'usr-hod-ec-01' WHERE id = 'EC';`);

  // Lab Server Node
  await dbPool.query(`
    INSERT INTO lab_servers (id, name, ip_address, port, capacity, is_online)
    VALUES ('lab-01', 'Turing Lab (Lab 1)', '192.168.10.50', 8443, 60, true)
    ON CONFLICT (id) DO NOTHING;
  `);

  // Subjects in CS (Semester 5)
  const subjects = [
    { id: 'sub-cs501', code: 'CS501', name: 'Advanced Algorithms', dept: 'CS', sem: 5 },
    { id: 'sub-cs502', code: 'CS502', name: 'Database Management Systems', dept: 'CS', sem: 5 },
    { id: 'sub-cs503', code: 'CS503', name: 'Operating Systems', dept: 'CS', sem: 5 },
  ];

  for (const sub of subjects) {
    await dbPool.query(`
      INSERT INTO subjects (id, code, name, department_id, semester_number, academic_year_id, module_count, applicable_sections, status)
      VALUES ($1, $2, $3, $4, $5, 'ay-2024-25', 5, '{"A", "B"}', 'Active')
      ON CONFLICT (id) DO NOTHING;
    `, [sub.id, sub.code, sub.name, sub.dept, sub.sem]);

    // Question Sets for each subject
    for (let setIdx = 1; setIdx <= 3; setIdx++) {
      await dbPool.query(`
        INSERT INTO question_sets (id, subject_id, set_number, total_questions, is_published, published_at, published_by)
        VALUES ($1, $2, $3, 50, true, CURRENT_TIMESTAMP, 'usr-hod-cs-01')
        ON CONFLICT (id) DO NOTHING;
      `, [`qs-${sub.code}-set${setIdx}`, sub.id, `SET-${setIdx}`]);
    }
  }

  // Students in Department CS, Semester 5, Section A
  const sampleStudents = [
    { id: 'stu-cs-01', usn: '4MH21CS001', name: 'Abhishek K', dob: '2003-01-15', sem: 5, sec: 'A' },
    { id: 'stu-cs-02', usn: '4MH21CS002', name: 'Bhavana M', dob: '2003-04-20', sem: 5, sec: 'A' },
    { id: 'stu-cs-03', usn: '4MH21CS003', name: 'Chandan R', dob: '2003-08-11', sem: 5, sec: 'A' },
    { id: 'stu-cs-04', usn: '4MH21CS004', name: 'Divya S', dob: '2003-12-05', sem: 5, sec: 'A' },
    { id: 'stu-cs-05', usn: '4MH21CS005', name: 'Eshan N', dob: '2003-03-25', sem: 5, sec: 'A' },
    { id: 'stu-cs-06', usn: '4MH21CS006', name: 'Farhan A', dob: '2003-06-18', sem: 5, sec: 'A' },
    { id: 'stu-cs-07', usn: '4MH21CS007', name: 'Gautam P', dob: '2003-09-09', sem: 5, sec: 'A' },
    { id: 'stu-cs-08', usn: '4MH21CS008', name: 'Harshitha V', dob: '2003-11-30', sem: 5, sec: 'A' },
  ];

  for (const s of sampleStudents) {
    await dbPool.query(`
      INSERT INTO students (id, usn, full_name, dob, department_id, semester_number, section, is_eligible, enrollment_status)
      VALUES ($1, $2, $3, $4, 'CS', $5, $6, true, 'Enrolled')
      ON CONFLICT (usn) DO UPDATE SET full_name = $3, dob = $4;
    `, [s.id, s.usn, s.name, s.dob, s.sem, s.sec]);
  }

  // Student list revision for CS Sem 5 Sec A
  await dbPool.query(`
    INSERT INTO student_list_revisions (
      id, department_id, academic_year_id, semester_number, section, file_name,
      source_type, revision_number, total_students, valid_students, invalid_students, status, uploaded_by
    )
    VALUES (
      'rev-cs-5-a-01', 'CS', 'ay-2024-25', 5, 'A', 'CS_Sem5_SecA_Students.xlsx',
      'EXCEL_UPLOAD', 'REV-01', 8, 8, 0, 'Active', 'usr-hod-cs-01'
    )
    ON CONFLICT (id) DO NOTHING;
  `);

  // Scheduled Examination: CS501 Advanced Algorithms
  const examId = 'exam-cs501-2026';
  await dbPool.query(`
    INSERT INTO examinations (
      id, subject_id, subject_code, subject_name, department_id, department_code,
      semester_number, exam_date, start_time, duration_minutes, passing_marks,
      maximum_marks, status, lab_readiness, is_finalized_and_frozen, created_by
    )
    VALUES (
      $1, 'sub-cs501', 'CS501', 'Advanced Algorithms', 'CS', 'CS',
      5, '2026-11-20', '09:00', 90, 20, 50, 'Scheduled', 'Ready', true, 'usr-coe-01'
    )
    ON CONFLICT (id) DO NOTHING;
  `, [examId]);

  // Sitting for the exam
  const sittingId = 'sit-cs501-morn';
  const studentUsns = sampleStudents.map(s => s.usn);
  await dbPool.query(`
    INSERT INTO examination_sittings (
      id, examination_id, sitting_name, exam_date, start_time, duration_minutes,
      lab_id, student_count, assigned_student_usns, selected_set_id, selected_set_number,
      versions_generated, package_status
    )
    VALUES (
      $1, $2, 'Morning', '2026-11-20', '09:00', 90,
      'lab-01', $3, $4, 'qs-CS501-set1', 'SET-1', true, 'Package Sent to Lab'
    )
    ON CONFLICT (id) DO NOTHING;
  `, [sittingId, examId, studentUsns.length, studentUsns]);

  // Session Monitoring entry
  await dbPool.query(`
    INSERT INTO session_monitoring (
      id, examination_id, sitting_id, sitting_name, total_allocated,
      students_logged_in, students_started, students_submitted, students_recovering
    )
    VALUES ('mon-cs501-morn', $1, $2, 'Morning', $3, 0, 0, 0, 0)
    ON CONFLICT (id) DO NOTHING;
  `, [examId, sittingId, studentUsns.length]);

  // Sample released examination result for CS502 (Connection 5: COE -> HOD)
  const resultExamId = 'exam-cs502-prev';
  await dbPool.query(`
    INSERT INTO examinations (
      id, subject_id, subject_code, subject_name, department_id, department_code,
      semester_number, exam_date, start_time, duration_minutes, passing_marks,
      maximum_marks, status, lab_readiness, is_finalized_and_frozen, created_by
    )
    VALUES (
      $1, 'sub-cs502', 'CS502', 'Database Management Systems', 'CS', 'CS',
      5, '2026-11-10', '09:00', 90, 20, 50, 'Exam Completed', 'Ready', true, 'usr-coe-01'
    )
    ON CONFLICT (id) DO NOTHING;
  `, [resultExamId]);

  const examResultId = 'res-cs502-01';
  await dbPool.query(`
    INSERT INTO examination_results (
      id, examination_id, subject_code, subject_name, department_id, department_code,
      semester_number, academic_year_id, sitting_name, total_students, pass_count,
      fail_count, absent_count, status, approved_at, approved_by
    )
    VALUES (
      $1, $2, 'CS502', 'Database Management Systems', 'CS', 'CS',
      5, 'ay-2024-25', 'Morning', 8, 8, 0, 0, 'Released', CURRENT_TIMESTAMP, 'usr-coe-01'
    )
    ON CONFLICT (id) DO NOTHING;
  `, [examResultId, resultExamId]);

  for (let idx = 0; idx < sampleStudents.length; idx++) {
    const s = sampleStudents[idx];
    const marks = 38 + idx;
    await dbPool.query(`
      INSERT INTO student_exam_results (
        id, examination_result_id, examination_id, student_id, usn, student_name,
        department_id, department_code, semester_number, section, subject_code,
        subject_name, academic_year_id, marks_obtained, maximum_marks, passing_marks,
        grade, result, approval_status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 'CS', 'CS', 5, 'A', 'CS502',
        'Database Management Systems', 'ay-2024-25', $7, 50, 20, 'A', 'Pass', 'Released'
      )
      ON CONFLICT (id) DO NOTHING;
    `, [`sres-${s.usn}`, examResultId, resultExamId, s.id, s.usn, s.name, marks]);
  }

  console.log('[DB Setup] ✅ Complete! PostgreSQL database "mitm_ems" is fully seeded.');
  await dbPool.end();
}

if (require.main === module) {
  setupDatabase().catch((err) => {
    console.error('[DB Setup] ❌ Error:', err);
    process.exit(1);
  });
}

module.exports = { setupDatabase, DB_CONFIG, TARGET_DB };
