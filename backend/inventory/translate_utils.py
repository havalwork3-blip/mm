"""Free machine translation for category names — Google-quality, no API key."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

# Sorani Kurdish → Google uses ckb (much better than ku)
_LANG_TO_GOOGLE = {"ku": "ckb", "ar": "ar", "en": "en"}
_LANG_TO_LIBRE = {"ku": "ckb", "ar": "ar", "en": "en"}

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; MM-Inventory/1.0)",
    "Accept": "application/json,text/plain,*/*",
}

# Public Lingva mirrors (Google Translate proxy, no key)
_LINGVA_BASES = (
    "https://lingva.ml",
    "https://translate.plausibility.cloud",
    "https://lingva.garudalinux.org",
)

_BAD_MARKERS = (
    "MYMEMORY",
    "WARNING",
    "LIMIT",
    "==>",
    "QUERY LENGTH",
    "INVALID",
    "PLEASE CONTACT",
    "AUTO-GENERATED",
)

# Kurdish + Arabic script ranges (reject mixed garbage in EN output)
_SCRIPT_KU_AR = re.compile(r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]")


def _google_gtx(text: str, source: str, target: str) -> str | None:
    src = _LANG_TO_GOOGLE.get(source, source)
    tgt = _LANG_TO_GOOGLE.get(target, target)
    q = urllib.parse.quote(text)
    url = (
        "https://translate.googleapis.com/translate_a/single"
        f"?client=gtx&sl={src}&tl={tgt}&dt=t&q={q}"
    )
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError, IndexError, TypeError):
        return None
    try:
        parts = data[0]
        out = "".join(str(p[0]) for p in parts if p and p[0])
    except (IndexError, TypeError):
        return None
    return out.strip() or None


def _lingva(text: str, source: str, target: str) -> str | None:
    src = _LANG_TO_GOOGLE.get(source, source)
    tgt = _LANG_TO_GOOGLE.get(target, target)
    path_q = urllib.parse.quote(text, safe="")
    for base in _LINGVA_BASES:
        url = f"{base}/api/v1/{src}/{tgt}/{path_q}"
        req = urllib.request.Request(url, headers=_HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode())
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
            continue
        out = str(data.get("translation") or "").strip()
        if out:
            return out
    return None


def _libretranslate(text: str, source: str, target: str) -> str | None:
    src = _LANG_TO_LIBRE.get(source, source)
    tgt = _LANG_TO_LIBRE.get(target, target)
    body = json.dumps({"q": text, "source": src, "target": tgt, "format": "text"}).encode()
    for endpoint in (
        "https://libretranslate.com/translate",
        "https://translate.argosopentech.com/translate",
    ):
        req = urllib.request.Request(
            endpoint,
            data=body,
            headers={**_HEADERS, "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=14) as resp:
                data = json.loads(resp.read().decode())
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
            continue
        out = str(data.get("translatedText") or "").strip()
        if out:
            return out
    return None


def _accept_result(original: str, result: str, target: str) -> bool:
    if not result:
        return False
    upper = result.upper()
    if any(m in upper for m in _BAD_MARKERS):
        return False
    if result.strip().upper() == original.strip().upper():
        return False
    # Category names are short — reject huge noisy replies
    if len(result) > max(120, len(original) * 4):
        return False
    if target == "en":
        non_latin = len(_SCRIPT_KU_AR.findall(result))
        if non_latin > 2 and non_latin >= len(result) * 0.15:
            return False
    if target == "ar":
        arabic = len(_SCRIPT_KU_AR.findall(result))
        if len(original) < 100 and arabic < 1:
            return False
    return True


def translate_text(text: str, source: str, target: str) -> str:
    """Translate `text` from `source` to `target` (ku, ar, en). Raises on failure."""
    cleaned = (text or "").strip()
    if not cleaned:
        raise ValueError("Text is empty")
    if source == target:
        return cleaned

    providers = (_google_gtx, _lingva, _libretranslate)
    for fn in providers:
        try:
            result = fn(cleaned, source, target)
        except Exception:
            result = None
        if result and _accept_result(cleaned, result, target):
            return result.strip()

    raise RuntimeError(f"Could not translate to {target}")


def translate_ku_to_ar_en(text: str) -> dict[str, str]:
    """Translate Kurdish category name to Arabic and English in parallel (faster)."""
    cleaned = (text or "").strip()
    if not cleaned:
        raise ValueError("Text is empty")

    out: dict[str, str] = {}
    errors: list[str] = []

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {
            pool.submit(translate_text, cleaned, "ku", "ar"): "ar",
            pool.submit(translate_text, cleaned, "ku", "en"): "en",
        }
        for fut in as_completed(futures):
            lang = futures[fut]
            try:
                out[lang] = fut.result()
            except Exception as exc:
                errors.append(f"{lang}: {exc}")

    if "ar" not in out or "en" not in out:
        raise RuntimeError("; ".join(errors) if errors else "Translation failed")
    return out
