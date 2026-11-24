#!/bin/sh
set -e

cat <<EOF > /usr/share/nginx/html/env.js
window.__ENV__ = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-}",
  VITE_LAB_API_BASE_URL: "${VITE_LAB_API_BASE_URL:-}",
  VITE_API_URL: "${VITE_API_URL:-}"
};
EOF

echo "[MITM-EMS] Generated /usr/share/nginx/html/env.js for Student Portal."
