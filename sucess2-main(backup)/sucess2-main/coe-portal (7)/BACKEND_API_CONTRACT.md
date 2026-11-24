# MIT Mysore COE Portal — Backend REST API & Lab Server Contract

This document defines the exact REST API contract expected by the **MIT Mysore Examination Management System — COE Portal** frontend (`src/services/*` and `src/types/examination.ts`).

The frontend contains zero mock datasets, fallback stores, or client-side simulations. All data, authentication, cryptographic package preparation, LAN transfer verification, session telemetry, `.labresult` inspection, result approval, and immutable audit trails must be served by the **Central Java REST Backend + PostgreSQL** and the **Isolated Lab Server API**.

---

## 1. Environment Variables & Base URLs

| Variable | Purpose | Example |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Base URL for Central Java REST Backend (PostgreSQL-backed) | `http://localhost:8080/api/v1` |
| `VITE_LAB_API_BASE_URL` | Base URL for Isolated Lab Server LAN REST API | `http://192.168.10.50:8443/lab-api/v1` |

Trailing slashes are stripped automatically by `src/services/apiClient.ts`.

---

## 2. Authentication, Headers & Standard Error Schema

### Request Headers
- JSON endpoints: `Content-Type: application/json`, `Accept: application/json`
- File upload endpoints (`/results/verify-upload`, `/results/import-verified`): `multipart/form-data` (browser sets boundary), `Accept: application/json`
- Authenticated requests (all endpoints except `POST /auth/coe/login`):
  ```http
  Authorization: Bearer <jwt_token>
  ```

### Standard Error Response Schema
For non-2xx responses, the frontend parses JSON bodies matching:

```json
{
  "code": "EXAM_TIME_CONFLICT",
  "message": "Human-readable error explanation shown to the COE.",
  "errors": [
    "Optional detailed validation failure line 1"
  ]
}
```

| HTTP Status | Frontend Handling (`ApiErrorKind`) | Expected Backend Semantics |
| :--- | :--- | :--- |
| `400`, `409`, `422` | `validation` | Validation error, lab booking overlap, insufficient capacity, stale revision, or missing prerequisite. |
| `401` | `unauthorised` | Missing/expired/revoked token or invalid credentials. Frontend immediately clears `sessionStorage` and cached arrays and returns to Login. |
| `403` | `forbidden` | Authenticated user lacks `COE` authority or action is disallowed by institutional policy. |
| `404` | `not_found` | Requested examination, sitting, lab, or correction request does not exist. |
| `5xx` / Network | `server` / `network` | Displays non-destructive retry banner without substituting synthetic/sample data. |

---

## 3. Central Java REST Backend Endpoints (`VITE_API_BASE_URL`)

### 3.1 COE Authentication & Account Security

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `POST` | `/auth/coe/login` | Authenticates COE username & password; issues JWT + COE profile (`mode: "java-rest-api"`). |
| `POST` | `/auth/coe/logout` | Invalidates active token/session and records logout in immutable audit log. |
| `POST` | `/auth/coe/change-password` | Updates authenticated COE user's password after verifying `currentPassword`. |

#### `POST /auth/coe/login`
- **Request:**
  ```json
  { "username": "string", "password": "string" }
  ```
- **Response (`200 OK` — `AuthResponse`):**
  ```json
  {
    "authenticated": true,
    "token": "<jwt-bearer-token>",
    "mode": "java-rest-api",
    "issuedAt": "2026-11-15T09:30:00Z",
    "user": {
      "id": "usr-coe-01",
      "username": "coe.mitm",
      "email": "coe@mitmysore.in",
      "fullName": "Controller of Examinations",
      "designation": "Controller of Examinations",
      "role": "COE",
      "employeeId": "MITM-COE-001",
      "department": "Examination Cell",
      "lastLoginAt": "2026-11-15T09:30:00Z"
    }
  }
  ```

#### `POST /auth/coe/change-password`
- **Request:** `{ "currentPassword": "string", "newPassword": "string" }`
- **Response (`200 OK`):** `{ "message": "Password updated successfully." }`

---

### 3.2 Institution Reference Data & Eligibility

| Method | Path | Query Params | Response DTO |
| :--- | :--- | :--- | :--- |
| `GET` | `/institution/departments` | — | `DepartmentInfo[]` |
| `GET` | `/institution/semesters` | — | `AcademicSemester[]` (`1`..`8` in ascending order) |
| `GET` | `/institution/eligibility` | `departmentId`, `semesterId` | `DepartmentEligibilitySummary` |
| `GET` | `/institution/subjects` | `departmentId` (opt), `semesterId` (opt), `publishedOnly=true` | `SubjectInfo[]` |

#### `AcademicSemester`
```json
{
  "semesterNumber": 1,
  "label": "1st Semester",
  "shortLabel": "1st"
}
```
> Returns all 8 semesters (`1st Semester` through `8th Semester`) independent of whether examinations, subjects, or results exist yet.

#### `DepartmentInfo`
```json
{
  "code": "CSE",
  "name": "Computer Science & Engineering",
  "hodName": "HOD Name",
  "sections": ["A", "B"]
}
```

#### `DepartmentEligibilitySummary`
Returned authoritatively from HOD-published candidate rosters in PostgreSQL:
```json
{
  "department": "CSE",
  "semester": 5,
  "eligibleCount": 114,
  "sections": ["A", "B"]
}
```

#### `SubjectInfo`
```json
{
  "id": "sub-cse-501",
  "code": "BCS501",
  "name": "Software Engineering & Project Management",
  "department": "CSE",
  "departmentId": "CSE",
  "semester": 5,
  "semesterId": 5,
  "hodPublished": true,
  "publishedAt": "2026-11-10T11:20:00Z",
  "questionCountPerSet": 30,
  "marksPerQuestion": 1,
  "maximumMarks": 30,
  "questionBankRevisionId": "QBR-2026-01",
  "blueprintRevisionId": "BPR-2026-01"
}
```

---

### 3.3 Examination Scheduling, Sittings & Lifecycle Management

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/examinations/scheduled` | List all COE-visible scheduled/completed/cancelled examinations (`ScheduledExamination[]`). Return `[]` if none exist. |
| `GET` | `/examinations/{examinationId}` | Fetch latest authoritative `ScheduledExamination` snapshot prior to package actions. |
| `POST` | `/examinations/schedule` | Create new examination schedule with Morning/Afternoon sitting configuration, student allocation across sittings, and immutable frozen eligible student snapshot (`ScheduledExamination`). |
| `PUT` | `/examinations/{examinationId}` | Update examination schedule (`passingMarks`, sittings config, optional `authorisedPackageRevision: true` which increments `revisionNumber` and invalidates prior transferred packages). |
| `PUT` | `/examinations/{examinationId}/settings` | Update examination-level `examDate`, `startTime`, `durationMinutes`, `passingMarks`. |
| `PUT` | `/examinations/{examinationId}/sittings` | Update sitting allocations (`morningSitting`, `afternoonSitting`). |
| `POST` | `/examinations/{examinationId}/confirm-schedule` | Confirm and freeze schedule (`isFinalizedAndFrozen: true`, assign `snapshotId`). |
| `POST` | `/examinations/{examinationId}/cancel` | Cancel examination with mandatory `reason` (`{ "reason": "string" }`), invalidate unstarted Lab Server packages, release lab slots, and write audit entry. |
| `DELETE` | `/examinations/{examinationId}` | Delete an unstarted Draft examination (`{ "deletedId": "string" }`). Must reject `409`/`403` for confirmed/started/completed exams. |

#### `POST /examinations/schedule` Request (`CreateScheduledExamInput`)
```json
{
  "department": "CSE",
  "semester": 5,
  "subjectId": "sub-cse-501",
  "subjectCode": "BCS501",
  "examDate": "2026-11-20",
  "startTime": "09:30",
  "durationMinutes": 60,
  "passingMarks": 12,
  "labId": "LAB-CSE-01",
  "morningSitting": {
    "enabled": true,
    "examDate": "2026-11-20",
    "startTime": "09:30",
    "durationMinutes": 60,
    "labId": "LAB-CSE-01",
    "studentCount": 57
  },
  "afternoonSitting": {
    "enabled": true,
    "examDate": "2026-11-20",
    "startTime": "14:00",
    "durationMinutes": 60,
    "labId": "LAB-CSE-01",
    "studentCount": 57
  }
}
```
> **Backend Validation Required:** Reject overlapping laboratory schedules (`409 Conflict`), validate `studentCount <= labCapacity`, verify `passingMarks < maximumMarks`, and attach the frozen `students[]` list from HOD eligibility tables. Never pre-assign workstation/PC numbers to students.

---

### 3.4 Question Set Selection & Cryptographic Package Transfer

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/examinations/{examinationId}/question-sets` | Returns active HOD-published numbered question set metadata (`QuestionSetMetadata[]`). Never returns raw question content or answer keys in bulk listing if restricted. |
| `POST` | `/examinations/{examinationId}/select-set` | Binds a published numbered set (`setNumber`) to a specific sitting (`sittingName`), generates Versions A–D server-side (preserving stable `questionId`s while shuffling order/options), and runs CSPRNG USN-balanced allocation across A/B/C/D. Returns updated `ScheduledExamination`. |
| `POST` | `/examinations/{examinationId}/prepare-and-send-package` | Prepares, encrypts, and digitally signs an independent sitting package (embedding generated A–D versions, USN-version allocations, registered lab workstation IDs, and active unlock verifier if generated), transfers it via LAN to the designated Lab Server, awaits genuine verification receipt, and returns updated `ScheduledExamination`. |
| `POST` | `/examinations/{examinationId}/retry-transfer` | Re-attempts LAN transfer of an already prepared & signed package (using `receiptCheck` from the Lab Server) and returns updated `ScheduledExamination`. |

#### `POST /examinations/{examinationId}/select-set` Request
```json
{
  "examinationId": "exam-001",
  "sittingName": "Morning Sitting",
  "setNumber": "Set 2"
}
```

#### `POST /examinations/{examinationId}/prepare-and-send-package` Request
```json
{
  "examinationId": "exam-001",
  "sittingId": "sit-001-am",
  "sittingName": "Morning Sitting",
  "packageRevision": 1,
  "labId": "LAB-CSE-01"
}
```

#### `POST /examinations/{examinationId}/retry-transfer` Request
```json
{
  "examinationId": "exam-001",
  "sittingId": "sit-001-am",
  "sittingName": "Morning Sitting",
  "packageId": "PKG-2026-001-AM-R1",
  "packageRevision": 1,
  "receiptCheck": {
    "alreadyReceived": false,
    "verified": false,
    "rejectionReason": "Optional reason"
  }
}
```

---

### 3.5 Session-Specific Invigilator Unlock Credentials

> **Scope Boundary:** COE Portal manages *only* session-specific Invigilator Session Unlock Credentials (for offline lock recovery by invigilators). It never creates, views, resets, or rotates Lab Administrator/Instructor accounts.

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/examinations/unlock-credentials` | Returns credential metadata + masked previews (`SessionUnlockCredential[]`) — never plaintext secrets. |
| `POST` | `/examinations/{examinationId}/sittings/{sittingId}/unlock-credential` | Generates CSPRNG secret server-side, stores salted `SHA256-ITER-V1` verifier in PostgreSQL, pushes verifier metadata to Lab Server, and returns `{ credential, revealOnceSecret }`. |
| `POST` | `/examinations/{examinationId}/sittings/{sittingId}/unlock-credential/regenerate` | Invalidates previous credential revision, increments `revision`, syncs new verifier to Lab Server, and returns `{ credential, revealOnceSecret }`. |
| `POST` | `/examinations/{examinationId}/sittings/{sittingId}/unlock-credential/revoke` | Marks credential `Revoked` and notifies Lab Server. Returns updated `SessionUnlockCredential`. |

#### `GenerateSessionUnlockResult` Response
```json
{
  "credential": {
    "credentialId": "UNLK-2026-001-AM",
    "examinationId": "exam-001",
    "examCode": "BCS501-NOV26",
    "subjectCode": "BCS501",
    "subjectName": "Software Engineering & Project Management",
    "sittingId": "sit-001-am",
    "sittingName": "Morning Sitting",
    "examDate": "2026-11-20",
    "startTime": "09:30",
    "labId": "LAB-CSE-01",
    "labName": "CSE Main Examination Lab 1",
    "status": "Active",
    "maskedPreview": "MITM-••••-8F3K",
    "generatedAt": "2026-11-20T08:45:00Z",
    "expiresAt": "2026-11-20T12:30:00Z",
    "revision": 1,
    "syncStatus": "Synced",
    "lastSyncedAt": "2026-11-20T08:45:01Z"
  },
  "revealOnceSecret": "MITM-7A9C-2X4M-8F3K"
}
```

---

### 3.6 Results Verification, Import, Answer-Key Corrections & Release

| Method | Path | Content Type | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/results/examinations` | JSON | List all imported/pending/released `ExaminationResultRecord[]`. Return `[]` if none imported. |
| `GET` | `/results/answer-key-corrections` | JSON | List all HOD-submitted `AnswerKeyCorrectionRequest[]`. |
| `POST` | `/results/verify-upload` | `multipart/form-data` | Verifies `.labresult` archive integrity, cryptographic digital signature, `examinationId`, `sittingId`/`sessionId`, duplicate import guard, and frozen candidate USN matching. Returns `FileVerificationReport`. |
| `POST` | `/results/import-verified` | `multipart/form-data` | Re-verifies and persists sitting evaluation records into PostgreSQL; returns `ResultImportAcknowledgement`. |
| `POST` | `/results/answer-key-corrections/{requestId}/review` | JSON | COE approves (`Approved`) or rejects (`Rejected`) correction request with `coeDecisionNotes`. On approval, updates exam-specific answer key and recalculates marks for affected students. |
| `POST` | `/results/{resultId}/approve-release` | JSON | Marks examination results `Approved & Released` (must reject with `409` if any `Pending Review` answer-key correction exists or required sitting results are missing). Returns updated `ExaminationResultRecord`. |

#### `POST /results/verify-upload` FormData Fields
- `file`: Binary `.labresult` archive
- `examinationId`: `string`
- `sittingName`: `'Morning Sitting' | 'Afternoon Sitting'`

#### `POST /results/import-verified` FormData Fields
- `file`: Binary `.labresult` archive
- `examinationId`: `string`
- `sittingId`: `string`
- `sittingName`: `'Morning Sitting' | 'Afternoon Sitting'`
- `packageId`: `string`
- `packageRevision`: `string` (integer)

#### `POST /results/answer-key-corrections/{requestId}/review` Request & Response
- **Request:** `{ "decision": "Approved" | "Rejected", "coeDecisionNotes": "string" }`
- **Response:**
  ```json
  {
    "updatedRequest": { "...AnswerKeyCorrectionRequest" },
    "recalculatedStudentCount": 114,
    "scoreChangedCount": 19
  }
  ```

---

### 3.7 Read-Only Examination Audit Logs

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/audit/logs` | Returns immutable chronological `AuditLogEntry[]` (`id`, `timestamp`, `activity`, `userName`, `userRole`, `examinationRef`, `studentUsn?`, `actionStatus`, `category`). Supported categories include `'Scheduling'`, `'Eligibility'`, `'Sitting & Set Selection'`, `'Package & Lab Transfer'`, `'Session Monitoring'`, `'Result & Answer-Key'`, `'Question Paper Archive'`, `'Course Outcomes'`, `'Security & Account'`. Return `[]` if empty. |

---

### 3.8 Question Paper Archive (Frozen Sitting Snapshots & Archival PDFs)

> **Archival Invariant:** Whenever the COE selects a numbered question set for a sitting, the backend must freeze that exact revision (`snapshotId`, question order, statements, options, and images) prior to generating A/B/C/D shuffled student versions. Archival PDFs become downloadable **only** after the entire respective sitting reaches `'Exam Completed'` and is officially closed—never immediately after the first student submission.

| Method | Path | Content Type | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/examinations/{examinationId}/question-paper-archive` | JSON | Returns per-sitting archival availability and frozen snapshot metadata (`SittingQuestionPaperArchive[]`). |
| `GET` | `/examinations/{examinationId}/sittings/{sittingId}/question-paper-archive/download` | `application/pdf` | Streams the backend-generated archival PDF of the original selected numbered paper (excluding answer keys). Must return `403`/`409` if sitting is not officially completed. |
| `GET` | `/examinations/{examinationId}/sittings/{sittingId}/question-paper-archive/answer-key/download` | `application/pdf` | Optional restricted COE-only answer key PDF endpoint, enabled only when `restrictedAnswerKeyAvailable` is true. |

---

### 3.9 Course Outcomes Management (HOD PDF Submissions & COE Review)

| Method | Path | Query / Body | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/course-outcomes` | `departmentId?`, `semesterId?`, `status?`, `search?`, `fromDate?`, `toDate?` | Lists HOD-submitted Course Outcomes PDF records (`CourseOutcomeSubmission[]`). Return `[]` if empty. |
| `GET` | `/course-outcomes/{submissionId}` | — | Fetches full `CourseOutcomeSubmission` details including revision history and review timeline. |
| `GET` | `/course-outcomes/{submissionId}/revisions/{revisionNumber}/document` | `disposition=inline\|attachment` | Streams the unmodified original HOD-uploaded PDF bytes (`application/pdf`). |
| `POST` | `/course-outcomes/{submissionId}/review` | `{ "status": "Under Review" \| "Reviewed" \| "Clarification Requested", "courseOutcomeStatements": [{ "id"?, "code": "CO1", "statement": "..." }], "internalReviewNotes"?, "clarificationNotes"? }` | Saves separately transcribed dynamic CO statements and COE review decision/notes without altering the original uploaded PDF; appends immutable review & audit history. Rejects `Clarification Requested` without non-empty `clarificationNotes` (`400`). |

---

## 4. Isolated Lab Server LAN API (`VITE_LAB_API_BASE_URL`)

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/labs/servers` | Returns registered college laboratories, capacities, connection statuses, and `registeredWorkstationIds[]` (`LabServerNode[]`). |
| `GET` | `/monitoring/sessions` | Returns live & completed sitting telemetry (`SessionMonitoringData[]`). Return `[]` if none active/recorded. |
| `GET` | `/monitoring/sessions/{sessionId}` | Refreshes telemetry for a single session (`SessionMonitoringData`). |
| `GET` | `/labs/examinations/{examinationId}/sittings/{sittingId}/package-receipt` | Query params: `packageId`, `revision`. Returns `{ alreadyReceived, verified, rejectionReason? }` used before `retry-transfer`. |
| `POST` | `/labs/{labId}/sittings/{sittingId}/workstation-bind` | Dynamically binds a candidate USN to a physical lab workstation PC ID at runtime login and returns `{ binding, assignedVersion }`. |
| `POST` | `/labs/{labId}/sittings/{sittingId}/pc-recovery` | Rebinds student after workstation crash within the assigned lab scope while preserving answers, remaining timer, and assigned paper version. |
| `POST` | `/labs/{labId}/sittings/{sittingId}/verify-unlock` | Offline-capable verification of candidate unlock secret against synced `SHA256-ITER-V1` verifier (`OfflineUnlockVerificationResult`). |
| `POST` | `/monitoring/sessions/{sittingId}/unlock-event` | Persists invigilator unlock event record (`SuspiciousActivityRecord`). |

---

## 5. Non-Negotiable Architectural & PostgreSQL Invariants

1. **Zero Advance Workstation Preassignment:** Do not store or preassign student PC numbers during scheduling or sitting allocation. `ActiveWorkstationBinding` is established strictly on runtime login via `/workstation-bind`.
2. **Independent Packages Per Sitting:** Morning Sitting and Afternoon Sitting have separate `sittingId`s, question set selections, encrypted packages, and `.labresult` signatures.
3. **Salted Verifier Storage Only:** Neither PostgreSQL nor the Lab Server should store plaintext Invigilator Session Unlock secrets; persist only the salted verifier (`SHA256-ITER-V1`), salt, revision, expiration timestamp, and masked preview.
4. **HOD/COE Boundary on Version Allocations:** Student-to-version (`A`/`B`/`C`/`D`) mapping uses CSPRNG balanced allocation keyed to Student ID / USN and is never exposed to HOD or non-COE portals.
5. **Immutable Retention & Authorised Revisions:** Completed and Cancelled examinations cannot be deleted (`DELETE` forbidden). Confirming edits to an exam with an already-transferred package (`authorisedPackageRevision: true`) must increment `revisionNumber`, invalidate prior packages, and mandate fresh package generation and Lab Server verification.
6. **Zero Mock Fallback in Client:** When an endpoint returns `[]`, the UI renders genuine empty states; when an endpoint returns `401`, the frontend purges `sessionStorage` and in-memory state; when unreachable/`5xx`, a retry banner is shown.
