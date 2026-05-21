"""Helpers for storefront delivery zones."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from shops.models import StorefrontDeliveryZone


def delivery_zones_public_list(shop_id: int) -> list[dict[str, str | int]]:
    from shops.models import StorefrontDeliveryZone

    rows = StorefrontDeliveryZone.objects.filter(shop_id=shop_id, is_active=True).order_by(
        "sort_order",
        "name",
        "id",
    )
    out: list[dict[str, str | int]] = []
    for row in rows:
        fee = row.delivery_fee_usd
        if fee is None:
            fee = Decimal("0")
        out.append(
            {
                "id": row.id,
                "name": (row.name or "").strip(),
                "delivery_fee_usd": str(fee.quantize(Decimal("0.01"))),
            },
        )
    return out


def resolve_delivery_zone(shop_id: int, zone_id: int | None) -> StorefrontDeliveryZone | None:
    from shops.models import StorefrontDeliveryZone

    if zone_id is None:
        return None
    return (
        StorefrontDeliveryZone.objects.filter(
            pk=zone_id,
            shop_id=shop_id,
            is_active=True,
        )
        .first()
    )
