#!/usr/bin/env bash
# ====================================================================
# MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE - EXAMINATION MANAGEMENT SYSTEM
# START ALL SERVICES (Linux / macOS)
# ====================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-Local}"

BIND_HOST="127.0.0.1"
DISPLAY_HOST="127.0.0.1"

if [ "$MODE" = "LAN" ]; then
    BIND_HOST="0.0.0.0"
    DETECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig getifaddr en0 2>/dev/null || echo "127.0.0.1")
    DISPLAY_HOST="$DETECTED_IP"
    echo "[LAN Mode] Detected host IP: $DISPLAY_HOST"
fi

echo "===================================================================="
echo "  STARTING MIT MYSORE EXAMINATION SYSTEM (Mode: $MODE)"
echo "===================================================================="

# Stop existing processes on ports 8081, 8082, 3000, 3001, 3002, 5001
for p in 8081 8082 3000 3001 3002 5001; do
    PID=$(lsof -ti tcp:$p 2>/dev/null || true)
    if [ -n "$PID" ]; then
        echo "  Stopping process on port $p (PID: $PID)..."
        kill -9 $PID 2>/dev/null || true
    fi
done

# Start Central Backend (Port 8081)
echo "[1/6] Starting Central Java Backend on port 8081..."
(
    cd "$SCRIPT_DIR/CampusExam"
    export PORT=8081
    export BIND="$BIND_HOST"
    export DB_URL="jdbc:postgresql://localhost:5432/campusexam_test"
    export DB_USER="campusexam"
    export DB_PASSWORD="password"
    export DB_NAME="campusexam_test"
    export ALLOW_ANY_DB="true"
    export LAB_SERVER_URL="http://${DISPLAY_HOST}:8082"
    nohup java -cp "build_dev:lib/postgresql.jar:src" CampusExam > "$SCRIPT_DIR/central_backend.log" 2>&1 &
    echo $! > "$SCRIPT_DIR/.pid_central"
)

# Start Lab Server (Port 8082)
echo "[2/6] Starting Lab Server on port 8082..."
(
    cd "$SCRIPT_DIR/CampusExam"
    export PORT=8082
    export BIND="$BIND_HOST"
    export LAB_ID="LAB-CSE-01"
    export CENTRAL_URL="http://${DISPLAY_HOST}:8081"
    nohup java -cp "build_dev" LabServer > "$SCRIPT_DIR/lab_server.log" 2>&1 &
    echo $! > "$SCRIPT_DIR/.pid_lab"
)

# Start COE Portal (Port 3001)
echo "[3/6] Starting COE Portal on port 3001..."
(
    cd "$SCRIPT_DIR/coe-portal (7)"
    export VITE_API_BASE_URL="http://${DISPLAY_HOST}:8081/api/v1"
    export VITE_LAB_API_BASE_URL="http://${DISPLAY_HOST}:8082/lab-api"
    nohup npm run dev -- --port 3001 --host 0.0.0.0 > "$SCRIPT_DIR/coe_portal.log" 2>&1 &
    echo $! > "$SCRIPT_DIR/.pid_coe"
)

# Start Admin/HOD Portal (Port 3000)
echo "[4/6] Starting Admin/HOD Portal on port 3000..."
(
    cd "$SCRIPT_DIR/admin-portal (7)"
    export VITE_API_BASE_URL="http://${DISPLAY_HOST}:8081/api/v1"
    export PORT=3000
    nohup npm run dev -- --port 3000 > "$SCRIPT_DIR/admin_portal.log" 2>&1 &
    echo $! > "$SCRIPT_DIR/.pid_admin"
)

# Start Student Portal (Port 3002)
echo "[5/6] Starting Student Portal on port 3002..."
(
    cd "$SCRIPT_DIR/student-portal (Final)/student-portal (Final)/student-portal"
    export VITE_LAB_API_BASE_URL="http://${DISPLAY_HOST}:8082"
    export VITE_API_URL="http://${DISPLAY_HOST}:8082"
    nohup npm run dev -- --port 3002 --host 0.0.0.0 > "$SCRIPT_DIR/student_portal.log" 2>&1 &
    echo $! > "$SCRIPT_DIR/.pid_student"
)

# Start Document Converter Server (Port 5001)
echo "[6/6] Starting Document Converter Server on port 5001..."
(
    cd "$SCRIPT_DIR/admin-portal (7)/server/converter"
    export PORT=5001
    nohup node server.js > "$SCRIPT_DIR/converter_server.log" 2>&1 &
    echo $! > "$SCRIPT_DIR/.pid_converter"
)

sleep 3

echo ""
echo "===================================================================="
echo "  ALL SERVICES RUNNING"
echo "===================================================================="
echo "  HOD Portal:       http://${DISPLAY_HOST}:3000 (hod.cse / CSE@2109 or Admin@123)"
echo "  COE Portal:       http://${DISPLAY_HOST}:3001 (coe / COE@5828 or Admin@123)"
echo "  Student Portal:   http://${DISPLAY_HOST}:3002 (USN: 4MH27CS001, DOB: 2004-01-01)"
echo "  Principal Portal: http://${DISPLAY_HOST}:3000/principal (principal / PRINCIPAL@7658)"
echo "  Central API:      http://${DISPLAY_HOST}:8081"
echo "  Lab Server API:   http://${DISPLAY_HOST}:8082/health"
echo "  Converter API:    http://${DISPLAY_HOST}:5001/api/health"
echo "===================================================================="
echo "  To stop: ./stop-all.sh"
echo "===================================================================="
