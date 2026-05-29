"""Split monolithic landing page into multi-page static site."""
import re
import subprocess
import pathlib

ROOT = pathlib.Path(__file__).parent
REPO = ROOT.parents[2]

def load_source_html() -> str:
    blob = subprocess.check_output(
        ["git", "-C", str(REPO), "show", "HEAD:deploy/var-www/html/index.html"],
    )
    return blob.decode("utf-8")

html = load_source_html()

css_m = re.search(r"<style>(.*?)</style>", html, re.S)
js_m = re.search(r"<script>\s*\(function \(\) \{(.*?)\}\)\(\);\s*</script>", html, re.S)
if not css_m or not js_m:
    raise SystemExit("Could not extract CSS/JS")

(ROOT / "css").mkdir(exist_ok=True)
(ROOT / "js").mkdir(exist_ok=True)
css_content = css_m.group(1).strip()
js_content = "(function () {" + js_m.group(1) + "})();"
(ROOT / "css" / "main.css").write_text(css_content, encoding="utf-8")
(ROOT / "js" / "site.js").write_text(js_content, encoding="utf-8")

shell_m = re.search(
    r"(<header class=\"site-header\">.*?</header>\s*"
    r"<div class=\"sidebar-overlay\".*?</div>\s*"
    r"<div class=\"search-panel\".*?</div>)\s*<main",
    html,
    re.S,
)
footer_m = re.search(
    r"(<footer class=\"site-footer\">.*?<div class=\"float-actions\">.*?</div>\s*</div>)\s*<script>",
    html,
    re.S,
)
main_m = re.search(r"<main id=\"top\">(.*)</main>", html, re.S)
if not all([shell_m, footer_m, main_m]):
    raise SystemExit("Could not extract page shell")

main_content = main_m.group(1)

def extract(pattern):
    m = re.search(pattern, main_content, re.S)
    return m.group(0).strip() if m else ""

hero = extract(
    r'<section class="hero-carousel" id="home".*?'
    r'<div class="hero-dots" id="heroDots">.*?</div>\s*</section>'
)
brands = extract(r'<div class="brands">.*?</div>\s*</div>')
explore = extract(r'<section class="explore-showcase".*?</section>')
luxury_block = extract(
    r'<div class="store-main">\s*<section class="store-section" id="luxury">.*?</section>\s*</div>\s*'
    r'<a class="cinema cinema--a.*?</a>'
)
tech_block = extract(
    r'<div class="store-main">\s*<section class="store-section" id="tech">.*?</section>\s*</div>\s*'
    r'<a class="cinema cinema--b.*?</a>'
)
shop = extract(r'<section class="store-section" id="shop">.*?</section>')
services = extract(r'<section class="store-section" id="services">.*?</section>')
features = extract(r'<div class="features">[\s\S]*?</div>\s*\n\s*</div>')
about = extract(r'<section class="info-page reveal" id="about".*?</section>')
terms = extract(r'<section class="info-page reveal" id="terms".*?</section>')
contact = extract(r'<section class="info-page reveal" id="contact".*?</section>')

LINK_MAP = {
    "#top": "/",
    "#home": "/",
    "#explore": "/explore.html",
    "#luxury": "/luxury.html",
    "#tech": "/tech.html",
    "#shop": "/shop.html",
    "#services": "/services.html",
    "#about": "/about.html",
    "#terms": "/terms.html",
    "#contact": "/contact.html",
    "/explore/": "/explore.html",
    "/luxury/": "/luxury.html",
    "/tech/": "/tech.html",
    "/shop/": "/shop.html",
    "/services/": "/services.html",
    "/about/": "/about.html",
    "/terms/": "/terms.html",
    "/contact/": "/contact.html",
}

NAV_PAGES = {
    "luxury": "luxury",
    "explore": "explore",
    "tech": "tech",
    "shop": "shop",
    "services": "services",
    "about": "about",
}

DOCK_BY_PAGE = {
    "home": "home",
    "explore": "grid",
    "luxury": "fav",
    "tech": "fav",
    "shop": "bookmark",
    "services": "bookmark",
    "about": "home",
    "terms": "home",
    "contact": "home",
}

PAGES = {
    "index.html": {
        "title": "MM IRAQ — فرۆشگای ئێکسسوارات",
        "desc": "MM IRAQ — فرۆشگای ئێکسسواراتی لوکس، تەکنەلۆژیا، و خزمەتگوزاری پێشکەوتوو",
        "body": "\n\n    ".join(filter(None, [hero, brands, features])),
        "page": "home",
    },
    "explore.html": {
        "title": "گەڕان — MM IRAQ",
        "desc": "زیاتر لە MM IRAQ بگەڕێ",
        "body": explore,
        "page": "explore",
    },
    "luxury.html": {
        "title": "ئێکسسواراتی لوکس — MM IRAQ",
        "desc": "هەڵبژاردەی دەستچێن و ستایلی premium",
        "body": luxury_block,
        "page": "luxury",
    },
    "tech.html": {
        "title": "تەکنەلۆژیا — MM IRAQ",
        "desc": "ئامێر و تەکنەلۆژیا",
        "body": tech_block,
        "page": "tech",
    },
    "shop.html": {
        "title": "شۆپ — MM IRAQ",
        "desc": "شۆپ و کۆگای زیرەک",
        "body": f'<div class="store-main">\n    {shop}\n    </div>' if shop else "",
        "page": "shop",
    },
    "services.html": {
        "title": "خزمەتگوزاری — MM IRAQ",
        "desc": "لۆجستیک، AI، و پشتیوانی",
        "body": f'<div class="store-main">\n    {services}\n    </div>' if services else "",
        "page": "services",
    },
    "about.html": {
        "title": "دەربارە — MM IRAQ",
        "desc": "دەربارەی MM IRAQ",
        "body": f'<div class="info-pages">\n      {about}\n    </div>' if about else "",
        "page": "about",
    },
    "terms.html": {
        "title": "مەرج و ڕێساکان — MM IRAQ",
        "desc": "مەرج و ڕێساکانی بەکارهێنان",
        "body": f'<div class="info-pages">\n      {terms}\n    </div>' if terms else "",
        "page": "terms",
    },
    "contact.html": {
        "title": "پەیوەندی — MM IRAQ",
        "desc": "پەیوەندیمان پێوە بکە",
        "body": f'<div class="info-pages">\n      {contact}\n    </div>' if contact else "",
        "page": "contact",
    },
}

def patch_links(content: str) -> str:
    for old, new in sorted(LINK_MAP.items(), key=lambda x: -len(x[0])):
        content = content.replace(f'href="{old}"', f'href="{new}"')
    return content

def clean_logo(content: str, logo_src: str) -> str:
    content = re.sub(
        r'<img class="logo-img header-logo"[^>]+>',
        f'<img class="logo-img header-logo" src="{logo_src}" alt="MM IRAQ" width="184" height="184" decoding="async" fetchpriority="high" />',
        content,
        count=1,
    )
    return content

def patch_shell(shell: str, active_page: str, depth: int) -> str:
    s = patch_links(shell)
    s = clean_logo(s, "/logo-optimized.webp")
    s = re.sub(r'\snav__link--active', " nav__link", s)
    for slug in NAV_PAGES:
        needle = f'href="/{slug}/"'
        if slug == active_page:
            s = s.replace(
                f'<a class="nav__link" {needle}',
                f'<a class="nav__link nav__link--active" {needle}',
                1,
            )
    return s

def patch_footer(footer: str, active_page: str, depth: int) -> str:
    f = patch_links(footer)
    dock = DOCK_BY_PAGE.get(active_page, "home")
    f = re.sub(r'class="float-dock__btn is-active"', 'class="float-dock__btn"', f)
    f = re.sub(
        rf'(<a class="float-dock__btn"[^>]+data-dock="{dock}"[^>]*>)',
        lambda m: m.group(1).replace('class="float-dock__btn"', 'class="float-dock__btn is-active"', 1),
        f,
        count=1,
    )
    if not f.rstrip().endswith("</html>"):
        f = f.rstrip() + "\n"
    else:
        f = re.sub(r"\s*<script[^>]*>.*?</script>\s*</body>", "\n", f, flags=re.S)
        f = re.sub(r"</body>\s*</html>\s*$", "", f)
    return f.rstrip()

shell_template = patch_links(shell_m.group(1))
footer_template = patch_links(footer_m.group(1))

for rel_path, meta in PAGES.items():
    if not meta["body"]:
        print("SKIP empty body:", rel_path)
        continue
    shell = patch_shell(shell_template, meta["page"], 0)
    footer = patch_footer(footer_template, meta["page"], 0)
    body = patch_links(meta["body"])

    page_html = f"""<!DOCTYPE html>
<html lang="ckb" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="{meta['desc']}" />
  <title>{meta['title']}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
{css_content}
  </style>
</head>
<body>
  <div class="page-bg" aria-hidden="true"></div>
  <div class="wrap">

{shell}

  <main id="top" data-page="{meta['page']}">
    {body}
  </main>

{footer}

  <script>
{js_content}
  </script>
</body>
</html>
"""
    out = ROOT / rel_path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page_html, encoding="utf-8")
    print("Wrote", rel_path)

print("Done.")
