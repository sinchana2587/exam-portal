# Maharaja Institute of Technology Mysore (MIT Mysore)
## Autonomous Examination Management System (EMS)

A comprehensive, offline-first examination management platform designed for autonomous engineering institutions. Built with zero cloud runtime dependencies, air-gapped cryptographic validation, multi-department shared laboratory delivery, and synchronized offline lab servers.

---

## 1. System Architecture

The platform consists of six interconnected subsystems:

```
+---------------------------------------------------------------------------------------------------+
|                                             WEB PORTALS                                           |
|                                                                                                   |
|   +-----------------------+   +-------------------+   +---------------+   +-------------------+   |
|   |   HOD / Faculty /     |   |    COE Portal     |   | Student Exam  |   |     Document      |   |
|   |   Principal Portal    |   | (React 19 + Vite) |   |    Portal     |   |  Converter Server |   |
|   |  (React 19 + Express) |   |     Port 3001     |   | (React + Vite)|   |  (Express + OCR)  |   |
|   |      Port 3000        |   |                   |   |   Port 3002   |   |     Port 5001     |   |
|   +-----------+-----------+   +---------+---------+   +-------+-------+   +---------+---------+   |
+---------------|-------------------------|---------------------|---------------------|-------------+
                |                         |                     |                     |
                | REST / SSE (Port 8081)  | REST / SSE          | Offline HTTP        | Multi-format
                |                         |                     | (Port 8082)         | Word/PDF/OCR
+---------------v-------------------------v-------------+   +---v-------------------+ |
|               CENTRAL JAVA BACKEND                    |   |  ISOLATED LAB SERVER  | |
|                 (CampusExam.java)                     |   |   (LabServer.java)    | |
|                     Port 8081                         |   |       Port 8082       | |
|                                                       |   |                       | |
|   - Academic Roster & Course Outcome Engine           |   | - Authoritative Exam  | |
|   - Question Bank & 4-Set Shuffle Generator           |   |   Runtime Engine      | |
|   - Cryptographic Package Provisioning                |   | - Multi-Department    | |
|   - Result Import, RSA Verification, COE Approval     |   |   Shared Lab Cohorts  | |
|   - Multi-Format Question Archive (.xlsx/.docx/PDF)   |   | - Attempt-Scoped Lock | |
|   - Real-time SSE State Broadcast                     |   | - Signed .labresult   | |
|   - Keys: central_private.key, lab_public.key         |   | - Keys: lab_private   | |
|                                                       |<--+-----------------------+-+
+---------------------------+---------------------------+   +-----------------------+
                            | JDBC
+---------------------------v---------------------------+
|                   POSTGRESQL DATABASE                 |
|                     (Port 5432)                       |
|           Database: campusexam_test (48 Tables)       |
+-------------------------------------------------------+
```

---

## 2. Technology Stack & Requirements

| Component | Technology | Minimum Version | Tested Version |
| :--- | :--- | :--- | :--- |
| **Java JDK** | OpenJDK / Temurin | 17 LTS | Temurin-17.0.21 |
| **Node.js** | Node Runtime | 18 LTS | v26.13.0 |
| **npm** | Node Package Manager | 9.x | 11.20.0 |
| **PostgreSQL** | Relational Database | 14+ | 16.16 |
| **Frontend Framework** | React + TypeScript + Vite | React 19, Vite 8 | React 19.0.1, Vite 8.3.0 |
| **Styling** | Tailwind CSS v4 | 4.x | 4.3.3 |
| **Cryptography** | SunPKCS11 / SunJCE | RSA-2048, SHA256withRSA, PBKDF2WithHmacSHA256 (600,000 iterations) |

---

## 3. Quickstart (Windows)

### Option A: One-Command Automated Setup
Open PowerShell as Administrator (or standard user) and run:

```powershell
# 1. Clone repository
git clone https://github.com/DHANUSHKN0007/sucess2.git
cd sucess2

# 2. Run automated setup (installs npm packages, compiles Java, creates keypairs)
.\setup.ps1

# Optional: To also automatically create and seed the test database in PostgreSQL:
.\setup.ps1 -InitDatabase
```

### Option B: Start All Services
```powershell
# Single-Laptop Local Mode (Binds to 127.0.0.1)
.\start-all.ps1

# Multi-Laptop Local Network Mode (Binds to 0.0.0.0 for LAN access)
.\start-all.ps1 -Mode LAN
```

### Option C: Check Status or Stop
```powershell
.\status.ps1     # View live health of all 6 services
.\stop-all.ps1   # Cleanly terminate all running services
```

---

## 4. Quickstart (Linux / macOS)

```bash
# 1. Make scripts executable
chmod +x setup.sh start-all.sh stop-all.sh status.sh

# 2. Run setup
./setup.sh

# 3. Start services
./start-all.sh        # Local mode
./start-all.sh LAN    # Multi-laptop LAN mode

# 4. Check status or stop
./status.sh
./stop-all.sh
```

---

## 5. Portal Access URLs & Default Credentials

| Portal | URL | Role | Default Username | Default Password |
| :--- | :--- | :--- | :--- | :--- |
| **HOD (CSE)** | `http://localhost:3000` | HOD | `hod.cse` | `CSE@2109` *(or `Admin@123`)* |
| **HOD (ISE)** | `http://localhost:3000` | HOD | `hod.ise` | `ISE@3325` *(or `Admin@123`)* |
| **Principal** | `http://localhost:3000/principal` | PRINCIPAL | `principal` | `PRINCIPAL@7658` *(or `Admin@123`)* |
| **Admin** | `http://localhost:3000` | ADMIN | `admin` | `Admin@123` |
| **COE** | `http://localhost:3001` | COE | `coe` | `COE@5828` *(or `Admin@123`)* |
| **Student (CSE)** | `http://localhost:3002` | STUDENT | USN: `4MH27CS001` | DOB: `2004-01-01` |
| **Student (ISE)** | `http://localhost:3002` | STUDENT | USN: `4MH24IS001` | DOB: `2004-02-01` |
| **Doc Converter API** | `http://localhost:5001` | SERVICE | - | - |

*Note: In LAN mode, replace `localhost` with the host computer's LAN IP address (e.g. `http://192.168.1.50:3000`). The frontends automatically resolve backend API addresses relative to the current browser hostname.*

---

## 6. Database Initialization & Seeding

The application requires PostgreSQL. Configuration is managed via `.env`:

```env
DB_URL=jdbc:postgresql://localhost:5432/campusexam_test
DB_USER=campusexam
DB_PASSWORD=password
DB_NAME=campusexam_test
ALLOW_ANY_DB=true
```

### Manual Database Setup (if not using `setup.ps1 -InitDatabase`)
```bash
# 1. Create database and user
psql -U postgres -c "CREATE USER campusexam WITH PASSWORD 'password';"
psql -U postgres -c "CREATE DATABASE campusexam_test OWNER campusexam;"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE campusexam_test TO campusexam;"

# 2. Execute consolidated DDL schema (48 tables, indexes, constraints, triggers)
psql -U campusexam -d campusexam_test -f CampusExam/schema.sql

# 3. Execute synthetic demo data (11 departments, demo accounts, synthetic students, labs)
psql -U campusexam -d campusexam_test -f CampusExam/seed_demo_data.sql
```

---

## 7. Cryptographic Key Management

The system enforces strict cryptographic isolation between Central Backend and Lab Server:

1. **Central Backend (`CampusExam/keys/`):**
   - Holds `central_private.key` (RSA 2048-bit PKCS#8 private key)
   - Holds `central_public.key` (RSA 2048-bit X.509 public key)
   - Holds `lab_public.key` (Trusts Lab Server signatures)
   - **Enforcement:** Central Backend strictly removes any `lab_private.key` found in its keystore on startup.

2. **Lab Server (`CampusExam/lab_server_keys/`):**
   - Holds `lab_private.key` (Signs `.labresult` packages)
   - Holds `lab_public.key`
   - Holds `central_public.key` (Verifies packages exported by COE)
   - **Enforcement:** Lab Server strictly removes any `central_private.key` found in its keystore on startup.

3. **Key Initialization:**
   Running `setup.ps1` or `./setup.sh` automatically generates fresh 2048-bit RSA keypairs if missing and cross-registers the public keys. You can also re-initialize keys anytime:
   ```bash
   cd CampusExam
   java -cp "build_dev:lib/postgresql.jar:src" CampusExam --init-keys
   java -cp "build_dev" LabServer --init-keys
   ```

---

## 8. Multi-Laptop LAN Arrangement (Lab Deployment)

To run the examination system across physical workstations in a computer laboratory:

### Host Computer (Lab Server / Invigilator Laptop):
1. Connect all laptops to the same laboratory Wi-Fi router or Ethernet switch.
2. Run on the host laptop:
   ```powershell
   .\start-all.ps1 -Mode LAN
   ```
3. Allow incoming connections on Windows Firewall (or run PowerShell as Admin):
   ```powershell
   New-NetFirewallRule -DisplayName "MITM-EMS Ports" -Direction Inbound -LocalPort 3000,3001,3002,8081,8082 -Protocol TCP -Action Allow
   ```

### Client Workstations (Student PCs):
- Open Chrome, Edge, or Firefox and navigate to:
  `http://<HOST_LAN_IP>:3002`
- The student portal communicates directly with the host's Lab Server without needing any local backend.

### Invigilator / COE Laptops:
- Open browser to `http://<HOST_LAN_IP>:3001` for real-time sitting unlock passwords, credential sync status, and candidate monitoring.

---

## 9. End-to-End Examination Workflow

```
1. HOD Portal (Port 3000)
   └── Uploads syllabus questions / Word documents -> Smart Parser creates Question Bank
   └── Finalizes Question Bank and Publishes Question Sets (Versions A, B, C, D)

2. COE Portal (Port 3001)
   └── Schedules Examination: Selects Subject, Date, Sitting (Morning/Afternoon), Lab (ROBOTICS-09)
   └── Generates Invigilator Sitting Unlock Credential
   └── Exports Secure Examination Package to Lab Server

3. Student Portal (Port 3002)
   └── Candidate enters USN and Date of Birth
   └── Enters Invigilator Sitting Unlock Password
   └── Examination Interface locks fullscreen; tracks window focus
   └── Candidate answers 30 questions; clicks Submit Examination -> Receives Digital Receipt

4. Lab Server (Port 8082)
   └── Auto-grades submissions against cryptographic answer keys
   └── Computes scores, highest marks, average, pass percentage
   └── Generates signed .labresult package with RSA-2048 signature

5. COE Portal (Port 3001)
   └── Imports .labresult package
   └── Central Backend verifies RSA signature against lab_public.key
   └── COE reviews statistical breakdown -> Clicks "Approve Results" -> Clicks "Release Results"

6. HOD & Principal Dashboards (Port 3000)
   └── Released results instantly reflect on HOD and Principal analytics dashboards
```

---

## 10. Troubleshooting Guide

| Issue | Root Cause | Resolution |
| :--- | :--- | :--- |
| `Port 3000 / 3001 / 8081 already in use` | Stale background Node or Java process | Run `.\stop-all.ps1` (or `fuser -k <port>/tcp` on Linux). |
| `FATAL: password authentication failed for user "campusexam"` | PostgreSQL user credentials mismatch | Check `DB_USER` and `DB_PASSWORD` in `.env`. By default: `campusexam / password`. |
| `Database campusexam_test does not exist` | Database not initialized | Run `.\setup.ps1 -InitDatabase` or execute `psql -c "CREATE DATABASE campusexam_test;"`. |
| `Cannot find lab_public.key` | Keypair not yet initialized | Run `java -cp build_dev CampusExam --init-keys`. |
| `CORS error on client laptop in LAN mode` | Host bound to 127.0.0.1 instead of 0.0.0.0 | Start services with `.\start-all.ps1 -Mode LAN`. Ensure Windows Firewall allows ports 3000-3002, 8081-8082. |
| `Student sees "Authentication session expired"` | Student USN/DOB not in roster or sitting inactive | Check that the sitting is exported and candidate USN is listed in `CampusExam/seed_demo_data.sql`. |

---

## 11. Verification Commands

Compile Java services:
```powershell
cd CampusExam
javac -d build_dev -cp 'lib/postgresql.jar;src' CampusExam.java LabServer.java
```

Build all three frontends for production:
```powershell
cd "admin-portal (7)"; npm run build; cd ..
cd "coe-portal (7)"; npm run build; cd ..
cd "student-portal (Final)/student-portal (Final)/student-portal"; npm run build; cd ../../..
```
