-- ============================================================================
-- Migration V7: Phase 7 COE Examination Scheduling, Multi-Sitting Allocation,
--              and Secure Lab Package Transfer & Acknowledgement
-- Target: campusexam_test
-- ============================================================================

-- 1. Create examination_sitting table for independent multi-sitting management
CREATE TABLE IF NOT EXISTS examination_sitting (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES examination_session(id) ON DELETE CASCADE,
    sitting_name TEXT NOT NULL CHECK (sitting_name IN ('MORNING', 'AFTERNOON')),
    exam_date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    assigned_lab TEXT NOT NULL,
    lab_capacity INTEGER NOT NULL DEFAULT 60,
    student_count INTEGER NOT NULL DEFAULT 0,
    selected_paper_id BIGINT REFERENCES generated_paper(id),
    status TEXT NOT NULL DEFAULT 'SCHEDULED' 
        CHECK (status IN ('SCHEDULED', 'FROZEN', 'PACKAGE_EXPORTED', 'VERIFIED', 'READY', 'COMPLETED', 'CANCELLED', 'RETIRED')),
    package_revision INTEGER NOT NULL DEFAULT 1,
    package_id TEXT,
    package_status TEXT NOT NULL DEFAULT 'Not Prepared',
    transfer_status TEXT NOT NULL DEFAULT 'Not Sent',
    verification_status TEXT NOT NULL DEFAULT 'Verification Pending',
    lab_receipt_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_session_sitting UNIQUE (session_id, sitting_name)
);

CREATE INDEX IF NOT EXISTS idx_exam_sitting_sched ON examination_sitting(exam_date, sitting_name, assigned_lab);
CREATE INDEX IF NOT EXISTS idx_exam_sitting_session ON examination_sitting(session_id);

-- 2. Enhance session_roster_snapshot to store sitting assignment and original section
ALTER TABLE session_roster_snapshot 
    ADD COLUMN IF NOT EXISTS sitting_name TEXT NOT NULL DEFAULT 'MORNING' CHECK (sitting_name IN ('MORNING', 'AFTERNOON')),
    ADD COLUMN IF NOT EXISTS original_section TEXT;

CREATE INDEX IF NOT EXISTS idx_session_roster_snap_sitting 
    ON session_roster_snapshot(session_id, sitting_name);

-- 3. Enhance paper_version to associate versions with specific sittings
ALTER TABLE paper_version 
    ADD COLUMN IF NOT EXISTS sitting_name TEXT NOT NULL DEFAULT 'MORNING' CHECK (sitting_name IN ('MORNING', 'AFTERNOON'));

ALTER TABLE paper_version DROP CONSTRAINT IF EXISTS paper_version_session_id_version_letter_key;
ALTER TABLE paper_version DROP CONSTRAINT IF EXISTS uq_paper_version_sitting;
ALTER TABLE paper_version ADD CONSTRAINT uq_paper_version_sitting UNIQUE (session_id, sitting_name, version_letter);

-- 4. Relax display_position constraint on paper_version_question to support dynamic blueprint lengths (e.g. 25, 30, 50 Qs)
ALTER TABLE paper_version_question DROP CONSTRAINT IF EXISTS paper_version_question_display_position_check;
ALTER TABLE paper_version_question ADD CONSTRAINT paper_version_question_display_position_check CHECK (display_position >= 1 AND display_position <= 200);

-- 5. Enhance secure_package for sitting-level package isolation and readiness
ALTER TABLE secure_package 
    ADD COLUMN IF NOT EXISTS sitting_name TEXT NOT NULL DEFAULT 'MORNING' CHECK (sitting_name IN ('MORNING', 'AFTERNOON'));

ALTER TABLE secure_package DROP CONSTRAINT IF EXISTS secure_package_session_id_key;
ALTER TABLE secure_package DROP CONSTRAINT IF EXISTS uq_secure_package_session_sitting;
ALTER TABLE secure_package ADD CONSTRAINT uq_secure_package_session_sitting UNIQUE (session_id, sitting_name);

ALTER TABLE secure_package DROP CONSTRAINT IF EXISTS secure_package_status_check;
ALTER TABLE secure_package ADD CONSTRAINT secure_package_status_check 
    CHECK (status = ANY (ARRAY['PREPARED'::text, 'EXPORTED'::text, 'RECEIVED'::text, 'VERIFIED'::text, 'ACCEPTED'::text, 'READY'::text]));

-- 6. Add participating_sections to examination_session
ALTER TABLE examination_session
    ADD COLUMN IF NOT EXISTS participating_sections TEXT[] NOT NULL DEFAULT ARRAY['A'];

-- 7. Create lab_package_acknowledgement table for cryptographic receipt records
CREATE TABLE IF NOT EXISTS lab_package_acknowledgement (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES examination_session(id) ON DELETE CASCADE,
    sitting_name TEXT NOT NULL CHECK (sitting_name IN ('MORNING', 'AFTERNOON')),
    package_uid TEXT NOT NULL,
    package_hash TEXT NOT NULL,
    lab_server_id TEXT NOT NULL,
    verification_result TEXT NOT NULL,
    receipt_status TEXT NOT NULL,
    signature_hex TEXT NOT NULL,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_lab_package_ack UNIQUE (session_id, sitting_name, package_uid)
);

CREATE INDEX IF NOT EXISTS idx_lab_pkg_ack_session ON lab_package_acknowledgement(session_id, sitting_name);

-- 8. Record migration V7
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('V7', 'phase7_coe_scheduling_and_lab_package', CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
