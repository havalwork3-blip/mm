from __future__ import annotations

import os
from io import BytesIO

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import UploadedFile
from django.http import HttpRequest
from PIL import Image, UnidentifiedImageError

from .models import DEFAULT_BRAND_LOGO_PATH, DEFAULT_BRAND_NAME, MarketingSiteContent

BRAND_LOGO_MAX_PX = 256


def brand_site_name(content: MarketingSiteContent) -> str:
    name = (content.brand_name or DEFAULT_BRAND_NAME).strip()
    return name or DEFAULT_BRAND_NAME


def _root_media_path(url: str) -> str:
    """Ensure media paths resolve from site root, not the current API path."""
    if not url:
        return url
    if url.startswith(("http://", "https://")):
        return url
    if url.startswith("/"):
        return url
    return f"/{url.lstrip('/')}"


def brand_logo_url(content: MarketingSiteContent, request: HttpRequest | None = None) -> str:
    if content.brand_logo:
        url = _root_media_path(content.brand_logo.url)
        if request is not None:
            return request.build_absolute_uri(url)
        return url
    return DEFAULT_BRAND_LOGO_PATH


def serialize_brand(content: MarketingSiteContent, request: HttpRequest | None = None) -> dict:
    return {
        "site_name": brand_site_name(content),
        "logo_url": brand_logo_url(content, request),
        "updated_at": content.updated_at.isoformat() if content.updated_at else None,
    }


def optimize_brand_logo_upload(uploaded: UploadedFile) -> ContentFile:
    """Resize and normalize CMS logo uploads for crisp header display."""
    uploaded.seek(0)
    try:
        image = Image.open(uploaded)
        image.load()
    except UnidentifiedImageError as exc:
        raise ValueError("Invalid image file.") from exc

    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        image = image.convert("RGBA")
        fmt = "WEBP"
        save_kwargs = {"quality": 88, "method": 6}
    else:
        image = image.convert("RGB")
        fmt = "WEBP"
        save_kwargs = {"quality": 88, "method": 6}

    image.thumbnail((BRAND_LOGO_MAX_PX, BRAND_LOGO_MAX_PX), Image.Resampling.LANCZOS)

    buf = BytesIO()
    image.save(buf, format=fmt, **save_kwargs)
    buf.seek(0)

    base = os.path.splitext(uploaded.name or "brand-logo")[0]
    safe_base = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in base).strip("-") or "brand-logo"
    return ContentFile(buf.read(), name=f"{safe_base}.webp")
