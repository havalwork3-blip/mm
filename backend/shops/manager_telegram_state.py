"""Shared state for scheduled manager Telegram sends (attempt log + cooldown)."""

from __future__ import annotations

import json
import logging
import os
from datetime import date, datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

FAILED_ATTEMPT_COOLDOWN = timedelta(minutes=10)


def attempt_state_path() -> Path:
    raw = os.environ.get(
        "MANAGER_TELEGRAM_ATTEMPT_PATH",
        "/tmp/mnm_manager_telegram_attempt.json",
    )
    return Path(raw)


def read_attempt_state() -> dict:
    path = attempt_state_path()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, json.JSONDecodeError, TypeError):
        return {}


def write_attempt_state(*, report_date: date, ok: bool, error: str | None = None) -> None:
    path = attempt_state_path()
    payload = {
        "date": report_date.isoformat(),
        "at": datetime.now().astimezone().isoformat(),
        "ok": ok,
    }
    if error:
        payload["error"] = error[:500]
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload), encoding="utf-8")
    except OSError:
        logger.exception("Could not write manager Telegram attempt state")


def clear_attempt_state() -> None:
    path = attempt_state_path()
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.exception("Could not clear manager Telegram attempt state")


def recent_failed_attempt(report_date: date) -> bool:
    state = read_attempt_state()
    if state.get("date") != report_date.isoformat() or state.get("ok"):
        return False
    raw_at = state.get("at")
    if not raw_at:
        return False
    try:
        attempted_at = datetime.fromisoformat(str(raw_at))
    except ValueError:
        return False
    if attempted_at.tzinfo is None:
        attempted_at = attempted_at.replace(tzinfo=datetime.now().astimezone().tzinfo)
    return datetime.now().astimezone() - attempted_at < FAILED_ATTEMPT_COOLDOWN
