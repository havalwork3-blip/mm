from django.core.management.base import BaseCommand

from marketing.brand_utils import sync_brand_logo_to_webroot
from marketing.models import MarketingSiteContent


class Command(BaseCommand):
    help = "Sync CMS brand logo to mmiraq.com static web root (brand-custom.webp)."

    def handle(self, *args, **options):
        content = MarketingSiteContent.load()
        sync_brand_logo_to_webroot(content)
        if content.brand_logo:
            self.stdout.write(self.style.SUCCESS("Brand logo synced to web root."))
        else:
            self.stdout.write("No custom brand logo; removed static copy if present.")
