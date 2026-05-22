"""Detect whether online product content DB schema (0024) is applied."""

from __future__ import annotations

from django.db.models import Prefetch

_NARROW_ONLY = (
    "id",
    "shop_id",
    "name",
    "category_id",
    "sale_price_retail",
    "online_sale_price",
    "online_discount_percent",
    "online_discount_min_quantity",
    "current_stock_quantity",
    "is_discontinued",
    "image",
)

_content_schema_ready: bool | None = None


def storefront_gallery_prefetch() -> Prefetch:
    from inventory.models import StorefrontProductGalleryImage

    return Prefetch(
        "storefront_gallery_images",
        queryset=StorefrontProductGalleryImage.objects.order_by("sort_order", "id"),
    )


def _probe_online_product_content_schema() -> bool:
    """True when product.online_description column and gallery table exist."""
    from inventory.models import Product, StorefrontProductGalleryImage

    try:
        Product.objects.order_by("pk").values_list("online_description", flat=True)[:1]
        StorefrontProductGalleryImage.objects.values_list("pk", flat=True)[:1]
        return True
    except Exception:
        return False


def online_product_content_schema_ready() -> bool:
    global _content_schema_ready
    if _content_schema_ready is None:
        _content_schema_ready = _probe_online_product_content_schema()
    return _content_schema_ready


def product_pricing_queryset(shop_id: int):
    """
    Products for merchant online pricing API — safe before/after migration 0024.

    Returns (queryset, include_online_content).
    """
    from inventory.models import Product

    base = (
        Product.objects.filter(shop_id=shop_id, is_unregistered_placeholder=False)
        .select_related("category")
        .order_by("name")
    )
    if not online_product_content_schema_ready():
        return base.only(*_NARROW_ONLY), False
    return base.prefetch_related(storefront_gallery_prefetch()), True


def product_pricing_lookup_queryset(shop_id: int, product_id: int):
    """Single product for PATCH row — avoids loading missing columns."""
    from inventory.models import Product

    base = Product.objects.filter(
        pk=product_id,
        shop_id=shop_id,
        is_unregistered_placeholder=False,
    )
    if not online_product_content_schema_ready():
        return base.only(*_NARROW_ONLY).first()
    return base.first()
