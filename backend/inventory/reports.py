"""Profit report aggregation (USD)."""

from __future__ import annotations

import os
from datetime import datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.db.models import DecimalField, Sum
from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone

from shops.models import Shop

from .models import (
    CustomerDebtDiscountWriteoff,
    CustomerDebtDiscountWriteoffSale,
    Expense,
    Purchase,
    Sale,
    SaleLine,
    Shareholder,
    ShareholderPayment,
)
from .sale_line_flags import sale_line_flags
from .serializers import latest_usd_to_iqd_for_shop

INVENTORY_LOSS_NOTE_MARKERS = (
    "[AUTO_INVENTORY_LOSS]",
    "[AUTO_DISCONTINUE_LOSS]",
)

_MONEY_Q = Decimal("0.0001")


def _money_q(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(_MONEY_Q)


def _money_fmt(value) -> str:
    return format(_money_q(value), "f")


def _latest_purchase_unit_cost_by_product(shop_id: int) -> dict[int, Decimal]:
    """Most recent purchase unit cost per product — COGS fallback when sale snapshot is 0."""
    from .models import PurchaseLine

    costs: dict[int, Decimal] = {}
    for pl in (
        PurchaseLine.objects.filter(
            purchase__shop_id=shop_id,
            product_id__isnull=False,
        )
        .select_related("purchase")
        .order_by("product_id", "-purchase__occurred_at", "-id")
    ):
        pid = pl.product_id
        if pid not in costs:
            costs[pid] = _money_q(pl.unit_cost_usd)
    return costs


def _effective_line_buy_price_usd(
    ln,
    *,
    purchase_costs: dict[int, Decimal],
) -> Decimal:
    snap = _money_q(ln.unit_buy_price_usd)
    if snap > 0:
        return snap
    pid = ln.product_id
    if not pid:
        return Decimal("0")
    if ln.product is not None:
        catalog = _money_q(ln.product.buy_price)
        if catalog > 0:
            return catalog
    return purchase_costs.get(pid, Decimal("0"))


def expense_is_inventory_loss(expense: Expense) -> bool:
    note = (expense.note or "").strip()
    return any(note.startswith(marker) for marker in INVENTORY_LOSS_NOTE_MARKERS)


def total_inventory_loss_usd_for_expenses(expense_qs) -> Decimal:
    return sum(
        (e.amount_usd() for e in expense_qs if expense_is_inventory_loss(e)),
        Decimal("0"),
    )


def _shareholder_paid_usd_by_period(
    shop_id: int,
    sh_ids: list[int],
    d_from,
    d_to,
    *,
    dec: DecimalField,
) -> dict[int, Decimal]:
    """Sum partner payouts for a profit period; empty if table not migrated yet."""
    paid_by_sh: dict[int, Decimal] = {sid: Decimal("0") for sid in sh_ids}
    if not sh_ids:
        return paid_by_sh
    try:
        for row in (
            ShareholderPayment.objects.filter(
                shop_id=shop_id,
                shareholder_id__in=sh_ids,
                period_from=d_from,
                period_to=d_to,
            )
            .values("shareholder_id")
            .annotate(total=Sum("amount_usd", output_field=dec))
        ):
            paid_by_sh[row["shareholder_id"]] = row["total"] or Decimal("0")
    except (ProgrammingError, OperationalError):
        return paid_by_sh
    return paid_by_sh


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
    purchase_costs = _latest_purchase_unit_cost_by_product(shop_id)
    per_product: dict[tuple[int | None, str], dict[str, Decimal | int | str | None]] = {}
    for ln in line_qs.select_related("product", "product__category").prefetch_related("return_lines"):
        returned_qty = sum(int(row.quantity) for row in ln.return_lines.all())
        net_qty = max(0, int(ln.quantity) - returned_qty)
        if net_qty <= 0:
            continue
        unit_buy = _effective_line_buy_price_usd(ln, purchase_costs=purchase_costs)
        line_sale = Decimal(net_qty) * Decimal(ln.unit_price_usd)
        line_buy = Decimal(net_qty) * unit_buy
        sum_sale += line_sale
        sum_buy += line_buy
        product_id = ln.product_id
        display_name = (ln.product.name if ln.product_id and ln.product is not None else ln.manual_name or "Manual line")
        category_id = None
        category_name = ""
        if ln.product_id and ln.product is not None and ln.product.category_id:
            category_id = ln.product.category_id
            cat = ln.product.category
            category_name = cat.display_name("ku") if hasattr(cat, "display_name") else (cat.name_ku or cat.name)
        key = (product_id, display_name)
        flags = sale_line_flags(ln.unit_price_usd, unit_buy, net_qty)
        if key not in per_product:
            per_product[key] = {
                "product_id": product_id,
                "product_name": display_name,
                "category_id": category_id,
                "category_name": category_name,
                "quantity_sold": 0,
                "quantity_sold_at_zero": 0,
                "total_buy": Decimal("0"),
                "total_sale": Decimal("0"),
                "total_loss_usd": Decimal("0"),
                "has_loss_sales": False,
            }
        row = per_product[key]
        row["quantity_sold"] = int(row["quantity_sold"]) + net_qty
        row["total_buy"] = Decimal(row["total_buy"]) + line_buy
        row["total_sale"] = Decimal(row["total_sale"]) + line_sale
        if flags["sold_at_zero"]:
            row["quantity_sold_at_zero"] = int(row["quantity_sold_at_zero"]) + net_qty
        if flags["sold_at_loss"]:
            row["has_loss_sales"] = True
            row["total_loss_usd"] = Decimal(row["total_loss_usd"]) + Decimal(
                str(flags["line_loss_usd"]),
            )

    sale_qs = Sale.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    )
    cust_disc = sale_qs.aggregate(
        s=Sum("invoice_discount_usd", output_field=dec),
    )["s"] or Decimal("0")
    writeoff_disc = (
        CustomerDebtDiscountWriteoff.objects.filter(
            shop_id=shop_id,
            occurred_at__gte=start,
            occurred_at__lte=end,
        ).aggregate(s=Sum("amount_usd", output_field=dec))["s"]
        or Decimal("0")
    )
    writeoff_overlap = (
        CustomerDebtDiscountWriteoffSale.objects.filter(
            writeoff__shop_id=shop_id,
            writeoff__occurred_at__gte=start,
            writeoff__occurred_at__lte=end,
            sale__occurred_at__gte=start,
            sale__occurred_at__lte=end,
        ).aggregate(s=Sum("amount_usd", output_field=dec))["s"]
        or Decimal("0")
    )
    cust_disc = Decimal(str(cust_disc)) + Decimal(str(writeoff_disc)) - Decimal(str(writeoff_overlap))

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
    ).prefetch_related("lines")
    total_purchases_goods_usd = Decimal("0")
    for pur in purchase_qs:
        line_sum = Decimal("0")
        for ln in pur.lines.all():
            line_sum += Decimal(ln.quantity) * Decimal(ln.unit_cost_usd)
        net_goods = line_sum - Decimal(pur.discount_received_usd)
        if net_goods < 0:
            net_goods = Decimal("0")
        total_purchases_goods_usd += net_goods
    company_disc = purchase_qs.aggregate(
        s=Sum("discount_received_usd", output_field=dec),
    )["s"] or Decimal("0")

    sum_sale_q = _money_q(sum_sale)
    sum_buy_q = _money_q(sum_buy)
    cust_disc_q = _money_q(cust_disc)
    total_expense_q = _money_q(total_expense_usd)
    inventory_loss_q = _money_q(total_inventory_loss_usd)
    operating_expense_q = _money_q(total_expense_q - inventory_loss_q)
    company_disc_q = _money_q(company_disc)
    total_purchases_goods_q = _money_q(total_purchases_goods_usd)
    gross_margin_q = _money_q(sum_sale_q - sum_buy_q)
    gross_margin_purchases_q = _money_q(sum_sale_q - total_purchases_goods_q)
    net_profit_q = _money_q(
        gross_margin_q - total_expense_q - cust_disc_q + company_disc_q,
    )

    shareholders = Shareholder.objects.filter(shop_id=shop_id).order_by("name")
    sh_ids = [sh.id for sh in shareholders]
    paid_by_sh = _shareholder_paid_usd_by_period(shop_id, sh_ids, d_from, d_to, dec=dec)

    profit_distribution = []
    for sh in shareholders:
        pct = (sh.share_percentage / Decimal("100")).quantize(Decimal("0.0001"))
        share_amt = (net_profit_q * pct).quantize(_MONEY_Q)
        cap = (sh.capital_contribution_usd or Decimal("0")).quantize(Decimal("0.0001"))
        after = (cap + share_amt).quantize(Decimal("0.0001"))
        paid = paid_by_sh.get(sh.id, Decimal("0")).quantize(Decimal("0.0001"))
        outstanding = (share_amt - paid).quantize(Decimal("0.0001"))
        profit_distribution.append(
            {
                "shareholder_id": sh.id,
                "name": sh.name,
                "share_percentage": format(sh.share_percentage, "f"),
                "capital_contribution_usd": format(cap, "f"),
                "profit_share_usd": format(share_amt, "f"),
                "total_paid_usd": format(paid, "f"),
                "outstanding_usd": format(outstanding, "f"),
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
        tb_q = _money_q(tb)
        ts_q = _money_q(ts)
        items.append(
            {
                "product_id": r["product_id"],
                "product_name": r["product_name"],
                "category_id": r.get("category_id"),
                "category_name": r.get("category_name") or "",
                "quantity_sold": str(qty),
                "quantity_sold_at_zero": str(int(r.get("quantity_sold_at_zero") or 0)),
                "has_loss_sales": bool(r.get("has_loss_sales")),
                "total_loss_usd": _money_fmt(r.get("total_loss_usd")),
                "unit_buy_price_usd": _money_fmt(ub),
                "total_buy_price_usd": _money_fmt(tb_q),
                "unit_sale_price_usd": _money_fmt(us),
                "total_sale_price_usd": _money_fmt(ts_q),
                "net_profit_usd": _money_fmt(ts_q - tb_q),
            },
        )

    lines_gross_q = _money_q(sum(_money_q(row["net_profit_usd"]) for row in items))

    rate = latest_usd_to_iqd_for_shop(shop_id)
    return {
        "date_from": d_from.isoformat(),
        "date_to": d_to.isoformat(),
        "usd_to_iqd": format(rate, "f") if rate is not None else "",
        "totals": {
            "sum_sale_line_prices_usd": _money_fmt(sum_sale_q),
            "sum_sale_line_buy_prices_usd": _money_fmt(sum_buy_q),
            "total_purchases_goods_usd": _money_fmt(total_purchases_goods_q),
            "gross_margin_usd": _money_fmt(gross_margin_q),
            "gross_margin_purchases_usd": _money_fmt(gross_margin_purchases_q),
            "lines_gross_total_usd": _money_fmt(lines_gross_q),
            "total_customer_discounts_usd": _money_fmt(cust_disc_q),
            "total_expenses_usd": _money_fmt(total_expense_q),
            "total_operating_expenses_usd": _money_fmt(operating_expense_q),
            "total_inventory_loss_usd": _money_fmt(inventory_loss_q),
            "total_company_discounts_received_usd": _money_fmt(company_disc_q),
            "net_profit_usd": _money_fmt(net_profit_q),
        },
        "profit_distribution": profit_distribution,
        "lines": items,
    }


def profit_report_global(d_from, d_to) -> dict:
    """
    Aggregate profit report across all shops (superuser global scope).
    Lines include ``shop_id`` and ``shop_name``; shareholder distribution is omitted.
    """
    sum_sale_q = Decimal("0")
    sum_buy_q = Decimal("0")
    gross_margin_q = Decimal("0")
    lines_gross_q = Decimal("0")
    cust_disc_q = Decimal("0")
    expense_q = Decimal("0")
    operating_q = Decimal("0")
    inventory_loss_q = Decimal("0")
    company_disc_q = Decimal("0")
    purchases_goods_q = Decimal("0")
    gross_margin_purchases_q = Decimal("0")
    net_q = Decimal("0")
    all_lines: list[dict] = []

    for shop in Shop.objects.all().order_by("name"):
        r = profit_report_for_shop(shop.pk, d_from, d_to)
        t = r["totals"]
        sum_sale_q += _money_q(t["sum_sale_line_prices_usd"])
        sum_buy_q += _money_q(t["sum_sale_line_buy_prices_usd"])
        purchases_goods_q += _money_q(t.get("total_purchases_goods_usd", "0"))
        gross_margin_q += _money_q(t.get("gross_margin_usd", "0"))
        gross_margin_purchases_q += _money_q(t.get("gross_margin_purchases_usd", "0"))
        lines_gross_q += _money_q(t.get("lines_gross_total_usd", "0"))
        cust_disc_q += _money_q(t["total_customer_discounts_usd"])
        expense_q += _money_q(t["total_expenses_usd"])
        operating_q += _money_q(t.get("total_operating_expenses_usd", "0"))
        inventory_loss_q += _money_q(t.get("total_inventory_loss_usd", "0"))
        company_disc_q += _money_q(t["total_company_discounts_received_usd"])
        net_q += _money_q(t["net_profit_usd"])
        for line in r["lines"]:
            row = {**line, "shop_id": shop.pk, "shop_name": shop.name}
            all_lines.append(row)

    return {
        "date_from": d_from.isoformat(),
        "date_to": d_to.isoformat(),
        "global_multi_shop": True,
        "usd_to_iqd": "",
        "totals": {
            "sum_sale_line_prices_usd": _money_fmt(sum_sale_q),
            "sum_sale_line_buy_prices_usd": _money_fmt(sum_buy_q),
            "total_purchases_goods_usd": _money_fmt(purchases_goods_q),
            "gross_margin_usd": _money_fmt(gross_margin_q),
            "gross_margin_purchases_usd": _money_fmt(gross_margin_purchases_q),
            "lines_gross_total_usd": _money_fmt(lines_gross_q),
            "total_customer_discounts_usd": _money_fmt(cust_disc_q),
            "total_expenses_usd": _money_fmt(expense_q),
            "total_operating_expenses_usd": _money_fmt(operating_q),
            "total_inventory_loss_usd": _money_fmt(inventory_loss_q),
            "total_company_discounts_received_usd": _money_fmt(company_disc_q),
            "net_profit_usd": _money_fmt(net_q),
        },
        "profit_distribution": [],
        "lines": all_lines,
    }
