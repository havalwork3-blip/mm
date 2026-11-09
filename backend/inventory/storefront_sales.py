"""
Online-store orders become real sales when they are completed.

Stock was already taken (FIFO) when the order was placed, so the sale does not
deduct again: the order's batch deductions are moved onto the new sale lines.
The sale then behaves exactly like a POS sale (profit, cash box, returns).
"""

from __future__ import annotations

from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Max
from rest_framework import serializers

from .models import (
    Customer,
    Sale,
    SaleLine,
    SaleLineBatchDeduction,
    StorefrontOrder,
    StorefrontOrderItemBatchDeduction,
)


def _customer_for_order(order: StorefrontOrder) -> Customer:
    phone = (order.customer_phone or "").strip()
    found = None
    if phone:
        found = Customer.objects.filter(shop_id=order.shop_id, phone_1=phone).first()
    if found is not None:
        return found
    return Customer.objects.create(
        shop_id=order.shop_id,
        name=(order.customer_name or "").strip() or phone or "Online customer",
        phone_1=phone,
        address=(order.customer_address or "")[:255],
    )


def _usd_rate(shop_id: int) -> Decimal:
    from .serializers import latest_usd_to_iqd_for_shop

    rate = latest_usd_to_iqd_for_shop(shop_id)
    return Decimal(str(rate)) if rate and Decimal(str(rate)) > 0 else Decimal("1")


@transaction.atomic
def create_sale_for_completed_order(order: StorefrontOrder) -> Sale:
    """Record a completed (delivered and paid) online order as a paid sale."""
    existing = Sale.objects.filter(storefront_order=order).first()
    if existing is not None:
        return existing

    total = Decimal(order.total_amount or 0)
    for attempt in range(3):
        latest = Sale.objects.filter(shop_id=order.shop_id).aggregate(m=Max("receipt_number"))["m"] or 0
        try:
            with transaction.atomic():
                sale = Sale.objects.create(
                    shop_id=order.shop_id,
                    customer=_customer_for_order(order),
                    occurred_at=order.updated_at,
                    exchange_rate_usd_to_iqd=_usd_rate(order.shop_id),
                    amount_paid_usd=total,
                    receipt_number=int(latest) + 1,
                    note=f"Online order #{order.pk}",
                    storefront_order=order,
                )
            break
        except IntegrityError:
            if attempt == 2:
                raise

    for item in order.items.select_related("product"):
        rows = list(StorefrontOrderItemBatchDeduction.objects.filter(order_item=item))
        qty = sum(int(r.quantity) for r in rows)
        cost = sum((Decimal(r.quantity) * Decimal(r.unit_cost_usd) for r in rows), Decimal("0"))
        line = SaleLine.objects.create(
            sale=sale,
            product=item.product,
            quantity=item.quantity,
            unit_price_usd=item.unit_price,
            unit_buy_price_usd=(cost / qty).quantize(Decimal("0.0001")) if qty else Decimal(
                item.product.buy_price if item.product_id else 0,
            ),
        )
        SaleLineBatchDeduction.objects.bulk_create(
            [
                SaleLineBatchDeduction(
                    sale_line=line,
                    batch_id=r.batch_id,
                    quantity=r.quantity,
                    unit_cost_usd=r.unit_cost_usd,
                )
                for r in rows
            ],
        )
        StorefrontOrderItemBatchDeduction.objects.filter(order_item=item).delete()

    fee = Decimal(order.delivery_fee or 0)
    if fee > 0:
        label = f"Delivery {order.delivery_zone_name}".strip()
        SaleLine.objects.create(sale=sale, manual_name=label[:255], quantity=1, unit_price_usd=fee)
    return sale


@transaction.atomic
def undo_sale_for_order(order: StorefrontOrder) -> None:
    """
    An order moved back out of COMPLETED: remove its sale and give the FIFO
    deductions back to the order items (a later cancel then restores stock once).
    """
    sale = Sale.objects.select_for_update().filter(storefront_order=order).first()
    if sale is None:
        return
    if sale.returns.exists():
        raise serializers.ValidationError(
            {"status": "This order's sale has returns recorded; it can no longer be reopened."},
        )
    items_by_product = {item.product_id: item for item in order.items.all()}
    for line in sale.lines.all():
        item = items_by_product.get(line.product_id) if line.product_id else None
        rows = list(SaleLineBatchDeduction.objects.filter(sale_line=line))
        if item is not None:
            StorefrontOrderItemBatchDeduction.objects.bulk_create(
                [
                    StorefrontOrderItemBatchDeduction(
                        order_item=item,
                        batch_id=r.batch_id,
                        quantity=r.quantity,
                        unit_cost_usd=r.unit_cost_usd,
                    )
                    for r in rows
                ],
            )
        SaleLineBatchDeduction.objects.filter(sale_line=line).delete()
    from .models import CustomerDebtPaymentSale

    CustomerDebtPaymentSale.objects.filter(sale=sale).delete()
    sale.delete()
