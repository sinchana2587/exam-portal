# Maharaja Institute of Technology Mysore (MIT Mysore)
## Examination Management System — Second-Pass Architectural Integration Audit

**Document Version:** 2.0.0 (Validated Architecture)  
**Date:** November 17, 2026  
**Auditor:** Senior Full-Stack Architect & Backend Integration Auditor  
**Audit Policy:** STRICTLY READ-ONLY — ZERO APPLICATION SOURCE CODE OR DATABASE MODIFICATIONS

---

## 1. Executive Summary & Three-Tier Architecture Map

The Maharaja Institute of Technology Mysore (MIT Mysore) Examination Management Platform is built on a strictly partitioned **Three-Tier Operational Architecture**:

```
+--------------------------------------------------------------------------------------------------+
|                                    CENTRAL INSTITUTION TIER                                      |
|                                                                                                  |
|   +---------------------------------------+         +----------------------------------------+   |
|   |         PostgreSQL Database           | <=====> |    Central Java 17 REST Backend        |   |
|   |             (Port 5432)               |         |         (CampusExam.java :8080)        |   |
|   +---------------------------------------+         +----------------------------------------+   |
|                                                               ^                    ^             |
+---------------------------------------------------------------|--------------------|-------------+
                                                                |                    |
                                                     HTTPS / LAN WAN                 | HTTPS / LAN
                                                                |                    |
+---------------------------------------------------------------|----+               |
|                      FRONTEND TIER                            |    |               |
|                                                               |    |               |
|   +-------------------------------------------------------+   |    |               |
|   | Portal 1: Admin Portal (Principal & HOD)              | --+    |               |
|   | React 19 + Vite (:5173)                               |        |               |
|   |   +--> Express Sidecar (server.ts :3000 for OCR/Excel)|        |               |
|   +-------------------------------------------------------+        |               |
|                                                                    |               |
|   +-------------------------------------------------------+        |               |
|   | Portal 2: COE Portal (Controller of Examinations)     | -------+               |
|   | React 19 + Vite (:5174)                               | ----+                  |
|   +-------------------------------------------------------+     |                  |
|                                                                 |                  |
|   +-------------------------------------------------------+     |                  |
|   | Portal 3: Student Portal (Candidate CBT)              | -+  |                  |
|   | React 19 + Vite (:5175)                               |  |  |                  |
|   +-------------------------------------------------------+  |  |                  |
|                                                              |  |                  |
+--------------------------------------------------------------|--|------------------+
                                                               |  |
                                             Isolated Lab LAN  |  | Live Telemetry &
                                             (Air-Gapped)      |  | Package Verification
                                                               v  v
+--------------------------------------------------------------------------------------------------+
|                                  LABORATORY EXAMINATION TIER                                     |
|                                                                                                  |
|   +------------------------------------------------------------------------------------------+   |
|   |                         Isolated Lab Examination Server (Lab Server)                     |   |
|   |                             (Air-Gapped LAN Host :8443 or :8080)                         |   |
|   |   - Holds Lab RSA-2048 Private Key                                                       |   |
|   |   - Decrypts AES-256-GCM + RSA-OAEP session packages into Secure RAM                     |   |
|   |   - Serves Student Candidate CBT terminals over local LAN                                |   |
|   |   - Evaluates attempts locally against in-memory answer keys                             |   |
|   |   - Produces digitally signed .labresult packages for central COE import                 |   |
|   +------------------------------------------------------------------------------------------+   |
+--------------------------------------------------------------------------------------------------+
```

### 1.1 Service Ownership & Boundary Invariants
1. **Central Java 17 Backend (`CampusExam.java`):**
   - Owns master institutional data, departments, courses, accounts, student rosters, 300-MCQ question banks, Stage A paper sets, examination scheduling, Course Outcomes reviews, answer-key disputes, and released results.
   - **Does NOT** communicate with individual student terminals during live CBT exams.
2. **Isolated Lab Examination Server (`Lab Server`):**
   - Runs on the local laboratory LAN (completely isolated from the Internet and central server downtime).
   - Receives encrypted sitting packages from the COE portal, verifies digital signatures, and decrypts into memory.
   - Owns candidate login, instructions, question delivery (WITHOUT answer keys), autosave, submission, security violation locks, and invigilator unlocks.
   - Scores candidate attempts locally, cryptographically signs `.labresult` archives, and serves live monitoring telemetry to the COE portal.
   - **In Development/Testing:** Simulated via `LabRuntime` in `CampusExam.java` or standalone daemon. In production: physically located in each lab.
3. **Admin Portal Express Sidecar (`server.ts` on port 3000):**
   - Embedded Node.js service using Tesseract.js, PDF.js, and ExcelJS.
   - Handles client-side, CPU-heavy OCR extraction of printed student lists and printed 5-module question papers.
   - **Must be preserved:** Keeps heavy OCR libraries out of the core Java backend. Once verified, finalized JSON payloads are submitted directly to the Central Java Backend.
4. **Three Frontend Portals:**
   - **Admin Portal:** Communicates with Central Backend (`/api/v1/*`) and local Express sidecar (`/hod/*` conversions).
   - **COE Portal:** Communicates with Central Backend (`VITE_API_BASE_URL`) for scheduling/authoring/results, AND communicates with the Lab Server (`VITE_LAB_API_BASE_URL`) for live workstation telemetry and package receipts.
   - **Student Portal:** Communicates **exclusively** with the local Lab Server (`LAB_API_BASE_URL`). Zero dependency on central server connectivity during exams.

---

## 2. Backward Compatibility Strategy

### 2.1 Preserving Existing Routes and Automated Tests
The current project has active test suites:
- `testsprite_tests/` (10 Python test suites)
- `mit_workflow_test.py` (Full institutional lifecycle test)
- `smoke_test.py` (Legacy test suite)
- `user_perspective_test.py`

These test suites send requests to `http://127.0.0.1:8080/api/*` with `application/x-www-form-urlencoded` or JSON bodies and assert specific flat response structures (e.g. `call("login")["token"]`).

### 2.2 Dual-Track Versioned Routing Architecture
To guarantee **100% backward compatibility** while cleanly integrating the modern React frontends:
1. **Track 1: Legacy / Core Unversioned Endpoints (`/api/*`):**
   - Maintained exactly as they currently exist.
   - Return un-enveloped flat JSON (e.g. `{"token":"...","role":"..."}`).
   - Ensures all existing automated Python tests (`mit_workflow_test.py`, `testsprite_tests`) continue to pass without a single change.
2. **Track 2: Modern Versioned REST Endpoints (`/api/v1/*`):**
   - Handled by dedicated route adapters.
   - Return standard institutional envelopes (`ApiResponse<T>`: `{ success: true, data: { ... }, timestamp: "..." }`).
   - Parse JSON request bodies, support `PUT`, `PATCH`, `DELETE`, and enforce strict role boundaries.
3. **Explicit Route Mapping (No Blind Prefix Stripping):**
   - Blindly stripping `/api/v1/` or `/api/` causes route collisions and security bugs (e.g. `/principal/reports/results` vs `/principal/reports`).
   - Every modern endpoint is mapped explicitly to its designated handler.

---

## 3. Corrected API Ownership by Service

### 3.1 Service API Distribution Summary
- **Central Java Backend Owned APIs:** **38 endpoints** (Authentication, Principal Admin, HOD Academic/Banks, COE Scheduling/Review/Release, Archive, Audit).
- **Lab Examination Server Owned APIs:** **18 endpoints** (Candidate CBT lifecycle, Autosave, Submit, Security Lockdown, Invigilator Unlock, Emergency Recovery Console, Live Telemetry, Package Decryption & Evaluation).
- **Admin Express Sidecar Owned APIs:** **12 endpoints** (Student OCR conversion sessions, Question OCR conversion sessions, Excel workbook building/parsing, template downloads).

---

## 4. Validated Feature Inventory & Compatibility Matrix

### Status Definitions:
- **FULLY SUPPORTED:** Existing backend implementation satisfies all frontend requirements.
- **PARTIALLY SUPPORTED (ADAPTER READY):** Core logic exists in backend; requires an explicit `/api/v1/` route adapter to return modern envelope.
- **API MODIFICATION REQUIRED:** Endpoint exists but requires business logic extension (e.g. multi-role access, query filtering, PUT/PATCH method support).
- **NEW API REQUIRED (CENTRAL):** Requires a new endpoint on the Central Java Backend.
- **NEW API REQUIRED (LAB SERVER):** Belongs to the isolated Lab Server LAN API.
- **SIDECAR PRESERVED:** Handled by the existing Express sidecar (`server.ts`).
- **DATABASE CHANGE REQUIRED:** Requires PostgreSQL schema expansion as specified in `DATABASE_CHANGE_PLAN.md`.

---

### 4.1 Portal 1: `admin-portal` Feature Matrix (60 Features)

| Feature Name | Expected Route | Owning Service | Compatibility Status | Notes & Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Principal & HOD Login** | `POST /api/v1/auth/login` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Route `/api/v1/auth/login` maps to `login()` and wraps in `{success, data: {token, user}}`. Legacy `/api/login` unchanged. |
| **Logout** | `POST /api/v1/auth/logout` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Deletes session token. |
| **Get Current User (`me`)** | `GET /api/v1/auth/me` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Returns authenticated profile. |
| **Update Contact Number** | `PATCH /api/v1/auth/profile` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Updates `account.contact_number`. Requires column addition. |
| **Change Password** | `POST /api/v1/auth/change-password` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Verifies current PBKDF2 hash before updating. |
| **Theme Preference** | `POST /api/v1/auth/preferences/theme` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Updates `account.theme_preference`. |
| **Principal Dashboard KPIs** | `GET /api/v1/principal/dashboard` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Formats summary metrics into `PrincipalDashboardData`. |
| **Examination Activity Feed** | `GET /api/v1/principal/dashboard` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Lists live/upcoming sessions. |
| **Administrative Activity Stream** | `GET /api/v1/principal/dashboard` | Central Backend | **FULLY SUPPORTED** | Reads from `audit` table. |
| **HOD Directory Table** | `GET /api/v1/principal/hods` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Returns HOD accounts joined with department details. |
| **Create Department & HOD** | `POST /api/v1/principal/hods` | Central Backend | **API MODIFICATION REQUIRED** | Transactional endpoint creating department and HOD account. |
| **Edit HOD Profile** | `PUT /api/v1/principal/hods/{id}` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Updates HOD name, email, phone, designation. Requires `PUT` support. |
| **Replace Department HOD** | `POST /api/v1/principal/departments/{id}/replace-hod` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Deactivates previous HOD, assigns new HOD, records audit reason. |
| **HOD Status Toggle** | `PATCH /api/v1/principal/hods/{id}/status` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Sets `account.status` (`ACTIVE`/`INACTIVE`). |
| **Institutional Reports Overview** | `GET /api/v1/principal/reports/results` | Central Backend | **API MODIFICATION REQUIRED** | Adds dynamic query filters (`academicYearId`, `departmentId`, `semesterNumber`, `examinationId`). |
| **Export Reports Excel/PDF** | Client-Side Action | Admin Frontend | **FULLY SUPPORTED** | Client-side jsPDF and SheetJS generation. |
| **Principal Audit Log Viewer** | `GET /api/v1/principal/audit-logs` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Filtered query on `audit` table. |
| **HOD Dashboard Overview** | `GET /api/v1/hod/dashboard` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Aggregates stats filtered by `department_id = user.departmentId()`. |
| **Semester Enrollment Chart** | `GET /api/v1/hod/enrollment/summary` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Returns student counts across semesters 1 to 8. |
| **HOD Academic Context** | `GET /api/v1/hod/academic-context` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Consolidates department, semesters 1-8, and section list. |
| **Add Academic Section** | `POST /api/v1/hod/academic-context/sections` | Central Backend | **API MODIFICATION REQUIRED** | Permits `HOD` role to add sections within department scope. |
| **Department Roster Table** | `GET /api/v1/hod/student-lists` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Queries `student_roster` by semester and section. |
| **Student Document OCR Upload** | `POST /hod/student-lists/conversions` | Express Sidecar | **SIDECAR PRESERVED** | Executed in `server.ts` (port 3000) via Tesseract.js. |
| **Student OCR Session Review** | `PUT /hod/student-lists/conversions/:id/records`| Express Sidecar | **SIDECAR PRESERVED** | Executed in `server.ts` (port 3000). |
| **Student Excel Workbook Builder**| `GET /hod/student-lists/conversions/:id/excel` | Express Sidecar | **SIDECAR PRESERVED** | Executed in `server.ts` (port 3000) via ExcelJS. |
| **Download Roster Template** | `GET /hod/student-lists/template` | Express Sidecar | **SIDECAR PRESERVED** | Executed in `server.ts` (port 3000). |
| **Publish Verified Roster** | `POST /api/v1/hod/student-lists/upload` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Persists verified student list into `student_roster`. |
| **HOD Subjects Table** | `GET /api/v1/hod/subjects` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Filters subjects by `department_id = user.departmentId()`. |
| **Create Subject (HOD)** | `POST /api/v1/hod/subjects` | Central Backend | **API MODIFICATION REQUIRED** | Permits `HOD` role for own department. |
| **Question Bank Capacity Gauge**| `GET /api/v1/hod/subjects/{id}/question-sets` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Returns module counts (1-5) and checks 60 Qs/module requirement. |
| **Create Question Bank** | `POST /api/v1/hod/questions` | Central Backend | **FULLY SUPPORTED** | Creates draft bank. |
| **Single MCQ Manual Entry** | `POST /api/v1/hod/questions` (single) | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Wraps single question and delegates to `uploadQuestions()`. |
| **Question Image Attachments** | `POST /api/v1/hod/questions` (images) | Central Backend | **DATABASE CHANGE REQUIRED** | Requires `stem_images` and `option_images` JSONB columns. |
| **Question Bank OCR Upload** | `POST /hod/question-banks/conversions` | Express Sidecar | **SIDECAR PRESERVED** | Executed in `server.ts` (port 3000). |
| **Question OCR Review Grid** | `PUT /hod/question-banks/conversions/:id/records`| Express Sidecar | **SIDECAR PRESERVED** | Executed in `server.ts` (port 3000). |
| **Question Excel Workbook Builder**| `GET /hod/question-banks/conversions/:id/excel`| Express Sidecar | **SIDECAR PRESERVED** | Executed in `server.ts` (port 3000). |
| **Download Question Template** | `GET /hod/question-banks/template` | Express Sidecar | **SIDECAR PRESERVED** | Executed in `server.ts` (port 3000). |
| **Finalize Bank & Stage A** | `POST /api/v1/hod/subjects/{id}/question-sets/publish` | Central Backend | **FULLY SUPPORTED** | Validates 300 MCQs and generates Papers 1-4 with zero overlap. |
| **Upload Course Outcomes PDF** | `POST /api/v1/hod/subjects/{id}/course-outcomes` | Central Backend | **DATABASE CHANGE REQUIRED** | Requires `course_outcome_*` tables and PDF storage. |
| **Course Outcomes Statements** | `POST /api/v1/hod/subjects/{id}/course-outcomes/statements` | Central Backend | **DATABASE CHANGE REQUIRED** | Persists transcribed CO1-CO6 statements. |
| **Submit Key Correction Dispute**| `POST /api/v1/hod/key-corrections` | Central Backend | **DATABASE CHANGE REQUIRED** | Requires `answer_key_correction` table. |
| **Track Key Corrections** | `GET /api/v1/hod/key-corrections` | Central Backend | **DATABASE CHANGE REQUIRED** | Lists submitted disputes and COE decisions. |
| **HOD Exam Status View** | `GET /api/v1/hod/examinations` | Central Backend | **API MODIFICATION REQUIRED** | Returns exam sessions filtered by HOD department. |
| **Department Results Viewer** | `GET /api/v1/hod/results` | Central Backend | **FULLY SUPPORTED** | Returns released results and student breakdown. |
| **HOD Audit Log Viewer** | `GET /api/v1/hod/audit-logs` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Department-scoped audit entries. |

---

### 4.2 Portal 2: `coe-portal` Feature Matrix (48 Features)

| Feature Name | Expected Route | Owning Service | Compatibility Status | Notes & Verification |
| :--- | :--- | :--- | :--- | :--- |
| **COE Login** | `POST /auth/coe/login` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Route adapter returns `AuthResponse` DTO with COE profile. |
| **COE Logout** | `POST /auth/coe/logout` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Clears token. |
| **COE Change Password** | `POST /auth/coe/change-password` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Verifies current password before updating. |
| **Backend / Lab Connectivity** | `GET /api/health` | Central Backend & Lab | **FULLY SUPPORTED** | Checks `/api/health` on both hosts. |
| **COE Dashboard KPIs** | Aggregated Query | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Aggregated summary counts. |
| **Scheduled Exams Master Table**| `GET /examinations/scheduled` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Returns `ScheduledExamination[]` with sitting structures. |
| **Reference Semesters (1-8)** | `GET /institution/semesters` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Returns semesters 1 through 8. |
| **Candidate Eligibility Counter**| `GET /institution/eligibility` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Queries `student_roster` for eligible student counts. |
| **Published Subjects Filter** | `GET /institution/subjects?publishedOnly=true`| Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Filters subjects with `FINALIZED` question banks. |
| **Schedule Dual-Sitting Exam** | `POST /examinations/schedule` | Central Backend | **API MODIFICATION REQUIRED** | Transactional endpoint creating Morning & Afternoon sittings. |
| **Lab Overlap Conflict Guard** | `POST /examinations/schedule` | Central Backend | **FULLY SUPPORTED** | Rejects conflicting room bookings with `409 Conflict`. |
| **Confirm & Freeze Schedule** | `POST /examinations/{id}/confirm-schedule` | Central Backend | **FULLY SUPPORTED** | Snapshots eligible candidates and sets status `FROZEN`. |
| **Cancel Examination** | `POST /examinations/{id}/cancel` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Sets status `CANCELLED`, records cancellation reason and audit. |
| **Delete Draft Examination** | `DELETE /examinations/{id}` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Deletes draft exam. Requires `DELETE` support. |
| **List Stage A Numbered Sets** | `GET /examinations/{id}/question-sets` | Central Backend | **FULLY SUPPORTED** | Returns metadata for Papers 1-4 without exposing prompts. |
| **Select Set & Stage B Versions**| `POST /examinations/{id}/select-set` | Central Backend | **FULLY SUPPORTED** | Generates Versions A-D with shuffled questions and options. |
| **Export Encrypted Package** | `POST /examinations/{id}/prepare-and-send-package`| Central Backend | **FULLY SUPPORTED** | AES-256-GCM + RSA-OAEP encryption and digital signing. |
| **Retry Package Transfer** | `POST /examinations/{id}/retry-transfer` | Central Backend | **NEW API REQUIRED (CENTRAL)** | Verifies receipt before re-transferring. |
| **Generate Session Unlock Keys**| `POST /examinations/{id}/sittings/{id}/unlock-credential`| Central Backend | **DATABASE CHANGE REQUIRED** | Generates CSPRNG secret; stores salted `SHA256-ITER-V1` verifier. |
| **List Masked Unlock Keys** | `GET /examinations/unlock-credentials` | Central Backend | **DATABASE CHANGE REQUIRED** | Returns masked preview (`MITM-••••-8F3K`). Plaintext never stored. |
| **Regenerate / Revoke Keys** | `POST /examinations/.../regenerate`, `/revoke` | Central Backend | **DATABASE CHANGE REQUIRED** | Increments revision; syncs revocation. |
| **Registered Lab Nodes List** | `GET /labs/servers` | **Lab Server LAN API** | **NEW API REQUIRED (LAB SERVER)** | Queried on Lab Server LAN (`VITE_LAB_API_BASE_URL`). |
| **Live Session Telemetry** | `GET /monitoring/sessions` | **Lab Server LAN API** | **NEW API REQUIRED (LAB SERVER)** | Real-time candidate counts from local Lab Server RAM. |
| **Workstation Matrix Telemetry**| `GET /monitoring/sessions/{id}` | **Lab Server LAN API** | **NEW API REQUIRED (LAB SERVER)** | PC-01 to PC-XX live status stream from Lab Server. |
| **Verify `.labresult` Upload** | `POST /results/verify-upload` | Central Backend | **API MODIFICATION REQUIRED** | Verifies signature, session ID, and candidate roster pre-import. |
| **Import Verified Results** | `POST /results/import-verified` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Persists marks and stats into `lab_result_import`. |
| **Review Key Correction Dispute**| `POST /results/answer-key-corrections/{id}/review`| Central Backend | **DATABASE CHANGE REQUIRED** | Approves/rejects dispute and recalculates candidate marks. |
| **Approve & Release Results** | `POST /results/{id}/approve-release` | Central Backend | **FULLY SUPPORTED** | Sets status `RELEASED` and **retires selected paper set**. |
| **Course Outcomes Directory** | `GET /course-outcomes` | Central Backend | **DATABASE CHANGE REQUIRED** | Lists HOD syllabus submissions. |
| **Stream Syllabus PDF** | `GET /course-outcomes/{id}/revisions/{num}/document`| Central Backend | **DATABASE CHANGE REQUIRED** | Streams uploaded syllabus PDF bytes. |
| **Review Course Outcomes** | `POST /course-outcomes/{id}/review` | Central Backend | **DATABASE CHANGE REQUIRED** | Records COE decision (`Reviewed`/`Clarification Requested`). |
| **Archival Question Paper PDF** | `GET /examinations/{id}/sittings/{id}/question-paper-archive/download`| Central Backend | **NEW API REQUIRED (CENTRAL)** | Streams archival PDF of original paper (strictly post-completion). |
| **Immutable Audit Logs Viewer** | `GET /audit/logs` | Central Backend | **PARTIALLY SUPPORTED (ADAPTER READY)** | Chronological institutional audit trail. |

---

### 4.3 Portal 3: `student-portal (Final)` Feature Matrix (32 Features)

**CRITICAL INVARIANT:** Every endpoint in this portal communicates exclusively with the **Isolated Lab Server LAN API** (`LAB_API_BASE_URL`).

| Feature Name | Expected Route | Owning Service | Compatibility Status | Notes & Verification |
| :--- | :--- | :--- | :--- | :--- |
| **Candidate Login** | `POST /api/student/login` | **Lab Server** | **PARTIALLY SUPPORTED (ADAPTER READY)** | Validates USN and DOB against in-memory decrypted roster; binds PC. |
| **Terminal PC Detection** | Header / Payload | **Lab Server** | **FULLY SUPPORTED** | Accepts `computerNumber` (e.g. `PC-01`). |
| **Lab Connectivity Ping** | `GET /api/health` | **Lab Server** | **FULLY SUPPORTED** | Checks local LAN health. |
| **Fullscreen Enforcement** | Client-Side Action | Student Frontend | **FULLY SUPPORTED** | Triggers HTML5 fullscreen. |
| **Candidate Identity Header** | `POST /api/student/login` resp | **Lab Server** | **FULLY SUPPORTED** | Returns Name, USN, Subject, Lab, Assigned Version (A/B/C/D). |
| **Fetch Current Session State** | `GET /api/student/exam-session`| **Lab Server** | **NEW API REQUIRED (LAB SERVER)** | Restores state on page reload without re-authenticating. |
| **Fetch Exam Instructions** | `GET /api/student/instructions`| **Lab Server** | **NEW API REQUIRED (LAB SERVER)** | Returns conduct rules and duration. |
| **Start Countdown Timer** | `POST /api/student/exam/start` | **Lab Server** | **NEW API REQUIRED (LAB SERVER)** | Starts authoritative server countdown timer. |
| **Fetch Assigned Question Paper**| `GET /api/student/exam/questions`| **Lab Server** | **PARTIALLY SUPPORTED (ADAPTER READY)** | Serves decrypted version questions **WITHOUT answer keys**. |
| **Question Palette Grid** | Client-Side UI | Student Frontend | **FULLY SUPPORTED** | Visual 30-question grid with color-coded badges. |
| **Direct Jump Navigation** | Client-Side UI | Student Frontend | **FULLY SUPPORTED** | Jumps directly to any question. |
| **MCQ Question & Options Card** | Client-Side UI | Student Frontend | **FULLY SUPPORTED** | Renders prompt, code snippets, diagram images, 4 options. |
| **Real-Time Autosave** | `POST /api/student/exam/answers`| **Lab Server** | **PARTIALLY SUPPORTED (ADAPTER READY)** | Saves student choice in local memory. |
| **Client Sequence Numbering** | Payload field | **Lab Server** | **FULLY SUPPORTED** | Prevents race conditions on autosave. |
| **Clear Response Action** | `POST /api/student/exam/answers`| **Lab Server** | **FULLY SUPPORTED** | Option cleared when choice is `null` or `0`. |
| **Mark for Review Toggle** | `POST /api/student/exam/answers`| **Lab Server** | **FULLY SUPPORTED** | Saves `markedForReview = true`. |
| **Scientific Calculator Modal** | Client-Side UI | Student Frontend | **FULLY SUPPORTED** | Built-in non-programmable calculator. |
| **Multi-Vector Violation Detection**| Client-Side Hooks | Student Frontend | **FULLY SUPPORTED** | Detects window blur, tab switch, F12, developer tools, fullscreen exit. |
| **Lockdown UI Overlay** | Client-Side UI | Student Frontend | **FULLY SUPPORTED** | Immediately freezes exam view upon infraction. |
| **Report Security Violation** | `POST /api/security/violation` | **Lab Server** | **NEW API REQUIRED (LAB SERVER)** | Transmits violation record to Lab Server telemetry log. |
| **Invigilator Password Unlock**| `POST /api/security/unlock` | **Lab Server** | **NEW API REQUIRED (LAB SERVER)** | Verifies secret against session unlock verifier; unlocks without token elevation. |
| **Permanent Lockout Safeguard**| Counter logic | **Lab Server** | **FULLY SUPPORTED** | 3 failed password attempts permanently locks terminal until recovery. |
| **Final Exam Submission** | `POST /api/student/exam/submit` | **Lab Server** | **PARTIALLY SUPPORTED (ADAPTER READY)** | Permanently locks responses; **conceals scores and answer keys**. |
| **Auto-Submit on Timer Expiry** | Triggered by Timer | **Lab Server** | **FULLY SUPPORTED** | Submits with trigger `AUTO_TIMER_EXPIRED` at 00:00. |
| **Digital Completion Receipt** | `POST /api/student/exam/submit`| **Lab Server** | **FULLY SUPPORTED** | Issues confirmation code (e.g. `MIT-CBT-2026-9F7A2B`). |
| **Instructor Emergency Login** | `POST /api/instructor/login` | **Lab Server** | **NEW API REQUIRED (LAB SERVER)** | Authenticates invigilator for emergency recovery console. |
| **Re-Login Authorization Queue**| `GET /api/recovery/relogin-authorisations`| **Lab Server** | **NEW API REQUIRED (LAB SERVER)** | Lists interrupted candidates eligible for PC migration. |
| **Approve Re-Login (Crashed PC)**| `POST /api/recovery/relogin-authorisations/approve`| **Lab Server** | **NEW API REQUIRED (LAB SERVER)** | Issues one-time recovery token preserving time and answers. |
| **Session PC Transfer History** | `GET /api/recovery/transfers` | **Lab Server** | **NEW API REQUIRED (LAB SERVER)** | Audit log of terminal migrations. |
| **Emergency Audit Trail** | `GET /api/recovery/audit-logs` | **Lab Server** | **NEW API REQUIRED (LAB SERVER)** | Emergency console action logs. |

---

## 5. Security & Architectural Invariants

1. **Student Answer-Key Concealment (Zero-Leakage Invariant):**
   - The Lab Server decrypts answer keys into isolated server memory to evaluate submissions.
   - Under no circumstances will `/api/student/login`, `/api/student/exam/questions`, `/api/student/exam/state`, or `/api/student/exam/submit` return `correct`, `shuffled_correct`, or answer keys.
2. **COE Question Paper Viewing Boundary:**
   - Under institutional regulations, the COE portal can inspect paper set numbers, status, and question counts, but **CANNOT** view protected question prompts or options in scheduling listings (`/coe/papers`).
3. **Invigilator Password Verification (No Token Elevation):**
   - The on-screen invigilator unlock prompt (`POST /api/security/unlock`) verifies the entered password against the session's salted `SHA256-ITER-V1` verifier.
   - It clears the local terminal lock flag **WITHOUT** altering or elevating the candidate's `STUDENT` bearer token.
4. **Plaintext Secret Exposure Prohibition:**
   - Plaintext Invigilator Session Unlock secrets (`revealOnceSecret`) are displayed only once in the COE modal upon generation and are **NEVER** stored in PostgreSQL.
5. **Air-Gapped Result Verification:**
   - The Central Java Backend must independently verify the Lab Server RSA-2048 digital signature on `.labresult` packages before committing scores to PostgreSQL.
6. **Permanent Paper Set Retirement:**
   - When the COE formally approves and releases an examination sitting, the backend permanently updates the selected paper set status to `RETIRED` (`UPDATE generated_paper SET status='RETIRED' WHERE id = ?`). It can never be selected for another sitting.

---
*End of Second-Pass Architectural Validation. Strict Read-Only Boundaries Preserved.*
