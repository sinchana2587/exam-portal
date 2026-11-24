-- =====================================================================================
-- Maharaja Institute of Technology Mysore (MIT Mysore)
-- Examination Management System — Schema Expansion Migration
-- Version: V1__expand_schema_for_portals.sql
-- Description: Non-destructive schema expansion for Admin, COE, and Student Portals
-- Target: PostgreSQL 14+
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. Table Alterations (3 Existing Tables)
-- -------------------------------------------------------------------------------------

-- 1.1 `account` Table Extensions
ALTER TABLE account ADD COLUMN IF NOT EXISTS contact_number text;
ALTER TABLE account ADD COLUMN IF NOT EXISTS employee_id text;
ALTER TABLE account ADD COLUMN IF NOT EXISTS designation text;
ALTER TABLE account ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE account ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE account ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'system';

ALTER TABLE account DROP CONSTRAINT IF EXISTS chk_account_status;
ALTER TABLE account ADD CONSTRAINT chk_account_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'));

-- 1.2 `question_bank_item` Table Extensions
ALTER TABLE question_bank_item ADD COLUMN IF NOT EXISTS has_images boolean NOT NULL DEFAULT false;
ALTER TABLE question_bank_item ADD COLUMN IF NOT EXISTS stem_images jsonb DEFAULT '[]'::jsonb;
ALTER TABLE question_bank_item ADD COLUMN IF NOT EXISTS option_images jsonb DEFAULT '[]'::jsonb;

-- 1.3 `examination_session` Table Extensions
ALTER TABLE examination_session ADD COLUMN IF NOT EXISTS total_marks numeric(8,2) NOT NULL DEFAULT 30.00;
ALTER TABLE examination_session ADD COLUMN IF NOT EXISTS passing_marks numeric(8,2);
UPDATE examination_session SET passing_marks = ROUND(total_marks * 0.40, 2) WHERE passing_marks IS NULL;
ALTER TABLE examination_session ALTER COLUMN passing_marks SET NOT NULL;

ALTER TABLE examination_session DROP CONSTRAINT IF EXISTS chk_passing_marks_range;
ALTER TABLE examination_session ADD CONSTRAINT chk_passing_marks_range CHECK (passing_marks > 0 AND passing_marks <= total_marks);

ALTER TABLE examination_session ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE examination_session ADD COLUMN IF NOT EXISTS is_cancelled boolean NOT NULL DEFAULT false;
ALTER TABLE examination_session ADD COLUMN IF NOT EXISTS package_revision int NOT NULL DEFAULT 1;

ALTER TABLE examination_session DROP CONSTRAINT IF EXISTS examination_session_status_check;
ALTER TABLE examination_session ADD CONSTRAINT examination_session_status_check CHECK (
    status IN ('SCHEDULED', 'FROZEN', 'PACKAGE_EXPORTED', 'RESULTS_IMPORTED', 'APPROVED', 'RELEASED', 'CANCELLED', 'RETIRED')
);

-- -------------------------------------------------------------------------------------
-- 2. New Master Tables (9 Tables)
-- -------------------------------------------------------------------------------------

-- 2.1 Course Outcome Submission Master
CREATE TABLE IF NOT EXISTS course_outcome_submission (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_id bigint NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
    department_id bigint REFERENCES department(id),
    academic_session text NOT NULL,
    semester int NOT NULL CHECK (semester BETWEEN 1 AND 8),
    current_revision int NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'Under Review' CHECK (status IN ('Under Review', 'Reviewed', 'Clarification Requested')),
    created_by bigint NOT NULL REFERENCES account(id),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(subject_id, academic_session)
);

-- 2.2 Course Outcome Document Revision
CREATE TABLE IF NOT EXISTS course_outcome_revision (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    submission_id bigint NOT NULL REFERENCES course_outcome_submission(id) ON DELETE CASCADE,
    revision_number int NOT NULL,
    file_name text NOT NULL,
    file_size_bytes bigint NOT NULL,
    file_hash_sha256 text NOT NULL,
    pdf_blob bytea,
    uploaded_by bigint NOT NULL REFERENCES account(id),
    uploaded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(submission_id, revision_number)
);

-- 2.3 Course Outcome Discrete Statements
CREATE TABLE IF NOT EXISTS course_outcome_statement (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    revision_id bigint NOT NULL REFERENCES course_outcome_revision(id) ON DELETE CASCADE,
    co_code text NOT NULL,
    description text NOT NULL,
    bloom_level text NOT NULL,
    target_percentage numeric(5,2),
    UNIQUE(revision_id, co_code)
);

-- 2.4 Course Outcome Formal Review Audit Log
CREATE TABLE IF NOT EXISTS course_outcome_review (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    submission_id bigint NOT NULL REFERENCES course_outcome_submission(id) ON DELETE CASCADE,
    reviewed_by bigint NOT NULL REFERENCES account(id),
    decision text NOT NULL CHECK (decision IN ('REVIEWED_OK', 'CLARIFICATION_REQUESTED')),
    comments text NOT NULL,
    reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- 2.5 Answer Key Correction Disputes
CREATE TABLE IF NOT EXISTS answer_key_correction (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id bigint NOT NULL REFERENCES examination_session(id) ON DELETE CASCADE,
    subject_id bigint NOT NULL REFERENCES subject(id),
    question_uid text NOT NULL,
    question_text text NOT NULL,
    original_correct text NOT NULL CHECK (original_correct IN ('A', 'B', 'C', 'D')),
    proposed_correct text NOT NULL CHECK (proposed_correct IN ('A', 'B', 'C', 'D', 'ALL_CORRECT', 'SCRAP_QUESTION')),
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    submitted_by bigint NOT NULL REFERENCES account(id),
    submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    decided_by bigint REFERENCES account(id),
    decided_at timestamptz,
    decision_reason text
);

-- 2.6 Session Unlock Credential Verifiers
CREATE TABLE IF NOT EXISTS session_unlock_credential (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id bigint NOT NULL REFERENCES examination_session(id) ON DELETE CASCADE,
    sitting_name text NOT NULL CHECK (sitting_name IN ('MORNING', 'AFTERNOON')),
    masked_preview text NOT NULL,
    verifier_hash text NOT NULL,
    salt text NOT NULL,
    iterations int NOT NULL DEFAULT 600000,
    revision int NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Revoked', 'Expired', 'Superseded')),
    generated_by bigint NOT NULL REFERENCES account(id),
    generated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    expires_at timestamptz NOT NULL,
    last_synced_at timestamptz,
    UNIQUE(session_id, sitting_name, revision)
);

-- 2.7 Security Violation & Proctored Telemetry Log
CREATE TABLE IF NOT EXISTS security_violation_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id bigint NOT NULL REFERENCES examination_session(id) ON DELETE CASCADE,
    student_usn text NOT NULL,
    workstation_id text,
    violation_type text NOT NULL CHECK (violation_type IN ('TAB_SWITCH', 'WINDOW_BLUR', 'SHORTCUT_KEY', 'FULLSCREEN_EXIT', 'DEVTOOLS_ATTEMPT')),
    label text NOT NULL,
    description text NOT NULL,
    current_question_index int,
    remaining_seconds int,
    answered_count int,
    logged_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- 2.8 Re-Login Authorization Tokens
CREATE TABLE IF NOT EXISTS relogin_authorization (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id bigint NOT NULL REFERENCES examination_session(id) ON DELETE CASCADE,
    student_usn text NOT NULL,
    assigned_workstation_id text NOT NULL,
    target_workstation_id text DEFAULT 'Any Available PC',
    token_id text NOT NULL UNIQUE,
    token_hash text NOT NULL UNIQUE,
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'USED', 'EXPIRED')),
    authorized_by bigint REFERENCES account(id),
    authorized_at timestamptz,
    expires_at timestamptz NOT NULL,
    is_one_time_used boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- 2.9 Workstation Migration & Session Transfer Audit History
CREATE TABLE IF NOT EXISTS session_transfer_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id bigint NOT NULL REFERENCES examination_session(id) ON DELETE CASCADE,
    student_usn text NOT NULL,
    from_workstation text NOT NULL,
    to_workstation text NOT NULL,
    authorization_id bigint REFERENCES relogin_authorization(id),
    reason text NOT NULL,
    transferred_by bigint NOT NULL REFERENCES account(id),
    transferred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- -------------------------------------------------------------------------------------
-- 3. Performance & Integrity Indexes (8 Indexes: 1 Partial Unique + 7 B-Tree)
-- -------------------------------------------------------------------------------------

-- 3.1 Partial Unique Index: Strictly enforces AT MOST ONE active unlock credential per sitting
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_unlock_credential
ON session_unlock_credential(session_id, sitting_name)
WHERE status = 'Active';

-- 3.2 Account Directory & Role Filtering
CREATE INDEX IF NOT EXISTS idx_account_dept_role ON account(department_id, role);

-- 3.3 Course Outcomes Submission Department/Semester Lookup
CREATE INDEX IF NOT EXISTS idx_co_submission_dept_sem ON course_outcome_submission(department_id, semester);

-- 3.4 Answer Key Dispute Resolution by Session
CREATE INDEX IF NOT EXISTS idx_key_corr_session ON answer_key_correction(session_id, status);

-- 3.5 Session Unlock Credential Lookup
CREATE INDEX IF NOT EXISTS idx_unlock_cred_session ON session_unlock_credential(session_id, status);

-- 3.6 Candidate Security Violation Log Lookup
CREATE INDEX IF NOT EXISTS idx_sec_violation_session_usn ON security_violation_log(session_id, student_usn);

-- 3.7 Emergency Re-Login Token Verification by Session and Candidate
CREATE INDEX IF NOT EXISTS idx_relogin_auth_session_usn ON relogin_authorization(session_id, student_usn, status);

-- 3.8 Candidate Workstation Transfer History Audit
CREATE INDEX IF NOT EXISTS idx_session_transfer_session_usn ON session_transfer_history(session_id, student_usn);

COMMIT;
