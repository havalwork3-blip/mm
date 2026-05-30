from django.core.management.base import BaseCommand, CommandError

from marketing.models import MarketingEditor


class Command(BaseCommand):
    help = "Create a marketing CMS editor (separate from POS accounts)."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="Login email for the site CMS")
        parser.add_argument("--password", required=True, help="Login password")
        parser.add_argument("--name", default="", help="Optional display name")

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        password = options["password"]
        if len(password) < 8:
            raise CommandError("Password must be at least 8 characters.")
        editor, created = MarketingEditor.objects.get_or_create(
            email=email,
            defaults={"display_name": options["name"].strip()},
        )
        editor.set_password(password)
        if options["name"].strip():
            editor.display_name = options["name"].strip()
        editor.is_active = True
        editor.save()
        verb = "Created" if created else "Updated password for"
        self.stdout.write(self.style.SUCCESS(f"{verb} marketing editor: {email}"))
