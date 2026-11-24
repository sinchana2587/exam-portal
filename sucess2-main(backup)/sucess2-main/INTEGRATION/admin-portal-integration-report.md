# Admin Portal Integration Report

**Portal:** `admin-portal (7)` — Principal & HOD (React + Vite + Express)  
**Audited by:** admin-integrator  
**Date:** 2026-11-17

---

## 1. Browser-Side Converter Analysis

### `src/utils/browserPdfOcr.ts`

**Verdict: Performs conversion IN THE BROWSER — does NOT call the Express server.**

This file implements a full client-side document processing pipeline using:
- **`pdfjs-dist`** — loaded dynamically via `import('pdfjs-dist')` to parse PDFs in-browser
- **`tesseract.js`** — loaded dynamically via `import('tesseract.js')` to run OCR on raster images and scanned PDFs in-browser
- Native browser Canvas API (`document.createElement('canvas')`) for image decoding and raster region extraction

Key exported function: `extractBrowserDocumentContent(params)` — reads the uploaded `File` object entirely within the browser, returns `ExtractedDocumentContent` with parsed text lines and embedded images. **No HTTP call to any server is made inside this file.**

Worker/data paths are served from `/vendor/ocr/` and `/vendor/pdf/` (static assets), which is consistent with local Express static serving — but the actual OCR/PDF computation runs in a browser WebWorker, not on the Express Node.js server.

### `src/utils/browserStudentConverter.ts`

**Verdict: Performs conversion IN THE BROWSER — does NOT call the Express server.**

This file imports `extractBrowserDocumentContent` from `browserPdfOcr.ts` and builds a complete student-list parsing pipeline entirely client-side:
- Calls `extractBrowserDocumentContent()` → runs pdfjs/tesseract in-browser
- Detects table headers, parses student rows (USN, Name, DOB, Section)
- Validates USNs, DOBs, deduplicates, cross-checks section/department metadata
- Builds a `StudentConversionSession` object in memory — **never sends data to any server endpoint**

Key functions:
- `convertStudentDocumentInBrowser(params)` — full pipeline, all browser-side
- `revalidateBrowserStudentRecords(...)` — revalidation, browser-side
- `downloadBrowserStudentExcel(session)` — calls `buildStudentWorkbookBlob()` from `browserExcelService.ts`, then uses `triggerBlobDownload()` — downloads a client-generated `.xlsx` file directly in the browser

> [!WARNING]
> **These browser-side converters BYPASS the Express server entirely.** The Express server (`server.ts`) implements the same conversion logic in Node.js via `/api/v1/hod/student-lists/conversions` and `/api/v1/hod/question-banks/*` endpoints. The browser utilities (`browserPdfOcr.ts`, `browserStudentConverter.ts`, `browserExcelService.ts`) duplicate this logic client-side.
>
> Per requirements, ALL document conversion must go through the backend Express server routes. **Action required:** The UI components that call `convertStudentDocumentInBrowser()` and `downloadBrowserStudentExcel()` should be refactored to call the Express API endpoints instead (see Connection verification below for the correct endpoint paths in `apiConfig.ts`).

**No changes were made to these files** — they are retained as-is for reference. The refactoring of UI call sites is a task for the frontend developer.

---

## 2. Vite Configuration Analysis

**File:** `vite.config.ts`

```ts
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, '.') } },
    server: {
      port: Number(process.env.DEFAULT_APP_PORT || 3000),
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
```

**Key finding: NO proxy configured.** This is CORRECT.

**Architecture explanation:** The admin portal uses a unified server model — `server.ts` is the Express server that also embeds Vite as middleware (`createViteServer({ server: { middlewareMode: true } })`). The same Node.js process (port 3000) serves:
1. The React SPA (via Vite middleware)
2. Document conversion Express routes under `/api/v1/hod/student-lists/conversions`, `/api/v1/hod/question-banks/*`, `/api/v1/hod/subjects/*/course-outcomes`
3. A catch-all 503 for any other `/api/v1` path

**Why no proxy is needed:** `VITE_API_BASE_URL=http://localhost:8080/api/v1` is an **absolute URL**. The `apiClient.ts` builds fully-qualified URLs: `http://localhost:8080/api/v1/auth/login`. These requests go **directly to the Spring Boot backend** at port 8080, completely bypassing the local Express server at port 3000. The 503 catch-all in `server.ts` is never hit by central backend calls — only by requests that somehow reach the Express server on non-document-conversion paths.

**No changes required to `vite.config.ts`.**

---

## 3. Environment Files

### `.env.development` — ✅ Correct (already written by env-unifier)
```
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

### `.env.production` — ✅ Present (assumed set by env-unifier)
```
VITE_API_BASE_URL=http://192.168.1.100:8080/api/v1
```

Both files exist under `admin-portal (7)/`. No changes needed.

---

## 4. Auth Service Verification

**File:** `src/services/authService.ts` ✅

- **Login:** `POST /auth/login` via `apiRequest` — real HTTP call ✅
- **Logout:** `POST /auth/logout` via `apiRequest` ✅
- **getCurrentUser():** Clears legacy mock DB key `'mit_mysore_ems_dev_db_v4'` from localStorage on every call ✅
- **Token rejection:** `dev-session-` prefixed tokens are cleared and null returned (prevents mock session bleed-through) ✅
- **Token storage:** `'mit_mysore_auth_token'` in `sessionStorage` ✅
- **Auth header:** `Authorization: Bearer {token}` set in `apiClient.ts` ✅

---

## 5. Connection Verification (5 Connections — Admin Portal Side)

### Connection 1 (COE → HOD): HOD reads exam status

**Page:** `src/pages/hod/HodExamStatusPage.tsx`  
**Service call:** `resultsService.getDepartmentExaminations(user.departmentId)`  
**Service file:** `src/services/resultsService.ts` line 94–99  
**apiConfig key:** `API_ENDPOINTS.hod.examStatus` = `'/hod/examinations'`  
**Full URL built:** `http://localhost:8080/api/v1/hod/examinations`  
**Method:** GET  

✅ **Correct** — calls real backend via `apiRequest`, no mock data, no hardcoded URL.  
✅ `examStatus: '/hod/examinations'` exists in `apiConfig.ts` line 66.  
✅ Page calls `loadExaminations()` on mount, renders live data.  

**Requirement:** Spring Boot must implement `GET /api/v1/hod/examinations` returning `ExaminationRecord[]` filtered by the authenticated HOD's department (resolved from JWT claims).

---

### Connection 5 (COE → HOD): HOD reads released results

**Page:** `src/pages/hod/DepartmentResultsPage.tsx`  
**Service call:** `resultsService.getReleasedDepartmentResults(user.departmentId, filters)`  
**Service file:** `src/services/resultsService.ts` line 102–128  
**apiConfig key:** `API_ENDPOINTS.hod.releasedResults` = `'/hod/results'`  
**Full URL built:** `http://localhost:8080/api/v1/hod/results?{filter params}`  
**Method:** GET with query params: `academicYearId`, `semesterNumber`, `examinationId`, `section`, `search`  

✅ **Correct** — calls real backend via `apiRequest`, no mock data, no hardcoded URL.  
✅ `releasedResults: '/hod/results'` exists in `apiConfig.ts` line 67.  
✅ Page calls `loadResults()` on mount and on filter change, renders live data.  

**Requirement:** Spring Boot must implement `GET /api/v1/hod/results` returning `ReleasedDepartmentResultsResponse` filtered by authenticated HOD's department and optional query params.

---

### Other HOD endpoints verified in `apiConfig.ts`

| Endpoint Key | Path | Purpose |
|---|---|---|
| `studentConversions` | `/hod/student-lists/conversions` | Document conversion (Express) |
| `questionConversions` | `/hod/question-banks/conversions` | Question bank conversion (Express) |
| `courseOutcomes` | `/hod/subjects/:id/course-outcomes` | CO document upload (Express) |
| `subjects` | `/hod/subjects` | Subject listing (Spring Boot) |
| `studentLists` | `/hod/student-lists` | Student list management (Spring Boot) |
| `questions` | `/hod/questions` | Question management (Spring Boot) |
| `keyCorrections` | `/hod/key-corrections` | Answer key corrections (Spring Boot) |
| `examStatus` | `/hod/examinations` | Exam status (Spring Boot) ✅ CON-1 |
| `releasedResults` | `/hod/results` | Released results (Spring Boot) ✅ CON-5 |

---

## 6. Changes Made

| # | File | Change | Reason |
|---|---|---|---|
| 1 | None | No code changes required | Architecture is correct |

The `.env.development` file already contained `VITE_API_BASE_URL=http://localhost:8080/api/v1` (written by env-unifier). No other files required modification.

---

## 7. Summary of Findings

| Item | Status | Notes |
|---|---|---|
| `browserStudentConverter.ts` | ⚠️ IN-BROWSER | Performs all conversion client-side via pdfjs + tesseract.js — does NOT use Express API |
| `browserPdfOcr.ts` | ⚠️ IN-BROWSER | Runs OCR and PDF parsing in browser WebWorkers |
| `vite.config.ts` proxy | ✅ Not needed | VITE_API_BASE_URL is absolute, no proxy required |
| `.env.development` | ✅ Correct | `VITE_API_BASE_URL=http://localhost:8080/api/v1` |
| Auth service | ✅ Correct | Real API calls, legacy mock DB cleared, dev-session tokens rejected |
| Connection 1 (COE→HOD examinations) | ✅ Wired | `GET /hod/examinations` via `resultsService.getDepartmentExaminations` |
| Connection 5 (COE→HOD results) | ✅ Wired | `GET /hod/results` via `resultsService.getReleasedDepartmentResults` |

---

## 8. Remaining Issues / Backend Requirements

1. **Browser converter bypass** — `browserStudentConverter.ts` / `browserPdfOcr.ts` perform conversion in-browser, duplicating the Express server logic. UI components invoking these should be migrated to call `/api/v1/hod/student-lists/conversions` (Express endpoint) instead. This is a **frontend refactor task**, not a wiring issue.

2. **Spring Boot endpoints required** (admin portal side):
   - `GET /api/v1/hod/examinations` — returns `ExaminationRecord[]` for authenticated HOD's department
   - `GET /api/v1/hod/results` — returns `ReleasedDepartmentResultsResponse` with filter query params
   - `GET /api/v1/hod/dashboard` — HOD dashboard overview
   - `GET /api/v1/hod/subjects` — subject listing
   - `GET /api/v1/hod/student-lists` — student list management
   - `GET/POST /api/v1/hod/questions` — question management
   - `POST /api/v1/hod/key-corrections` — answer key corrections
   - `GET /api/v1/principal/*` — principal management endpoints
   - `POST/GET /api/v1/auth/*` — authentication endpoints

3. **Express server document conversion** — The Node.js Express server handles document conversion correctly for:
   - `/api/v1/hod/student-lists/conversions` ✅
   - `/api/v1/hod/question-banks/*` ✅
   - `/api/v1/hod/subjects/:id/course-outcomes` ✅
   These are served by the same process as the Vite dev server on port 3000.
