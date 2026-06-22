"""Daily activity feed for employee profile."""

from __future__ import annotations

from datetime import date

from django.db.models import Q

from inventory.models import EmployeeDebt

from .models import User, UserActivityLog


def daily_activity_for_user(
    user: User,
    for_date: date,
    *,
    shop_id: int | None = None,
) -> list[dict]:
    """Merged chronological events for one calendar day (newest first)."""
    log_qs = UserActivityLog.objects.filter(
        user=user,
        created_at__date=for_date,
    )
    if shop_id is not None:
        log_qs = log_qs.filter(Q(shop_id=shop_id) | Q(shop_id__isnull=True))

    entries: list[dict] = []
    for row in log_qs:
        entries.append(
            {
                "id": f"log-{row.id}",
                "action": row.action,
                "label": row.label,
                "meta": row.meta,
                "created_at": row.created_at.isoformat(),
            },
        )

    debt_qs = EmployeeDebt.objects.filter(employee=user, occurred_on=for_date)
    if shop_id is not None:
        debt_qs = debt_qs.filter(shop_id=shop_id)
    for ed in debt_qs.select_related("shop"):
        entries.append(
            {
                "id": f"debt-{ed.id}",
                "action": "employee_debt",
                "label": ed.debt_type,
                "meta": {
                    "amount_usd": str(ed.amount),
                    "debt_type": ed.debt_type,
                    "note": ed.note,
                    "employee_debt_id": ed.id,
                },
                "created_at": ed.created_at.isoformat(),
            },
        )

    entries.sort(key=lambda e: e["created_at"], reverse=True)
    return entries
