# Product Requirements Document (PRD) — TestSprite Automation
## CampusExam: Institutional Examination & Evaluation Platform

---

### 1. Product Overview & Environment

- **Application Name**: CampusExam (Maharaja Institute of Technology Mysore Examination System)
- **Purpose**: Institutional platform for question bank authoring, role-scoped access control, scheduled examination execution, real-time proctor monitoring, and automated score evaluation.
- **Technology Stack**:
  - **Backend**: Standalone Java 17 service (`CampusExam.java`) using built-in `com.sun.net.httpserver.HttpServer`.
  - **Database**: PostgreSQL 14+ relational persistence (`campusexam`).
  - **Frontend**: Lightweight single-page applications (`index.html`, `app.html`) using vanilla ES6 JavaScript and HTML5.
- **Environment & Local URLs**:
  - **Frontend UI Base**: `http://localhost:3000` (or `http://127.0.0.1:8080/index.html`)
  - **Backend REST API Base**: `http://127.0.0.1:8080/api`
- **Request / Response Protocol Rules**:
  - **Content-Type**: `POST` endpoints strictly require `application/x-www-form-urlencoded` request bodies (form fields). Raw JSON payloads are not accepted for these routes.
  - **Response Payload**: All responses return `application/json; charset=utf-8`.
  - **Authentication**: Protected endpoints require the HTTP header `Authorization: Bearer <64-hex-token>`.
  - **Error Structure**: All error responses return HTTP 4xx/5xx with body `{"error": "<description>"}`.

---

### 2. User Roles & Test Credentials

| Role | Permissions & Boundary Rules | Default Test Username | Default Password | Scope / Association |
| :--- | :--- | :--- | :--- | :--- |
| **`ADMIN`** / **`PRINCIPAL`** | Superuser: manages departments, academic groups, subjects, user accounts, and faculty scopes; approves/rejects/archives question banks; publishes exams; releases exam scores; views audit trail. | `admin` | `password1234` | Institutional (Unrestricted) |
| **`FACULTY`** | Author: views assigned groups/subjects (`/my-scopes`); creates question banks (`/banks`); adds questions with 4 choices, topic, difficulty, marks, and penalties (`/questions`); submits banks for approval. | `faculty-test` | `password1234` | Scoped via `faculty_scope` |
| **`STUDENT`** | Examinee: views assigned published exams (`/exams`); starts attempt (`/start`); autosaves answers with version tracking (`/answer`); submits attempt (`/submit`); views scores once released. | `4MH25CS001` | `password1234` | Bound to `group_id` |
| **`OBSERVER`** | Proctor / Auditor: read-only access to view published exam metadata (`/exams`) and live student attempt telemetry (`/monitor?exam=<id>`). Cannot author, publish, or take exams. | `observer-test` | `password1234` | Institutional Read-Only |

---

### 3. Core End-to-End User Flows (Step-by-Step)

#### Flow 1: Administrative Setup
1. **Authenticate**: Admin calls `POST /api/login` with `username=admin` & `password=password1234` -> receives 64-hex Bearer token.
2. **Create Academic Group**: Admin calls `POST /api/groups` (`department=ISE`, `session=2026-27`, `year=2`, `semester=4`, `section=A`) -> returns `{id: <group_id>}`.
3. **Create Subject**: Admin calls `POST /api/subjects` (`name=Data Structures`) -> returns `{id: <subject_id>}`.
4. **Provision Accounts**:
   - Faculty: `POST /api/accounts` (`username=faculty-test`, `password=password1234`, `role=FACULTY`).
   - Student: `POST /api/accounts` (`username=4MH25CS001`, `password=password1234`, `role=STUDENT`, `group=<group_id>`).
   - Observer: `POST /api/accounts` (`username=observer-test`, `password=password1234`, `role=OBSERVER`).
5. **Assign Faculty Scope**: Admin calls `POST /api/faculty-scopes` (`faculty=<faculty_id>`, `group=<group_id>`, `subject=<subject_id>`).

#### Flow 2: Question Bank Authoring & Approval Lifecycle
1. **Verify Scope**: Faculty calls `GET /api/my-scopes` to confirm assigned `group_id` and `subject_id`.
2. **Create Bank (`DRAFT`)**: Faculty calls `POST /api/banks` (`subject=<subject_id>`, `groups=<group_id>`, `title=Trees Bank`). State is `DRAFT`.
3. **Add Questions**: Faculty calls `POST /api/questions` (`bank=<bank_id>`, `prompt=...`, `a=...`, `b=...`, `c=...`, `d=...`, `correct=1..4`, `explanation=...`, `topic=Trees`, `difficulty=EASY|MEDIUM|HARD`, `marks=1.00`, `penalty=0.25`).
4. **Submit Bank (`SUBMITTED`)**: Faculty calls `POST /api/bank-state` (`bank=<bank_id>`, `state=SUBMITTED`). Requires >= 1 question.
5. **Admin Approval (`APPROVED`)**: Admin calls `POST /api/bank-state` (`bank=<bank_id>`, `state=APPROVED`).
6. **State Machine Rules**:
   - `DRAFT` -> `SUBMITTED` (Owner or Admin; requires >= 1 question).
   - `SUBMITTED` -> `APPROVED` or `REJECTED` (Admin only).
   - `REJECTED` -> `DRAFT` (Allows faculty revision).
   - `APPROVED` or `REJECTED` -> `ARCHIVED` (Admin only; final state).

#### Flow 3: Examination Publication
1. **Pre-Conditions**: Target bank must be `APPROVED`. Assigned groups must contain >= 1 registered student.
2. **Publish Call**: Admin calls `POST /api/publish` with fields:
   - `bank=<bank_id>`, `title=Midterm Exam`, `instructions=Do your best`, `mode=OFFICIAL|PRACTICE`.
   - `duration=<seconds>` (1 to 28800), `attempts=1` (Strictly 1 if `OFFICIAL`; >= 1 if `PRACTICE`).
   - `opens=<ISO-8601>` and `closes=<ISO-8601>` (where `opens < closes`).
   - `easy=<count>`, `medium=<count>`, `hard=<count>` (total questions 1 to 500; bank must hold sufficient questions per difficulty).
   - `pass=<marks>` (Constraint: `pass <= sum(marks)` of selected questions).
   - `groups=<comma-separated group IDs>` (must match bank scopes).
3. **Execution**: Server samples questions into `exam_question`, provisions records in `assignment`, returns `{id: <exam_id>}`.

#### Flow 4: Student Attempt Execution, Submission & Result Release
1. **Authenticate**: Student calls `POST /api/login` (`username=4MH25CS001`, `password=password1234`).
2. **View Exams**: Student calls `GET /api/exams` -> verifies assigned exam is listed.
3. **Start Attempt**: Student calls `POST /api/start` (`exam=<exam_id>`) during active window (`opens <= now < closes`) -> returns `{id: <attempt_id>}`.
4. **Retrieve Questions**: Student calls `GET /api/attempt?attempt=<attempt_id>`. Returns questions; `correct` and `explanation` remain masked (`null`).
5. **Autosave Responses**: Student calls `POST /api/answer`:
   - Fields: `attempt=<attempt_id>`, `position=<1..N>`, `choice=<1..4>` (or `0` to clear), `review=true|false`, `version=<version_counter>`.
   - `version` starts at 1, incrementing by 1 on every change to enforce optimistic concurrency.
6. **Heartbeat**: Student client calls `POST /api/heartbeat` (`attempt=<attempt_id>`, `pending=<unsaved_count>`) to refresh proctor telemetry.
7. **Submit**: Student calls `POST /api/submit` (`attempt=<attempt_id>`). Server calculates score: `+marks` for correct, `-penalty` for wrong, `0` for blank.
8. **Release Scores**: Admin calls `POST /api/release` (`exam=<exam_id>`) after `closes` window and all attempts are submitted.
9. **Review**: Student re-fetches `GET /api/attempt?attempt=<attempt_id>` -> `score`, `passed`, `correct` option indices, and `explanation` are now unmasked.

---

### 4. API Endpoint Contract Summary

All routes are prefixed with `/api/`. Form-encoded endpoints require `Content-Type: application/x-www-form-urlencoded`.

| Route | Method | Allowed Roles | Required Parameters (Form Fields / Query) | Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| `health` | `GET` | Public | None | `200` |
| `login` | `POST` | Public | `username`, `password` | `200`, `400`, `401` |
| `logout` | `POST` | Authenticated | None (Bearer Token) | `200`, `401` |
| `me` | `GET` | Authenticated | None (Bearer Token) | `200`, `401` |
| `groups` | `POST` | `ADMIN` | `department`, `session`, `year`, `semester`, `section` | `200`, `400`, `401`, `403`, `409` |
| `groups` | `GET` | `ADMIN` | None | `200`, `401`, `403` |
| `subjects` | `POST` | `ADMIN` | `name` | `200`, `400`, `401`, `403` |
| `subjects` | `GET` | `ADMIN` | None | `200`, `401`, `403` |
| `accounts` | `POST` | `ADMIN` | `username`, `password`, `role`, `group` (if role=STUDENT) | `200`, `400`, `401`, `403`, `409` |
| `accounts` | `GET` | `ADMIN` | None | `200`, `401`, `403` |
| `faculty-scopes` | `POST` | `ADMIN` | `faculty` (account id), `group`, `subject` | `200`, `400`, `401`, `403`, `409` |
| `faculty-scopes` | `GET` | `ADMIN` | None | `200`, `401`, `403` |
| `my-scopes` | `GET` | `FACULTY` | None | `200`, `401`, `403` |
| `banks` | `POST` | `FACULTY`, `ADMIN` | `subject`, `groups` (comma-separated IDs), `title` | `200`, `400`, `401`, `403` |
| `banks` | `GET` | `FACULTY`, `ADMIN` | None | `200`, `401`, `403` |
| `questions` | `POST` | `FACULTY`, `ADMIN` | `bank`, `prompt`, `a`, `b`, `c`, `d`, `correct` (1-4), `explanation`, `topic`, `difficulty` (`EASY`/`MEDIUM`/`HARD`), `marks`, `penalty` | `200`, `400`, `401`, `403`, `404`, `409` |
| `questions` | `GET` | `FACULTY`, `ADMIN` | `bank` (query param) | `200`, `400`, `401`, `403`, `404` |
| `bank-state` | `POST` | `FACULTY`, `ADMIN` | `bank`, `state` (`SUBMITTED`, `APPROVED`, `REJECTED`, `DRAFT`, `ARCHIVED`) | `200`, `400`, `401`, `403`, `404`, `409` |
| `publish` | `POST` | `ADMIN` | `bank`, `title`, `instructions`, `mode`, `duration`, `attempts`, `opens`, `closes`, `pass`, `easy`, `medium`, `hard`, `groups` | `200`, `400`, `401`, `403`, `404`, `409` |
| `exams` | `GET` | `STUDENT`, `ADMIN`, `OBSERVER` | None | `200`, `401`, `403` |
| `start` | `POST` | `STUDENT` | `exam` (exam id) | `200`, `401`, `403`, `404`, `409` |
| `attempts` | `GET` | `STUDENT` | `exam` (query param) | `200`, `401`, `403`, `404` |
| `attempt` | `GET` | `STUDENT` | `attempt` (query param) | `200`, `401`, `403`, `404` |
| `answer` | `POST` | `STUDENT` | `attempt`, `position`, `choice` (0-4), `review` (`true`/`false`), `version` | `200`, `400`, `401`, `403`, `404`, `409` |
| `heartbeat` | `POST` | `STUDENT` | `attempt`, `pending` (unsaved count) | `200`, `400`, `401`, `403`, `404` |
| `submit` | `POST` | `STUDENT` | `attempt` | `200`, `401`, `403`, `404` |
| `release` | `POST` | `ADMIN` | `exam` | `200`, `401`, `403`, `404`, `409` |
| `monitor` | `GET` | `ADMIN`, `OBSERVER` | `exam` (query param) | `200`, `401`, `403`, `404` |
| `audit` | `GET` | `ADMIN`, `OBSERVER` | None | `200`, `401`, `403` |

---

### 5. Frontend UI Pages & Interactive Elements

The single-page application (`index.html`) renders tabbed role consoles managed by `switchTab(tabId)`:

1. **Authentication Screen (`#tab-auth`)**:
   - Controls: `#loginUser` (username), `#loginPass` (password), Sign In button triggers `loginStaff()`.
   - Workstation student box: `#studentUsn`, `#studentDob`, `#studentPc`, Submit button triggers `loginStudent()`.
   - Status: Alerts on failure; sets `userDisplay` text and reveals `#logoutBtn` on success.
2. **Admin Dashboard (`#tab-principal`)**:
   - Institutional Setup: Department creation (`#newDeptCode`, `#newDeptName`, button `createDept()`).
   - Account Provisioning: Inputs `#newAccUser`, role selector `#newAccRole` (`HOD`, `COE`, `LAB_ADMIN`), `#newAccDept`, button `createStaffAccount()`.
   - Statistics Cards: Real-time totals for `#pStatDepts`, `#pStatStudents`, `#pStatBanks`, and `#pStatExams`.
3. **Faculty / Department Dashboard (`#tab-hod`)**:
   - Question Bank Authoring: Inputs `#hodSubjectId`, `#hodSession`, `#hodSem`, `#hodBankTitle`, button `createBankHOD()`.
   - Cohort Upload: Textarea `#rosterJsonArea`, `#rosterGroupId`, button `uploadRosterHOD()`.
   - Overview Table: Container `#hodBanksTable` displaying bank ID, status badge, and question counts.
4. **COE / Exam Publishing Dashboard (`#tab-coe`)**:
   - Exam Scheduling: Inputs `#coeCycleId`, `#coeSubjectId`, `#coeDeptId`, `#coeGroupId`, `#coeLab`, `#coeDate`, dropdown `#coeSitting`.
   - Session Operations: `#coeTargetSession`, buttons `selectPaperCOE()`, `finalizeSessionCOE()`, `exportPackageCOE()`.
   - Sittings Table: `#coeSessionsTable` showing live scheduled sessions.
5. **Student Exam Runner Portal (`#tab-studentExam`)**:
   - Header Bar: Candidate details `#studentCandidateTag`, assigned version badge `#studentVersionBadge`, countdown timer `#examTimer`.
   - Interactive Palette & Prompt: Container `#examQuestionArea`, question number `#currentQNum`, UID `#currentQUid`, question prompt `#currentQPrompt`.
   - Options Palette: Container `#currentQOptions` rendering `.option-btn` (selected gets `.selected`).
   - Controls: Previous button `prevQuestion()`, Next button `nextQuestion()`, Submit button `submitExam()`.
   - Confirmation: Container `#examSubmittedArea` with confirmation receipt code `#submitConfirmCode`.
6. **Observer / Proctor Live Monitor (`#tab-lab` & `#tab-audit`)**:
   - Surveillance: Lab session activation `#labSessionId`, button `activateLab()`, export button `evaluateAndExportLab()`.
   - Audit Trail: Viewer `#auditTableArea` with live timestamped entries, actor IDs, actions, and details.

---

### 6. Critical Validation & Edge Cases to Test

1. **Authentication & Session Tokens**:
   - Missing or malformed `Authorization` header on protected endpoints -> `401 Unauthorized`.
   - Passwords shorter than 8 or longer than 128 characters -> `400 Bad Request`.
   - Expired tokens or invalid hashes -> `401 Unauthorized`.
2. **RBAC & Department Scoping**:
   - Student calling administrative routes (`/groups`, `/subjects`, `/accounts`, `/publish`) -> `403 Forbidden`.
   - Faculty attempting to create a bank for a group/subject outside their `faculty_scope` -> `403 Forbidden`.
   - Observer attempting to release an exam (`POST /release`) or start an exam (`POST /start`) -> `403 Forbidden`.
3. **Question Bank State Transitions**:
   - Adding a question to a bank not in `DRAFT` state -> `409 Conflict`.
   - Submitting an empty question bank (0 questions) -> `409 Conflict`.
   - Duplicate question prompt within the same bank -> `409 Conflict`.
   - Non-admin user attempting to transition bank to `APPROVED` or `ARCHIVED` -> `409 Conflict`.
4. **Exam Publication Pre-Conditions**:
   - Publishing with a bank in `DRAFT` or `SUBMITTED` state (not `APPROVED`) -> `409 Conflict`.
   - Question pool shortage: requesting more questions of a difficulty than exist in the bank -> `409 Conflict`.
   - Invalid passing score: `pass_marks > sum(marks)` of selected questions -> `400 Bad Request`.
   - Zero eligible candidates: publishing to a group containing 0 registered students -> `409 Conflict`.
   - Official mode rule: setting `attempts > 1` when `mode=OFFICIAL` -> `400 Bad Request`.
5. **Student Examination & Concurrency**:
   - Starting an exam before `opens` or after `closes` window -> `409 Conflict`.
   - Attempting an exam not assigned to the student's group -> `404 Not Found`.
   - Accessing another student's attempt -> `404 Not Found`.
   - Optimistic Concurrency Conflict: `POST /answer` with a stale `version` (less than or equal to existing database version for different choice) -> `409 Conflict`.
   - Answering after submission: calling `POST /answer` on an already submitted attempt -> returns status `"SUBMITTED"` without updating answers.
   - Releasing premature scores: Admin calling `POST /release` before the `closes` timestamp or while unsubmitted attempts remain open -> `409 Conflict`.
