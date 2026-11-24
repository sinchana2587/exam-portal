# Maharaja Institute of Technology Mysore (MIT Mysore)
## Examination Management System — Validated API Integration Blueprint

**Document Version:** 2.0.0 (Validated Architecture)  
**Date:** November 17, 2026  
**Auditor:** Senior Full-Stack Architect & Backend Integration Auditor  
**Audit Policy:** STRICTLY READ-ONLY ARCHITECTURAL SPECIFICATION

---

## 1. Architectural Partitioning & Base URLs

The API surface is explicitly partitioned across three separate runtime services:

1. **Central Java 17 Backend (`CampusExam.java`):**
   - **Base URL:** `http://<central-host>:8080`
   - **Versioned Routes:** `/api/v1/*` (Serves modern React frontends with standard envelope `{ success: true, data: { ... }, timestamp: "..." }`).
   - **Unversioned Routes:** `/api/*` (Preserved unaltered with flat response schemas to maintain 100% backward compatibility with `mit_workflow_test.py`, `smoke_test.py`, and `testsprite_tests`).
2. **Isolated Laboratory Examination Server (`Lab Server`):**
   - **Base URL:** `http://<lab-host>:8443` (or `http://192.168.10.50:8443/lab-api/v1`)
   - Operates on the local air-gapped lab network.
   - Owns all live candidate examination execution, offline autosave, security lockdown, invigilator unlocks, and live workstation telemetry.
3. **Admin Portal Express Sidecar (`server.ts`):**
   - **Base URL:** `http://localhost:3000` (runs alongside Vite in `frontend/admin-portal/`)
   - Owns CPU-heavy client-side OCR extraction (Tesseract.js / PDF.js) and Excel parsing (ExcelJS).

---

# SECTION 1: Central Java Backend APIs (`CampusExam.java`)

### 1.1 Authentication & Profile Management

#### 1.1.1 Institutional Login (`POST /api/v1/auth/login`)
- **Status:** **[EXISTING LOGIC — VERSIONED ADAPTER]**
- **Preservation Notice:** Existing `/api/login` remains completely untouched returning flat `{token, role, userId, ...}` for automated Python test suites.
- **Method:** `POST`
- **Path:** `/api/v1/auth/login` (Alias: `/auth/coe/login`)
- **Authentication:** Public
- **Request JSON:**
  ```json
  {
    "username": "hod_cse",
    "password": "Password@123"
  }
  ```
- **Response JSON (`200 OK` — `ApiResponse<AuthResponse>`):**
  ```json
  {
    "success": true,
    "data": {
      "token": "7a9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
      "user": {
        "id": "1",
        "username": "hod_cse",
        "email": "hod.cse@mitmysore.in",
        "fullName": "Dr. Ramesh Kumar",
        "role": "HOD",
        "departmentId": "1",
        "departmentCode": "CSE",
        "departmentName": "Computer Science & Engineering",
        "employeeId": "MITM-CSE-001",
        "contactNumber": "+91 9845012345",
        "designation": "Professor & Head"
      }
    },
    "timestamp": "2026-11-17T10:00:00.000Z"
  }
  ```
- **Database Operations:**
  - Queries `account` joined with `department`.
  - Verifies PBKDF2WithHmacSHA256 salted hash.
  - Inserts 12-hour session into `session_token`.
  - Records `USER_LOGIN` in `audit`.
- **Validation:** Username & password non-empty.
- **Error Codes:** `401` Invalid credentials, `403` Account inactive.

#### 1.1.2 Update Profile Contact Details (`PATCH /api/v1/auth/profile`)
- **Status:** **[PROPOSED NEW ENDPOINT — CENTRAL]**
- **Method:** `PATCH`
- **Path:** `/api/v1/auth/profile`
- **Authentication:** Bearer Token (`PRINCIPAL`, `HOD`, `COE`, `ADMIN`)
- **Request JSON:** `{ "contactNumber": "+91 9845012345" }`
- **Response JSON (`200 OK`):** `{ "success": true, "data": { "id": "1", "contactNumber": "+91 9845012345" } }`
- **Database Operations:** `UPDATE account SET contact_number = ? WHERE id = ?`. Records in `audit`.

#### 1.1.3 Change Password (`POST /api/v1/auth/change-password`)
- **Status:** **[PROPOSED NEW ENDPOINT — CENTRAL]**
- **Method:** `POST`
- **Path:** `/api/v1/auth/change-password` (Alias: `/auth/coe/change-password`)
- **Authentication:** Bearer Token (All authenticated roles)
- **Request JSON:** `{ "currentPassword": "OldPassword@123", "newPassword": "NewStrongPassword@2026" }`
- **Response JSON (`200 OK`):** `{ "success": true, "message": "Password updated successfully." }`
- **Database Operations:** Verifies existing PBKDF2 hash, updates `account.password_hash`, invalidates previous sessions.

---

### 1.2 Principal Administration APIs

#### 1.2.1 Principal KPI Dashboard (`GET /api/v1/principal/dashboard`)
- **Status:** **[EXISTING LOGIC — ADAPTER READY]**
- **Method:** `GET`
- **Path:** `/api/v1/principal/dashboard`
- **Authentication:** Bearer Token (`PRINCIPAL`, `ADMIN`)
- **Response JSON (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "summary": {
        "totalDepartments": 7,
        "totalHodAccounts": 7,
        "activeHodAccounts": 7,
        "totalRegisteredStudents": 1420,
        "upcomingExaminations": 4,
        "examinationsInProgress": 1,
        "completedExaminations": 18
      },
      "examinationActivity": [ ... ],
      "recentAdministrativeActivities": [ ... ]
    }
  }
  ```
- **Database Operations:** Aggregates counts from `department`, `account`, `student_roster`, `examination_session`.

#### 1.2.2 Create Department & HOD Account (`POST /api/v1/principal/hods`)
- **Status:** **[PROPOSED NEW TRANSACTIONAL ENDPOINT]**
- **Method:** `POST`
- **Path:** `/api/v1/principal/hods`
- **Authentication:** Bearer Token (`PRINCIPAL`, `ADMIN`)
- **Request JSON:**
  ```json
  {
    "fullName": "Dr. Anitha Rao",
    "employeeId": "MITM-ISE-001",
    "email": "hod.ise@mitmysore.in",
    "contactNumber": "+91 9845098765",
    "departmentName": "Information Science & Engineering",
    "departmentCode": "ISE"
  }
  ```
- **Response JSON (`201 Created`):**
  ```json
  {
    "success": true,
    "data": { "departmentId": "2", "hodAccountId": "5", "username": "hod_ise" },
    "message": "Department and HOD account created successfully."
  }
  ```
- **Database Operations:** Atomic transaction inserting `department` and assigned `account`.

#### 1.2.3 Replace Department HOD (`POST /api/v1/principal/departments/{id}/replace-hod`)
- **Status:** **[PROPOSED NEW ENDPOINT — CENTRAL]**
- **Method:** `POST`
- **Path:** `/api/v1/principal/departments/{id}/replace-hod`
- **Authentication:** Bearer Token (`PRINCIPAL`, `ADMIN`)
- **Request JSON:** `{ "fullName": "Dr. Suresh Patil", "employeeId": "MITM-CSE-002", "email": "suresh@mit.in", "contactNumber": "+91 9845112233", "reason": "Previous HOD superannuated." }`
- **Response JSON (`200 OK`):** `{ "success": true, "message": "Department HOD transitioned successfully." }`
- **Database Operations:** Sets previous HOD `status='INACTIVE'`, creates new HOD account, records transition in `audit`.

---

### 1.3 HOD Department Workspace APIs

#### 1.3.1 HOD Academic Context (`GET /api/v1/hod/academic-context`)
- **Status:** **[PROPOSED NEW CONSOLIDATED ENDPOINT]**
- **Method:** `GET`
- **Path:** `/api/v1/hod/academic-context`
- **Authentication:** Bearer Token (`HOD`)
- **Response JSON (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "department": { "id": "1", "code": "CSE", "name": "Computer Science & Engineering" },
      "semesters": [ { "semesterNumber": 1, "label": "1st Semester" }, ... ],
      "departmentSections": [ { "id": "10", "semesterNumber": 5, "name": "Section A" } ]
    }
  }
  ```
- **Database Operations:** Reads department info and existing academic groups scoped to `user.departmentId()`.

#### 1.3.2 Publish Verified Student Roster (`POST /api/v1/hod/student-lists/upload`)
- **Status:** **[EXISTING LOGIC — ADAPTER READY]**
- **Preservation Notice:** Existing `/api/hod/upload-roster` preserved.
- **Method:** `POST`
- **Path:** `/api/v1/hod/student-lists/upload`
- **Authentication:** Bearer Token (`HOD`)
- **Request JSON:**
  ```json
  {
    "groupId": "10",
    "roster": [
      { "usn": "4MH25CS001", "full_name": "Aakash Sharma", "date_of_birth": "2004-06-15" }
    ]
  }
  ```
- **Response JSON (`200 OK`):** `{ "success": true, "data": { "groupId": "10", "count": 60 } }`
- **Database Operations:** Batch upsert into `student_roster`.

#### 1.3.3 Question Bank Finalization & Stage A Paper Generation
- **Status:** **[EXISTING ENDPOINT — FULLY FUNCTIONAL]**
- **Method:** `POST`
- **Path:** `/api/v1/hod/subjects/{subjectId}/question-sets/publish` (Alias: `/api/hod/finalize-bank`)
- **Authentication:** Bearer Token (`HOD`)
- **Request JSON:** `{ "bank_id": 1 }`
- **Response JSON (`200 OK`):** `{ "success": true, "data": { "bankId": 1, "status": "FINALIZED", "stageAGeneratedPapers": 4 } }`
- **Database Operations:** Strictly verifies 60 MCQs per module across modules 1–5 (300 total). Generates Stage A Papers 1, 2, 3, 4 (30 questions each, 6 per module, 0 overlap). Sets `question_bank.state = 'FINALIZED'`.

#### 1.3.4 Submit Course Outcomes Syllabus PDF (`POST /api/v1/hod/subjects/{id}/course-outcomes`)
- **Status:** **[PROPOSED NEW ENDPOINT — DATABASE CHANGE REQUIRED]**
- **Method:** `POST`
- **Path:** `/api/v1/hod/subjects/{id}/course-outcomes`
- **Authentication:** Bearer Token (`HOD`)
- **Content-Type:** `multipart/form-data`
- **Form Fields:** `file` (PDF binary), `statements` (JSON string of `[{code: "CO1", statement: "..."}]`)
- **Response JSON (`201 Created`):** `{ "success": true, "data": { "submissionId": "CO-1", "revisionNumber": 1, "status": "Under Review" } }`
- **Database Operations:** Persists records in `course_outcome_submission`, `course_outcome_revision`, `course_outcome_statement`.

---

### 1.4 COE Examination Management & Results APIs

#### 1.4.1 Dynamic Candidate Eligibility (`GET /api/v1/institution/eligibility`)
- **Status:** **[PROPOSED NEW ENDPOINT — CENTRAL]**
- **Method:** `GET`
- **Path:** `/api/v1/institution/eligibility`
- **Authentication:** Bearer Token (`COE`, `ADMIN`)
- **Query Parameters:** `departmentId`, `semesterId`
- **Response JSON (`200 OK`):** `{ "success": true, "data": { "department": "CSE", "semester": 5, "eligibleCount": 114, "sections": ["A", "B"] } }`
- **Database Operations:** Queries eligible candidate counts from published `student_roster`.

#### 1.4.2 Schedule Dual-Sitting Examination (`POST /api/v1/examinations/schedule`)
- **Status:** **[EXISTING LOGIC — ADAPTER READY]**
- **Method:** `POST`
- **Path:** `/api/v1/examinations/schedule`
- **Authentication:** Bearer Token (`COE`, `ADMIN`)
- **Request JSON:**
  ```json
  {
    "department": "CSE",
    "semester": 5,
    "subjectId": "1",
    "subjectCode": "BCS501",
    "examDate": "2026-11-20",
    "passingMarks": 12,
    "morningSitting": { "enabled": true, "startTime": "09:30", "durationMinutes": 60, "labId": "LAB-CSE-01" },
    "afternoonSitting": { "enabled": true, "startTime": "14:00", "durationMinutes": 60, "labId": "LAB-CSE-01" }
  }
  ```
- **Response JSON (`201 Created`):** `{ "success": true, "data": { "examinationId": "1", "status": "SCHEDULED" } }`
- **Database Operations:** Enforces lab conflict check. Creates corresponding `examination_session` rows.

#### 1.4.3 Select Paper Set & Generate Stage B Versions (`POST /api/v1/examinations/{id}/select-set`)
- **Status:** **[EXISTING ENDPOINT — FULLY FUNCTIONAL]**
- **Method:** `POST`
- **Path:** `/api/v1/examinations/{id}/select-set` (Alias: `/api/coe/select-paper`)
- **Authentication:** Bearer Token (`COE`, `ADMIN`)
- **Request JSON:** `{ "session_id": 10, "paper_id": 2 }`
- **Response JSON (`200 OK`):** `{ "success": true, "data": { "sessionId": 10, "selectedPaperId": 2, "stageBVersions": ["A", "B", "C", "D"] } }`
- **Database Operations:** Generates shuffled Versions A, B, C, D in `paper_version` and `paper_version_question`.

#### 1.4.4 Generate Session Unlock Credentials (`POST /api/v1/examinations/{id}/sittings/{id}/unlock-credential`)
- **Status:** **[PROPOSED NEW ENDPOINT — DATABASE CHANGE REQUIRED]**
- **Method:** `POST`
- **Path:** `/api/v1/examinations/{id}/sittings/{id}/unlock-credential`
- **Authentication:** Bearer Token (`COE`, `ADMIN`)
- **Response JSON (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "credential": {
        "credentialId": "UNLK-10-AM",
        "maskedPreview": "MITM-••••-8F3K",
        "generatedAt": "2026-11-20T08:45:00Z",
        "expiresAt": "2026-11-20T12:30:00Z",
        "status": "Active"
      },
      "revealOnceSecret": "MITM-7A9C-2X4M-8F3K"
    }
  }
  ```
- **Database Operations:** Generates CSPRNG secret; stores only salted `SHA256-ITER-V1` verifier in `session_unlock_credential`. **Plaintext secret is never saved in database.**

#### 1.4.5 Approve Key Correction Dispute & Recalculate Scores
- **Status:** **[PROPOSED NEW ENDPOINT — DATABASE CHANGE REQUIRED]**
- **Method:** `POST`
- **Path:** `/api/v1/results/answer-key-corrections/{id}/review`
- **Authentication:** Bearer Token (`COE`, `ADMIN`)
- **Request JSON:** `{ "decision": "Approved", "coeDecisionNotes": "Option C confirmed correct by board." }`
- **Response JSON (`200 OK`):** `{ "success": true, "data": { "recalculatedStudentCount": 57, "scoreChangedCount": 14 } }`
- **Database Operations:** Updates key in `paper_version_question`, recalculates candidate scores in `student_session_result`, updates statistics in `lab_result_import`.

#### 1.4.6 Result Approval, Release & Permanent Paper Retirement
- **Status:** **[EXISTING ENDPOINT — FULLY FUNCTIONAL]**
- **Method:** `POST`
- **Path:** `/api/v1/results/{id}/approve-release` (Alias: `/api/coe/release-results`)
- **Authentication:** Bearer Token (`COE`, `ADMIN`)
- **Request JSON:** `{ "sessionId": 10 }`
- **Response JSON (`200 OK`):** `{ "success": true, "data": { "sessionId": 10, "status": "RELEASED", "retiredPaperId": 2 } }`
- **Database Operations:** Verifies all key disputes resolved. Updates `lab_result_import.status='RELEASED'`. Permanently retires paper set: `UPDATE generated_paper SET status='RETIRED' WHERE id = ?`.

---

# SECTION 2: Isolated Lab Examination Server LAN APIs (`Lab Server`)

**CRITICAL ARCHITECTURAL BOUNDARY:**
All endpoints in this section are served by the **Isolated Lab Server** located physically on the local examination laboratory LAN (`LAB_API_BASE_URL`). Candidates communicate **strictly** with this host during examinations.

### 2.1 Candidate CBT Lifecycle APIs

#### 2.1.1 Candidate Authentication (`POST /api/student/login`)
- **Method:** `POST`
- **Path:** `/api/student/login`
- **Authentication:** Public
- **Request JSON:** `{ "usn": "4MH25CS149", "dateOfBirth": "2004-05-14", "computerNumber": "PC-03" }`
- **Response JSON (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "authenticated": true,
      "student": {
        "usn": "4MH25CS149",
        "fullName": "Aditya Deshmukh",
        "department": "Computer Science & Engineering",
        "semester": "5",
        "section": "A",
        "assignedWorkstationId": "PC-03",
        "assignedVersion": "A",
        "sessionToken": "<lab_session_token_64hex>"
      },
      "examSession": {
        "examinationId": "1",
        "sessionId": "10",
        "subjectCode": "BCS501",
        "subjectName": "Software Engineering & Project Management",
        "durationMinutes": 60,
        "totalQuestions": 30,
        "assignedVersion": "A"
      },
      "serverTimestampMs": 1731835200000
    }
  }
  ```
- **Lab Server Operations:** Checks decrypted in-memory session roster; binds PC-03 to balanced version A; issues student session token.

#### 2.1.2 Fetch Assigned Question Paper (`GET /api/student/exam/questions`)
- **Method:** `GET`
- **Path:** `/api/student/exam/questions`
- **Authentication:** Bearer Token (`STUDENT`)
- **Response JSON (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "examinationId": "1",
      "sessionId": "10",
      "assignedVersion": "A",
      "totalQuestions": 30,
      "questions": [
        {
          "questionId": "Q-MOD1-001",
          "displayNumber": 1,
          "moduleNumber": 1,
          "moduleTitle": "Module 1: Software Processes",
          "questionText": "Which agile model emphasizes short time-boxed iterations called Sprints?",
          "options": [
            { "optionKey": "A", "optionId": "OPT_1", "text": "Scrum Framework" },
            { "optionKey": "B", "optionId": "OPT_2", "text": "Waterfall Model" },
            { "optionKey": "C", "optionId": "OPT_3", "text": "Spiral Model" },
            { "optionKey": "D", "optionId": "OPT_4", "text": "V-Model" }
          ]
        }
      ]
    }
  }
  ```
- **SECURITY INVARIANT:** Excludes `correct`, `shuffled_correct`, and explanations from student responses.

#### 2.1.3 Autosave Response (`POST /api/student/exam/answers`)
- **Method:** `POST`
- **Path:** `/api/student/exam/answers`
- **Authentication:** Bearer Token (`STUDENT`)
- **Request JSON:** `{ "examinationId": "1", "sessionId": "10", "studentUsn": "4MH25CS149", "questionId": "Q-MOD1-001", "selectedOption": "A", "markedForReview": false, "clientSequence": 1 }`
- **Response JSON (`200 OK`):** `{ "success": true, "data": { "acknowledged": true, "questionId": "Q-MOD1-001", "selectedOption": "A", "remainingSeconds": 3480 } }`
- **Lab Server Operations:** Saves answer in local high-speed memory/storage.

#### 2.1.4 Submit Examination (`POST /api/student/exam/submit`)
- **Method:** `POST`
- **Path:** `/api/student/exam/submit`
- **Authentication:** Bearer Token (`STUDENT`)
- **Request JSON:** `{ "examinationId": "1", "sessionId": "10", "studentUsn": "4MH25CS149", "assignedVersion": "A", "submissionTrigger": "MANUAL" }`
- **Response JSON (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "submitted": true,
      "locked": true,
      "receipt": {
        "confirmationReference": "MIT-CBT-2026-9F7A2B",
        "studentUsn": "4MH25CS149",
        "submittedAt": "10:30:00 AM",
        "submissionTrigger": "MANUAL",
        "answeredCount": 28,
        "unansweredCount": 2
      }
    }
  }
  ```
- **SECURITY INVARIANT:** Scores and answer keys remain concealed upon submission.

---

### 2.2 Proctored Security & Terminal Lockdown APIs

#### 2.2.1 Report Security Violation (`POST /api/security/violation`)
- **Method:** `POST`
- **Path:** `/api/security/violation`
- **Authentication:** Bearer Token (`STUDENT`)
- **Request JSON:** `{ "violationType": "TAB_SWITCH", "studentUsn": "4MH25CS149", "examinationId": "1", "remainingSeconds": 2400 }`
- **Response JSON (`200 OK`):** `{ "success": true, "data": { "isLocked": true, "violationCount": 1 } }`
- **Lab Server Operations:** Records event in violation telemetry; flags candidate session as locked.

#### 2.2.2 Invigilator Terminal Unlock (`POST /api/security/unlock`)
- **Method:** `POST`
- **Path:** `/api/security/unlock`
- **Authentication:** Bearer Token (`STUDENT`)
- **Request JSON:** `{ "enteredPassword": "MITM-7A9C-2X4M-8F3K", "studentUsn": "4MH25CS149", "examinationId": "1" }`
- **Response JSON (`200 OK`):** `{ "success": true, "message": "Invigilator authorization verified. Resuming session.", "data": { "isLocked": false } }`
- **SECURITY INVARIANT:** Verifies entered password against session's salted `SHA256-ITER-V1` verifier. Clears terminal lock flag without elevating student bearer token. Increments failed attempts; locks permanently on 3 consecutive failures.

---

### 2.3 In-Console Emergency Recovery Console APIs

#### 2.3.1 Instructor Login (`POST /api/instructor/login`)
- **Method:** `POST`
- **Path:** `/api/instructor/login`
- **Authentication:** Public
- **Request JSON:** `{ "recoveryId": "EMGR-LOGIN-01", "recoveryKey": "ProTick-0011" }`
- **Response JSON (`200 OK`):** `{ "authenticated": true, "token": "<instructor_jwt_token>", "instructor": { "name": "COE Emergency Recovery Invigilator" } }`

#### 2.3.2 Approve Re-Login for Crashed Terminal (`POST /api/recovery/relogin-authorisations/approve`)
- **Method:** `POST`
- **Path:** `/api/recovery/relogin-authorisations/approve`
- **Authentication:** Bearer Token (`INSTRUCTOR` / `LAB_ADMIN`)
- **Request JSON:** `{ "usn": "4MH25CS149", "reason": "Terminal Hardware Crash on PC-03" }`
- **Response JSON (`200 OK`):** `{ "success": true, "data": { "tokenId": "REL-AUTH-001", "studentUsn": "4MH25CS149", "status": "APPROVED" } }`
- **Lab Server Operations:** Authorizes candidate to re-login on replacement PC with preserved remaining time and answers.

---

# SECTION 3: Admin Portal Express Sidecar APIs (`server.ts` :3000)

**PRESERVATION NOTICE:** The following routes execute strictly within the Node.js Express sidecar (`server.ts`) on port 3000 and must be preserved:

1. `POST /hod/student-lists/conversions` — Multi-page PDF/Scanned Image OCR text extraction for student rosters.
2. `GET /hod/student-lists/conversions/:conversionId` — Polls OCR progress and extracted records.
3. `PUT /hod/student-lists/conversions/:conversionId/records` — Updates inline editable student review grid.
4. `GET /hod/student-lists/conversions/:conversionId/excel` — Streams generated Excel workbook from verified OCR records.
5. `GET /hod/student-lists/template` — Streams standardized institutional student roster Excel template.
6. `POST /hod/question-banks/conversions` — Scanned question paper OCR parsing into stem, module, and options.
7. `GET /hod/question-banks/conversions/:conversionId` — Polls question conversion progress.
8. `PUT /hod/question-banks/conversions/:conversionId/records` — Updates inline editable question review grid.
9. `GET /hod/question-banks/conversions/:conversionId/excel` — Streams generated 5-module question workbook.
10. `GET /hod/question-banks/template` — Streams standardized institutional 5-module question workbook template.
11. `POST /hod/question-banks/parse-excel` — Parses uploaded Excel question workbook including embedded diagram images.

---
*End of Validated API Integration Blueprint.*
