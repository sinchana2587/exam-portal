-- Phase 10: COE Result Approval, Release and HOD/Principal Analytics
-- Maharaja Institute of Technology Mysore

ALTER TABLE student_session_result
    ADD COLUMN IF NOT EXISTS original_score NUMERIC(8,2),
    ADD COLUMN IF NOT EXISTS revised_score NUMERIC(8,2);

UPDATE student_session_result
SET original_score = score
WHERE original_score IS NULL;

-- Ensure indexes for fast analytics filtering
CREATE INDEX IF NOT EXISTS idx_lri_status_session ON lab_result_import(status, session_id);
CREATE INDEX IF NOT EXISTS idx_ssr_session_status ON student_session_result(session_id, submission_status, passed);
CREATE INDEX IF NOT EXISTS idx_exam_session_dept_status ON examination_session(department_id, status);
