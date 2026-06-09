"""Aggregations for dashboard and cashier (USD)."""

from __future__ import annotations

import os
from datetime import datetime, time
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Case, DecimalField, F, Sum, Value, When
from django.db.models.functions import Coalesce
from django.utils import timezone

from .models import (
    Company,
    CustomerDebtDiscountWriteoff,
    CustomerDebtDiscountWriteoffSale,
    CustomerDebtPayment,
    CustomerDebtPaymentSale,
    EmployeeDebt,
    EmployeeDebtType,
    Expense,
    Product,
    Purchase,
    Sale,
    SaleLine,
    SaleReturn,
    SaleReturnLine,
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


def _sale_final_usd(sale: Sale) -> Decimal:
    final = _sale_lines_subtotal_usd(sale) - Decimal(sale.invoice_discount_usd)
    if final < 0:
        final = Decimal("0")
    return final.quantize(Decimal("0.0001"))


def _sale_debt_payments_allocated_usd(sale: Sale) -> Decimal:
    """USD equivalent applied toward this sale via customer-debts repayments."""
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
    if bal <= 0:
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
        "lines__return_lines",
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
        .prefetch_related("lines__return_lines")
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

    applied, allocations = _allocate_customer_debt_payment_fifo(
        shop_id,
        customer_id,
        payment_usd_eq,
    )
    if applied <= 0:
        return Decimal("0"), payment_usd_eq, None

    now = timezone.now()
    with transaction.atomic():
        payment = CustomerDebtPayment.objects.create(
            shop_id=shop_id,
            customer_id=customer_id,
            amount_paid_usd=amount_paid_usd,
            amount_paid_iqd=amount_paid_iqd,
            exchange_rate_usd_to_iqd=exchange_rate,
            occurred_at=now,
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
    qs = Sale.objects.filter(shop_id=shop_id).prefetch_related("lines__return_lines")
    for sale in qs:
        total += sale_unpaid_balance_usd(sale)
    return total


def total_receivables_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """Outstanding balances only for sales created in the selected date range."""
    start, end = _bounds(d_from, d_to)
    total = Decimal("0")
    qs = Sale.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    ).prefetch_related("lines__return_lines")
    for sale in qs:
        total += sale_unpaid_balance_usd(sale)
    return total.quantize(Decimal("0.0001"))


def total_payables_usd(shop_id: int) -> Decimal:
    """Outstanding supplier balances (all purchases, all time)."""
    total = Decimal("0")
    for pur in Purchase.objects.filter(shop_id=shop_id).prefetch_related("lines"):
        line_sum = Decimal("0")
        for ln in pur.lines.all():
            line_sum += Decimal(ln.quantity) * Decimal(ln.unit_cost_usd)
        net_due = line_sum - Decimal(pur.discount_received_usd)
        paid = Decimal(pur.amount_paid_usd)
        bal = net_due - paid
        if bal > 0:
            total += bal.quantize(Decimal("0.0001"))
    return total


def purchase_unpaid_balance_usd(pur: Purchase) -> Decimal:
    """Positive unpaid amount for one purchase (0 if fully paid or overpaid)."""
    line_sum = Decimal("0")
    for ln in pur.lines.all():
        line_sum += Decimal(ln.quantity) * Decimal(ln.unit_cost_usd)
    net_due = line_sum - Decimal(pur.discount_received_usd)
    paid = Decimal(pur.amount_paid_usd)
    bal = net_due - paid
    if bal <= 0:
        return Decimal("0")
    return bal.quantize(Decimal("0.0001"))


def company_outstanding_usd(shop_id: int, company_id: int) -> Decimal:
    """Outstanding balance owed to one supplier (purchases on credit minus payments)."""
    total = Decimal("0")
    # Do not use .iterator() after .prefetch_related() — Django raises ValueError.
    for pur in Purchase.objects.filter(shop_id=shop_id, company_id=company_id).prefetch_related(
        "lines",
    ):
        total += purchase_unpaid_balance_usd(pur)
    return total


def apply_supplier_debt_payment_fifo(
    shop_id: int,
    company_id: int,
    payment_usd_eq: Decimal,
) -> tuple[Decimal, Decimal]:
    """
    Apply USD-equivalent payment to oldest unpaid purchases first (increments amount_paid_usd).

    Returns (applied_usd_eq, overpaid_usd_eq).
    """
    payment_usd_eq = payment_usd_eq.quantize(Decimal("0.0001"))
    if payment_usd_eq <= 0:
        return Decimal("0"), Decimal("0")

    outstanding = company_outstanding_usd(shop_id, company_id)
    to_apply = min(payment_usd_eq, outstanding)
    if to_apply <= 0:
        return Decimal("0"), payment_usd_eq

    remaining = to_apply
    applied = Decimal("0")

    with transaction.atomic():
        while remaining > Decimal("0.00005"):
            pur = None
            qs = (
                Purchase.objects.filter(shop_id=shop_id, company_id=company_id)
                .order_by("occurred_at", "id")
                .prefetch_related("lines")
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
            applied += chunk
            remaining -= chunk

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
        for pur in purchases.prefetch_related("lines"):
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
    dec = DecimalField(max_digits=24, decimal_places=4)
    v = (
        Product.objects.filter(shop_id=shop_id).aggregate(
            s=Sum(
                F("current_stock_quantity") * F("buy_price"),
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
    start, end = _bounds(d_from, d_to)
    total = Decimal("0")
    for payment in CustomerDebtPayment.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    ):
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


def _sale_list_sold_price_usd(sale: Sale) -> Decimal:
    """
    Sold price on one invoice (Σ line qty × unit price − invoice discount).

    Matches sales history «نرخی گشتی (USD)» per receipt; returns are a separate card.
    """
    line_sum = Decimal("0")
    for ln in sale.lines.all():
        line_sum += Decimal(int(ln.quantity)) * Decimal(ln.unit_price_usd)
    final = line_sum - Decimal(sale.invoice_discount_usd)
    if final < 0:
        final = Decimal("0")
    return final.quantize(Decimal("0.0001"))


def sales_list_sold_price_usd_range(shop_id: int, d_from, d_to) -> Decimal:
    """Sum of per-invoice sold prices (sales history «نرخی گشتی» basis)."""
    start, end = _bounds(d_from, d_to)
    total = Decimal("0")
    qs = Sale.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    ).prefetch_related("lines")
    for sale in qs:
        total += _sale_list_sold_price_usd(sale)
    return money_usd_2dp(total)


def total_sales_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """Dashboard «total sold» — sum of sold prices, same basis as sales history."""
    return sales_list_sold_price_usd_range(shop_id, d_from, d_to)


def period_dashboard_petty_cash_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """
    Dashboard «petty cash» (قاسەی بچووک):

    total sold − expenses + debt collected − returned products − discounts.
    Each term matches the corresponding dashboard category card (2 dp).
    Debt repayments count on the payment date, not the original sale date.
    """
    petty = (
        money_usd_2dp(total_sales_usd_in_range(shop_id, d_from, d_to))
        - money_usd_2dp(total_expenses_usd_in_range(shop_id, d_from, d_to))
        + customer_debt_payments_usd_in_range(shop_id, d_from, d_to)
        - money_usd_2dp(total_returned_products_usd_in_range(shop_id, d_from, d_to))
        - money_usd_2dp(total_customer_discounts_usd_in_range(shop_id, d_from, d_to))
    )
    return money_usd_2dp(petty)


def total_customer_discounts_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """Total customer discounts in range: checkout invoice discounts + debt writeoffs."""
    start, end = _bounds(d_from, d_to)
    dec = DecimalField(max_digits=24, decimal_places=4)
    sale_disc = (
        Sale.objects.filter(
            shop_id=shop_id,
            occurred_at__gte=start,
            occurred_at__lte=end,
        ).aggregate(s=Sum("invoice_discount_usd", output_field=dec))["s"]
        or Decimal("0")
    )
    writeoff_disc = (
        CustomerDebtDiscountWriteoff.objects.filter(
            shop_id=shop_id,
            occurred_at__gte=start,
            occurred_at__lte=end,
        ).aggregate(s=Sum("amount_usd", output_field=dec))["s"]
        or Decimal("0")
    )
    overlap = _debt_writeoff_discount_overlap_usd(shop_id, start, end, dec)
    total = Decimal(str(sale_disc)) + Decimal(str(writeoff_disc)) - overlap
    return total.quantize(Decimal("0.0001"))


def total_debtor_customers_count(shop_id: int) -> int:
    """Number of customers that still have an outstanding balance."""
    customer_ids = (
        Sale.objects.filter(shop_id=shop_id, customer_id__isnull=False)
        .order_by()
        .values_list("customer_id", flat=True)
        .distinct()
    )
    total = 0
    for customer_id in customer_ids:
        if customer_id is None:
            continue
        if customer_outstanding_balance_usd(shop_id, int(customer_id)) > 0:
            total += 1
    return total


def total_returned_products_qty_in_range(shop_id: int, d_from, d_to) -> int:
    """Total quantity of returned sale products during the selected range."""
    start, end = _bounds(d_from, d_to)
    qty = (
        SaleReturnLine.objects.filter(
            sale_return__shop_id=shop_id,
            sale_return__occurred_at__gte=start,
            sale_return__occurred_at__lte=end,
        ).aggregate(s=Sum("quantity"))["s"]
        or 0
    )
    return int(qty)


def total_returned_products_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """Total returned products value in USD during the selected range."""
    start, end = _bounds(d_from, d_to)
    dec = DecimalField(max_digits=24, decimal_places=4)
    amount = (
        SaleReturnLine.objects.filter(
            sale_return__shop_id=shop_id,
            sale_return__occurred_at__gte=start,
            sale_return__occurred_at__lte=end,
        ).aggregate(s=Sum(F("quantity") * F("unit_price_usd"), output_field=dec))["s"]
        or Decimal("0")
    )
    return Decimal(str(amount)).quantize(Decimal("0.0001"))


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


def supplier_payments_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """Cash paid toward suppliers (sum of amount_paid_usd on purchases) in date range."""
    start, end = _bounds(d_from, d_to)
    total = Decimal("0")
    for pur in Purchase.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    ):
        total += Decimal(pur.amount_paid_usd)
    return total.quantize(Decimal("0.0001"))


def cashier_ledger_entries(shop_id: int, d_from, d_to) -> list[dict]:
    """Chronological vault-related movements for the cashier archive (USD labels)."""
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
                "occurred_on": sale.occurred_at.date().isoformat(),
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
                "occurred_on": payment.occurred_at.date().isoformat(),
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
        refund = Decimal("0")
        for ln in sr.lines.all():
            refund += Decimal(ln.quantity) * Decimal(ln.unit_price_usd)
        refund = refund.quantize(Decimal("0.0001"))
        if refund <= 0:
            continue
        cust_label = sr.customer.name if sr.customer_id else ""
        sale_bit = f"#{sr.sale_id}"
        label = " · ".join([p for p in (cust_label, sale_bit) if p]) or "Sale return"
        rows.append(
            {
                "kind": "sale_return",
                "id": sr.id,
                "occurred_on": sr.occurred_at.date().isoformat(),
                "occurred_at": sr.occurred_at.isoformat(),
                "amount_usd": format(refund, "f"),
                "direction": "out",
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
        .order_by("-occurred_at", "-id")
    )
    for pur in pur_qs:
        paid = Decimal(pur.amount_paid_usd).quantize(Decimal("0.0001"))
        if paid <= 0:
            continue
        comp = pur.company.name if pur.company_id else ""
        rows.append(
            {
                "kind": "purchase_payment",
                "id": pur.id,
                "occurred_on": pur.occurred_at.date().isoformat(),
                "occurred_at": pur.occurred_at.isoformat(),
                "amount_usd": format(paid, "f"),
                "direction": "out",
                "label": comp or "Purchase",
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


def cashier_snapshot(
    shop_id: int,
    d_from,
    d_to,
    opening_cash_usd: Decimal | None = None,
) -> dict:
    """
    Current cash (USD) ≈ opening + sales cash in - expenses - net employee debt taken
    (employee debt models cash removed as Taken and added back as Returned).
    """
    start, end = _bounds(d_from, d_to)

    if opening_cash_usd is None:
        row = (
            ShopDayOpeningCash.objects.filter(shop_id=shop_id, for_date=d_from)
            .values_list("opening_cash_usd", flat=True)
            .first()
        )
        opening_cash_usd = Decimal(str(row)) if row is not None else Decimal("0")
    else:
        opening_cash_usd = Decimal(str(opening_cash_usd))

    sales_in = sales_cash_in_usd_range(shop_id, d_from, d_to)
    exp = total_expenses_usd_in_range(shop_id, d_from, d_to)

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

    current_cash = opening_cash_usd + sales_in - exp - debt_effect
    stock = total_stock_value_usd(shop_id)
    recv = total_receivables_usd(shop_id)
    pay = total_payables_usd(shop_id)
    sup_pay = supplier_payments_usd_in_range(shop_id, d_from, d_to)
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
        "expenses_usd": format(exp, "f"),
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
