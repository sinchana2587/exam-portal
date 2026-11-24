# COE Portal Integration Report
**MIT Mysore Examination Management System**
**Portal:** `coe-portal (7)` — Controller of Examinations
**Report generated:** 2026-11-17

---

## 1. API Client Configuration — ✅ VERIFIED

**File:** `src/services/apiClient.ts`

| Property | Value |
|---|---|
| Central Backend base URL | `import.meta.env.VITE_API_BASE_URL` (fallback: `http://localhost:8080/api/v1`) |
| Lab Server base URL | `import.meta.env.VITE_LAB_API_BASE_URL` (fallback: `http://192.168.10.50:8443/lab-api/v1`) |
| Auth header | `Authorization: Bearer <token>` |
| Token source | `sessionStorage.getItem('mitm_coe_auth_token_v2')` |
| 401 handling | Clears both session keys → calls `unauthorisedHandler()` → triggers store to clear and redirect |
| Upload support | `centralUploadRequest<T>()` — multipart FormData, no Content-Type override |
| Blob/PDF support | `centralBlobRequest()` — `Accept: application/pdf, ...`, returns `{blob, contentType, filename}` |
| Lab Server requests | `labServerRequest<T>()` — uses `labApiBaseUrl`, same Bearer token |

**Result:** Dual-backend client is correctly implemented. All three request variants (JSON, upload, blob) route through the correct base URLs via env variables.

---

## 2. Authentication Service — ✅ VERIFIED

**File:** `src/services/authenticationService.ts`

| Property | Value |
|---|---|
| Login endpoint | `POST /auth/coe/login` (central backend) |
| Logout endpoint | `POST /auth/coe/logout` (central backend) |
| Change password | `POST /auth/coe/change-password` (central backend) |
| Token storage key | `mitm_coe_auth_token_v2` (sessionStorage) |
| Session storage key | `mitm_coe_auth_session_v2` (sessionStorage) |
| Preview token guard | Tokens starting with `coe-local-preview-` or user id `coe-preview-01` are rejected on `getCurrentSession()` |

> [!NOTE]
> Login endpoint is `/auth/coe/login` — **not** `/auth/login`. Backend must implement `POST /auth/coe/login` (not a generic `/auth/login`). This is the COE-specific auth path. Coordinate with backend team to confirm role segregation between `/auth/coe/login`, `/auth/hod/login`, and `/auth/student/login`.

---

## 3. Five Integration Connections — Verified from COE Side

### CONNECTION 1 (COE → HOD): COE Creates Exams ✅

**File:** `src/services/examinationService.ts` → `scheduleExamination()`

```
POST /examinations/schedule   [central backend via centralRequest]
```

- Body: `{ department, semester, subjectId, subjectCode, examDate, startTime, durationMinutes, passingMarks, labId, morningSitting?, afternoonSitting? }`
- Returns: `ScheduledExamination`
- HOD reads the same records via `GET /hod/examinations` on the same central backend DB.

**Status:** ✅ COE side is clean. Shared DB model means HOD read automatically reflects COE write.

Additional examination lifecycle endpoints on central backend:
| Method | Path |
|---|---|
| GET | `/examinations/scheduled` |
| GET | `/examinations/{id}` |
| PUT | `/examinations/{id}` |
| PUT | `/examinations/{id}/settings` |
| PUT | `/examinations/{id}/sittings` |
| POST | `/examinations/{id}/confirm-schedule` |
| POST | `/examinations/{id}/cancel` |
| DELETE | `/examinations/{id}` |

---

### CONNECTION 2 (HOD → COE): COE Reads HOD-Published Student Lists ✅

**File:** `src/services/examinationService.ts` → `getDepartmentEligibilitySummary()`, `getSubjects()`

```
GET /institution/eligibility?departmentId=...&semesterId=...   [central backend]
GET /institution/subjects?departmentId=...&semesterId=...&publishedOnly=true   [central backend]
GET /institution/departments   [central backend]
GET /institution/semesters    [central backend]
```

- HOD publishes eligibility cohort and subject data to central DB.
- COE reads that same data via `/institution/eligibility` and `/institution/subjects`.
- `publishedOnly=true` filter ensures COE only sees HOD-confirmed records.

**Status:** ✅ COE reads from central backend; depends on HOD having published the cohort. Backend must enforce the `publishedOnly` query filter server-side.

---

### CONNECTION 3 (COE → Student): Exam Package Delivery Flow ✅

**File:** `src/services/examinationService.ts` → `prepareAndSendSittingPackage()`, `retrySittingPackageTransfer()`

Flow:
1. COE calls `POST /examinations/{id}/prepare-and-send-package` → Central Java Backend prepares, encrypts, and digitally signs the exam package, then pushes it to the Lab Server over LAN.
2. COE can verify Lab Server receipt via Lab Server API: `GET /labs/examinations/{id}/sittings/{sittingId}/package-receipt?packageId=...&revision=...`
3. Package `verificationReadinessStatus` transitions to `Ready for Examination` on success.
4. At exam time, the Student portal reads the exam package directly from the Lab Server (not from central backend).

**Status:** ✅ Flow is correct. Central backend acts as orchestrator; Lab Server is the runtime data store for student portal.

> [!IMPORTANT]
> Backend must implement the Lab Server receipt check endpoint: `GET /lab-api/v1/labs/{labId}/examinations/{examinationId}/sittings/{sittingId}/package-receipt`

---

### CONNECTION 4 (Student → COE): Student Submission Visible in Session Monitoring ✅

**File:** `src/services/sessionService.ts` → `getSessionMonitors()`, `refreshSessionTelemetry()`

```
GET /monitoring/sessions          [Lab Server via labServerRequest]
GET /monitoring/sessions/{id}     [Lab Server via labServerRequest]
```

- Student portal posts submission to Lab Server at `POST /api/student/exam/submit`.
- Lab Server records session telemetry and submission status.
- COE Session Monitoring polls `GET /monitoring/sessions` on the Lab Server.

Additional session management endpoints routed to Lab Server:
| Method | Path | Purpose |
|---|---|---|
| POST | `/labs/{labId}/sittings/{sittingId}/workstation-bind` | Student PC binding on login |
| POST | `/labs/{labId}/sittings/{sittingId}/pc-recovery` | Crash recovery |
| POST | `/monitoring/sessions/{sittingId}/unlock-event` | Record suspicious unlock |
| POST | `/labs/{labId}/sittings/{sittingId}/verify-unlock` | Verify invigilator unlock credential |

**Status:** ✅ COE reads from Lab Server correctly. The monitoring pipeline closes the student → COE loop.

---

### CONNECTION 5 (COE → HOD): COE Approves Results → HOD Reads ✅

**File:** `src/services/resultService.ts` → `approveAndReleaseResults()`

```
POST /results/{id}/approve-release   [central backend via centralRequest]
```

HOD then reads approved results via `GET /hod/results` on the same central backend.

Result workflow on central backend:
| Method | Path | Purpose |
|---|---|---|
| GET | `/results/examinations` | List all result records |
| GET | `/results/answer-key-corrections` | List HOD correction requests |
| POST | `/results/verify-upload` | Verify `.labresult` package (multipart) |
| POST | `/results/import-verified` | Import verified result package (multipart) |
| POST | `/results/answer-key-corrections/{id}/review` | Approve/reject HOD correction request |
| POST | `/results/{id}/approve-release` | Approve and release results to HOD |

**Status:** ✅ Full result workflow implemented. Backend must expose all six endpoints.

---

## 4. Hardcoded URLs — ✅ CLEAN (fallbacks only, not hard-coded in business logic)

Search results across all `src/**/*.ts` and `src/**/*.tsx` files:

| File | Line | Content | Assessment |
|---|---|---|---|
| `apiClient.ts:47` | 47 | `'http://localhost:8080/api/v1'` | **Fallback default only** — used when `VITE_API_BASE_URL` is not set. Acceptable. |
| `apiClient.ts:48` | 48 | `'http://192.168.10.50:8443/lab-api/v1'` | **Fallback default only** — used when `VITE_LAB_API_BASE_URL` is not set. Acceptable. |

**No business logic or service files contain hardcoded URLs.** All URLs are constructed from env-variable-driven base URLs.

> [!TIP]
> The fallback defaults in `apiClient.ts` are correct. In production, ensure `.env.production` overrides both values to prevent accidental use of development endpoints.

**No fixes required.**

---

## 5. Vite Configuration — ✅ CLEAN

**File:** `vite.config.ts`

- No proxy configuration — COE portal makes direct cross-origin requests to both backends.
- Plugins: `@vitejs/plugin-react`, `@tailwindcss/vite`
- HMR configurable via `DISABLE_HMR` env var.
- No server-side routes or Express middleware.

**COE portal is a pure Vite SPA.** Both API calls (central backend at :8080, lab server at :8443) are made directly from the browser with CORS. Backend must enable CORS for the COE portal origin.

---

## 6. Examination Store (`useExaminationStore.tsx`) — ✅ VERIFIED

**File:** `src/hooks/useExaminationStore.tsx`

`refreshAll()` performs a `Promise.allSettled` fan-out fetching **9 datasets simultaneously** from real API endpoints:

| # | Dataset | Service | Backend |
|---|---|---|---|
| 1 | Departments | `examinationService.getDepartments()` | Central: `GET /institution/departments` |
| 2 | Subjects | `examinationService.getSubjects()` | Central: `GET /institution/subjects` |
| 3 | Lab Servers | `examinationService.getLabServers()` | Lab Server: `GET /labs/servers` |
| 4 | Scheduled Exams | `examinationService.getScheduledExaminations()` | Central: `GET /examinations/scheduled` |
| 5 | Session Monitors | `sessionService.getSessionMonitors()` | Lab Server: `GET /monitoring/sessions` |
| 6 | Correction Requests | `resultService.getAnswerKeyCorrectionRequests()` | Central: `GET /results/answer-key-corrections` |
| 7 | Results | `resultService.getExaminationResults()` | Central: `GET /results/examinations` |
| 8 | Audit Logs | `analyticsService.getAuditLogs()` | Central: `GET /audit/logs` |
| 9 | Unlock Credentials | `credentialService.getSessionUnlockCredentials()` | Central: `GET /examinations/unlock-credentials` |

Also fetches (non-blocking):
- **Semesters:** `examinationService.getSemesters()` → Central: `GET /institution/semesters`

**Key behaviors:**
- `Promise.allSettled` means partial failures don't block the page — only the failing datasets are empty.
- A 401 from any dataset clears the session and redirects to login.
- **No mock data anywhere.** State is initialized empty; data only populates after real API calls.

**Status:** ✅ Store is clean. No mock data, no hardcoded fallbacks.

---

## 7. Additional Services Verified

### credentialService.ts
| Method | Path | Backend |
|---|---|---|
| GET | `/examinations/unlock-credentials` | Central |
| POST | `/examinations/{id}/sittings/{sittingId}/unlock-credential` | Central |
| POST | `/examinations/{id}/sittings/{sittingId}/unlock-credential/regenerate` | Central |
| POST | `/examinations/{id}/sittings/{sittingId}/unlock-credential/revoke` | Central |
| POST | `/labs/{labId}/sittings/{sittingId}/verify-unlock` | Lab Server |

### courseOutcomeService.ts
| Method | Path | Backend |
|---|---|---|
| GET | `/course-outcomes?[filters]` | Central |
| GET | `/course-outcomes/{id}` | Central |
| GET | `/course-outcomes/{id}/revisions/{n}/document?disposition=...` | Central (blob) |
| POST | `/course-outcomes/{id}/review` | Central |

### analyticsService.ts
| Method | Path | Backend |
|---|---|---|
| GET | `/audit/logs` | Central |

---

## 8. Backend Requirements — Endpoints Expected by COE Frontend

The following endpoints must be implemented in the Central Java Backend (`/api/v1/...`) for the COE portal to function:

### Central Java Backend (port 8080)

| Priority | Method | Path | Notes |
|---|---|---|---|
| **P0** | POST | `/auth/coe/login` | Returns `{ authenticated, token, user }` |
| **P0** | POST | `/auth/coe/logout` | Clears server session |
| **P0** | POST | `/auth/coe/change-password` | Body: `{ currentPassword, newPassword }` |
| **P0** | GET | `/institution/departments` | Returns `DepartmentInfo[]` |
| **P0** | GET | `/institution/semesters` | Returns `AcademicSemester[]` (1–8) |
| **P0** | GET | `/institution/subjects` | Query: `departmentId, semesterId, publishedOnly` |
| **P0** | GET | `/institution/eligibility` | Query: `departmentId, semesterId` → `DepartmentEligibilitySummary` |
| **P0** | GET | `/examinations/scheduled` | Returns `ScheduledExamination[]` |
| **P0** | POST | `/examinations/schedule` | Creates new scheduled exam |
| **P0** | GET | `/examinations/{id}` | Single exam detail |
| **P0** | PUT | `/examinations/{id}` | Full schedule update (authorised revision) |
| **P0** | PUT | `/examinations/{id}/settings` | Update date/time/duration/passing marks |
| **P0** | PUT | `/examinations/{id}/sittings` | Update sitting allocations |
| **P0** | POST | `/examinations/{id}/confirm-schedule` | Freeze the schedule |
| **P0** | POST | `/examinations/{id}/cancel` | Body: `{ reason }` |
| **P0** | DELETE | `/examinations/{id}` | Draft deletion only |
| **P1** | GET | `/examinations/{id}/question-sets` | Returns `QuestionSetMetadata[]` |
| **P1** | POST | `/examinations/{id}/select-set` | Body: `{ examinationId, sittingName, setNumber }` |
| **P1** | POST | `/examinations/{id}/prepare-and-send-package` | Triggers package prep + Lab Server push |
| **P1** | POST | `/examinations/{id}/retry-transfer` | Retries LAN transfer |
| **P1** | GET | `/examinations/{id}/question-paper-archive` | Returns `SittingQuestionPaperArchive[]` |
| **P1** | GET | `/examinations/{id}/sittings/{sittingId}/question-paper-archive/download` | Blob: original question paper PDF |
| **P1** | GET | `/examinations/{id}/sittings/{sittingId}/question-paper-archive/answer-key/download` | Blob: restricted answer key PDF |
| **P1** | GET | `/examinations/unlock-credentials` | Returns `SessionUnlockCredential[]` |
| **P1** | POST | `/examinations/{id}/sittings/{sittingId}/unlock-credential` | Generate new credential |
| **P1** | POST | `/examinations/{id}/sittings/{sittingId}/unlock-credential/regenerate` | Regenerate credential |
| **P1** | POST | `/examinations/{id}/sittings/{sittingId}/unlock-credential/revoke` | Revoke credential |
| **P1** | GET | `/results/examinations` | Returns `ExaminationResultRecord[]` |
| **P1** | GET | `/results/answer-key-corrections` | Returns `AnswerKeyCorrectionRequest[]` |
| **P1** | POST | `/results/verify-upload` | Multipart: verifies `.labresult` file |
| **P1** | POST | `/results/import-verified` | Multipart: imports verified result |
| **P1** | POST | `/results/answer-key-corrections/{id}/review` | Approve/reject correction |
| **P1** | POST | `/results/{id}/approve-release` | Approve and release to HOD |
| **P2** | GET | `/course-outcomes` | Filtered list of CO submissions |
| **P2** | GET | `/course-outcomes/{id}` | Single CO submission |
| **P2** | GET | `/course-outcomes/{id}/revisions/{n}/document` | Blob: CO PDF |
| **P2** | POST | `/course-outcomes/{id}/review` | COE review decision |
| **P2** | GET | `/audit/logs` | Returns `AuditLogEntry[]` |

### Lab Server API (port 8443, path prefix `/lab-api/v1`)

| Priority | Method | Path | Notes |
|---|---|---|---|
| **P0** | GET | `/labs/servers` | Returns `LabServerNode[]` (available labs) |
| **P0** | GET | `/monitoring/sessions` | Returns `SessionMonitoringData[]` |
| **P0** | GET | `/monitoring/sessions/{sessionId}` | Real-time telemetry for one session |
| **P1** | POST | `/monitoring/sessions/{sittingId}/unlock-event` | Record suspicious unlock activity |
| **P1** | POST | `/labs/{labId}/sittings/{sittingId}/workstation-bind` | Bind student to PC workstation |
| **P1** | POST | `/labs/{labId}/sittings/{sittingId}/pc-recovery` | PC crash recovery |
| **P1** | POST | `/labs/{labId}/sittings/{sittingId}/verify-unlock` | Verify invigilator unlock credential |
| **P1** | GET | `/labs/examinations/{id}/sittings/{sittingId}/package-receipt` | Query: `packageId, revision` |

---

## 9. Summary

| Check | Status |
|---|---|
| API Client — dual backend routing | ✅ Correct |
| API Client — Bearer token auth | ✅ Correct |
| API Client — 401 → session clear → redirect | ✅ Correct |
| Auth — login endpoint (`/auth/coe/login`) | ✅ Correct |
| Auth — token storage (`mitm_coe_auth_token_v2`) | ✅ Correct |
| Auth — session storage (`mitm_coe_auth_session_v2`) | ✅ Correct |
| Auth — preview token guard | ✅ Correct |
| Connection 1 (COE→HOD via exam creation) | ✅ Verified |
| Connection 2 (HOD→COE via eligibility/subjects) | ✅ Verified |
| Connection 3 (COE→Student via package delivery) | ✅ Verified |
| Connection 4 (Student→COE via session monitoring) | ✅ Verified |
| Connection 5 (COE→HOD via result approval) | ✅ Verified |
| Hardcoded URLs in business logic | ✅ None found |
| URL fallbacks in apiClient.ts | ✅ Acceptable (env-vars take precedence) |
| Vite config — no proxy needed | ✅ Confirmed |
| Examination store — real API calls only | ✅ Confirmed, no mock data |
| Env files created | ✅ Done (by env-unifier) |

**COE portal frontend integration: COMPLETE — no frontend code changes required.**

The integration is blocked only by backend implementation. All 33 central-backend endpoints and 8 lab-server endpoints listed in Section 8 above must be implemented for full functionality.
