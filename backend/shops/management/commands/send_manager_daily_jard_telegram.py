"""Send daily jard + stats digest to the configured manager Telegram chat."""

from django.core.management.base import BaseCommand

from shops.manager_daily_telegram import (
    business_today,
    send_manager_daily_digest,
    should_run_scheduled_send,
)
from shops.models import QrLandingSettings


class Command(BaseCommand):
    help = "Send per-shop jard and dashboard stats to the manager Telegram bot."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Send even if already sent today.",
        )
        parser.add_argument(
            "--scheduled",
            action="store_true",
            help="Only send when local time passed configured send time and not sent today.",
        )

    def handle(self, *args, **options):
        settings = QrLandingSettings.load()
        force = bool(options["force"])
        scheduled = bool(options["scheduled"])

        if scheduled and not force:
            if not should_run_scheduled_send(settings):
                self.stdout.write("Skipped (not due or already sent today).")
                return

        result = send_manager_daily_digest(
            settings,
            report_date=business_today(),
            force=force,
        )
        failed = result.get("failed") or []
        self.stdout.write(
            self.style.SUCCESS(
                f"Manager Telegram: {result['sent']} message(s), "
                f"{result['shop_ok']}/{result['shops']} shop(s) OK.",
            ),
        )
        for row in failed:
            self.stdout.write(
                self.style.WARNING(f"  Failed: {row.get('name')} — {row.get('error')}"),
            )
