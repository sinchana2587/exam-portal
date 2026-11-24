# MIT Mysore EMS — Backend Implementation Guide

**For:** Java Spring Boot Backend Team  
**Project:** Maharaja Institute of Technology Mysore — Examination Management System  
**Backend Port:** `8080`  
**Base Path:** `/api/v1`  
**Database:** PostgreSQL (shared, single instance)

---

## Overview

This document specifies every backend endpoint required by the three frontend portals. The frontend code has been fully integrated to call these endpoints — the backend must implement them to complete the system.

All endpoints are under `/api/v1` unless noted as a **Lab Server** endpoint (separate Spring Boot instance at `:8443`).

---

## 1. Authentication

All portals use `Authorization: Bearer {token}` headers.

### `POST /api/v1/auth/login`
Used by: **Admin Portal** (Principal / HOD)

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "user": {
    "id": "string",
    "employeeId": "string",
    "fullName": "string",
    "email": "string",
    "username": "string",
    "role": "PRINCIPAL | HOD",
    "designation": "string",
    "departmentId": "string | null",
    "departmentCode": "string | null",
    "departmentName": "string | null",
    "contactNumber": "string | null",
    "lastLogin": "ISO8601",
    "themePreference": "light | dark"
  },
  "token": "string"
}
```

**Roles:** Public (no auth)

---

### `POST /api/v1/auth/coe/login`
Used by: **COE Portal**

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "authenticated": true,
  "token": "string",
  "username": "string",
  "fullName": "string",
  "employeeId": "string",
  "role": "COE",
  "lastLogin": "ISO8601"
}
```

**Roles:** Public (no auth)

> **Note:** COE uses a separate login endpoint. If you want to unify under `/auth/login`, update the COE frontend's `authenticationService.ts` login path accordingly.

---

### `POST /api/v1/auth/logout`
Used by: **Admin Portal**, **COE Portal** (at `/auth/coe/logout`)

**Response:** `204 No Content`

**Roles:** Any authenticated role

---

### `GET /api/v1/auth/me`
Used by: **Admin Portal**

**Response:** Same as `user` object in login response.

---

### `POST /api/v1/auth/change-password`
**Request:**
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```
**Response:** `200 OK`

---

## 2. Principal Endpoints

### `GET /api/v1/principal/dashboard`
Used by: **Admin Portal (Principal)**

**Response:**
```json
{
  "totalDepartments": 0,
  "totalHods": 0,
  "activeExaminations": 0,
  "releasedResults": 0,
  "departmentSummaries": []
}
```

---

### `GET /api/v1/principal/hods`
**Response:** Array of `HodAccountRecord`

```json
[{
  "id": "string",
  "employeeId": "string",
  "fullName": "string",
  "email": "string",
  "contactNumber": "string",
  "designation": "string",
  "departmentId": "string",
  "departmentCode": "string",
  "departmentName": "string",
  "status": "Active | Inactive",
  "assignedAt": "ISO8601",
  "deactivatedAt": "ISO8601 | null",
  "assignmentHistory": []
}]
```

---

### `POST /api/v1/principal/departments/{departmentId}/replace-hod`
**Request:**
```json
{
  "newHodId": "string",
  "effectiveDate": "ISO8601",
  "reason": "string"
}
```

---

### `GET /api/v1/principal/reports/results`
### `GET /api/v1/principal/reports/export`
### `GET /api/v1/principal/audit-logs`

---

## 3. HOD Endpoints

> All HOD endpoints require role `HOD`. Backend must enforce that the HOD can only access data for their assigned `departmentId` (from token claims).

### `GET /api/v1/hod/dashboard`
Used by: **Admin Portal (HOD)** — `HodDashboardPage`

**Response:**
```json
{
  "department": { "id": "string", "code": "string", "name": "string" },
  "summary": {
    "totalStudents": 0,
    "totalStudentsAvailable": true,
    "upcomingExaminations": 0,
    "releasedResultsCount": 0
  },
  "semesterOverview": [
    {
      "semesterNumber": 1,
      "label": "1st Semester",
      "totalStudents": 0,
      "totalStudentsAvailable": true,
      "upcomingExaminations": 0,
      "releasedResults": 0
    }
  ],
  "semesterSectionBreakdowns": {
    "1": [{ "section": "A", "enrolledCount": 60 }]
  }
}
```

---

### ⭐ CONNECTION 1 — `GET /api/v1/hod/examinations`
**Used by:** Admin Portal → `HodExamStatusPage`  
**Purpose:** HOD views examinations scheduled by COE for their department.

**Query params:**
- `semesterNumber` (optional, integer)
- `status` (optional: `Scheduled | In Progress | Exam Completed | Cancelled`)

**Response:** Array of `ExaminationRecord`
```json
[{
  "id": "string",
  "subjectCode": "string",
  "subjectName": "string",
  "departmentCode": "string",
  "semesterNumber": 1,
  "examDate": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "durationMinutes": 90,
  "status": "Scheduled | In Progress | Exam Completed | Cancelled",
  "labReadiness": "Not Ready | Ready | Issue",
  "morningSitting": {
    "sittingId": "string",
    "studentCount": 0,
    "assignedStudentUsns": []
  },
  "afternoonSitting": {
    "sittingId": "string",
    "studentCount": 0,
    "assignedStudentUsns": []
  },
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}]
```

**Security:** Backend filters by `departmentId` from HOD token claims. HOD cannot see other departments' examinations.

---

### ⭐ CONNECTION 5 — `GET /api/v1/hod/results`
**Used by:** Admin Portal → `DepartmentResultsPage`  
**Purpose:** HOD views COE-approved/released results for their department.

**Query params:**
- `academicYearId` (optional)
- `semesterNumber` (optional, integer)
- `examinationId` (optional)
- `section` (optional)
- `search` (optional — USN or student name)

**Response:**
```json
{
  "filterOptions": {
    "academicYears": [{ "id": "string", "label": "2024-25", "isCurrent": true, "status": "Active" }],
    "semesters": [1, 2, 3, 4, 5, 6, 7, 8],
    "examinations": [{ "id": "string", "label": "CS301 — Nov 2024", "semesterNumber": 3, "academicYearId": "string" }],
    "sections": ["A", "B", "C"]
  },
  "results": [
    {
      "id": "string",
      "usn": "4MH21CS001",
      "studentName": "Student Name",
      "subjectCode": "CS301",
      "subjectName": "Data Structures",
      "semesterNumber": 3,
      "section": "A",
      "marksObtained": 45,
      "maximumMarks": 50,
      "passingMarks": 20,
      "grade": "A",
      "result": "Pass | Fail | Absent",
      "examinationId": "string",
      "academicYearId": "string",
      "approvalStatus": "Released",
      "releasedAt": "ISO8601"
    }
  ]
}
```

**Security:** Backend filters by `departmentId` from HOD token. HOD sees only their department's released results.

---

### `GET /api/v1/hod/academic-context`
**Response:**
```json
{
  "currentAcademicYear": { "id": "string", "label": "2024-25", "isCurrent": true },
  "departmentSections": [{ "id": "string", "departmentId": "string", "semesterNumber": 1, "name": "A" }]
}
```

---

### `GET /api/v1/hod/subjects`
**Query:** `semesterNumber`, `status`

**Response:** Array of `Subject`
```json
[{
  "id": "string",
  "code": "string",
  "name": "string",
  "departmentId": "string",
  "departmentCode": "string",
  "semesterNumber": 3,
  "academicYearId": "string",
  "moduleCount": 5,
  "applicableSections": ["A", "B"],
  "status": "Active | Archived | Inactive",
  "hasDependentRecords": false,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}]
```

---

### `POST /api/v1/hod/subjects`
**Request:** Subject creation body  
**Response:** Created `Subject`

---

### `PUT /api/v1/hod/subjects/{subjectId}`
**Request:** Subject update body  
**Response:** Updated `Subject`

---

### `DELETE /api/v1/hod/subjects/{subjectId}`
**Response:** `204 No Content`

---

### `GET /api/v1/hod/subjects/{subjectId}/question-sets`
**Response:** Array of `QuestionSetMetadata`

---

### `POST /api/v1/hod/subjects/{subjectId}/question-sets/publish`
**Purpose:** HOD publishes question sets for COE to use in scheduling.  
**Response:** Published question set metadata

---

### `GET /api/v1/hod/student-lists`
**Query:** `semesterNumber`, `section`

**Response:** Array of `StudentListRevision`

---

### `POST /api/v1/hod/student-lists/import`
**Purpose:** HOD imports confirmed student records from a conversion session into the main student list.

**Request:**
```json
{
  "academicYearId": "string",
  "semesterNumber": 1,
  "section": "A",
  "fileName": "students.xlsx",
  "sourceType": "PDF_CONVERTED_EXCEL | EXCEL_UPLOAD",
  "rows": [{ "usn": "4MH21CS001", "studentName": "Name", "dob": "2003-01-15" }],
  "isReplacement": false
}
```

**Response:**
```json
{
  "revisionNumber": 1,
  "validCount": 60,
  "totalRows": 60
}
```

---

### Student List Conversion Endpoints (Express Local Server)

> **IMPORTANT:** These endpoints are served by the **Express.js local server** embedded in the Admin Portal (`server.ts`), **NOT** by the Java Spring Boot backend. Do not implement these in Java.

```
POST   /api/v1/hod/student-lists/conversions
GET    /api/v1/hod/student-lists/conversions/{id}
GET    /api/v1/hod/student-lists/conversions/{id}/records
PUT    /api/v1/hod/student-lists/conversions/{id}/records
POST   /api/v1/hod/student-lists/conversions/{id}/validate
GET    /api/v1/hod/student-lists/conversions/{id}/excel
```

---

### `GET /api/v1/hod/questions`
### `POST /api/v1/hod/questions/upload`
### `GET /api/v1/hod/subjects/{subjectId}/course-outcomes`
### `GET /api/v1/hod/key-corrections`
### `GET /api/v1/hod/audit-logs`

---

## 4. Institution Shared Data Endpoints

> Used by **COE Portal** to get HOD-managed data (Connections 1 & 2).

### ⭐ CONNECTION 2 — `GET /api/v1/institution/eligibility`
**Used by:** COE Portal → `SchedulingPage`  
**Purpose:** COE reads student cohort counts and sections from HOD-uploaded student lists.

**Query params:**
- `departmentId` (required)
- `semesterId` (required, integer)

**Response:**
```json
{
  "departmentId": "CS",
  "semesterId": 3,
  "totalEligible": 120,
  "sections": [
    {
      "section": "A",
      "eligibleCount": 60,
      "studentUsns": ["4MH21CS001", "4MH21CS002"]
    },
    {
      "section": "B",
      "eligibleCount": 60,
      "studentUsns": ["4MH21CS061", "4MH21CS062"]
    }
  ],
  "frozenByCoE": false,
  "lastUpdatedAt": "ISO8601"
}
```

**Security:** Role `COE` only.  
**Data source:** `students` and `student_list_revisions` tables populated by HOD.

---

### ⭐ CONNECTION 2 — `GET /api/v1/institution/subjects`
**Used by:** COE Portal → `SchedulingPage`  
**Purpose:** COE reads HOD-published subjects to associate with examination schedules.

**Query params:**
- `departmentId` (optional)
- `semesterId` (optional, integer)
- `publishedOnly` (optional, `true`)

**Response:** Array of `SubjectInfo`
```json
[{
  "id": "string",
  "code": "CS301",
  "name": "Data Structures",
  "departmentId": "CS",
  "semesterId": 3,
  "moduleCount": 5,
  "publishedSetCount": 3,
  "questionSets": [
    {
      "setId": "string",
      "setNumber": "SET-1",
      "totalQuestions": 50,
      "isPublished": true
    }
  ]
}]
```

**Security:** Role `COE` only.

---

### `GET /api/v1/institution/departments`
**Used by:** COE Portal  
**Response:** Array of `DepartmentInfo`

```json
[{
  "id": "CS",
  "code": "CS",
  "name": "Computer Science & Engineering"
}]
```

---

### `GET /api/v1/institution/semesters`
**Used by:** COE Portal  
**Response:** Array of `AcademicSemester` (always 8 entries, 1st–8th)

```json
[
  { "id": 1, "semesterNumber": 1, "label": "1st Semester" },
  { "id": 2, "semesterNumber": 2, "label": "2nd Semester" }
]
```

---

## 5. COE Examination Endpoints

### ⭐ CONNECTION 1 — `POST /api/v1/examinations/schedule`
**Used by:** COE Portal  
**Purpose:** COE creates a scheduled examination. This data is then read by HOD via `/hod/examinations`.

**Request:**
```json
{
  "department": "CS",
  "semester": 3,
  "subjectId": "string",
  "subjectCode": "CS301",
  "examDate": "2024-11-25",
  "startTime": "09:00",
  "durationMinutes": 90,
  "passingMarks": 20,
  "labId": "string",
  "morningSitting": {
    "enabled": true,
    "examDate": "2024-11-25",
    "startTime": "09:00",
    "durationMinutes": 90,
    "labId": "string",
    "studentCount": 60,
    "assignedStudentUsns": ["4MH21CS001"]
  },
  "afternoonSitting": {
    "enabled": false
  }
}
```

**Response:** Created `ScheduledExamination`

---

### `GET /api/v1/examinations`
**Used by:** COE Portal  
**Query:** `department`, `semester`, `status`  
**Response:** Array of `ScheduledExamination`

---

### `PUT /api/v1/examinations/{examinationId}`
**Purpose:** Update schedule. Increments `revisionNumber` if package already transferred.

---

### `DELETE /api/v1/examinations/{examinationId}`
**Business rule:** Cannot delete Completed or Cancelled examinations.

---

### `POST /api/v1/examinations/{examinationId}/cancel`

---

### `POST /api/v1/examinations/{examinationId}/prepare-and-send-package`
**Purpose:** Encrypts and sends the examination package to the Lab Server.  
**Business rules:**
- Exam must be finalized and frozen
- Student list must be non-empty
- Question set must be selected and published
- Versions A–D must be allocated

**Response:**
```json
{
  "packageId": "string",
  "packageRevision": 1,
  "sentAt": "ISO8601",
  "labServerAcknowledged": true
}
```

---

### `GET /api/v1/examinations/{examinationId}/sittings/{sittingId}/question-paper`
**Purpose:** Download/preview the question paper archive for a sitting.

---

## 6. Session Monitoring (Lab Server)

> These endpoints are served by the **Lab Server** at `VITE_LAB_API_BASE_URL` (default: `http://192.168.10.50:8443/lab-api/v1`), not the Java backend.

### ⭐ CONNECTION 4 — `GET /monitoring/sessions`
**Used by:** COE Portal → `SessionMonitoringPage`  
**Purpose:** Real-time monitoring of student exam sessions.

**Response:** Array of `SessionMonitoringData`
```json
[{
  "examinationId": "string",
  "sittingId": "string",
  "sittingName": "Morning | Afternoon",
  "totalAllocated": 60,
  "studentsLoggedIn": 45,
  "studentsStarted": 44,
  "studentsSubmitted": 20,
  "studentsRecovering": 0,
  "startedAt": "ISO8601",
  "studentSessions": [
    {
      "usn": "4MH21CS001",
      "studentName": "Name",
      "workstationId": "string",
      "status": "LoggedIn | Started | Submitted | Disconnected",
      "lastHeartbeat": "ISO8601"
    }
  ]
}]
```

---

### ⭐ CONNECTION 3 — Student Portal Lab Server Endpoints

> These are served by the **Lab Server**. The student portal communicates with the lab server directly.

**`POST /api/student/login`**  
**Request:** `{ "usn": "string", "password": "string" }`  
**Response:** `{ "token": "string", "sessionId": "string" }`

**`GET /api/student/exam-session`** (Bearer token)  
**Response:** Current exam session details

**`GET /api/student/instructions`** (Bearer token)  
**Response:** `ExaminationInstructions`
```json
{
  "examinationId": "string",
  "sittingId": "string",
  "subjectCode": "string",
  "subjectName": "string",
  "examDate": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "duration": 90,
  "marksPerQuestion": 1,
  "totalQuestions": 50,
  "passingMarks": 20,
  "semester": 3,
  "department": "CS",
  "instructions": ["string"],
  "isUnlocked": false,
  "serverTime": "ISO8601"
}
```

**`POST /api/student/exam/submit`**  
**Used by:** Student Portal → `ExamSubmissionPage`  
**Body:** Submission payload with answers

---

## 7. COE Results Endpoints

### ⭐ CONNECTION 5 — `POST /api/v1/results/{resultId}/approve-release`
**Used by:** COE Portal → `ResultApprovalPage`  
**Purpose:** COE approves and releases results. After this, HOD can see them via `/hod/results`.

**Response:**
```json
{
  "id": "string",
  "examinationId": "string",
  "subjectCode": "string",
  "importedAt": "ISO8601",
  "approvedAt": "ISO8601",
  "approvedByCoE": "string",
  "status": "Released",
  "totalStudents": 60,
  "passCount": 55,
  "failCount": 5
}
```

---

### `GET /api/v1/results/examinations`
**Used by:** COE Portal  
**Response:** Array of `ExaminationResultRecord` (import/approval status per examination)

---

### `POST /api/v1/results/verify-upload`
**Purpose:** Verify `.labresult` package integrity before import.  
**Content-Type:** `multipart/form-data`  
**Fields:** `file`, `examinationId`, `sittingName`

**Response:** `FileVerificationReport`

---

### `POST /api/v1/results/import-verified`
**Purpose:** Import verified results into PostgreSQL.  
**Content-Type:** `multipart/form-data`  
**Fields:** `file`, `examinationId`, `sittingId`, `sittingName`, `packageId`, `packageRevision`

**Response:** `ResultImportAcknowledgement`

---

### `GET /api/v1/results/answer-key-corrections`
**Used by:** COE Portal  
**Response:** Array of `AnswerKeyCorrectionRequest`

---

### `POST /api/v1/results/answer-key-corrections/{requestId}/review`
**Request:**
```json
{
  "decision": "Approved | Rejected",
  "coeDecisionNotes": "string"
}
```

---

## 8. Lab Server — Workstation Management (COE)

> Lab Server only. Not the Java backend.

### `GET /labs/servers`
**Response:** Array of `LabServerNode`

### `POST /labs/{labId}/sittings/{sittingId}/workstation-bind`
### `POST /labs/{labId}/sittings/{sittingId}/pc-recovery`

---

## 9. Standard Error Response Format

All endpoints must return consistent error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | SERVER_ERROR",
    "message": "Human-readable error message",
    "details": ["optional array of field-level errors"]
  }
}
```

| HTTP Status | Frontend `ApiError.kind` |
|---|---|
| 400, 409, 422 | `validation` |
| 401 | `unauthorised` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 5xx | `server` |
| Network timeout | `network` |

---

## 10. Authentication & Token Requirements

The JWT token must include the following claims for backend role enforcement:

```json
{
  "sub": "userId",
  "role": "PRINCIPAL | HOD | COE | STUDENT",
  "departmentId": "string (HOD only)",
  "departmentCode": "string (HOD only)",
  "exp": 1234567890,
  "iat": 1234567890
}
```

**Token storage per portal:**
- Admin Portal: `sessionStorage['mit_mysore_auth_token']`
- COE Portal: `sessionStorage['mitm_coe_auth_token_v2']`
- Student Portal: `sessionStorage['mitm_student_active_session_token_v1']`

---

## 11. HOD Context Headers (Express Server Only)

When the Admin Portal's Express server forwards requests to the Java backend, it adds these headers derived from the HOD's session:

```
x-hod-user-id: {user.id}
x-hod-department-id: {user.departmentId}
x-hod-department-code: {user.departmentCode}
```

The Java backend should **also** accept these headers as a secondary authorization context (in addition to Bearer token) for HOD-scoped endpoints, to allow the Express conversion server to call on behalf of the authenticated HOD.

---

## 12. Summary — The 5 Cross-Portal Connections

| # | Flow | Frontend Call | Backend Endpoint | DB Table |
|---|---|---|---|---|
| 1 | COE → HOD | HOD reads exams | `GET /hod/examinations` | `examinations` |
| 2 | HOD → COE | COE reads student cohort | `GET /institution/eligibility` | `students`, `student_list_revisions` |
| 2 | HOD → COE | COE reads published subjects | `GET /institution/subjects?publishedOnly=true` | `subjects`, `question_sets` |
| 3 | COE → Student | COE sends exam package | `POST /examinations/{id}/prepare-and-send-package` | Lab Server |
| 3 | Student reads exam | Student gets instructions | `GET /api/student/instructions` | Lab Server |
| 4 | Student → COE | Student submits | `POST /api/student/exam/submit` → Lab Server | Lab Server |
| 4 | COE monitors | COE reads live status | `GET /monitoring/sessions` | Lab Server |
| 5 | COE → HOD | COE approves results | `POST /results/{id}/approve-release` | `examination_results` |
| 5 | HOD → reads | HOD views results | `GET /hod/results` | `examination_results` |

---

## 13. CORS Configuration

The Java backend must allow CORS from all three portal origins:

```
http://localhost:5173   (Admin portal dev)
http://localhost:5174   (COE portal dev)
http://localhost:5175   (Student portal dev)
http://192.168.1.100:*  (Production - all portals)
```

Allowed headers must include: `Authorization`, `Content-Type`, `x-hod-user-id`, `x-hod-department-id`, `x-hod-department-code`

---

*See `INTEGRATION/DATABASE_SCHEMA.md` for the complete PostgreSQL table definitions.*  
*See `INTEGRATION/UNIFIED_API_CONTRACT.md` for the full 128-endpoint contract.*
