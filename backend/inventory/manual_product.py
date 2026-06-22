"""Resolve manual POS / purchase line names to inventory Product rows."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from inventory.models import Category, Product


def get_or_create_product_for_manual_name(
    *,
    shop_id: int,
    manual_name: str,
    unit_price_usd: Decimal,
    unit_cost_usd: Decimal | None = None,
) -> Product:
    """
    Find or create a product for a line sold/purchased by name only.
    Used when an item is not yet in the catalog.
    """
    name = str(manual_name or "").strip()
    if not name:
        raise ValueError("manual_name is required")

    cost = unit_cost_usd if unit_cost_usd is not None else unit_price_usd

    with transaction.atomic():
        existing = (
            Product.objects.select_for_update()
            .filter(shop_id=shop_id, name__iexact=name)
            .first()
        )
        if existing is not None:
            return existing

        fallback_category = (
            Category.objects.filter(shop_id=shop_id).order_by("id").first()
        )
        if fallback_category is None:
            fallback_category = Category.objects.create(
                shop_id=shop_id,
                name="General",
            )

        return Product.objects.create(
            shop_id=shop_id,
            name=name,
            is_unregistered_placeholder=True,
            category=fallback_category,
            buy_price=cost,
            sale_price_retail=unit_price_usd,
            sale_price_wholesale=unit_price_usd,
            current_stock_quantity=0,
        )
