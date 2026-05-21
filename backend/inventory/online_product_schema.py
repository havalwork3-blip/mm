"""Detect whether online product content DB schema (0024) is applied."""

from __future__ import annotations

from django.db.models import Prefetch

_MIGRATION_NAME = "0024_storefront_product_content"


def storefront_gallery_prefetch() -> Prefetch:
    from inventory.models import StorefrontProductGalleryImage

    return Prefetch(
        "storefront_gallery_images",
        queryset=StorefrontProductGalleryImage.objects.order_by("sort_order", "id"),
    )


def online_product_content_schema_ready() -> bool:
    try:
        from django.db.migrations.recorder import MigrationRecorder

        return MigrationRecorder.Migration.objects.filter(
            app="inventory",
            name=_MIGRATION_NAME,
        ).exists()
    except Exception:
        return False


def product_pricing_queryset(shop_id: int):
    """Products for merchant online pricing API — safe before/after migration 0024."""
    from inventory.models import Product

    qs = (
        Product.objects.filter(shop_id=shop_id, is_unregistered_placeholder=False)
        .select_related("category")
        .order_by("name")
    )
    if not online_product_content_schema_ready():
        return qs.only(
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
    return qs.prefetch_related(storefront_gallery_prefetch())
