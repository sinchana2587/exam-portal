#!/usr/bin/env bash
# ====================================================================
# MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE - EXAMINATION MANAGEMENT SYSTEM
# AUTOMATED SETUP SCRIPT (Linux / macOS)
# ====================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "===================================================================="
echo "  MIT MYSORE EXAMINATION MANAGEMENT SYSTEM - AUTOMATED SETUP"
echo "===================================================================="

# 1. PREREQUISITES
echo ""
echo "[1/6] Checking system prerequisites..."
command -v java >/dev/null 2>&1 || { echo "[ERROR] Java JDK 17+ is required but not installed."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "[ERROR] Node.js 18+ is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "[ERROR] npm is required but not installed."; exit 1; }
echo "  [OK] Java, Node.js, and npm detected."

# 2. ENVIRONMENT FILE
echo ""
echo "[2/6] Configuring environment files..."
if [ ! -f "$SCRIPT_DIR/.env" ] && [ -f "$SCRIPT_DIR/.env.example" ]; then
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo "  [OK] Created .env from .env.example"
else
    echo "  [OK] .env already exists"
fi

# 3. DIRECTORIES
echo ""
echo "[3/6] Initializing storage directories..."
mkdir -p "$SCRIPT_DIR/CampusExam/build_dev" \
         "$SCRIPT_DIR/CampusExam/keys" \
         "$SCRIPT_DIR/CampusExam/lab_server_keys" \
         "$SCRIPT_DIR/CampusExam/lab_storage/packages" \
         "$SCRIPT_DIR/CampusExam/lab_storage/submissions" \
         "$SCRIPT_DIR/CampusExam/lab_storage/results" \
         "$SCRIPT_DIR/CampusExam/lab_storage/credentials" \
         "$SCRIPT_DIR/CampusExam/audit_storage/results" \
         "$SCRIPT_DIR/admin-portal (7)/server/uploads/originals" \
         "$SCRIPT_DIR/admin-portal (7)/server/uploads/temp"
echo "  [OK] Storage directories created."

# 4. DEPENDENCIES
echo ""
echo "[4/6] Installing frontend dependencies..."
for dir in "admin-portal (7)" "coe-portal (7)" "student-portal (Final)/student-portal (Final)/student-portal"; do
    echo "  Installing in $dir..."
    (cd "$SCRIPT_DIR/$dir" && (npm ci --legacy-peer-deps --no-audit --prefer-offline 2>/dev/null || npm install --legacy-peer-deps --no-audit))
done
echo "  [OK] Frontend dependencies installed."

# 5. COMPILE JAVA & INITIALIZE KEYS
echo ""
echo "[5/6] Compiling Java services and generating cryptographic keys..."
(cd "$SCRIPT_DIR/CampusExam" && javac -d build_dev -cp "lib/postgresql.jar:src" CampusExam.java LabServer.java)
(cd "$SCRIPT_DIR/CampusExam" && java -cp "build_dev:lib/postgresql.jar:src" CampusExam --init-keys)
(cd "$SCRIPT_DIR/CampusExam" && java -cp "build_dev" LabServer --init-keys)
echo "  [OK] Java services compiled and RSA-2048 keys initialized."

# 6. DATABASE NOTE
echo ""
echo "[6/6] Database initialization..."
echo "  To initialize a fresh database with PostgreSQL:"
echo "    createdb -U campusexam campusexam_test"
echo "    psql -U campusexam -d campusexam_test -f CampusExam/schema.sql"
echo "    psql -U campusexam -d campusexam_test -f CampusExam/seed_demo_data.sql"

echo ""
echo "===================================================================="
echo "  SETUP COMPLETE! Start services with: ./start-all.sh"
echo "===================================================================="
