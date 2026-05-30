"""Fix empty shop slugs or delete a shop from the shell (production rescue)."""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from shops.models import Shop


class Command(BaseCommand):
    help = (
        "Repair shops with missing slugs, or delete one shop by id/name. "
        "Example: python manage.py repair_shops --fix-slugs"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--fix-slugs",
            action="store_true",
            help="Fill empty slugs from shop names (also runs on --delete-* targets first).",
        )
        parser.add_argument("--delete-id", type=int, help="Delete shop by primary key.")
        parser.add_argument("--delete-name", type=str, help="Delete shop by exact name.")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Required with --delete-* on production.",
        )

    def handle(self, *args, **options):
        fix_slugs = options["fix_slugs"]
        delete_id = options.get("delete_id")
        delete_name = (options.get("delete_name") or "").strip()

        if not fix_slugs and delete_id is None and not delete_name:
            raise CommandError("Pass --fix-slugs and/or --delete-id / --delete-name.")

        if fix_slugs:
            fixed = self._fix_all_empty_slugs()
            self.stdout.write(self.style.SUCCESS(f"Fixed {fixed} shop slug(s)."))

        if delete_id is not None or delete_name:
            if not options["force"]:
                raise CommandError("Deleting a shop requires --force.")
            shop = self._resolve_shop(delete_id, delete_name)
            label = f"{shop.name} (id={shop.pk}, slug={shop.slug!r})"
            with transaction.atomic():
                shop.delete()
            self.stdout.write(self.style.SUCCESS(f"Deleted shop: {label}"))

    def _fix_all_empty_slugs(self) -> int:
        count = 0
        for shop in Shop.objects.all().order_by("id"):
            if (shop.slug or "").strip():
                continue
            shop.save()
            count += 1
            self.stdout.write(f"  id={shop.pk} slug={shop.slug!r}")
        return count

    def _resolve_shop(self, delete_id: int | None, delete_name: str) -> Shop:
        if delete_id is not None:
            shop = Shop.objects.filter(pk=delete_id).first()
            if shop is None:
                raise CommandError(f"No shop with id={delete_id}.")
            if not (shop.slug or "").strip():
                shop.save()
            return shop
        if delete_name:
            matches = list(Shop.objects.filter(name=delete_name).order_by("id"))
            if not matches:
                raise CommandError(f"No shop named {delete_name!r}.")
            if len(matches) > 1:
                ids = ", ".join(str(s.pk) for s in matches)
                raise CommandError(f"Multiple shops named {delete_name!r}: ids {ids}. Use --delete-id.")
            shop = matches[0]
            if not (shop.slug or "").strip():
                shop.save()
            return shop
        raise CommandError("Provide --delete-id or --delete-name.")
