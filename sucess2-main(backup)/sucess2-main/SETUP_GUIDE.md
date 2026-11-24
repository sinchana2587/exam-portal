# Maharaja Institute of Technology Mysore — Offline EMS
## Teammate Local Development Setup Guide

This guide describes how to run the complete Examination Management System (all 3 web portals, Central Java Backend, Independent Lab Server, and PostgreSQL database) on a single Windows laptop after cloning the repository.

---

### Prerequisites

Install the following software on your laptop before starting:

1. **Java Development Kit (JDK 17 or higher)**
   * Verify by opening PowerShell and running:
     ```cmd
     java -version
     javac -version
     ```
   * Ensure `javac` and `java` are available in your `PATH`.
2. **Node.js (v18.x or v20.x LTS)**
   * Verify by running:
     ```cmd
     node -v
     npm -v
     ```
3. **PostgreSQL (v15, v16, or v17)**
   * Download and install from [postgresql.org](https://www.postgresql.org/download/windows/) if not installed.
   * Ensure the PostgreSQL service is running on the standard port `5432`.
   * Add PostgreSQL's `bin` folder (e.g. `C:\Program Files\PostgreSQL\16\bin`) to your user or system `PATH`.
4. **Git**
   * Installed for cloning the repository.

---

### Quick Start (3 Steps)

#### Step 1: Clone the Repository
```powershell
git clone https://github.com/DHANUSHKN0007/OFFLINE-EXAM.git
cd OFFLINE-EXAM
```

#### Step 2: Initialize the PostgreSQL Database
Open PowerShell in the project root and run:
```powershell
.\init_database.ps1
```
*What this script does automatically:*
* Connects to your local PostgreSQL server on port `5432`.
* Creates the required application user `campusexam` (password: `password`).
* Creates the isolated database `campusexam_test`.
* Restores the complete schema, tables, and seed dataset from `CampusExam\database_dump.sql`.

#### Step 3: Launch All Five Services
Run the unified launcher:
```powershell
.\start_all.ps1
```
*What this script does automatically:*
1. Checks for required JDK and Node.js tools on `PATH`.
2. Automatically compiles `CampusExam.java` and `LabServer.java` if `build_dev` classes are missing.
3. Automatically installs all missing npm packages for the three portals using their exact lockfiles.
4. Starts the **Central Java Backend** on port `8081` (connected to `campusexam_test`).
5. Starts the **Independent Lab Server** on port `8082` (offline node `LAB-CSE-01`).
6. Starts the **Admin / HOD Portal** on `http://localhost:3000`.
7. Starts the **COE Portal** on `http://localhost:3001`.
8. Starts the **Student Examination Portal** on `http://localhost:3002`.

---

### Service Matrix & URLs

| Subsystem | Port / URL | Purpose | Default Credentials |
| :--- | :--- | :--- | :--- |
| **Admin / HOD Portal** | `http://localhost:3000` | Principal & HOD management, setup classes, question bank | Sign in using assigned Principal or HOD accounts |
| **COE Portal** | `http://localhost:3001` | Scheduling, paper shuffling, versioning, result approval | `coe@mitmysore.in` |
| **Student Portal** | `http://localhost:3002` | Air-gapped student workstation exam interface | Use candidate USN + Date of Birth (e.g. `4MH21CS001` / `2003-05-15`) |
| **Central Backend** | `http://127.0.0.1:8081` | Central REST API & PostgreSQL persistence | Health check: `http://127.0.0.1:8081/health` |
| **Lab Server** | `http://127.0.0.1:8082` | Air-gapped exam execution, local evaluation | Health check: `http://127.0.0.1:8082/health` |

---

### Stopping the Services

To cleanly stop all running background processes and free the ports, run:
```powershell
.\stop_all.ps1
```

---

### Troubleshooting Tips

* **`psql: command not found` during Step 2:**
  Add PostgreSQL's `bin` folder to your PATH. For example:
  ```powershell
  $env:PATH += ";C:\Program Files\PostgreSQL\16\bin"
  ```
* **FATAL: database "campusexam_test" does not exist:**
  Make sure you ran `.\init_database.ps1`. The Central Java Backend enforces connection strictly to `campusexam_test` for isolation safety.
* **Port conflicts (e.g. port 8081 or 3000 in use):**
  Run `.\stop_all.ps1` before starting, or verify listening processes via:
  ```powershell
  Get-NetTCPConnection -LocalPort 8081, 8082, 3000, 3001, 3002 -State Listen
  ```
* **Node dependency installation:**
  If you ever update branches or package files, you can manually re-install dependencies by running `npm ci` inside:
  * `admin-portal (7)`
  * `coe-portal (7)`
  * `student-portal (Final)\student-portal (Final)\student-portal`
