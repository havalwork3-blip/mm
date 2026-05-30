import json
from pathlib import Path

_DATA = Path(__file__).resolve().parent / "data" / "default_translations.json"

_DEFAULT_SECTIONS = {
    "hero": {"published": True},
    "features": {"published": True},
    "homeAbout": {"published": True},
    "explore": {"published": True},
    "luxury": {"published": True},
    "tech": {"published": True},
    "shop": {"published": True},
    "services": {"published": True},
    "about": {"published": True},
    "terms": {"published": True},
    "contact": {"published": True},
}


def default_translations() -> dict:
    if _DATA.exists():
        return json.loads(_DATA.read_text(encoding="utf-8"))
    return {"ckb": {}, "ar": {}, "en": {}}


def default_sections() -> dict:
    return {k: dict(v) for k, v in _DEFAULT_SECTIONS.items()}
