# MIT Mysore Examination Management System
## Docker Integration Test & Healthcheck Report

**Test Execution Date**: 2026-11-23  
**Environment**: Docker Desktop 28+ (WSL2 Ubuntu, Linux/amd64)  
**Host**: Windows 11  
**Test Suite**: `CampusExam/test_docker_stack.py`  
**Total Tests**: 18  
**Passed**: 18 (100%)  
**Failed**: 0  

---

### 1. Test Summary Matrix

| # | Test Area | Target Component / URL | Result | Verification Evidence |
|---|---|---|---|---|
| 1 | Admin Portal HTTP Delivery | `http://127.0.0.1:3000/` | **PASS** | HTTP 200, Nginx serves index.html with #root and env.js script |
| 2 | Admin Portal env.js Delivery | `http://127.0.0.1:3000/env.js` | **PASS** | HTTP 200, dynamic runtime `window.__ENV__` object injected |
| 3 | COE Portal HTTP Delivery | `http://127.0.0.1:3001/` | **PASS** | HTTP 200, Nginx serves index.html with #root and env.js script |
| 4 | COE Portal env.js Delivery | `http://127.0.0.1:3001/env.js` | **PASS** | HTTP 200, dynamic runtime `window.__ENV__` object injected |
| 5 | Student Portal HTTP Delivery | `http://127.0.0.1:3002/` | **PASS** | HTTP 200, Nginx serves index.html with #root and env.js script |
| 6 | Student Portal env.js Delivery | `http://127.0.0.1:3002/env.js` | **PASS** | HTTP 200, dynamic runtime `window.__ENV__` object injected |
| 7 | Central Backend Root Healthcheck | `http://127.0.0.1:8081/health` | **PASS** | HTTP 200, returns `{"status":"ok","service":"CentralBackend"}` |
| 8 | Central Backend API Healthcheck | `http://127.0.0.1:8081/api/v1/health` | **PASS** | HTTP 200, returns `{"success":true,"message":"System operational"}` |
| 9 | Lab Server Healthcheck | `http://127.0.0.1:8082/health` | **PASS** | HTTP 200, returns `{"status":"ok","labId":"LAB-CSE-01"}` |
| 10 | Admin Authentication | `POST /api/v1/auth/login` | **PASS** | Validated `admin` / `ADMIN@7157`, generated 64-char Bearer token |
| 11 | Principal Authentication | `POST /api/v1/auth/login` | **PASS** | Validated `principal` / `PRINCIPAL@7658`, generated Bearer token |
| 12 | COE Authentication | `POST /api/v1/auth/coe/login` | **PASS** | Validated `coe` / `COE@5828`, generated Bearer token |
| 13 | HOD Authentication | `POST /api/v1/auth/login` | **PASS** | Validated `hod.cse` / `CSE@2109`, generated Bearer token |
| 14 | Central Admin Protected API | `GET /api/v1/principal/departments` | **PASS** | HTTP 200 with Bearer auth, successfully returned 12 departments |
| 15 | Central COE Protected API | `GET /api/v1/examinations` | **PASS** | HTTP 200 with Bearer auth, successfully returned 18 examination records |
| 16 | Lab Server Package API | `GET /lab-api/package/list` | **PASS** | HTTP 200, package storage and querying operational |
| 17 | Lab Server Nodes API | `GET /lab-api/labs/servers` | **PASS** | HTTP 200, node discovery responsive |
| 18 | Student Login Security Guard | `POST /lab-api/student/login` | **PASS** | HTTP 401: Invalid credentials guard enforced when sitting inactive |

---

### 2. Real-Time & SSE Streaming Verification

- **Central SSE Endpoint**: `GET /api/v1/events?token=<TOKEN>`
- **Response Status**: HTTP 200
- **Content-Type**: `text/event-stream; charset=UTF-8`
- **Initial Stream Output**: `event: connected`
- **Result**: PASSED. Multi-client real-time synchronization is fully operational.

---

### 3. Container Restart & Data Persistence Verification

1. **Containers Clean Stop & Restart**:
   - `docker compose stop` cleanly terminated all 6 containers with exit code 0.
   - `docker compose start` re-initialized all services.
   - All 6 containers returned to `healthy` status within 15 seconds.

2. **Database Record Persistence**:
   - `student_roster`: 45 records preserved across restart.
   - `department`: 12 records preserved across restart.
   - `bank`: 2 records preserved across restart.
   - `student_session_result`: 30 records preserved across restart.

3. **Key Isolation & Verification**:
   - `campusexam-central`:
     - Holds `central_private.key` (1216 bytes)
     - Holds `central_public.key` (294 bytes)
     - Holds `lab_public.key` (294 bytes)
     - `lab_private.key` is strictly absent.
   - `campusexam-lab`:
     - Holds `lab_private.key` (1217 bytes)
     - Holds `lab_public.key` (294 bytes)
     - Holds `central_public.key` (294 bytes)
     - `central_private.key` is strictly absent.
