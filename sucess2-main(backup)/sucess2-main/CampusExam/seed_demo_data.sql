-- ====================================================================
-- MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE - EXAMINATION MANAGEMENT SYSTEM
-- DEMO SEED DATA FOR LOCAL DEVELOPMENT & CROSS-MACHINE TESTING
-- All student data and credentials below are strictly SYNTHETIC.
-- ====================================================================

BEGIN;

-- 1. DEPARTMENTS
INSERT INTO department (id, code, name, status) OVERRIDING SYSTEM VALUE VALUES
(1, 'E158CV', 'Civil Engineering', 'ACTIVE'),
(2, 'E158CS', 'Computer Science & Engineering', 'ACTIVE'),
(3, 'E158CA', 'Computer Science & Engineering (Artificial Intelligence)', 'ACTIVE'),
(4, 'E158CD', 'Computer Science & Engineering (Data Science)', 'ACTIVE'),
(5, 'E158CB', 'Computer Science & Business System', 'ACTIVE'),
(6, 'E158CI', 'Computer Science & Engineering (Artificial Intelligence & Machine Learning)', 'ACTIVE'),
(7, 'E158IC', 'Computer Science & Engineering (IoT & Cyber Security including Block Chain Technology)', 'ACTIVE'),
(8, 'E158CE', 'Computer Engineering', 'ACTIVE'),
(9, 'E158EC', 'Electronics & Communication Engineering', 'ACTIVE'),
(10, 'E158IS', 'Information Science & Engineering', 'ACTIVE'),
(11, 'E158ME', 'Mechanical Engineering', 'ACTIVE')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE';

SELECT setval('department_id_seq', (SELECT COALESCE(MAX(id), 1) FROM department));

-- 2. ACCOUNTS
-- Default passwords:
--   admin:     Admin@123
--   principal: PRINCIPAL@7658 or Admin@123
--   coe:       COE@5828 or Admin@123
--   hod.cse:   CSE@2109 or Admin@123
--   hod.ise:   ISE@3325 or Admin@123
INSERT INTO account (username, password_hash, role, department_id, full_name, email, employee_id, designation, status) VALUES
('admin', '58c67f90192d52a3addc66e0981e69fa:16ad10abb89f8d45ef0ca3fcf12335efe39bc8c9d0268006112d870432696d80', 'ADMIN', NULL, 'System Administrator', 'admin@mitmysore.in', 'EMP-ADMIN', 'Central Administrator', 'ACTIVE'),
('principal', 'ce1a9cde546924c728cd7d0f65f2bc0b:8c742a9b686db27897e42426c33971a6de2585cd2d365b38a1a00b61e2617033', 'PRINCIPAL', NULL, 'Dr. B. G. Naresh Kumar', 'principal@mitmysore.in', 'EMP-PRINCIPAL', 'Principal & Chief Academic Officer', 'ACTIVE'),
('coe', 'f196ae1c9469cc1cac0a74f7930d2f59:fd64fcf2ee16ecf868597f2b1b2edfab11e04211e5dedb7c9cf61bdfb9d571c6', 'COE', NULL, 'Dr. C. Ramaswamy', 'coe@mitmysore.in', 'EMP-COE', 'Controller of Examinations', 'ACTIVE'),
('hod.cse', '4d0ffea346321aac6314c05a2b82386b:312c033aaf8ffd6ce463c9d09e0d6147ca5408b7e1bb529cda137579b325e5b0', 'HOD', (SELECT id FROM department WHERE code='E158CS'), 'Dr. Deepu R', 'hod.cse@mitmysore.in', 'EMP-HOD-CSE', 'Professor & Head of Department', 'ACTIVE'),
('hod.ise', '7b6784005fe514108ee5844f535e7d87:134357c589b4897989639e5150c39fbe53b6441a2d30ca61a147e9d9faafc3e2', 'HOD', (SELECT id FROM department WHERE code='E158IS'), 'Dr. Sharath Kumar Y H', 'hod.ise@mitmysore.in', 'EMP-HOD-ISE', 'Professor & Head of Department', 'ACTIVE'),
('hod.civil', 'b163068351494c0b5170693769638171:bab53ff10a3519a8690ce5a218547589e324bda056383ebfbfa25f89011b3682', 'HOD', (SELECT id FROM department WHERE code='E158CV'), 'Dr. Civil HOD', 'hod.civil@mitmysore.in', 'EMP-HOD-CV', 'Head of Department', 'ACTIVE'),
('hod.ece', 'b163068351494c0b5170693769638171:bab53ff10a3519a8690ce5a218547589e324bda056383ebfbfa25f89011b3682', 'HOD', (SELECT id FROM department WHERE code='E158EC'), 'Dr. ECE HOD', 'hod.ece@mitmysore.in', 'EMP-HOD-EC', 'Head of Department', 'ACTIVE'),
('hod.mech', 'b163068351494c0b5170693769638171:bab53ff10a3519a8690ce5a218547589e324bda056383ebfbfa25f89011b3682', 'HOD', (SELECT id FROM department WHERE code='E158ME'), 'Dr. Mech HOD', 'hod.mech@mitmysore.in', 'EMP-HOD-ME', 'Head of Department', 'ACTIVE')
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  department_id = EXCLUDED.department_id,
  full_name = EXCLUDED.full_name,
  status = 'ACTIVE';

-- 3. ACADEMIC GROUPS
INSERT INTO academic_group (department, academic_session, study_year, semester, section, department_id, year, status) VALUES
('E158CS', '2025-26', 2, 4, 'Section A', (SELECT id FROM department WHERE code='E158CS'), 2, 'ACTIVE'),
('E158CS', '2025-26', 2, 4, 'Section B', (SELECT id FROM department WHERE code='E158CS'), 2, 'ACTIVE'),
('E158IS', '2025-26', 2, 4, 'Section A', (SELECT id FROM department WHERE code='E158IS'), 2, 'ACTIVE'),
('E158IS', '2025-26', 2, 4, 'Section B', (SELECT id FROM department WHERE code='E158IS'), 2, 'ACTIVE')
ON CONFLICT (department, academic_session, study_year, semester, section) DO NOTHING;

-- 4. SUBJECTS
INSERT INTO subject (code, name, department_id, semester, applicable_sections, status) VALUES
('M25BSCK', 'DRUG DISCOVERY', (SELECT id FROM department WHERE code='E158CS'), 4, ARRAY['Section A', 'Section B'], 'ACTIVE'),
('MH25OS56', 'NON OPERATING SYSTEM', (SELECT id FROM department WHERE code='E158IS'), 4, ARRAY['Section A', 'Section B'], 'ACTIVE'),
('M23CDSE', 'DATA ALGO', (SELECT id FROM department WHERE code='E158CS'), 8, ARRAY['Section A'], 'ACTIVE')
ON CONFLICT (department_id, semester, code) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE';

-- 5. SYNTHETIC STUDENT ROSTER
-- CSE Students (Semester 4, Section A)
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH27CS001', 'Aarav Sharma', '2004-01-01', (SELECT id FROM department WHERE code='E158CS'), (SELECT id FROM academic_group WHERE department='E158CS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH27CS002', 'Aditi Rao', '2004-01-02', (SELECT id FROM department WHERE code='E158CS'), (SELECT id FROM academic_group WHERE department='E158CS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH27CS003', 'Ananya Hegde', '2004-01-03', (SELECT id FROM department WHERE code='E158CS'), (SELECT id FROM academic_group WHERE department='E158CS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH27CS004', 'Chetan Kumar', '2004-01-04', (SELECT id FROM department WHERE code='E158CS'), (SELECT id FROM academic_group WHERE department='E158CS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH27CS005', 'Divya Suresh', '2004-01-05', (SELECT id FROM department WHERE code='E158CS'), (SELECT id FROM academic_group WHERE department='E158CS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH27CS006', 'Girish Gowda', '2004-01-06', (SELECT id FROM department WHERE code='E158CS'), (SELECT id FROM academic_group WHERE department='E158CS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH27CS007', 'Harshitha K', '2004-01-07', (SELECT id FROM department WHERE code='E158CS'), (SELECT id FROM academic_group WHERE department='E158CS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH27CS008', 'Karthik Shenoy', '2004-01-08', (SELECT id FROM department WHERE code='E158CS'), (SELECT id FROM academic_group WHERE department='E158CS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH27CS009', 'Lavanya Prasad', '2004-01-09', (SELECT id FROM department WHERE code='E158CS'), (SELECT id FROM academic_group WHERE department='E158CS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH27CS010', 'Manoj Patil', '2004-01-10', (SELECT id FROM department WHERE code='E158CS'), (SELECT id FROM academic_group WHERE department='E158CS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';

-- ISE Students (Semester 4, Section A)
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH24IS001', 'Bhavana Gowda', '2004-02-01', (SELECT id FROM department WHERE code='E158IS'), (SELECT id FROM academic_group WHERE department='E158IS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH24IS002', 'Chirag Hegde', '2004-02-02', (SELECT id FROM department WHERE code='E158IS'), (SELECT id FROM academic_group WHERE department='E158IS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH24IS003', 'Deepa Nayak', '2004-02-03', (SELECT id FROM department WHERE code='E158IS'), (SELECT id FROM academic_group WHERE department='E158IS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH24IS004', 'Gagandeep S', '2004-02-04', (SELECT id FROM department WHERE code='E158IS'), (SELECT id FROM academic_group WHERE department='E158IS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH24IS005', 'Keerthana M', '2004-02-05', (SELECT id FROM department WHERE code='E158IS'), (SELECT id FROM academic_group WHERE department='E158IS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH24IS006', 'Nikhil Bhat', '2004-02-06', (SELECT id FROM department WHERE code='E158IS'), (SELECT id FROM academic_group WHERE department='E158IS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH24IS007', 'Pooja Kulkarni', '2004-02-07', (SELECT id FROM department WHERE code='E158IS'), (SELECT id FROM academic_group WHERE department='E158IS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH24IS008', 'Rohit Varma', '2004-02-08', (SELECT id FROM department WHERE code='E158IS'), (SELECT id FROM academic_group WHERE department='E158IS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH24IS009', 'Sanjay Murthy', '2004-02-09', (SELECT id FROM department WHERE code='E158IS'), (SELECT id FROM academic_group WHERE department='E158IS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';
INSERT INTO student_roster (usn, full_name, date_of_birth, department_id, group_id, semester, section, status)
VALUES ('4MH24IS010', 'Tejaswini R', '2004-02-10', (SELECT id FROM department WHERE code='E158IS'), (SELECT id FROM academic_group WHERE department='E158IS' AND semester=4 AND section='Section A' LIMIT 1), 4, 'A', 'ACTIVE')
ON CONFLICT (usn) DO UPDATE SET full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, status = 'ACTIVE';

-- 6. LABORATORIES
INSERT INTO laboratory (code, name, building_location, capacity, status) VALUES
('LAB-CSE-01', 'CSE Computing Laboratory 1', 'CSE Block - 2nd Floor', 60, 'ACTIVE'),
('ROBOTICS-09', 'Robotics and Autonomous Systems Lab', 'Advanced Tech Center - 3rd Floor', 40, 'ACTIVE'),
('LAB-ISE-01', 'ISE Software Engineering Lab', 'ISE Block - 1st Floor', 50, 'ACTIVE')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, capacity = EXCLUDED.capacity, status = 'ACTIVE';

-- 7. EXAMINATION CYCLE
INSERT INTO examination_cycle (title, academic_session, cycle_type, created_by) VALUES
('2026-DEC', '2025-26', 'REGULAR', (SELECT id FROM account WHERE username='coe' LIMIT 1))
ON CONFLICT DO NOTHING;

-- 8. RECORD MIGRATIONS BASELINE
INSERT INTO schema_migrations (version, description, applied_at) VALUES
('V1', 'baseline_schema_snapshot', clock_timestamp()),
('V2', 'phase0_corrections', clock_timestamp()),
('V3', 'phase2_academic_lifecycle', clock_timestamp()),
('V4', 'phase2_1_reconcile_departments', clock_timestamp()),
('V5', 'phase3_student_roster_lifecycle', clock_timestamp()),
('V6', 'phase6_paper_blueprint', clock_timestamp()),
('V7', 'phase7_coe_scheduling_and_lab_package', clock_timestamp()),
('V8', 'phase10_result_approval_and_release', clock_timestamp()),
('V9', 'phase11_laboratory_management_and_examiners', clock_timestamp()),
('V10', 'phase12_unlock_credential_sync_status', clock_timestamp())
ON CONFLICT (version) DO NOTHING;

COMMIT;
