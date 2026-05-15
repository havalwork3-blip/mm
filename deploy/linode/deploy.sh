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

echo "==> Python dependencies"
"${PIP}" install -r "${BACKEND}/requirements.txt"

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
