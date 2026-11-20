"""
List sales that have an unpaid balance (debt) but no customer.

Such debt is counted in total receivables but sits on nobody's account, so it
can never be collected. Read-only: nothing is changed. Assign the customer to
each listed receipt from the app (edit the sale), then run this again.

    python manage.py find_sales_missing_customer
    python manage.py find_sales_missing_customer --all     # also fully paid walk-in sales
    python manage.py find_sales_missing_customer --shop 3
"""

from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from inventory.dashboard_tools import sale_unpaid_balance_usd
from inventory.models import Sale


class Command(BaseCommand):
    help = "List debt sales that have no customer (read-only)."

    def add_arguments(self, parser):
        parser.add_argument("--shop", type=int, help="Only this shop id.")
        parser.add_argument(
            "--all",
            action="store_true",
            help="Also list fully paid sales without a customer.",
        )

    def handle(self, *args, **opts):
        qs = (
            Sale.objects.filter(customer__isnull=True)
            .select_related("shop")
            .prefetch_related("lines__return_lines", "debt_payment_lines", "debt_discount_writeoff_lines")
            .order_by("shop_id", "occurred_at")
        )
        if opts.get("shop"):
            qs = qs.filter(shop_id=opts["shop"])

        debt_count = 0
        debt_total = Decimal("0")
        paid_count = 0
        for sale in qs.iterator(chunk_size=500):
            unpaid = sale_unpaid_balance_usd(sale)
            if unpaid <= 0:
                paid_count += 1
                if not opts["all"]:
                    continue
            else:
                debt_count += 1
                debt_total += unpaid
            when = timezone.localtime(sale.occurred_at).strftime("%Y-%m-%d %H:%M")
            note = (sale.note or "").replace("\n", " ").strip()[:50]
            self.stdout.write(
                f"shop={sale.shop_id} receipt=#{sale.receipt_number} sale_id={sale.pk} "
                f"date={when} unpaid_usd={unpaid:.2f}" + (f" note={note!r}" if note else "")
            )

        self.stdout.write("")
        self.stdout.write(
            self.style.WARNING(
                f"Debt sales without a customer: {debt_count} (unpaid total ${debt_total:.2f})"
            )
            if debt_count
            else self.style.SUCCESS("No debt sales without a customer.")
        )
        self.stdout.write(f"Fully paid sales without a customer: {paid_count}")
