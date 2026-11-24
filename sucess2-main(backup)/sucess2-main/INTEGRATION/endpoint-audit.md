# MIT Mysore EMS — Complete Endpoint Audit

**Generated:** 2026-11-17  
**Auditor agent:** auditor  
**Scope:** All three portals — admin-portal (7), coe-portal (7), student-portal (Final)

---

## 1. Environment & Auth Configuration Summary

| Portal | Base URL Env Var | Default Value | Token Storage Key | Token Storage | Auth Header |
|---|---|---|---|---|---|
| **Admin Portal** | `VITE_API_BASE_URL` | `/api/v1` | `mit_mysore_auth_token` | `sessionStorage` | `Authorization: Bearer {token}` |
| **COE Portal** | `VITE_API_BASE_URL` | `http://localhost:8080/api/v1` | `mitm_coe_auth_token_v2` | `sessionStorage` | `Authorization: Bearer {token}` |
| **COE Portal (Lab)** | `VITE_LAB_API_BASE_URL` | `http://192.168.10.50:8443/lab-api/v1` | _(same token)_ | `sessionStorage` | `Authorization: Bearer {token}` |
| **Student Portal** | `VITE_API_URL` / `VITE_LAB_API_BASE_URL` | `http://localhost:8080` | `mitm_student_active_session_token_v1` | `sessionStorage` + `localStorage` | `Authorization: Bearer {token}` |

### Session Storage Keys (full list)

| Portal | Key | Purpose |
|---|---|---|
| Admin | `mit_mysore_auth_token` | Bearer JWT |
| Admin | `mit_mysore_auth_session` | Serialized `AuthUser` object |
| COE | `mitm_coe_auth_token_v2` | Bearer JWT |
| COE | `mitm_coe_auth_session_v2` | Serialized `AuthResponse` object |
| Student | `mitm_student_active_session_token_v1` | Bearer JWT (both sessionStorage + localStorage) |
| Student | `mitm_emgr_instructor_token_v1` | Instructor emergency-recovery token |

### Hardcoded URLs / Values Found

| Portal | File | Hardcoded value | Notes |
|---|---|---|---|
| Admin | `apiConfig.ts` | `/api/v1` (fallback) | Only used if `VITE_API_BASE_URL` not set |
| COE | `apiClient.ts` | `http://localhost:8080/api/v1` (centralRaw fallback) | Dev fallback |
| COE | `apiClient.ts` | `http://192.168.10.50:8443/lab-api/v1` (labRaw fallback) | Lab server hardcoded LAN IP |
| Student | `api/client.ts` | `http://localhost:8080` (fallback) | Dev fallback |
| Student | `securityService.ts` | `MIT@CBT2026` | INVIGILATOR_SECRET_PASSWORD — hardcoded, security risk |
| Student | `emergencyRecoveryService.ts` | `EMGR-LOGIN-01` / `ProTick-0011` | Fixed recovery credentials — plaintext |
| Student | `emergencyRecoveryService.ts` | `lab` / `lab@123` | Alt instructor credentials — plaintext |

---

## 2. Admin Portal Endpoints

**Base URL:** `{VITE_API_BASE_URL}` (default: `/api/v1`, prod: `http://192.168.1.100:8080/api/v1`)  
**Auth header:** `Authorization: Bearer {token}` from `sessionStorage['mit_mysore_auth_token']`

### 2.1 authService.ts — Authentication

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| A-01 | POST | `/auth/login` | authService.ts | Authenticate user (Principal/HOD) | No | `{username, password}` | `{user: AuthUser, token: string}` |
| A-02 | POST | `/auth/logout` | authService.ts | End server session, clear token | Yes | _(none)_ | _(void)_ |
| A-03 | PATCH | `/auth/profile` | authService.ts | Update contact number | Yes | `{contactNumber: string}` | `AuthUser` |
| A-04 | POST | `/auth/change-password` | authService.ts | Change password with policy validation | Yes | `{currentPassword, newPassword}` | `{message: string}` |
| A-05 | PATCH | `/auth/preferences/theme` | authService.ts | Update theme preference | Yes | `{themePreference: string}` | `AuthUser` |

### 2.2 principalService.ts — Principal Role

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| A-06 | GET | `/principal/dashboard` | principalService.ts | Principal dashboard overview | Yes | — | `PrincipalDashboardData` (summary, examinationActivity[], recentActivities[]) |
| A-07 | GET | `/principal/hods` | principalService.ts | List all HOD accounts + departments | Yes | — | `{departments: Department[], hodAccounts: HodAccountRecord[]}` |
| A-08 | POST | `/principal/hods` | principalService.ts | Create HOD + Department | Yes | `{fullName, employeeId, email, contactNumber, departmentName, departmentCode}` | `{department: Department, hodAccount: HodAccountRecord}` |
| A-09 | PATCH | `/principal/hods/{id}` | principalService.ts | Update HOD account details | Yes | `{fullName, email, contactNumber, designation?}` | `HodAccountRecord` |
| A-10 | PATCH | `/principal/hods/{id}/status` | principalService.ts | Toggle HOD account active/inactive | Yes | `{status: AccountStatus}` | `HodAccountRecord` |
| A-11 | POST | `/principal/departments/{deptId}/replace-hod` | principalService.ts | Replace HOD for a department | Yes | `{fullName, employeeId, email, contactNumber, reason}` | `HodAccountRecord` |
| A-12 | GET | `/principal/reports/results` | principalService.ts | Institution-wide results report (filterable) | Yes | QP: `academicYearId?, departmentId?, semesterNumber?, examinationId?` | `InstitutionReportsData` |

> **Note:** `GET /principal/reports/export` and `GET /principal/audit-logs` are defined in apiConfig.ts but not called by principalService.ts (may be called from UI components directly or not yet implemented).

### 2.3 resultsService.ts — HOD Dashboard & Results

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| A-13 | GET | `/hod/dashboard` | resultsService.ts | HOD dashboard overview | Yes | — | `HodDashboardData` (dept, summary, semesterOverview[]) |
| A-14 | GET | `/hod/examinations` | resultsService.ts | HOD view of department examinations (created by COE) | Yes | — | `ExaminationRecord[]` — **CONNECTION 1** |
| A-15 | GET | `/hod/results` | resultsService.ts | HOD view of COE-released results | Yes | QP: `academicYearId?, semesterNumber?, examinationId?, section?, search?` | `ReleasedDepartmentResultsResponse` — **CONNECTION 5** |

### 2.4 studentService.ts — Student List Management (HOD)

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| A-16 | GET | `/hod/academic-context` | studentService.ts | HOD's department, academic years, semesters, sections | Yes | — | `AcademicContextData` |
| A-17 | POST | `/hod/academic-context/sections` | studentService.ts | Add section to a semester | Yes | `{semesterNumber, name}` | `DepartmentSectionConfig` |
| A-18 | GET | `/hod/student-lists` | studentService.ts | Get student list revisions for semester+section | Yes | QP: `semesterNumber, section` | `StudentListRevision[]` — **CONNECTION 2** |
| A-19 | POST | `/hod/student-lists/validate-usns` | studentService.ts | Validate USNs for cross-section conflicts | Yes | `{semesterNumber, section, usns: string[]}` | `Record<string, string>` |
| A-20 | POST | `/hod/student-lists/upload` | studentService.ts | Upload new student list | Yes | `{academicYearId, semesterNumber, section, fileName, sourceType, rows[]}` | `StudentListRevision` |
| A-21 | POST | `/hod/student-lists/replace` | studentService.ts | Replace existing student list | Yes | `{academicYearId, semesterNumber, section, fileName, sourceType, rows[]}` | `StudentListRevision` |
| A-22 | POST | `/hod/student-lists/student` | studentService.ts | Add individual student record | Yes | `{academicYearId, semesterNumber, section, usn, studentName, dob}` | `StudentListRevision` |
| A-23 | PATCH | `/hod/students/{id}` | studentService.ts | Update individual student record | Yes | `{usn, studentName, dob}` | `StudentListRevision` |
| A-24 | DELETE | `/hod/students/{id}` | studentService.ts | Remove individual student record | Yes | — | `StudentListRevision` |

### 2.5 subjectService.ts — Subject Management (HOD)

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| A-25 | GET | `/hod/subjects` | subjectService.ts | List HOD subjects (filterable by semester) | Yes | QP: `departmentId, semesterNumber?` | `Subject[]` |
| A-26 | POST | `/hod/subjects` | subjectService.ts | Create new subject | Yes | `{code, name, semesterNumber, academicYearId, moduleCount, applicableSections[]}` | `Subject` |
| A-27 | PATCH | `/hod/subjects/{id}` | subjectService.ts | Update subject details | Yes | `{code, name, moduleCount, applicableSections[]}` | `Subject` |
| A-28 | PATCH | `/hod/subjects/{id}/status` | subjectService.ts | Change subject status (Active/Inactive) | Yes | `{status: SubjectStatus}` | `Subject` |
| A-29 | DELETE | `/hod/subjects/{id}` | subjectService.ts | Delete subject | Yes | — | `{deletedId: string}` |

### 2.6 questionService.ts — Question Bank (HOD)

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| A-30 | GET | `/hod/questions` | questionService.ts | Get questions for a subject | Yes | QP: `subjectId` | `QuestionItem[]` |
| A-31 | POST | `/hod/questions` | questionService.ts | Add single question | Yes | `QuestionInputPayload` (subjectId, moduleNumber, questionText, optionA-D, correctOption, images?)` | `QuestionItem` |
| A-32 | PATCH | `/hod/questions/{questionId}` | questionService.ts | Edit question | Yes | `Omit<QuestionInputPayload, 'subjectId'>` | `QuestionItem` |
| A-33 | PATCH | `/hod/questions/{questionId}/status` | questionService.ts | Set question Active/Inactive | Yes | `{status: QuestionStatus}` | `QuestionItem` |
| A-34 | POST | `/hod/question-banks/import` | questionService.ts | Bulk import questions | Yes | `{subjectId, selectedModuleNumber, rows[], sourceLabel}` + headers `x-hod-user-id, x-hod-department-id, x-hod-department-code` | `{importedCount, skippedDuplicates, assignedQuestionIds[]}` |
| A-35 | GET | `/hod/subjects/{subjectId}/question-sets` | questionService.ts | Get publication history / blueprint sets | Yes | — | `QuestionPublicationRevision[]` |
| A-36 | POST | `/hod/subjects/{subjectId}/question-sets` | questionService.ts | Generate numbered question sets (server-side) | Yes | `PaperBlueprint` (moduleDistribution) | `HodSetGenerationSummary` |
| A-37 | POST | `/hod/subjects/{subjectId}/question-sets/publish` | questionService.ts | Publish generated sets to COE | Yes | `{generationId, notes}` | `QuestionPublicationRevision` |
| A-38 | GET | `/hod/subjects/{subjectId}/question-sets/coe-composition` | questionService.ts | COE-only: get published set composition | COE only | — | `{revisionNumber, setsGeneratedCount, numberedSets[]}` |

### 2.7 documentConversionService.ts — PDF/Image→Excel Conversion (LOCAL Express)

> **⚠️ These endpoints are served by the local Express server (server.ts), NOT the central Java backend.**

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| A-39 | POST | `/hod/student-lists/conversions` | documentConversionService.ts | Upload PDF/image for student list OCR conversion | Yes + HOD context headers | `FormData(file, semesterNumber, section, existingUsnConflicts)` | `StudentConversionSession` |
| A-40 | GET | `/hod/student-lists/conversions/{id}` | documentConversionService.ts | Get student conversion session status | Yes + HOD context headers | — | `StudentConversionSession` |
| A-41 | PUT | `/hod/student-lists/conversions/{id}/records` | documentConversionService.ts | Update extracted student records | Yes + HOD context headers | `{records[], sectionConfirmed, existingUsnConflicts}` | `StudentConversionSession` |
| A-42 | POST | `/hod/student-lists/conversions/{id}/validate` | documentConversionService.ts | Validate conversion records | Yes + HOD context headers | `{records?, sectionConfirmed?, existingUsnConflicts?}` | `StudentConversionSession` |
| A-43 | GET | `/hod/student-lists/conversions/{id}/excel` | documentConversionService.ts | Download converted Excel file | Yes + HOD context headers | — | Blob (xlsx) |
| A-44 | GET | `/hod/student-lists/template` | documentConversionService.ts | Download standard student template | Yes | QP: `departmentCode, semesterNumber, section` | Blob (xlsx) |
| A-45 | POST | `/hod/question-banks/conversions` | documentConversionService.ts | Upload PDF/image for question bank OCR conversion | Yes + HOD context headers | `FormData(file, semesterNumber, subjectId, subjectCode, subjectName, subjectModuleCount, selectedPageRange?, existingQuestionTexts)` | `QuestionConversionSession` |
| A-46 | GET | `/hod/question-banks/conversions/{id}` | documentConversionService.ts | Get question conversion session status | Yes + HOD context headers | — | `QuestionConversionSession` |
| A-47 | PUT | `/hod/question-banks/conversions/{id}/records` | documentConversionService.ts | Update extracted question records | Yes + HOD context headers | `{records[], unassignedImages?, existingQuestionTexts}` | `QuestionConversionSession` |
| A-48 | POST | `/hod/question-banks/conversions/{id}/validate` | documentConversionService.ts | Validate question conversion records | Yes + HOD context headers | `{records?, unassignedImages?, existingQuestionTexts?}` | `QuestionConversionSession` |
| A-49 | GET | `/hod/question-banks/conversions/{id}/excel` | documentConversionService.ts | Download converted question Excel | Yes + HOD context headers | QP: `moduleNumber` | Blob (xlsx) |
| A-50 | GET | `/hod/question-banks/template` | documentConversionService.ts | Download standard question template | Yes | QP: `subjectCode, moduleNumber` | Blob (xlsx) |
| A-51 | POST | `/hod/question-banks/parse-excel` | documentConversionService.ts | Parse Excel question file with images | Yes + HOD context headers | `FormData(file, subjectModuleCount, selectedModuleNumber, existingQuestionTexts)` | `ParsedQuestionExcelResponse` |

**HOD Context Headers** (sent on doc-conversion calls):
```
x-hod-user-id: {actor.id}
x-hod-department-id: {actor.departmentId}
x-hod-department-code: {actor.departmentCode}
x-hod-user-name: {actor.fullName}  (courseOutcomeService only)
```

### 2.8 courseOutcomeService.ts — Course Outcome Documents (LOCAL Express)

> **⚠️ File upload served by local Express server; file download also local.**

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| A-52 | GET | `/hod/subjects/{subjectId}/course-outcomes` | courseOutcomeService.ts | List CO document revisions for a subject | Yes + HOD context headers | — | `CourseOutcomeDocumentRevision[]` |
| A-53 | POST | `/hod/subjects/{subjectId}/course-outcomes` | courseOutcomeService.ts | Upload CO PDF document | Yes + HOD context headers | `FormData(file, semesterNumber, subjectId, subjectCode, subjectName, notes?)` | `{uploadedRevision, revisions[]}` |
| A-54 | GET | `/hod/subjects/{subjectId}/course-outcomes/{docId}/file` | courseOutcomeService.ts | Download CO PDF file | Yes + HOD context headers | — | Blob (pdf) |

### 2.9 keyCorrectionService.ts — Answer Key Corrections (HOD)

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| A-55 | GET | `/hod/key-corrections/eligible-examinations` | keyCorrectionService.ts | List exams eligible for key correction | Yes | — | `ExaminationRecord[]` |
| A-56 | GET | `/hod/key-corrections/examinations/{examinationId}/questions` | keyCorrectionService.ts | Get questions for a specific examination | Yes | — | `QuestionItem[]` |
| A-57 | GET | `/hod/key-corrections` | keyCorrectionService.ts | Get HOD's correction request history | Yes | — | `KeyCorrectionRequest[]` |
| A-58 | POST | `/hod/key-corrections` | keyCorrectionService.ts | Submit answer key correction request | Yes | `{examinationId, questionId, proposedCorrectOption, reason?, evidenceFileName?}` | `KeyCorrectionRequest` |

### 2.10 analyticsService.ts — Analytics (Admin Portal)

> **Note:** `analyticsService.ts` in the admin portal is a pure **client-side** computation service. It takes `StudentExamResult[]` data already fetched and computes analytics locally. It makes **no HTTP calls**.

---

## 3. COE Portal Endpoints

**Central Backend Base URL:** `{VITE_API_BASE_URL}` (default: `http://localhost:8080/api/v1`)  
**Lab Server Base URL:** `{VITE_LAB_API_BASE_URL}` (default: `http://192.168.10.50:8443/lab-api/v1`)  
**Auth header:** `Authorization: Bearer {token}` from `sessionStorage['mitm_coe_auth_token_v2']`

### 3.1 authenticationService.ts — COE Authentication

| # | Method | Path | Backend | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|---|
| C-01 | POST | `/auth/coe/login` | Central | authenticationService.ts | Authenticate COE user | No | `{username, password}` | `AuthResponse {authenticated, token, user}` |
| C-02 | POST | `/auth/coe/logout` | Central | authenticationService.ts | End COE session | Yes | _(none)_ | _(void)_ |
| C-03 | POST | `/auth/coe/change-password` | Central | authenticationService.ts | Change COE password | Yes | `{currentPassword, newPassword}` | `{message: string}` |

### 3.2 examinationService.ts — Examinations (Central Backend)

| # | Method | Path | Backend | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|---|
| C-04 | GET | `/institution/departments` | Central | examinationService.ts | List all departments | Yes | — | `DepartmentInfo[]` |
| C-05 | GET | `/institution/semesters` | Central | examinationService.ts | List all academic semesters | Yes | — | `AcademicSemester[]` |
| C-06 | GET | `/institution/eligibility` | Central | examinationService.ts | Dept eligibility summary (student count per dept+sem) | Yes | QP: `departmentId, semesterId` | `DepartmentEligibilitySummary` — **CONNECTION 2** |
| C-07 | GET | `/institution/subjects` | Central | examinationService.ts | List published subjects by dept+sem | Yes | QP: `departmentId?, semesterId?, publishedOnly=true` | `SubjectInfo[]` |
| C-08 | GET | `/examinations/scheduled` | Central | examinationService.ts | List all scheduled examinations | Yes | — | `ScheduledExamination[]` — **CONNECTION 1, 3** |
| C-09 | POST | `/examinations/schedule` | Central | examinationService.ts | Schedule a new examination | Yes | `CreateScheduledExamInput` | `ScheduledExamination` — **CONNECTION 1, 3** |
| C-10 | GET | `/examinations/{id}` | Central | examinationService.ts | Get single examination detail (precheckRes) | Yes | — | `ScheduledExamination` |
| C-11 | PUT | `/examinations/{id}/settings` | Central | examinationService.ts | Update exam date/time/duration/passingMarks | Yes | `{examDate, startTime, durationMinutes, passingMarks}` | `ScheduledExamination` |
| C-12 | PUT | `/examinations/{id}/sittings` | Central | examinationService.ts | Update sitting allocation (students, sets) | Yes | `UpdateSittingAllocationInput {morningSitting, afternoonSitting}` | `ScheduledExamination` |
| C-13 | POST | `/examinations/{id}/confirm-schedule` | Central | examinationService.ts | Freeze/confirm examination schedule | Yes | _(none)_ | `ScheduledExamination` |
| C-14 | GET | `/examinations/{id}/question-sets` | Central | examinationService.ts | Get published question sets for exam | Yes | — | `QuestionSetMetadata[]` |
| C-15 | POST | `/examinations/{id}/select-set` | Central | examinationService.ts | Select numbered question set for a sitting | Yes | `{examinationId, sittingName, setNumber}` | `ScheduledExamination` |
| C-16 | POST | `/examinations/{id}/prepare-and-send-package` | Central | examinationService.ts | Prepare, encrypt, sign & transfer package to Lab Server | Yes | `{examinationId, sittingId, sittingName, packageRevision, labId}` | `ScheduledExamination` — **CONNECTION 3** |
| C-17 | POST | `/examinations/{id}/retry-transfer` | Central | examinationService.ts | Retry LAN transfer of an already-prepared package | Yes | `{examinationId, sittingId, sittingName, packageId, packageRevision, receiptCheck}` | `ScheduledExamination` |
| C-18 | PUT | `/examinations/{id}` | Central | examinationService.ts | Full schedule update (authorized package revision) | Yes | `UpdateExaminationScheduleInput` | `ScheduledExamination` |
| C-19 | DELETE | `/examinations/{id}` | Central | examinationService.ts | Delete draft examination | Yes | — | `{deletedId: string}` |
| C-20 | POST | `/examinations/{id}/cancel` | Central | examinationService.ts | Cancel an examination | Yes | `{reason: string}` | `ScheduledExamination` |
| C-21 | GET | `/examinations/{id}/question-paper-archive` | Central | examinationService.ts | Get frozen paper archive metadata for completed sitting | Yes | — | `SittingQuestionPaperArchive[]` |
| C-22 | GET | `/examinations/{id}/sittings/{sittingId}/question-paper-archive/download` | Central | examinationService.ts | Download original question paper PDF | Yes | — | Blob (pdf) |
| C-23 | GET | `/examinations/{id}/sittings/{sittingId}/question-paper-archive/answer-key/download` | Central | examinationService.ts | Download restricted answer key PDF (COE only) | Yes | — | Blob (pdf) |

### 3.3 examinationService.ts — Lab Server calls (via labServerRequest)

| # | Method | Path | Backend | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|---|
| C-24 | GET | `/labs/servers` | Lab | examinationService.ts (labService.ts) | List lab server nodes | Yes | — | `LabServerNode[]` |
| C-25 | GET | `/labs/examinations/{examId}/sittings/{sittingId}/package-receipt` | Lab | examinationService.ts | Check if lab received package | Yes | QP: `packageId, revision` | `{alreadyReceived, verified, rejectionReason?}` |

### 3.4 resultService.ts — Results Management

| # | Method | Path | Backend | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|---|
| C-26 | GET | `/results/examinations` | Central | resultService.ts | List all examination result records | Yes | — | `ExaminationResultRecord[]` |
| C-27 | GET | `/results/answer-key-corrections` | Central | resultService.ts | List all HOD key-correction requests | Yes | — | `AnswerKeyCorrectionRequest[]` |
| C-28 | POST | `/results/verify-upload` | Central | resultService.ts | Verify uploaded `.labresult` package | Yes | `FormData(file, examinationId, sittingName)` | `FileVerificationReport` — **CONNECTION 4** |
| C-29 | POST | `/results/import-verified` | Central | resultService.ts | Import verified results into PostgreSQL | Yes | `FormData(file, examinationId, sittingId, sittingName, packageId, packageRevision)` | `ResultImportAcknowledgement` — **CONNECTION 4** |
| C-30 | POST | `/results/answer-key-corrections/{requestId}/review` | Central | resultService.ts | Approve/reject HOD key-correction request | Yes | `{decision, coeDecisionNotes}` | `{updatedRequest, recalculatedStudentCount, scoreChangedCount}` |
| C-31 | POST | `/results/{resultId}/approve-release` | Central | resultService.ts | Approve & release final results | Yes | _(none)_ | `ExaminationResultRecord` — **CONNECTION 5** |

### 3.5 sessionService.ts — Live Monitoring (Lab Server)

| # | Method | Path | Backend | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|---|
| C-32 | GET | `/monitoring/sessions` | Lab | sessionService.ts | Get all active session monitoring data | Yes | — | `SessionMonitoringData[]` — **CONNECTION 4** |
| C-33 | GET | `/monitoring/sessions/{sessionId}` | Lab | sessionService.ts | Get single session telemetry | Yes | — | `SessionMonitoringData` |
| C-34 | POST | `/labs/{labId}/sittings/{sittingId}/workstation-bind` | Lab | sessionService.ts | Associate student login to workstation | Yes | `{examinationId, sittingId, studentUsn, labId, pcId}` | `{binding: ActiveWorkstationBinding, assignedVersion: VersionLetter}` |
| C-35 | POST | `/labs/{labId}/sittings/{sittingId}/pc-recovery` | Lab | sessionService.ts | Trigger PC crash recovery | Yes | `{examinationId, sittingId, labId, studentUsn, targetPcId, operatorIdentity, externalAuthorityVerified, reason}` | `{recoveryRecord, binding, preservedVersion}` |
| C-36 | POST | `/monitoring/sessions/{sittingId}/unlock-event` | Lab | sessionService.ts | Record suspicious activity / unlock event | Yes | `{examinationId, sittingId, studentUsn, pcNumber, eventType, unlockCredentialId, unlockCredentialRevision, invigilatorIdentity, invigilatorOperatorId, unlockReason}` | `SuspiciousActivityRecord` |

### 3.6 courseOutcomeService.ts — CO Review (Central Backend)

| # | Method | Path | Backend | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|---|
| C-37 | GET | `/course-outcomes` | Central | courseOutcomeService.ts | List CO submissions (filterable) | Yes | QP: `department?, semester?, subject?, status?, fromDate?, toDate?` | `CourseOutcomeSubmission[]` |
| C-38 | GET | `/course-outcomes/{id}` | Central | courseOutcomeService.ts | Get single CO submission detail | Yes | — | `CourseOutcomeSubmission` |
| C-39 | GET | `/course-outcomes/{id}/revisions/{revNo}/document` | Central | courseOutcomeService.ts | Fetch/view CO PDF document | Yes | QP: `disposition` (inline/attachment) | Blob (pdf) |
| C-40 | POST | `/course-outcomes/{id}/review` | Central | courseOutcomeService.ts | Review/approve/request-clarification on CO | Yes | `{status, internalReviewNotes?, clarificationNotes?, courseOutcomeStatements[]}` | `CourseOutcomeSubmission` |

### 3.7 credentialService.ts — Session Unlock Credentials

| # | Method | Path | Backend | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|---|
| C-41 | GET | `/examinations/unlock-credentials` | Central | credentialService.ts | List all sitting unlock credentials | Yes | — | `SessionUnlockCredential[]` |
| C-42 | POST | `/examinations/{examId}/sittings/{sittingId}/unlock-credential` | Central | credentialService.ts | Generate new unlock credential (CSPRNG) | Yes | `{examinationId, sittingId}` | `{credential: SessionUnlockCredential, revealOnceSecret: string}` |
| C-43 | POST | `/examinations/{examId}/sittings/{sittingId}/unlock-credential/regenerate` | Central | credentialService.ts | Regenerate/rotate unlock credential | Yes | `{examinationId, sittingId}` | `{credential, revealOnceSecret}` |
| C-44 | POST | `/examinations/{examId}/sittings/{sittingId}/unlock-credential/revoke` | Central | credentialService.ts | Revoke unlock credential | Yes | _(none)_ | `SessionUnlockCredential` |
| C-45 | POST | `/labs/{labId}/sittings/{sittingId}/verify-unlock` | Lab | credentialService.ts | Verify invigilator unlock on Lab Server | Yes | `{candidateSecret, examinationId, sittingId, labId, pcId, studentUsn, invigilatorOperatorId}` | `OfflineUnlockVerificationResult` |

### 3.8 analyticsService.ts — Audit Logs (COE)

| # | Method | Path | Backend | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|---|
| C-46 | GET | `/audit/logs` | Central | analyticsService.ts | Retrieve full audit log | Yes | — | `AuditLogEntry[]` |

---

## 4. Student Portal Endpoints

**Base URL:** `{VITE_API_URL}` or `{VITE_LAB_API_BASE_URL}` (both default to `http://localhost:8080`)  
**Auth header:** `Authorization: Bearer {token}` from `sessionStorage['mitm_student_active_session_token_v1']`  
**Target:** Lab Server only (all endpoints prefixed `/api/...`)

### 4.1 apiConfig.ts (checkBackendHealth)

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| S-01 | GET | `/api/health` | apiConfig.ts | Check if Lab Server is online | No | — | _(any 2xx)_ |

### 4.2 studentAuthService.ts — Student Authentication

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| S-02 | POST | `/api/student/login` | studentAuthService.ts | Student login via USN + DOB | No | `StudentLoginRequest {usn, dob}` | `StudentLoginResponse {student: {sessionToken, ...}}` |
| S-03 | POST | `/api/student/logout` | studentAuthService.ts | End student session | Yes | _(none)_ | _(void)_ |

### 4.3 instructionService.ts — Exam Instructions

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| S-04 | GET | `/api/student/instructions` | instructionService.ts | Get exam instructions (duration, rules, scheme) | Yes | — | `ExaminationInstructions` — **CONNECTION 3** |

### 4.4 examinationSessionService.ts — Session State

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| S-05 | GET | `/api/student/exam-session` | examinationSessionService.ts | Get session eligibility & exam assignment | Yes | — | `ActiveSessionEnvelope {student, examSession, examStarted, submitted, ...}` — **CONNECTION 3** |

### 4.5 timerService.ts — Exam Start & State Sync

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| S-06 | POST | `/api/student/exam/start` | timerService.ts | Start examination (clock begins) | Yes | `StartExamRequest` | `ExamRuntimeStateResponse` |
| S-07 | GET | `/api/student/exam/state` | timerService.ts | Sync authoritative remaining time + saved state | Yes | — | `ExamRuntimeStateResponse` |

### 4.6 questionService.ts — Question Paper

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| S-08 | GET | `/api/student/exam/questions` | questionService.ts | Fetch student's assigned version (A/B/C/D) question paper | Yes | — | `AssignedQuestionPaperResponse` — **CONNECTION 3** |

### 4.7 answerService.ts — Answer Saving

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| S-09 | POST | `/api/student/exam/answers` | answerService.ts | Save/update MCQ answer selection | Yes | `SaveAnswerRequest {studentUsn, sessionId, questionId, selectedOption, isBookmarked}` | `SaveAnswerResponse` |

### 4.8 submissionService.ts — Final Submission

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| S-10 | POST | `/api/student/exam/submit` | submissionService.ts | Submit examination (manual or timer-expired) | Yes | `SubmitExamRequest` | `SubmitExamResponse` — **CONNECTION 4** |

### 4.9 securityService.ts — Security & Anti-Malpractice

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| S-11 | POST | `/api/security/violation` | securityService.ts | Report security violation (tab switch, focus loss) | Yes | `{violationType, label, description, studentUsn, examinationId, currentQuestionIndex, remainingSeconds, answeredCount}` | _(async, fire-and-forget)_ |
| S-12 | POST | `/api/security/unlock` | securityService.ts | Invigilator password unlock verification | No | `{enteredPassword, studentUsn, examinationId}` | `{success, message, state: SecurityLockState}` |
| S-13 | GET | `/api/security/audit-logs` | securityService.ts | Fetch remote security audit logs | Yes | — | `SecurityAuditLogEntry[]` |

### 4.10 emergencyRecoveryService.ts — Instructor Emergency Recovery

| # | Method | Path | Service File | Description | Auth | Request Body | Response Shape |
|---|---|---|---|---|---|---|---|
| S-14 | POST | `/api/instructor/login` | emergencyRecoveryService.ts | Lab Instructor / COE Emergency Recovery login | No | `{recoveryId, recoveryKey}` | `{authenticated, token, instructor: {recoveryId, name}}` |
| S-15 | POST | `/api/instructor/logout` | emergencyRecoveryService.ts | Lab Instructor logout | Instructor token | _(none)_ | _(void)_ |
| S-16 | GET | `/api/recovery/relogin-authorisations` | emergencyRecoveryService.ts | List students needing re-login authorisation | Instructor token | — | `StudentReLoginItem[]` |
| S-17 | POST | `/api/recovery/relogin-authorisations/approve` | emergencyRecoveryService.ts | Approve student re-login (after crash) | Instructor token | `{usn, reason, instructorId?}` | `ReLoginAuthorisationToken` |
| S-18 | POST | `/api/recovery/relogin-authorisations/consume` | emergencyRecoveryService.ts | Consume one-time re-login token (session transfer) | Instructor token | `{usn, newSystemId}` | `SessionTransferRecord` |
| S-19 | GET | `/api/recovery/overview` | emergencyRecoveryService.ts | Student recovery overview for all students | Instructor token | QP: `search?, department?, status?, laboratory?` | `StudentRecoveryOverview[]` |
| S-20 | GET | `/api/recovery/transfers` | emergencyRecoveryService.ts | Session transfer history | Instructor token | — | `SessionTransferRecord[]` |
| S-21 | GET | `/api/recovery/audit-logs` | emergencyRecoveryService.ts | Recovery audit logs | Instructor token | — | `RecoveryAuditLog[]` |
| S-22 | GET | `/api/recovery/config` | emergencyRecoveryService.ts | Get COE emergency recovery config | Instructor token | — | `EmergencyRecoveryConfig` |
| S-23 | PUT | `/api/recovery/config` | emergencyRecoveryService.ts | Update COE recovery credentials/config | Instructor token | `Partial<EmergencyRecoveryConfig>` | `EmergencyRecoveryConfig` |
| S-24 | POST | `/api/recovery/fresh-start` | emergencyRecoveryService.ts | Clear all recovery data (new exam session) | Instructor token | _(none)_ | `{success: boolean, message: string}` |

> **Note:** `labConnectionService.ts` makes **no HTTP calls** — it is a pure local sessionStorage buffer for unsynced answers during LAN interruptions.

---

## 5. Cross-Portal Connections Summary

| Connection | Direction | From | To | Mechanism |
|---|---|---|---|---|
| **CONNECTION 1** | COE→Admin | COE creates exams via `POST /examinations/schedule` | HOD reads via `GET /hod/examinations` | Shared PostgreSQL — central backend |
| **CONNECTION 2** | Admin→COE | HOD uploads students via `POST /hod/student-lists/upload` | COE reads via `GET /institution/eligibility` | Shared PostgreSQL — central backend |
| **CONNECTION 3** | COE→Student | COE schedules + sends package → Lab Server receives | Student reads via `GET /api/student/exam-session`, `/instructions`, `/exam/questions` | Lab Server package contains exam data |
| **CONNECTION 4** | Student→COE | Student submits via `POST /api/student/exam/submit` → `.labresult` file | COE imports via `POST /results/verify-upload` + `/results/import-verified` | File-based transfer + verification |
| **CONNECTION 5** | COE→Admin | COE releases results via `POST /results/{id}/approve-release` | HOD reads via `GET /hod/results` | Shared PostgreSQL — central backend |

---

## 6. Endpoint Count Summary

| Portal | Service File | Endpoint Count |
|---|---|---|
| Admin | authService.ts | 5 |
| Admin | principalService.ts | 7 |
| Admin | resultsService.ts | 3 |
| Admin | studentService.ts | 9 |
| Admin | subjectService.ts | 5 |
| Admin | questionService.ts | 9 |
| Admin | documentConversionService.ts | 13 (LOCAL Express) |
| Admin | courseOutcomeService.ts | 3 (LOCAL Express) |
| Admin | keyCorrectionService.ts | 4 |
| **Admin Total** | | **58** |
| COE | authenticationService.ts | 3 |
| COE | examinationService.ts (Central) | 20 |
| COE | examinationService.ts (Lab) | 2 |
| COE | resultService.ts | 6 |
| COE | sessionService.ts | 5 |
| COE | courseOutcomeService.ts | 4 |
| COE | credentialService.ts | 5 |
| COE | analyticsService.ts | 1 |
| **COE Total** | | **46** |
| Student | apiConfig.ts | 1 |
| Student | studentAuthService.ts | 2 |
| Student | instructionService.ts | 1 |
| Student | examinationSessionService.ts | 1 |
| Student | timerService.ts | 2 |
| Student | questionService.ts | 1 |
| Student | answerService.ts | 1 |
| Student | submissionService.ts | 1 |
| Student | securityService.ts | 3 |
| Student | emergencyRecoveryService.ts | 11 |
| **Student Total** | | **24** |
| **GRAND TOTAL** | | **128 endpoints** |

---

## 7. Key Findings & Security Notes

> [!CAUTION]
> **Hardcoded credentials found in student portal source code:**
> - `securityService.ts` line 14: `INVIGILATOR_SECRET_PASSWORD = 'MIT@CBT2026'` — plaintext password exposed in browser bundle
> - `emergencyRecoveryService.ts` lines 20-22: `EMGR-LOGIN-01` / `ProTick-0011` — recovery credentials in bundle
> - `emergencyRecoveryService.ts` lines 25-28: `lab` / `lab@123` — alternate instructor credentials in bundle
> These must be moved to backend-only verification; the frontend should NEVER hold them.

> [!WARNING]
> **COE portal Lab Server base URL is hardcoded:** `http://192.168.10.50:8443/lab-api/v1` as a fallback in `apiClient.ts`. If the lab IP changes, this requires a code change. Use env var only.

> [!WARNING]
> **Student portal dual-storage:** Auth token is written to BOTH `sessionStorage` AND `localStorage`, meaning the session persists across browser restarts. This may be intentional (crash recovery) but is a security consideration.

> [!NOTE]
> **Admin portal authentication endpoint differs from COE portal:**
> - Admin: `POST /auth/login` (shared Principal+HOD endpoint)
> - COE: `POST /auth/coe/login` (COE-specific endpoint)
> These must be distinct backend routes with separate role validation.

> [!NOTE]
> **Document conversion is local-only (admin portal):** 13 endpoints under `/hod/student-lists/conversions/*`, `/hod/question-banks/conversions/*`, `/hod/question-banks/parse-excel`, and `/hod/subjects/*/course-outcomes` are served by the local Express server (`server.ts`), NOT the central Java backend. The vite.config.ts proxy must route these to `localhost:3001` (or whichever port Express runs on) and all other `/api/v1` paths to the central backend.

> [!NOTE]
> **Student portal has built-in offline fallbacks:** Most `emergencyRecoveryService.ts` calls fall back to localStorage when the backend is unreachable. This means the Lab Server being down does NOT block instructor emergency operations — but it means data may be local-only.

> [!TIP]
> **COE portal uses two separate base URLs:** `centralApiBaseUrl` for the Java Spring Boot backend and `labApiBaseUrl` for the lab server. These are accessed via `apiClient.centralRequest(...)` and `apiClient.labServerRequest(...)` respectively, cleanly separated in `apiClient.ts`.
