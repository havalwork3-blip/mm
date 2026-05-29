"""Inline CSS/JS into every landing page so styling works even if /css or /js are missing on the server."""
import pathlib

ROOT = pathlib.Path(__file__).parent
CSS = (ROOT / "css" / "main.css").read_text(encoding="utf-8")
JS = (ROOT / "js" / "site.js").read_text(encoding="utf-8")

CSS_BLOCK = f"\n  <style>\n{CSS}\n  </style>\n"
JS_BLOCK = f"\n  <script>\n{JS}\n  </script>\n"
CSS_LINK = '  <link rel="stylesheet" href="/css/main.css" />\n'
JS_LINK = '  <script src="/js/site.js"></script>\n'

for path in sorted(ROOT.rglob("index.html")):
    text = path.read_text(encoding="utf-8")

    if CSS_LINK in text:
        text = text.replace(CSS_LINK, CSS_BLOCK, 1)
    elif "<style>" not in text:
        text = text.replace("</head>", CSS_BLOCK + "</head>", 1)

    if JS_LINK in text:
        text = text.replace(JS_LINK, JS_BLOCK, 1)
    elif JS_BLOCK.strip() not in text:
        text = text.replace("</body>", JS_BLOCK + "</body>", 1)

    path.write_text(text, encoding="utf-8")
    print("inlined", path.relative_to(ROOT), "->", path.stat().st_size, "bytes")
