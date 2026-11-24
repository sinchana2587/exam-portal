-- =====================================================================================
-- Maharaja Institute of Technology Mysore (MIT Mysore)
-- Examination Management System — Migration V2
-- Version: V2__phase0_corrections.sql
-- Description: Phase 0 Corrections — Dynamic sets, variable module bounds, response map,
--              version assignment tracking, and department lifecycle status.
-- Target: campusexam_test ONLY
-- =====================================================================================

BEGIN;

-- 1. Strict Target Database Assertion & Re-run Guard
DO $$
BEGIN
    IF current_database() <> 'campusexam_test' THEN
        RAISE EXCEPTION 'CRITICAL SAFETY VIOLATION: Connected to %, expected campusexam_test. Aborting!', current_database();
    END IF;

    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = 'V2') THEN
        RAISE EXCEPTION 'Migration V2 has already been applied. Aborting transaction.';
    END IF;
END $$;

-- 2. Relax 4-set constraint to support dynamic 1..K complete disjoint sets
ALTER TABLE generated_paper DROP CONSTRAINT IF EXISTS generated_paper_paper_number_check;
ALTER TABLE generated_paper ADD CONSTRAINT generated_paper_paper_number_check CHECK (paper_number >= 1);

-- 3. Relax 30-question position limit to allow arbitrary configured module distributions
ALTER TABLE generated_paper_question DROP CONSTRAINT IF EXISTS generated_paper_question_paper_position_check;
ALTER TABLE generated_paper_question ADD CONSTRAINT generated_paper_question_paper_position_check CHECK (paper_position >= 1);

-- 4. Support module bounds up to 12 modules
ALTER TABLE question_bank_item DROP CONSTRAINT IF EXISTS question_bank_item_module_number_check;
ALTER TABLE question_bank_item ADD CONSTRAINT question_bank_item_module_number_check CHECK (module_number >= 1 AND module_number <= 12);

-- 5. Add candidate assigned version to session roster snapshot (Pre-exam version mapping)
ALTER TABLE session_roster_snapshot ADD COLUMN IF NOT EXISTS assigned_version text;

-- 6. Add candidate response audit map JSONB to session result
ALTER TABLE student_session_result ADD COLUMN IF NOT EXISTS response_map jsonb DEFAULT '{}'::jsonb;

-- 7. Add lifecycle status to department (ACTIVE / ARCHIVED)
ALTER TABLE department ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED'));

-- 8. Record migration completion in schema_migrations tracking table
INSERT INTO schema_migrations (version, description) VALUES ('V2', 'phase0_corrections');

COMMIT;
