"""Aggregations for dashboard and cashier (USD)."""

from __future__ import annotations

import os
from datetime import datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Case, DecimalField, F, Sum, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import (
    Company,
    Customer,
    CustomerDebtDiscountWriteoff,
    CustomerDebtDiscountWriteoffSale,
    CustomerDebtPayment,
    CustomerDebtPaymentSale,
    EmployeeDebt,
    EmployeeDebtType,
    Expense,
    Purchase,
    Sale,
    SaleLine,
    SaleReturn,
    SaleReturnLine,
    SaleReturnRefundMethod,
    ShopDayOpeningCash,
)
from .reports import profit_report_for_shop
from .serializers import latest_usd_to_iqd_for_shop

USD_2DP = Decimal("0.01")


def money_usd_2dp(value: Decimal) -> Decimal:
    """Round USD for dashboard / UI (2 decimals, half-up)."""
    return value.quantize(USD_2DP, rounding=ROUND_HALF_UP)


def _bounds(d_from, d_to):
    """
    Inclusive datetime range for calendar days d_from…d_to in the business timezone.

    Uses Asia/Baghdad by default so date pickers match local shop days (not UTC midnight),
    which previously hid sales/purchases near day boundaries.
    """
    tz_name = os.environ.get("DJANGO_BUSINESS_TZ", "Asia/Baghdad")
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(d_from, time.min), tz)
    end = timezone.make_aware(datetime.combine(d_to, time.max), tz)
    return start, end


def _business_day(dt):
    """Calendar day of a timestamp in the business timezone (matches _bounds)."""
    tz_name = os.environ.get("DJANGO_BUSINESS_TZ", "Asia/Baghdad")
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone.get_current_timezone()
    return timezone.localtime(dt, tz).date()


def _sales_in_calendar_range(shop_id: int, d_from, d_to):
    """Sales in calendar date range (same filter as GET /api/sales/?date_from=&date_to=)."""
    return _datetime_in_calendar_range(
        Sale.objects.filter(shop_id=shop_id),
        "occurred_at",
        d_from,
        d_to,
    )


def _datetime_in_calendar_range(qs, field: str, d_from, d_to):
    """Filter a datetime field by business-timezone calendar days (same as _bounds)."""
    if d_from is not None:
        qs = qs.filter(**{f"{field}__gte": _bounds(d_from, d_from)[0]})
    if d_to is not None:
        qs = qs.filter(**{f"{field}__lte": _bounds(d_to, d_to)[1]})
    return qs


def net_profit_in_range(shop_id: int, d_from, d_to) -> Decimal:
    from .reports import profit_report_for_shop

    data = profit_report_for_shop(shop_id, d_from, d_to)
    return Decimal(data["totals"]["net_profit_usd"])


def total_inventory_loss_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    from .reports import total_inventory_loss_usd_for_expenses
    from .models import Expense

    expense_qs = Expense.objects.filter(
        shop_id=shop_id,
        occurred_on__gte=d_from,
        occurred_on__lte=d_to,
    )
    return total_inventory_loss_usd_for_expenses(expense_qs)


def total_expenses_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    from .models import ExpenseCurrency

    dec = DecimalField(max_digits=18, decimal_places=4)
    total = (
        Expense.objects.filter(
            shop_id=shop_id,
            occurred_on__gte=d_from,
            occurred_on__lte=d_to,
        )
        .aggregate(
            total=Sum(
                Case(
                    When(currency=ExpenseCurrency.USD, then=F("amount")),
                    When(
                        currency=ExpenseCurrency.IQD,
                        exchange_rate_usd_to_iqd__gt=0,
                        then=F("amount") / F("exchange_rate_usd_to_iqd"),
                    ),
                    default=Value(0),
                    output_field=dec,
                ),
                output_field=dec,
            ),
        )["total"]
    )
    return (total or Decimal("0")).quantize(Decimal("0.0001"))


def _sale_lines_subtotal_usd(sale: Sale) -> Decimal:
    """Line subtotal before invoice-level discount (after sale returns on lines)."""
    line_sum = Decimal("0")
    for ln in sale.lines.all():
        returned_qty = sum(int(row.quantity) for row in ln.return_lines.all())
        net_qty = max(0, int(ln.quantity) - returned_qty)
        line_sum += Decimal(net_qty) * Decimal(ln.unit_price_usd)
    return line_sum.quantize(Decimal("0.0001"))


def _sale_gross_subtotal_usd(sale: Sale) -> Decimal:
    """Line subtotal before invoice discount and before any returns."""
    total = sum(
        (Decimal(ln.quantity) * Decimal(ln.unit_price_usd) for ln in sale.lines.all()),
        Decimal("0"),
    )
    return total.quantize(Decimal("0.0001"))


def _prefetched(obj, name: str):
    """Rows of a prefetch_related() relation, or None when it was not prefetched."""
    cache = getattr(obj, "_prefetched_objects_cache", None) or {}
    return cache.get(name)


def _sale_writeoff_usd(sale: Sale) -> Decimal:
    """Debt forgiven on this sale (stored inside invoice_discount_usd)."""
    rows = _prefetched(sale, "debt_discount_writeoff_lines")
    if rows is not None:
        return sum((Decimal(r.amount_usd) for r in rows), Decimal("0"))
    total = CustomerDebtDiscountWriteoffSale.objects.filter(sale_id=sale.pk).aggregate(
        s=Sum("amount_usd"),
    )["s"]
    return Decimal(str(total or 0))


def sale_effective_discount_usd(sale: Sale) -> Decimal:
    """
    Invoice discount still applying after returns: returned lines take their share
    of the checkout discount with them. Forgiven debt is not a line discount and is
    never scaled, so a write-off always clears what it was meant to clear.
    """
    disc = Decimal(sale.invoice_discount_usd)
    gross = _sale_gross_subtotal_usd(sale)
    net = _sale_lines_subtotal_usd(sale)
    if disc <= 0 or gross <= 0 or net >= gross:
        return disc
    written_off = _sale_writeoff_usd(sale)
    checkout_disc = max(Decimal("0"), disc - written_off)
    return (checkout_disc * net / gross + written_off).quantize(Decimal("0.0001"))


def sale_discount_ratio(sale: Sale) -> Decimal:
    """Fraction of each line price the customer actually pays (1 - checkout discount / gross)."""
    gross = _sale_gross_subtotal_usd(sale)
    if gross <= 0:
        return Decimal("1")
    checkout_disc = max(Decimal("0"), Decimal(sale.invoice_discount_usd) - _sale_writeoff_usd(sale))
    ratio = Decimal("1") - checkout_disc / gross
    return min(max(ratio, Decimal("0")), Decimal("1"))


def _sale_final_usd(sale: Sale) -> Decimal:
    final = _sale_lines_subtotal_usd(sale) - sale_effective_discount_usd(sale)
    if final < 0:
        final = Decimal("0")
    return final.quantize(Decimal("0.0001"))


def _sale_debt_payments_allocated_usd(sale: Sale) -> Decimal:
    """USD equivalent applied toward this sale via customer-debts repayments."""
    rows = _prefetched(sale, "debt_payment_lines")
    if rows is not None:
        return sum((Decimal(r.amount_usd) for r in rows), Decimal("0")).quantize(Decimal("0.0001"))
    dec = DecimalField(max_digits=24, decimal_places=4)
    total = (
        CustomerDebtPaymentSale.objects.filter(sale_id=sale.pk).aggregate(
            s=Sum("amount_usd", output_field=dec),
        )["s"]
        or Decimal("0")
    )
    return Decimal(str(total)).quantize(Decimal("0.0001"))


def sale_unpaid_balance_usd(sale: Sale) -> Decimal:
    """Positive unpaid amount for one sale (0 if none)."""
    final_usd = _sale_final_usd(sale)
    paid = Decimal(sale.amount_paid_usd)
    rate = Decimal(sale.exchange_rate_usd_to_iqd)
    if rate > 0:
        paid += Decimal(sale.amount_paid_iqd) / rate
    paid += _sale_debt_payments_allocated_usd(sale)
    bal = final_usd - paid
    # POS sends whole IQD, so an exactly-paid IQD sale can leave a fraction of a cent.
    if bal < CUSTOMER_DEBT_LIST_MIN_USD:
        return Decimal("0")
    return bal.quantize(Decimal("0.0001"))


# Below this USD amount, debt is treated as zero for customer-debt listings (matches 2-decimal UI).
CUSTOMER_DEBT_LIST_MIN_USD = Decimal("0.005")
# Maximum outstanding balance that may be forgiven as discount from the debts page.
CUSTOMER_DEBT_WRITEOFF_MAX_USD = Decimal("10")


def customer_outstanding_balance_usd(shop_id: int, customer_id: int) -> Decimal:
    """Unpaid balance for one customer: sum of positive (final − paid) per sale, all time."""
    total = Decimal("0")
    qs = Sale.objects.filter(shop_id=shop_id, customer_id=customer_id).prefetch_related(
        "lines__return_lines", "debt_payment_lines", "debt_discount_writeoff_lines",
    )
    for sale in qs:
        total += sale_unpaid_balance_usd(sale)
    return total.quantize(Decimal("0.0001"))


def customer_debt_payment_usd_eq(payment: CustomerDebtPayment) -> Decimal:
    paid = Decimal(payment.amount_paid_usd)
    rate = Decimal(payment.exchange_rate_usd_to_iqd)
    if rate > 0:
        paid += Decimal(payment.amount_paid_iqd) / rate
    return paid.quantize(Decimal("0.0001"))


def customer_debt_payment_usd_eq_display(payment: CustomerDebtPayment) -> Decimal:
    """USD equivalent for UI / dashboard totals (2 dp so row sums match the card)."""
    return money_usd_2dp(customer_debt_payment_usd_eq(payment))


def _allocate_customer_debt_payment_fifo(
    shop_id: int,
    customer_id: int,
    payment_usd_eq: Decimal,
) -> tuple[Decimal, list[tuple[int, Decimal]]]:
    """
    Plan FIFO allocation of a debt payment across unpaid sales.

    Returns (applied_usd_eq, list of (sale_id, chunk_usd)).
    """
    payment_usd_eq = payment_usd_eq.quantize(Decimal("0.0001"))
    if payment_usd_eq <= 0:
        return Decimal("0"), []

    outstanding = customer_outstanding_balance_usd(shop_id, customer_id)
    to_apply = min(payment_usd_eq, outstanding)
    if to_apply <= 0:
        return Decimal("0"), []

    remaining = to_apply
    applied = Decimal("0")
    allocations: list[tuple[int, Decimal]] = []
    ordered_unpaid: list[tuple[int, Decimal]] = []
    qs = (
        Sale.objects.filter(shop_id=shop_id, customer_id=customer_id)
        .order_by("occurred_at", "id")
        .prefetch_related("lines__return_lines", "debt_payment_lines", "debt_discount_writeoff_lines")
    )
    for sale in qs:
        unpaid = sale_unpaid_balance_usd(sale)
        if unpaid > Decimal("0.00005"):
            ordered_unpaid.append((sale.pk, unpaid))
    for sale_id, unpaid in ordered_unpaid:
        if remaining <= Decimal("0.00005"):
            break
        chunk = min(remaining, unpaid)
        allocations.append((sale_id, chunk))
        applied += chunk
        remaining -= chunk

    return applied.quantize(Decimal("0.0001")), allocations


def rebalance_customer_debt_allocations(shop_id: int, customer_id: int | None) -> None:
    """
    After a sale is edited, debt repayments allocated to it may exceed what it now owes.
    Move that excess onto the customer's other unpaid sales (oldest first) so a payment
    is never stranded on a sale that no longer needs it.
    """
    if not customer_id:
        return
    with transaction.atomic():
        sales = list(
            Sale.objects.select_for_update()
            .filter(shop_id=shop_id, customer_id=customer_id)
            .order_by("occurred_at", "id")
            .prefetch_related("lines__return_lines"),
        )
        freed: list[tuple[int, Decimal]] = []
        for sale in sales:
            owed = _sale_final_usd(sale) - _sale_paid_usd_equiv(sale)
            owed = max(Decimal("0"), owed)
            rows = list(
                CustomerDebtPaymentSale.objects.filter(sale_id=sale.pk).order_by("-payment_id"),
            )
            excess = sum((Decimal(r.amount_usd) for r in rows), Decimal("0")) - owed
            for row in rows:
                if excess <= Decimal("0.00005"):
                    break
                cut = min(Decimal(row.amount_usd), excess)
                freed.append((row.payment_id, cut))
                excess -= cut
                if cut >= Decimal(row.amount_usd):
                    row.delete()
                else:
                    row.amount_usd = Decimal(row.amount_usd) - cut
                    row.save(update_fields=["amount_usd"])
        if not freed:
            return
        for sale in sales:
            if not freed:
                break
            unpaid = sale_unpaid_balance_usd(sale)
            while unpaid > Decimal("0.00005") and freed:
                payment_id, amount = freed[0]
                chunk = min(unpaid, amount)
                row, _ = CustomerDebtPaymentSale.objects.get_or_create(
                    payment_id=payment_id,
                    sale_id=sale.pk,
                    defaults={"amount_usd": Decimal("0")},
                )
                row.amount_usd = Decimal(row.amount_usd) + chunk
                row.save(update_fields=["amount_usd"])
                unpaid -= chunk
                if chunk >= amount:
                    freed.pop(0)
                else:
                    freed[0] = (payment_id, amount - chunk)


def apply_customer_debt_payment_fifo(
    shop_id: int,
    customer_id: int,
    amount_paid_usd: Decimal,
    amount_paid_iqd: Decimal,
    exchange_rate: Decimal,
) -> tuple[Decimal, Decimal, int | None]:
    """
    Record a customer debt repayment on today's date and apply FIFO to unpaid sales.

    Does not modify the original sale checkout payments — keeps credit history intact.

    Returns (applied_usd_eq, overpaid_usd_eq, payment_id).
    """
    amount_paid_usd = amount_paid_usd.quantize(Decimal("0.0001"))
    amount_paid_iqd = amount_paid_iqd.quantize(Decimal("0.0001"))
    exchange_rate = exchange_rate.quantize(Decimal("0.0001"))
    payment_usd_eq = customer_debt_payment_usd_eq(
        CustomerDebtPayment(
            amount_paid_usd=amount_paid_usd,
            amount_paid_iqd=amount_paid_iqd,
            exchange_rate_usd_to_iqd=exchange_rate,
        ),
    )
    if payment_usd_eq <= 0:
        return Decimal("0"), Decimal("0"), None

    # One transaction with the customer row locked: two payments for the same customer
    # (double click, two cashiers) are applied one after the other, never against the same debt.
    with transaction.atomic():
        Customer.objects.select_for_update().filter(pk=customer_id, shop_id=shop_id).first()
        applied, allocations = _allocate_customer_debt_payment_fifo(
            shop_id,
            customer_id,
            payment_usd_eq,
        )
        if applied <= 0:
            return Decimal("0"), payment_usd_eq, None

        # Only the part that settled debt stays in the drawer; the excess is handed back
        # as change. Take it off the USD part first, then IQD.
        excess = (payment_usd_eq - applied).quantize(Decimal("0.0001"))
        if excess > 0:
            usd_cut = min(excess, amount_paid_usd)
            amount_paid_usd -= usd_cut
            excess -= usd_cut
            if excess > 0 and exchange_rate > 0:
                amount_paid_iqd = max(
                    Decimal("0"),
                    (amount_paid_iqd - excess * exchange_rate).quantize(Decimal("0.0001")),
                )

        payment = CustomerDebtPayment.objects.create(
            shop_id=shop_id,
            customer_id=customer_id,
            amount_paid_usd=amount_paid_usd,
            amount_paid_iqd=amount_paid_iqd,
            exchange_rate_usd_to_iqd=exchange_rate,
            occurred_at=timezone.now(),
        )
        for sale_id, chunk in allocations:
            CustomerDebtPaymentSale.objects.create(
                payment=payment,
                sale_id=sale_id,
                amount_usd=chunk,
            )

    overpaid = payment_usd_eq - applied
    return applied, overpaid.quantize(Decimal("0.0001")), payment.id


def update_customer_debt_payment(
    shop_id: int,
    payment_id: int,
    *,
    occurred_at: datetime | None = None,
    amount_paid_usd: Decimal | None = None,
    amount_paid_iqd: Decimal | None = None,
) -> CustomerDebtPayment:
    """Update a debt payment and re-allocate FIFO from scratch."""
    with transaction.atomic():
        payment = (
            CustomerDebtPayment.objects.select_for_update()
            .filter(pk=payment_id, shop_id=shop_id)
            .first()
        )
        if payment is None:
            raise ValueError("payment_not_found")

        CustomerDebtPaymentSale.objects.filter(payment=payment).delete()

        if occurred_at is not None:
            payment.occurred_at = occurred_at
        if amount_paid_usd is not None:
            payment.amount_paid_usd = amount_paid_usd.quantize(Decimal("0.0001"))
        if amount_paid_iqd is not None:
            payment.amount_paid_iqd = amount_paid_iqd.quantize(Decimal("0.0001"))
        payment.save()

        paid_eq = customer_debt_payment_usd_eq(payment)
        _, allocations = _allocate_customer_debt_payment_fifo(
            shop_id,
            int(payment.customer_id),
            paid_eq,
        )
        for sale_id, chunk in allocations:
            CustomerDebtPaymentSale.objects.create(
                payment=payment,
                sale_id=sale_id,
                amount_usd=chunk,
            )
    return payment


def apply_customer_debt_remainder_as_discount(
    shop_id: int,
    customer_id: int,
) -> tuple[Decimal, int]:
    """
    Forgive all outstanding customer debt as invoice discount (FIFO on sales).

    Records CustomerDebtDiscountWriteoff so dashboard «total discounts» counts it on
    the writeoff date without double-counting checkout discounts on in-range sales.
    """
    outstanding = customer_outstanding_balance_usd(shop_id, customer_id)
    if outstanding <= Decimal("0.00005"):
        raise ValueError("no_outstanding")
    if outstanding > CUSTOMER_DEBT_WRITEOFF_MAX_USD:
        raise ValueError("too_large")

    now = timezone.now()
    sale_chunks: list[tuple[int, Decimal]] = []

    qs = (
        Sale.objects.filter(shop_id=shop_id, customer_id=customer_id)
        .order_by("occurred_at", "id")
        .prefetch_related("lines__return_lines")
    )
    for sale in qs:
        unpaid = sale_unpaid_balance_usd(sale)
        if unpaid <= Decimal("0.00005"):
            continue
        line_sub = _sale_lines_subtotal_usd(sale)
        new_disc = Decimal(sale.invoice_discount_usd) + unpaid
        if new_disc > line_sub:
            raise ValueError("discount_exceeds_subtotal")
        sale_chunks.append((sale.pk, unpaid))

    if not sale_chunks:
        raise ValueError("no_outstanding")

    with transaction.atomic():
        writeoff = CustomerDebtDiscountWriteoff.objects.create(
            shop_id=shop_id,
            customer_id=customer_id,
            amount_usd=outstanding,
            occurred_at=now,
        )
        total = Decimal("0")
        for sale_id, unpaid in sale_chunks:
            Sale.objects.filter(pk=sale_id).update(
                invoice_discount_usd=F("invoice_discount_usd") + unpaid,
            )
            CustomerDebtDiscountWriteoffSale.objects.create(
                writeoff=writeoff,
                sale_id=sale_id,
                amount_usd=unpaid,
            )
            total += unpaid

    return total.quantize(Decimal("0.0001")), writeoff.id


def _debt_writeoff_discount_overlap_usd(
    shop_id: int,
    start: datetime,
    end: datetime,
    dec: DecimalField,
) -> Decimal:
    overlap = (
        CustomerDebtDiscountWriteoffSale.objects.filter(
            writeoff__shop_id=shop_id,
            writeoff__occurred_at__gte=start,
            writeoff__occurred_at__lte=end,
            sale__occurred_at__gte=start,
            sale__occurred_at__lte=end,
        ).aggregate(s=Sum("amount_usd", output_field=dec))["s"]
        or Decimal("0")
    )
    return Decimal(str(overlap))


def total_receivables_usd(shop_id: int) -> Decimal:
    """Outstanding customer balances (all sales, all time)."""
    total = Decimal("0")
    qs = Sale.objects.filter(shop_id=shop_id).prefetch_related(
        "lines__return_lines",
        "debt_payment_lines",
        "debt_discount_writeoff_lines",
    )
    for sale in qs:
        total += sale_unpaid_balance_usd(sale)
    return total


def total_receivables_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """Outstanding balances only for sales created in the selected date range."""
    total = Decimal("0")
    qs = _sales_in_calendar_range(shop_id, d_from, d_to).prefetch_related(
        "lines__return_lines", "debt_payment_lines", "debt_discount_writeoff_lines",
    )
    for sale in qs:
        total += sale_unpaid_balance_usd(sale)
    return total.quantize(Decimal("0.0001"))


def total_payables_usd(shop_id: int) -> Decimal:
    """Outstanding supplier balances (all purchases, all time)."""
    # Inventory-screen stock increases have no supplier; nobody can be paid for them.
    # Net per supplier, so credit on one supplier's invoice offsets that supplier's
    # other invoices (never another supplier's).
    by_company: dict[int, Decimal] = {}
    for pur in Purchase.objects.filter(shop_id=shop_id, company__isnull=False).prefetch_related(
        "lines__return_lines",
    ):
        by_company[pur.company_id] = by_company.get(pur.company_id, Decimal("0")) + purchase_balance_usd(pur)
    return sum((max(Decimal("0"), b) for b in by_company.values()), Decimal("0")).quantize(Decimal("0.0001"))


def purchase_balance_usd(pur: Purchase) -> Decimal:
    """
    Signed balance for one purchase: positive = still owed, negative = supplier credit
    (e.g. goods returned after the invoice was already paid in full).
    """
    line_sum = Decimal("0")
    for ln in pur.lines.all():
        returned = sum(int(r.quantity) for r in ln.return_lines.all())
        net_qty = max(0, int(ln.quantity) - returned)
        line_sum += Decimal(net_qty) * Decimal(ln.unit_cost_usd)
    net_due = line_sum - Decimal(pur.discount_received_usd)
    paid = Decimal(pur.amount_paid_usd)
    return (net_due - paid).quantize(Decimal("0.0001"))


def purchase_unpaid_balance_usd(pur: Purchase) -> Decimal:
    """Positive unpaid amount for one purchase (0 if fully paid or overpaid)."""
    bal = purchase_balance_usd(pur)
    if bal <= 0:
        return Decimal("0")
    return bal


def company_outstanding_usd(shop_id: int, company_id: int) -> Decimal:
    """
    Outstanding balance owed to one supplier: all its invoices netted together, so a
    credit on one invoice (goods returned after paying) reduces what is owed overall.
    """
    total = Decimal("0")
    # Do not use .iterator() after .prefetch_related() — Django raises ValueError.
    for pur in Purchase.objects.filter(shop_id=shop_id, company_id=company_id).prefetch_related(
        "lines__return_lines",
    ):
        total += purchase_balance_usd(pur)
    return max(Decimal("0"), total).quantize(Decimal("0.0001"))


def apply_supplier_debt_payment_fifo(
    shop_id: int,
    company_id: int,
    payment_usd_eq: Decimal,
    *,
    amount_paid_usd: Decimal = Decimal("0"),
    amount_paid_iqd: Decimal = Decimal("0"),
    exchange_rate: Decimal = Decimal("0"),
) -> tuple[Decimal, Decimal]:
    """
    Apply USD-equivalent payment to oldest unpaid purchases first (increments amount_paid_usd)
    and record a dated SupplierPayment so the cash box counts it on the day it was paid.

    Returns (applied_usd_eq, overpaid_usd_eq).
    """
    from .models import SupplierPayment, SupplierPaymentPurchase

    payment_usd_eq = payment_usd_eq.quantize(Decimal("0.0001"))
    if payment_usd_eq <= 0:
        return Decimal("0"), Decimal("0")

    applied = Decimal("0")
    allocations: list[tuple[int, Decimal]] = []

    # One transaction with the supplier and its purchases locked, so two payments at the
    # same time cannot both pay the same invoice.
    with transaction.atomic():
        Company.objects.select_for_update().filter(pk=company_id).first()
        list(
            Purchase.objects.select_for_update()
            .filter(shop_id=shop_id, company_id=company_id)
            .values_list("pk", flat=True)
        )
        outstanding = company_outstanding_usd(shop_id, company_id)
        to_apply = min(payment_usd_eq, outstanding)
        if to_apply <= 0:
            return Decimal("0"), payment_usd_eq
        remaining = to_apply
        while remaining > Decimal("0.00005"):
            pur = None
            qs = (
                Purchase.objects.filter(shop_id=shop_id, company_id=company_id)
                .order_by("occurred_at", "id")
                .prefetch_related("lines__return_lines")
            )
            for p in qs:
                if purchase_unpaid_balance_usd(p) > Decimal("0.00005"):
                    pur = p
                    break
            if pur is None:
                break
            unpaid = purchase_unpaid_balance_usd(pur)
            chunk = min(remaining, unpaid)
            Purchase.objects.filter(pk=pur.pk).update(amount_paid_usd=F("amount_paid_usd") + chunk)
            allocations.append((pur.pk, chunk))
            applied += chunk
            remaining -= chunk
        if applied > 0:
            # Only the part that settled debt left the drawer; trim the overpaid excess
            # (USD first, then IQD), same as customer debt payments.
            excess = (payment_usd_eq - applied).quantize(Decimal("0.0001"))
            if excess > 0:
                usd_cut = min(excess, amount_paid_usd)
                amount_paid_usd -= usd_cut
                excess -= usd_cut
                if excess > 0 and exchange_rate > 0:
                    amount_paid_iqd = max(
                        Decimal("0"),
                        (amount_paid_iqd - excess * exchange_rate).quantize(Decimal("0.0001")),
                    )
            payment = SupplierPayment.objects.create(
                shop_id=shop_id,
                company_id=company_id,
                amount_paid_usd=amount_paid_usd,
                amount_paid_iqd=amount_paid_iqd,
                exchange_rate_usd_to_iqd=exchange_rate,
                amount_usd=applied.quantize(Decimal("0.0001")),
                occurred_at=timezone.now(),
            )
            SupplierPaymentPurchase.objects.bulk_create(
                [
                    SupplierPaymentPurchase(payment=payment, purchase_id=pid, amount_usd=amt)
                    for pid, amt in allocations
                ],
            )

    overpaid = payment_usd_eq - applied
    return applied.quantize(Decimal("0.0001")), overpaid.quantize(Decimal("0.0001"))


def suppliers_purchase_archive(shop_id: int) -> list[dict]:
    """Companies that have at least one purchase, with totals for the archive UI."""
    company_ids = (
        Purchase.objects.filter(shop_id=shop_id, company_id__isnull=False)
        .order_by()
        .values_list("company_id", flat=True)
        .distinct()
    )
    out: list[dict] = []
    for cid in company_ids:
        try:
            c = Company.objects.get(pk=cid)
        except Company.DoesNotExist:
            continue
        purchases = Purchase.objects.filter(shop_id=shop_id, company_id=cid)
        cnt = purchases.count()
        gross = Decimal("0")
        for pur in purchases.prefetch_related("lines__return_lines"):
            for ln in pur.lines.all():
                gross += Decimal(ln.quantity) * Decimal(ln.unit_cost_usd)
        outstand = company_outstanding_usd(shop_id, int(cid))
        out.append(
            {
                "company_id": cid,
                "company_name": c.name,
                "purchase_count": cnt,
                "total_goods_value_usd": format(gross.quantize(Decimal("0.0001")), "f"),
                "outstanding_usd": format(outstand.quantize(Decimal("0.0001")), "f"),
            },
        )
    return sorted(out, key=lambda x: x["company_name"])


def total_stock_value_usd(shop_id: int) -> Decimal:
    """On-hand value at FIFO cost (remaining units of each purchase layer)."""
    from .models import ProductBatch

    dec = DecimalField(max_digits=24, decimal_places=4)
    v = (
        ProductBatch.objects.filter(
            product__shop_id=shop_id,
            product__is_discontinued=False,
            remaining_quantity__gt=0,
        ).aggregate(
            s=Sum(
                F("remaining_quantity") * F("cost_price"),
                output_field=dec,
            ),
        )["s"]
        or Decimal("0")
    )
    return Decimal(str(v)).quantize(Decimal("0.0001"))


def _sale_paid_usd_equiv(sale: Sale) -> Decimal:
    """USD equivalent of amount paid on a sale (IQD ignored when rate missing)."""
    paid = Decimal(sale.amount_paid_usd)
    rate = Decimal(sale.exchange_rate_usd_to_iqd)
    if rate > 0:
        paid += Decimal(sale.amount_paid_iqd) / rate
    return paid.quantize(Decimal("0.0001"))


def customer_debt_payments_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """Cash collected from customer debt repayments in the date range (USD equivalent)."""
    qs = _datetime_in_calendar_range(
        CustomerDebtPayment.objects.filter(shop_id=shop_id),
        "occurred_at",
        d_from,
        d_to,
    )
    total = Decimal("0")
    for payment in qs:
        total += customer_debt_payment_usd_eq_display(payment)
    return money_usd_2dp(total)


def sales_cash_in_usd_range(shop_id: int, d_from, d_to) -> Decimal:
    """
    Net cash effect from sales in the date range: checkout payments on sales
    plus debt repayments collected in the range, minus sale-return refunds.

    Returns reduce drawer cash and must lower period drawer movement vs expenses.
    """
    start, end = _bounds(d_from, d_to)
    total = Decimal("0")
    for sale in Sale.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    ):
        total += _sale_paid_usd_equiv(sale)
    total += customer_debt_payments_usd_in_range(shop_id, d_from, d_to)
    refunds = total_returned_products_usd_in_range(shop_id, d_from, d_to)
    return (total - refunds).quantize(Decimal("0.0001"))


def sales_gross_usd_range(shop_id: int, d_from, d_to) -> Decimal:
    """Line subtotals before invoice discount (USD) in date range."""
    start, end = _bounds(d_from, d_to)
    total = Decimal("0")
    qs = Sale.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    ).prefetch_related("lines__return_lines")
    for sale in qs:
        total += _sale_lines_subtotal_usd(sale)
    return total.quantize(Decimal("0.0001"))


def sales_invoiced_usd_range(shop_id: int, d_from, d_to) -> Decimal:
    """Net invoiced sales (line totals minus invoice discount) in date range, USD."""
    start, end = _bounds(d_from, d_to)
    total = Decimal("0")
    qs = Sale.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    ).prefetch_related("lines__return_lines")
    for sale in qs:
        total += _sale_final_usd(sale)
    return total.quantize(Decimal("0.0001"))


def total_sales_gross_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """Gross merchandise sold before invoice discounts."""
    return sales_gross_usd_range(shop_id, d_from, d_to)


def sales_checkout_received_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """
    Sum of USD received at checkout for sales in the date range.

    Matches sales history «کۆی بڕی وەرگیراو (دۆلار)» and GET /api/sales/ date filters.
    """
    total = Decimal("0")
    for sale in _sales_in_calendar_range(shop_id, d_from, d_to):
        total += _sale_paid_usd_equiv(sale)
    return money_usd_2dp(total)


def total_sales_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """Dashboard «total sold» — checkout USD received (sales history card)."""
    return sales_checkout_received_usd_in_range(shop_id, d_from, d_to)


def period_dashboard_petty_cash_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """
    Dashboard «petty cash» (قاسەی بچووک):

    total sold − expenses + debt collected − returned products.
    Discounts are informational only — not subtracted from petty cash.
    Debt repayments count on the payment date, not the original sale date.
    """
    petty = (
        money_usd_2dp(total_sales_usd_in_range(shop_id, d_from, d_to))
        # Stock write-offs are not cash leaving the drawer.
        - money_usd_2dp(
            total_expenses_usd_in_range(shop_id, d_from, d_to)
            - total_inventory_loss_usd_in_range(shop_id, d_from, d_to),
        )
        + customer_debt_payments_usd_in_range(shop_id, d_from, d_to)
        - money_usd_2dp(total_returned_products_usd_in_range(shop_id, d_from, d_to))
    )
    return money_usd_2dp(petty)


def customer_discounts_usd_between(shop_id: int, start: datetime, end: datetime) -> Decimal:
    """
    Checkout invoice discounts of sales in [start, end] (minus returned lines' share)
    plus debt write-offs dated in [start, end]. A write-off is stored inside the old
    sale's invoice_discount_usd, so it is removed there and counted only on its own date.
    """
    dec = DecimalField(max_digits=24, decimal_places=4)
    total = Decimal("0")
    sales = (
        Sale.objects.filter(shop_id=shop_id, occurred_at__gte=start, occurred_at__lte=end)
        .filter(invoice_discount_usd__gt=0)
        .prefetch_related("lines__return_lines", "debt_discount_writeoff_lines")
    )
    for sale in sales:
        written_off = sum(
            (Decimal(r.amount_usd) for r in sale.debt_discount_writeoff_lines.all()),
            Decimal("0"),
        )
        base = max(Decimal("0"), Decimal(sale.invoice_discount_usd) - written_off)
        gross = _sale_gross_subtotal_usd(sale)
        net = _sale_lines_subtotal_usd(sale)
        if gross > 0 and net < gross:
            base = base * net / gross
        total += base
    writeoffs = CustomerDebtDiscountWriteoff.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    ).aggregate(s=Sum("amount_usd", output_field=dec))["s"]
    total += Decimal(str(writeoffs or 0))
    return total.quantize(Decimal("0.0001"))


def total_customer_discounts_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """Total customer discounts in range: checkout invoice discounts + debt writeoffs."""
    start, end = _bounds(d_from, d_to)
    return money_usd_2dp(customer_discounts_usd_between(shop_id, start, end))


def total_debtor_customers_count(shop_id: int) -> int:
    """Number of customers that still have an outstanding balance (one pass over sales)."""
    owed: dict[int, Decimal] = {}
    qs = Sale.objects.filter(shop_id=shop_id, customer_id__isnull=False).prefetch_related(
        "lines__return_lines",
        "debt_payment_lines",
        "debt_discount_writeoff_lines",
    )
    for sale in qs:
        owed[sale.customer_id] = owed.get(sale.customer_id, Decimal("0")) + sale_unpaid_balance_usd(sale)
    return sum(1 for v in owed.values() if v > 0)


def total_returned_products_qty_in_range(shop_id: int, d_from, d_to) -> int:
    """Total quantity of cash-refunded sale returns during the selected range."""
    qs = _datetime_in_calendar_range(
        SaleReturnLine.objects.filter(
            sale_return__shop_id=shop_id,
            sale_return__refund_method=SaleReturnRefundMethod.CASH,
        ),
        "sale_return__occurred_at",
        d_from,
        d_to,
    )
    qty = qs.aggregate(s=Sum("quantity"))["s"] or 0
    return int(qty)


def sale_return_split_usd(sr: SaleReturn) -> tuple[Decimal, Decimal, Decimal]:
    """
    (total value, cash paid out, debt reduced) for one sale return.
    Returns recorded before cash_refund_usd existed follow their refund_method.
    """
    total = sum(
        (Decimal(ln.quantity) * Decimal(ln.unit_price_usd) for ln in sr.lines.all()),
        Decimal("0"),
    ).quantize(Decimal("0.0001"))
    if sr.cash_refund_usd is not None:
        cash = min(Decimal(sr.cash_refund_usd), total)
    elif sr.refund_method == SaleReturnRefundMethod.DEBT_REDUCTION:
        cash = Decimal("0")
    else:
        cash = total
    return total, cash, (total - cash).quantize(Decimal("0.0001"))


def _sale_returns_in_range(shop_id: int, d_from, d_to):
    return _datetime_in_calendar_range(
        SaleReturn.objects.filter(shop_id=shop_id).prefetch_related("lines"),
        "occurred_at",
        d_from,
        d_to,
    )


def total_returned_products_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """Cash handed back to customers for sale returns during the selected range."""
    cash = sum(
        (sale_return_split_usd(sr)[1] for sr in _sale_returns_in_range(shop_id, d_from, d_to)),
        Decimal("0"),
    )
    return money_usd_2dp(cash)


def customer_debt_reduced_by_returns_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """USD value of sale returns that reduced customer debt in the date range."""
    debt = sum(
        (sale_return_split_usd(sr)[2] for sr in _sale_returns_in_range(shop_id, d_from, d_to)),
        Decimal("0"),
    )
    return money_usd_2dp(debt)


def top_selling_products_in_range(
    shop_id: int,
    d_from,
    d_to,
    limit: int | None = None,
) -> list[dict]:
    """
    Sold products by total quantity in the selected range (newest / highest qty first).

    Rows are grouped by display name (catalog name or manual POS name). When limit is
    None, every distinct sold product in the range is returned.
    """
    start, end = _bounds(d_from, d_to)
    dec = DecimalField(max_digits=24, decimal_places=4)
    qs = (
        SaleLine.objects.filter(
            sale__shop_id=shop_id,
            sale__occurred_at__gte=start,
            sale__occurred_at__lte=end,
        )
        .annotate(display_name=Coalesce("product__name", "manual_name"))
        .values("display_name")
        .annotate(
            total_qty=Sum("quantity"),
            total_sales_usd=Sum(F("quantity") * F("unit_price_usd"), output_field=dec),
        )
        .order_by("-total_qty", "-total_sales_usd")
    )
    if limit is not None:
        qs = qs[: max(1, int(limit))]
    out: list[dict] = []
    for row in qs:
        name = (row.get("display_name") or "").strip()
        if not name:
            continue
        total_qty = int(row.get("total_qty") or 0)
        total_sales_usd = Decimal(str(row.get("total_sales_usd") or "0")).quantize(
            Decimal("0.0001"),
        )
        out.append(
            {
                "product_name": name,
                "total_qty": total_qty,
                "total_sales_usd": format(total_sales_usd, "f"),
            },
        )
    return out


def purchases_goods_value_usd_range(shop_id: int, d_from, d_to) -> Decimal:
    """Net goods value on purchases (lines − supplier discount) in date range, USD."""
    start, end = _bounds(d_from, d_to)
    total = Decimal("0")
    qs = Purchase.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    ).prefetch_related("lines")
    for pur in qs:
        line_sum = Decimal("0")
        for ln in pur.lines.all():
            line_sum += Decimal(ln.quantity) * Decimal(ln.unit_cost_usd)
        net = line_sum - Decimal(pur.discount_received_usd)
        if net < 0:
            net = Decimal("0")
        total += net
    return total.quantize(Decimal("0.0001"))


def purchase_upfront_paid_usd(pur: Purchase) -> Decimal:
    """Paid at purchase time: amount_paid_usd minus later supplier debt payments applied to it."""
    later = sum((Decimal(r.amount_usd) for r in pur.supplier_payment_lines.all()), Decimal("0"))
    return max(Decimal("0"), Decimal(pur.amount_paid_usd) - later).quantize(Decimal("0.0001"))


def supplier_payments_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """
    Cash paid to suppliers in the range: money paid when a purchase was made, plus
    supplier debt payments made on these days (each counted on its own date).
    """
    from .models import SupplierPayment

    start, end = _bounds(d_from, d_to)
    total = Decimal("0")
    for pur in Purchase.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    ).prefetch_related("supplier_payment_lines"):
        total += purchase_upfront_paid_usd(pur)
    later = SupplierPayment.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    ).aggregate(s=Sum("amount_usd"))["s"]
    total += Decimal(str(later or 0))
    return total.quantize(Decimal("0.0001"))


def cashier_ledger_entries(shop_id: int, d_from, d_to) -> list[dict]:
    """Chronological vault-related movements for the cashier archive (USD labels)."""
    from .reports import expense_is_inventory_loss

    start, end = _bounds(d_from, d_to)
    rows: list[dict] = []

    for oc in ShopDayOpeningCash.objects.filter(
        shop_id=shop_id,
        for_date__gte=d_from,
        for_date__lte=d_to,
    ).order_by("-for_date", "-id"):
        rows.append(
            {
                "kind": "opening_cash",
                "id": oc.id,
                "occurred_on": oc.for_date.isoformat(),
                "occurred_at": None,
                "amount_usd": format(Decimal(oc.opening_cash_usd).quantize(Decimal("0.0001")), "f"),
                "direction": "balance",
                "label": "",
            },
        )

    for exp in Expense.objects.filter(
        shop_id=shop_id,
        occurred_on__gte=d_from,
        occurred_on__lte=d_to,
    ).order_by("-occurred_on", "-id"):
        if expense_is_inventory_loss(exp):
            continue
        amt = exp.amount_usd()
        rows.append(
            {
                "kind": "expense",
                "id": exp.id,
                "occurred_on": exp.occurred_on.isoformat(),
                "occurred_at": None,
                "amount_usd": format(amt, "f"),
                "direction": "out",
                "label": exp.name,
            },
        )

    from .models import ShareholderPayment

    for sp in (
        ShareholderPayment.objects.filter(
            shop_id=shop_id,
            paid_on__gte=d_from,
            paid_on__lte=d_to,
        )
        .select_related("shareholder")
        .order_by("-paid_on", "-id")
    ):
        rows.append(
            {
                "kind": "shareholder_payment",
                "id": sp.id,
                "occurred_on": sp.paid_on.isoformat(),
                "occurred_at": None,
                "amount_usd": format(Decimal(sp.amount_usd), "f"),
                "direction": "out",
                "label": sp.shareholder.name if sp.shareholder_id else "",
            },
        )

    for ed in (
        EmployeeDebt.objects.filter(
            shop_id=shop_id,
            occurred_on__gte=d_from,
            occurred_on__lte=d_to,
        )
        .select_related("employee")
        .order_by("-occurred_on", "-id")
    ):
        sign = (
            Decimal("1")
            if ed.debt_type == EmployeeDebtType.TAKEN
            else Decimal("-1")
        )
        cash_effect = sign * Decimal(ed.amount)
        note = (ed.note or "").strip()
        label = ed.employee.email
        if note:
            label = f"{label} · {note}"
        rows.append(
            {
                "kind": "employee_debt",
                "id": ed.id,
                "occurred_on": ed.occurred_on.isoformat(),
                "occurred_at": None,
                "amount_usd": format(Decimal(ed.amount), "f"),
                "direction": "out" if cash_effect > 0 else "in",
                "label": label,
                "debt_type": ed.debt_type,
            },
        )

    sales_qs = (
        Sale.objects.filter(
            shop_id=shop_id,
            occurred_at__gte=start,
            occurred_at__lte=end,
        )
        .select_related("customer")
        .order_by("-occurred_at", "-id")
    )
    for sale in sales_qs:
        paid = _sale_paid_usd_equiv(sale)
        if paid <= 0:
            continue
        cust_label = sale.customer.name if sale.customer_id else ""
        rows.append(
            {
                "kind": "sale_payment",
                "id": sale.id,
                "occurred_on": _business_day(sale.occurred_at).isoformat(),
                "occurred_at": sale.occurred_at.isoformat(),
                "amount_usd": format(paid, "f"),
                "direction": "in",
                "label": cust_label or "Sale",
            },
        )

    for payment in (
        CustomerDebtPayment.objects.filter(
            shop_id=shop_id,
            occurred_at__gte=start,
            occurred_at__lte=end,
        )
        .select_related("customer")
        .order_by("-occurred_at", "-id")
    ):
        paid = customer_debt_payment_usd_eq(payment)
        if paid <= 0:
            continue
        rows.append(
            {
                "kind": "customer_debt_payment",
                "id": payment.id,
                "occurred_on": _business_day(payment.occurred_at).isoformat(),
                "occurred_at": payment.occurred_at.isoformat(),
                "amount_usd": format(paid, "f"),
                "direction": "in",
                "label": payment.customer.name if payment.customer_id else "Customer",
            },
        )

    sr_qs = (
        SaleReturn.objects.filter(
            shop_id=shop_id,
            occurred_at__gte=start,
            occurred_at__lte=end,
        )
        .select_related("customer")
        .prefetch_related("lines")
        .order_by("-occurred_at", "-id")
    )
    for sr in sr_qs:
        _total, cash, debt = sale_return_split_usd(sr)
        cust_label = sr.customer.name if sr.customer_id else ""
        sale_bit = f"#{sr.sale_id}"
        label = " · ".join([p for p in (cust_label, sale_bit) if p]) or "Sale return"
        # A return on a credit sale first reduces the debt; only the rest is cash out.
        for kind, amount, direction in (
            ("sale_return_debt_reduction", debt, "debt"),
            ("sale_return", cash, "out"),
        ):
            if amount <= 0:
                continue
            rows.append(
                {
                    "kind": kind,
                    "id": sr.id,
                    "occurred_on": _business_day(sr.occurred_at).isoformat(),
                    "occurred_at": sr.occurred_at.isoformat(),
                    "amount_usd": format(amount, "f"),
                    "direction": direction,
                    "label": label,
                },
            )

    pur_qs = (
        Purchase.objects.filter(
            shop_id=shop_id,
            occurred_at__gte=start,
            occurred_at__lte=end,
        )
        .select_related("company")
        .prefetch_related("supplier_payment_lines")
        .order_by("-occurred_at", "-id")
    )
    for pur in pur_qs:
        paid = purchase_upfront_paid_usd(pur)
        if paid <= 0:
            continue
        comp = pur.company.name if pur.company_id else ""
        rows.append(
            {
                "kind": "purchase_payment",
                "id": pur.id,
                "occurred_on": _business_day(pur.occurred_at).isoformat(),
                "occurred_at": pur.occurred_at.isoformat(),
                "amount_usd": format(paid, "f"),
                "direction": "out",
                "label": comp or "Purchase",
            },
        )

    from .models import SupplierPayment

    for sp in (
        SupplierPayment.objects.filter(
            shop_id=shop_id,
            occurred_at__gte=start,
            occurred_at__lte=end,
        )
        .select_related("company")
        .order_by("-occurred_at", "-id")
    ):
        rows.append(
            {
                "kind": "supplier_payment",
                "id": sp.id,
                "occurred_on": _business_day(sp.occurred_at).isoformat(),
                "occurred_at": sp.occurred_at.isoformat(),
                "amount_usd": format(Decimal(sp.amount_usd), "f"),
                "direction": "out",
                "label": sp.company.name,
            },
        )

    def sort_key(r: dict) -> str:
        at = r.get("occurred_at")
        if at:
            return at
        return f"{r['occurred_on']}T23:59:59"

    rows.sort(key=sort_key, reverse=True)
    return rows


def employee_debt_balance_usd(shop_id: int, employee_id: int | None = None) -> Decimal:
    qs = EmployeeDebt.objects.filter(shop_id=shop_id)
    if employee_id is not None:
        qs = qs.filter(employee_id=employee_id)
    bal = Decimal("0")
    for row in qs:
        sign = (
            Decimal("1")
            if row.debt_type == EmployeeDebtType.TAKEN
            else Decimal("-1")
        )
        bal += sign * Decimal(row.amount)
    return bal.quantize(Decimal("0.0001"))


def employee_debt_by_user(shop_id: int) -> list[dict]:
    """Remaining debt per employee (positive = employee owes shop)."""
    qs = EmployeeDebt.objects.filter(shop_id=shop_id).select_related("employee")
    balances: dict[int, Decimal] = {}
    emails: dict[int, str] = {}
    for row in qs:
        sign = (
            Decimal("1")
            if row.debt_type == EmployeeDebtType.TAKEN
            else Decimal("-1")
        )
        balances[row.employee_id] = balances.get(row.employee_id, Decimal("0")) + sign * Decimal(
            row.amount,
        )
        emails[row.employee_id] = row.employee.email
    out = []
    for uid, bal in sorted(balances.items(), key=lambda x: x[0]):
        out.append(
            {
                "employee_id": uid,
                "email": emails.get(uid, ""),
                "remaining_debt_usd": format(bal.quantize(Decimal("0.0001")), "f"),
            },
        )
    return out


def total_employee_debt_outstanding_usd(shop_id: int) -> Decimal:
    """Sum of per-employee remaining debt balances (USD)."""
    total = Decimal("0")
    for row in employee_debt_by_user(shop_id):
        total += Decimal(row["remaining_debt_usd"])
    return total.quantize(Decimal("0.0001"))


def resolve_opening_cash_for_period(shop_id: int, d_from, d_to) -> Decimal:
    """
    Opening cash baseline for cashier reconciliation over [d_from, d_to].

    An opening counted on d_from wins. Otherwise carry forward the latest opening
    before the range plus every cash movement between it and d_from (the drawer
    did not stay frozen since that count). With no earlier opening, fall back to
    the first opening recorded inside the range.
    """
    on_start = (
        ShopDayOpeningCash.objects.filter(shop_id=shop_id, for_date=d_from)
        .values_list("opening_cash_usd", flat=True)
        .first()
    )
    if on_start is not None:
        return Decimal(str(on_start)).quantize(Decimal("0.0001"))

    prior = (
        ShopDayOpeningCash.objects.filter(shop_id=shop_id, for_date__lt=d_from)
        .order_by("-for_date")
        .values_list("for_date", "opening_cash_usd")
        .first()
    )
    if prior is not None:
        prior_date, prior_amount = prior
        snap = cashier_snapshot(
            shop_id,
            prior_date,
            d_from - timedelta(days=1),
            opening_cash_usd=Decimal(str(prior_amount)),
            include_reports=False,
        )
        return Decimal(snap["current_cash_usd"]).quantize(Decimal("0.0001"))

    in_range = (
        ShopDayOpeningCash.objects.filter(
            shop_id=shop_id,
            for_date__gte=d_from,
            for_date__lte=d_to,
        )
        .order_by("for_date")
        .values_list("opening_cash_usd", flat=True)
        .first()
    )
    if in_range is not None:
        return Decimal(str(in_range)).quantize(Decimal("0.0001"))
    return Decimal("0")


def shareholder_payouts_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """Partner profit payouts handed out of the drawer in the date range."""
    from .models import ShareholderPayment

    total = ShareholderPayment.objects.filter(
        shop_id=shop_id,
        paid_on__gte=d_from,
        paid_on__lte=d_to,
    ).aggregate(s=Sum("amount_usd"))["s"]
    return Decimal(str(total or 0)).quantize(Decimal("0.0001"))


def cashier_snapshot(
    shop_id: int,
    d_from,
    d_to,
    opening_cash_usd: Decimal | None = None,
    *,
    include_reports: bool = True,
) -> dict:
    """
    Current cash (USD) ≈ opening + POS sales + customer debt collected − sale returns
    − expenses − supplier (purchase) payments − net employee debt taken.
    """
    if opening_cash_usd is None:
        opening_cash_usd = resolve_opening_cash_for_period(shop_id, d_from, d_to)
    else:
        opening_cash_usd = Decimal(str(opening_cash_usd))

    pos_sales = sales_checkout_received_usd_in_range(shop_id, d_from, d_to)
    cust_debt_rcpt = customer_debt_payments_usd_in_range(shop_id, d_from, d_to)
    sale_returns = total_returned_products_usd_in_range(shop_id, d_from, d_to)
    sales_in = sales_cash_in_usd_range(shop_id, d_from, d_to)
    # Stock write-offs are booked as expenses for profit, but no cash leaves the drawer.
    exp = total_expenses_usd_in_range(shop_id, d_from, d_to) - total_inventory_loss_usd_in_range(
        shop_id,
        d_from,
        d_to,
    )
    sup_pay = supplier_payments_usd_in_range(shop_id, d_from, d_to)
    partner_pay = shareholder_payouts_usd_in_range(shop_id, d_from, d_to)

    debt_qs = EmployeeDebt.objects.filter(
        shop_id=shop_id,
        occurred_on__gte=d_from,
        occurred_on__lte=d_to,
    )
    debt_effect = Decimal("0")
    for row in debt_qs:
        sign = (
            Decimal("1")
            if row.debt_type == EmployeeDebtType.TAKEN
            else Decimal("-1")
        )
        debt_effect += sign * Decimal(row.amount)

    current_cash = (
        opening_cash_usd
        + pos_sales
        + cust_debt_rcpt
        - sale_returns
        - exp
        - sup_pay
        - partner_pay
        - debt_effect
    )
    if not include_reports:
        return {"current_cash_usd": format(current_cash.quantize(Decimal("0.0001")), "f")}
    stock = total_stock_value_usd(shop_id)
    recv = total_receivables_usd(shop_id)
    pay = total_payables_usd(shop_id)
    capital = (current_cash + stock).quantize(Decimal("0.0001"))
    debt_exposure = (recv + pay).quantize(Decimal("0.0001"))
    pinv = purchases_goods_value_usd_range(shop_id, d_from, d_to)
    sinv = sales_invoiced_usd_range(shop_id, d_from, d_to)
    emp_out = total_employee_debt_outstanding_usd(shop_id)

    pr_totals = profit_report_for_shop(shop_id, d_from, d_to)["totals"]
    sum_sale_p = Decimal(pr_totals["sum_sale_line_prices_usd"])
    sum_buy_p = Decimal(pr_totals["sum_sale_line_buy_prices_usd"])
    cust_disc_p = Decimal(pr_totals["total_customer_discounts_usd"])
    comp_disc_p = Decimal(pr_totals["total_company_discounts_received_usd"])
    net_p = Decimal(pr_totals["net_profit_usd"])
    gross_trade = (sum_sale_p - sum_buy_p - cust_disc_p + comp_disc_p).quantize(Decimal("0.0001"))

    raw_rate = latest_usd_to_iqd_for_shop(shop_id)
    rate: Decimal | None = None
    if raw_rate is not None:
        r = Decimal(str(raw_rate))
        rate = r if r > 0 else None
    return {
        "opening_cash_usd": format(opening_cash_usd, "f"),
        "sales_cash_in_usd": format(sales_in, "f"),
        "pos_sale_payments_usd": format(pos_sales, "f"),
        "customer_debt_receipts_usd": format(cust_debt_rcpt, "f"),
        "sale_returns_usd": format(sale_returns, "f"),
        "expenses_usd": format(exp, "f"),
        "shareholder_payouts_usd": format(partner_pay, "f"),
        "employee_debt_cash_effect_usd": format(debt_effect, "f"),
        "current_cash_usd": format(current_cash.quantize(Decimal("0.0001")), "f"),
        "total_stock_value_usd": format(stock, "f"),
        "total_capital_usd": format(capital, "f"),
        "total_debts_exposure_usd": format(debt_exposure, "f"),
        "company_payments_usd": format(sup_pay, "f"),
        "customer_receipts_usd": format(sales_in, "f"),
        "supplier_debt_usd": format(pay, "f"),
        "customer_debt_usd": format(recv, "f"),
        "purchases_goods_usd": format(pinv, "f"),
        "sales_invoiced_usd": format(sinv, "f"),
        "employee_debt_outstanding_usd": format(emp_out, "f"),
        "usd_to_iqd": format(rate, "f") if rate is not None else "",
        "period_sum_sale_prices_usd": format(sum_sale_p.quantize(Decimal("0.0001")), "f"),
        "period_gross_trade_profit_usd": format(gross_trade, "f"),
        "period_customer_discounts_usd": format(cust_disc_p.quantize(Decimal("0.0001")), "f"),
        "period_supplier_discounts_received_usd": format(
            comp_disc_p.quantize(Decimal("0.0001")),
            "f",
        ),
        "period_net_profit_usd": format(net_p.quantize(Decimal("0.0001")), "f"),
    }


def _business_today():
    tz_name = os.environ.get("DJANGO_BUSINESS_TZ", "Asia/Baghdad")
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone.get_current_timezone()
    return timezone.now().astimezone(tz).date()


def petty_cash_trend_points(
    shop_id: int,
    *,
    days: int | None = None,
    d_from=None,
    d_to=None,
) -> dict:
    """
    Daily petty-cash (قاسەی بچووک) for each calendar day in the window.
    Each point matches ``period_dashboard_petty_cash_usd_in_range(shop_id, d, d)``.
    """
    today = _business_today()
    if d_from is not None and d_to is not None:
        start = d_from
        end = d_to
        if end > today:
            end = today
        if start > end:
            start, end = end, start
        span_days = (end - start).days + 1
        if span_days > 365:
            start = end - timedelta(days=364)
            span_days = 365
    else:
        day_count = max(7, min(int(days or 30), 365))
        end = today
        start = end - timedelta(days=day_count - 1)
        span_days = day_count

    points: list[dict] = []
    for offset in range(span_days):
        d = start + timedelta(days=offset)
        drawer = period_dashboard_petty_cash_usd_in_range(shop_id, d, d)
        points.append({"date": d.isoformat(), "value_usd": format(drawer, "f")})
    return {
        "date_from": start.isoformat(),
        "date_to": end.isoformat(),
        "days": span_days,
        "points": points,
    }
