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


def _storefront_location_image_url(
    settings: StorefrontSettings,
    request: HttpRequest | None,
) -> str | None:
    if not settings.location_image:
        return None
    try:
        url = settings.location_image.url
        if request:
            return request.build_absolute_uri(url)
        return url
    except Exception:
        return None


_SOCIAL_PLATFORMS = frozenset(
    {
        "facebook",
        "instagram",
        "tiktok",
        "youtube",
        "twitter",
        "telegram",
        "whatsapp",
        "snapchat",
        "website",
    },
)


def _normalize_social_links(raw: object) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in raw[:12]:
        if not isinstance(item, dict):
            continue
        platform = str(item.get("platform") or "").strip().lower()[:32]
        url = str(item.get("url") or "").strip()[:500]
        if platform not in _SOCIAL_PLATFORMS or not url:
            continue
        if not url.startswith(("http://", "https://")):
            continue
        out.append({"platform": platform, "url": url})
    return out


def _normalize_faq_items(raw: object) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in raw[:30]:
        if not isinstance(item, dict):
            continue
        q = str(item.get("question") or item.get("q") or "").strip()[:500]
        a = str(item.get("answer") or item.get("a") or "").strip()[:4000]
        if not q and not a:
            continue
        out.append({"question": q, "answer": a})
    return out


def storefront_settings_public_dict(
    settings: StorefrontSettings,
    shop: Shop,
    request: HttpRequest | None = None,
) -> dict[str, str | int | list | None]:
    title = (settings.catalog_title or "").strip()
    rotate = settings.banner_rotate_seconds
    if rotate < 2:
        rotate = 2
    if rotate > 60:
        rotate = 60
    default_currency = (settings.price_display_default or "usd").strip().lower()
    if default_currency not in ("usd", "iqd", "both"):
        default_currency = "usd"
    return {
        "catalog_title": title or shop.name,
        "catalog_subtitle": (settings.catalog_subtitle or "").strip(),
        "welcome_message": (settings.welcome_message or "").strip(),
        "logo_url": _storefront_logo_url(settings, request),
        "accent_color": (settings.accent_color or "").strip() or "#fbbf24",
        "banner_rotate_seconds": rotate,
        "price_display_default": default_currency,
        "contact_phone": (settings.contact_phone or "").strip(),
        "contact_whatsapp": (settings.contact_whatsapp or "").strip(),
        "contact_email": (settings.contact_email or "").strip(),
        "about_title": (settings.about_title or "").strip() or shop.name,
        "about_body": (settings.about_body or "").strip(),
        "faq_items": _normalize_faq_items(settings.faq_items),
        "shop_address": (settings.shop_address or "").strip(),
        "location_url": (settings.location_url or "").strip(),
        "location_image_url": _storefront_location_image_url(settings, request),
        "social_links": _normalize_social_links(settings.social_links),
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
