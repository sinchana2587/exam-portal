# MIT Mysore Examination Management System — Unified API Contract

**Version:** 1.0.0  
**Generated:** 2026-11-17  
**Scope:** All three portals — Admin/HOD Portal, COE Portal, Student (Lab) Portal

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Base URLs & Environment Variables](#2-base-urls--environment-variables)
3. [Authentication Scheme](#3-authentication-scheme)
4. [Standard Error Schema](#4-standard-error-schema)
5. [Auth Endpoints — Shared (Admin + HOD Portal)](#5-auth-endpoints--shared-admin--hod-portal)
6. [Principal Endpoints](#6-principal-endpoints)
7. [HOD Endpoints](#7-hod-endpoints)
8. [COE Endpoints](#8-coe-endpoints)
9. [Student / Lab Server Endpoints](#9-student--lab-server-endpoints)
10. [Cross-Portal Connections](#10-cross-portal-connections)
11. [Architectural Invariants](#11-architectural-invariants)

---

## 1. Architecture Overview

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   Admin/HOD Portal          │     │       COE Portal             │
│   React + Vite + Express    │     │       React + Vite           │
│   VITE_API_BASE_URL         │     │   VITE_API_BASE_URL          │
│   (+ local Express for doc  │     │   VITE_LAB_API_BASE_URL      │
│    conversion)              │     │                              │
└──────────┬──────────────────┘     └──────────┬───────────────────┘
           │                                   │
           │  REST (Bearer JWT)                │  REST (Bearer JWT)
           ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│          Central Java Spring Boot Backend + PostgreSQL           │
│          http://localhost:8080/api/v1  (dev)                    │
│          http://192.168.1.100:8080/api/v1  (prod)               │
└──────────────────────────────────────┬──────────────────────────┘
                                       │  LAN Push / REST
                                       ▼
                        ┌──────────────────────────┐
                        │   Isolated Lab Server     │
                        │   (per exam room)         │
                        │   VITE_LAB_API_BASE_URL   │
                        │   /lab-api/v1  (COE)      │
                        │   /api/...     (Student)  │
                        └──────────────────────────┘
                                       ▲
                        ┌──────────────┘
                        │  REST (Bearer session token)
                        │
            ┌───────────────────────┐
            │   Student Portal      │
            │   React + Vite        │
            │   VITE_API_URL        │
            │   VITE_LAB_API_BASE_URL│
            └───────────────────────┘
```

**Three backend tiers:**

| Tier | URL | Serves |
|:-----|:----|:-------|
| **Central Java Backend** | `http://localhost:8080/api/v1` (dev) / `http://192.168.1.100:8080/api/v1` (prod) | All auth, HOD, Principal, COE, institution, results, audit |
| **Local Document Conversion Server** | `http://localhost:8080/api/v1` via admin-portal Express (`server.ts`) | HOD student-list PDF→Excel conversion, question-bank PDF→Excel conversion, course outcome PDF upload |
| **Isolated Lab Server** | `http://192.168.10.50:8443/lab-api/v1` (COE side) / `http://localhost:8080` (student side, dev) | Student exam session, security violations, instructor recovery, lab monitoring |

---

## 2. Base URLs & Environment Variables

### Admin / HOD Portal (`admin-portal (7)`)

| Variable | Dev Default | Prod Value | Purpose |
|:---------|:------------|:-----------|:--------|
| `VITE_API_BASE_URL` | `http://localhost:8080/api/v1` | `http://192.168.1.100:8080/api/v1` | All API calls |

> **Note:** Admin-portal also runs a local Express server at `/api/v1` for document conversion endpoints only. These are served locally and never reach the central backend.

**Token storage:** `sessionStorage` key `mit_mysore_auth_session` (user object) + a separate auth token key via `getAuthToken()` / `setAuthToken()`.

### COE Portal (`coe-portal (7)`)

| Variable | Dev Default | Prod Value | Purpose |
|:---------|:------------|:-----------|:--------|
| `VITE_API_BASE_URL` | `http://localhost:8080/api/v1` | `http://192.168.1.100:8080/api/v1` | Central Java backend |
| `VITE_LAB_API_BASE_URL` | `http://192.168.10.50:8443/lab-api/v1` | `http://192.168.10.50:8443/lab-api/v1` | Isolated lab server (COE monitoring) |

**Token storage:** `sessionStorage` (COE clears on `401`).

### Student Portal (`student-portal (Final)`)

| Variable | Dev Default | Prod Value | Purpose |
|:---------|:------------|:-----------|:--------|
| `VITE_API_URL` | `http://localhost:8080` | `http://192.168.1.100:8080` | Lab Server base (no `/api/v1` prefix — paths are `/api/student/...`) |
| `VITE_LAB_API_BASE_URL` | `http://localhost:8080` | `http://192.168.1.100:8080` | Same lab server |

**Token storage:** Session token returned from `/api/student/login`, stored in memory / `sessionStorage`.

---

## 3. Authentication Scheme

### Admin & HOD Portal (Central Backend)

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
Accept: application/json
```

All endpoints **except** `POST /auth/login` require the `Authorization` header.

### COE Portal (Central Backend)

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
Accept: application/json
```

All endpoints **except** `POST /auth/coe/login` require auth. File upload endpoints use `multipart/form-data`.

### Student / Lab Server

```http
Authorization: Bearer <sessionToken>
Content-Type: application/json
```

Session token is received from `POST /api/student/login`. Health check and student login require no auth.

---

## 4. Standard Error Schema

### Central Java Backend (Admin/HOD + COE)

```json
{
  "code": "EXAM_TIME_CONFLICT",
  "message": "Human-readable error explanation.",
  "errors": ["Optional detailed validation failure line 1"]
}
```

| HTTP Status | Meaning |
|:------------|:--------|
| `400` / `409` / `422` | Validation error, conflict, stale revision |
| `401` | Expired/missing token — frontend clears session |
| `403` | Authenticated but lacks required role/authority |
| `404` | Resource not found |
| `5xx` / Network | Retry banner shown; zero mock data substituted |

### Lab Server (Student Portal)

```json
{
  "code": "ERROR_IDENTIFIER_STRING",
  "message": "Human-readable explanation.",
  "details": null
}
```

---

## 5. Auth Endpoints — Shared (Admin + HOD Portal)

**Base:** `{VITE_API_BASE_URL}` = `/api/v1`  
**Backend:** Central Java Backend

---

### `POST /auth/login`

| Field | Value |
|:------|:------|
| **Auth required** | No |
| **Roles** | Principal, HOD |
| **Portals** | Admin/HOD Portal |

**Request Body:**
```json
{ "username": "string", "password": "string" }
```

**Response (`200 OK`):**
```json
{
  "user": {
    "id": "usr-hod-cse-01",
    "username": "hod.cse",
    "email": "hod.cse@mitmysore.in",
    "fullName": "HOD Full Name",
    "role": "HOD",
    "departmentId": "CSE",
    "departmentCode": "CSE",
    "departmentName": "Computer Science & Engineering",
    "designation": "Head of Department",
    "contactNumber": "+91-9876543210",
    "employeeId": "MITM-HOD-001",
    "lastLoginAt": "2026-11-17T08:00:00Z",
    "themePreference": "light"
  },
  "token": "<jwt-bearer-token>"
}
```

---

### `POST /auth/logout`

| Field | Value |
|:------|:------|
| **Auth required** | Yes |
| **Roles** | Principal, HOD |
| **Portals** | Admin/HOD Portal |

**Response (`200 OK`):** `{ "success": true }`

---

### `GET /auth/me`

| Field | Value |
|:------|:------|
| **Auth required** | Yes |
| **Roles** | Principal, HOD |
| **Portals** | Admin/HOD Portal |

**Response:** Current `AuthUser` object (same shape as `user` in login response).

---

### `POST /auth/change-password`

| Field | Value |
|:------|:------|
| **Auth required** | Yes |
| **Roles** | Principal, HOD |
| **Portals** | Admin/HOD Portal |

**Request Body:**
```json
{ "currentPassword": "string", "newPassword": "string" }
```

**Password rules (client-enforced before sending):** ≥8 chars, uppercase, lowercase, digit, special character; must differ from current.

**Response (`200 OK`):** `{ "message": "Password updated successfully." }`

---

### `PATCH /auth/profile`

| Field | Value |
|:------|:------|
| **Auth required** | Yes |
| **Roles** | Principal, HOD |
| **Portals** | Admin/HOD Portal |

**Request Body:**
```json
{ "contactNumber": "string" }
```

**Response (`200 OK`):** Updated `AuthUser` object.

---

### `PATCH /auth/preferences/theme`

| Field | Value |
|:------|:------|
| **Auth required** | Yes |
| **Roles** | Principal, HOD |
| **Portals** | Admin/HOD Portal |

**Request Body:**
```json
{ "themePreference": "light" | "dark" | "system" }
```

**Response (`200 OK`):** Updated `AuthUser` object.

---

## 6. Principal Endpoints

**Base:** `{VITE_API_BASE_URL}/principal`  
**Backend:** Central Java Backend  
**Auth:** Bearer JWT required for all  
**Role:** `Principal` only

---

### `GET /principal/dashboard`

**Response:**
```json
{
  "summary": {
    "totalDepartments": 6,
    "totalHodAccounts": 6,
    "activeHodAccounts": 5,
    "totalRegisteredStudents": 820,
    "upcomingExaminations": 3,
    "examinationsInProgress": 1,
    "completedExaminations": 12
  },
  "examinationActivity": [ /* ExaminationRecord[] */ ],
  "recentAdministrativeActivities": [ /* AuditLogEntry[] */ ]
}
```

---

### `GET /principal/hods`

**Response:** `{ departments: Department[], hodAccounts: HodAccountRecord[] }`

---

### `POST /principal/hods`

Creates a new HOD account and department atomically.

**Request Body:**
```json
{
  "fullName": "string",
  "employeeId": "string",
  "email": "string",
  "contactNumber": "string",
  "departmentName": "string",
  "departmentCode": "string (2–8 uppercase letters)"
}
```

**Response (`201 Created`):** `{ department: Department, hodAccount: HodAccountRecord }`

---

### `GET /principal/hods/{id}`

**Path Params:** `id` — HOD account ID

**Response:** `HodAccountRecord`

---

### `PATCH /principal/hods/{id}`

Updates HOD account details.

**Request Body:**
```json
{
  "fullName": "string",
  "email": "string",
  "contactNumber": "string",
  "designation": "string (optional)"
}
```

**Response:** Updated `HodAccountRecord`

---

### `PATCH /principal/hods/{id}/status`

Toggles HOD account active/inactive.

**Request Body:**
```json
{ "status": "Active" | "Inactive" | "Suspended" }
```

**Response:** Updated `HodAccountRecord`

---

### `POST /principal/departments/{deptId}/replace-hod`

Replaces the current HOD for a department with a new account.

**Path Params:** `deptId` — department code (e.g. `CSE`)

**Request Body:**
```json
{
  "fullName": "string",
  "employeeId": "string",
  "email": "string",
  "contactNumber": "string",
  "reason": "string (defaults to 'Administrative HOD Transition')"
}
```

**Response:** New `HodAccountRecord`

---

### `GET /principal/reports/results`

Query parameters: `academicYearId?`, `departmentId?`, `semesterNumber?`, `examinationId?`

**Response:**
```json
{
  "filterOptions": {
    "academicYears": [ /* AcademicYear[] */ ],
    "departments": [ /* Department[] */ ],
    "semesters": [1, 2, 3, 4, 5, 6, 7, 8],
    "examinations": [ { "id": "...", "label": "...", "departmentId": "...", "semesterNumber": 5, "academicYearId": "..." } ]
  },
  "statistics": {
    "studentsEvaluated": 820,
    "totalResultEntries": 1200,
    "absentCount": 15,
    "passCount": 780,
    "failCount": 25,
    "passPercentage": 96.9,
    "failPercentage": 3.1,
    "highestPercentage": 100.0,
    "averagePercentage": 73.4,
    "lowestPercentage": 20.0
  },
  "departmentBreakdown": [ /* per-dept stats */ ],
  "subjectBreakdown": [ /* per-subject stats */ ],
  "sectionBreakdown": [ /* per-section stats */ ],
  "releasedResults": [ /* StudentExamResult[] */ ]
}
```

---

### `GET /principal/reports/export`

Query parameters: same as reports/results. Returns downloadable report file (CSV/Excel/PDF — MIME type per backend implementation).

---

### `GET /principal/audit-logs`

**Response:** `AuditLogEntry[]` — institution-wide administrative audit trail.

---

## 7. HOD Endpoints

**Base:** `{VITE_API_BASE_URL}`  
**Auth:** Bearer JWT required for all  
**Role:** `HOD` (scoped to their department)

---

### `GET /hod/dashboard`

**Backend:** Central Java Backend

**Response:**
```json
{
  "department": { /* Department */ },
  "summary": {
    "totalStudents": 420,
    "totalStudentsAvailable": true,
    "upcomingExaminations": 2,
    "releasedResultsCount": 5
  },
  "semesterOverview": [
    {
      "semesterNumber": 5,
      "label": "5th Semester",
      "totalStudents": 114,
      "totalStudentsAvailable": true,
      "upcomingExaminations": 1,
      "releasedResults": 2
    }
  ],
  "semesterSectionBreakdowns": {
    "5": [
      { "section": "A", "enrolledCount": 57 },
      { "section": "B", "enrolledCount": 57 }
    ]
  }
}
```

---

### `GET /hod/enrollment/summary`

**Backend:** Central Java Backend

**Response:** Department enrollment summary with section-wise student counts per semester.

---

### `GET /hod/academic-context`

**Backend:** Central Java Backend

**Response:**
```json
{
  "department": { /* Department */ },
  "academicYears": [ /* AcademicYear[] */ ],
  "semesters": [ /* SemesterRecord[] (master list 1–8 merged with backend data) */ ],
  "departmentSections": [ /* DepartmentSectionConfig[] */ ]
}
```

---

### `POST /hod/academic-context/sections`

Adds a new section to a semester for the HOD's department.

**Request Body:**
```json
{ "semesterNumber": 5, "name": "Section C" }
```

**Response:** `DepartmentSectionConfig`

---

### `GET /hod/subjects`

Query params: `departmentId` (required from auth context), `semesterNumber?`

**Backend:** Central Java Backend

**Response:** `Subject[]` (or `{ subjects: Subject[] }` or `{ content: Subject[] }` — client normalizes)

---

### `POST /hod/subjects`

Creates a new subject for the HOD's department.

**Request Body:**
```json
{
  "code": "BCS501",
  "name": "Software Engineering & Project Management",
  "semesterNumber": 5,
  "academicYearId": "AY-2026-27",
  "moduleCount": 5,
  "applicableSections": ["A", "B"]
}
```

**Response:** `Subject`

---

### `GET /hod/subjects/{id}`

**Response:** `Subject`

---

### `PATCH /hod/subjects/{id}`

Updates subject details (code, name, moduleCount, applicableSections).

**Response:** Updated `Subject`

---

### `PATCH /hod/subjects/{id}/status`

**Request Body:** `{ "status": "Draft" | "Published" | "Archived" }`

**Response:** Updated `Subject`

---

### `DELETE /hod/subjects/{id}`

Deletes a draft subject. Backend rejects (`409`) if subject has published question sets.

**Response:** `{ "deletedId": "sub-cse-501" }`

---

### `GET /hod/student-lists`

Query params: `semesterNumber`, `section`

**Backend:** Central Java Backend

**Response:** `StudentListRevision[]` — all revisions for the specified semester+section.

---

### `POST /hod/student-lists/upload`

Saves a new student list revision (first upload).

**Request Body (JSON):**
```json
{
  "academicYearId": "AY-2026-27",
  "semesterNumber": 5,
  "section": "A",
  "fileName": "CSE_5A_students.xlsx",
  "sourceType": "EXCEL_UPLOAD",
  "rows": [
    {
      "rowNumber": 1,
      "usn": "4MH25CS001",
      "studentName": "Aditya Deshmukh",
      "dob": "2004-05-14",
      "isValid": true,
      "errors": []
    }
  ]
}
```

**Response:** `StudentListRevision`

---

### `POST /hod/student-lists/replace`

Replaces the current student list revision entirely.

**Request Body:** Same shape as `/upload` with `"isReplacement": true`

**Response:** `StudentListRevision`

---

### `POST /hod/student-lists/validate-usns`

Checks for cross-section or cross-department USN conflicts.

**Request Body:**
```json
{
  "semesterNumber": 5,
  "section": "A",
  "usns": ["4MH25CS001", "4MH25CS002"]
}
```

**Response:** `Record<string, string>` — map of `usn → conflict description` (empty if no conflicts)

---

### `POST /hod/student-lists/student`

Adds a single student to the current list.

**Request Body:**
```json
{
  "academicYearId": "AY-2026-27",
  "semesterNumber": 5,
  "section": "A",
  "usn": "4MH25CS099",
  "studentName": "Student Name",
  "dob": "2004-01-15"
}
```

**Response:** Updated `StudentListRevision`

---

### `PATCH /hod/students/{id}`

Updates an individual student record (USN, name, DOB).

**Request Body:** `{ "usn": "string", "studentName": "string", "dob": "YYYY-MM-DD" }`

**Response:** Updated `StudentListRevision`

---

### `DELETE /hod/students/{id}`

Removes an individual student from the list.

**Response:** Updated `StudentListRevision`

---

### Document Conversion Endpoints — LOCAL (Admin-Portal Express Server)

> These 10 endpoints are served by the **local Express server** embedded in the Admin portal (`server.ts`), **not** the central Java backend. They handle OCR/document-to-Excel conversion.

#### `POST /hod/student-lists/conversions`

Uploads a PDF/image of student list for OCR conversion.

**Content-Type:** `multipart/form-data`  
**Custom Headers:** `x-hod-user-id`, `x-hod-department-id`, `x-hod-department-code`

**Form Fields:**
- `file`: binary PDF/image
- `semesterNumber`: integer
- `section`: string
- `existingUsnConflicts`: JSON string of `Record<string, string>`

**Response:** `StudentConversionSession`

---

#### `GET /hod/student-lists/conversions/{id}`

**Response:** `StudentConversionSession`

---

#### `GET /hod/student-lists/conversions/{id}/records` → `PUT /hod/student-lists/conversions/{id}/records`

GET fetches current extracted records. PUT updates/corrects them.

**PUT Request Body:**
```json
{
  "records": [ /* ExtractedStudentPreviewRow[] */ ],
  "sectionConfirmed": true,
  "existingUsnConflicts": {}
}
```

---

#### `POST /hod/student-lists/conversions/{id}/validate`

Validates the corrected records before final import.

**Request Body:** `{ records?, sectionConfirmed?, existingUsnConflicts? }`

**Response:** `StudentConversionSession` (with updated validation status)

---

#### `GET /hod/student-lists/conversions/{id}/excel`

Downloads the final converted Excel file.

**Response:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (blob)

---

#### `POST /hod/question-banks/parse-excel`

Parses an Excel file with question bank data (with embedded images).

**Content-Type:** `multipart/form-data`  
**Custom Headers:** `x-hod-user-id`, `x-hod-department-id`, `x-hod-department-code`

**Form Fields:** `file`, `subjectModuleCount`, `selectedModuleNumber`, `existingQuestionTexts` (JSON)

**Response:**
```json
{
  "success": true,
  "fileName": "questions.xlsx",
  "fileSizeBytes": 102400,
  "rows": [ /* ParsedExcelQuestionRow[] */ ],
  "validCount": 25,
  "invalidCount": 0,
  "totalImagesExtracted": 5
}
```

---

#### `POST /hod/question-banks/conversions`

Uploads a PDF/image of question paper for OCR conversion.

**Content-Type:** `multipart/form-data`

**Form Fields:** `file`, `semesterNumber`, `subjectId`, `subjectCode`, `subjectName`, `subjectModuleCount`, `selectedPageRange?`, `existingQuestionTexts` (JSON)

**Response:** `QuestionConversionSession`

---

#### `GET /hod/question-banks/conversions/{id}`

**Response:** `QuestionConversionSession`

---

#### `GET /hod/question-banks/conversions/{id}/records` → `PUT /hod/question-banks/conversions/{id}/records`

GET fetches extracted question records. PUT updates them.

---

#### `POST /hod/question-banks/conversions/{id}/validate`

**Response:** `QuestionConversionSession` (validated)

---

#### `GET /hod/question-banks/conversions/{id}/excel`

Query params: `moduleNumber` (integer)

**Response:** Excel blob download for the specified module.

---

#### `GET /hod/question-banks/template`

Downloads a blank standard question bank Excel template.

Query params: `subjectCode`, `moduleNumber`

**Response:** Excel blob download

---

### Question Bank (Central Backend) Endpoints

#### `GET /hod/questions`

**Backend:** Central Java Backend

**Response:** `QuestionItem[]` — all questions in the HOD's department question bank.

---

#### `POST /hod/questions/upload`

Bulk-imports questions from validated Excel rows into the central question bank.

**Request Body:** `{ questions: ParsedExcelQuestionRow[], subjectId, subjectCode, moduleNumber, ... }`

**Response:** Import result summary.

---

#### `POST /hod/question-banks/import`

Imports a finalized question conversion session into the central question bank.

**Request Body:** `{ conversionId: string, subjectId: string, moduleNumber: number, ... }`

**Response:** Import acknowledgement.

---

#### `GET /hod/subjects/{subjectId}/question-sets`

**Backend:** Central Java Backend

**Response:** `QuestionSetMetadata[]` — numbered sets (Set 1, Set 2, …) for the subject.

---

#### `POST /hod/subjects/{subjectId}/question-sets/publish`

Publishes the finalized question sets for a subject, making them visible to COE for exam scheduling.

**Request Body:** `{ setNumbers: number[] }` (or empty body to publish all)

**Response:** Updated `Subject` or publish confirmation.

---

### Course Outcome Endpoints

#### `GET /hod/subjects/{subjectId}/course-outcomes`

**Backend:** LOCAL (Admin-Portal Express Server)  
**Custom Headers:** `x-hod-user-id`, `x-hod-department-id`, `x-hod-department-code`, `x-hod-user-name`

**Response:** `CourseOutcomeDocumentRevision[]`

---

#### `POST /hod/subjects/{subjectId}/course-outcomes`

Uploads a Course Outcomes PDF for the subject.

**Backend:** LOCAL (Admin-Portal Express Server)  
**Content-Type:** `multipart/form-data`  
**Max file size:** 25 MB

**Form Fields:** `file` (PDF), `semesterNumber`, `subjectId`, `subjectCode`, `subjectName`, `notes?`

**Response:**
```json
{
  "uploadedRevision": { /* CourseOutcomeDocumentRevision */ },
  "revisions": [ /* CourseOutcomeDocumentRevision[] */ ]
}
```

---

#### `GET /hod/subjects/{subjectId}/course-outcomes/{docId}/file`

**Backend:** LOCAL (Admin-Portal Express Server)

Streams the uploaded Course Outcomes PDF.

**Response:** `application/pdf` (binary blob)

---

### Key Correction Endpoints

#### `GET /hod/key-corrections`

**Backend:** Central Java Backend

Lists all HOD-submitted answer-key correction requests for their department.

**Response:** `KeyCorrectionRequest[]`

---

#### `GET /hod/key-corrections/eligible-examinations`

Lists examinations eligible for HOD answer-key correction requests.

**Response:** `ExaminationRecord[]`

---

#### `GET /hod/key-corrections/examinations/{examinationId}/questions`

Lists questions for an eligible examination (for HOD to identify the question to challenge).

**Response:** `QuestionItem[]`

---

#### `POST /hod/key-corrections`

Submits a new answer-key correction request to COE.

**Request Body:**
```json
{
  "examinationId": "exam-001",
  "questionId": "Q05",
  "proposedCorrectOption": "B",
  "reason": "Option B is correct per NPTEL reference material.",
  "evidenceFileName": "evidence.pdf"
}
```

**Response:** `KeyCorrectionRequest`

---

### Cross-Portal READ Endpoints

#### `GET /hod/examinations` ← **CONNECTION 1 (HOD side)**

**Backend:** Central Java Backend  
**Cross-portal:** COE creates exams → stored in DB → HOD reads here

Lists all COE-scheduled examinations visible to the HOD's department.

**Response:** `ExaminationRecord[]`

---

#### `GET /hod/results` ← **CONNECTION 5 (HOD side)**

**Backend:** Central Java Backend  
**Cross-portal:** COE approves & releases results → stored in DB → HOD reads here

Query params: `academicYearId?`, `semesterNumber?`, `examinationId?`, `section?`, `search?`

**Response:**
```json
{
  "filterOptions": {
    "academicYears": [ /* AcademicYear[] */ ],
    "semesters": [1, 2, 3, 4, 5, 6, 7, 8],
    "examinations": [ { "id": "...", "label": "...", "semesterNumber": 5, "academicYearId": "..." } ],
    "sections": ["A", "B"]
  },
  "results": [ /* StudentExamResult[] */ ]
}
```

---

#### `GET /hod/audit-logs`

**Backend:** Central Java Backend

**Response:** `AuditLogEntry[]` — HOD-scoped department audit trail.

---

## 8. COE Endpoints

**Base:** `{VITE_API_BASE_URL}` = `/api/v1` (Central Java Backend)  
**Auth:** Bearer JWT required for all except `POST /auth/coe/login`  
**Role:** `COE`

---

### 8.1 COE Authentication

#### `POST /auth/coe/login`

**Auth required:** No

**Request Body:**
```json
{ "username": "coe.mitm", "password": "string" }
```

**Response (`200 OK`):**
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

---

#### `POST /auth/coe/logout`

Invalidates active token and records logout in audit log.

**Response:** `{ "success": true }`

---

#### `POST /auth/coe/change-password`

**Request Body:** `{ "currentPassword": "string", "newPassword": "string" }`

**Response:** `{ "message": "Password updated successfully." }`

---

### 8.2 Institution Reference Data

#### `GET /institution/departments`

**Response:** `DepartmentInfo[]`
```json
[{ "code": "CSE", "name": "Computer Science & Engineering", "hodName": "...", "sections": ["A", "B"] }]
```

---

#### `GET /institution/semesters`

**Response:** `AcademicSemester[]` — always returns all 8 semesters.
```json
[{ "semesterNumber": 1, "label": "1st Semester", "shortLabel": "1st" }]
```

---

#### `GET /institution/eligibility`

Query params: `departmentId`, `semesterId`

Returns authoritative candidate count from HOD-published rosters. ← **CONNECTION 2 (COE side)**

**Response:**
```json
{
  "department": "CSE",
  "semester": 5,
  "eligibleCount": 114,
  "sections": ["A", "B"]
}
```

---

#### `GET /institution/subjects`

Query params: `departmentId?`, `semesterId?`, `publishedOnly=true`

**Response:** `SubjectInfo[]`
```json
[{
  "id": "sub-cse-501",
  "code": "BCS501",
  "name": "Software Engineering & Project Management",
  "department": "CSE",
  "semester": 5,
  "hodPublished": true,
  "publishedAt": "2026-11-10T11:20:00Z",
  "questionCountPerSet": 30,
  "marksPerQuestion": 1,
  "maximumMarks": 30,
  "questionBankRevisionId": "QBR-2026-01",
  "blueprintRevisionId": "BPR-2026-01"
}]
```

---

### 8.3 Examination Scheduling & Lifecycle

#### `GET /examinations/scheduled`

Lists all COE-visible scheduled/completed/cancelled examinations.

**Response:** `ScheduledExamination[]` (or `[]`)

---

#### `GET /examinations/{examinationId}`

Fetches authoritative snapshot of a single examination.

**Response:** `ScheduledExamination`

---

#### `POST /examinations/schedule` ← **CONNECTION 1 & 3 source**

Creates a new examination schedule. COE creates → DB stores → HOD reads via `GET /hod/examinations`, Student reads via `GET /api/student/exam-session`.

**Request Body:**
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

**Backend Validation:** Rejects overlapping lab schedules (`409`), validates `studentCount ≤ labCapacity`, verifies `passingMarks < maximumMarks`, attaches frozen eligible student snapshot from HOD tables.

**Response:** `ScheduledExamination`

---

#### `PUT /examinations/{examinationId}`

Updates examination (passingMarks, sitting config). Pass `"authorisedPackageRevision": true` to increment revision and invalidate prior packages.

---

#### `PUT /examinations/{examinationId}/settings`

Updates `examDate`, `startTime`, `durationMinutes`, `passingMarks`.

---

#### `PUT /examinations/{examinationId}/sittings`

Updates sitting allocations (`morningSitting`, `afternoonSitting`).

---

#### `POST /examinations/{examinationId}/confirm-schedule`

Freezes the schedule (`isFinalizedAndFrozen: true`, assigns `snapshotId`).

---

#### `POST /examinations/{examinationId}/cancel`

**Request Body:** `{ "reason": "string" }`

Cancels the exam, invalidates unstarted packages, releases lab slots, writes audit entry.

---

#### `DELETE /examinations/{examinationId}`

Deletes a Draft examination only. Rejects (`409`/`403`) for confirmed/started/completed exams.

**Response:** `{ "deletedId": "exam-001" }`

---

### 8.4 Question Set Selection & Package Transfer

#### `GET /examinations/{examinationId}/question-sets`

Returns HOD-published numbered set metadata. Never returns raw question content in bulk.

**Response:** `QuestionSetMetadata[]`

---

#### `POST /examinations/{examinationId}/select-set`

Binds a published numbered set to a sitting, generates Versions A–D server-side with CSPRNG USN-balanced allocation.

**Request Body:**
```json
{
  "examinationId": "exam-001",
  "sittingName": "Morning Sitting",
  "setNumber": "Set 2"
}
```

**Response:** Updated `ScheduledExamination`

---

#### `POST /examinations/{examinationId}/prepare-and-send-package`

Encrypts, signs, and transfers sitting package to Lab Server via LAN.

**Request Body:**
```json
{
  "examinationId": "exam-001",
  "sittingId": "sit-001-am",
  "sittingName": "Morning Sitting",
  "packageRevision": 1,
  "labId": "LAB-CSE-01"
}
```

**Response:** Updated `ScheduledExamination`

---

#### `POST /examinations/{examinationId}/retry-transfer`

Re-attempts transfer of an already-prepared package.

**Request Body:**
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

### 8.5 Session-Specific Invigilator Unlock Credentials

> COE manages **only** session-specific unlock credentials. Lab administrator / instructor accounts are outside COE scope.

#### `GET /examinations/unlock-credentials`

Returns credential metadata with masked previews — **never** plaintext secrets.

**Response:** `SessionUnlockCredential[]`

---

#### `POST /examinations/{examinationId}/sittings/{sittingId}/unlock-credential`

Generates CSPRNG secret, stores salted `SHA256-ITER-V1` verifier in PostgreSQL, pushes verifier metadata to Lab Server.

**Response:**
```json
{
  "credential": {
    "credentialId": "UNLK-2026-001-AM",
    "examinationId": "exam-001",
    "sittingId": "sit-001-am",
    "sittingName": "Morning Sitting",
    "status": "Active",
    "maskedPreview": "MITM-••••-8F3K",
    "generatedAt": "2026-11-20T08:45:00Z",
    "expiresAt": "2026-11-20T12:30:00Z",
    "revision": 1,
    "syncStatus": "Synced"
  },
  "revealOnceSecret": "MITM-7A9C-2X4M-8F3K"
}
```

---

#### `POST /examinations/{examinationId}/sittings/{sittingId}/unlock-credential/regenerate`

Invalidates previous revision, increments `revision`, syncs new verifier to Lab Server.

**Response:** `GenerateSessionUnlockResult`

---

#### `POST /examinations/{examinationId}/sittings/{sittingId}/unlock-credential/revoke`

Marks credential `Revoked`, notifies Lab Server.

**Response:** Updated `SessionUnlockCredential`

---

### 8.6 Results Verification, Import & Release

#### `GET /results/examinations`

Lists all imported/pending/released examination result records.

**Response:** `ExaminationResultRecord[]` (or `[]`)

---

#### `GET /results/answer-key-corrections`

Lists all HOD-submitted correction requests.

**Response:** `AnswerKeyCorrectionRequest[]`

---

#### `POST /results/verify-upload`

**Content-Type:** `multipart/form-data`

Verifies `.labresult` archive integrity, cryptographic signature, duplicate import guard, and frozen candidate USN matching.

**Form Fields:**
- `file`: binary `.labresult` archive
- `examinationId`: string
- `sittingName`: `'Morning Sitting' | 'Afternoon Sitting'`

**Response:** `FileVerificationReport`

---

#### `POST /results/import-verified`

**Content-Type:** `multipart/form-data`

Re-verifies and persists sitting evaluation records to PostgreSQL.

**Form Fields:**
- `file`: binary `.labresult` archive
- `examinationId`: string
- `sittingId`: string
- `sittingName`: `'Morning Sitting' | 'Afternoon Sitting'`
- `packageId`: string
- `packageRevision`: string (integer)

**Response:** `ResultImportAcknowledgement`

---

#### `POST /results/answer-key-corrections/{requestId}/review`

COE approves or rejects a HOD correction request. On approval, recalculates marks for affected students.

**Request Body:**
```json
{
  "decision": "Approved" | "Rejected",
  "coeDecisionNotes": "string"
}
```

**Response:**
```json
{
  "updatedRequest": { /* AnswerKeyCorrectionRequest */ },
  "recalculatedStudentCount": 114,
  "scoreChangedCount": 19
}
```

---

#### `POST /results/{resultId}/approve-release` ← **CONNECTION 5 source**

Marks examination results `Approved & Released`. Rejects (`409`) if any `Pending Review` correction exists or required sitting results are missing. → HOD reads via `GET /hod/results`.

**Response:** Updated `ExaminationResultRecord`

---

### 8.7 Audit Logs

#### `GET /audit/logs`

Returns immutable chronological audit log entries.

**Response:** `AuditLogEntry[]`

```json
[{
  "id": "log-001",
  "timestamp": "2026-11-15T09:30:00Z",
  "activity": "Examination scheduled for BCS501",
  "userName": "coe.mitm",
  "userRole": "COE",
  "examinationRef": "exam-001",
  "studentUsn": null,
  "actionStatus": "Success",
  "category": "Scheduling"
}]
```

**Categories:** `Scheduling`, `Eligibility`, `Sitting & Set Selection`, `Package & Lab Transfer`, `Session Monitoring`, `Result & Answer-Key`, `Question Paper Archive`, `Course Outcomes`, `Security & Account`

---

### 8.8 Question Paper Archive

#### `GET /examinations/{examinationId}/question-paper-archive`

Returns per-sitting archival availability and frozen snapshot metadata.

**Response:** `SittingQuestionPaperArchive[]`

---

#### `GET /examinations/{examinationId}/sittings/{sittingId}/question-paper-archive/download`

Streams archival PDF of original numbered paper (excluding answer keys). Returns `403`/`409` if sitting is not completed.

**Response:** `application/pdf` (binary stream)

---

#### `GET /examinations/{examinationId}/sittings/{sittingId}/question-paper-archive/answer-key/download`

COE-only restricted answer key PDF. Only available when `restrictedAnswerKeyAvailable: true`.

**Response:** `application/pdf`

---

### 8.9 Course Outcomes (COE Review)

#### `GET /course-outcomes`

Query params: `departmentId?`, `semesterId?`, `status?`, `search?`, `fromDate?`, `toDate?`

Lists HOD-submitted Course Outcome PDF records.

**Response:** `CourseOutcomeSubmission[]`

---

#### `GET /course-outcomes/{submissionId}`

Fetches full submission details including revision history and review timeline.

**Response:** `CourseOutcomeSubmission`

---

#### `GET /course-outcomes/{submissionId}/revisions/{revisionNumber}/document`

Query params: `disposition=inline|attachment`

Streams the original HOD-uploaded PDF bytes.

**Response:** `application/pdf`

---

#### `POST /course-outcomes/{submissionId}/review`

Saves COE-transcribed CO statements and review decision. Does **not** alter the original PDF.

**Request Body:**
```json
{
  "status": "Under Review" | "Reviewed" | "Clarification Requested",
  "courseOutcomeStatements": [
    { "id": "co-01 (optional)", "code": "CO1", "statement": "Understand semaphore concepts" }
  ],
  "internalReviewNotes": "string (optional)",
  "clarificationNotes": "string (required if Clarification Requested)"
}
```

**Response:** Updated `CourseOutcomeSubmission`

---

### 8.10 COE Lab Server Endpoints

**Base:** `{VITE_LAB_API_BASE_URL}` = `/lab-api/v1`  
**Backend:** Isolated Lab Server  
**Auth:** Bearer JWT (COE)

#### `GET /labs/servers`

Returns registered labs, capacities, connection statuses, and `registeredWorkstationIds[]`.

**Response:** `LabServerNode[]`

---

#### `GET /monitoring/sessions`

Returns live & completed sitting telemetry. ← **CONNECTION 4 (COE side)**

**Response:** `SessionMonitoringData[]` (or `[]`)

---

#### `GET /monitoring/sessions/{sessionId}`

Refreshes telemetry for a single session.

**Response:** `SessionMonitoringData`

---

#### `GET /labs/examinations/{examinationId}/sittings/{sittingId}/package-receipt`

Query params: `packageId`, `revision`

**Response:** `{ alreadyReceived: boolean, verified: boolean, rejectionReason?: string }`

---

#### `POST /labs/{labId}/sittings/{sittingId}/workstation-bind`

Dynamically binds a candidate USN to a physical workstation at runtime login.

**Response:** `{ binding: ActiveWorkstationBinding, assignedVersion: "A"|"B"|"C"|"D" }`

---

#### `POST /labs/{labId}/sittings/{sittingId}/pc-recovery`

Rebinds student after workstation crash, preserving answers, timer, and version.

---

#### `POST /labs/{labId}/sittings/{sittingId}/verify-unlock`

Offline-capable verification of candidate unlock secret against synced `SHA256-ITER-V1` verifier.

**Response:** `OfflineUnlockVerificationResult`

---

#### `POST /monitoring/sessions/{sittingId}/unlock-event`

Persists invigilator unlock event in audit trail.

**Response:** `SuspiciousActivityRecord`

---

## 9. Student / Lab Server Endpoints

**Base:** `{VITE_API_URL}` or `{VITE_LAB_API_BASE_URL}` (no `/api/v1` prefix)  
**Backend:** Isolated Lab Server  
**Auth:** Bearer session token (from student login)

---

### `POST /api/student/login`

**Auth required:** No

Validates student credentials and retrieves exam assignment.

**Request Body:**
```json
{
  "usn": "4MH25CS149",
  "dateOfBirth": "2004-05-14"
}
```

**Response (`200 OK`):**
```json
{
  "authenticated": true,
  "student": {
    "usn": "4MH25CS149",
    "fullName": "Aditya Deshmukh",
    "department": "Computer Science & Engineering",
    "semester": "5",
    "section": "A",
    "assignedWorkstationId": "LAB01-PC-03",
    "assignedVersion": "A",
    "sessionToken": "<session-token>",
    "dateOfBirth": "2004-05-14"
  },
  "examSession": {
    "examinationId": "EXAM-2026-BCS501",
    "sessionId": "SES-CSE-5A-BCS501-MORN",
    "subjectCode": "BCS501",
    "subjectName": "Software Engineering & Project Management",
    "scheduledDate": "2026-11-20",
    "startTime": "09:30 AM",
    "durationMinutes": 60,
    "totalQuestions": 30,
    "totalMarks": 30,
    "availabilityState": "ACTIVE"
  },
  "serverTimestampMs": 1731771000000
}
```

---

### `POST /api/student/logout`

**Auth required:** Yes

Invalidates the session token on the Lab Server.

**Response:** `{ "success": true }`

---

### `GET /api/student/exam-session` ← **CONNECTION 3 (Student side)**

**Auth required:** Yes  
**Cross-portal:** COE schedules exam → stored in DB → Student reads here

Retrieves the candidate's active session envelope for resumption on page reload.

**Response:**
```json
{
  "student": { /* student details */ },
  "examSession": { /* ExamSession */ },
  "examStarted": true,
  "instructionsConfirmed": true,
  "submitted": false,
  "submissionReceipt": null
}
```

---

### `GET /api/student/instructions` ← **CONNECTION 3 (Student side)**

**Auth required:** Yes

Retrieves exam instructions, duration, and conduct rules.

**Response:**
```json
{
  "examinationId": "EXAM-2026-BCS501",
  "sessionId": "SES-CSE-5A-BCS501-MORN",
  "institutionName": "Maharaja Institute of Technology Mysore",
  "subjectCode": "BCS501",
  "subjectName": "Software Engineering & Project Management",
  "durationMinutes": 60,
  "totalQuestions": 30,
  "totalMarks": 30,
  "marksPerCorrect": 1,
  "negativeMarkingPerWrong": 0,
  "generalRules": [ /* string[] */ ],
  "navigationRules": [ /* string[] */ ],
  "answerModificationRules": [ /* string[] */ ],
  "submissionAndAutoSubmitRules": [ /* string[] */ ]
}
```

---

### `GET /api/student/exam/questions`

**Auth required:** Yes

Returns the candidate's assigned version (A/B/C/D) of questions without answer keys.

**Response:**
```json
{
  "examinationId": "EXAM-2026-BCS501",
  "sessionId": "SES-CSE-5A-BCS501-MORN",
  "studentUsn": "4MH25CS149",
  "assignedVersion": "A",
  "totalQuestions": 30,
  "questions": [
    {
      "questionId": "Q01",
      "displayNumber": 1,
      "moduleNumber": 1,
      "moduleTitle": "Module 1: Core Principles",
      "questionText": "...",
      "codeSnippet": null,
      "options": [
        { "optionKey": "A", "optionId": "OPT_01_A", "text": "..." },
        { "optionKey": "B", "optionId": "OPT_01_B", "text": "..." },
        { "optionKey": "C", "optionId": "OPT_01_C", "text": "..." },
        { "optionKey": "D", "optionId": "OPT_01_D", "text": "..." }
      ]
    }
  ]
}
```

---

### `POST /api/student/exam/start`

**Auth required:** Yes

Starts the official countdown timer on the Lab Server (called after instructions confirmed).

**Request Body:**
```json
{
  "examinationId": "EXAM-2026-BCS501",
  "sessionId": "SES-CSE-5A-BCS501-MORN",
  "studentUsn": "4MH25CS149",
  "instructionsConfirmed": true
}
```

**Response:** `{ examStarted: true, remainingSeconds: 3600, examExpiresAtMs: ... }`

---

### `GET /api/student/exam/state`

**Auth required:** Yes

Synchronizes remaining time and previously saved answers.

**Response:** `ExamRuntimeStateResponse` with `remainingSeconds` and `responses`.

---

### `POST /api/student/exam/answers`

**Auth required:** Yes  
*(Also mapped as `POST /api/student/exam/answers/save` in the brief)*

Records answer selection, review mark, or cleared answer.

**Request Body:**
```json
{
  "examinationId": "EXAM-2026-BCS501",
  "sessionId": "SES-CSE-5A-BCS501-MORN",
  "studentUsn": "4MH25CS149",
  "questionId": "Q01",
  "selectedOption": "A",
  "markedForReview": false,
  "visited": true,
  "assignedVersion": "A",
  "clientSequence": 1
}
```

**Response:** `{ acknowledged: true, savedAt: "09:35:12 AM", remainingSeconds: 2388, ... }`

---

### `POST /api/student/exam/submit` ← **CONNECTION 4 source**

**Auth required:** Yes  
**Cross-portal:** Student submits → Lab Server records → COE reads via `GET /monitoring/sessions`

Finalizes the examination, locks responses, issues receipt.

**Request Body:**
```json
{
  "examinationId": "EXAM-2026-BCS501",
  "sessionId": "SES-CSE-5A-BCS501-MORN",
  "studentUsn": "4MH25CS149",
  "assignedVersion": "A",
  "submissionTrigger": "MANUAL" | "AUTO_TIMER_EXPIRED"
}
```

**Response:**
```json
{
  "submitted": true,
  "locked": true,
  "receipt": {
    "confirmationReference": "MIT-CBT-2026-9F7A2B",
    "examinationId": "EXAM-2026-BCS501",
    "studentUsn": "4MH25CS149",
    "submittedAt": "10:14:52 AM",
    "submissionTrigger": "MANUAL",
    "totalQuestions": 30,
    "answeredCount": 28,
    "unansweredCount": 2
  }
}
```

---

### `GET /api/student/exam/timer`

**Auth required:** Yes

Returns remaining seconds (lightweight poll endpoint).

**Response:** `{ remainingSeconds: 2388 }`

---

### `POST /api/security/violation`

**Auth required:** Yes

Reports a security violation (tab switch, window minimize, etc.) to Lab Server proctoring engine.

**Request Body:**
```json
{
  "violationType": "TAB_SWITCH",
  "label": "Browser Tab Switch",
  "description": "Candidate navigated away from the active examination tab.",
  "studentUsn": "4MH25CS149",
  "examinationId": "EXAM-2026-BCS501",
  "currentQuestionIndex": 3,
  "remainingSeconds": 2400,
  "answeredCount": 3
}
```

**Response:** `{ isLocked: boolean, violationCount: number, isPermanentlyLocked: boolean, lockedAtMs: number }`

---

### `POST /api/security/unlock`

**Auth required:** Yes

Verifies room invigilator credentials to resume a locked candidate session.

**Request Body:**
```json
{
  "enteredPassword": "invigilator-unlock-secret",
  "studentUsn": "4MH25CS149",
  "examinationId": "EXAM-2026-BCS501"
}
```

**Response:** `{ success: boolean, message: string, state: { isLocked: false, resumptionCount: 1, savedRemainingSeconds: 2400, ... } }`

---

### `POST /api/instructor/login`

**Auth required:** No

Authenticates COE Emergency Recovery Instructor (Lab Instructor).

**Request Body:**
```json
{
  "recoveryId": "EMGR-LOGIN-01",
  "recoveryKey": "ProTick-0011"
}
```

**Response:**
```json
{
  "authenticated": true,
  "token": "<instructorToken>",
  "instructor": {
    "recoveryId": "EMGR-LOGIN-01",
    "name": "COE Emergency Recovery Invigilator"
  }
}
```

---

### `GET /api/recovery/relogin-authorisations`

**Auth required:** Yes (instructor token)

Lists students requesting re-login due to workstation crash.

**Response:** `ReloginAuthorisationRecord[]`

---

### `POST /api/recovery/relogin-authorisations/approve`

**Auth required:** Yes (instructor token)

Approves a student re-login to a new workstation.

**Request Body:** `{ "usn": "4MH25CS149", "reason": "Terminal Hardware Crash on LAB01-PC-03" }`

**Response:** `{ tokenId, studentUsn, targetSystemId, authorisedAt, expiresAt, isOneTimeUsed: false }`

---

### `GET /api/recovery/overview`

**Auth required:** Yes (instructor token)

Query params: `search?`, `department?`, `status?`, `laboratory?`

**Response:** `StudentRecoveryOverview[]`

---

### `GET /api/recovery/transfers`

**Auth required:** Yes (instructor token)

**Response:** `SessionTransferRecord[]` — multi-workstation transfer history.

---

### `GET /api/recovery/audit-logs`

**Auth required:** Yes (instructor token)

**Response:** `RecoveryAuditLog[]`

---

### `GET /api/recovery/config`

**Auth required:** Yes (instructor token)

**Response:**
```json
{
  "enabled": true,
  "recoveryId": "EMGR-LOGIN-01",
  "recoveryKey": "ProTick-0011",
  "lastRotatedAt": "2026-11-12T09:00:00.000Z",
  "rotatedBy": "COE Administration (MIT Mysore)"
}
```

---

### `PUT /api/recovery/config`

**Auth required:** Yes (instructor token)

Updates recovery configuration (rotate keys, enable/disable).

**Request Body:** Same shape as GET response.

---

### `POST /api/recovery/fresh-start`

**Auth required:** Yes (instructor token)

Clears all dynamic session recovery data (re-login attempts, locks).

**Response:** `{ "success": true, "message": "All session attempts and locks reset." }`

---

### `GET /api/health`

**Auth required:** No

**Response:** `{ "status": "UP", "timestamp": 1731771000000 }`

---

## 10. Cross-Portal Connections

```
CONNECTION 1 ──────────────────────────────────────────────────────
  COE → HOD/Principal

  COE action:   POST /examinations/schedule  (creates exam in DB)
  HOD reads:    GET  /hod/examinations       (scoped to department)
  Principal:    GET  /principal/dashboard    (upcomingExaminations count)

  Data flow:    COE creates ScheduledExamination → PostgreSQL →
                HOD fetches ExaminationRecord[] for their dept

CONNECTION 2 ──────────────────────────────────────────────────────
  HOD → COE

  HOD action:   POST /hod/student-lists/upload  or  /replace
                (publishes authoritative candidate roster to DB)
  COE reads:    GET  /institution/eligibility?departmentId=&semesterId=
                (gets DepartmentEligibilitySummary to validate seat counts)
                GET  /institution/subjects?publishedOnly=true
                (gets HOD-published subjects with question bank metadata)
                POST /examinations/schedule → backend attaches frozen
                students[] snapshot from HOD eligibility tables

  Data flow:    HOD uploads/validates student list → PostgreSQL →
                COE reads eligible count before scheduling

CONNECTION 3 ──────────────────────────────────────────────────────
  COE → Student

  COE action:   POST /examinations/{id}/prepare-and-send-package
                (transfers encrypted sitting package to Lab Server)
  Student reads: GET /api/student/exam-session
                 GET /api/student/instructions

  Data flow:    COE pushes encrypted package (questions, version
                allocations, verifier) to Lab Server via LAN →
                Student authenticates at Lab Server workstation →
                Lab Server serves session and instructions from package

CONNECTION 4 ──────────────────────────────────────────────────────
  Student → COE

  Student action: POST /api/student/exam/submit
                  (Lab Server records submission + evaluation)
  COE reads:      GET /monitoring/sessions       (live & completed telemetry)
                  GET /monitoring/sessions/{id}  (single session refresh)
                  POST /results/verify-upload    (import .labresult archive)
                  POST /results/import-verified  (persist to PostgreSQL)

  Data flow:    Student submits at workstation → Lab Server records
                answers + evaluation in .labresult archive →
                After exam, COE downloads .labresult → verifies
                cryptographic signature → imports to PostgreSQL

CONNECTION 5 ──────────────────────────────────────────────────────
  COE → HOD/Principal

  COE action:   POST /results/{resultId}/approve-release
                (marks results Approved & Released in PostgreSQL)
  HOD reads:    GET  /hod/results
                (fetches released StudentExamResult[] for department)
  Principal:    GET  /principal/reports/results
                (institution-wide result breakdown)

  Data flow:    COE verifies .labresult, reviews HOD correction
                requests, then releases → PostgreSQL marks released →
                HOD/Principal can view results
```

### Connection Summary Table

| # | Direction | Source Action | Target Read | Medium |
|:-:|:----------|:--------------|:------------|:-------|
| 1 | COE → HOD/Principal | `POST /examinations/schedule` | `GET /hod/examinations` | Shared PostgreSQL |
| 2 | HOD → COE | `POST /hod/student-lists/upload` | `GET /institution/eligibility` | Shared PostgreSQL |
| 3 | COE → Student | `POST /examinations/{id}/prepare-and-send-package` | `GET /api/student/exam-session` | LAN Lab Server push |
| 4 | Student → COE | `POST /api/student/exam/submit` | `GET /monitoring/sessions` + `.labresult` import | Lab Server → manual export → COE import |
| 5 | COE → HOD/Principal | `POST /results/{id}/approve-release` | `GET /hod/results` | Shared PostgreSQL |

---

## 11. Architectural Invariants

1. **Zero Advance Workstation Preassignment.** Student-to-PC binding happens exclusively at runtime login via `/labs/{labId}/sittings/{sittingId}/workstation-bind`. No `pcId` is stored during scheduling.

2. **Independent Packages Per Sitting.** Morning and Afternoon sittings have separate `sittingId`s, encrypted packages, and `.labresult` archives. No shared session tokens between sittings.

3. **Salted Verifier Storage Only.** PostgreSQL and the Lab Server store only the salted `SHA256-ITER-V1` verifier, salt, revision, expiry, and masked preview — **never** the plaintext invigilator unlock secret.

4. **HOD/COE Boundary on Version Allocations.** Student-to-version (A/B/C/D) mapping uses CSPRNG balanced allocation and is **never** exposed to HOD or non-COE portals.

5. **Immutable Completed Exams.** Completed and Cancelled examinations cannot be deleted. Authorised package revisions (`authorisedPackageRevision: true`) increment `revisionNumber`, invalidate prior packages, and mandate fresh package generation.

6. **Zero Mock Fallback.** When an endpoint returns `[]`, the UI renders genuine empty states. `401` responses cause immediate `sessionStorage` purge and redirect. `5xx`/network errors show a retry banner — no synthetic data is substituted.

7. **Local Document Conversion Isolation.** The Admin portal Express server (`server.ts`) serves document-conversion endpoints locally. These never reach the central backend and are only called by the admin portal itself. The `VITE_API_BASE_URL` in development points to `http://localhost:8080/api/v1` — the Express server and Java backend should both listen on port `8080` or the Express server should proxy non-local requests to the Java backend.

8. **HOD Department Scoping.** All HOD endpoints are implicitly scoped to the authenticated HOD's `departmentId`. The JWT claims determine the scope; HODs cannot access other departments' data.

9. **Course Outcomes PDF Immutability.** COE review saves separately transcribed CO statements alongside the original HOD-uploaded PDF — the original PDF bytes are never modified.

10. **Question Paper Archival Timing.** Archival PDFs become downloadable **only** after the entire respective sitting reaches `'Exam Completed'` and is officially closed — not immediately after first submission.

---

*End of Unified API Contract — MIT Mysore Examination Management System*
