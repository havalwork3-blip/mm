"""Normalize and validate shop storefront hostnames."""

from __future__ import annotations

import re

# rada.mmiraq.com — labels 1–63 chars, TLD 2+ letters
_HOST_RE = re.compile(
    r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$",
)
_LABEL_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
DEFAULT_STOREFRONT_BASE = "mmiraq.com"


def normalize_storefront_host(raw: str) -> str:
    s = str(raw or "").strip().lower()
    if not s:
        return ""
    for prefix in ("https://", "http://"):
        if s.startswith(prefix):
            s = s[len(prefix) :]
    s = s.split("/")[0].split(":")[0].strip(".")
    # Single label (e.g. "haval") → haval.mmiraq.com
    if s and "." not in s and _LABEL_RE.match(s):
        s = f"{s}.{DEFAULT_STOREFRONT_BASE}"
    return s


def validate_storefront_host(host: str) -> str:
    """Return normalized host or raise ValueError with a short message."""
    normalized = normalize_storefront_host(host)
    if not normalized:
        return ""
    if len(normalized) > 255:
        raise ValueError("Hostname is too long.")
    if normalized.endswith(".localhost"):
        if re.match(
            r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+localhost$",
            normalized,
        ):
            return normalized
        raise ValueError("Enter a valid *.localhost host (e.g. shabmall.localhost).")
    if not _HOST_RE.match(normalized):
        raise ValueError("Enter a valid hostname (e.g. rada.mmiraq.com).")
    return normalized


def parse_storefront_host_aliases(raw: str) -> dict[str, str]:
    """Parse ``alias=target`` pairs (comma-separated).

    *target* is another storefront hostname or a numeric shop id.
    """
    out: dict[str, str] = {}
    for part in str(raw or "").split(","):
        part = part.strip()
        if not part or "=" not in part:
            continue
        alias_raw, target_raw = part.split("=", 1)
        alias = normalize_storefront_host(alias_raw.strip())
        target = target_raw.strip()
        if alias and target:
            out[alias] = target
    return out


def resolve_storefront_shop_for_host(host: str, aliases: dict[str, str] | None = None):
    """Return an active shop with online storefront for *host*, following optional aliases."""
    from shops.models import Shop

    normalized = normalize_storefront_host(host)
    if not normalized:
        return None

    qs = Shop.objects.filter(is_active=True, online_storefront_enabled=True)

    shop = qs.filter(storefront_host=normalized).first()
    if shop is not None:
        return shop

    if aliases is None:
        from django.conf import settings

        aliases = getattr(settings, "STOREFRONT_HOST_ALIASES", {})

    target = (aliases or {}).get(normalized)
    if not target:
        return None

    if target.isdigit():
        return qs.filter(pk=int(target)).first()

    canonical = normalize_storefront_host(target)
    if not canonical:
        return None
    return qs.filter(storefront_host=canonical).first()
