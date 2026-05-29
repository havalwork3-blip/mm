"""Normalize all landing pages to root-relative asset paths."""
import pathlib
import re

ROOT = pathlib.Path(__file__).parent

for path in ROOT.rglob("index.html"):
    text = path.read_text(encoding="utf-8")
    text = re.sub(r'href="(?:\./|\../)+css/main\.css"', 'href="/css/main.css"', text)
    text = re.sub(r'src="(?:\./|\../)+logo-optimized\.webp"', 'src="/logo-optimized.webp"', text)
    text = re.sub(r'src="(?:\./|\../)+js/site\.js"', 'src="/js/site.js"', text)

    if "/js/site.js" not in text:
        text = text.rstrip() + "\n\n  <script src=\"/js/site.js\"></script>\n</body>\n</html>\n"

    path.write_text(text, encoding="utf-8")
    print("fixed", path.relative_to(ROOT))
