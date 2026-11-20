"""
Cancel online orders left PENDING longer than STOREFRONT_PENDING_ORDER_HOURS (default 48)
and give their stock back. Safe to run from cron (e.g. hourly); the dashboard also does this
lazily whenever staff open the online orders list or a new order arrives.

    python manage.py expire_pending_storefront_orders
"""

from django.core.management.base import BaseCommand

from inventory.storefront_expiry import expire_stale_pending_orders, pending_order_lifetime


class Command(BaseCommand):
    help = "Cancel stale PENDING online orders and restore their stock."

    def add_arguments(self, parser):
        parser.add_argument("--shop", type=int, help="Only this shop id.")

    def handle(self, *args, **opts):
        n = expire_stale_pending_orders(opts.get("shop"))
        self.stdout.write(
            self.style.SUCCESS(
                f"Cancelled {n} pending order(s) older than {pending_order_lifetime()}."
            )
        )
