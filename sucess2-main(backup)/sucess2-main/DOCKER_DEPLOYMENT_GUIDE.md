# MIT Mysore Offline Examination Management System
## Docker Deployment Guide

### 1. Overview & Architecture

The Maharaja Institute of Technology Mysore (MIT Mysore) Examination Management System (EMS) is a fully containerized, air-gap capable, and cryptographically verified examination system.

The deployment consists of 6 integrated services running via Docker Compose on Linux containers (amd64 / WSL2):

```
+-----------------------------------------------------------------------------------+
|                               COLLEGE LOCAL AREA NETWORK                          |
|                                                                                   |
|  [Admin / Principal / HOD]         [Controller of Exams]        [Lab Students]    |
|   Browser: Port 3000                Browser: Port 3001           Browser: Port 3002
+-----------|----------------------------------|---------------------------|--------+
            |                                  |                           |
+-----------v----------------------------------v---------------------------v--------+
|                               DOCKER COMPOSE RUNTIME                              |
|                                                                                   |
|   +-----------------------+      +-----------------------+     +----------------+ |
|   |  campusexam-admin-    |      |  campusexam-coe-      |     |campusexam-     | |
|   |  portal (Nginx :80)   |      |  portal (Nginx :80)   |     |student-portal  | |
|   |  Host Port: 3000      |      |  Host Port: 3001      |     |(Nginx :80) :3002 |
|   +-----------|-----------+      +-----------|-----------+     +--------|-------+ |
|               |                              |                          |         |
|               v                              v                          |         |
|   +----------------------------------------------+                      |         |
|   |        campusexam-central (Java 17)          |<---------+           |         |
|   |               Host Port: 8081                |          |           |         |
|   +----------------------|-----------------------+          |           |         |
|                          |                       | (Import  |           |         |
|                          v                       |  Results)|           v         |
|   +--------------------------------+             |  (RO)    |  +----------------+ |
|   |     campusexam-postgres        |             +----------+--|campusexam-lab  | |
|   |    (PostgreSQL 16-alpine)      |                           |(Java 17 Runtime| |
|   |  Internal Only: port 5432      |                           |Host Port: 8082 | |
|   +--------------------------------+                           +----------------+ |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

---

### 2. Service Summary & Port Allocations

| Container Name | Service | Internal Port | Host Port | Technology | Healthcheck |
|---|---|---|---|---|---|
| `campusexam-postgres` | Database | 5432 | None (Internal) | PostgreSQL 16 Alpine | `pg_isready -U campusexam -d campusexam_test` |
| `campusexam-central` | Central Backend | 8081 | 8081 | Java 17 (Temurin JRE) | `wget -qO- http://127.0.0.1:8081/health` |
| `campusexam-lab` | Lab Server | 8082 | 8082 | Java 17 (Temurin JRE) | `wget -qO- http://127.0.0.1:8082/health` |
| `campusexam-admin-portal` | Admin / HOD Portal | 80 | 3000 | Nginx Alpine (Vite SPA) | `wget -qO- http://127.0.0.1/` |
| `campusexam-coe-portal` | COE Portal | 80 | 3001 | Nginx Alpine (Vite SPA) | `wget -qO- http://127.0.0.1/` |
| `campusexam-student-portal` | Student Portal | 80 | 3002 | Nginx Alpine (Vite SPA) | `wget -qO- http://127.0.0.1/` |

---

### 3. Quick Start (Production)

#### Prerequisites
- Windows 10/11 with Docker Desktop (WSL 2 backend) OR Linux with Docker Engine 24+ & Docker Compose v2.
- Pre-loaded offline Docker images or existing build files.

#### Step 1 — Copy Configuration
```powershell
Copy-Item .env.example .env
```
Ensure `.env` matches your database password and network configuration.

#### Step 2 — Start the Full Stack
```powershell
.\docker_start.ps1
# Or directly via Compose:
docker compose up -d
```

#### Step 3 — Verify Running Services
```powershell
docker compose ps
```
All 6 services will report status `healthy`.

#### Step 4 — Run End-to-End Health Verification
```powershell
python CampusExam/test_docker_stack.py
```

---

### 4. Stopping the System

```powershell
.\docker_stop.ps1
# Or directly via Compose:
docker compose stop
```
> [!IMPORTANT]
> Never run `docker compose down -v` or `docker volume prune`. The production database and cryptographic keys reside in named volumes that must persist across system restarts.

---

### 5. LAN Deployment (Access from Other PCs / Laptops)

To enable access across the college intranet / examination lab LAN:

1. Determine the Central Server host LAN IP (e.g., `192.168.1.50`):
   ```powershell
   ipconfig
   ```

2. Open incoming firewall ports on the host:
   ```powershell
   New-NetFirewallRule -DisplayName "MITM EMS Web" -Direction Inbound -LocalPort 3000,3001,3002 -Protocol TCP -Action Allow
   New-NetFirewallRule -DisplayName "MITM EMS API" -Direction Inbound -LocalPort 8081,8082 -Protocol TCP -Action Allow
   ```

3. Update `.env`:
   ```env
   CENTRAL_PUBLIC_URL=http://192.168.1.50:8081/api/v1
   LAB_PUBLIC_URL=http://192.168.1.50:8082
   ```

4. Restart containers:
   ```powershell
   docker compose up -d
   ```

5. Access URLs from any lab machine:
   - **Admin / Principal / HOD Portal**: `http://192.168.1.50:3000`
   - **COE Portal**: `http://192.168.1.50:3001`
   - **Student Examination Portal**: `http://192.168.1.50:3002`
