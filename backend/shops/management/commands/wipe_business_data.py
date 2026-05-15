"""
Delete all shops and cascaded tenant data (sales, purchases, stock, customers, …).

Keeps Django superusers that are not tied to a shop (shop=NULL). Staff users that
belong to a shop are removed with the shop. For local testing only.
"""

from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from shops.models import Shop


class Command(BaseCommand):
    help = (
        "Remove every Shop row; CASCADE deletes all inventory, settings, opening cash, "
        "and users whose shop FK points at those shops. Superusers with shop=NULL remain."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Run even when DEBUG is False (dangerous on production).",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "Refused: DEBUG is False. For a deliberate production wipe, pass --force."
            )
        qs = Shop.objects.all()
        count = qs.count()
        if count == 0:
            self.stdout.write(self.style.WARNING("No shops to delete."))
            return
        qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {count} shop(s) and all related business data. "
                "Recreate a shop and users from the admin or onboarding flow."
            )
        )
