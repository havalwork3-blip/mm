"""Helpers for per-shop public storefront appearance."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from shops.models import Shop, StorefrontSettings


def get_or_create_storefront_settings(shop: Shop) -> StorefrontSettings:
    from shops.models import StorefrontSettings

    obj, _ = StorefrontSettings.objects.get_or_create(shop=shop)
    return obj


def storefront_settings_public_dict(
    settings: StorefrontSettings,
    shop: Shop,
) -> dict[str, str]:
    title = (settings.catalog_title or "").strip()
    return {
        "catalog_title": title or shop.name,
        "catalog_subtitle": (settings.catalog_subtitle or "").strip(),
        "welcome_message": (settings.welcome_message or "").strip(),
        "accent_color": (settings.accent_color or "").strip() or "#fbbf24",
    }
