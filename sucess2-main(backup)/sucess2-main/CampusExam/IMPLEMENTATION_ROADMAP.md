# Maharaja Institute of Technology Mysore (MIT Mysore)
## Examination Management System — Validated Phased Implementation Roadmap

**Document Version:** 2.1.0 (Final Validation Corrections)  
**Date:** November 17, 2026  
**Auditor:** Senior Full-Stack Architect & Backend Integration Auditor  
**Execution Policy:** STRICTLY READ-ONLY PLANNING BLUEPRINT — NO CODE MODIFIED YET

---

## 1. Execution Principles

1. **Strict Three-Tier Isolation:**
   - Central Java Backend (`CampusExam.java` :8080)
   - Isolated Lab Examination Server (`Lab Server` :8443 on Lab LAN)
   - Admin Express Sidecar (`server.ts` :3000 for OCR)
2. **100% Backward Compatibility:**
   - Existing unversioned endpoints (`/api/*`) and response formats are preserved unaltered to ensure all existing Python test suites (`mit_workflow_test.py`, `smoke_test.py`, `testsprite_tests`) pass continuously.
3. **Explicit Route Adapters:**
   - Versioned routes (`/api/v1/*`) use dedicated route adapters with structured envelopes.

---

## 2. Nine-Phase Implementation Roadmap

### Phase 1: Database Migration & Schema Expansion
- **Goal:** Safely apply PostgreSQL schema extensions (9 new master tables, 3 altered existing tables, and 8 indexes: 7 B-Tree + 1 Partial Unique) without modifying existing records.
- **Prerequisites:** Full database backup (`backups/db_backup_pre_migration.sql`) and execution of pre-migration integrity query.
- **Tasks:**
   1. Create full database snapshot (`pg_dump`).
   2. Execute pre-migration validation query ensuring all existing session statuses are valid (`SCHEDULED`, `FROZEN`, `PACKAGE_EXPORTED`, `RESULTS_IMPORTED`, `APPROVED`, `RELEASED`, `CANCELLED`, `RETIRED`).
   3. Author and execute versioned transactional SQL migration script:
      - `migrations/V1__expand_schema_for_portals.sql` (enclosed in a single `BEGIN ... COMMIT` block with `IF NOT EXISTS` idempotency).
      - Maintain companion rollback script `migrations/V1_rollback__revert_schema_expansion.sql`.
   4. **Rollback Data Loss Protection Safeguards:**
      - The rollback script must never unconditionally drop tables or columns.
      - **Row-Count Inspection:** Before dropping any new table, verify `count(*) = 0`. If operational data exists, abort rollback with `RAISE EXCEPTION`.
      - **Column Population Inspection:** Verify added columns in `account` and `question_bank_item` contain no active operator data before removal.
      - **Operator Safeguard Flag:** Require explicit session authorization (`SET LOCAL campus_exam.confirm_destructive_rollback = 'CONFIRMED'`) before allowing schema reduction.
      - **Pre-Existing Data Invariance:** Pre-existing rows in `account`, `question_bank_item`, and `examination_session` must never be dropped, truncated, or reset.
      - **Separately Reviewed Data Export:** Mandatory pg_dump/export procedure required prior to any schema reversal involving populated data.
   5. Verify the 9 new tables, 3 altered tables, foreign keys, and 8 indexes via `information_schema`.
- **Verification:** Run `SELECT * FROM course_outcome_submission LIMIT 1;` and ensure existing `account`, `question_bank_item`, and `examination_session` rows remain intact.

---

### Phase 2: Central Backend Router & Explicit Versioned Adapters
- **Goal:** Upgrade `CampusExam.java` to support `PUT`, `PATCH`, `DELETE`, and explicit `/api/v1/*` route adapters while leaving existing `/api/*` routes untouched.
- **Prerequisites:** Phase 1 complete.
- **Tasks:**
   1. Add HTTP method dispatch for `PUT`, `PATCH`, `DELETE` in `handle()`.
   2. Implement explicit route table mapping `/api/v1/*` routes to versioned handlers.
   3. Implement standardized `ApiResponse<T>` envelope builder (`success`, `data`, `message`, `timestamp`).
   4. Implement structured error handler returning `{ code, message, errors }`.
- **Verification:**
   - Existing `mit_workflow_test.py` and `smoke_test.py` pass with 100% success against `/api/*`.
   - `/api/v1/health` returns valid modern JSON envelope.

---

### Phase 3: Central Authentication & Profile Adapters
- **Goal:** Wire modern authentication, password change, and profile updates across institutional roles (`PRINCIPAL`, `HOD`, `COE`).
- **Prerequisites:** Phase 2 complete.
- **Tasks:**
   1. Add versioned adapter `POST /api/v1/auth/login` (and `/auth/coe/login`) returning `AuthResponse` DTO with user profile.
   2. Wire `POST /api/v1/auth/logout`.
   3. Implement `PATCH /api/v1/auth/profile` to update contact number.
   4. Implement `POST /api/v1/auth/change-password` verifying existing PBKDF2 hash.
- **Verification:** Principal, HOD, and COE can log in, view profiles, update contact numbers, and change passwords in their portals.

---

### Phase 4: Portal 1 (Admin) Integration & Express Sidecar Preservation
- **Goal:** Integrate Principal and HOD workspaces while preserving the Express sidecar (`server.ts` :3000) for OCR.
- **Prerequisites:** Phase 3 complete.
- **Tasks:**
   1. **Preserve Express Sidecar:** Confirm `server.ts` runs on port 3000, handling student and question OCR sessions (`/hod/*/conversions`).
   2. **Principal Workflows:** Wire `/api/v1/principal/dashboard`, `/principal/hods` (table & create), `/principal/departments/{id}/replace-hod`, and filtered `/principal/reports/results`.
   3. **HOD Workflows:** Wire `/api/v1/hod/dashboard`, `/hod/academic-context` (section management), roster publishing (`/hod/student-lists/upload`), and 300-question bank finalization (`/hod/finalize-bank` generating Stage A Papers 1–4).
   4. **Course Outcomes & Key Corrections:** Wire PDF upload to `course_outcome_*` tables and key dispute submission to `answer_key_correction`.
- **Verification:** HOD can upload 300 MCQs, finalize bank, and generate 4 non-overlapping papers; Principal can manage HODs and view analytical reports.

---

### Phase 5: Portal 2 (COE) Central Integration
- **Goal:** Wire COE examination scheduling, Stage B version generation, encrypted package signing, and result releases.
- **Prerequisites:** Phase 3 complete.
- **Tasks:**
   1. Wire `/institution/semesters` (1–8) and candidate eligibility counter (`/institution/eligibility`).
   2. Wire dual-sitting scheduling (`POST /examinations/schedule`) with room collision guard and dynamic passing marks:
      - Calculate the default passing marks dynamically from the examination's total marks (institutional guideline of 40%: `ROUND(total_marks * 0.40, 2)`).
      - Allow COE to override the calculated value in the scheduling payload.
      - Validate that `0 < passing_marks <= total_marks`.
      - Database column is `NOT NULL` with check constraint, avoiding silently applying a static 12.00 default to examinations with different maximum marks.
   3. Wire Stage A paper selection and Stage B version generation (`POST /examinations/{id}/select-set`).
   4. Wire session freezing (`POST /examinations/{id}/confirm-schedule`).
   5. Wire AES-256-GCM + RSA encrypted package signing (`POST /examinations/{id}/prepare-and-send-package`).
   6. Implement Invigilator Session Unlock Credential generation using standardized **PBKDF2WithHmacSHA256** (600,000 iterations, 32-byte salt, 256-bit key) with partial unique index `uq_active_unlock_credential` enforcing at most one active credential per sitting.
   7. Wire result verification, import, answer-key dispute resolution (with score recalculation), and result release (retiring selected paper set).
   8. Wire Course Outcomes review and archival PDF generation.
- **Verification:** COE can schedule an exam, generate Versions A–D, export package, verify results, resolve key disputes, and retire paper set.

---

### Phase 6: Lab Server Runtime & Portal 3 (Student) Offline Integration
- **Goal:** Integrate candidate CBT execution, offline autosave, security lockdown, and emergency recovery on the isolated Lab Server LAN.
- **Prerequisites:** Phase 5 complete (encrypted package exported).
- **Tasks:**
   1. **Lab Runtime Initialization:** Decrypt package in secure memory; load versions A–D, answer keys, and roster.
   2. **Candidate Lifecycle:** Wire candidate login (`POST /api/student/login`), paper delivery **WITHOUT answer keys** (`GET /api/student/exam/questions`), response autosave (`POST /api/student/exam/answers`), and submission (`POST /api/student/exam/submit`).
   3. **Security Lockdown & Invigilator Unlock:** Wire violation reporting (`POST /api/security/violation`) and on-screen unlock (`POST /api/security/unlock`) verifying against session PBKDF2 hash **without elevating the candidate's `STUDENT` Bearer token**.
   4. **In-Console Emergency Recovery & Atomic Re-Login:**
      - Wire instructor authentication (`POST /api/instructor/login`) and re-login authorization for crashed PCs using public `token_id` and secret `secret_token` (`token_hash` stored as SHA-256).
      - Lab Server implementation verifies `SHA256(secret_token)` against `token_hash`, verifies status and expiration, and consumes the token in a **single atomic conditional UPDATE** with row-level locking (`UPDATE relogin_authorization SET is_one_time_used = TRUE, status = 'USED' WHERE token_id = :id AND token_hash = :hash AND status = 'APPROVED' AND is_one_time_used = FALSE AND expires_at > clock_timestamp() RETURNING ...`).
      - Concurrency safeguard: Guarantees concurrent requests cannot both consume the same authorization (second attempt returns 0 rows and is rejected with HTTP 409 Conflict).
      - Workstation transfer history logging (`session_transfer_history`) is executed within the **exact same database transaction**.
   5. **Live Monitoring Telemetry:** Serve live candidate and PC matrix telemetry (`GET /monitoring/sessions`) to COE portal.
- **Verification:** Student can take CBT exam, experience lockdown, unlock via invigilator password, submit, and receive digital receipt; COE can view live PC telemetry.

---

### Phase 7: Cross-Tier End-to-End Workflow Verification
- **Goal:** Validate complete data continuity across all three operational tiers in a live institutional sequence, with explicit service ownership:
- **Tasks & Service Ownership:**
   1. **Central Java Backend (:8080):** Principal creates Department & HOD account (`POST /api/v1/principal/hods`).
   2. **Express OCR Sidecar (:3000) & Central Backend (:8080):** HOD uploads student roster & 300 MCQs, finalizes bank (Stage A Papers 1–4 generated).
   3. **Central Java Backend (:8080):** HOD uploads Course Outcomes PDF (`POST /api/v1/hod/course-outcomes/upload`).
   4. **Central Java Backend (:8080):** COE reviews CO, schedules dual sittings, selects Paper Set 2 (Versions A–D generated), freezes roster, and generates unlock credentials.
   5. **Central Java Backend (:8080):** COE transfers AES-256-GCM + RSA package to Lab Server via air-gapped USB or isolated LAN transfer.
   6. **Lab Server (:8443 on Lab LAN):** Lab Server decrypts package into secure memory.
   7. **Lab Server (:8443 on Lab LAN):** Student takes exam on PC-01, autosaves answers, gets locked down on tab switch, unlocks via invigilator (PBKDF2 verified without token elevation), migrates to PC-02 via one-time re-login token if PC-01 crashes, submits, and gets digital confirmation code.
   8. **Lab Server (:8443 on Lab LAN):** Lab Server scores attempts locally against in-memory answer keys, signs `.labresult`, and exports.
   9. **Central Java Backend (:8080):** COE imports results; HOD submits key dispute on Question 4; COE approves; system recalculates marks.
   10. **Central Java Backend (:8080):** COE releases results; Paper Set 2 is retired.
   11. **Central Java Backend (:8080):** HOD and Principal review released results and analytics.
- **Verification:** Full 11-step lifecycle succeeds with zero cross-tier data discrepancies.

---

### Phase 8: Automated Regression & TestSprite Testing
- **Goal:** Validate that all existing and new capabilities pass automated tests.
- **Tasks:**
   1. Execute `mit_workflow_test.py` -> Must pass 100%.
   2. Execute `smoke_test.py` -> Must pass 100%.
   3. Run TestSprite test suite via MCP integration covering new endpoints.
   4. Document test metrics in `TEST_REPORT.md`.
- **Verification:** 100% test pass rate across all suites.

---

### Phase 9: Final Institutional Security Audit & Go-Live Verification
- **Goal:** Comprehensive security audit prior to campus lab deployment.
- **Tasks:**
   1. Verify zero answer keys exposed in any student payload.
   2. Verify zero plaintext secrets in PostgreSQL or memory dumps.
   3. Verify digital signature enforcement on packages and results.
   4. Verify department scope isolation for all HOD endpoints.
   5. Verify audit logs record all administrative, security, and recovery events.
- **Verification:** Security sign-off confirming production readiness for MIT Mysore.

---

## 3. Final Validation Findings

1. **Master Schema Counts Reconciled:**
   - **9 New Master Tables:** `course_outcome_submission`, `course_outcome_revision`, `course_outcome_statement`, `course_outcome_review`, `answer_key_correction`, `session_unlock_credential`, `security_violation_log`, `relogin_authorization`, `session_transfer_history`.
   - **3 Altered Existing Tables:** `account`, `question_bank_item`, `examination_session`.
   - **8 Performance & Integrity Indexes:** 7 performance B-trees + 1 partial unique index (`uq_active_unlock_credential`).
2. **Passing Marks Specification Resolved:**
   - Dynamic 40% default calculated by application from `total_marks` (`ROUND(total_marks * 0.40, 2)`), preventing incorrect static defaults on non-30-mark exams.
   - COE override capability supported.
   - Strict range check `0 < passing_marks <= total_marks` with `NOT NULL` enforcement in PostgreSQL.
3. **Protected Rollback Architecture:**
   - Rollback scripts (`migrations/V1_rollback__revert_schema_expansion.sql`) protected against data loss: inspects table record counts, inspects column data, requires explicit operator confirmation flag (`SET LOCAL campus_exam.confirm_destructive_rollback = 'CONFIRMED'`), preserves pre-existing records, and requires prior data export/backup.
4. **Atomic Re-Login & Concurrency Locking:**
   - Lab Server implements atomic conditional `UPDATE ... RETURNING` with row-level locks, preventing token double-spend.
   - Workstation transfer history logging is transaction-bound.
5. **Session Unlock & Lockdown Security:**
   - Standard **PBKDF2WithHmacSHA256** (600,000 iterations, 32-byte salt, 256-bit key) for session unlocks.
   - At most ONE active credential per sitting via partial unique index `uq_active_unlock_credential`.
   - Invigilator unlock on student screen never elevates the candidate's `STUDENT` Bearer token.
6. **Zero Open Blockers / Unresolved Architectural Decisions:**
   - All schema objects, routes, lifecycle phases, and security models are fully reconciled and verified. Zero unresolved decisions remain.
7. **Zero Code/Database Changes:**
   - Confirmed that this entire validation phase has executed in strict read-only mode, with zero code or database modifications.

---
*End of Validated Implementation Roadmap.*
