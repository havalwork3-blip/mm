"""Shared jard (inventory count) report data for API and manager Telegram digests."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from django.db.models import DecimalField, ExpressionWrapper, F, Sum

from .models import Product, ProductBatch, SaleLine, SaleReturnLine


def jard_rows_for_shop(
    shop_id: int,
    *,
    d_from=None,
    d_to=None,
    show_financials: bool = True,
) -> list[dict]:
    dec = DecimalField(max_digits=24, decimal_places=4)
    line_value = ExpressionWrapper(F("quantity") * F("unit_price_usd"), output_field=dec)

    # Aggregate sales, returns and FIFO layers separately: annotating them on one
    # Product query would multiply rows across the joins.
    sold_qs = SaleLine.objects.filter(sale__shop_id=shop_id, product__isnull=False)
    returned_qs = SaleReturnLine.objects.filter(
        sale_return__shop_id=shop_id,
        product__isnull=False,
    )
    if d_from:
        sold_qs = sold_qs.filter(sale__occurred_at__date__gte=d_from)
        returned_qs = returned_qs.filter(sale_line__sale__occurred_at__date__gte=d_from)
    if d_to:
        sold_qs = sold_qs.filter(sale__occurred_at__date__lte=d_to)
        returned_qs = returned_qs.filter(sale_line__sale__occurred_at__date__lte=d_to)
    sold = {
        r["product_id"]: r
        for r in sold_qs.values("product_id").annotate(q=Sum("quantity"), v=Sum(line_value))
    }
    # Returned units are valued at the original (gross) sale line price, the same basis
    # as sold_qs; the return line's own price is net of the invoice discount.
    returned_value = ExpressionWrapper(
        F("quantity") * F("sale_line__unit_price_usd"),
        output_field=dec,
    )
    returned = {
        r["product_id"]: r
        for r in returned_qs.values("product_id").annotate(q=Sum("quantity"), v=Sum(returned_value))
    }
    stock_value = {
        r["product_id"]: r["v"]
        for r in ProductBatch.objects.filter(
            product__shop_id=shop_id,
            remaining_quantity__gt=0,
        )
        .values("product_id")
        .annotate(
            v=Sum(
                ExpressionWrapper(F("remaining_quantity") * F("cost_price"), output_field=dec),
            ),
        )
    }

    rows = (
        Product.objects.filter(shop_id=shop_id, is_discontinued=False)
        .select_related("category")
        .order_by("category__name_ku", "category__name", "name")
    )
    data: list[dict] = []
    for p in rows:
        row = {
            "product_id": p.id,
            "product_name": p.name,
            "category_id": p.category_id,
            "category_name": p.category.display_name("ku") if p.category_id else "",
            "remaining_qty": int(p.current_stock_quantity or 0),
        }
        if show_financials:
            s_row = sold.get(p.id) or {}
            r_row = returned.get(p.id) or {}
            row["sold_qty"] = int(s_row.get("q") or 0) - int(r_row.get("q") or 0)
            row["unit_buy_price_usd"] = Decimal(p.buy_price or 0)
            # FIFO cost of units still on hand (not every unit at the latest buy price).
            row["remaining_value_usd"] = Decimal(stock_value.get(p.id) or 0)
            row["sold_value_usd"] = Decimal(s_row.get("v") or 0) - Decimal(r_row.get("v") or 0)
        data.append(row)
    return data


def jard_summary_for_shop(
    shop_id: int,
    *,
    d_from=None,
    d_to=None,
) -> dict:
    rows = jard_rows_for_shop(
        shop_id,
        d_from=d_from,
        d_to=d_to,
        show_financials=True,
    )
    total_remaining_qty = 0
    total_remaining_value = Decimal("0")
    total_sold_qty = 0
    total_sold_value = Decimal("0")
    for r in rows:
        total_remaining_qty += int(r["remaining_qty"])
        total_remaining_value += r.get("remaining_value_usd", Decimal("0"))
        total_sold_qty += int(r.get("sold_qty", 0))
        total_sold_value += r.get("sold_value_usd", Decimal("0"))
    by_category: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        cat = (r.get("category_name") or "").strip() or "—"
        by_category[cat].append(r)
    return {
        "product_count": len(rows),
        "total_remaining_qty": total_remaining_qty,
        "total_remaining_value_usd": total_remaining_value,
        "total_sold_qty": total_sold_qty,
        "total_sold_value_usd": total_sold_value,
        "by_category": dict(by_category),
        "rows": rows,
    }
