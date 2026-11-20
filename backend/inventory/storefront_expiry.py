"""
Release stock held by online orders nobody handled.

A PENDING public order takes its stock immediately. Without an expiry, fake or abandoned
orders keep products "unavailable" on the storefront until staff cancel each one by hand.
PENDING orders older than STOREFRONT_PENDING_ORDER_HOURS are cancelled automatically (stock
restored through the normal cancel path). PROCESSING orders — accepted by staff — never expire.
"""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .models import StorefrontOrder, StorefrontOrderStatus


def pending_order_lifetime() -> timedelta:
    hours = int(getattr(settings, "STOREFRONT_PENDING_ORDER_HOURS", 48) or 0)
    return timedelta(hours=hours) if hours > 0 else timedelta(0)


def expire_stale_pending_orders(shop_id: int | None = None) -> int:
    """Cancel stale PENDING orders (all shops, or one). Returns how many were cancelled."""
    lifetime = pending_order_lifetime()
    if lifetime <= timedelta(0):
        return 0  # expiry disabled
    from .serializers import MerchantStorefrontOrderSerializer

    qs = StorefrontOrder.objects.filter(
        status=StorefrontOrderStatus.PENDING,
        created_at__lt=timezone.now() - lifetime,
    )
    if shop_id is not None:
        qs = qs.filter(shop_id=shop_id)
    cancelled = 0
    for order in qs.only("pk", "status"):
        ser = MerchantStorefrontOrderSerializer(
            order,
            data={"status": StorefrontOrderStatus.CANCELLED},
            partial=True,
        )
        ser.is_valid(raise_exception=True)
        before = order.status
        updated = ser.save()
        # The serializer re-checks the status under a row lock (another request may have won).
        if before == StorefrontOrderStatus.PENDING and updated.status == StorefrontOrderStatus.CANCELLED:
            cancelled += 1
    return cancelled
