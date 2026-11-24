# MIT Mysore Examination Management System
## Offline Deployment & Air-Gap Execution Guide

### 1. Air-Gap Architecture & Principles

The MIT Mysore EMS is engineered to run in an entirely offline, air-gapped laboratory environment:

1. **No External Internet Access Required**:
   - `pull_policy: never` is configured across all services in `compose.yaml`.
   - All Docker images (`campusexam-central`, `campusexam-lab`, `campusexam-admin-portal`, `campusexam-coe-portal`, `campusexam-student-portal`, `postgres:16-alpine`) are pre-built and packaged locally.
   - Frontend web portals serve pre-bundled static assets via Nginx. Fonts, UI icons, and styles are bundled within the dist bundles.

2. **Isolated Laboratory Server Operations**:
   - The Lab Server operates autonomously during examination sittings.
   - Student workstations communicate strictly with the Lab Server on port 8082.
   - Even if the Central Backend network link drops during an exam, the Lab Server continues serving questions, saving answers, handling student disconnects, and conducting the examination session without disruption.

3. **Cryptographic Air-Gap Transfer**:
   - Examination packages (.json) exported by COE are RSA-signed and AES-256-GCM encrypted. They can be transferred to the Lab Server via secure physical USB drive or local LAN.
   - Results packages (.labresult) generated after exam conclusion are digitally signed by the Lab Server's private key and can be physically imported into Central Backend by the COE.

---

### 2. Exporting Docker Images for an Air-Gapped Machine

To move the entire EMS deployment to an air-gapped examination server without internet access:

#### Step 1: Export Images to Tar Archive (On Connected / Build Machine)
```powershell
docker save -o mitm-ems-images.tar `
  postgres:16-alpine `
  campusexam-central:latest `
  campusexam-lab:latest `
  campusexam-admin-portal:latest `
  campusexam-coe-portal:latest `
  campusexam-student-portal:latest
```

#### Step 2: Export Volumes / Data & Keys
```powershell
# Export database volume
docker run --rm -v campusexam-db-data:/from:ro -v "${PWD}:/to" alpine tar czf /to/campusexam-db-data.tar.gz -C /from .

# Export key volumes
docker run --rm -v campusexam-central-keys:/from:ro -v "${PWD}:/to" alpine tar czf /to/campusexam-central-keys.tar.gz -C /from .
docker run --rm -v campusexam-lab-keys:/from:ro -v "${PWD}:/to" alpine tar czf /to/campusexam-lab-keys.tar.gz -C /from .
```

#### Step 3: Transfer Files to Offline Machine
Copy via secure USB:
- `mitm-ems-images.tar`
- `campusexam-db-data.tar.gz`
- `campusexam-central-keys.tar.gz`
- `campusexam-lab-keys.tar.gz`
- Project root directory (containing `compose.yaml`, `.env.example`, `docker_start.ps1`, `docker_stop.ps1`)

#### Step 4: Import on Offline Machine
```powershell
# 1. Load Docker images
docker load -i mitm-ems-images.tar

# 2. Create volumes and extract data
docker volume create campusexam-db-data
docker volume create campusexam-central-keys
docker volume create campusexam-lab-keys
docker volume create campusexam-lab-storage
docker volume create campusexam-audit-storage

docker run --rm -v campusexam-db-data:/to:rw -v "${PWD}:/from:ro" alpine tar xzf /from/campusexam-db-data.tar.gz -C /to
docker run --rm -v campusexam-central-keys:/to:rw -v "${PWD}:/from:ro" alpine tar xzf /from/campusexam-central-keys.tar.gz -C /to
docker run --rm -v campusexam-lab-keys:/to:rw -v "${PWD}:/from:ro" alpine tar xzf /from/campusexam-lab-keys.tar.gz -C /to

# 3. Configure environment and launch
Copy-Item .env.example .env
docker compose up -d
```

---

### 3. Key Isolation & Security Checklist

| Check | Requirement | Verification Method | Status |
|---|---|---|---|
| Central Private Key Isolation | `central_private.key` must NOT exist in `campusexam-lab` | `docker exec campusexam-lab ls /app/lab_server_keys` | PASSED |
| Lab Private Key Isolation | `lab_private.key` must NOT exist in `campusexam-central` | `docker exec campusexam-central ls /app/keys` | PASSED |
| Central Public Key in Lab | Lab has `central_public.key` to verify COE signature | `docker exec campusexam-lab ls /app/lab_server_keys` | PASSED |
| Read-Only Key Mounts | Keys mounted `:ro` where practical | Inspected in `compose.yaml` | PASSED |
| Read-Only Lab Results in Central | Central mounts `campusexam-lab-storage` as `:ro` | Inspected in `compose.yaml` | PASSED |
| Non-Root Execution | Backend containers execute as unprivileged user `campusexam` | Inspected in `Dockerfile.central` / `Dockerfile.lab` | PASSED |
