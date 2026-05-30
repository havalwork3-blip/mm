import os

from django.core.management.base import BaseCommand, CommandError

from accounts.models import User


class Command(BaseCommand):
    help = (
        "Create or update a POS dashboard superuser (email login). "
        "Use on the server: python manage.py ensure_superuser --email you@example.com --password '…'"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            default=os.environ.get("SUPERUSER_EMAIL", "").strip(),
            help="Superuser email (or SUPERUSER_EMAIL env)",
        )
        parser.add_argument(
            "--password",
            default=os.environ.get("SUPERUSER_PASSWORD", "").strip(),
            help="Password (or SUPERUSER_PASSWORD env)",
        )

    def handle(self, *args, **options):
        email = str(options["email"] or "").strip()
        password = str(options["password"] or "")
        if not email:
            raise CommandError("Pass --email or set SUPERUSER_EMAIL.")
        if not password:
            raise CommandError("Pass --password or set SUPERUSER_PASSWORD.")
        if len(password) < 8:
            raise CommandError("Password must be at least 8 characters.")

        user = User.objects.filter(email__iexact=email).order_by("pk").first()
        created = user is None
        if created:
            user = User(email=email.lower())
        else:
            user.email = email.lower()

        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.shop_id = None
        user.set_password(password)
        user.save()

        verb = "Created" if created else "Updated"
        self.stdout.write(
            self.style.SUCCESS(f"{verb} dashboard superuser: {user.email}"),
        )
