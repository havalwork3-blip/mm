"""Move subpages to flat *.html at web root and fix all internal links."""
import pathlib
import re

ROOT = pathlib.Path(__file__).parent

SUBPAGES = [
    "explore",
    "luxury",
    "tech",
    "shop",
    "services",
    "about",
    "terms",
    "contact",
]

LINK_MAP = {
    "/explore/": "/explore.html",
    "/luxury/": "/luxury.html",
    "/tech/": "/tech.html",
    "/shop/": "/shop.html",
    "/services/": "/services.html",
    "/about/": "/about.html",
    "/terms/": "/terms.html",
    "/contact/": "/contact.html",
}

def patch_links(text: str) -> str:
    for old, new in sorted(LINK_MAP.items(), key=lambda x: -len(x[0])):
        text = text.replace(f'href="{old}"', f'href="{new}"')
    return text

# Copy subfolder pages to flat files at root
for slug in SUBPAGES:
    src = ROOT / slug / "index.html"
    if not src.exists():
        print("SKIP missing", src)
        continue
    dst = ROOT / f"{slug}.html"
    dst.write_text(patch_links(src.read_text(encoding="utf-8")), encoding="utf-8")
    print("wrote", dst.name)

# Patch index.html and all flat pages
html_files = [ROOT / "index.html"] + [ROOT / f"{s}.html" for s in SUBPAGES]
for path in html_files:
    if not path.exists():
        continue
    text = patch_links(path.read_text(encoding="utf-8"))
    path.write_text(text, encoding="utf-8")
    print("patched links in", path.name)

# Patch site.js catalog
js_path = ROOT / "js" / "site.js"
if js_path.exists():
    js = js_path.read_text(encoding="utf-8")
    js = patch_links(js)
    js_path.write_text(js, encoding="utf-8")
    print("patched js/site.js")

# Re-inline JS into HTML if pages use inline scripts (sync catalog links)
js = (ROOT / "js" / "site.js").read_text(encoding="utf-8")
js_marker = "(function () {"
for path in html_files:
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    start = text.find("<script>\n" + js_marker)
    if start == -1:
        start = text.find("<script>\n(function () {")
    if start == -1:
        continue
    end = text.find("</script>", start)
    if end == -1:
        continue
    text = text[:start] + f"<script>\n{js}\n  </script>" + text[end + len("</script>"):]
    path.write_text(text, encoding="utf-8")
    print("refreshed inline js in", path.name)

print("Done.")
