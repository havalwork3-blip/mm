"""
FIFO inventory cost layers.

Purchases (and stock increases) create ProductBatch rows. Sales and other
stock-outs consume remaining_quantity from the oldest batch first.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Sequence

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone

from .models import (
    Product,
    ProductBatch,
    PurchaseLine,
    SaleLine,
    SaleLineBatchDeduction,
    StorefrontOrderItem,
    StorefrontOrderItemBatchDeduction,
)


@dataclass(frozen=True)
class BatchDeduction:
    """batch is None when units must be priced as oversold (no remaining layer)."""

    batch: ProductBatch | None
    quantity: int
    unit_cost_usd: Decimal


@dataclass(frozen=True)
class FifoResult:
    deductions: list[BatchDeduction]
    total_cost_usd: Decimal
    weighted_unit_cost_usd: Decimal
    quantity: int


def _money(value: Decimal | str | int | float | None) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.0001"))


def available_batch_quantity(product_id: int) -> int:
    total = (
        ProductBatch.objects.filter(product_id=product_id, remaining_quantity__gt=0).aggregate(
            s=Sum("remaining_quantity"),
        )["s"]
        or 0
    )
    return int(total)


@transaction.atomic
def create_product_batch(
    *,
    product: Product,
    quantity: int,
    cost_price: Decimal | str,
    purchase_line: PurchaseLine | None = None,
    received_at=None,
) -> ProductBatch | None:
    """
    Record a new FIFO layer. quantity is units added to sellable stock
    (already excluding damaged). Returns None when quantity <= 0.
    """
    qty = int(quantity)
    if qty <= 0:
        return None
    when = received_at or timezone.now()
    return ProductBatch.objects.create(
        product=product,
        purchase_line=purchase_line,
        quantity=qty,
        remaining_quantity=qty,
        cost_price=_money(cost_price),
        received_at=when,
    )


def _locked_fifo_batches(product_id: int) -> list[ProductBatch]:
    return list(
        ProductBatch.objects.select_for_update()
        .filter(product_id=product_id, remaining_quantity__gt=0)
        .order_by("received_at", "id")
    )


def plan_fifo_deductions(
    product: Product,
    quantity: int,
    *,
    allow_negative: bool = True,
    fallback_unit_cost: Decimal | None = None,
) -> list[BatchDeduction]:
    """
    Plan FIFO consumption without writing. Caller must hold product/batch locks
    inside an atomic block when applying.
    """
    qty = int(quantity)
    if qty <= 0:
        raise ValidationError("Quantity to deduct must be positive.")

    batches = _locked_fifo_batches(product.pk)
    available = sum(int(b.remaining_quantity) for b in batches)
    if available < qty and not allow_negative:
        raise ValidationError(
            f"Insufficient stock for {product.name} "
            f"(requested {qty}, available in batches {available}).",
        )

    remaining = qty
    planned: list[BatchDeduction] = []
    for batch in batches:
        if remaining <= 0:
            break
        take = min(int(batch.remaining_quantity), remaining)
        if take <= 0:
            continue
        planned.append(
            BatchDeduction(
                batch=batch,
                quantity=take,
                unit_cost_usd=_money(batch.cost_price),
            ),
        )
        remaining -= take

    if remaining > 0:
        unit = _money(fallback_unit_cost if fallback_unit_cost is not None else product.buy_price)
        planned.append(
            BatchDeduction(batch=None, quantity=remaining, unit_cost_usd=unit),
        )

    return planned


def apply_batch_deductions(
    product: Product,
    planned: Sequence[BatchDeduction],
) -> FifoResult:
    total_cost = Decimal("0")
    total_qty = 0
    applied: list[BatchDeduction] = []
    for d in planned:
        batch = d.batch
        if batch is None:
            batch = ProductBatch.objects.create(
                product=product,
                purchase_line=None,
                quantity=0,
                remaining_quantity=0,
                cost_price=d.unit_cost_usd,
                received_at=timezone.now(),
            )
        else:
            locked = ProductBatch.objects.select_for_update().get(pk=batch.pk)
            if int(locked.remaining_quantity) < d.quantity:
                raise ValidationError(
                    f"Batch {locked.pk} changed concurrently "
                    f"(need {d.quantity}, have {locked.remaining_quantity}).",
                )
            ProductBatch.objects.filter(pk=locked.pk).update(
                remaining_quantity=F("remaining_quantity") - d.quantity,
            )
            locked.refresh_from_db(fields=["remaining_quantity"])
            batch = locked

        applied.append(
            BatchDeduction(
                batch=batch,
                quantity=d.quantity,
                unit_cost_usd=_money(d.unit_cost_usd),
            ),
        )
        total_cost += _money(d.unit_cost_usd) * Decimal(d.quantity)
        total_qty += d.quantity

    total_cost = total_cost.quantize(Decimal("0.0001"))
    weighted = (
        (total_cost / Decimal(total_qty)).quantize(Decimal("0.0001"))
        if total_qty
        else Decimal("0.0000")
    )
    return FifoResult(
        deductions=applied,
        total_cost_usd=total_cost,
        weighted_unit_cost_usd=weighted,
        quantity=total_qty,
    )


@transaction.atomic
def deduct_fifo_stock(
    product: Product,
    quantity: int,
    *,
    allow_negative: bool = True,
    fallback_unit_cost: Decimal | None = None,
) -> FifoResult:
    """
    Atomically consume FIFO layers for `quantity` units of `product`.
    Does NOT update Product.current_stock_quantity — callers already do that.
    """
    Product.objects.select_for_update().filter(pk=product.pk).first()
    planned = plan_fifo_deductions(
        product,
        quantity,
        allow_negative=allow_negative,
        fallback_unit_cost=fallback_unit_cost,
    )
    return apply_batch_deductions(product, planned)


def record_sale_line_deductions(sale_line: SaleLine, result: FifoResult) -> None:
    SaleLineBatchDeduction.objects.bulk_create(
        [
            SaleLineBatchDeduction(
                sale_line=sale_line,
                batch=d.batch,
                quantity=d.quantity,
                unit_cost_usd=d.unit_cost_usd,
            )
            for d in result.deductions
            if d.batch is not None
        ],
    )


def record_storefront_item_deductions(
    order_item: StorefrontOrderItem,
    result: FifoResult,
) -> None:
    StorefrontOrderItemBatchDeduction.objects.bulk_create(
        [
            StorefrontOrderItemBatchDeduction(
                order_item=order_item,
                batch=d.batch,
                quantity=d.quantity,
                unit_cost_usd=d.unit_cost_usd,
            )
            for d in result.deductions
            if d.batch is not None
        ],
    )


@transaction.atomic
def restore_sale_line_batches(sale_line: SaleLine) -> int:
    """
    Put units back onto the batches they were taken from (sale edit / reverse).
    Returns restored quantity.
    """
    restored = 0
    rows = list(
        SaleLineBatchDeduction.objects.select_for_update()
        .filter(sale_line_id=sale_line.pk)
        .select_related("batch")
        .order_by("id"),
    )
    for row in rows:
        ProductBatch.objects.select_for_update().filter(pk=row.batch_id).update(
            remaining_quantity=F("remaining_quantity") + row.quantity,
        )
        restored += int(row.quantity)
    SaleLineBatchDeduction.objects.filter(sale_line_id=sale_line.pk).delete()
    return restored


@transaction.atomic
def restore_sale_line_batches_partial(sale_line: SaleLine, quantity: int) -> int:
    """
    Restore up to `quantity` units for a partial sale return, newest deduction
    first (LIFO on the deduction list so oldest open layers stay depleted).
    """
    need = int(quantity)
    if need <= 0:
        return 0
    restored = 0
    rows = list(
        SaleLineBatchDeduction.objects.select_for_update()
        .filter(sale_line_id=sale_line.pk)
        .select_related("batch")
        .order_by("-id"),
    )
    for row in rows:
        if need <= 0:
            break
        take = min(int(row.quantity), need)
        ProductBatch.objects.select_for_update().filter(pk=row.batch_id).update(
            remaining_quantity=F("remaining_quantity") + take,
        )
        if take == int(row.quantity):
            row.delete()
        else:
            row.quantity = int(row.quantity) - take
            row.save(update_fields=["quantity"])
        restored += take
        need -= take
    return restored


@transaction.atomic
def restore_storefront_item_batches(order_item: StorefrontOrderItem) -> int:
    restored = 0
    rows = list(
        StorefrontOrderItemBatchDeduction.objects.select_for_update()
        .filter(order_item_id=order_item.pk)
        .order_by("id"),
    )
    for row in rows:
        ProductBatch.objects.select_for_update().filter(pk=row.batch_id).update(
            remaining_quantity=F("remaining_quantity") + row.quantity,
        )
        restored += int(row.quantity)
    StorefrontOrderItemBatchDeduction.objects.filter(order_item_id=order_item.pk).delete()
    return restored


@transaction.atomic
def deduct_from_purchase_line_batch(purchase_line: PurchaseLine, quantity: int) -> int:
    """
    Supplier return: remove units from the batch(es) created by this purchase line.
    Falls back to general FIFO if the original batch is exhausted.
    """
    need = int(quantity)
    if need <= 0:
        return 0
    product = purchase_line.product
    Product.objects.select_for_update().filter(pk=product.pk).first()

    batches = list(
        ProductBatch.objects.select_for_update()
        .filter(purchase_line_id=purchase_line.pk, remaining_quantity__gt=0)
        .order_by("received_at", "id"),
    )
    taken = 0
    for batch in batches:
        if need <= 0:
            break
        take = min(int(batch.remaining_quantity), need)
        ProductBatch.objects.filter(pk=batch.pk).update(
            remaining_quantity=F("remaining_quantity") - take,
        )
        need -= take
        taken += take

    if need > 0:
        deduct_fifo_stock(product, need, allow_negative=True)
        taken += need
    return taken


@transaction.atomic
def delete_unconsumed_purchase_line_batches(old_lines: Sequence[PurchaseLine]) -> None:
    """Delete batches for purchase lines being replaced; error if any were consumed."""
    for ln in old_lines:
        batches = list(
            ProductBatch.objects.select_for_update().filter(purchase_line_id=ln.pk),
        )
        for batch in batches:
            original = int(batch.quantity)
            remain = int(batch.remaining_quantity)
            if remain != original:
                raise ValidationError(
                    "Cannot edit this purchase because stock from its batches "
                    f"was already sold or returned (product id={ln.product_id}, "
                    f"batch remaining {remain}/{original}). "
                    "Record a purchase return or adjust stock separately.",
                )
            batch.delete()
