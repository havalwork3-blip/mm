"""User activity logging for employee profile history."""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from .models import User, UserActivityLog


def log_user_activity(
    user: User,
    *,
    shop_id: int | None,
    action: str,
    label: str,
    meta: dict | None = None,
) -> UserActivityLog:
    return UserActivityLog.objects.create(
        user=user,
        shop_id=shop_id,
        action=action,
        label=label,
        meta=meta or {},
    )


def maybe_log_session_start(user: User, shop_id: int | None) -> None:
    """Record one session_start per 30 minutes (sidebar / me refresh)."""
    cutoff = timezone.now() - timedelta(minutes=30)
    if UserActivityLog.objects.filter(
        user=user,
        action="session_start",
        created_at__gte=cutoff,
    ).exists():
        return
    log_user_activity(
        user,
        shop_id=shop_id,
        action="session_start",
        label="session_start",
        meta={},
    )
