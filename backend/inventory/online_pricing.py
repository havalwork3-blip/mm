"""Online storefront price and quantity-tier discounts."""

from __future__ import annotations

from decimal import Decimal

from inventory.models import Product


def online_base_price(product: Product) -> Decimal:
    if product.online_sale_price is not None:
        return Decimal(product.online_sale_price)
    return Decimal(product.sale_price_retail or 0)


def effective_online_unit_price(product: Product, quantity: int = 1) -> Decimal:
    """Unit price after optional % discount when quantity >= min threshold."""
    base = online_base_price(product)
    qty = max(1, int(quantity))
    pct = Decimal(str(product.online_discount_percent or 0))
    min_qty = max(1, int(product.online_discount_min_quantity or 1))
    if pct > 0 and qty >= min_qty:
        factor = Decimal("1") - (pct / Decimal("100"))
        return (base * factor).quantize(Decimal("0.0001"))
    return base.quantize(Decimal("0.0001"))
