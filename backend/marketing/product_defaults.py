"""Default product cards seeded from landing i18n catalog."""

from __future__ import annotations

import json
from pathlib import Path

PAGES = ("luxury", "tech", "shop", "services")

TONE_CYCLE = ("violet", "gold", "cyan", "indigo")

# i18n key -> (page, tag_key or None)
_CATALOG = [
    ("p1", "luxury", "new"),
    ("p2", "luxury", None),
    ("p3", "luxury", "hot"),
    ("p4", "luxury", None),
    ("p5", "tech", "discount"),
    ("p6", "tech", None),
    ("p7", "tech", "premium"),
    ("p8", "tech", None),
    ("p9", "shop", "mm"),
    ("p10", "shop", None),
    ("p11", "shop", None),
    ("p12", "shop", "ai"),
    ("p13", "services", "ai"),
    ("p14", "services", None),
    ("p15", "services", None),
    ("p16", "services", None),
]

_LINKS = {
    "luxury": "/luxury/",
    "tech": "/tech/",
    "shop": "/shop/",
    "services": "/services/",
}


def _load_i18n_products() -> dict[str, dict[str, str]]:
    path = Path(__file__).resolve().parent / "data" / "default_translations.json"
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, dict[str, str]] = {}
    for lang in ("ckb", "ar", "en"):
        products = data.get(lang, {}).get("products", {})
        if isinstance(products, dict):
            out[lang] = {k: str(v) for k, v in products.items()}
    return out


def default_product_cards() -> list[dict]:
    titles_by_lang = _load_i18n_products()
    cards: list[dict] = []
    page_counters: dict[str, int] = {p: 0 for p in PAGES}
    for key, page, tag_key in _CATALOG:
        page_counters[page] += 1
        tone = TONE_CYCLE[(page_counters[page] - 1) % len(TONE_CYCLE)]
        title = {
            lang: titles_by_lang.get(lang, {}).get(key, key)
            for lang in ("ckb", "ar", "en")
        }
        tag = {}
        if tag_key:
            tag = {"key": tag_key}
        cards.append(
            {
                "page": page,
                "sort_order": page_counters[page] * 10,
                "title": title,
                "tag": tag,
                "tone": tone,
                "link_url": _LINKS[page],
                "is_published": True,
            }
        )
    return cards
