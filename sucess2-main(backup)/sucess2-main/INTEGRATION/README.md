# MIT Mysore Examination Management System — Integration Architecture

## Overview

All three portals are unified to communicate with **one common Java Spring Boot backend**.  
Document conversion for the Admin portal is served by a **local Express server** (not the central backend).  
The Student portal communicates with a **per-lab Lab Server** in addition to the central backend.

---

## Backend Servers

| Server | Dev URL | Prod URL | Technology |
|---|---|---|---|
| **Central Backend** | `http://localhost:8080` | `http://192.168.1.100:8080` | Java Spring Boot |
| **Admin Doc-Conversion Server** | (same host, `/api/v1/hod/...`) | (same host, `/api/v1/hod/...`) | Node.js / Express |
| **Lab Server** | `http://192.168.10.50:8443` | `http://192.168.10.50:8443` | Node.js (per-lab) |

---

## Portal Environment Variables

### admin-portal (7)

| File | Variable | Value |
|---|---|---|
| `.env.development` | `VITE_API_BASE_URL` | `http://localhost:8080/api/v1` |
| `.env.production` | `VITE_API_BASE_URL` | `http://192.168.1.100:8080/api/v1` |

> **Note — Local Document Conversion Routes (NOT forwarded to central backend):**  
> The Admin portal ships its own Express server (`server.ts`) that handles the following routes locally.  
> These are served from the **same origin** as `VITE_API_BASE_URL`, so no special env var is needed —  
> they are intercepted before the request reaches the central backend.
>
> - `POST /api/v1/hod/student-lists/conversions` — upload & convert student-list document  
> - `GET  /api/v1/hod/student-lists/conversions/:id` — conversion job status  
> - `GET  /api/v1/hod/student-lists/conversions/:id/records` — parsed records  
> - `POST /api/v1/hod/student-lists/conversions/:id/validate` — validate records  
> - `GET  /api/v1/hod/student-lists/conversions/:id/excel` — download result Excel  
> - `POST /api/v1/hod/question-banks/parse-excel` — parse question-bank Excel  
> - `GET  /api/v1/hod/question-banks/conversions` — list conversions  
> - `GET  /api/v1/hod/question-banks/conversions/:id` — conversion status  
> - `GET  /api/v1/hod/question-banks/conversions/:id/records` — parsed records  
> - `POST /api/v1/hod/question-banks/conversions/:id/validate` — validate records  
> - `GET  /api/v1/hod/question-banks/conversions/:id/excel` — download result Excel  
> - `POST /api/v1/hod/subjects/:subjectId/course-outcomes` — upload course-outcome document  
> - `GET  /api/v1/hod/subjects/:subjectId/course-outcomes/:docId/file` — download CO file  
>
> All **other** `/api/v1/...` calls are proxied / sent directly to the **central backend**.

---

### coe-portal (7)

| File | Variable | Value |
|---|---|---|
| `.env.development` | `VITE_API_BASE_URL` | `http://localhost:8080/api/v1` |
| `.env.development` | `VITE_LAB_API_BASE_URL` | `http://192.168.10.50:8443/lab-api/v1` |
| `.env.production` | `VITE_API_BASE_URL` | `http://192.168.1.100:8080/api/v1` |
| `.env.production` | `VITE_LAB_API_BASE_URL` | `http://192.168.10.50:8443/lab-api/v1` |

The COE portal uses the central backend for all exam management operations and  
the Lab Server for monitoring active exam sessions in laboratories.

---

### student-portal

> Path: `student-portal (Final)/student-portal (Final)/student-portal`

| File | Variable | Value |
|---|---|---|
| `.env.development` | `VITE_API_URL` | `http://localhost:8080` |
| `.env.development` | `VITE_LAB_API_BASE_URL` | `http://localhost:8080` |
| `.env.development` | `VITE_API_TIMEOUT_MS` | `8000` |
| `.env.development` | `VITE_API_MODE` | `integration` |
| `.env.production` | `VITE_API_URL` | `http://192.168.1.100:8080` |
| `.env.production` | `VITE_LAB_API_BASE_URL` | `http://192.168.1.100:8080` |
| `.env.production` | `VITE_API_TIMEOUT_MS` | `10000` |
| `.env.production` | `VITE_API_MODE` | `integration` |

> **Note:** The Student portal uses `VITE_API_URL` (no `/api/v1` suffix).  
> It constructs full paths such as `/api/student/login`, `/api/student/exam/questions`, etc.,  
> appending the path prefix itself inside the API client.

---

## Cross-Portal Data Flow (5 Connections)

```
CONNECTION 1 — COE → Principal / HOD
  COE creates Examinations  →  stored in DB  →  HOD reads via GET /hod/examinations

CONNECTION 2 — HOD → COE
  HOD uploads student lists  →  stored in DB  →  COE reads eligible students
  GET /examinations/:id/eligibility  |  GET /subjects/:subjectId/eligible-students

CONNECTION 3 — COE → Student
  COE schedules exam  →  stored in DB  →  Student reads session info
  GET /api/student/exam-session  |  GET /api/student/instructions

CONNECTION 4 — Student → COE
  Student submits exam  →  POST /api/student/exam/submit
  Lab Server records submission  →  COE reads via GET /monitoring/sessions

CONNECTION 5 — COE → Principal / HOD
  COE approves & releases results  →  POST /results/:id/approve-release
  stored in DB  →  HOD reads via GET /hod/results
```

---

## Architecture Diagram

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Admin Portal (7)  │     │   COE Portal (7)    │     │  Student Portal     │
│  Principal & HOD    │     │  Controller of Exams│     │  (Exam Client)      │
│                     │     │                     │     │                     │
│ VITE_API_BASE_URL   │     │ VITE_API_BASE_URL   │     │ VITE_API_URL        │
│ /api/v1             │     │ /api/v1             │     │ (no prefix)         │
└────────┬────────────┘     └────────┬────────────┘     └────────┬────────────┘
         │  REST (JWT)               │  REST (JWT)               │  REST (JWT)
         │  /api/v1/principal/*      │  /api/v1/coe/*            │  /api/student/*
         │  /api/v1/hod/*            │  /api/v1/monitoring/*     │  /api/security/*
         │  (non-local)              │                           │  /api/instructor/*
         │                           │                           │  /api/recovery/*
         ▼                           ▼                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Central Java Spring Boot Backend                        │
│          Dev:  http://localhost:8080                                         │
│          Prod: http://192.168.1.100:8080                                     │
│                                                                              │
│  Shared DB (PostgreSQL / MySQL) — single source of truth for all portals    │
└──────────────────────────────────────────────────────────────────────────────┘
         │
         │ Local (Admin portal only — same Express process)
         ▼
┌─────────────────────────────────┐
│  Admin Express Doc-Conversion   │
│  /api/v1/hod/student-lists/...  │
│  /api/v1/hod/question-banks/... │
│  /api/v1/hod/subjects/*/        │
│       course-outcomes           │
└─────────────────────────────────┘

         COE Portal also connects to:
┌─────────────────────────────────┐
│  Lab Server (per lab)           │
│  VITE_LAB_API_BASE_URL          │
│  Dev/Prod: 192.168.10.50:8443   │
│  /lab-api/v1/...                │
└─────────────────────────────────┘
```

---

## Security Notes

- All portals use **JWT Bearer tokens** in the `Authorization` header.
- Tokens are stored in `localStorage` (key varies per portal — see endpoint audit).
- The Admin doc-conversion Express server should validate the same JWT before serving local routes.
- In production the central backend IP (`192.168.1.100`) should be reachable from all lab machines and admin workstations on the **same LAN**.
- The Lab Server (`192.168.10.50:8443`) is a fixed LAN address; it is the same in both dev and prod.

---

## Adding a New Portal

1. Add `.env.development` and `.env.production` to the portal root.
2. Use `VITE_API_BASE_URL=http://localhost:8080/api/v1` (dev) and the production IP equivalent.
3. Use `Authorization: Bearer <token>` for all authenticated requests.
4. Do **not** hardcode any URLs inside source files — use `import.meta.env.VITE_*` only.
