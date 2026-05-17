"""Profit report aggregation (USD)."""

from __future__ import annotations

import os
from datetime import datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.db.models import DecimalField, Sum
from django.utils import timezone

from shops.models import Shop

from .models import Expense, Purchase, Sale, SaleLine, Shareholder
from .serializers import latest_usd_to_iqd_for_shop

INVENTORY_LOSS_NOTE_MARKERS = (
    "[AUTO_INVENTORY_LOSS]",
    "[AUTO_DISCONTINUE_LOSS]",
)


def expense_is_inventory_loss(expense: Expense) -> bool:
    note = (expense.note or "").strip()
    return any(note.startswith(marker) for marker in INVENTORY_LOSS_NOTE_MARKERS)


def total_inventory_loss_usd_for_expenses(expense_qs) -> Decimal:
    return sum(
        (e.amount_usd() for e in expense_qs if expense_is_inventory_loss(e)),
        Decimal("0"),
    )


def _range_bounds(d_from, d_to):
    """Same calendar-day semantics as inventory.dashboard_tools._bounds (business TZ)."""
    tz_name = os.environ.get("DJANGO_BUSINESS_TZ", "Asia/Baghdad")
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(d_from, time.min), tz)
    end = timezone.make_aware(datetime.combine(d_to, time.max), tz)
    return start, end


def profit_report_for_shop(shop_id: int, d_from, d_to) -> dict:
    """
    Net profit (USD) =
        sum(sale line sell) - sum(sale line buy)
        - total expenses (USD)
        - total customer invoice discounts
        + total supplier/company discounts received on purchases
    """
    start, end = _range_bounds(d_from, d_to)

    line_qs = SaleLine.objects.filter(
        sale__shop_id=shop_id,
        sale__occurred_at__gte=start,
        sale__occurred_at__lte=end,
    )
    dec = DecimalField(max_digits=24, decimal_places=4)
    sum_sale = Decimal("0")
    sum_buy = Decimal("0")
    per_product: dict[tuple[int | None, str], dict[str, Decimal | int | str | None]] = {}
    for ln in line_qs.select_related("product").prefetch_related("return_lines"):
        returned_qty = sum(int(row.quantity) for row in ln.return_lines.all())
        net_qty = max(0, int(ln.quantity) - returned_qty)
        if net_qty <= 0:
            continue
        line_sale = Decimal(net_qty) * Decimal(ln.unit_price_usd)
        line_buy = Decimal(net_qty) * Decimal(ln.unit_buy_price_usd)
        sum_sale += line_sale
        sum_buy += line_buy
        product_id = ln.product_id
        display_name = (ln.product.name if ln.product_id and ln.product is not None else ln.manual_name or "Manual line")
        key = (product_id, display_name)
        if key not in per_product:
            per_product[key] = {
                "product_id": product_id,
                "product_name": display_name,
                "quantity_sold": 0,
                "total_buy": Decimal("0"),
                "total_sale": Decimal("0"),
            }
        row = per_product[key]
        row["quantity_sold"] = int(row["quantity_sold"]) + net_qty
        row["total_buy"] = Decimal(row["total_buy"]) + line_buy
        row["total_sale"] = Decimal(row["total_sale"]) + line_sale

    sale_qs = Sale.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    )
    cust_disc = sale_qs.aggregate(
        s=Sum("invoice_discount_usd", output_field=dec),
    )["s"] or Decimal("0")

    expense_qs = Expense.objects.filter(
        shop_id=shop_id,
        occurred_on__gte=d_from,
        occurred_on__lte=d_to,
    )
    expense_list = list(expense_qs)
    total_expense_usd = sum((e.amount_usd() for e in expense_list), Decimal("0"))
    total_inventory_loss_usd = total_inventory_loss_usd_for_expenses(expense_list)

    purchase_qs = Purchase.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    )
    company_disc = purchase_qs.aggregate(
        s=Sum("discount_received_usd", output_field=dec),
    )["s"] or Decimal("0")

    net_profit = sum_sale - sum_buy - total_expense_usd - cust_disc + company_disc

    shareholders = Shareholder.objects.filter(shop_id=shop_id).order_by("name")
    profit_distribution = []
    for sh in shareholders:
        pct = (sh.share_percentage / Decimal("100")).quantize(Decimal("0.0001"))
        share_amt = (net_profit * pct).quantize(Decimal("0.0001"))
        cap = (sh.capital_contribution_usd or Decimal("0")).quantize(Decimal("0.0001"))
        after = (cap + share_amt).quantize(Decimal("0.0001"))
        profit_distribution.append(
            {
                "shareholder_id": sh.id,
                "name": sh.name,
                "share_percentage": format(sh.share_percentage, "f"),
                "capital_contribution_usd": format(cap, "f"),
                "profit_share_usd": format(share_amt, "f"),
                "position_after_period_usd": format(after, "f"),
            },
        )

    # Per-product rows
    items = []
    for _, r in sorted(per_product.items(), key=lambda kv: str(kv[0][1]).lower()):
        qty = int(r["quantity_sold"] or 0)
        tb = Decimal(r["total_buy"] or Decimal("0"))
        ts = Decimal(r["total_sale"] or Decimal("0"))
        if qty and qty > 0:
            ub = (tb / qty).quantize(Decimal("0.0001"))
            us = (ts / qty).quantize(Decimal("0.0001"))
        else:
            ub = Decimal("0")
            us = Decimal("0")
        items.append(
            {
                "product_id": r["product_id"],
                "product_name": r["product_name"],
                "quantity_sold": str(qty),
                "unit_buy_price_usd": format(ub, "f"),
                "total_buy_price_usd": format(tb, "f"),
                "unit_sale_price_usd": format(us, "f"),
                "total_sale_price_usd": format(ts, "f"),
                "net_profit_usd": format((ts - tb).quantize(Decimal("0.0001")), "f"),
            },
        )

    rate = latest_usd_to_iqd_for_shop(shop_id)
    return {
        "date_from": d_from.isoformat(),
        "date_to": d_to.isoformat(),
        "usd_to_iqd": format(rate, "f") if rate is not None else "",
        "totals": {
            "sum_sale_line_prices_usd": format(sum_sale, "f"),
            "sum_sale_line_buy_prices_usd": format(sum_buy, "f"),
            "total_customer_discounts_usd": format(cust_disc, "f"),
            "total_expenses_usd": format(total_expense_usd, "f"),
            "total_inventory_loss_usd": format(total_inventory_loss_usd, "f"),
            "total_company_discounts_received_usd": format(company_disc, "f"),
            "net_profit_usd": format(net_profit.quantize(Decimal("0.0001")), "f"),
        },
        "profit_distribution": profit_distribution,
        "lines": items,
    }


def profit_report_global(d_from, d_to) -> dict:
    """
    Aggregate profit report across all shops (superuser global scope).
    Lines include ``shop_id`` and ``shop_name``; shareholder distribution is omitted.
    """
    sum_sale = Decimal("0")
    sum_buy = Decimal("0")
    cust_disc_t = Decimal("0")
    expense_t = Decimal("0")
    inventory_loss_t = Decimal("0")
    company_disc_t = Decimal("0")
    net_t = Decimal("0")
    all_lines: list[dict] = []

    for shop in Shop.objects.all().order_by("name"):
        r = profit_report_for_shop(shop.pk, d_from, d_to)
        t = r["totals"]
        sum_sale += Decimal(t["sum_sale_line_prices_usd"])
        sum_buy += Decimal(t["sum_sale_line_buy_prices_usd"])
        cust_disc_t += Decimal(t["total_customer_discounts_usd"])
        expense_t += Decimal(t["total_expenses_usd"])
        inventory_loss_t += Decimal(t.get("total_inventory_loss_usd", "0"))
        company_disc_t += Decimal(t["total_company_discounts_received_usd"])
        net_t += Decimal(t["net_profit_usd"])
        for line in r["lines"]:
            row = {**line, "shop_id": shop.pk, "shop_name": shop.name}
            all_lines.append(row)

    return {
        "date_from": d_from.isoformat(),
        "date_to": d_to.isoformat(),
        "global_multi_shop": True,
        "usd_to_iqd": "",
        "totals": {
            "sum_sale_line_prices_usd": format(sum_sale, "f"),
            "sum_sale_line_buy_prices_usd": format(sum_buy, "f"),
            "total_customer_discounts_usd": format(cust_disc_t, "f"),
            "total_expenses_usd": format(expense_t, "f"),
            "total_inventory_loss_usd": format(inventory_loss_t, "f"),
            "total_company_discounts_received_usd": format(company_disc_t, "f"),
            "net_profit_usd": format(net_t.quantize(Decimal("0.0001")), "f"),
        },
        "profit_distribution": [],
        "lines": all_lines,
    }
