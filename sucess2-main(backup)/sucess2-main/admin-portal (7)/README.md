# Maharaja Institute of Technology Mysore — Admin & HOD Portal (Examination Management System)

Administrative examination portal for **Maharaja Institute of Technology Mysore** supporting **Principal** and **Head of Department (HOD)** operations, built with React, TypeScript, Vite, Tailwind CSS v4, and an Express document-processing server designed to integrate with a central Spring Boot / Java REST API.

---

## Table of Contents

1. [Project Overview and Purpose](#1-project-overview-and-purpose)
2. [Technologies and Frameworks Used](#2-technologies-and-frameworks-used)
3. [Complete Project Folder Structure](#3-complete-project-folder-structure)
4. [Installation Instructions](#4-installation-instructions)
5. [Required Dependencies](#5-required-dependencies)
6. [Environment Variable Configuration](#6-environment-variable-configuration)
7. [Development and Production Build Commands](#7-development-and-production-build-commands)
8. [Principal and HOD Portal Architecture](#8-principal-and-hod-portal-architecture)
9. [Authentication and Role-Based Access Structure](#9-authentication-and-role-based-access-structure)
10. [Setup Class and Student Lists Workflows](#10-setup-class-and-student-lists-workflows)
11. [Question Bank and Backend-Based Question Conversion Workflow](#11-question-bank-and-backend-based-question-conversion-workflow)
12. [Course Outcomes Document Submission Workflow](#12-course-outcomes-document-submission-workflow)
13. [Question-Set Generation and Publication Workflow](#13-question-set-generation-and-publication-workflow)
14. [Examination Status and Department Results](#14-examination-status-and-department-results)
15. [API Service Architecture and Backend Integration Requirements](#15-api-service-architecture-and-backend-integration-requirements)
16. [Current Implementation Status and Pending Backend Dependencies](#16-current-implementation-status-and-pending-backend-dependencies)

---

## 1. Project Overview and Purpose

This web application provides the centralized administrative portal for **Maharaja Institute of Technology Mysore** (MIT Mysore) to manage department setup, student eligibility rosters, subject question banks, Course Outcomes documentation, disjoint question-set publication to the Controller of Examinations (COE), examination status monitoring, and COE-released result analytics.

The portal enforces strict role separation between two administrative personas:
- **Principal**: Institution-wide oversight, department & HOD account provisioning/replacement, cross-department COE-released result reports, and institution-wide audit logs.
- **HOD (Head of Department)**: Department-scoped academic setup (Semesters 1–8), section-wise eligible student lists, subject-wise MCQ question banks (manual, Excel import, and backend-driven PDF/image conversion), Course Outcomes PDF submissions, zero-overlap numbered question-set generation & publication to COE, key correction requests, examination tracking, department result analytics, and department audit logs.

---

## 2. Technologies and Frameworks Used

- **Frontend UI & Routing**: React (`^19.0.1`), React DOM (`^19.0.1`), React Router DOM (`^7.18.5`), Lucide React (`^0.546.0`), Motion (`^12.23.24`)
- **Language & Type Checking**: TypeScript (`^7.0.2`) configured with `ES2022`, `moduleResolution: "bundler"`, and `noEmit: true`
- **Styling**: Tailwind CSS (`^4.3.3`) via `@tailwindcss/vite` (`^4.3.3`), using Google Fonts (`Plus Jakarta Sans`, `Public Sans`, `JetBrains Mono`)
- **Build & Dev Tooling**: Vite (`^8.3.0`), `@vitejs/plugin-react` (`^6.1.1`), `tsx` (`^4.21.0`)
- **Backend Document Processing Server**: Express (`^4.21.2`) + `http.createServer` in `server.ts`, Multer (`^2.5.0`) for multipart uploads (`25 MB` file limit)
- **PDF, OCR, Excel & Export Libraries**:
  - `pdfjs-dist` (`^6.5.438`) — PDF text, structure, and embedded XObject/raster extraction (plus local browser worker under `public/vendor/pdf/`)
  - `tesseract.js` (`^7.0.0`) & `@tesseract.js-data/eng` (`^1.0.0`) — OCR processing (plus local browser assets under `public/vendor/ocr/`)
  - `exceljs` (`^4.4.0`), `xlsx` (`^0.18.5`), `jszip` (`^3.10.2`), `pngjs` (`^7.0.0`), `jpeg-js` (`^0.4.4`) — OOXML workbook generation/parsing, embedded cell image reconstruction, and `_ImageMap` metadata handling
  - `jspdf` (`^4.2.1`) & `jspdf-autotable` (`^5.0.9`) — Client-side PDF report generation

---

## 3. Complete Project Folder Structure

```text
.
├── .env.example                            # Environment variable template (no secrets)
├── bun.lock                                # Lockfile
├── index.html                              # SPA HTML shell, OpenGraph metadata & Google Fonts
├── metadata.json                           # Application metadata
├── package.json                            # Scripts and npm dependencies
├── README.md                               # Project documentation
├── server.ts                               # Express API server + Vite dev / dist static host
├── tsconfig.json                           # TypeScript compiler configuration
├── vite.config.ts                          # Vite + React + Tailwind CSS v4 configuration
├── public/
│   ├── assets/
│   │   ├── mit_mysore_logo_circle.png      # Official circular institutional emblem
│   │   └── aistudio/                       # Static visual & reference assets
│   └── vendor/
│       ├── ocr/
│       │   ├── worker.min.js               # Local Tesseract web worker
│       │   ├── core/                       # Tesseract WASM core assets
│       │   └── lang/                       # English OCR language data
│       └── pdf/
│           └── pdf.worker.min.mjs          # Local pdf.js worker
├── server/
│   └── services/
│       ├── excelImageService.ts            # ExcelJS/OOXML workbook builder & embedded image parser
│       ├── pdfAndOcrEngine.ts              # Server-side PDF text/image & Tesseract OCR engine
│       ├── questionExtractor.ts            # Ephemeral question conversion session & validation manager
│       └── studentExtractor.ts             # Ephemeral student conversion session & validation manager
└── src/
    ├── App.tsx                             # Router, RoleGuard, ThemeProvider, AuthProvider
    ├── index.css                           # Tailwind CSS import & custom institutional styling
    ├── main.tsx                            # React application entry point
    ├── components/
    │   ├── AccountMenu.tsx                 # Header user dropdown, theme toggle, sign-out
    │   ├── ConfirmDialog.tsx               # Reusable confirmation modal
    │   ├── ConversionStatusBanner.tsx      # Conversion lifecycle badge & status display
    │   ├── InstitutionLogo.tsx             # Sidebar/mobile institutional logo component
    │   └── StatusBadge.tsx                 # Examination/account/revision status pill
    ├── data/                               # Empty directory (all mock/demo data removed)
    ├── hooks/
    │   ├── useAuth.tsx                     # Authentication context & sessionStorage sync
    │   ├── useHodSemester.tsx              # Shared HOD semester (1–8) state & URL ?semester= sync
    │   └── useTheme.tsx                    # Light/Dark theme state
    ├── layouts/
    │   ├── HodLayout.tsx                   # HOD sidebar/mobile drawer & HodSemesterProvider wrapper
    │   └── PrincipalLayout.tsx             # Principal sidebar/mobile drawer & workspace header
    ├── pages/
    │   ├── LoginPage.tsx                   # Unified Principal & HOD sign-in page
    │   ├── ProfileSettingsPage.tsx         # Profile contact, password policy & theme preferences
    │   ├── hod/
    │   │   ├── DepartmentResultsPage.tsx   # COE-released department results & analytics + exports
    │   │   ├── HodDashboardPage.tsx        # Department KPI cards & 8-semester overview table
    │   │   ├── HodExamStatusPage.tsx       # Read-only department examination & sitting schedule view
    │   │   ├── QuestionsPage.tsx           # Question pool, backend PDF converter, CO PDFs, blueprints & sets
    │   │   └── SetupClassPage.tsx          # Subjects CRUD, sections & student list management
    │   └── principal/
    │       ├── AuditLogsPage.tsx           # Chronological audit viewer (Principal: all depts; HOD: scoped)
    │       ├── HodManagementPage.tsx       # Department + HOD creation, editing, activation & replacement
    │       ├── InstitutionReportsPage.tsx  # Institution-wide COE-released performance reports & exports
    │       └── PrincipalDashboardPage.tsx  # Institution KPI cards & recent exam/audit activity
    ├── services/
    │   ├── analyticsService.ts             # Client-side computation of department result analytics
    │   ├── apiClient.ts                    # Fetch wrapper, Bearer auth, timeout, AbortSignal & blob download
    │   ├── apiConfig.ts                    # API base URL, timeout & endpoint path contracts
    │   ├── auditService.ts                 # Audit log fetching service (Principal & HOD scoped)
    │   ├── authService.ts                  # Login, logout, sessionStorage, contact/password/theme APIs
    │   ├── courseOutcomeService.ts         # Course Outcomes PDF validation, upload, list & download APIs
    │   ├── documentConversionService.ts    # Conversion session, Excel parse & template download APIs
    │   ├── keyCorrectionService.ts         # Eligible exams, exam questions & key-correction request APIs
    │   ├── principalService.ts             # Principal dashboard, HOD management & institution report APIs
    │   ├── questionService.ts              # Question CRUD, dynamic capacity math, set gen & publish APIs
    │   ├── resultsService.ts               # HOD dashboard, exam schedule & released results APIs
    │   ├── studentService.ts               # Academic context, sections, roster revisions & student CRUD APIs
    │   └── subjectService.ts               # Department/semester subject CRUD & status APIs
    ├── types/
    │   └── index.ts                        # Shared TypeScript interfaces & status unions
    └── utils/
        ├── browserExcelService.ts          # Browser-side ExcelJS template & image-enabled .xlsx parser
        ├── browserPdfOcr.ts                # Browser-side pdf.js & Tesseract OCR utility
        ├── browserStudentConverter.ts      # Browser-side Student PDF/Image converter (Setup Class)
        ├── exportUtils.ts                  # Client-side CSV, XLSX & PDF export utilities
        ├── fileHandlers.ts                 # Excel validation helpers for Student Lists & Question Banks
        ├── semesterOptions.ts              # Master Semesters 1–8 definitions & ordinal formatters
        └── usnValidator.ts                 # MIT Mysore / VTU USN format & branch-prefix validator
```

---

## 4. Installation Instructions

### Prerequisites

- **Node.js**: v22.x recommended (aligns with `@types/node` `^22.14.0` and ES2022 target)
- **npm** (or Bun, as `bun.lock` is present)

### Setup Steps

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (optional for local UI/Express startup; required when connecting to the external Java REST backend):
   ```bash
   cp .env.example .env
   ```
   Set `VITE_API_BASE_URL` in `.env` to your Spring Boot / Java REST API base URL if running the backend on a separate host/port, or leave unset to default to `/api/v1`.
3. Verify TypeScript compilation:
   ```bash
   npm run lint
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   The application listens on `http://0.0.0.0:3000` (or the port specified by `DEFAULT_APP_PORT` / `PORT` / `--port`).

---

## 5. Required Dependencies

### Production Dependencies (`package.json`)

| Package | Version | Role in Application |
| --- | --- | --- |
| `react`, `react-dom` | `^19.0.1` | Core UI runtime |
| `react-router-dom` | `^7.18.5` | Role-guarded client-side routing |
| `lucide-react` | `^0.546.0` | UI iconography |
| `motion` | `^12.23.24` | UI transitions/animations |
| `express` | `^4.21.2` | API router (`/api/v1` and `/api`) and Vite/static host |
| `multer` | `^2.5.0` | Multipart file upload handling in `server.ts` (`25 MB` limit) |
| `exceljs` | `^4.4.0` | Styled `.xlsx` generation, embedded images & `_ImageMap` extraction |
| `xlsx` | `^0.18.5` | Legacy `.xls`/`.xlsx` spreadsheet parsing and tabular export |
| `pdfjs-dist` | `^6.5.438` | Vector text extraction, rasterization, and PDF XObject parsing |
| `tesseract.js` | `^7.0.0` | Optical character recognition for scanned PDFs and images |
| `@tesseract.js-data/eng` | `^1.0.0` | English trained data for server-side Tesseract OCR |
| `pngjs` | `^7.0.0` | PNG encoding/decoding during PDF image extraction |
| `jpeg-js` | `^0.4.4` | JPEG decoding/conversion during PDF image extraction |
| `jszip` | `^3.10.2` | OOXML `.xlsx` drawing & media archive inspection |
| `jspdf` | `^4.2.1` | PDF export generation for reports and results |
| `jspdf-autotable` | `^5.0.9` | Tabular formatting for jsPDF exports |
| `@tailwindcss/vite` | `^4.3.3` | Tailwind CSS v4 Vite integration |
| `@vitejs/plugin-react` | `^6.1.1` | Vite React transform plugin |
| `vite` | `^8.3.0` | Module bundler and dev middleware |
| `dotenv` | `^17.2.3` | Environment variable package |
| `@google/genai` | `^2.4.0` | Installed in `package.json`; not imported or called in `src/` or `server.ts` |
| `@types/multer` | `^2.3.0` | Type definitions for `multer` |
| `@types/pngjs` | `^6.0.5` | Type definitions for `pngjs` |

### Development Dependencies (`package.json`)

- `tsx` (`^4.21.0`), `typescript` (`^7.0.2`), `tailwindcss` (`^4.3.3`), `autoprefixer` (`^10.4.21`), `esbuild` (`^0.25.0`), `@types/node` (`^22.14.0`), `@types/react` (`^19.3.0`), `@types/react-dom` (`^19.3.0`), `@types/express` (`^4.17.21`).

---

## 6. Environment Variable Configuration

Variables referenced across `.env.example`, `vite.config.ts`, `server.ts`, and `src/services/apiConfig.ts`:

| Variable | Scope | Default / Template Value | Purpose |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | Frontend (Vite) | Template: `https://api.exams.mitmysore.in/api/v1`<br>Runtime fallback: `/api/v1` | Base URL prepended to all `API_ENDPOINTS` calls in `apiClient.ts`. |
| `DEFAULT_APP_PORT` / `PORT` | Server / Vite | `3000` | HTTP listening port in `server.ts` (`--port <n>` CLI flag takes precedence) and `vite.config.ts`. |
| `NODE_ENV` | Server | `development` (implicit) | When `production`, `server.ts` serves `dist/` instead of attaching Vite dev middleware. |
| `DISABLE_HMR` | Server / Vite | `false` | When `"true"`, disables Vite HMR updates and file watching while preserving the HTTP server WebSocket binding. |
| `APP_URL` | Runtime template | `"MY_APP_URL"` (`.env.example`) | Hosting URL placeholder in `.env.example`. |
| `GEMINI_API_KEY` | Runtime template | `"MY_GEMINI_API_KEY"` (`.env.example`) | API key placeholder in `.env.example`; not referenced in application source code. |

> Never commit `.env` files containing real credentials or private URLs/tokens to version control.

---

## 7. Development and Production Build Commands

Scripts defined in `package.json`:

| Command | Script | Behavior |
| --- | --- | --- |
| `npm run dev` | `tsx server.ts` | Starts the Express backend (`server.ts`) with Vite middleware in SPA mode on port `3000`. Accepts `--port <n>`. |
| `npm run lint` | `tsc --noEmit` | Runs TypeScript type checking across `src/` and `server/` without emitting JS files. |
| `npm run build` | `vite build` | Bundles the frontend React application into `dist/`. |
| `npm run start` | `node server.ts` | Starts `server.ts` directly with Node.js (requires Node support for TypeScript syntax or pre-compiled JS, and `NODE_ENV=production` to serve `dist/`). |
| `npm run preview` | `vite preview` | Serves the static `dist/` bundle via Vite only (does **not** mount Express `/api/v1` routes). |
| `npm run clean` | `rm -rf dist server.js` | Deletes the `dist/` build directory and `server.js`. |

---

## 8. Principal and HOD Portal Architecture

### Entry & Layout Separation

`src/App.tsx` wraps the application in `ThemeProvider` -> `AuthProvider` -> `BrowserRouter` and partitions routes into two role-protected layout trees:

#### Principal Portal (`/admin/principal/*`, `PrincipalLayout`)
Sticky dark-navy sidebar (`#17243A`) + mobile drawer + workspace header (`AccountMenu`):
- **`/admin/principal/dashboard` (`PrincipalDashboardPage`)**: Displays institution-level summary KPIs (Departments, HOD Accounts & active count, Unique Registered Students, Upcoming / In Progress / Completed Examinations), active examination tracking, and recent administrative activity logs.
- **`/admin/principal/hod-management` (`HodManagementPage`)**: Search/filter HOD accounts, create a new Department + assign an active HOD (`2–8` uppercase letter department code), inspect assignment history, edit HOD contact/profile details, toggle Active/Inactive status, and replace a department's HOD with an audited reason.
- **`/admin/principal/reports` (`InstitutionReportsPage`)**: Compiles institution-wide, department-wise, subject-wise, and section-wise statistics strictly from **COE-released** examination results, filterable by Academic Year, Department, Semester (`1st`–`8th`), and Examination, with client-side CSV, XLSX, and PDF exports.
- **`/admin/principal/audit-logs` (`AuditLogsPage`)**: Chronological institution-wide audit trail filterable by search query, department, actor role (`PRINCIPAL`, `HOD`, `COE`, `SYSTEM`), action category, and date range, with CSV export.
- **`/admin/principal/profile-settings` (`ProfileSettingsPage`)**: Account details, Indian mobile number update, password change, and synced Light/Dark theme toggle.

#### HOD Portal (`/admin/hod/*`, `HodLayout`)
Wrapped in `HodSemesterProvider`, sharing `selectedSemester` (`1`–`8`, default `5`) across navigation and deep links (`Setup Class` and `Questions` automatically include `?semester=${selectedSemester}`):
- **`/admin/hod/dashboard` (`HodDashboardPage`)**: 3 clickable department KPI cards (**Total Students** with smooth scroll to semester table, **Upcoming Examinations**, **Released Results**) plus an 8-semester overview table (`1st`–`8th` ascending) with clickable student enrollment breakdown modals per section.
- **`/admin/hod/setup-class` (`SetupClassPage`)**: Subjects CRUD and section-wise Eligible Student Lists management.
- **`/admin/hod/questions` (`QuestionsPage`)**: Four ordered sub-tabs — **Question Pool & Upload**, **Paper Blueprint & Publish Sets**, **Key Corrections**, and **Publication History**.
- **`/admin/hod/key-correction`**: Redirects to `/admin/hod/questions?tab=key-correction`.
- **`/admin/hod/exam-status` (`HodExamStatusPage`)**: Read-only COE examination schedule monitor grouped by subject with expandable sitting details.
- **`/admin/hod/results` (`DepartmentResultsPage`)**: COE-released department results table, analytics, topper groups, and CSV/XLSX/PDF exports.
- **`/admin/hod/audit-logs` (`AuditLogsPage`)**: Department-scoped audit trail viewer and CSV export.
- **`/admin/hod/profile-settings` (`ProfileSettingsPage`)**: Profile settings, password policy update, and theme preference sync.

---

## 9. Authentication and Role-Based Access Structure

- **Login Screen (`/admin/login`, `LoginPage.tsx`)**: Single institutional sign-in form posting `{ username, password }` (username lowercased) to `POST /auth/login` via `authService.login`. No demo shortcuts or fallback credentials exist.
- **Session Storage (`authService.ts` & `apiClient.ts`)**:
  - Stores the Bearer JWT/session token under `sessionStorage['mit_mysore_auth_token']` and serialized `AuthUser` under `sessionStorage['mit_mysore_auth_session']`.
  - Automatically clears any legacy `localStorage['mit_mysore_ems_dev_db_v4']` entries or `dev-session-*` tokens in `getCurrentUser()`.
  - `apiClient.ts` attaches `Authorization: Bearer <token>` on all outgoing API requests and registers a global `401 Unauthorized` handler (`registerUnauthorizedHandler`) that clears token/user state and redirects to `/admin/login`.
- **Route Protection (`RoleGuard` in `src/App.tsx`)**:
  - Unauthenticated users visiting `/`, `/admin`, or protected routes are redirected to `/admin/login`.
  - Users whose `user.role` does not match `allowedRole` (`'PRINCIPAL'` vs `'HOD'`) see a Role Permission Boundary screen with a link back to their authorized dashboard.
- **Password Policy (`authService.changePassword`)**: Enforces `>= 8` characters, at least one uppercase letter, lowercase letter, digit, special character, and no reuse of the current password.
- **Department Scope Headers (`documentConversionService.ts`, `courseOutcomeService.ts`, `questionService.ts`)**: Protected Express routes in `server.ts` validate both the `Authorization: Bearer <token>` header and HOD scope headers (`x-hod-user-id`, `x-hod-department-id`, `x-hod-department-code`).

---

## 10. Setup Class and Student Lists Workflows

Managed in `src/pages/hod/SetupClassPage.tsx` with synchronized semester context (`useHodSemester`):

### Semester Synchronization
- Changing the semester selector (`1st`–`8th Semester` via `MASTER_SEMESTER_OPTIONS`) updates `HodSemesterContext`, `sessionStorage['mit_mysore_hod_semester:<scopeId>']`, and the `?semester=` URL query parameter, carrying the exact semester selection into `QuestionsPage`.
- In-flight subject fetches use `AbortController` and sequence counters to prevent stale responses from overwriting the active semester.

### Subjects Tab
- Create, view, edit, archive/activate, or delete unused subjects per department and semester.
- Each subject specifies an uppercase Subject Code, Subject Name, configurable `moduleCount` (`1`–`12`), and `applicableSections`.

### Student Lists Tab
- **Section Management**: Filter by semester-configured sections or add a new section (`+ Add Section`) via `studentService.addSectionToSemester`.
- **Template & Excel Bulk Upload/Replace**:
  - Downloads a formatted 3-column Excel template (`USN`, `Student Name`, `DOB`) using `browserExcelService.ts`.
  - Parses uploaded `.xlsx`/`.xls` files (`parseAndValidateStudentExcel`), validating **MIT Mysore USN patterns** (`^4MH\d{2}([A-Z]{2,4})\d{3}$`) and department branch prefixes (`DEPT_USN_BRANCH_PREFIXES` in `usnValidator.ts`, e.g., `CSE -> CS`, `ISE -> IS`, `ECE -> EC`, `AIML -> AI/AM/AL/CI`), ISO dates (`YYYY-MM-DD`, years `1985`–`2015`), duplicate USNs, and cross-section USN conflicts before saving or replacing a revision.
- **Student PDF / Image-to-Excel Conversion**:
  - In the current `SetupClassPage.tsx`, student document conversion (`.pdf`, `.jpg`, `.jpeg`, `.png`) executes in the browser via `src/utils/browserStudentConverter.ts` + `browserPdfOcr.ts` + `browserExcelService.ts` (using local workers under `public/vendor/`), providing an interactive preview table to correct USNs, names, DOBs, and section confirmations before exporting a clean `.xlsx` ready for roster upload.
  - Corresponding server-side endpoints (`POST /hod/student-lists/conversions` etc.) are also implemented in `server.ts` (`server/services/studentExtractor.ts`).
- **Individual CRUD & COE Freeze Guard**: Supports adding/editing/removing individual students and inspecting historical `StudentListRevision` records (`EXCEL_UPLOAD`, `PDF_CONVERTED_EXCEL`, `MANUAL_ENTRY`). Modifications are blocked if the active revision has status `Frozen by COE`.

---

## 11. Question Bank and Backend-Based Question Conversion Workflow

Managed in `src/pages/hod/QuestionsPage.tsx` under the **Question Pool & Upload** sub-tab:

### Strict Module-Wise Policy & Manual/Excel Entry
- **Manual Question CRUD**: Create, edit, and archive/activate MCQs (`questionText`, `optionA`–`optionD` all distinct, `correctOption` in `A|B|C|D`, and optional image assets) assigned to a module within `1..subject.moduleCount`.
- **Excel Template & Bulk Upload**:
  - Downloads an image-capable `.xlsx` template with headers: `Module Number`, `Question Text`, `Option A`, `Option B`, `Option C`, `Option D`, `Correct Option`.
  - Rejects any workbook containing a `Difficulty` column (uniform difficulty policy) or mixing multiple modules in a single upload batch.
  - Preserves embedded cell images and `_ImageMap` metadata (`parseQuestionWorkbookInBrowser` for `.xlsx`; SheetJS fallback for legacy `.xls`) and imports validated batches via `POST /hod/question-banks/import`.

### Backend-Based Question PDF / Image Conversion (`server.ts` + `questionExtractor.ts`)
Unlike client-side student conversion, question-document conversion executes **strictly on the Express backend** via `documentConversionService`:
1. **Upload**: HOD selects a target module, optional page range (e.g., `1-4, 6`), and uploads a `.pdf`, `.jpg`, `.jpeg`, or `.png` file (`<= 25 MB`) to `POST /hod/question-banks/conversions`.
2. **Backend Extraction (`pdfAndOcrEngine.ts` & `questionExtractor.ts`)**:
   - Extracts vector PDF text or runs Tesseract OCR for scanned pages/images.
   - Extracts embedded PDF XObjects / raster image crops and associates diagrams with `QUESTION_TEXT` or `OPTION_A`–`OPTION_D`; unlinked diagrams are surfaced in `unassignedImages`.
   - Parses question stems, options A–D, answer keys, and module tags (`QUESTION_LABEL`, `HEADING`, `PAGE_LABEL`, `TOPIC`).
   - Enforces `moduleMismatchDetected` and `multiModuleDetected` checks against the selected target module and stores an ephemeral conversion session (`30 minute` TTL).
3. **Interactive Review & Backend Revalidation**:
   - HOD filters rows (`ALL`, `NEEDS_REVIEW`, or per detected module), edits question/option/answer fields, reassigns module numbers, attaches/reorders/removes diagrams (or discards unassigned images), and syncs changes to `PUT /hod/question-banks/conversions/:conversionId/records` and `POST .../validate`.
4. **Module-Wise Excel Download**:
   - Once `downloadEligible` is true (all rows valid, answer keys present, no unresolved unassigned images/module mismatches), `GET /hod/question-banks/conversions/:conversionId/excel?moduleNumber=<n>` builds an `.xlsx` workbook containing a `Questions` sheet, embedded cell drawings, and a `veryHidden` `_ImageMap` metadata sheet tracking Asset ID, Target Field, Sequence, Dimensions, Excel Image ID, and SHA-256 hash.

---

## 12. Course Outcomes Document Submission Workflow

Implemented in `QuestionsPage.tsx` (independent of question conversion), `src/services/courseOutcomeService.ts`, and `server.ts`:

- **Strict PDF-Only Validation (`validateCourseOutcomePdfFile`)**:
  - Accepts only `.pdf` files with `application/pdf` or `application/x-pdf` MIME type, non-zero size `<= 25 MB`, and valid `%PDF-` magic bytes (verified both client-side and server-side in `server.ts`).
  - Does **not** run OCR, text extraction, or question parsing.
- **Preview & Submission**:
  - Generates a temporary `URL.createObjectURL` preview (expandable inline viewer, revoked on clear/subject switch/unmount) and accepts optional submission notes.
  - Uploads via `POST /hod/subjects/:subjectId/course-outcomes` with active semester and subject metadata.
- **Revision Management**:
  - Each new upload creates an active revision (`CO-REV-1.0`, `CO-REV-2.0`, ...) tagged `coeAccessible: true` and marks prior `Active` revisions as `Superseded`.
  - HOD can view revision history (`GET /hod/subjects/:subjectId/course-outcomes`) and download any submitted PDF (`GET /hod/subjects/:subjectId/course-outcomes/:documentId/file`).
- **Storage Note**: Revisions are currently held in an in-memory `Map` (`courseOutcomeStore`) inside `server.ts`.

---

## 13. Question-Set Generation and Publication Workflow

Implemented in `QuestionsPage.tsx` (**Paper Blueprint & Publish Sets** & **Publication History** tabs) and `src/services/questionService.ts`:

- **Dynamic Disjoint Set Capacity (`evaluateDynamicSetCapacity`)**:
  - Filters the subject's `Active` pool for content-unique valid questions per module (deduplicating normalized question stems + image signatures and requiring 4 distinct options + valid answer key).
  - Computes per-module capacity as `floor(availableUniqueValid / requiredPerSet)` and overall **Maximum Complete Sets** as the minimum across all modules where `requiredPerSet > 0`, highlighting any limiting module(s) or per-module shortages.
- **Blueprint & Revision Hashing**:
  - Tracks deterministic `QuestionBankRevisionId` (`QBR-...`) and `BlueprintRevisionId` (`BPR-...`) identifiers.
  - Prevents duplicate concurrent set generation in the client using `inFlightGenerationLocks`.
- **Zero-Overlap Set Generation & COE Confidentiality**:
  - Triggers `POST /hod/subjects/:subjectId/question-sets` to generate numbered disjoint sets on the backend (`overlapAcrossSets: 0`).
  - **Confidentiality Boundary**: HOD receives only `HodSetGenerationSummary` (set numbers, counts, and status) — `questionService.getAuthorizedCoePublishedSets` explicitly blocks `'HOD'` and `'PRINCIPAL'` roles (`403 CONFIDENTIAL_SET_ACCESS_DENIED`).
- **Publication & History**:
  - HOD explicitly publishes generated sets with optional notes via `POST /hod/subjects/:subjectId/question-sets/publish`, creating a `QuestionPublicationRevision` visible under **Publication History**.

---

## 14. Examination Status and Department Results

### Examination Status (`HodExamStatusPage.tsx`)
- Read-only department view displaying COE-scheduled examinations grouped by subject (`GET /hod/examinations`).
- Filterable by subject code/name search, Semester (`1st`–`8th`), and lifecycle status (`Scheduled`, `In Progress`, `Exam Completed`, `Cancelled`).
- Displays `examStatus`, `labReadiness` (`Not Ready` / `Ready` / `Issue`), `resultStatus`, participating sections, and expandable `sittings` cards (`Morning`/`Afternoon`, lab, date, time range, assigned student count).

### Key Corrections (`QuestionsPage.tsx` -> Key Corrections tab & `keyCorrectionService.ts`)
- Loads eligible examinations (`GET /hod/key-corrections/eligible-examinations`) and associated questions (`GET /hod/key-corrections/examinations/:id/questions`).
- Allows HOD to propose an updated correct option (`A|B|C|D`) via `POST /hod/key-corrections` for COE review (`Pending COE Review`, `Approved & Recalculated`, `Rejected`).

### Department Results & Performance Analytics (`DepartmentResultsPage.tsx`, `analyticsService.ts`)
- Fetches strictly COE-released student results (`GET /hod/results`), filterable by USN/Name, Academic Year, Semester, Examination, and Section.
- Client-side `analyticsService.computeDepartmentAnalytics` calculates pass/fail counts & percentages (excluding `Absent` entries from pass/fail failure distortion while reporting absent counts separately), average/highest/lowest percentages, tied top performers per exam, subject-wise breakdown, section-wise breakdown, and semester-wise breakdown.
- Supports client-side export via `exportUtils.ts` to **CSV**, **XLSX**, and **PDF** (`jsPDF` + `jsPDF-AutoTable`).

---

## 15. API Service Architecture and Backend Integration Requirements

### Client HTTP Layer (`src/services/apiClient.ts` & `src/services/apiConfig.ts`)
- Base URL: `import.meta.env.VITE_API_BASE_URL || '/api/v1'`.
- Default JSON request timeout: `15,000 ms` (extended to `60,000 ms` for Excel parse/blob/CO upload, `90,000 ms`–`120,000 ms` for document conversion uploads).
- Expects standard JSON response envelopes (`ApiResponse<T>` with `success`, `data`, `message`, `timestamp`). If a server responds with non-JSON or `502`/`503`/`504`, `apiClient` throws `ApiClientError` with `code: 'BACKEND_UNAVAILABLE'`.

### Endpoints Implemented in Local Express Server (`server.ts`)
Mounted under both `/api/v1` and `/api`:

| Method & Path | Purpose | Notes |
| --- | --- | --- |
| `GET /health` | Service health check | Returns `{ status: 'UP' }` |
| `POST /hod/student-lists/conversions` | Upload PDF/image student list for extraction | Requires Bearer + `x-hod-*` headers |
| `GET /hod/student-lists/conversions/:conversionId` | Retrieve student conversion session | 30-min in-memory session TTL |
| `PUT /hod/student-lists/conversions/:conversionId/records` | Update & revalidate student preview rows | Requires Bearer + `x-hod-*` headers |
| `POST /hod/student-lists/conversions/:conversionId/validate` | Revalidate student conversion session | Requires Bearer + `x-hod-*` headers |
| `GET /hod/student-lists/conversions/:conversionId/excel` | Download validated 3-column student `.xlsx` | Blocked unless `downloadEligible` |
| `GET /hod/student-lists/template` | Download empty 3-column student `.xlsx` template | Public query params (`departmentCode`, `semesterNumber`, `section`) |
| `POST /hod/student-lists/import` | Parse uploaded student `.xlsx` or validate row batch | Ephemeral audit record |
| `POST /hod/question-banks/conversions` | Upload PDF/image question doc for extraction | Supports `selectedModuleNumber`, `selectedPageRange` |
| `GET /hod/question-banks/conversions/:conversionId` | Retrieve question conversion session | 30-min in-memory session TTL |
| `PUT /hod/question-banks/conversions/:conversionId/records` | Sync edited questions, module tags & diagram links | Triggers server revalidation |
| `POST /hod/question-banks/conversions/:conversionId/validate` | Revalidate question conversion session | Supports `multiModuleConfirmed` |
| `GET /hod/question-banks/conversions/:conversionId/excel` | Download image-enabled `.xlsx` (`?moduleNumber=`) | Includes `Questions` + `_ImageMap` sheets |
| `GET /hod/question-banks/template` | Download empty 7-column question `.xlsx` template | Public query params (`subjectCode`, `moduleNumber`) |
| `POST /hod/question-banks/parse-excel` | Parse `.xlsx` with embedded drawings & `_ImageMap` | Enforces single-module batch validation |
| `POST /hod/question-banks/import` | Validate batch & generate `QID-*` IDs | Does **not** persist to a database |
| `GET /hod/subjects/:subjectId/course-outcomes` | List Course Outcomes PDF revisions | In-memory `courseOutcomeStore` |
| `POST /hod/subjects/:subjectId/course-outcomes` | Upload Course Outcomes `.pdf` revision | Validates `%PDF-` magic bytes & 25 MB max |
| `GET /hod/subjects/:subjectId/course-outcomes/:documentId/file` | Download Course Outcomes `.pdf` revision | Streams stored `Buffer` |

### Endpoints Expected from the Central Spring Boot / Java Backend (`src/services/apiConfig.ts`)
Any request to an endpoint not listed above hits the `server.ts` catch-all middleware and returns `HTTP 503` (`{ success: false, code: 'BACKEND_UNAVAILABLE' }`) until `VITE_API_BASE_URL` points to (or proxies) the Java backend implementing:

- **Authentication**: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password`, `PATCH /auth/profile`, `PATCH /auth/preferences/theme`
- **Principal**: `GET /principal/dashboard`, `GET /principal/hods`, `POST /principal/hods`, `PATCH /principal/hods/:id`, `PATCH /principal/hods/:id/status`, `POST /principal/departments/:deptId/replace-hod`, `GET /principal/reports/results`, `GET /principal/reports/export`, `GET /principal/audit-logs`
- **HOD Core & Setup**: `GET /hod/dashboard`, `GET /hod/enrollment/summary`, `GET /hod/academic-context`, `POST /hod/academic-context/sections`, `GET /hod/subjects`, `POST /hod/subjects`, `PATCH /hod/subjects/:id`, `PATCH /hod/subjects/:id/status`, `DELETE /hod/subjects/:id`
- **HOD Student Rosters**: `GET /hod/student-lists`, `POST /hod/student-lists/validate-usns`, `POST /hod/student-lists/upload`, `POST /hod/student-lists/replace`, `POST /hod/student-lists/student`, `PATCH /hod/students/:id`, `DELETE /hod/students/:id`
- **HOD Questions & Sets**: `GET /hod/questions`, `POST /hod/questions`, `PATCH /hod/questions/:id`, `PATCH /hod/questions/:id/status`, `POST /hod/questions/upload`, `GET /hod/subjects/:subjectId/question-sets`, `POST /hod/subjects/:subjectId/question-sets`, `GET /hod/subjects/:subjectId/question-sets/coe-composition` (COE-only), `POST /hod/subjects/:subjectId/question-sets/publish`
- **HOD Exams, Key Corrections, Results & Audit**: `GET /hod/key-corrections/eligible-examinations`, `GET /hod/key-corrections/examinations/:id/questions`, `GET /hod/key-corrections`, `POST /hod/key-corrections`, `GET /hod/examinations`, `GET /hod/results`, `GET /hod/audit-logs`

---

## 16. Current Implementation Status and Pending Backend Dependencies

### Implemented in Current Codebase
- Complete role-guarded React SPA (`Principal` and `HOD` portals), responsive navigation, Light/Dark themes, and zero mock/demo data adapters.
- Synchronized 8-semester HOD state (`useHodSemester`) across `Setup Class` and `Questions`, with `AbortController` cancellation and clean empty/error/retry states.
- Live Express document-processing service (`server.ts` & `server/services/*`) handling PDF/image question conversion with OCR, diagram extraction, interactive review, image-preserving `.xlsx` export (`_ImageMap`), and Course Outcomes `.pdf` upload/revision/download.
- Client-side Student PDF/Image converter (`SetupClassPage.tsx`), `.xlsx` template generators, USN/department-prefix validation, dynamic disjoint question-set capacity calculation, and CSV/XLSX/PDF analytics exports.

### Pending Backend Dependencies & Operational Notes
- **Central Java / Spring Boot Backend**: Authentication (`/auth/*`), database persistence for departments, HODs, subjects, student rosters, question pools, generated numbered sets, key corrections, exam schedules, COE-released results, and audit logs are **not** persisted locally. Until a Java REST backend is connected via `VITE_API_BASE_URL`, those endpoints return `503 BACKEND_UNAVAILABLE`, so user sign-in via `/admin/login` cannot complete against local Express alone.
- **Auth Dependency on Express Document Routes**: Because `server.ts` enforces `Authorization: Bearer <token>` and `x-hod-*` scope headers (`extractHodContext`), testing the Express conversion and Course Outcomes endpoints requires either an authenticated session issued by the central auth service or valid test headers/tokens supplied externally.
- **Ephemeral In-Memory Storage in `server.ts`**:
  - `courseOutcomeStore`, `questionSessions`, `studentSessions`, and `serverAuditTrail` live strictly in Node process memory (`Map`/arrays; conversion sessions expire after 30 minutes) and reset on server restart.
  - `POST /hod/question-banks/import` currently returns generated `QID-*` identifiers without persisting questions into a database; full persistence relies on wiring to the Spring Boot / Java backend repository layer.
- **Student Conversion Execution Path**: `SetupClassPage.tsx` currently executes PDF/Image-to-Excel conversion in the browser (`browserStudentConverter.ts`) rather than calling the Express `/hod/student-lists/conversions` endpoints (whereas `QuestionsPage.tsx` uses the Express backend exclusively).
- **Unused Template Dependencies**: `@google/genai` is listed in `package.json` and `GEMINI_API_KEY` is listed in `.env.example`, but neither is invoked by the Admin/HOD Portal.
