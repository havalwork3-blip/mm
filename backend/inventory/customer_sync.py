"""Replicate customer profile fields across all active shops."""

from __future__ import annotations

from shops.models import Shop

from .models import Customer

# Customer profile fields replicated across shops.
# Never sync receipt numbers, invoice numbers, database ids, debt, or sales data.
SYNC_FIELDS = (
    "name",
    "workplace",
    "address",
    "phone_1",
    "phone_2",
    "requires_attention",
    "note",
)


def _find_peer_in_shop(shop_id: int, name: str, phone_1: str) -> Customer | None:
    qs = Customer.objects.filter(shop_id=shop_id)
    phone = (phone_1 or "").strip()
    if phone:
        peer = qs.filter(phone_1=phone).first()
        if peer is not None:
            return peer
    name_clean = (name or "").strip()
    if name_clean:
        return qs.filter(name__iexact=name_clean).first()
    return None


def sync_customer_profile_to_sibling_shops(
    source: Customer,
    *,
    old_snapshot: dict[str, object] | None = None,
) -> None:
    """
    Copy customer profile fields to the same logical customer in every other active shop.

    Matching uses the pre-update identity when ``old_snapshot`` is set (phone first, then name).
    """
    lookup_name = source.name
    lookup_phone = source.phone_1
    if old_snapshot is not None:
        lookup_name = old_snapshot.get("name", lookup_name)
        lookup_phone = old_snapshot.get("phone_1", lookup_phone)

    new_vals = {field: getattr(source, field) for field in SYNC_FIELDS}
    other_shop_ids = (
        Shop.objects.filter(is_active=True)
        .exclude(pk=source.shop_id)
        .values_list("pk", flat=True)
    )

    to_create: list[Customer] = []
    for shop_id in other_shop_ids:
        peer = _find_peer_in_shop(shop_id, lookup_name, lookup_phone)
        if peer is not None:
            Customer.objects.filter(pk=peer.pk).update(**new_vals)
        else:
            to_create.append(Customer(shop_id=shop_id, **new_vals))

    if to_create:
        Customer.objects.bulk_create(to_create)
