-- =====================================================================================
-- Maharaja Institute of Technology Mysore (MIT Mysore)
-- Examination Management System — Migration V3
-- Version: V3__phase2_academic_lifecycle.sql
-- Description: Phase 2 Academic Master & Department Lifecycle Management
--              - Add module_count and status to subject
--              - Enforce unique subject code per (department_id, semester, code)
--              - Create HOD assignment history table for full lifecycle tracking
--              - Populate initial baseline HOD assignment history
--              - Expand department status constraint to support ACTIVE, ARCHIVED, INACTIVE
-- Target: campusexam_test ONLY
-- =====================================================================================

BEGIN;

-- 1. Strict Target Database Assertion & Re-run Guard
DO $$
BEGIN
    IF current_database() <> 'campusexam_test' THEN
        RAISE EXCEPTION 'CRITICAL SAFETY VIOLATION: Connected to %, expected campusexam_test. Aborting!', current_database();
    END IF;

    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = 'V3') THEN
        RAISE EXCEPTION 'Migration V3 has already been applied. Aborting transaction.';
    END IF;
END $$;

-- 2. Expand department status check to support ACTIVE, ARCHIVED, and INACTIVE
ALTER TABLE department DROP CONSTRAINT IF EXISTS department_status_check;
ALTER TABLE department ADD CONSTRAINT department_status_check CHECK (status IN ('ACTIVE', 'ARCHIVED', 'INACTIVE'));

-- 3. Add module_count (1..12) and status (ACTIVE / ARCHIVED) to subject
ALTER TABLE subject ADD COLUMN IF NOT EXISTS module_count INT NOT NULL DEFAULT 5 CHECK (module_count >= 1 AND module_count <= 12);
ALTER TABLE subject ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED'));

-- 4. Transition subject unique constraint from global code to (department_id, semester, code)
ALTER TABLE subject DROP CONSTRAINT IF EXISTS subject_code_key;
ALTER TABLE subject DROP CONSTRAINT IF EXISTS chk_subject_dept_sem_code;
ALTER TABLE subject ADD CONSTRAINT chk_subject_dept_sem_code UNIQUE (department_id, semester, code);

-- 5. Create HOD Assignment History table to record all assignments and replacements without destroying history
CREATE TABLE IF NOT EXISTS hod_assignment_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id BIGINT NOT NULL REFERENCES department(id),
    account_id BIGINT NOT NULL REFERENCES account(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    relieved_at TIMESTAMPTZ,
    reason TEXT NOT NULL DEFAULT 'Initial Assignment',
    assigned_by BIGINT REFERENCES account(id)
);

CREATE INDEX IF NOT EXISTS idx_hod_assignment_dept ON hod_assignment_history(department_id);
CREATE INDEX IF NOT EXISTS idx_hod_assignment_account ON hod_assignment_history(account_id);

-- 6. Populate baseline HOD assignment history from existing active HOD accounts
INSERT INTO hod_assignment_history (department_id, account_id, assigned_at, reason, assigned_by)
SELECT a.department_id, a.id, a.created_at, 'Initial Baseline System Provisioning', 2
FROM account a
WHERE a.role = 'HOD' AND a.department_id IS NOT NULL AND a.status = 'ACTIVE'
ON CONFLICT DO NOTHING;

-- 7. Record migration completion in schema_migrations
INSERT INTO schema_migrations (version, description) VALUES ('V3', 'phase2_academic_lifecycle');

COMMIT;
