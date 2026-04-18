#!/usr/bin/env bash
set -euo pipefail

echo "[deploy] Starting deployment in $(pwd)"

run_as_root() {
  if command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    "$@"
  fi
}

ensure_node_and_npm() {
  if command -v npm >/dev/null 2>&1; then
    return
  fi

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

  if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "${NVM_DIR}/nvm.sh"
    nvm use --silent default >/dev/null 2>&1 || true
  fi

  if ! command -v npm >/dev/null 2>&1 && [[ -d "${NVM_DIR}/versions/node" ]]; then
    latest_node_dir="$(ls -1 "${NVM_DIR}/versions/node" | sort -V | tail -n 1 || true)"
    if [[ -n "${latest_node_dir}" ]]; then
      export PATH="${NVM_DIR}/versions/node/${latest_node_dir}/bin:${PATH}"
    fi
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "[deploy] npm not found in PATH."
    echo "[deploy] Ensure Node.js is installed or nvm is initialized for non-interactive shells."
    exit 1
  fi
}

parse_database_host_port() {
  local no_proto
  local authority_and_path
  local authority

  no_proto="${DATABASE_URL#*://}"
  authority_and_path="${no_proto#*@}"
  authority="${authority_and_path%%/*}"

  DB_HOST="${authority%%:*}"
  DB_PORT="${authority##*:}"

  if [[ "${authority}" == "${DB_HOST}" ]]; then
    DB_PORT="5432"
  fi
}

ensure_postgresql_local() {
  parse_database_host_port

  if [[ "${DB_HOST}" != "localhost" && "${DB_HOST}" != "127.0.0.1" ]]; then
    echo "[deploy] DATABASE_URL host is '${DB_HOST}', skipping local PostgreSQL installation checks."
    return
  fi

  echo "[deploy] Ensuring PostgreSQL is installed for local database host ${DB_HOST}:${DB_PORT}"
  if ! command -v psql >/dev/null 2>&1 || ! command -v pg_isready >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      run_as_root apt-get update
      run_as_root apt-get install -y postgresql postgresql-contrib
    else
      echo "[deploy] PostgreSQL is missing and automatic install is supported only for apt-based systems."
      exit 1
    fi
  fi

  if command -v systemctl >/dev/null 2>&1; then
    run_as_root systemctl enable postgresql || true
    run_as_root systemctl start postgresql
  else
    run_as_root service postgresql start
  fi

  if ! pg_isready -h "${DB_HOST}" -p "${DB_PORT}" >/dev/null 2>&1; then
    echo "[deploy] PostgreSQL is installed but not accepting connections on ${DB_HOST}:${DB_PORT}"
    exit 1
  fi

  echo "[deploy] PostgreSQL is up and listening on ${DB_HOST}:${DB_PORT}"
}

if [[ ! -f "package.json" ]]; then
  echo "[deploy] package.json not found. Run this script from repository root."
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[deploy] DATABASE_URL is not set."
  exit 1
fi

mkdir -p "apps/api"
cat > "apps/api/.env" <<EOF
DATABASE_URL="${DATABASE_URL}"
SESSION_COOKIE_NAME="${SESSION_COOKIE_NAME:-progress_tracker_session}"
EOF

ensure_postgresql_local

ensure_node_and_npm

echo "[deploy] Installing dependencies"
npm ci

echo "[deploy] Preparing database"
npm run db:generate
npm run db:deploy

echo "[deploy] Building application for hosted subpath deployment"
npm run build:deploy

WEB_DIST_DIR="apps/web/dist/webapp/browser"
if [[ ! -d "${WEB_DIST_DIR}" ]]; then
  echo "[deploy] Build output directory not found: ${WEB_DIST_DIR}"
  exit 1
fi

if [[ ! -f "${WEB_DIST_DIR}/index.html" && -f "${WEB_DIST_DIR}/index.csr.html" ]]; then
  echo "[deploy] index.html not found, using index.csr.html for static hosting fallback"
  cp "${WEB_DIST_DIR}/index.csr.html" "${WEB_DIST_DIR}/index.html"
fi

NGINX_DIR="${NGINX_DIR:-/var/www/progress-tracker}"
echo "[deploy] Publishing static files to ${NGINX_DIR}"
run_as_root mkdir -p "${NGINX_DIR}"
run_as_root rsync -a --delete "${WEB_DIST_DIR}/" "${NGINX_DIR}/"
echo "[deploy] Applying nginx-friendly permissions on ${NGINX_DIR}"
run_as_root chown -R www-data:www-data "${NGINX_DIR}"
run_as_root find "${NGINX_DIR}" -type d -exec chmod 755 {} \;
run_as_root find "${NGINX_DIR}" -type f -exec chmod 644 {} \;

echo "[deploy] Deployment complete"
