#!/usr/bin/env bash
# Sync MM IRAQ static landing site to the web root on the server.
# Usage (on server, from repo root):
#   sudo ./deploy/linode/sync-mmiraq-landing.sh
# Optional:
#   WEB_ROOT=/var/www/html sudo ./deploy/linode/sync-mmiraq-landing.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="${SCRIPT_DIR}/../var-www/html"
WEB_ROOT="${WEB_ROOT:-/var/www/html}"

if [[ ! -f "${SRC}/index.html" ]]; then
  echo "ERROR: ${SRC}/index.html not found" >&2
  exit 1
fi

echo "==> Sync ${SRC} -> ${WEB_ROOT}"
rsync -av --delete \
  --exclude 'build_pages.py' \
  --exclude 'fix_asset_paths.py' \
  --exclude 'inline_assets.py' \
  --exclude 'brand-custom.webp' \
  "${SRC}/" "${WEB_ROOT}/"

echo "==> Verify key assets"
for f in index.html css/main.css js/site.js logo-optimized.webp; do
  if [[ ! -e "${WEB_ROOT}/${f}" ]]; then
    echo "ERROR: missing ${WEB_ROOT}/${f}" >&2
    exit 1
  fi
done
for d in luxury tech shop services explore about terms contact; do
  if [[ ! -f "${WEB_ROOT}/${d}/index.html" ]]; then
    echo "ERROR: missing ${WEB_ROOT}/${d}/index.html" >&2
    exit 1
  fi
done

echo "==> Reload Nginx"
nginx -t
systemctl reload nginx

if [[ -f "${SCRIPT_DIR}/nginx-mmiraq.conf" ]] && [[ -d /etc/nginx/sites-available ]]; then
  echo "==> Ensure mmiraq.com API proxy is installed"
  cp "${SCRIPT_DIR}/nginx-mmiraq.conf" /etc/nginx/sites-available/mmiraq
  ln -sf /etc/nginx/sites-available/mmiraq /etc/nginx/sites-enabled/mmiraq
  nginx -t
  systemctl reload nginx
fi

echo "==> Done. Test:"
echo "  curl -sI https://mmiraq.com/api/public/marketing-site/"
echo "  curl -I https://mmiraq.com/css/main.css"
echo "  curl -I https://mmiraq.com/luxury/"
