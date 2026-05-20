"""Helpers for per-shop public storefront appearance."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from django.http import HttpRequest

    from shops.models import Shop, StorefrontSettings


def get_or_create_storefront_settings(shop: Shop) -> StorefrontSettings:
    from shops.models import StorefrontSettings

    obj, _ = StorefrontSettings.objects.get_or_create(shop=shop)
    return obj


def _storefront_logo_url(settings: StorefrontSettings, request: HttpRequest | None) -> str | None:
    if not settings.logo:
        return None
    try:
        url = settings.logo.url
        if request:
            return request.build_absolute_uri(url)
        return url
    except Exception:
        return None


def storefront_settings_public_dict(
    settings: StorefrontSettings,
    shop: Shop,
    request: HttpRequest | None = None,
) -> dict[str, str | int | None]:
    title = (settings.catalog_title or "").strip()
    rotate = settings.banner_rotate_seconds
    if rotate < 2:
        rotate = 2
    if rotate > 60:
        rotate = 60
    return {
        "catalog_title": title or shop.name,
        "catalog_subtitle": (settings.catalog_subtitle or "").strip(),
        "welcome_message": (settings.welcome_message or "").strip(),
        "logo_url": _storefront_logo_url(settings, request),
        "accent_color": (settings.accent_color or "").strip() or "#fbbf24",
        "banner_rotate_seconds": rotate,
    }


def storefront_banners_public_list(shop: Shop, request: HttpRequest | None) -> list[dict[str, Any]]:
    from shops.models import StorefrontBanner

    rows = (
        StorefrontBanner.objects.filter(shop_id=shop.pk, is_active=True)
        .select_related("category")
        .order_by("sort_order", "id")
    )
    out: list[dict[str, Any]] = []
    for row in rows:
        image_url = None
        if row.image:
            try:
                url = row.image.url
                if request:
                    image_url = request.build_absolute_uri(url)
                else:
                    image_url = url
            except Exception:
                image_url = None
        if not image_url and not (row.title or row.subtitle):
            continue
        cat = row.category
        out.append(
            {
                "id": row.id,
                "title": (row.title or "").strip(),
                "subtitle": (row.subtitle or "").strip(),
                "image_url": image_url,
                "link_type": row.link_type,
                "link_url": (row.link_url or "").strip() if row.link_type == StorefrontBanner.LinkType.URL else "",
                "category_id": cat.id if cat is not None else None,
                "category_name": cat.name if cat is not None else "",
            },
        )
    return out
