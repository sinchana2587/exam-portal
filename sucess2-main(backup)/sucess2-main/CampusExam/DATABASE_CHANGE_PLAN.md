# Maharaja Institute of Technology Mysore (MIT Mysore)
## Examination Management System — Validated Database Change Plan

**Document Version:** 2.1.0 (Final Validation Corrections)  
**Date:** November 17, 2026  
**Auditor:** Senior Full-Stack Architect & Backend Integration Auditor  
**Target RDBMS:** PostgreSQL 14+  
**Execution Policy:** STRICTLY READ-ONLY PLANNING SPECIFICATION — NO MIGRATIONS EXECUTED

---

## 1. Schema Validation Against `schema.sql`

A line-by-line audit against the existing `schema.sql` validates that the existing database already possesses strong foundations:

### 1.1 Existing Structures Retained Without Redundancy
1. **`examination_session` Sittings:**
   - The table already includes `sitting text NOT NULL CHECK(sitting IN ('MORNING','AFTERNOON'))`.
   - The primary key `id` combined with `sitting` uniquely references each session sitting.
   - **Correction:** The previously proposed `sitting_id text` column is **redundant** and has been **eliminated**.
2. **`session_roster_snapshot`:**
   - Already provides immutable freezing of eligible candidates (`session_id`, `student_id`, `usn`, `full_name`, `date_of_birth`).
3. **`paper_version` and `paper_version_question`:**
   - Already support Stage B lettered versions (A, B, C, D) with shuffled positions, shuffled options, and marks.
4. **`secure_package`:**
   - Already stores AES-256-GCM payload, encrypted RSA key, IV, digest, and digital signature.
5. **`lab_result_import` & `student_session_result`:**
   - Already store summary statistics and per-student evaluations (score, correct, incorrect, unanswered, pass status).

---

## 2. Genuinely Missing Schema Extensions

The validated schema expansion requires:
- **9 Genuinely Missing New Tables**
- **3 Altered Existing Tables**
- **8 Performance & Uniqueness Indexes (7 B-Tree + 1 Partial Unique)**

### 2.1 Table Alterations (3 Tables — Surgical & Non-Destructive)

#### 2.1.1 `account` Table Extensions
Required for HOD directory management, employee IDs, Indian contact numbers, account deactivation, and theme preferences:
```sql
ALTER TABLE account ADD COLUMN IF NOT EXISTS contact_number text;
ALTER TABLE account ADD COLUMN IF NOT EXISTS employee_id text;
ALTER TABLE account ADD COLUMN IF NOT EXISTS designation text;
ALTER TABLE account ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE account ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE account ADD COLUMN IF NOT EXISTS theme_preference text DEFAULT 'system';

-- Constraint ensuring valid operational statuses
ALTER TABLE account DROP CONSTRAINT IF EXISTS chk_account_status;
ALTER TABLE account ADD CONSTRAINT chk_account_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'));
```

#### 2.1.2 `question_bank_item` Table Extensions
Required for attaching diagrams, circuit schematics, and mathematical assets to question stems and options:
```sql
ALTER TABLE question_bank_item ADD COLUMN IF NOT EXISTS has_images boolean NOT NULL DEFAULT false;
ALTER TABLE question_bank_item ADD COLUMN IF NOT EXISTS stem_images jsonb DEFAULT '[]'::jsonb;
ALTER TABLE question_bank_item ADD COLUMN IF NOT EXISTS option_images jsonb DEFAULT '[]'::jsonb;
```

#### 2.1.3 `examination_session` Table Extensions
Required for configurable passing marks, cancellation auditing, and package revision tracking:
```sql
-- Passing marks is configurable per examination.
-- To prevent silently applying 12.00 to examinations with differing maximum marks (e.g. 50 or 100 marks),
-- no static default is placed on the column.
-- The application dynamically calculates the institutional default (40% of total_marks: ROUND(total_marks * 0.40, 2))
-- when scheduling, while allowing the COE to explicitly specify a custom passing mark.
-- For existing rows, passing marks are backfilled using the 40% formula before enforcing NOT NULL.
ALTER TABLE examination_session ADD COLUMN IF NOT EXISTS total_marks numeric(8,2) NOT NULL DEFAULT 30.00;
ALTER TABLE examination_session ADD COLUMN IF NOT EXISTS passing_marks numeric(8,2);
UPDATE examination_session SET passing_marks = ROUND(total_marks * 0.40, 2) WHERE passing_marks IS NULL;
ALTER TABLE examination_session ALTER COLUMN passing_marks SET NOT NULL;
ALTER TABLE examination_session DROP CONSTRAINT IF EXISTS chk_passing_marks_range;
ALTER TABLE examination_session ADD CONSTRAINT chk_passing_marks_range CHECK (passing_marks > 0 AND passing_marks <= total_marks);

ALTER TABLE examination_session ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE examination_session ADD COLUMN IF NOT EXISTS is_cancelled boolean NOT NULL DEFAULT false;
ALTER TABLE examination_session ADD COLUMN IF NOT EXISTS package_revision int NOT NULL DEFAULT 1;

-- Expand status constraint to support formal cancellation and retirement
ALTER TABLE examination_session DROP CONSTRAINT IF EXISTS examination_session_status_check;
ALTER TABLE examination_session ADD CONSTRAINT examination_session_status_check CHECK (
    status IN ('SCHEDULED', 'FROZEN', 'PACKAGE_EXPORTED', 'RESULTS_IMPORTED', 'APPROVED', 'RELEASED', 'CANCELLED', 'RETIRED')
);
```

---

### 2.2 Genuinely Missing New Tables (9 Tables)

#### 2.2.1 Course Outcomes Management (4 Tables)
Required for HOD syllabus PDF uploads, document versioning, transcribed statements, and COE reviews:
```sql
-- 1. Course Outcome Submission Master
CREATE TABLE IF NOT EXISTS course_outcome_submission (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_id bigint NOT NULL REFERENCES subject(id) ON DELETE CASCADE,
    department_id bigint NOT NULL REFERENCES department(id),
    academic_session text NOT NULL,
    semester int NOT NULL CHECK (semester BETWEEN 1 AND 8),
    current_revision int NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'Under Review' CHECK (status IN ('Under Review', 'Reviewed', 'Clarification Requested')),
    created_by bigint NOT NULL REFERENCES account(id),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(subject_id, academic_session)
);

-- 2. Course Outcome Document Revisions (PDF metadata and storage path)
CREATE TABLE IF NOT EXISTS course_outcome_revision (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    submission_id bigint NOT NULL REFERENCES course_outcome_submission(id) ON DELETE CASCADE,
    revision_number int NOT NULL,
    original_file_name text NOT NULL,
    file_path text NOT NULL,
    file_size_bytes bigint NOT NULL,
    sha256_hash text NOT NULL,
    uploaded_by bigint NOT NULL REFERENCES account(id),
    uploaded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(submission_id, revision_number)
);

-- 3. Transcribed Course Outcome Statements (CO1 - CO6)
CREATE TABLE IF NOT EXISTS course_outcome_statement (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    submission_id bigint NOT NULL REFERENCES course_outcome_submission(id) ON DELETE CASCADE,
    code text NOT NULL, -- e.g. 'CO1', 'CO2'
    statement text NOT NULL,
    blooms_taxonomy_level text, -- e.g. 'L2 - Understand', 'L3 - Apply'
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(submission_id, code)
);

-- 4. COE Course Outcome Review History & Remarks
CREATE TABLE IF NOT EXISTS course_outcome_review (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    submission_id bigint NOT NULL REFERENCES course_outcome_submission(id) ON DELETE CASCADE,
    reviewer_id bigint NOT NULL REFERENCES account(id),
    status text NOT NULL CHECK (status IN ('Reviewed', 'Clarification Requested')),
    internal_review_notes text,
    clarification_notes text,
    reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
```

#### 2.2.2 Answer Key Dispute & Recalculation Table (1 Table)
Required for HOD answer-key disputes and automated score recalculations upon COE approval:
```sql
-- 5. Answer Key Dispute Requests & Recalculations
CREATE TABLE IF NOT EXISTS answer_key_correction (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id bigint NOT NULL REFERENCES examination_session(id) ON DELETE CASCADE,
    subject_id bigint NOT NULL REFERENCES subject(id),
    question_uid text NOT NULL,
    previous_correct_choice int NOT NULL CHECK (previous_correct_choice BETWEEN 1 AND 4),
    proposed_correct_choice int NOT NULL CHECK (proposed_correct_choice BETWEEN 1 AND 4),
    explanation text NOT NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    submitted_by bigint NOT NULL REFERENCES account(id),
    submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    reviewed_by bigint REFERENCES account(id),
    reviewed_at timestamptz,
    coe_decision_notes text
);
```

#### 2.2.3 Invigilator Session Unlock Credential Verifiers Table (1 Table)
Stores cryptographically salted `PBKDF2WithHmacSHA256` verifiers for session unlocks (Zero Plaintext Secrets):
```sql
-- 6. Session Unlock Credential Verifiers
CREATE TABLE IF NOT EXISTS session_unlock_credential (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id bigint NOT NULL REFERENCES examination_session(id) ON DELETE CASCADE,
    sitting_name text NOT NULL CHECK (sitting_name IN ('MORNING', 'AFTERNOON')),
    masked_preview text NOT NULL, -- e.g. 'MITM-••••-8F3K'
    verifier_hash text NOT NULL,  -- PBKDF2WithHmacSHA256 formatted: <salt_hex>:<hash_hex>
    salt text NOT NULL,           -- 32 cryptographically secure random bytes
    iterations int NOT NULL DEFAULT 600000, -- Standard PBKDF2 iterations
    revision int NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Revoked', 'Expired')),
    generated_by bigint NOT NULL REFERENCES account(id),
    generated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    expires_at timestamptz NOT NULL,
    last_synced_at timestamptz,
    UNIQUE(session_id, sitting_name, revision)
);

-- Partial Unique Index: Strictly enforces AT MOST ONE active unlock credential per sitting
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_unlock_credential
ON session_unlock_credential(session_id, sitting_name)
WHERE status = 'Active';
```

#### 2.2.4 Security Violation & Proctored Telemetry Log Table (1 Table)
Stores terminal infraction records:
```sql
-- 7. Security Violation & Lockdown Audit Log
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
```

#### 2.2.5 Emergency Re-Login & Workstation Migration Tables (2 Tables)
Supports proctor authorizations for candidates migrating from crashed workstations:
```sql
-- 8. Re-Login Authorization Tokens (Stores hash of one-time migration token)
CREATE TABLE IF NOT EXISTS relogin_authorization (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id bigint NOT NULL REFERENCES examination_session(id) ON DELETE CASCADE,
    student_usn text NOT NULL,
    assigned_workstation_id text NOT NULL,
    target_workstation_id text DEFAULT 'Any Available PC',
    token_id text NOT NULL UNIQUE,     -- Public tracking identifier (e.g. 'REL-AUTH-2026-4MH25CS149-8F21')
    token_hash text NOT NULL UNIQUE,   -- SHA-256 hash of the one-time migration bearer secret
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'USED', 'EXPIRED')),
    authorized_by bigint REFERENCES account(id),
    authorized_at timestamptz,
    expires_at timestamptz NOT NULL,
    is_one_time_used boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- 9. Workstation Migration & Session Transfer Audit History
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
```

##### 2.2.5.1 Lab Server Atomic Re-Login & Concurrency Safeguard
During candidate emergency migration on the Lab Server LAN:
1. The candidate enters the public `token_id` and raw migration secret `secret_token` on the replacement PC (`POST /api/student/emergency-relogin`).
2. The Lab Server computes `computed_hash = SHA256(secret_token)`.
3. The token is verified, checked for expiry, and consumed in a **single atomic conditional UPDATE** with row-level locking:
   ```sql
   UPDATE relogin_authorization
   SET is_one_time_used = TRUE,
       status = 'USED'
   WHERE token_id = :token_id
     AND token_hash = :computed_hash
     AND status = 'APPROVED'
     AND is_one_time_used = FALSE
     AND expires_at > clock_timestamp()
   RETURNING id, session_id, student_usn, assigned_workstation_id;
   ```
4. **Race-Condition & Double-Spend Prevention:** PostgreSQL row-level locks guarantee that only one concurrent worker can update the row. If the query returns 0 rows (because the token was already consumed, expired, or invalid), the Lab Server immediately rejects the request with HTTP 409 Conflict / 401 Unauthorized.
5. **Atomic Workstation Transfer Logging:** Within the **exact same database transaction**, the Lab Server records the workstation transfer:
   ```sql
   INSERT INTO session_transfer_history (
       session_id, student_usn, from_workstation, to_workstation, authorization_id, reason, transferred_by
   ) VALUES (
       :session_id, :student_usn, :assigned_workstation_id, :target_workstation, :auth_id, 'Crashed Workstation Recovery', :authorized_by
   );
   ```
6. The transaction commits and a new candidate session is issued for the target workstation.

---

## 3. Performance & Integrity Indexes (8 Indexes: 7 B-Tree + 1 Partial Unique)

```sql
-- 1. Partial Unique Index: Strictly enforces AT MOST ONE active unlock credential per sitting
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_unlock_credential
ON session_unlock_credential(session_id, sitting_name)
WHERE status = 'Active';

-- 2. Account Directory & Role Filtering
CREATE INDEX IF NOT EXISTS idx_account_dept_role ON account(department_id, role);

-- 3. Course Outcomes Submission Department/Semester Lookup
CREATE INDEX IF NOT EXISTS idx_co_submission_dept_sem ON course_outcome_submission(department_id, semester);

-- 4. Answer Key Dispute Resolution by Session
CREATE INDEX IF NOT EXISTS idx_key_corr_session ON answer_key_correction(session_id, status);

-- 5. Session Unlock Credential Lookup
CREATE INDEX IF NOT EXISTS idx_unlock_cred_session ON session_unlock_credential(session_id, status);

-- 6. Candidate Security Violation Log Lookup
CREATE INDEX IF NOT EXISTS idx_sec_violation_session_usn ON security_violation_log(session_id, student_usn);

-- 7. Emergency Re-Login Token Verification by Session and Candidate
CREATE INDEX IF NOT EXISTS idx_relogin_auth_session_usn ON relogin_authorization(session_id, student_usn, status);

-- 8. Candidate Workstation Transfer History Audit
CREATE INDEX IF NOT EXISTS idx_session_transfer_session_usn ON session_transfer_history(session_id, student_usn);
```

---

## 4. Migration Execution Specifications

### 4.1 Dedicated Versioned SQL Migration File Requirement
The Markdown database plan is an architectural blueprint and must **NOT** be executed directly. During Phase 1 implementation, an independent, versioned SQL migration file must be authored:
- **Target Forward Migration File:** `migrations/V1__expand_schema_for_portals.sql`
- **Target Rollback File:** `migrations/V1_rollback__revert_schema_expansion.sql`

### 4.2 Mandatory Migration Guardrails
1. **Single Transaction Boundary:**
   - Enclosed completely between `BEGIN;` and `COMMIT;`.
   - Any failure automatically triggers full rollback (`ROLLBACK;`).
2. **Strict Non-Destructive Invariance:**
   - **Never** drop existing tables or delete existing rows.
   - All alterations use `IF NOT EXISTS` or safe drop/re-add constraint blocks.
3. **Pre-Migration Integrity Check Query:**
   ```sql
   -- Verify that no unexpected statuses exist before updating the constraint
   SELECT count(*) FROM examination_session
   WHERE status NOT IN ('SCHEDULED', 'FROZEN', 'PACKAGE_EXPORTED', 'RESULTS_IMPORTED', 'APPROVED', 'RELEASED', 'CANCELLED', 'RETIRED');
   -- Must return 0 before proceeding
   ```
4. **Post-Migration Verification Query:**
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name IN (
       'course_outcome_submission', 'course_outcome_revision', 'course_outcome_statement', 'course_outcome_review',
       'answer_key_correction', 'session_unlock_credential', 'security_violation_log',
       'relogin_authorization', 'session_transfer_history'
   );
   -- Must return exactly 9 rows
   ```

### 4.3 Data Protection Safeguards for Rollback Script (`V1_rollback__revert_schema_expansion.sql`)
The rollback script must **NEVER** execute a naive, unconditional `DROP TABLE` or `DROP COLUMN`. It must be guarded by strict defensive checks:
1. **Data Existence Inspection:**
   - Before dropping any of the 9 new tables, the script executes `count(*)` checks. If any table contains records, the script aborts immediately:
     ```sql
     DO $$
     BEGIN
         IF (SELECT count(*) FROM course_outcome_submission) > 0 OR
            (SELECT count(*) FROM answer_key_correction) > 0 OR
            (SELECT count(*) FROM session_unlock_credential) > 0 OR
            (SELECT count(*) FROM security_violation_log) > 0 OR
            (SELECT count(*) FROM relogin_authorization) > 0 OR
            (SELECT count(*) FROM session_transfer_history) > 0 THEN
             RAISE EXCEPTION 'Rollback aborted: One or more portal tables contain active operational records. A separately reviewed data-export procedure must be completed prior to schema reduction.';
         END IF;
     END $$;
     ```
2. **Column Data Preservation:**
   - Verify that added columns in altered tables (`account.contact_number`, `account.employee_id`, `question_bank_item.stem_images`, etc.) do not contain active operator data prior to column removal.
3. **Explicit Operator Safeguard Flag:**
   - Destructive drop actions require an explicit session variable:
     ```sql
     -- Operator must explicitly issue this command in the transaction session to authorize rollback:
     -- SET LOCAL campus_exam.confirm_destructive_rollback = 'CONFIRMED';
     ```
     If the setting is missing or unconfirmed, the rollback transaction raises an exception and cleanly rolls back.
4. **Pre-Existing Table Invariance:**
   - Pre-existing tables (`account`, `department`, `subject`, `student`, `question_bank_item`, `examination_session`, `secure_package`, `lab_result_import`) and their initial operational records must **NEVER** be dropped, truncated, or reset during rollback.
5. **Mandatory Data Export Requirement:**
   - Any planned rollback involving populated tables must be preceded by a full pg_dump export (`backups/pre_rollback_export.sql`) reviewed and approved by the system administrator.

---

## 5. Final Validation Findings

1. **Reconciled Master Schema Counts:**
   - **9 New Master Tables:** `course_outcome_submission`, `course_outcome_revision`, `course_outcome_statement`, `course_outcome_review`, `answer_key_correction`, `session_unlock_credential`, `security_violation_log`, `relogin_authorization`, `session_transfer_history`.
   - **3 Altered Existing Tables:** `account`, `question_bank_item`, `examination_session`.
   - **8 Performance & Integrity Indexes:** 7 B-tree indexes + 1 partial unique index (`uq_active_unlock_credential`).
2. **Passing Marks Specification Resolved:**
   - Eliminated the static `DEFAULT 12.00` from the column definition to prevent incorrect passing marks on non-30-mark exams.
   - Dynamic 40% default (`ROUND(total_marks * 0.40, 2)`) is computed by the application, with full COE override capability.
   - Enforced database `NOT NULL` with range check constraint (`CHECK (passing_marks > 0 AND passing_marks <= total_marks)`).
   - Existing records are cleanly backfilled using the 40% formula.
3. **Protected Rollback Architecture:**
   - Rollback scripts are safeguarded against data loss via row-count inspection, column population checks, explicit operator confirmation flags, and documented data-export prerequisites.
4. **Atomic Re-Login & Concurrency Locking:**
   - Lab Server emergency re-login implements a single conditional `UPDATE ... RETURNING` with row-level locking, preventing token double-spend across concurrent requests.
   - Workstation transfer history logging is bound to the exact same database transaction.
5. **Credential & Token Security Standards:**
   - `session_unlock_credential` uses standard **PBKDF2WithHmacSHA256** (600,000 iterations, 32-byte salt, 256-bit key).
   - `relogin_authorization` separates public tracking `token_id` from secret `token_hash` (SHA-256).
   - Invigilator unlock on candidate screen never elevates the candidate's `STUDENT` Bearer token.
6. **Zero Open Blockers / Unresolved Architectural Decisions:**
   - All schema objects, data types, security parameters, and operational boundaries are fully finalized. No unresolved architectural decisions remain.

---
*End of Validated Database Change Plan. Strict Read-Only Boundaries Preserved.*
