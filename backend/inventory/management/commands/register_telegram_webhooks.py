from django.core.management.base import BaseCommand

from shops.models import StorefrontSettings
from shops.telegram_notify import register_webhook


class Command(BaseCommand):
    help = "Re-register every shop's Telegram webhook (needed once so it carries the secret token)."

    def handle(self, *args, **options):
        done = 0
        for settings in StorefrontSettings.objects.exclude(telegram_bot_token="").filter(
            telegram_notify_enabled=True,
        ):
            token = (settings.telegram_bot_token or "").strip()
            if token and register_webhook(token):
                done += 1
            elif token:
                self.stderr.write(f"shop {settings.shop_id}: Telegram webhook registration failed")
        self.stdout.write(self.style.SUCCESS(f"Registered {done} Telegram webhook(s)."))
