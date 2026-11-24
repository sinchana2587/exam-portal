# MIT Mysore — Examination Management System (COE Portal)

The **Controller of Examinations (COE) Portal** for **Maharaja Institute of Technology Mysore (MIT Mysore)** is a React + TypeScript Single-Page Application (SPA) designed to connect with the institution's **Central Java REST Backend (PostgreSQL)** and **Isolated Laboratory Server LAN API** for end-to-end computer-based examination administration.

All operational records, eligibility rosters, question set selection, cryptographic lab package preparation, live telemetry, result evaluation, archival PDFs, and Course Outcomes documents are driven by backend API responses rather than client-side mock datasets.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technologies Used](#technologies-used)
3. [Implemented Portal Features & Routes](#implemented-portal-features--routes)
4. [Folder Structure](#folder-structure)
5. [Installation Instructions](#installation-instructions)
6. [Environment Variables](#environment-variables)
7. [Development, Linting & Build Commands](#development-linting--build-commands)
8. [Backend Integration](#backend-integration)

---

## Architecture Overview

### Frontend SPA & Routing
- Built as a client-side React 19 SPA bundled with Vite (`src/main.tsx` → `src/App.tsx`).
- Uses `BrowserRouter` with authenticated routes wrapped inside `COEPortalLayout` (`src/layouts/COEPortalLayout.tsx`), providing persistent primary sidebar navigation, contextual secondary section tabs, theme persistence (`light` / `dark`), and toast notifications.
- Unauthenticated sessions redirect automatically to `/login`. Any `401 Unauthorized` response from an API endpoint clears `sessionStorage` (`AUTH_SESSION_STORAGE_KEY`, `AUTH_TOKEN_STORAGE_KEY`) and resets the active session.

### State Management (`ExaminationProvider`)
- `src/hooks/useExaminationStore.tsx` centralizes shared institutional state fetched via `Promise.allSettled`:
  - Departments (`GET /institution/departments`)
  - Canonical 1st–8th Academic Semesters (`GET /institution/semesters`, normalized via `src/utils/academicSemesters.ts` so all eight semesters `1st Semester`–`8th Semester` always appear in ascending order)
  - HOD-published Subjects (`GET /institution/subjects?publishedOnly=true`)
  - Scheduled Examinations (`GET /examinations/scheduled`)
  - Lab Servers (`GET /labs/servers`)
  - Session Monitors (`GET /monitoring/sessions`)
  - Examination Results & Answer-Key Correction Requests (`GET /results/examinations`, `GET /results/answer-key-corrections`)
  - Invigilator Session Unlock Credentials (`GET /examinations/unlock-credentials`)
  - Read-Only Audit Logs (`GET /audit/logs`)
- Feature-specific endpoints that should not block portal-wide loading if unprovisioned or offline—specifically **Question Paper Archive** (`SchedulingPage.tsx`) and **Course Outcomes Management** (`CourseOutcomesPage.tsx`)—manage their own local loading, error, and empty states.

### Dual-Backend Integration Architecture
`src/services/apiClient.ts` separates all network requests into two logical service boundaries:
1. **Central Java REST Backend (`VITE_API_BASE_URL`)**:
   - Handles COE authentication, department/semester/subject eligibility, examination scheduling & lifecycle revisions, numbered set selection & A/B/C/D version allocation, cryptographic package generation & LAN transfer coordination, frozen Question Paper Archive PDF streaming, `.labresult` verification & PostgreSQL persistence, answer-key correction recalculation, result approval & release, Course Outcomes PDF storage & review, and immutable audit logging.
2. **Isolated Laboratory Server LAN API (`VITE_LAB_API_BASE_URL`)**:
   - Handles registered laboratory workstation inventory (`registeredWorkstationIds`), live session telemetry, per-package LAN receipt verification, runtime workstation binding, PC crash recovery, and offline unlock verification.

---

## Technologies Used

Exact packages declared in `package.json`:

| Category | Packages & Versions | Usage in Codebase |
| :--- | :--- | :--- |
| **UI & Routing** | `react` (`^19.0.1`), `react-dom` (`^19.0.1`), `react-router-dom` (`^7.18.5`) | Component UI, SPA routing, nested layout (`<Outlet />`) |
| **Language & Type Checking** | `typescript` (`^7.0.2`), `@types/react` (`^19.3.0`), `@types/react-dom` (`^19.3.0`), `@types/node` (`^22.14.0`) | Strict TypeScript models and `tsc --noEmit` checking |
| **Styling & Icons** | `tailwindcss` (`^4.3.3`), `@tailwindcss/vite` (`^4.3.3`), `autoprefixer` (`^10.4.21`), `lucide-react` (`^0.546.0`), `motion` (`^12.23.24`) | Utility styling, light/dark themes, institutional icons |
| **Document Export** | `jspdf` (`^4.2.1`), `xlsx` (`^0.18.5`), `jszip` (`^3.10.2`) | Result table exports to PDF (`exportResultsToPdf`), Excel `.xlsx` (`exportRowsToExcel`), and CSV (`exportRowsToCsv`) |
| **Build & Tooling** | `vite` (`^8.3.0`), `@vitejs/plugin-react` (`^6.1.1`), `esbuild` (`^0.25.0`), `tsx` (`^4.21.0`) | Dev server on port `3000` and production bundling |
| **Declared Runtime Packages** | `express` (`^4.21.2`), `@types/express` (`^4.17.21`), `dotenv` (`^17.2.3`), `@google/genai` (`^2.4.0`) | Present in `package.json`; not imported by the current `src/` SPA modules |

---

## Implemented Portal Features & Routes

### Sidebar Navigation Order (`COEPortalLayout.tsx`)
1. **Dashboard** (`/`)
2. **Schedule Examination** (`/schedule`)
3. **Session Monitoring** (`/monitoring`)
4. **Import Results** (`/results/import`)
5. **Result Approval** (`/results/approval`)
6. **Course Outcomes** (`/course-outcomes`)
7. **Audit Logs** (`/audit-logs`)
8. **Settings** (`/settings`)

### Page-by-Page Functional Breakdown

- **Login (`/login` — `src/pages/LoginPage.tsx`)**:
  - Institutional login with MIT Mysore campus background and circular emblem (`public/assets/aistudio/image_74996ac2.png`, `image_03b7be00.png`).
  - Authenticates exclusively via `POST /auth/coe/login` against the Central Java Backend; returns a clear service-unavailable message if the backend cannot be reached.

- **COE Dashboard (`/` — `src/pages/DashboardPage.tsx`)**:
  - Displays 5 operational summary cards (Upcoming Examinations, Examination Sessions In Progress, Examination Packages Pending Transfer, Results Pending Approval, Answer-Key Correction Requests Pending Review) and Today's Examination Sessions table.

- **Schedule Examination (`/schedule` — `src/pages/SchedulingPage.tsx`)**:
  - **Examination Details (`?section=examination-details`)**:
    - Create, revise (with authorised package invalidation), cancel (mandatory reason), or delete (Draft only) examinations across Departments and **1st–8th Semesters**.
    - Semester filter (`All Semesters (1st–8th)` + `1st Semester`–`8th Semester`) above Scheduled Examinations.
    - **Individual Sitting Details & Question Paper Archive** (always visible under `Examination Details`, displaying an informative empty state when no exam/backend is loaded, and separate archive subsections per sitting when an examination is loaded). Shows selected set, examination/subject details, sitting details, archive generation status, completion-gated availability (`"The original question paper will be available after this examination sitting has been completed and closed."`), official backend PDF download, separate restricted COE answer key access, and frozen A/B/C/D snapshot inspection modal.
  - **Sitting Arrangements (`?section=sitting-arrangements`)**: Read-only sitting allocations, eligible rosters, and schedule confirmation/freeze (`POST /examinations/{id}/confirm-schedule`).
  - **Set Selection (`?section=set-selection`)**: Select HOD-published numbered question set per sitting (`POST /examinations/{id}/select-set`) to trigger server-side A/B/C/D shuffling and balanced USN version allocation.
  - **Package Preparation & Transfer (`?section=package-transfer`)**: Prepare and transmit encrypted sitting packages to the assigned Lab Server (`POST /examinations/{id}/prepare-and-send-package`, `retry-transfer`), plus manage **Invigilator Session Unlock Credentials** via `SessionUnlockCredentialPanel` (generate, regenerate, revoke salted verifiers; does not create/manage Lab Administrator accounts).

- **Session Monitoring (`/monitoring` — `src/pages/SessionMonitoringPage.tsx`)**:
  - **Overall Monitoring (`?section=overall-monitoring`)**: Live telemetry metrics, 1st–8th semester filter across monitored sessions, and embedded Invigilator Session Unlock Credential panel.
  - **Individual Student Monitoring (`?section=student-monitoring`)**: Search and status/connection filters across candidate USN, runtime PC binding, submission, suspicious count, and recovery history.
  - **Suspicious Activity & Unlocks (`?section=suspicious-activity`)** & **PC Recovery Logs (`?section=pc-recovery`)**: Read-only logs synced from Lab Servers.

- **Import Results (`/results/import` — `src/pages/ResultImportPage.tsx`)**:
  - **1st–8th Semester** filter for eligible examinations, per-sitting `.labresult` file upload, multi-check cryptographic/roster verification (`POST /results/verify-upload`), and verified persistence (`POST /results/import-verified`).

- **Result Approval (`/results/approval` — `src/pages/ResultApprovalPage.tsx`)**:
  - **Result Overview (`?section=result-overview`)**: **1st–8th Semester** filter over imported results, attendance/attention metrics, PDF/Excel/CSV export, and `Approve & Release Results to HOD & Principal` action.
  - **Student-Wise Results (`?section=student-results`)**: Topper highlighting and `All`, `Present`, `Absent`, `Passed`, `Failed` filters.
  - **Answer-Key Corrections (`?section=answer-key-corrections`)**: Approve/reject HOD correction requests with audit remarks and server-side score recalculation.

- **Course Outcomes (`/course-outcomes` — `src/pages/CourseOutcomesPage.tsx`)**:
  - Filterable registry of HOD-uploaded Course Outcomes PDFs by Department, Semester (`1st Semester`–`8th Semester`), Subject/HOD search, Status (`Received`, `Under Review`, `Reviewed`, `Clarification Requested`), and Date range.
  - Split review workspace featuring unmodified backend PDF preview (`<iframe>` via `blob:` URL), revision switcher & download, separately saved dynamic `CO1`–`COn` statements, internal review notes, clarification notes (mandatory when requesting clarification), and immutable submission/review history timeline.

- **Audit Logs (`/audit-logs` — `src/pages/AuditLogsPage.tsx`)**:
  - Read-only chronological audit table with search, role/status/date filters, and CSV export.

- **Settings (`/settings` — `src/pages/SettingsPage.tsx`)**:
  - COE password change (`POST /auth/coe/change-password`) and persistent Light/Dark theme switcher.

---

## Folder Structure

```text
.
├── .env.example                       # Sample environment variables
├── BACKEND_API_CONTRACT.md            # Complete Central Java & Lab Server REST API spec
├── index.html                         # HTML shell & Google Fonts (Plus Jakarta Sans, JetBrains Mono)
├── metadata.json                      # App metadata
├── package.json                       # Dependencies and npm scripts
├── tsconfig.json                      # TypeScript compiler configuration
├── vite.config.ts                     # Vite + React + Tailwind v4 configuration
├── public/
│   └── assets/aistudio/               # Institutional images, logos, and reference assets
└── src/
    ├── App.tsx                        # BrowserRouter route definitions
    ├── main.tsx                       # React root mount
    ├── index.css                      # Tailwind CSS entry & theme styling
    ├── components/
    │   ├── ConfirmDialog.tsx          # Modal confirmation dialog with operational consequences
    │   ├── OfficialLogo.tsx           # MIT Mysore institutional emblem component
    │   ├── SessionUnlockCredentialPanel.tsx # Sitting-specific invigilator unlock secret controls
    │   └── StatusIndicator.tsx        # Semantic status badges
    ├── hooks/
    │   └── useExaminationStore.tsx    # Global React Context store & API synchronization
    ├── layouts/
    │   └── COEPortalLayout.tsx        # Sidebar, secondary contextual tabs, header & toast layer
    ├── pages/
    │   ├── AuditLogsPage.tsx          # /audit-logs
    │   ├── CourseOutcomesPage.tsx     # /course-outcomes
    │   ├── DashboardPage.tsx          # /
    │   ├── LoginPage.tsx              # /login
    │   ├── ResultApprovalPage.tsx     # /results/approval
    │   ├── ResultImportPage.tsx       # /results/import
    │   ├── SchedulingPage.tsx         # /schedule (includes Question Paper Archive)
    │   ├── SessionMonitoringPage.tsx  # /monitoring
    │   └── SettingsPage.tsx           # /settings
    ├── services/
    │   ├── analyticsService.ts        # /audit/logs API wrapper
    │   ├── apiClient.ts               # Dual-backend fetch, multipart upload, blob & 401 handling
    │   ├── authenticationService.ts   # Login, logout, password change, session validation
    │   ├── courseOutcomeService.ts    # /course-outcomes list, detail, PDF stream, and review APIs
    │   ├── credentialService.ts       # Invigilator session unlock verifier lifecycle APIs
    │   ├── examinationService.ts      # Semesters, departments, subjects, scheduling, set selection, archives
    │   ├── labService.ts              # Re-exported lab & package transfer methods
    │   ├── packageService.ts          # Re-exported sitting package transfer methods
    │   ├── paperService.ts            # Re-exported set selection method
    │   ├── resultService.ts           # .labresult verify/import, answer-key review, result release
    │   └── sessionService.ts          # Live session monitoring, PC binding & recovery APIs
    ├── types/
    │   └── examination.ts             # Domain DTOs and TypeScript interfaces
    └── utils/
        ├── academicSemesters.ts       # Canonical 1st–8th semester definitions & formatters
        ├── credentials.ts             # Credential & verifier type contracts
        ├── csvExport.ts               # CSV, Excel (.xlsx), and PDF table exporters
        ├── examinationStatus.ts       # Lifecycle, sitting, package, and result status derivation
        └── versionAllocation.ts       # Version balance validation helpers
```

---

## Installation Instructions

### Prerequisites
- **Node.js** (v18+ or v20+ recommended) and **npm** (or **Bun**; `bun.lock` is present).
- Running instances of the **Central Java REST Backend (PostgreSQL)** and **Lab Server API** for live COE authentication and examination operations.

### Steps
1. Clone or open the project root directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` (or `.env.local`) and configure backend URLs:
   ```bash
   cp .env.example .env
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   The application serves on **`http://localhost:3000`** (`vite --port=3000 --host=0.0.0.0`).

---

## Environment Variables

Defined in `.env.example` and read via `import.meta.env` in `src/services/apiClient.ts` (client variables must use the `VITE_` prefix):

| Variable | Default / Example | Required | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:8080/api/v1` | Yes (for live backend) | Base URL of the Central Java REST Backend (PostgreSQL persistence). Trailing slashes are stripped automatically. |
| `VITE_LAB_API_BASE_URL` | `http://192.168.10.50:8443/lab-api/v1` | Yes (for live labs) | Base URL of the Isolated Laboratory Server LAN REST API. Trailing slashes are stripped automatically. |
| `DISABLE_HMR` | `true` / unset | Optional (build/env) | Used in `vite.config.ts` to disable Vite HMR and file watching when set to `'true'`. |
| `GEMINI_API_KEY` | `"MY_GEMINI_API_KEY"` | Defined in `.env.example` | Server-side / runtime placeholder in `.env.example`; not consumed by the frontend SPA. |
| `APP_URL` | `"MY_APP_URL"` | Defined in `.env.example` | Deployment host URL placeholder in `.env.example`. |

---

## Development, Linting & Build Commands

All scripts are defined in `package.json`:

| Command | Underlying Script | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `vite --port=3000 --host=0.0.0.0` | Starts the Vite development server on port `3000`. |
| `npm run lint` | `tsc --noEmit` | Runs TypeScript static type checking across the project without emitting files. |
| `npm run build` | `vite build` | Builds the optimized production SPA bundle into `dist/`. |
| `npm run preview` | `vite preview` | Previews the production `dist/` bundle locally. |
| `npm run clean` | `rm -rf dist server.js` | Removes build output artifacts. |

---

## Backend Integration

For full request/response DTO schemas, HTTP status semantics, and security invariants, see **[`BACKEND_API_CONTRACT.md`](./BACKEND_API_CONTRACT.md)**.

### Authentication & Request Headers
- All authenticated requests attach `Authorization: Bearer <jwt_token>` from `sessionStorage`.
- JSON requests send `Content-Type: application/json` and `Accept: application/json`.
- `.labresult` uploads (`/results/verify-upload`, `/results/import-verified`) send `multipart/form-data`.
- Binary PDF streams (Question Paper Archive PDFs and Course Outcomes PDF revisions) use `apiClient.centralBlobRequest` with `Accept: application/pdf, application/octet-stream, application/json` and respect `Content-Disposition` filenames.

### Summary of Expected REST Endpoints

#### Central Java REST Backend (`VITE_API_BASE_URL`)
- **Auth**: `POST /auth/coe/login`, `POST /auth/coe/logout`, `POST /auth/coe/change-password`
- **Institution Reference**: `GET /institution/departments`, `GET /institution/semesters`, `GET /institution/eligibility`, `GET /institution/subjects`
- **Scheduling & Sittings**: `GET /examinations/scheduled`, `GET /examinations/{id}`, `POST /examinations/schedule`, `PUT /examinations/{id}`, `PUT /examinations/{id}/settings`, `PUT /examinations/{id}/sittings`, `POST /examinations/{id}/confirm-schedule`, `POST /examinations/{id}/cancel`, `DELETE /examinations/{id}`
- **Set Selection & Packages**: `GET /examinations/{id}/question-sets`, `POST /examinations/{id}/select-set`, `POST /examinations/{id}/prepare-and-send-package`, `POST /examinations/{id}/retry-transfer`
- **Question Paper Archive**: `GET /examinations/{id}/question-paper-archive`, `GET /examinations/{id}/sittings/{sittingId}/question-paper-archive/download`, `GET /examinations/{id}/sittings/{sittingId}/question-paper-archive/answer-key/download`
- **Session Unlock Credentials**: `GET /examinations/unlock-credentials`, `POST /examinations/{id}/sittings/{sittingId}/unlock-credential`, `/regenerate`, `/revoke`
- **Results & Corrections**: `GET /results/examinations`, `GET /results/answer-key-corrections`, `POST /results/verify-upload`, `POST /results/import-verified`, `POST /results/answer-key-corrections/{requestId}/review`, `POST /results/{resultId}/approve-release`
- **Course Outcomes**: `GET /course-outcomes`, `GET /course-outcomes/{id}`, `GET /course-outcomes/{id}/revisions/{revision}/document`, `POST /course-outcomes/{id}/review`
- **Audit Logs**: `GET /audit/logs`

#### Isolated Lab Server API (`VITE_LAB_API_BASE_URL`)
- `GET /labs/servers`
- `GET /monitoring/sessions`, `GET /monitoring/sessions/{sessionId}`
- `GET /labs/examinations/{examinationId}/sittings/{sittingId}/package-receipt`
- `POST /labs/{labId}/sittings/{sittingId}/workstation-bind`
- `POST /labs/{labId}/sittings/{sittingId}/pc-recovery`
- `POST /labs/{labId}/sittings/{sittingId}/verify-unlock`
- `POST /monitoring/sessions/{sittingId}/unlock-event`
