from django.core.management.base import BaseCommand

from inventory.fifo import reconcile_product_batches
from inventory.models import Product


class Command(BaseCommand):
    help = "Re-align FIFO batch layers with each product's stock count (safe to re-run)."

    def add_arguments(self, parser):
        parser.add_argument("--shop", type=int, help="Only this shop id.")

    def handle(self, *args, **options):
        qs = Product.objects.all()
        if options.get("shop"):
            qs = qs.filter(shop_id=options["shop"])
        changed = 0
        for pid in qs.values_list("pk", flat=True):
            diff = reconcile_product_batches(pid)
            if diff:
                changed += 1
                self.stdout.write(f"product {pid}: batches adjusted by {diff:+d}")
        self.stdout.write(self.style.SUCCESS(f"Done. {changed} product(s) adjusted."))
