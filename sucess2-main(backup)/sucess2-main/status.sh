#!/usr/bin/env bash
# ====================================================================
# MAHARAJA INSTITUTE OF TECHNOLOGY MYSORE - EXAMINATION MANAGEMENT SYSTEM
# SERVICE STATUS CHECK (Linux / macOS)
# ====================================================================
echo "===================================================================="
echo "  MIT MYSORE EXAMINATION SYSTEM - LIVE SERVICE STATUS"
echo "===================================================================="

check_port() {
    local name="$1"
    local port="$2"
    local pid=$(lsof -ti tcp:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        printf "  %-28s [Port %4d]: RUNNING (PID: %s)\n" "$name" "$port" "$pid"
    else
        printf "  %-28s [Port %4d]: STOPPED\n" "$name" "$port"
    fi
}

check_port "PostgreSQL Database" 5432
check_port "Central Java Backend" 8081
check_port "Independent Lab Server" 8082
check_port "HOD / Faculty Portal" 3000
check_port "COE Examination Portal" 3001
check_port "Student Examination Portal" 3002
check_port "Document Converter API" 5001

echo "===================================================================="
