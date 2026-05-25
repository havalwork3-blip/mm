"""Daily manager Telegram — APScheduler at configured local time + backup checks."""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_scheduler = None
_lock_file = None
_started = False


def scheduler_enabled() -> bool:
    raw = os.environ.get("MANAGER_TELEGRAM_SCHEDULER", "auto").strip().lower()
    if raw in ("0", "false", "no", "off"):
        return False
    if raw in ("1", "true", "yes", "on"):
        return True
    from django.conf import settings

    return not settings.DEBUG


def _acquire_leader_lock():
    """Only one Gunicorn worker runs the scheduler (Linux file lock)."""
    try:
        import fcntl
    except ImportError:
        return object()  # dev on Windows: allow single-process scheduler

    path = os.environ.get(
        "MANAGER_TELEGRAM_LOCK_PATH",
        "/tmp/mnm_manager_telegram.lock",
    )
    fh = open(path, "w", encoding="utf-8")
    try:
        fcntl.flock(fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        fh.close()
        return None
    fh.write(str(os.getpid()))
    fh.flush()
    return fh


def run_scheduled_manager_digest() -> dict:
    """Called by cron job, HTTP tick, or APScheduler."""
    from django.db import transaction
    from django.db.utils import OperationalError

    from shops.manager_daily_telegram import (
        business_today,
        send_manager_daily_digest,
        should_run_scheduled_send,
    )
    from shops.models import QrLandingSettings

    skipped = {"skipped": True, "reason": "not_due"}
    with transaction.atomic():
        try:
            settings = QrLandingSettings.objects.select_for_update(nowait=True).get(pk=1)
        except OperationalError:
            return {"skipped": True, "reason": "lock_busy"}
        if not should_run_scheduled_send(settings):
            return skipped
        return send_manager_daily_digest(
            settings,
            report_date=business_today(),
            force=False,
        )


def refresh_manager_telegram_schedule() -> None:
    """Apply send hour/minute from DB to the daily cron job."""
    if _scheduler is None:
        return

    from apscheduler.jobstores.base import JobLookupError
    from apscheduler.triggers.cron import CronTrigger

    from shops.manager_daily_telegram import _business_tz
    from shops.models import QrLandingSettings

    s = QrLandingSettings.load()
    job_id = "manager_telegram_daily"
    if not s.manager_telegram_notify_enabled:
        try:
            _scheduler.remove_job(job_id)
        except JobLookupError:
            pass
        logger.info("Manager Telegram daily job removed (disabled)")
        return

    hour = int(s.manager_telegram_send_hour or 8) % 24
    minute = int(s.manager_telegram_send_minute or 0) % 60
    tz = _business_tz()
    _scheduler.add_job(
        run_scheduled_manager_digest,
        CronTrigger(hour=hour, minute=minute, timezone=tz),
        id=job_id,
        replace_existing=True,
        misfire_grace_time=7200,
        coalesce=True,
        max_instances=1,
    )
    logger.info(
        "Manager Telegram daily job at %02d:%02d (%s)",
        hour,
        minute,
        tz,
    )


def schedule_status() -> dict:
    """For admin UI — next run hint."""
    from shops.manager_daily_telegram import _business_tz, business_today
    from shops.models import QrLandingSettings

    s = QrLandingSettings.load()
    tz = _business_tz()
    hour = int(s.manager_telegram_send_hour or 8)
    minute = int(s.manager_telegram_send_minute or 0)
    enabled = bool(s.manager_telegram_notify_enabled)
    out = {
        "scheduler_enabled": scheduler_enabled(),
        "notify_enabled": enabled,
        "send_time_local": f"{hour:02d}:{minute:02d}",
        "timezone": str(tz),
        "last_scheduled_sent_date": (
            s.manager_telegram_last_sent_date.isoformat()
            if s.manager_telegram_last_sent_date
            else None
        ),
        "leader_worker": _lock_file is not None,
    }
    if _scheduler is not None:
        job = _scheduler.get_job("manager_telegram_daily")
        if job and job.next_run_time:
            out["next_run_at"] = job.next_run_time.isoformat()
    if enabled and s.manager_telegram_last_sent_date == business_today():
        out["sent_today"] = True
    return out


def start_manager_telegram_scheduler() -> None:
    global _scheduler, _lock_file, _started
    if not scheduler_enabled() or _started:
        return

    lock = _acquire_leader_lock()
    if lock is None:
        logger.info("Manager Telegram scheduler: another worker holds the lock")
        return

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger

        from shops.manager_daily_telegram import _business_tz

        _lock_file = lock
        _started = True
        tz = _business_tz()
        _scheduler = BackgroundScheduler(timezone=tz)
        _scheduler.start()
        refresh_manager_telegram_schedule()
        # Backup if exact cron misfired (server sleep, deploy at send time, etc.)
        _scheduler.add_job(
            run_scheduled_manager_digest,
            IntervalTrigger(minutes=5),
            id="manager_telegram_backup",
            replace_existing=True,
            misfire_grace_time=300,
            coalesce=True,
            max_instances=1,
        )
        logger.info("Manager Telegram scheduler started (leader pid %s)", os.getpid())
    except Exception:
        logger.exception("Failed to start Manager Telegram scheduler")
        _started = False
        if lock and hasattr(lock, "close"):
            try:
                lock.close()
            except OSError:
                pass
        _lock_file = None
