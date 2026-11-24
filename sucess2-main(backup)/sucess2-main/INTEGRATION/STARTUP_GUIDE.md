# MIT Mysore EMS — Startup & Deployment Guide

**Project:** Maharaja Institute of Technology Mysore — Examination Management System  
**Three portals unified to one backend, one database.**

---

## Quick Start (Development)

### Prerequisites
- Node.js 18+
- PostgreSQL 16 (Running on `localhost:5432`, user: `postgres`, password: `postgres`)

### Automated 1-Click Launch
Double-click [`start_all.bat`](file:///c:/Users/Dhanush%20K%20N/Downloads/ALL%203%20PORTALS/start_all.bat) or run `.\start_all.ps1` in PowerShell. This automatically launches:
1. Unified Central Backend on Port 8080 (connected to PostgreSQL `mitm_ems`)
2. Admin Portal on Port 3000
3. COE Portal on Port 3001
4. Student Portal on Port 3002

---

### Manual Launch

#### Step 1 — Start the Unified Central Backend (:8080)

```bash
cd "backend"
# Initialize PostgreSQL schema and seed data (first time only)
npm run init-db
# Start the backend server
npm start
```

The backend connects to PostgreSQL database **`mitm_ems`** and listens at **`http://localhost:8080`**.

#### Step 2 — Start the Admin Portal (Principal / HOD)

```bash
cd "admin-portal (7)"
npm run dev
```
Accessible at: `http://localhost:3000` (or `http://localhost:5173`)

#### Step 3 — Start the COE Portal

```bash
cd "coe-portal (7)"
npm run dev
```
Accessible at: `http://localhost:3001`

#### Step 4 — Start the Student Portal

```bash
cd "student-portal (Final)/student-portal (Final)/student-portal"
npm run dev
```
Accessible at: `http://localhost:3002`

---

## Environment Variables

### Admin Portal (`admin-portal (7)/.env.development`)
```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

### COE Portal (`coe-portal (7)/.env.development`)
```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_LAB_API_BASE_URL=http://192.168.10.50:8443/lab-api/v1
```

### Student Portal (`.env.development`)
```env
VITE_API_URL=http://localhost:8080
VITE_LAB_API_BASE_URL=http://localhost:8080
VITE_API_TIMEOUT_MS=8000
VITE_API_MODE=integration
```

---

## Production Deployment

Change all instances of `192.168.1.100` to your production server IP.

### Admin Portal (`admin-portal (7)/.env.production`)
```env
VITE_API_BASE_URL=http://192.168.1.100:8080/api/v1
```

### COE Portal (`coe-portal (7)/.env.production`)
```env
VITE_API_BASE_URL=http://192.168.1.100:8080/api/v1
VITE_LAB_API_BASE_URL=http://192.168.10.50:8443/lab-api/v1
```

### Student Portal (`.env.production`)
```env
VITE_API_URL=http://192.168.1.100:8080
VITE_LAB_API_BASE_URL=http://192.168.1.100:8080
VITE_API_TIMEOUT_MS=10000
VITE_API_MODE=integration
```

### Production build commands
```bash
# Admin Portal
cd "admin-portal (7)"
npm run build

# COE Portal
cd "coe-portal (7)"
npm run build

# Student Portal
cd "student-portal (Final)/student-portal (Final)/student-portal"
npm run build
```

---

## Role Credentials

| Portal | Role | Username | Password | Login Endpoint |
|---|---|---|---|---|
| Admin Portal | PRINCIPAL | `principal` | `PRINCIPAL@7658` | `POST /api/v1/auth/login` |
| Admin Portal | HOD (CSE) | `hod.cs` | `Hod@cs123` | `POST /api/v1/auth/login` |
| COE Portal | COE | `coe` *(or `coe.mitm`)* | `COE@5828` | `POST /api/v1/auth/coe/login` |
| Student Portal | STUDENT | `4MH21CS001` | DOB: `2003-01-15` | `POST /api/student/login` |

---

## Testing the 5 Cross-Portal Connections

Once all services are running:

### Test Connection 1: COE → HOD (Exam Status)
1. Log in to COE Portal as COE
2. Navigate to Examination Scheduling → Create a new examination for Dept `CS`, Semester `3`
3. Log in to Admin Portal as HOD of `CS` department
4. Navigate to HOD → Exam Status
5. ✅ The examination created by COE should appear

### Test Connection 2: HOD → COE (Student Lists)
1. Log in to Admin Portal as HOD of `CS`, Semester `3`
2. Navigate to HOD → Setup Class → Upload a student list
3. Log in to COE Portal as COE
4. Navigate to Examination Scheduling → Select `CS`, `Semester 3`
5. ✅ Student count and USNs from HOD's upload should appear

### Test Connection 3: COE → Student (Exam Instructions)
1. COE schedules an exam and sends the package to the Lab Server
2. Log in to Student Portal as a student allocated to that exam
3. Navigate to Exam Instructions
4. ✅ Subject name, date, time, duration should match what COE configured

### Test Connection 4: Student → COE (Session Monitoring)
1. Student starts and submits their examination
2. Log in to COE Portal as COE
3. Navigate to Session Monitoring
4. ✅ The student's status should show `Submitted`

### Test Connection 5: COE → HOD (Results)
1. Log in to COE Portal as COE
2. Navigate to Result Approval → Import results → Approve and release
3. Log in to Admin Portal as HOD of the relevant department
4. Navigate to HOD → Department Results
5. ✅ Released results should appear

---

## Architecture Summary

```
Admin Portal (:5173)     COE Portal (:5174)     Student Portal (:5175)
       │                        │                         │
       │ /api/v1/*              │ /api/v1/*               │ /api/student/*
       │                        │                         │ (Lab Server)
       ▼                        ▼                         │
┌──────────────────────────────────────────┐             │
│   Java Spring Boot Backend (:8080)        │             │
│   /api/v1/auth/*                          │             │
│   /api/v1/principal/*                     │             │
│   /api/v1/hod/*                           │             │
│   /api/v1/institution/*                   │             │
│   /api/v1/examinations/*                  │             │
│   /api/v1/results/*                       │             │
└────────────────────┬─────────────────────┘             │
                     │                                    │
                     ▼                                    ▼
            ┌──────────────┐              ┌───────────────────────┐
            │  PostgreSQL  │              │  Lab Server (:8443)   │
            │  (shared DB) │◄─────────── │  /api/student/*       │
            └──────────────┘  sync       │  /monitoring/*        │
                                         │  /labs/*              │
                                         └───────────────────────┘

Admin Portal also runs Express (:3001) for PDF/OCR conversion ONLY.
```

---

## TypeScript Build Status

| Portal | Status | Errors |
|---|---|---|
| Admin Portal | ✅ Exit 0 | None |
| COE Portal | ✅ Exit 0 | None |
| Student Portal | ✅ Exit 0 | None |

Run check: `node_modules\.bin\tsc.cmd --noEmit` from each portal root.
