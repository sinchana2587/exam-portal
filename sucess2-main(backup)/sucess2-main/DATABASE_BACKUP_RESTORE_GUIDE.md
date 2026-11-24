# MIT Mysore Examination Management System
## Database Backup, Restore & Recovery Guide

### 1. Database Architecture & Persistent Volume

- **DBMS**: PostgreSQL 16 Alpine
- **Database Name**: `campusexam_test`
- **Application User**: `campusexam`
- **Docker Volume**: `campusexam-db-data` (Production)
- **Validation Backup Volume**: `campusexam-db-validation` (Untouched reference archive)
- **Tables**: 48 public tables (student rosters, questions, blueprints, examination cycles, audit trails).

---

### 2. Backing Up the Live Database

#### Method A: Online SQL Dump (Hot Backup, Zero Downtime)
Execute an encrypted / standard pg_dump from within the container:

```powershell
# Create backups directory if needed
New-Item -ItemType Directory -Force -Path backups

# Generate timestamped dump
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
docker exec -t campusexam-postgres pg_dump -U campusexam -d campusexam_test -F c -f /tmp/backup.dump
docker cp campusexam-postgres:/tmp/backup.dump "backups/campusexam_backup_$timestamp.dump"
docker exec campusexam-postgres rm /tmp/backup.dump
Write-Host "Backup completed: backups/campusexam_backup_$timestamp.dump" -ForegroundColor Green
```

#### Method B: Raw PGDATA Volume Snapshot (Cold Backup)
Perform when PostgreSQL is cleanly stopped:

```powershell
docker compose stop postgres
docker run --rm -v campusexam-db-data:/from:ro -v "${PWD}/backups:/to" alpine tar czf /to/campusexam_pgdata_$(Get-Date -Format "yyyyMMdd_HHmmss").tar.gz -C /from .
docker compose start postgres
```

---

### 3. Restoring the Database

#### Scenario 1: Restore from Custom Format (.dump) into Clean Volume
```powershell
# 1. Stop backend services to avoid connection interference
docker compose stop central lab

# 2. Re-create database or drop existing connections
docker exec -it campusexam-postgres psql -U campusexam -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='campusexam_test' AND pid <> pg_backend_pid();"

# 3. Copy dump file and restore
docker cp backups/your_backup_file.dump campusexam-postgres:/tmp/restore.dump
docker exec -it campusexam-postgres pg_restore -U campusexam -d campusexam_test --clean --if-exists /tmp/restore.dump
docker exec campusexam-postgres rm /tmp/restore.dump

# 4. Restart backend services
docker compose start central lab
```

#### Scenario 2: Emergency Recovery from Reference Validation Volume
If `campusexam-db-data` ever suffers corruption, it can be instantaneously reconstructed from the immutable `campusexam-db-validation` volume:

```powershell
# 1. Stop all containers
docker compose stop

# 2. Clone validated data into production volume
docker run --rm -v campusexam-db-validation:/from:ro -v campusexam-db-data:/to:rw alpine sh -c "rm -rf /to/* && cp -a /from/. /to/"

# 3. Start containers
docker compose start
```

---

### 4. Database Safety Rules

1. **Never run database initialization or migration scripts on an existing database.**
   The startup safety check `BOOTSTRAP_OFFICIAL_ACCOUNTS=false` is enforced in `compose.yaml` to ensure existing accounts and hashed passwords are not overwritten.
2. **Never execute `docker volume prune` or `docker compose down -v`.**
3. **Always verify database record counts after restore:**
   ```powershell
   docker exec campusexam-postgres psql -U campusexam -d campusexam_test -c "
   SELECT 'student_roster' as tbl, count(*) from student_roster
   UNION ALL SELECT 'department', count(*) from department
   UNION ALL SELECT 'bank', count(*) from bank
   UNION ALL SELECT 'student_session_result', count(*) from student_session_result;"
   ```
