"""Aggregations for dashboard and cashier (USD)."""

from __future__ import annotations

import os
from datetime import datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import DecimalField, F, Sum
from django.utils import timezone

from .models import (
    Company,
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


def total_expenses_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    expense_qs = Expense.objects.filter(
        shop_id=shop_id,
        occurred_on__gte=d_from,
        occurred_on__lte=d_to,
    )
    return sum((e.amount_usd() for e in expense_qs), Decimal("0"))


def sale_unpaid_balance_usd(sale: Sale) -> Decimal:
    """Positive unpaid amount for one sale (0 if none)."""
    line_sum = Decimal("0")
    for ln in sale.lines.all():
        returned_qty = sum(int(row.quantity) for row in ln.return_lines.all())
        net_qty = max(0, int(ln.quantity) - returned_qty)
        line_sum += Decimal(net_qty) * Decimal(ln.unit_price_usd)
    final_usd = line_sum - Decimal(sale.invoice_discount_usd)
    if final_usd < 0:
        final_usd = Decimal("0")
    rate = Decimal(sale.exchange_rate_usd_to_iqd)
    if rate <= 0:
        return Decimal("0")
    paid = Decimal(sale.amount_paid_usd) + (Decimal(sale.amount_paid_iqd) / rate)
    bal = final_usd - paid
    if bal <= 0:
        return Decimal("0")
    return bal.quantize(Decimal("0.0001"))


def customer_outstanding_balance_usd(shop_id: int, customer_id: int) -> Decimal:
    """Unpaid balance for one customer: sum of positive (final − paid) per sale, all time."""
    total = Decimal("0")
    qs = Sale.objects.filter(shop_id=shop_id, customer_id=customer_id).prefetch_related(
        "lines",
    )
    for sale in qs:
        total += sale_unpaid_balance_usd(sale)
    return total.quantize(Decimal("0.0001"))


def apply_customer_debt_payment_fifo(
    shop_id: int,
    customer_id: int,
    payment_usd_eq: Decimal,
) -> tuple[Decimal, Decimal]:
    """
    Apply USD-equivalent payment to oldest unpaid sales first (increments amount_paid_usd).

    Returns (applied_usd_eq, overpaid_usd_eq) where overpaid is the portion with no debt left.
    """
    payment_usd_eq = payment_usd_eq.quantize(Decimal("0.0001"))
    if payment_usd_eq <= 0:
        return Decimal("0"), Decimal("0")

    outstanding = customer_outstanding_balance_usd(shop_id, customer_id)
    to_apply = min(payment_usd_eq, outstanding)
    if to_apply <= 0:
        return Decimal("0"), payment_usd_eq

    remaining = to_apply
    applied = Decimal("0")

    with transaction.atomic():
        while remaining > Decimal("0.00005"):
            sale = None
            qs = (
                Sale.objects.filter(shop_id=shop_id, customer_id=customer_id)
                .order_by("occurred_at", "id")
                .prefetch_related("lines")
            )
            for s in qs:
                if sale_unpaid_balance_usd(s) > Decimal("0.00005"):
                    sale = s
                    break
            if sale is None:
                break
            unpaid = sale_unpaid_balance_usd(sale)
            chunk = min(remaining, unpaid)
            Sale.objects.filter(pk=sale.pk).update(
                amount_paid_usd=F("amount_paid_usd") + chunk,
            )
            applied += chunk
            remaining -= chunk

    overpaid = payment_usd_eq - applied
    return applied.quantize(Decimal("0.0001")), overpaid.quantize(Decimal("0.0001"))


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


def sales_cash_in_usd_range(shop_id: int, d_from, d_to) -> Decimal:
    """
    Net cash effect from sales in the date range: payments collected on sales
    (USD equivalent) minus cash refunded for sale returns recorded in the same range.

    Returns reduce drawer cash and must lower period drawer movement vs expenses.
    """
    start, end = _bounds(d_from, d_to)
    total = Decimal("0")
    for sale in Sale.objects.filter(
        shop_id=shop_id,
        occurred_at__gte=start,
        occurred_at__lte=end,
    ):
        rate = Decimal(sale.exchange_rate_usd_to_iqd)
        if rate <= 0:
            continue
        paid = Decimal(sale.amount_paid_usd) + (
            Decimal(sale.amount_paid_iqd) / rate
        )
        total += paid.quantize(Decimal("0.0001"))
    refunds = total_returned_products_usd_in_range(shop_id, d_from, d_to)
    return (total - refunds).quantize(Decimal("0.0001"))


def _sale_final_usd(sale: Sale) -> Decimal:
    line_sum = Decimal("0")
    for ln in sale.lines.all():
        returned_qty = sum(int(row.quantity) for row in ln.return_lines.all())
        net_qty = max(0, int(ln.quantity) - returned_qty)
        line_sum += Decimal(net_qty) * Decimal(ln.unit_price_usd)
    final = line_sum - Decimal(sale.invoice_discount_usd)
    if final < 0:
        final = Decimal("0")
    return final.quantize(Decimal("0.0001"))


def sales_invoiced_usd_range(shop_id: int, d_from, d_to) -> Decimal:
    """Total invoiced sales (line totals minus invoice discount) in date range, USD."""
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


def total_sales_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """Total invoiced sales in range (alias for dashboard employee cards)."""
    return sales_invoiced_usd_range(shop_id, d_from, d_to)


def total_customer_discounts_usd_in_range(shop_id: int, d_from, d_to) -> Decimal:
    """Total customer invoice discounts in the selected date range (USD)."""
    start, end = _bounds(d_from, d_to)
    dec = DecimalField(max_digits=24, decimal_places=4)
    amount = (
        Sale.objects.filter(
            shop_id=shop_id,
            occurred_at__gte=start,
            occurred_at__lte=end,
        ).aggregate(s=Sum("invoice_discount_usd", output_field=dec))["s"]
        or Decimal("0")
    )
    return Decimal(str(amount)).quantize(Decimal("0.0001"))


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


def top_selling_products_in_range(shop_id: int, d_from, d_to, limit: int = 7) -> list[dict]:
    """
    Top selling products by total sold quantity in the selected range.

    Includes manual lines by falling back to their manual_name when product is null.
    """
    start, end = _bounds(d_from, d_to)
    dec = DecimalField(max_digits=24, decimal_places=4)
    rows = (
        SaleLine.objects.filter(
            sale__shop_id=shop_id,
            sale__occurred_at__gte=start,
            sale__occurred_at__lte=end,
        )
        .values("product_id", "product__name", "manual_name")
        .annotate(
            total_qty=Sum("quantity"),
            total_sales_usd=Sum(F("quantity") * F("unit_price_usd"), output_field=dec),
        )
        .order_by("-total_qty", "-total_sales_usd")[: max(1, int(limit))]
    )
    out: list[dict] = []
    for row in rows:
        name = (row.get("product__name") or row.get("manual_name") or "").strip()
        if not name:
            continue
        total_qty = int(row.get("total_qty") or 0)
        total_sales_usd = Decimal(str(row.get("total_sales_usd") or "0")).quantize(
            Decimal("0.0001"),
        )
        out.append(
            {
                "product_id": row.get("product_id"),
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
        rate = Decimal(sale.exchange_rate_usd_to_iqd)
        if rate <= 0:
            continue
        paid = Decimal(sale.amount_paid_usd) + (
            Decimal(sale.amount_paid_iqd) / rate
        )
        paid = paid.quantize(Decimal("0.0001"))
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
