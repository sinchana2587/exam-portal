-- Migration V4: Reconcile Official MIT Mysore Departments and Soft-Archive Test Records
-- Target database: campusexam_test ONLY.
-- Production database campusexam must NEVER be touched.

DO $$
BEGIN
    IF current_database() != 'campusexam_test' THEN
        RAISE EXCEPTION 'CRITICAL SAFETY VIOLATION: Migration V4 can ONLY be executed against campusexam_test! Current database: %', current_database();
    END IF;

    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = 'V4') THEN
        RAISE EXCEPTION 'Migration V4 has already been applied to campusexam_test.';
    END IF;
END $$;

BEGIN;

-- 1. In-place reconciliation of the 11 official departments (Preserving IDs 1-11 and all FK references)
UPDATE department SET code = 'E158CV', name = 'Civil Engineering', status = 'ACTIVE' WHERE id = 1;
UPDATE department SET code = 'E158CS', name = 'Computer Science & Engineering', status = 'ACTIVE' WHERE id = 2;
UPDATE department SET code = 'E158CA', name = 'Computer Science & Engineering (Artificial Intelligence)', status = 'ACTIVE' WHERE id = 3;
UPDATE department SET code = 'E158CD', name = 'Computer Science & Engineering (Data Science)', status = 'ACTIVE' WHERE id = 4;
UPDATE department SET code = 'E158CB', name = 'Computer Science & Business System', status = 'ACTIVE' WHERE id = 5;
UPDATE department SET code = 'E158CI', name = 'Computer Science & Engineering (Artificial Intelligence & Machine Learning)', status = 'ACTIVE' WHERE id = 6;
UPDATE department SET code = 'E158IC', name = 'Computer Science & Engineering (IoT & Cyber Security including Block Chain Technology)', status = 'ACTIVE' WHERE id = 7;
UPDATE department SET code = 'E158CE', name = 'Computer Engineering', status = 'ACTIVE' WHERE id = 8;
UPDATE department SET code = 'E158EC', name = 'Electronics & Communication Engineering', status = 'ACTIVE' WHERE id = 9;
UPDATE department SET code = 'E158IS', name = 'Information Science & Engineering', status = 'ACTIVE' WHERE id = 10;
UPDATE department SET code = 'E158ME', name = 'Mechanical Engineering', status = 'ACTIVE' WHERE id = 11;

-- Update academic group text column for department 2 to match new code
UPDATE academic_group SET department = 'E158CS' WHERE department_id = 2;

-- 2. Soft-archive test department BT (ID 12) created in Phase 1 Test 8
UPDATE department SET status = 'ARCHIVED' WHERE id = 12;

-- Deactivate associated test HOD account hod_bt (ID 15)
UPDATE account SET status = 'INACTIVE' WHERE id = 15;

-- Close out active HOD assignment history for department 12
UPDATE hod_assignment_history
SET relieved_at = clock_timestamp(), reason = 'Test Data Archived'
WHERE department_id = 12 AND relieved_at IS NULL;

-- 3. Soft-archive other test departments created in Phase 2 automated testing
UPDATE department SET status = 'ARCHIVED' WHERE id IN (13, 14);

-- Ensure test HOD accounts (IDs 17, 18) are INACTIVE
UPDATE account SET status = 'INACTIVE' WHERE id IN (17, 18);

-- Ensure any open assignment history for test departments is closed
UPDATE hod_assignment_history
SET relieved_at = clock_timestamp(), reason = 'Test Data Archived'
WHERE department_id IN (13, 14) AND relieved_at IS NULL;

-- 4. Soft-archive test subjects created in Phase 2 automated testing (CS101 ID 2)
UPDATE subject SET status = 'ARCHIVED' WHERE id = 2;

-- 5. Record audit logs for data reconciliation
INSERT INTO audit (happened, actor, action, entity, detail)
VALUES
(clock_timestamp(), 2, 'RECONCILE_DEPARTMENTS', 'department:1..11', 'Reconciled 11 official MIT Mysore departments in-place to institutional codes and names (E158CV..E158IC). IDs and FKs preserved.'),
(clock_timestamp(), 2, 'ARCHIVE_TEST_DATA', 'department:12', 'Soft-archived test department BT (ID 12) and deactivated HOD hod_bt (ID 15). Preserved all audit records and IDs.'),
(clock_timestamp(), 2, 'ARCHIVE_TEST_DATA', 'department:13..14', 'Soft-archived test departments ROB/ROB2 (IDs 13, 14) and test subject CS101 (ID 2). Preserved all audit records.');

-- 6. Record migration in schema_migrations
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('V4', 'phase2_1_reconcile_departments', clock_timestamp());

COMMIT;
