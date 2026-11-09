"""
Partner wallets.

At the end of every month each partner is credited with their percentage of the
shop's net profit for that month (a loss month is a negative credit). Payouts
(ShareholderPayment) are taken from the wallet. Balance = credits - payouts.

Credits are stored once the month is over, so later edits to old sales do not
silently move a partner's balance; the owner can recalculate a month on purpose.
"""

from __future__ import annotations

import calendar
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import Shareholder, ShareholderPayment, ShareholderWalletCredit

MONEY = Decimal("0.0001")


def month_start(d: date) -> date:
    return d.replace(day=1)


def month_end(first: date) -> date:
    return first.replace(day=calendar.monthrange(first.year, first.month)[1])


def next_month(first: date) -> date:
    return date(first.year + (first.month == 12), first.month % 12 + 1, 1)


def _shop_net_profit(shop_id: int, first: date, last: date) -> Decimal:
    from .reports import profit_report_for_shop

    return Decimal(profit_report_for_shop(shop_id, first, last)["totals"]["net_profit_usd"])


def _start_month(sh: Shareholder) -> date:
    return month_start(sh.wallet_start_month or timezone.localdate())


@transaction.atomic
def credit_finished_months(shop_id: int) -> int:
    """Create missing credits for every finished month since each partner's start month."""
    current = month_start(timezone.localdate())
    # Lock the partners first so two page loads at once don't both add the same month
    # (the second one waits, then sees the credits the first one created).
    shareholders = list(Shareholder.objects.select_for_update().filter(shop_id=shop_id).order_by("pk"))
    if not shareholders:
        return 0
    done = {
        (row["shareholder_id"], row["month"])
        for row in ShareholderWalletCredit.objects.filter(shop_id=shop_id).values("shareholder_id", "month")
    }
    profit_cache: dict[date, Decimal] = {}
    created = 0
    for sh in shareholders:
        m = _start_month(sh)
        while m < current:
            if (sh.pk, m) not in done:
                if m not in profit_cache:
                    profit_cache[m] = _shop_net_profit(shop_id, m, month_end(m))
                net = profit_cache[m]
                ShareholderWalletCredit.objects.create(
                    shop_id=shop_id,
                    shareholder=sh,
                    month=m,
                    shop_net_profit_usd=net,
                    share_percentage=sh.share_percentage,
                    amount_usd=(net * Decimal(sh.share_percentage) / 100).quantize(MONEY),
                )
                created += 1
            m = next_month(m)
    return created


@transaction.atomic
def recalculate_month(shop_id: int, month: date) -> int:
    """Re-read a finished month's net profit (after corrections) and update every credit."""
    first = month_start(month)
    if first >= month_start(timezone.localdate()):
        raise ValueError("month_not_finished")
    net = _shop_net_profit(shop_id, first, month_end(first))
    updated = 0
    for credit in ShareholderWalletCredit.objects.select_related("shareholder").filter(
        shop_id=shop_id,
        month=first,
    ):
        pct = Decimal(credit.shareholder.share_percentage)
        credit.shop_net_profit_usd = net
        credit.share_percentage = pct
        credit.amount_usd = (net * pct / 100).quantize(MONEY)
        credit.save(update_fields=["shop_net_profit_usd", "share_percentage", "amount_usd", "updated_at"])
        updated += 1
    return updated


def wallet_totals(sh: Shareholder) -> dict[str, Decimal]:
    earned = ShareholderWalletCredit.objects.filter(shareholder=sh).aggregate(s=Sum("amount_usd"))["s"]
    paid = ShareholderPayment.objects.filter(shareholder=sh).aggregate(s=Sum("amount_usd"))["s"]
    earned = Decimal(str(earned or 0)).quantize(MONEY)
    paid = Decimal(str(paid or 0)).quantize(MONEY)
    return {"earned": earned, "paid": paid, "balance": (earned - paid).quantize(MONEY)}


def current_month_estimate(sh: Shareholder, shop_net_this_month: Decimal | None = None) -> Decimal:
    """This month's share so far (not in the balance until the month ends)."""
    today = timezone.localdate()
    first = month_start(today)
    if _start_month(sh) > first:
        return Decimal("0")
    net = shop_net_this_month
    if net is None:
        net = _shop_net_profit(sh.shop_id, first, today)
    return (net * Decimal(sh.share_percentage) / 100).quantize(MONEY)


def wallet_summary(sh: Shareholder, *, shop_net_this_month: Decimal | None = None) -> dict:
    totals = wallet_totals(sh)
    return {
        "shareholder_id": sh.pk,
        "name": sh.name,
        "share_percentage": format(sh.share_percentage, "f"),
        "capital_contribution_usd": format(Decimal(sh.capital_contribution_usd or 0).quantize(MONEY), "f"),
        "wallet_start_month": _start_month(sh).isoformat(),
        "total_earned_usd": format(totals["earned"], "f"),
        "total_paid_usd": format(totals["paid"], "f"),
        "balance_usd": format(totals["balance"], "f"),
        "current_month_estimate_usd": format(
            current_month_estimate(sh, shop_net_this_month),
            "f",
        ),
    }


def wallet_history(sh: Shareholder) -> list[dict]:
    """Credits and payouts, newest first, with the running balance after each entry."""
    entries: list[dict] = []
    for c in ShareholderWalletCredit.objects.filter(shareholder=sh):
        entries.append(
            {
                "kind": "profit_share",
                "id": c.pk,
                "date": month_end(c.month).isoformat(),
                "month": c.month.isoformat(),
                "amount_usd": Decimal(c.amount_usd),
                "shop_net_profit_usd": format(Decimal(c.shop_net_profit_usd), "f"),
                "share_percentage": format(c.share_percentage, "f"),
                "note": "",
            },
        )
    for p in ShareholderPayment.objects.filter(shareholder=sh):
        entries.append(
            {
                "kind": "payout",
                "id": p.pk,
                "date": p.paid_on.isoformat(),
                "month": None,
                "amount_usd": -Decimal(p.amount_usd),
                "note": p.note or "",
            },
        )
    # Oldest first to build the running balance, then newest first for display.
    entries.sort(key=lambda e: (e["date"], 0 if e["kind"] == "profit_share" else 1, e["id"]))
    running = Decimal("0")
    for e in entries:
        running += e["amount_usd"]
        e["balance_after_usd"] = format(running.quantize(MONEY), "f")
        e["amount_usd"] = format(e["amount_usd"].quantize(MONEY), "f")
    entries.reverse()
    return entries
