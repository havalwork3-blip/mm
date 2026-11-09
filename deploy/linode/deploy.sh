#!/usr/bin/env bash
# Run on the server from the repository (after chmod +x deploy/linode/deploy.sh).
# Usage: ./deploy/linode/deploy.sh
# Optional: APP_ROOT=/srv/mnm ./deploy/linode/deploy.sh  (override auto-detected repo root)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${APP_ROOT:-$(cd "${SCRIPT_DIR}/../.." && pwd)}"
BACKEND="${REPO_ROOT}/backend"
FRONTEND="${REPO_ROOT}/frontend"
PYTHON="${BACKEND}/venv/bin/python"
PIP="${BACKEND}/venv/bin/pip"

echo "==> Repo root: ${REPO_ROOT}"

if [[ ! -f "${BACKEND}/manage.py" ]]; then
  echo "ERROR: manage.py not found at ${BACKEND}/manage.py" >&2
  exit 1
fi

if [[ ! -x "${PIP}" ]]; then
  echo "ERROR: venv pip not found at ${PIP}. Create the venv first, e.g.:" >&2
  echo "  cd ${BACKEND} && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

echo "==> git pull"
git -C "${REPO_ROOT}" pull --ff-only

echo "==> Sync MM IRAQ static landing (mmiraq.com)"
if [[ -x "${SCRIPT_DIR}/sync-mmiraq-landing.sh" ]]; then
  sudo "${SCRIPT_DIR}/sync-mmiraq-landing.sh"
elif [[ -f "${SCRIPT_DIR}/sync-mmiraq-landing.sh" ]]; then
  sudo bash "${SCRIPT_DIR}/sync-mmiraq-landing.sh"
else
  echo "WARN: sync-mmiraq-landing.sh not found; skipping static landing sync" >&2
fi

MMIRAq_NGINX="${SCRIPT_DIR}/nginx-mmiraq.conf"
if [[ -f "${MMIRAq_NGINX}" ]] && [[ -d /etc/nginx/sites-available ]]; then
  echo "==> Update mmiraq.com nginx (API proxy for CMS)"
  sudo cp "${MMIRAq_NGINX}" /etc/nginx/sites-available/mmiraq
  sudo ln -sf /etc/nginx/sites-available/mmiraq /etc/nginx/sites-enabled/mmiraq
fi

echo "==> Python dependencies"
"${PIP}" install -r "${BACKEND}/requirements.txt"

echo "==> Pre-flight: Django settings check (nothing is changed if this fails)"
if ! "${PYTHON}" "${BACKEND}/manage.py" check; then
  echo "ERROR: Django check failed. Gunicorn was NOT restarted and no migration ran." >&2
  echo "       Fix ${BACKEND}/.env (DJANGO_DEBUG=false, DJANGO_SECRET_KEY, DJANGO_ALLOWED_HOSTS," >&2
  echo "       DATABASE_URL or DJANGO_USE_SQLITE=true) and run this script again." >&2
  exit 1
fi

echo "==> Database backup before migrations"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups/deploy}"
mkdir -p "${BACKUP_DIR}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DB_INFO="$("${PYTHON}" "${BACKEND}/manage.py" shell -c \
  "from django.db import connection as c; s=c.settings_dict; print(c.vendor); print(s['NAME']); print(s.get('USER') or ''); print(s.get('HOST') or ''); print(s.get('PORT') or ''); print(s.get('PASSWORD') or '')")"
DB_VENDOR="$(sed -n 1p <<<"${DB_INFO}")"
DB_NAME="$(sed -n 2p <<<"${DB_INFO}")"
DB_USER="$(sed -n 3p <<<"${DB_INFO}")"
DB_HOST="$(sed -n 4p <<<"${DB_INFO}")"
DB_PORT="$(sed -n 5p <<<"${DB_INFO}")"
DB_PASS="$(sed -n 6p <<<"${DB_INFO}")"
if [[ "${DB_VENDOR}" == "sqlite" ]]; then
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "${DB_NAME}" ".backup '${BACKUP_DIR}/db-${STAMP}.sqlite3'"
  else
    cp -p "${DB_NAME}" "${BACKUP_DIR}/db-${STAMP}.sqlite3"
  fi
  echo "    SQLite backup: ${BACKUP_DIR}/db-${STAMP}.sqlite3"
elif [[ "${DB_VENDOR}" == "postgresql" ]]; then
  PGPASSWORD="${DB_PASS}" pg_dump --format=custom --file="${BACKUP_DIR}/db-${STAMP}.dump" \
    -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER}" "${DB_NAME}"
  echo "    PostgreSQL backup: ${BACKUP_DIR}/db-${STAMP}.dump"
  unset DB_PASS
else
  echo "ERROR: unknown database vendor '${DB_VENDOR}'; refusing to migrate without a backup." >&2
  exit 1
fi

CRON_SCRIPT="${BACKEND}/scripts/cron_manager_telegram.sh"
if [[ -f "${CRON_SCRIPT}" ]]; then
  chmod +x "${CRON_SCRIPT}"
  CRON_LINE="*/5 * * * * ${CRON_SCRIPT}"
  (crontab -l 2>/dev/null | grep -v 'cron_manager_telegram' || true; echo "${CRON_LINE}") | crontab -
  echo "==> Installed manager Telegram cron (every 5 min): ${CRON_SCRIPT}"
fi

echo "==> Django migrations"
"${PYTHON}" "${BACKEND}/manage.py" migrate --noinput
# reconcile_fifo_batches REWRITES stock cost layers in the live database, so it never runs
# automatically. Run it on purpose with: RUN_FIFO_RECONCILE=1 ./deploy/linode/deploy.sh
if [[ "${RUN_FIFO_RECONCILE:-0}" == "1" ]]; then
  echo "==> Re-align FIFO cost layers with stock counts (RUN_FIFO_RECONCILE=1)"
  "${PYTHON}" "${BACKEND}/manage.py" reconcile_fifo_batches
else
  echo "==> Skipping reconcile_fifo_batches (set RUN_FIFO_RECONCILE=1 to run it)"
fi
echo "==> Collect static files (Django admin / API pages)"
"${PYTHON}" "${BACKEND}/manage.py" collectstatic --noinput
echo "==> Re-register Telegram webhooks with their secret token"
"${PYTHON}" "${BACKEND}/manage.py" register_telegram_webhooks || true
echo "==> Sync CMS brand logo to mmiraq.com web root"
MARKETING_BRAND_LOGO_WEBROOT="${WEB_ROOT:-/var/www/html}/brand-custom.webp" \
  "${PYTHON}" "${BACKEND}/manage.py" sync_marketing_brand_logo || true
if [[ -f "${WEB_ROOT:-/var/www/html}/brand-custom.webp" ]]; then
  sudo chown www-data:www-data "${WEB_ROOT:-/var/www/html}/brand-custom.webp" 2>/dev/null || true
fi

if [[ -n "${MARKETING_CMS_EMAIL:-}" && -n "${MARKETING_CMS_PASSWORD:-}" ]]; then
  echo "==> Ensure marketing CMS editor (${MARKETING_CMS_EMAIL})"
  "${PYTHON}" "${BACKEND}/manage.py" create_marketing_editor \
    --email "${MARKETING_CMS_EMAIL}" \
    --password "${MARKETING_CMS_PASSWORD}" \
    ${MARKETING_CMS_NAME:+--name "${MARKETING_CMS_NAME}"}
fi

if [[ -n "${SUPERUSER_EMAIL:-}" && -n "${SUPERUSER_PASSWORD:-}" ]]; then
  echo "==> Ensure dashboard superuser (${SUPERUSER_EMAIL})"
  "${PYTHON}" "${BACKEND}/manage.py" ensure_superuser \
    --email "${SUPERUSER_EMAIL}" \
    --password "${SUPERUSER_PASSWORD}"
fi

echo "==> Frontend build"
if [[ -f "${FRONTEND}/package-lock.json" ]]; then
  (cd "${FRONTEND}" && npm ci && npm run build)
else
  (cd "${FRONTEND}" && npm install && npm run build)
fi

echo "==> Ensure runtime dirs are writable by Gunicorn user (www-data)"
sudo mkdir -p "${BACKEND}/media" "${BACKEND}/staticfiles"
sudo chown -R www-data:www-data "${BACKEND}/media" "${BACKEND}/staticfiles"

echo "==> Restart Gunicorn (requires sudo)"
sudo systemctl restart gunicorn

echo "==> Reload Nginx (requires sudo)"
sudo nginx -t
sudo systemctl reload nginx

echo "==> Done."
