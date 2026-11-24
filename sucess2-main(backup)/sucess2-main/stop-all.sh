#!/usr/bin/env bash
# ====================================================================
# MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE - EXAMINATION MANAGEMENT SYSTEM
# STOP ALL SERVICES (Linux / macOS)
# ====================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "Stopping all MIT Mysore Examination System services..."

for pidfile in .pid_central .pid_lab .pid_coe .pid_admin .pid_student .pid_converter; do
    if [ -f "$SCRIPT_DIR/$pidfile" ]; then
        PID=$(cat "$SCRIPT_DIR/$pidfile" 2>/dev/null || true)
        if [ -n "$PID" ]; then
            kill -9 $PID 2>/dev/null || true
        fi
        rm -f "$SCRIPT_DIR/$pidfile"
    fi
done

for p in 8081 8082 3000 3001 3002 5001; do
    PID=$(lsof -ti tcp:$p 2>/dev/null || true)
    if [ -n "$PID" ]; then
        echo "  Stopping process on port $p (PID: $PID)..."
        kill -9 $PID 2>/dev/null || true
    fi
done

echo "[OK] All services stopped."
