# CampusExam Backend Test & Remediation Report

**Date:** November 16, 2026  
**Target:** CampusExam (Java 17 HTTP API + PostgreSQL)  
**Endpoint:** `http://127.0.0.1:8080/api`  
**Test Suite:** TestSprite MCP Automated Backend Test Suite (`TC001` - `TC010`)  
**Status Summary:** 2 Backend Code Bugs Identified, 1 Passing Suite (`TC001`), 8 Fixture & Credential Blocks (`TC003`–`TC010`)

---

## 1. Executive Summary

A comprehensive automated backend test suite was generated and executed against the live CampusExam backend service via the **TestSprite MCP Server** and local test harnesses. The test suite covers authentication, role-based access control, question bank authoring and approval workflows, examination scheduling, student attempt lifecycle with optimistic concurrency, and proctor monitoring.

### Discovered Issues Breakdown

| Category | Count | Status | Impact |
| :--- | :---: | :---: | :--- |
| **Backend Code Defects** | 2 | Actionable Fix Ready | High: Security/validation bypass in `/api/accounts`, schema property naming mismatch in `/api/my-scopes`. |
| **Test Fixture Dependencies** | 8 | Actionable Seed Ready | Medium: Tests `TC003`–`TC010` require pre-seeded `FACULTY`, `STUDENT`, and `OBSERVER` accounts and group mappings. |
| **Credential Harmonization** | 8 | Actionable Env Ready | Low: Tests defaulted to `admin123`/`faculty123` instead of the local bootstrap password `password1234`. |

---

## 2. Test Execution Breakdown (TC001 – TC010)

| Test ID | Scope | Target Endpoint(s) | Execution Status | Root Cause & Remediation |
| :--- | :--- | :--- | :---: | :--- |
| **TC001** | Health, Authentication, Profile, Audit, Logout | `/health`, `/login`, `/me`, `/audit`, `/logout` | ✅ **PASSED** *(with env)* | Fallback password mismatch (`admin123` vs `password1234`). Passing with `CAMPUSEXAM_PASSWORD=password1234`. |
| **TC002** | Institutional Administration & Access Control | `/groups`, `/subjects`, `/accounts`, `/faculty-scopes` | ❌ **FAIL (CODE DEFECT)** | `POST /accounts` allows `role="INVALID_ROLE"` returning `200 OK` (`{"id":61}`) instead of `400 Bad Request`. |
| **TC003** | Faculty Scopes & Question Bank Creation | `/my-scopes`, `/banks`, `/questions` | ❌ **FAIL (FIXTURE & CODE)** | 1. Missing `faculty` account. 2. `GET /my-scopes` returns `id` for academic group without `group_id` alias. |
| **TC004** | Question Bank State Approval Transitions | `/banks`, `/bank-state` (`DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `APPROVED`) | ❌ **FAIL (FIXTURE & CODE)** | Password mismatch (`admin123`) & `/my-scopes` missing `group_id` alias. |
| **TC005** | Exam Publication & Rules Validation | `/publish`, `/exams`, `/groups` | ❌ **FAIL (FIXTURE)** | Requires pre-existing approved question bank and student assigned to target group. |
| **TC006** | Student Exam Start & Answer Masking | `/exams`, `/start` | ❌ **FAIL (FIXTURE)** | Requires `STUDENT_USERNAME` and `STUDENT_PASSWORD` environment variables and active exam. |
| **TC007** | Answer Autosave & Optimistic Concurrency | `/answer`, `/attempt` | ❌ **FAIL (FIXTURE)** | Requires student credentials and started exam attempt. |
| **TC008** | Heartbeat Telemetry & Attempt Submission | `/heartbeat`, `/submit` | ❌ **FAIL (FIXTURE)** | Requires student credentials and running exam attempt. |
| **TC009** | Exam Score Release & Key Unmasking | `/release`, `/attempt` | ❌ **FAIL (FIXTURE)** | Requires `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `STUDENT_USERNAME`, `STUDENT_PASSWORD`. |
| **TC010** | Proctor Monitoring Telemetry | `/monitor` | ❌ **FAIL (FIXTURE)** | Requires `OBSERVER_USERNAME` and `OBSERVER_PASSWORD`. |

---

## 3. Discovered Backend Code Defects & Patches

### Defect 1: Missing Role Whitelist Validation in `POST /api/accounts`
- **Location:** [`CampusExam.java` line 1803](file:///c:/Users/Vaishak%20M/Downloads/proj/CampusExam-Java-PostgreSQL/CampusExam/CampusExam.java#L1803) (inside `legacySetup` method)
- **Description:** When an administrator creates an account via `POST /api/accounts`, the backend accepts arbitrary strings for the `role` field (e.g., `"INVALID_ROLE"`) without validating against the supported role set. The database schema constraint `account_role_check` was previously dropped via `ALTER TABLE account DROP CONSTRAINT IF EXISTS account_role_check;` in `schema.sql`, allowing invalid roles to persist and returning `200 OK` (`{"id":61}`) instead of `400 Bad Request`.
- **Reproduction:**
  ```bash
  curl -s -X POST http://127.0.0.1:8080/api/accounts \
    -H "Authorization: Bearer <ADMIN_TOKEN>" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=invalid_user&password=password1234&role=INVALID_ROLE"
  ```
  *Actual:* HTTP 200 `{"id":61}`  
  *Expected:* HTTP 400 `{"error":"Invalid account role: INVALID_ROLE"}`

- **Code Patch (`CampusExam.java`):**
  ```java
  <<<<
              case "accounts" -> {
                  String password = form.get("password");
                  validatePassword(password);
                  String role = form.need("role");
                  entity = insert(db, "INSERT INTO account(username,password_hash,role,group_id) VALUES(?,?,?,?)",
                      form.need("username").toLowerCase(Locale.ROOT), passwordHash(password), role,
                      role.equals("STUDENT") ? form.id("group") : null);
              }
  ====
              case "accounts" -> {
                  String password = form.get("password");
                  validatePassword(password);
                  String role = form.need("role").toUpperCase(Locale.ROOT);
                  Set<String> validRoles = Set.of("ADMIN", "FACULTY", "STUDENT", "OBSERVER", "PRINCIPAL", "HOD", "COE", "LAB_ADMIN");
                  check(validRoles.contains(role), 400, "Invalid account role: " + role);
                  entity = insert(db, "INSERT INTO account(username,password_hash,role,group_id) VALUES(?,?,?,?)",
                      form.need("username").toLowerCase(Locale.ROOT), passwordHash(password), role,
                      role.equals("STUDENT") ? form.id("group") : null);
              }
  >>>>
  ```

---

### Defect 2: Missing `group_id` Property in `GET /api/my-scopes`
- **Location:** [`CampusExam.java` line 2046](file:///c:/Users/Vaishak%20M/Downloads/proj/CampusExam-Java-PostgreSQL/CampusExam/CampusExam.java#L2046) (inside `legacyBankRead` method)
- **Description:** The query `SELECT g.*,s.id AS subject_id,s.name AS subject FROM faculty_scope f JOIN academic_group g ON g.id=f.group_id JOIN subject s ON s.id=f.subject_id WHERE f.faculty_id=?` returns `g.id` as `"id"`. Test cases (`TC003`, `TC004`) and client contracts expect either `"group_id"` or `"groupId"` in the scope object, causing `assert group_id is not None` to fail.
- **Code Patch (`CampusExam.java`):**
  ```java
  <<<<
          if (path.equals("my-scopes")) {
              user.require("FACULTY");
              return rows(db, """
                  SELECT g.*,s.id AS subject_id,s.name AS subject
                  FROM faculty_scope f JOIN academic_group g ON g.id=f.group_id
                  JOIN subject s ON s.id=f.subject_id WHERE f.faculty_id=? ORDER BY g.id,s.id
                  """, user.id());
          }
  ====
          if (path.equals("my-scopes")) {
              user.require("FACULTY");
              return rows(db, """
                  SELECT g.id AS group_id, g.*, s.id AS subject_id, s.name AS subject
                  FROM faculty_scope f JOIN academic_group g ON g.id=f.group_id
                  JOIN subject s ON s.id=f.subject_id WHERE f.faculty_id=? ORDER BY g.id,s.id
                  """, user.id());
          }
  >>>>
  ```

---

## 4. Test Fixtures & Environment Remediation

### 1. Seed Accounts & Scope Setup
To satisfy requirements for `TC003` through `TC010`, the following database entities must be seeded via the API:
1. **Academic Group:** Department `"Computer Science"`, session `"2025-26"`, study year `4`, semester `8`, section `"A"`.
2. **Subject:** Name `"Software Testing and Quality Assurance"`.
3. **Faculty Account:** Username `faculty`, password `password1234`, role `FACULTY`.
4. **Faculty Scope:** Link `faculty` to the created group and subject.
5. **Student Account:** Username `student`, password `password1234`, role `STUDENT`, assigned to the group.
6. **Observer Account:** Username `observer`, password `password1234`, role `OBSERVER`.

### 2. Standardized Environment Variables
The test runners should be invoked with harmonized credentials:
```powershell
$env:CAMPUSEXAM_USERNAME = "admin"
$env:CAMPUSEXAM_PASSWORD = "password1234"
$env:CAMPUS_ADMIN_USERNAME = "admin"
$env:CAMPUS_ADMIN_PASSWORD = "password1234"
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = "password1234"
$env:TEST_ADMIN_USERNAME = "admin"
$env:TEST_ADMIN_PASSWORD = "password1234"
$env:FACULTY_USERNAME = "faculty"
$env:FACULTY_PASSWORD = "password1234"
$env:TEST_FACULTY_USERNAME = "faculty"
$env:TEST_FACULTY_PASSWORD = "password1234"
$env:STUDENT_USERNAME = "student"
$env:STUDENT_PASSWORD = "password1234"
$env:OBSERVER_USERNAME = "observer"
$env:OBSERVER_PASSWORD = "password1234"
```

### 3. Global Antigravity MCP Discovery
Copy the configuration from `C:\Users\Vaishak M\.gemini\antigravity\mcp_config.json` to `C:\Users\Vaishak M\.gemini\config\mcp_config.json` so that TestSprite tools are permanently discovered in Antigravity.

---

## 5. Antigravity Remediation Execution Instructions

When user grants permission to proceed, Antigravity will execute the following steps:

1. **Apply Code Edits:**
   - Edit [`CampusExam.java`](file:///c:/Users/Vaishak%20M/Downloads/proj/CampusExam-Java-PostgreSQL/CampusExam/CampusExam.java) at line 1803 to enforce role whitelist validation.
   - Edit [`CampusExam.java`](file:///c:/Users/Vaishak%20M/Downloads/proj/CampusExam-Java-PostgreSQL/CampusExam/CampusExam.java) at line 2046 to include `g.id AS group_id`.

2. **Recompile & Restart Daemon:**
   - Terminate current background task (`task-169`).
   - Run `javac --release 17 -d build CampusExam.java`.
   - Start backend daemon: `powershell.exe -Command "& { & '.\run.ps1' }"`.

3. **Provision Test Fixtures:**
   - Execute fixture seeding via API to create `faculty`, `student`, `observer` accounts and mappings.

4. **Synchronize MCP Config:**
   - Copy MCP configuration to `~/.gemini/config/mcp_config.json`.

5. **Re-run Test Suite:**
   - Run `TC001` through `TC010` with the complete set of environment variables and verify 100% pass rate.
