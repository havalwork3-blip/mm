#!/usr/bin/env sh
# Backup tick for daily manager Telegram (every 5 min via crontab).
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ -f .env ]; then
  # shellcheck disable=SC1091
  . ./.env
fi
if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET not set in .env" >&2
  exit 1
fi
BASE="${PUBLIC_API_BASE_URL:-https://dashboard.mmiraq.com}"
BASE="${BASE%/}"
curl -fsS -H "X-Cron-Secret: ${CRON_SECRET}" "${BASE}/api/internal/cron/manager-telegram/" >/dev/null
