#!/usr/bin/env bash
set -euo pipefail

LOCAL_PORT="${LOCAL_PORT:-5433}"
REMOTE_DB_HOST="${REMOTE_DB_HOST:-127.0.0.1}"
REMOTE_DB_PORT="${REMOTE_DB_PORT:-5432}"
SSH_HOST="${SSH_HOST:-}"
SSH_USER="${SSH_USER:-}"
SSH_PORT="${SSH_PORT:-1696}"

if [[ $# -ge 1 ]]; then
  SSH_HOST="$1"
fi

if [[ $# -ge 2 ]]; then
  SSH_USER="$2"
fi

if [[ -z "${SSH_HOST}" || -z "${SSH_USER}" ]]; then
  echo "Usage:"
  echo "  npm run db:tunnel -- <ssh_host> <ssh_user>"
  echo
  echo "Or via env vars:"
  echo "  SSH_HOST=your.server SSH_USER=ubuntu npm run db:tunnel"
  echo
  echo "Optional env overrides:"
  echo "  LOCAL_PORT (default: 5433)"
  echo "  SSH_PORT (default: 1696)"
  echo "  REMOTE_DB_HOST (default: 127.0.0.1)"
  echo "  REMOTE_DB_PORT (default: 5432)"
  exit 1
fi

echo "[tunnel] localhost:${LOCAL_PORT} -> ${REMOTE_DB_HOST}:${REMOTE_DB_PORT} via ${SSH_USER}@${SSH_HOST}:${SSH_PORT}"
echo "[tunnel] Press Ctrl+C to close."

exec ssh -N \
  -L "${LOCAL_PORT}:${REMOTE_DB_HOST}:${REMOTE_DB_PORT}" \
  -p "${SSH_PORT}" \
  "${SSH_USER}@${SSH_HOST}"
