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

echo "==> Python dependencies"
"${PIP}" install -r "${BACKEND}/requirements.txt"

CRON_SCRIPT="${BACKEND}/scripts/cron_manager_telegram.sh"
if [[ -f "${CRON_SCRIPT}" ]]; then
  chmod +x "${CRON_SCRIPT}"
  CRON_LINE="*/5 * * * * ${CRON_SCRIPT}"
  (crontab -l 2>/dev/null | grep -v 'cron_manager_telegram' || true; echo "${CRON_LINE}") | crontab -
  echo "==> Installed manager Telegram cron (every 5 min): ${CRON_SCRIPT}"
fi

echo "==> Django migrations"
"${PYTHON}" "${BACKEND}/manage.py" migrate --noinput

if [[ -n "${MARKETING_CMS_EMAIL:-}" && -n "${MARKETING_CMS_PASSWORD:-}" ]]; then
  echo "==> Ensure marketing CMS editor (${MARKETING_CMS_EMAIL})"
  "${PYTHON}" "${BACKEND}/manage.py" create_marketing_editor \
    --email "${MARKETING_CMS_EMAIL}" \
    --password "${MARKETING_CMS_PASSWORD}" \
    ${MARKETING_CMS_NAME:+--name "${MARKETING_CMS_NAME}"}
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
