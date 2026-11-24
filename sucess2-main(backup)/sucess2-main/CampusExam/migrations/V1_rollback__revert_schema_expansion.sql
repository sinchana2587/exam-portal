-- =====================================================================================
-- Maharaja Institute of Technology Mysore (MIT Mysore)
-- Examination Management System — Schema Expansion Rollback
-- Version: V1_rollback__revert_schema_expansion.sql
-- Description: Safeguarded rollback for schema expansion
-- Execution Requirement: SET LOCAL campus_exam.confirm_destructive_rollback = 'CONFIRMED';
-- Target: PostgreSQL 14+
-- =====================================================================================

BEGIN;

-- -------------------------------------------------------------------------------------
-- 1. Operator Safeguard Authorization Check
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
    confirm_flag text;
BEGIN
    BEGIN
        confirm_flag := current_setting('campus_exam.confirm_destructive_rollback');
    EXCEPTION WHEN OTHERS THEN
        confirm_flag := 'UNSET';
    END;

    IF confirm_flag IS DISTINCT FROM 'CONFIRMED' THEN
        RAISE EXCEPTION 'Rollback aborted: Explicit operator confirmation missing. You must issue "SET LOCAL campus_exam.confirm_destructive_rollback = ''CONFIRMED'';" within this transaction session.';
    END IF;
END $$;

-- -------------------------------------------------------------------------------------
-- 2. Data Loss Prevention Checks
-- -------------------------------------------------------------------------------------
DO $$
DECLARE
    co_sub_count bigint := 0;
    key_corr_count bigint := 0;
    unlock_cred_count bigint := 0;
    sec_violation_count bigint := 0;
    relogin_auth_count bigint := 0;
    session_transfer_count bigint := 0;
BEGIN
    SELECT count(*) INTO co_sub_count FROM information_schema.tables WHERE table_name = 'course_outcome_submission';
    IF co_sub_count > 0 THEN
        EXECUTE 'SELECT count(*) FROM course_outcome_submission' INTO co_sub_count;
    END IF;

    SELECT count(*) INTO key_corr_count FROM information_schema.tables WHERE table_name = 'answer_key_correction';
    IF key_corr_count > 0 THEN
        EXECUTE 'SELECT count(*) FROM answer_key_correction' INTO key_corr_count;
    END IF;

    SELECT count(*) INTO unlock_cred_count FROM information_schema.tables WHERE table_name = 'session_unlock_credential';
    IF unlock_cred_count > 0 THEN
        EXECUTE 'SELECT count(*) FROM session_unlock_credential' INTO unlock_cred_count;
    END IF;

    SELECT count(*) INTO sec_violation_count FROM information_schema.tables WHERE table_name = 'security_violation_log';
    IF sec_violation_count > 0 THEN
        EXECUTE 'SELECT count(*) FROM security_violation_log' INTO sec_violation_count;
    END IF;

    SELECT count(*) INTO relogin_auth_count FROM information_schema.tables WHERE table_name = 'relogin_authorization';
    IF relogin_auth_count > 0 THEN
        EXECUTE 'SELECT count(*) FROM relogin_authorization' INTO relogin_auth_count;
    END IF;

    SELECT count(*) INTO session_transfer_count FROM information_schema.tables WHERE table_name = 'session_transfer_history';
    IF session_transfer_count > 0 THEN
        EXECUTE 'SELECT count(*) FROM session_transfer_history' INTO session_transfer_count;
    END IF;

    IF (co_sub_count + key_corr_count + unlock_cred_count + sec_violation_count + relogin_auth_count + session_transfer_count) > 0 THEN
        RAISE EXCEPTION 'Rollback aborted: One or more portal tables contain active operational records (co_submissions: %, key_corrections: %, unlock_credentials: %, sec_violations: %, relogin_auths: %, transfers: %). A separately reviewed data-export procedure must be completed prior to schema reduction.',
            co_sub_count, key_corr_count, unlock_cred_count, sec_violation_count, relogin_auth_count, session_transfer_count;
    END IF;
END $$;

-- -------------------------------------------------------------------------------------
-- 3. Drop New Tables (Reverse Dependency Order)
-- -------------------------------------------------------------------------------------
DROP TABLE IF EXISTS session_transfer_history CASCADE;
DROP TABLE IF EXISTS relogin_authorization CASCADE;
DROP TABLE IF EXISTS security_violation_log CASCADE;
DROP TABLE IF EXISTS session_unlock_credential CASCADE;
DROP TABLE IF EXISTS answer_key_correction CASCADE;
DROP TABLE IF EXISTS course_outcome_review CASCADE;
DROP TABLE IF EXISTS course_outcome_statement CASCADE;
DROP TABLE IF EXISTS course_outcome_revision CASCADE;
DROP TABLE IF EXISTS course_outcome_submission CASCADE;

-- -------------------------------------------------------------------------------------
-- 4. Revert Altered Table Extensions (Non-destructive check)
-- -------------------------------------------------------------------------------------
ALTER TABLE examination_session DROP CONSTRAINT IF EXISTS chk_passing_marks_range;
ALTER TABLE examination_session DROP COLUMN IF EXISTS passing_marks;
ALTER TABLE examination_session DROP COLUMN IF EXISTS total_marks;
ALTER TABLE examination_session DROP COLUMN IF EXISTS cancellation_reason;
ALTER TABLE examination_session DROP COLUMN IF EXISTS is_cancelled;
ALTER TABLE examination_session DROP COLUMN IF EXISTS package_revision;

ALTER TABLE question_bank_item DROP COLUMN IF EXISTS has_images;
ALTER TABLE question_bank_item DROP COLUMN IF EXISTS stem_images;
ALTER TABLE question_bank_item DROP COLUMN IF EXISTS option_images;

ALTER TABLE account DROP CONSTRAINT IF EXISTS chk_account_status;
ALTER TABLE account DROP COLUMN IF EXISTS contact_number;
ALTER TABLE account DROP COLUMN IF EXISTS employee_id;
ALTER TABLE account DROP COLUMN IF EXISTS designation;
ALTER TABLE account DROP COLUMN IF EXISTS status;
ALTER TABLE account DROP COLUMN IF EXISTS last_login_at;
ALTER TABLE account DROP COLUMN IF EXISTS theme_preference;

COMMIT;
