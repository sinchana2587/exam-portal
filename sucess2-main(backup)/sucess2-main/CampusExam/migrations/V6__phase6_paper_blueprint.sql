-- Migration V6: Paper Blueprint, Module Distribution and Question Status Lifecycle
-- Target database: campusexam_test ONLY.
-- Production database campusexam must NEVER be touched.

DO $$
BEGIN
    IF current_database() != 'campusexam_test' THEN
        RAISE EXCEPTION 'CRITICAL SAFETY VIOLATION: Migration V6 can ONLY be executed against campusexam_test! Current database: %', current_database();
    END IF;

    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = 'V6') THEN
        RAISE EXCEPTION 'Migration V6 has already been applied to campusexam_test.';
    END IF;
END $$;

BEGIN;

-- 1. Enhance question_bank_item with status column
ALTER TABLE question_bank_item
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'question_bank_item_status_check'
    ) THEN
        ALTER TABLE question_bank_item
            ADD CONSTRAINT question_bank_item_status_check CHECK (status IN ('Active', 'Archived', 'Superseded'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_question_bank_item_bank_mod_status
    ON question_bank_item (bank_id, module_number, status);

-- 2. Create paper_blueprint table
CREATE TABLE IF NOT EXISTS paper_blueprint (
    id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL UNIQUE REFERENCES subject(id) ON DELETE CASCADE,
    total_questions INTEGER NOT NULL CHECK (total_questions > 0),
    module_distribution JSONB NOT NULL,
    updated_by BIGINT REFERENCES account(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_paper_blueprint_subject_id
    ON paper_blueprint (subject_id);

-- 3. Seed baseline blueprint for Subject 1 (CS501, 5 modules, 30 questions: 6 per module)
INSERT INTO paper_blueprint (subject_id, total_questions, module_distribution, updated_by, created_at, updated_at)
VALUES (1, 30, '{"1": 6, "2": 6, "3": 6, "4": 6, "5": 6}'::jsonb, 2, clock_timestamp(), clock_timestamp())
ON CONFLICT (subject_id) DO UPDATE SET
    total_questions = EXCLUDED.total_questions,
    module_distribution = EXCLUDED.module_distribution,
    updated_by = EXCLUDED.updated_by,
    updated_at = clock_timestamp();

-- 4. Record audit log
INSERT INTO audit (happened, actor, action, entity, detail)
VALUES (clock_timestamp(), 2, 'SCHEMA_MIGRATION_V6', 'schema:paper_blueprint,question_bank_item', 'Applied migration V6: Paper Blueprint and Question Status Lifecycle.');

-- 5. Record migration in schema_migrations
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('V6', 'phase6_paper_blueprint', clock_timestamp());

COMMIT;
