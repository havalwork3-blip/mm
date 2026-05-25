"""In-process scheduler for daily manager Telegram digest (no cron required)."""

from __future__ import annotations

import logging
import os
import threading

logger = logging.getLogger(__name__)

_started = False
_start_lock = threading.Lock()


def scheduler_enabled() -> bool:
    raw = os.environ.get("MANAGER_TELEGRAM_SCHEDULER", "auto").strip().lower()
    if raw in ("0", "false", "no", "off"):
        return False
    if raw in ("1", "true", "yes", "on"):
        return True
    from django.conf import settings

    return not settings.DEBUG


def scheduler_interval_sec() -> int:
    try:
        return max(30, int(os.environ.get("MANAGER_TELEGRAM_SCHEDULER_INTERVAL_SEC", "60")))
    except ValueError:
        return 60


def _schedule_next() -> None:
    delay = scheduler_interval_sec()
    timer = threading.Timer(delay, _tick)
    timer.daemon = True
    timer.start()


def _tick() -> None:
    try:
        _try_scheduled_send()
    except Exception:
        logger.exception("Manager Telegram scheduler tick failed")
    finally:
        if scheduler_enabled():
            _schedule_next()


def _try_scheduled_send() -> None:
    from django.db import transaction
    from django.db.utils import OperationalError

    from shops.manager_daily_telegram import (
        business_today,
        send_manager_daily_digest,
        should_run_scheduled_send,
    )
    from shops.models import QrLandingSettings

    result: dict = {}
    with transaction.atomic():
        try:
            settings = QrLandingSettings.objects.select_for_update(nowait=True).get(pk=1)
        except OperationalError:
            return
        if not should_run_scheduled_send(settings):
            return
        report_date = business_today()
        result = send_manager_daily_digest(
            settings,
            report_date=report_date,
            force=False,
        )
    sent = int(result.get("sent") or 0)
    shops = int(result.get("shops") or 0)
    if sent > 0:
        logger.info(
            "Manager Telegram scheduled send OK: %s message(s), %s/%s shops",
            sent,
            result.get("shop_ok"),
            shops,
        )
    elif shops > 0:
        logger.warning(
            "Manager Telegram scheduled send produced no messages (shops=%s)",
            shops,
        )


def start_manager_telegram_scheduler() -> None:
    global _started
    if not scheduler_enabled():
        return
    with _start_lock:
        if _started:
            return
        _started = True
    logger.info(
        "Manager Telegram scheduler started (every %ss, tz via DJANGO_BUSINESS_TZ)",
        scheduler_interval_sec(),
    )
    _schedule_next()
