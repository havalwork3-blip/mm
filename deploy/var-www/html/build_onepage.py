"""Convert MM IRAQ marketing site to one-page (+ contact only)."""
from __future__ import annotations

import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).parent

# Old multi-page paths → one-page anchors (contact stays separate)
LINK_MAP = {
    "/explore.html": "#explore",
    "/luxury.html": "#luxury",
    "/tech.html": "#tech",
    "/shop.html": "#shop",
    "/services.html": "#services",
    "/about.html": "#about-preview",
    "/terms.html": "#terms",
    "/explore/": "#explore",
    "/luxury/": "#luxury",
    "/tech/": "#tech",
    "/shop/": "#shop",
    "/services/": "#services",
    "/about/": "#about-preview",
    "/terms/": "#terms",
    "#top": "#home",
}

REMOVE_PAGES = [
    "explore.html",
    "luxury.html",
    "tech.html",
    "shop.html",
    "services.html",
    "about.html",
    "terms.html",
    "explore",
    "luxury",
    "tech",
    "shop",
    "services",
    "about",
    "terms",
]


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def extract_main_body(html: str) -> str:
    m = re.search(r"<main id=\"top\"[^>]*>(.*?)</main>", html, re.S)
    if not m:
        raise SystemExit(f"No <main> in {html[:80]}")
    return m.group(1).strip()


def patch_links(content: str, *, home_prefix: str = "") -> str:
    """home_prefix: '' on index (#luxury); '/' on contact (/#luxury)."""
    for old, new in sorted(LINK_MAP.items(), key=lambda x: -len(x[0])):
        anchor = new if new.startswith("#") else new
        if home_prefix and anchor.startswith("#"):
            anchor = home_prefix + anchor
        content = content.replace(f'href="{old}"', f'href="{anchor}"')
    # Also rewrite bare section anchors when rebuilding contact
    if home_prefix:
        for slug in ("home", "explore", "luxury", "tech", "shop", "services", "about-preview", "terms"):
            content = content.replace(f'href="#{slug}"', f'href="{home_prefix}#{slug}"')
    content = content.replace(
        'class="hero-slide__cta" href="#shop"',
        'class="hero-slide__cta" href="https://shopping.mmiraq.com/"',
    )
    content = re.sub(
        r'\s*<a class="store-section__more"[^>]*>.*?</a>',
        "",
        content,
        flags=re.S,
    )
    content = re.sub(
        r'\s*<a class="home-about__cta"[^>]*>.*?</a>',
        "",
        content,
        flags=re.S,
    )
    content = re.sub(
        r'\s*<a class="explore-showcase__cta"[^>]*>.*?</a>',
        "",
        content,
        flags=re.S,
    )
    # Search catalog fallbacks in inline JS
    for slug in ("luxury", "tech", "shop", "services"):
        content = content.replace(f'href: "/{slug}/"', f'href: "#{slug}"')
    return content


def patch_shell(content: str, *, home_prefix: str = "") -> str:
    content = patch_links(content, home_prefix=home_prefix)
    content = re.sub(
        r'<a class="nav__link[^"]*" href="[^"]*about-preview[^"]*"><span data-i18n="nav\.more">[^<]*</span></a>',
        f'<a class="nav__link{" nav__link--active" if home_prefix else ""}" href="/contact/"><span data-i18n="footer.contact">پەیوەندی</span></a>',
        content,
    )
    if not home_prefix:
        content = re.sub(
            r'(<a class="nav__link" href="/contact/")',
            r'\1',
            content,
        )
    content = re.sub(
        r'\s*<a href="[^"]*about-preview[^"]*"[^>]*>.*?</a>',
        "",
        content,
        flags=re.S,
    )
    return content


def section_from(page: str, pattern: str) -> str:
    html = read(ROOT / page)
    body = extract_main_body(html)
    m = re.search(pattern, body, re.S)
    if not m:
        raise SystemExit(f"Pattern not found in {page}")
    return patch_links(m.group(0).strip())


def build_index() -> None:
    index_html = read(ROOT / "index.html")
    main_m = re.search(r"(<main id=\"top\"[^>]*>)(.*?)(</main>)", index_html, re.S)
    if not main_m:
        raise SystemExit("index.html: no main")

    home_body = main_m.group(2).strip()
    # Drop closing explore — we'll append store + terms after explore section
    explore_end = home_body.rfind("</section>")
    if explore_end == -1:
        raise SystemExit("index.html: no explore section")
    home_prefix = home_body[: explore_end + len("</section>")].strip()

    luxury = section_from(
        "luxury/index.html",
        r'<div class="store-main">.*?</div>\s*<a class="cinema cinema--a.*?</a>',
    )
    tech = section_from(
        "tech/index.html",
        r'<div class="store-main">.*?</div>\s*<a class="cinema cinema--b.*?</a>',
    )
    tech = tech.replace('href="#services"', 'href="#services"')
    shop = section_from(
        "shop/index.html",
        r'<div class="store-main">\s*<section class="store-section" id="shop">.*?</section>\s*</div>',
    )
    services = section_from(
        "services/index.html",
        r'<div class="store-main">\s*<section class="store-section" id="services">.*?</section>\s*</div>',
    )
    terms_body = extract_main_body(read(ROOT / "terms/index.html"))
    terms = patch_links(terms_body)

    merged_main = "\n\n    ".join(
        [home_prefix, luxury, tech, shop, services, terms]
    )

    out = index_html[: main_m.start(2)] + "\n    " + merged_main + "\n  " + index_html[main_m.end(2) :]
    out = patch_shell(out)
    (ROOT / "index.html").write_text(out, encoding="utf-8")
    print("Updated index.html (one-page)")


def build_contact() -> None:
    src = ROOT / "contact" / "index.html"
    if not src.exists():
        src = ROOT / "contact.html"
    html = read(src)
    html = patch_shell(html, home_prefix="/")
    html = re.sub(
        r'(<a class="nav__link" href="/contact/")',
        r'<a class="nav__link nav__link--active" href="/contact/"',
        html,
        count=1,
    )
    html = html.replace('data-page="contact"', 'data-page="contact"')
    (ROOT / "contact.html").write_text(html, encoding="utf-8")
    (ROOT / "contact" / "index.html").write_text(html, encoding="utf-8")
    print("Updated contact.html + contact/index.html")


def remove_old_pages() -> None:
    for name in REMOVE_PAGES:
        path = ROOT / name
        if path.is_dir():
            shutil.rmtree(path)
            print("Removed dir", name)
        elif path.is_file():
            path.unlink()
            print("Removed file", name)


def main() -> None:
    build_index()
    build_contact()
    remove_old_pages()
    print("Done — site is now one-page + contact.")


if __name__ == "__main__":
    main()
