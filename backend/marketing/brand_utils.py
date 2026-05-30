from __future__ import annotations

from django.http import HttpRequest

from .models import DEFAULT_BRAND_LOGO_PATH, DEFAULT_BRAND_NAME, MarketingSiteContent


def brand_site_name(content: MarketingSiteContent) -> str:
    name = (content.brand_name or DEFAULT_BRAND_NAME).strip()
    return name or DEFAULT_BRAND_NAME


def brand_logo_url(content: MarketingSiteContent, request: HttpRequest | None = None) -> str:
    if content.brand_logo:
        url = content.brand_logo.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url
    return DEFAULT_BRAND_LOGO_PATH


def serialize_brand(content: MarketingSiteContent, request: HttpRequest | None = None) -> dict:
    return {
        "site_name": brand_site_name(content),
        "logo_url": brand_logo_url(content, request),
    }
