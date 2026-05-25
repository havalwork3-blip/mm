#!/usr/bin/env sh
# Backup tick for daily manager Telegram (every 5 min via crontab).
# Runs manage.py directly so it works even without CRON_SECRET / HTTP.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ -f .env ]; then
  # shellcheck disable=SC1091
  . ./.env
fi
PY="${ROOT}/venv/bin/python"
if [ ! -x "$PY" ]; then
  PY=python3
fi
exec "$PY" manage.py send_manager_daily_jard_telegram --scheduled
