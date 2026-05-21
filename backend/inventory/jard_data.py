"""Shared jard (inventory count) report data for API and manager Telegram digests."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from django.db.models import DecimalField, ExpressionWrapper, F, Q, Sum, Value
from django.db.models.functions import Coalesce

from .models import Product


def jard_rows_for_shop(
    shop_id: int,
    *,
    d_from=None,
    d_to=None,
    show_financials: bool = True,
) -> list[dict]:
    sold_filter = Q()
    if d_from:
        sold_filter &= Q(sale_lines__sale__occurred_at__date__gte=d_from)
    if d_to:
        sold_filter &= Q(sale_lines__sale__occurred_at__date__lte=d_to)

    rows = (
        Product.objects.filter(shop_id=shop_id, is_discontinued=False)
        .select_related("category")
        .annotate(
            sold_qty=Coalesce(
                Sum("sale_lines__quantity", filter=sold_filter),
                Value(0),
            ),
            sold_revenue_usd=Coalesce(
                Sum(
                    ExpressionWrapper(
                        F("sale_lines__quantity") * F("sale_lines__unit_price_usd"),
                        output_field=DecimalField(max_digits=24, decimal_places=4),
                    ),
                    filter=sold_filter,
                ),
                Value(Decimal("0")),
            ),
        )
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
            row["sold_qty"] = int(p.sold_qty or 0)
            row["unit_buy_price_usd"] = Decimal(p.buy_price or 0)
            row["remaining_value_usd"] = (
                Decimal(p.current_stock_quantity or 0) * Decimal(p.buy_price or 0)
            )
            row["sold_value_usd"] = Decimal(p.sold_revenue_usd or 0)
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
