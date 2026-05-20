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
