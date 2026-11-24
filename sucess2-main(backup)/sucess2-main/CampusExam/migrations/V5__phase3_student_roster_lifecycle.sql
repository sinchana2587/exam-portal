-- Migration V5: Section Lifecycle, Student Status, and Roster Revision History
-- Target database: campusexam_test ONLY.
-- Production database campusexam must NEVER be touched.

DO $$
BEGIN
    IF current_database() != 'campusexam_test' THEN
        RAISE EXCEPTION 'CRITICAL SAFETY VIOLATION: Migration V5 can ONLY be executed against campusexam_test! Current database: %', current_database();
    END IF;

    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = 'V5') THEN
        RAISE EXCEPTION 'Migration V5 has already been applied to campusexam_test.';
    END IF;
END $$;

BEGIN;

-- 1. Enhance academic_group with lifecycle status and timestamps
ALTER TABLE academic_group
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'academic_group_status_check'
    ) THEN
        ALTER TABLE academic_group
            ADD CONSTRAINT academic_group_status_check CHECK (status IN ('ACTIVE', 'ARCHIVED'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_academic_group_dept_sem_status
    ON academic_group (department_id, semester, status);

-- 2. Enhance student_roster with lifecycle status and tracking
ALTER TABLE student_roster
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS unenroll_reason TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'student_roster_status_check'
    ) THEN
        ALTER TABLE student_roster
            ADD CONSTRAINT student_roster_status_check CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'SUPERSEDED'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_roster_dept_sem_sec_status
    ON student_roster (department_id, semester, section, status);

-- 3. Create student_list_history for revision tracking & audit
CREATE TABLE IF NOT EXISTS student_list_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES academic_group(id),
    department_id BIGINT NOT NULL REFERENCES department(id),
    semester INT NOT NULL,
    section TEXT NOT NULL,
    revision_number TEXT NOT NULL DEFAULT 'R1',
    file_name TEXT,
    source_type TEXT NOT NULL DEFAULT 'EXCEL_UPLOAD',
    action_type TEXT NOT NULL DEFAULT 'UPLOAD',
    total_students INT NOT NULL DEFAULT 0,
    valid_count INT NOT NULL DEFAULT 0,
    invalid_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Active',
    performed_by BIGINT REFERENCES account(id),
    performed_by_name TEXT,
    summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_student_list_history_group
    ON student_list_history (group_id, created_at DESC);

-- 4. Create student_roster_history for point-in-time roster snapshots
CREATE TABLE IF NOT EXISTS student_roster_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    history_id BIGINT NOT NULL REFERENCES student_list_history(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES student_roster(id),
    group_id BIGINT NOT NULL REFERENCES academic_group(id),
    usn TEXT NOT NULL,
    full_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    status TEXT NOT NULL,
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_student_roster_history_hist
    ON student_roster_history (history_id);

-- 5. Seed baseline revision record for existing 45 students in CSE Sem 5 Sec A
INSERT INTO student_list_history (
    group_id, department_id, semester, section, revision_number, file_name,
    source_type, action_type, total_students, valid_count, invalid_count, status,
    performed_by, performed_by_name, summary, created_at
)
SELECT 
    1, 2, 5, 'Section A', 'R1', 'CSE_Sem5_SectionA_Baseline.xlsx',
    'EXCEL_UPLOAD', 'UPLOAD', 45, 45, 0, 'Active',
    5, 'HOD Computer Science and Engineering',
    '{"initialSeed": true, "studentCount": 45}'::jsonb,
    clock_timestamp()
WHERE EXISTS (SELECT 1 FROM academic_group WHERE id = 1)
  AND NOT EXISTS (SELECT 1 FROM student_list_history WHERE group_id = 1);

-- Snapshot existing 45 baseline students
INSERT INTO student_roster_history (history_id, student_id, group_id, usn, full_name, date_of_birth, status, snapshot_at)
SELECT 
    slh.id, sr.id, sr.group_id, sr.usn, sr.full_name, sr.date_of_birth, sr.status, clock_timestamp()
FROM student_roster sr
JOIN student_list_history slh ON slh.group_id = sr.group_id
WHERE sr.group_id = 1
  AND NOT EXISTS (SELECT 1 FROM student_roster_history WHERE group_id = 1);

-- 6. Record audit log
INSERT INTO audit (happened, actor, action, entity, detail)
VALUES (clock_timestamp(), 2, 'SCHEMA_MIGRATION_V5', 'schema:academic_group,student_roster,student_list_history', 'Applied migration V5: Section and Student Roster Lifecycle Management with revision history.');

-- 7. Record migration in schema_migrations
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('V5', 'phase3_student_roster_lifecycle', clock_timestamp());

COMMIT;
