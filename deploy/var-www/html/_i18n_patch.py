# -*- coding: utf-8 -*-
"""Add data-i18n attributes and sync inline CSS/JS to all landing pages."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CSS = (ROOT / "css" / "main.css").read_text(encoding="utf-8")
I18N = (ROOT / "js" / "i18n.js").read_text(encoding="utf-8")
SITE = (ROOT / "js" / "site.js").read_text(encoding="utf-8")
JS_BUNDLE = I18N + "\n" + SITE

REPLACEMENTS = [
    ('<nav class="nav" id="mainNav" aria-label="ناڤیگەیشن">',
     '<nav class="nav" id="mainNav" data-i18n-aria="ui.navAria">'),
    ('<span class="nav__sidebar-title">مێنیو</span>',
     '<span class="nav__sidebar-title" data-i18n="ui.menu">مێنیو</span>'),
    ('id="menuClose" aria-label="داخستن"',
     'id="menuClose" data-i18n-aria="ui.close"'),
    ('href="/luxury/">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>\n          ئێکسسوارات',
     'href="/luxury/">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>\n          <span data-i18n="nav.luxury">ئێکسسوارات</span>'),
    ('href="/explore/">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>\n          گەڕان',
     'href="/explore/">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>\n          <span data-i18n="nav.explore">گەڕان</span>'),
    ('href="/tech/">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>\n          تەکنەلۆژیا',
     'href="/tech/">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>\n          <span data-i18n="nav.tech">تەکنەلۆژیا</span>'),
    ('href="/shop/">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>\n          شۆپی ئۆنلاین',
     'href="/shop/">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>\n          <span data-i18n="nav.shop">شۆپی ئۆنلاین</span>'),
    ('href="/services/">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>\n          خزمەتگوزاری',
     'href="/services/">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>\n          <span data-i18n="nav.services">خزمەتگوزاری</span>'),
    ('<a class="nav__link" href="/about/">زیاتر</a>',
     '<a class="nav__link" href="/about/"><span data-i18n="nav.more">زیاتر</span></a>'),
    ('<a class="nav__link nav__link--active" href="/about/">زیاتر</a>',
     '<a class="nav__link nav__link--active" href="/about/"><span data-i18n="nav.more">زیاتر</span></a>'),
    ('class="nav__sidebar-shop shop-cta" href="https://shopping.mmiraq.com/">ئێستا بازاری بکە',
     'class="nav__sidebar-shop shop-cta" href="https://shopping.mmiraq.com/" data-i18n="ui.shopCta">ئێستا بازاری بکە'),
    ('class="shop-cta" href="https://shopping.mmiraq.com/">ئێستا بازاری بکە',
     'class="shop-cta" href="https://shopping.mmiraq.com/" data-i18n="ui.shopCta">ئێستا بازاری بکە'),
    ('id="searchOpen" aria-label="گەڕان"',
     'id="searchOpen" data-i18n-aria="ui.search"'),
    ('id="langToggle" aria-label="گۆڕینی زمان"',
     'id="langToggle" data-i18n-aria="ui.langSwitch"'),
    ('id="menuToggle" aria-label="مێنیو"',
     'id="menuToggle" data-i18n-aria="ui.menu"'),
    ('id="searchPanel" role="dialog" aria-modal="true" aria-label="گەڕان"',
     'id="searchPanel" role="dialog" aria-modal="true" data-i18n-aria="search.aria"'),
    ('id="searchInput" placeholder="ناوی کاڵا بنووسە..."',
     'id="searchInput" data-i18n-placeholder="search.placeholder" placeholder="ناوی کاڵا بنووسە..."'),
    ('id="searchClose" aria-label="داخستن"',
     'id="searchClose" data-i18n-aria="ui.close"'),
    ('<p class="search-panel__hint">ناوی کاڵا بنووسە — وێنە و پێشنیاری نزیک پیشان دەدرێت</p>',
     '<p class="search-panel__hint" data-i18n="search.hint">ناوی کاڵا بنووسە — وێنە و پێشنیاری نزیک پیشان دەدرێت</p>'),
    ('<p class="site-footer__tagline">فرۆشگای ئێکسسواراتی مۆدێرن — لوکس، تەکنەلۆژیا، و خزمەتگوزاری لە یەک شوێن.</p>',
     '<p class="site-footer__tagline" data-i18n="footer.tagline">فرۆشگای ئێکسسواراتی مۆدێرن — لوکس، تەکنەلۆژیا، و خزمەتگوزاری لە یەک شوێن.</p>'),
    ('<nav aria-label="گەڕان">\n          <p class="site-footer__heading">بەشەکان</p>',
     '<nav aria-label="sections">\n          <p class="site-footer__heading" data-i18n="footer.sections">بەشەکان</p>'),
    ('<a href="/luxury/">ئێکسسوارات</a>\n            <a href="/shop/">فرۆشگا</a>\n            <a href="/tech/">تەکنەلۆژیا</a>\n            <a href="/shop/">شۆپ</a>\n            <a href="/services/">خزمەتگوزاری</a>',
     '<a href="/luxury/" data-i18n="nav.luxury">ئێکسسوارات</a>\n            <a href="/shop/" data-i18n="footer.store">فرۆشگا</a>\n            <a href="/tech/" data-i18n="nav.tech">تەکنەلۆژیا</a>\n            <a href="/shop/" data-i18n="footer.shopShort">شۆپ</a>\n            <a href="/services/" data-i18n="nav.services">خزمەتگوزاری</a>'),
    ('<nav aria-label="یارمەتی">\n          <p class="site-footer__heading">یارمەتی</p>',
     '<nav aria-label="help">\n          <p class="site-footer__heading" data-i18n="footer.help">یارمەتی</p>'),
    ('<a href="/contact/">پەیوەندی</a>\n            <a href="/about/">دەربارە</a>\n            <a href="/terms/">مەرج و ڕێساکان</a>',
     '<a href="/contact/" data-i18n="footer.contact">پەیوەندی</a>\n            <a href="/about/" data-i18n="footer.about">دەربارە</a>\n            <a href="/terms/" data-i18n="footer.terms">مەرج و ڕێساکان</a>'),
    ('<p class="site-footer__heading">تۆڕە کۆمەڵایەتییەکان</p>',
     '<p class="site-footer__heading" data-i18n="footer.social">تۆڕە کۆمەڵایەتییەکان</p>'),
    ('<p>&copy; 2026 MM IRAQ. هەموو مافەکان پارێزراون.</p>',
     '<p data-i18n="footer.copy">&copy; 2026 MM IRAQ. هەموو مافەکان پارێزراون.</p>'),
    ('<p>ئێکسسوارات &middot; تەکنەلۆژیا &middot; عێراق</p>',
     '<p data-i18n="footer.line2">ئێکسسوارات &middot; تەکنەلۆژیا &middot; عێراق</p>'),
    ('id="floatDock" aria-label="ناڤیگەیشنی خێرا"',
     'id="floatDock" data-i18n-aria="ui.navAria"'),
    ('data-dock="home" aria-label="سەرەوە"',
     'data-dock="home" data-i18n-aria="ui.dockHome"'),
    ('data-dock="grid" aria-label="گەڕان"',
     'data-dock="grid" data-i18n-aria="ui.dockExplore"'),
    ('data-dock="fav" aria-label="دڵخواز"',
     'data-dock="fav" data-i18n-aria="ui.dockFav"'),
    ('data-dock="bookmark" aria-label="فرۆشگا"',
     'data-dock="bookmark" data-i18n-aria="ui.dockShop"'),
    ('id="dockSearch" aria-label="گەڕان"',
     'id="dockSearch" data-i18n-aria="ui.search"'),
    ('id="backTop" aria-label="گەڕانەوە بۆ سەرەوە"',
     'id="backTop" data-i18n-aria="ui.backTop"'),
    ('href="/contact/" aria-label="پەیاممان بنێرە"',
     'href="/contact/" data-i18n-aria="ui.chat"'),
    ('<span>پەیاممان بنێرە</span>',
     '<span data-i18n="ui.chat">پەیاممان بنێرە</span>'),
    # Home page
    ('<section class="hero-carousel" id="home" aria-label="بانێری سەرەکی">',
     '<section class="hero-carousel" id="home" data-i18n-aria="hero.aria">'),
    ('<h1 class="hero-slide__title">ئێکسسواراتی <span>لوکس و مۆدێرن</span></h1>',
     '<h1 class="hero-slide__title" data-i18n="hero.h1" data-i18n-html="1">ئێکسسواراتی <span>لوکس و مۆدێرن</span></h1>'),
    ('<p class="hero-slide__sub">کۆمەڵێک بەرهەمی premium بۆ ستایلی ژیانت — کوالیتی بەرز، دیزاینی جوان.</p>\n          <a class="hero-slide__cta" href="/shop/">ئێستا بازاری بکە</a>',
     '<p class="hero-slide__sub" data-i18n="hero.h1sub">کۆمەڵێک بەرهەمی premium بۆ ستایلی ژیانت — کوالیتی بەرز، دیزاینی جوان.</p>\n          <a class="hero-slide__cta" href="/shop/" data-i18n="cta.shop">ئێستا بازاری بکە</a>'),
    ('<h2 class="hero-slide__title">شۆپی <span>زیرەک MM IRAQ</span></h2>',
     '<h2 class="hero-slide__title" data-i18n="hero.h2" data-i18n-html="1">شۆپی <span>زیرەک MM IRAQ</span></h2>'),
    ('<p class="hero-slide__sub">فرۆشگای ئۆنلاینی RTL، کۆگا، و بەڕێوەبردنی بەرهەم لە یەک پلاتفۆرم.</p>\n          <a class="hero-slide__cta" href="/explore/">زیاتر بزانە</a>',
     '<p class="hero-slide__sub" data-i18n="hero.h2sub">فرۆشگای ئۆنلاینی RTL، کۆگا، و بەڕێوەبردنی بەرهەم لە یەک پلاتفۆرم.</p>\n          <a class="hero-slide__cta" href="/explore/" data-i18n="cta.learn">زیاتر بزانە</a>'),
    ('<h2 class="hero-slide__title">گەیاندنی <span>خێرا و متمانەپێکراو</span></h2>',
     '<h2 class="hero-slide__title" data-i18n="hero.h3" data-i18n-html="1">گەیاندنی <span>خێرا و متمانەپێکراو</span></h2>'),
    ('<p class="hero-slide__sub">لۆجستیکی پێشکەوتوو و چاودێری کاتی ڕاستەقینە بۆ هەموو داواکارییەک.</p>\n          <a class="hero-slide__cta" href="/services/">دەست پێ بکە</a>',
     '<p class="hero-slide__sub" data-i18n="hero.h3sub">لۆجستیکی پێشکەوتوو و چاودێری کاتی ڕاستەقینە بۆ هەموو داواکارییەک.</p>\n          <a class="hero-slide__cta" href="/services/" data-i18n="cta.start">دەست پێ بکە</a>'),
    ('id="heroPrev" aria-label="پێشوو"', 'id="heroPrev" data-i18n-aria="hero.prev"'),
    ('id="heroNext" aria-label="دواتر"', 'id="heroNext" data-i18n-aria="hero.next"'),
    ('data-go="0" aria-label="سلاید ١"', 'data-go="0" data-i18n-aria="hero.s1"'),
    ('data-go="1" aria-label="سلاید ٢"', 'data-go="1" data-i18n-aria="hero.s2"'),
    ('data-go="2" aria-label="سلاید ٣"', 'data-go="2" data-i18n-aria="hero.s3"'),
    ('<p class="feature__title">گەیاندنی خێرا</p>\n        <p class="feature__desc">گەیاندن بۆ هەموو عێراق</p>',
     '<p class="feature__title" data-i18n="feat.d1">گەیاندنی خێرا</p>\n        <p class="feature__desc" data-i18n="feat.d1s">گەیاندن بۆ هەموو عێراق</p>'),
    ('<p class="feature__title">کوالیتی premium</p>\n        <p class="feature__desc">بەرهەمی ڕەسەن و متمانەپێکراو</p>',
     '<p class="feature__title" data-i18n="feat.q1">کوالیتی premium</p>\n        <p class="feature__desc" data-i18n="feat.q1s">بەرهەمی ڕەسەن و متمانەپێکراو</p>'),
    ('<p class="feature__title">پشتیوانی ٢٤/٧</p>\n        <p class="feature__desc">لە تێلیگرام و تەلەفۆن</p>',
     '<p class="feature__title" data-i18n="feat.s1">پشتیوانی ٢٤/٧</p>\n        <p class="feature__desc" data-i18n="feat.s1s">لە تێلیگرام و تەلەفۆن</p>'),
    ('<p class="feature__title">پارەدانێکی سەلامەت</p>\n        <p class="feature__desc">COD و گەڕانەوەی ئاسان</p>',
     '<p class="feature__title" data-i18n="feat.p1">پارەدانێکی سەلامەت</p>\n        <p class="feature__desc" data-i18n="feat.p1s">COD و گەڕانەوەی ئاسان</p>'),
    ('<span class="info-page__label">ئێمە کێین</span>',
     '<span class="info-page__label" data-i18n="homeAbout.label">ئێمە کێین</span>'),
    ('id="home-about-title">بەخێربێیت بۆ جیهانی MM IRAQ</h2>',
     'id="home-about-title" data-i18n="homeAbout.title">بەخێربێیت بۆ جیهانی MM IRAQ</h2>'),
    ('<p class="info-page__lead">لەم پێڕستەدا لوکس، تەکنەلۆژیا، و خزمەتگوزاری لە یەک ئەزموونی تەواودا کۆدەکرێنەوە',
     '<p class="info-page__lead" data-i18n="homeAbout.lead">لەم پێڕستەدا لوکس، تەکنەلۆژیا، و خزمەتگوزاری لە یەک ئەزموونی تەواودا کۆدەکرێنەوە'),
    ('class="home-about__cta" href="/about/">زیاتر دەربارەمان بزانە ←</a>',
     'class="home-about__cta" href="/about/" data-i18n="cta.aboutMore">زیاتر دەربارەمان بزانە ←</a>'),
    ('<p class="home-about__card-title">کۆمەڵێک هەڵبژاردە</p>\n            <p class="home-about__card-desc">ئێکسسواراتی لوکس',
     '<p class="home-about__card-title" data-i18n="homeAbout.c1t">کۆمەڵێک هەڵبژاردە</p>\n            <p class="home-about__card-desc" data-i18n="homeAbout.c1d">ئێکسسواراتی لوکس'),
    ('<p class="home-about__card-title">دروستکراو بۆ عێراق</p>\n            <p class="home-about__card-desc">گەیاندن، پشتیوانی RTL',
     '<p class="home-about__card-title" data-i18n="homeAbout.c2t">دروستکراو بۆ عێراق</p>\n            <p class="home-about__card-desc" data-i18n="homeAbout.c2d">گەیاندن، پشتیوانی RTL'),
    ('<p class="home-about__card-title">زیرەک و خێرا</p>\n            <p class="home-about__card-desc">کۆگای ئۆتۆمات',
     '<p class="home-about__card-title" data-i18n="homeAbout.c3t">زیرەک و خێرا</p>\n            <p class="home-about__card-desc" data-i18n="homeAbout.c3d">کۆگای ئۆتۆمات'),
    ('id="explore-title">زیاتر لە MM IRAQ بگەڕێ</h2>',
     'id="explore-title" data-i18n="explore.title">زیاتر لە MM IRAQ بگەڕێ</h2>'),
    ('class="explore-showcase__cta" href="/explore/">ئێستا بگەڕێ</a>',
     'class="explore-showcase__cta" href="/explore/" data-i18n="cta.explore">ئێستا بگەڕێ</a>'),
    # Store sections
    ('<h2 class="store-section__title">ئێکسسواراتی لوکس</h2>\n          <p class="store-section__sub">هەڵبژاردەی دەستچێن و ستایلی premium</p>',
     '<h2 class="store-section__title" data-i18n="luxury.title">ئێکسسواراتی لوکس</h2>\n          <p class="store-section__sub" data-i18n="luxury.sub">هەڵبژاردەی دەستچێن و ستایلی premium</p>'),
    ('<h2 class="store-section__title">ئامێر و تەکنەلۆژیا</h2>\n          <p class="store-section__sub">هێدسێت، ماوس، کیبۆرد، و زیاتر</p>',
     '<h2 class="store-section__title" data-i18n="tech.title">ئامێر و تەکنەلۆژیا</h2>\n          <p class="store-section__sub" data-i18n="tech.sub">هێدسێت، ماوس، کیبۆرد، و زیاتر</p>'),
    ('<h2 class="store-section__title">شۆپ و کۆگای زیرەک</h2>\n          <p class="store-section__sub">پلاتفۆرمی فرۆشتن و بەڕێوەبردن</p>',
     '<h2 class="store-section__title" data-i18n="shop.title">شۆپ و کۆگای زیرەک</h2>\n          <p class="store-section__sub" data-i18n="shop.sub">پلاتفۆرمی فرۆشتن و بەڕێوەبردن</p>'),
    ('<h2 class="store-section__title">خزمەتگوزارییەکان</h2>\n          <p class="store-section__sub">لۆجستیک، AI، و پشتیوانی</p>',
     '<h2 class="store-section__title" data-i18n="services.title">خزمەتگوزارییەکان</h2>\n          <p class="store-section__sub" data-i18n="services.sub">لۆجستیک، AI، و پشتیوانی</p>'),
    ('class="store-section__more" href="/luxury/">هەمووی ببینە ←</a>',
     'class="store-section__more" href="/luxury/" data-i18n="ui.seeAll">هەمووی ببینە ←</a>'),
    ('class="store-section__more" href="/tech/">هەمووی ببینە ←</a>',
     'class="store-section__more" href="/tech/" data-i18n="ui.seeAll">هەمووی ببینە ←</a>'),
    ('class="store-section__more" href="/shop/">هەمووی ببینە ←</a>',
     'class="store-section__more" href="/shop/" data-i18n="ui.seeAll">هەمووی ببینە ←</a>'),
    ('class="store-section__more" href="/services/">هەمووی ببینە ←</a>',
     'class="store-section__more" href="/services/" data-i18n="ui.seeAll">هەمووی ببینە ←</a>'),
    ('<h3 class="product-card__name">کڵاوی چەرم Premium</h3>', '<h3 class="product-card__name" data-i18n="products.p1">کڵاوی چەرم Premium</h3>'),
    ('<h3 class="product-card__name">کەمی چوارینە لوکس</h3>', '<h3 class="product-card__name" data-i18n="products.p2">کەمی چوارینە لوکس</h3>'),
    ('<h3 class="product-card__name">ساعەتی زیرەک MM Edition</h3>', '<h3 class="product-card__name" data-i18n="products.p3">ساعەتی زیرەک MM Edition</h3>'),
    ('<h3 class="product-card__name">جانتای دەستی دیزاین</h3>', '<h3 class="product-card__name" data-i18n="products.p4">جانتای دەستی دیزاین</h3>'),
    ('<h3 class="product-card__name">هێدسێت گەیمینگ Pro</h3>', '<h3 class="product-card__name" data-i18n="products.p5">هێدسێت گەیمینگ Pro</h3>'),
    ('<h3 class="product-card__name">ماوس RGB Wireless</h3>', '<h3 class="product-card__name" data-i18n="products.p6">ماوس RGB Wireless</h3>'),
    ('<h3 class="product-card__name">کیبۆرد Mechanical</h3>', '<h3 class="product-card__name" data-i18n="products.p7">کیبۆرد Mechanical</h3>'),
    ('<h3 class="product-card__name">Webcam 4K Stream</h3>', '<h3 class="product-card__name" data-i18n="products.p8">Webcam 4K Stream</h3>'),
    ('<h3 class="product-card__name">پلاتفۆرمی شۆپی RTL</h3>', '<h3 class="product-card__name" data-i18n="products.p9">پلاتفۆرمی شۆپی RTL</h3>'),
    ('<h3 class="product-card__name">داشبۆردی کۆگا</h3>', '<h3 class="product-card__name" data-i18n="products.p10">داشبۆردی کۆگا</h3>'),
    ('<h3 class="product-card__name">بەڕێوەبردنی بەرهەم</h3>', '<h3 class="product-card__name" data-i18n="products.p11">بەڕێوەبردنی بەرهەم</h3>'),
    ('<h3 class="product-card__name">ئامار و ڕاپۆرت</h3>', '<h3 class="product-card__name" data-i18n="products.p12">ئامار و ڕاپۆرت</h3>'),
    ('<h3 class="product-card__name">ڕاپۆرتی تێلیگرام</h3>', '<h3 class="product-card__name" data-i18n="products.p13">ڕاپۆرتی تێلیگرام</h3>'),
    ('<h3 class="product-card__name">گەیاندنی خێرا</h3>', '<h3 class="product-card__name" data-i18n="products.p14">گەیاندنی خێرا</h3>'),
    ('<h3 class="product-card__name">پشتیوانی کڕیار</h3>', '<h3 class="product-card__name" data-i18n="products.p15">پشتیوانی کڕیار</h3>'),
    ('<h3 class="product-card__name">چارەسەری تایبەت</h3>', '<h3 class="product-card__name" data-i18n="products.p16">چارەسەری تایبەت</h3>'),
    ('<h2 class="cinema__title">کۆڵێکشنێکی نوێ — وەرزی ٢٠٢٦</h2>\n        <p class="cinema__sub">دیزاینی تایبەت MM IRAQ',
     '<h2 class="cinema__title" data-i18n="luxury.cinemaT">کۆڵێکشنێکی نوێ — وەرزی ٢٠٢٦</h2>\n        <p class="cinema__sub" data-i18n="luxury.cinemaS">دیزاینی تایبەت MM IRAQ'),
    ('href="/luxury/" aria-label="کۆڵێکشنێکی نوێ"',
     'href="/luxury/" data-i18n-aria="luxury.cinemaA"'),
    ('<h2 class="cinema__title">تەکنەلۆژیا + بازرگانی</h2>\n        <p class="cinema__sub">ڕاپۆرتی خۆکاری تێلیگرام',
     '<h2 class="cinema__title" data-i18n="tech.cinemaT">تەکنەلۆژیا + بازرگانی</h2>\n        <p class="cinema__sub" data-i18n="tech.cinemaS">ڕاپۆرتی خۆکاری تێلیگرام'),
    ('href="/services/" aria-label="تەکنەلۆژیا و بازرگانی"',
     'href="/services/" data-i18n-aria="tech.cinemaA"'),
    # Explore standalone page CTA (links to luxury)
    ('<a class="explore-showcase__cta" href="/luxury/">ئێستا بگەڕێ</a>',
     '<a class="explore-showcase__cta" href="/luxury/" data-i18n="cta.explore">ئێستا بگەڕێ</a>'),
    # About page
    ('<span class="info-page__label">دەربارە</span>',
     '<span class="info-page__label" data-i18n="about.label">دەربارە</span>'),
    ('id="about-title">دەربارەی MM IRAQ</h2>',
     'id="about-title" data-i18n="about.title">دەربارەی MM IRAQ</h2>'),
    ('<p class="info-page__lead">MM IRAQ ناوەندێکی مۆدێرنە',
     '<p class="info-page__lead" data-i18n="about.lead">MM IRAQ ناوەندێکی مۆدێرنە'),
    ('<li>ئێکسسواراتی لوکس و مۆدێرن بۆ کڕیارانی جیاواز</li>',
     '<li data-i18n="about.l1">ئێکسسواراتی لوکس و مۆدێرن بۆ کڕیارانی جیاواز</li>'),
    ('<li>فرۆشگای ئۆنلاینی RTL و سیستەمی کۆگای زیرەک</li>',
     '<li data-i18n="about.l2">فرۆشگای ئۆنلاینی RTL و سیستەمی کۆگای زیرەک</li>'),
    ('<li>ڕاپۆرتی خۆکاری تێلیگرام و چارەسەری بازرگانی</li>',
     '<li data-i18n="about.l3">ڕاپۆرتی خۆکاری تێلیگرام و چارەسەری بازرگانی</li>'),
    ('<li>گەیاندنی خێرا و پشتیوانی بەردەوام</li>',
     '<li data-i18n="about.l4">گەیاندنی خێرا و پشتیوانی بەردەوام</li>'),
    ('<span class="info-stat__txt">بەرهەمی جیاواز</span>', '<span class="info-stat__txt" data-i18n="about.st1t">بەرهەمی جیاواز</span>'),
    ('<span class="info-stat__txt">پشتیوانی</span>', '<span class="info-stat__txt" data-i18n="about.st2t">پشتیوانی</span>'),
    ('<span class="info-stat__txt">گەیاندن بۆ عێراق</span>', '<span class="info-stat__txt" data-i18n="about.st3t">گەیاندن بۆ عێراق</span>'),
    # Terms
    ('<span class="info-page__label">مەرج و ڕێساکان</span>',
     '<span class="info-page__label" data-i18n="terms.label">مەرج و ڕێساکان</span>'),
    ('id="terms-title">مەرج و ڕێساکانی بەکارهێنان</h2>',
     'id="terms-title" data-i18n="terms.title">مەرج و ڕێساکانی بەکارهێنان</h2>'),
    ('<p class="info-page__lead">بە بەکارهێنانی ماڵپەڕ',
     '<p class="info-page__lead" data-i18n="terms.lead">بە بەکارهێنانی ماڵپەڕ'),
    ('<li>هەموو نرخ و بەردەستی بەرهەمەکان', '<li data-i18n="terms.l1">هەموو نرخ و بەردەستی بەرهەمەکان'),
    ('<li>داواکارییەکان دوای پشتڕاستکردنەوە', '<li data-i18n="terms.l2">داواکارییەکان دوای پشتڕاستکردنەوە'),
    ('<li>گەیاندن بەپێی شار و ناوچە', '<li data-i18n="terms.l3">گەیاندن بەپێی شار و ناوچە'),
    ('<li>گەڕانەوەی بەرهەم تەنها لە حاڵەتی', '<li data-i18n="terms.l4">گەڕانەوەی بەرهەم تەنها لە حاڵەتی'),
    ('<li>زانیاری کەسی کڕیار بە شێوەی پارێزراو', '<li data-i18n="terms.l5">زانیاری کەسی کڕیار بە شێوەی پارێزراو'),
    ('<li>هەر گۆڕانکارییەک لەم مەرجانە', '<li data-i18n="terms.l6">هەر گۆڕانکارییەک لەم مەرجانە'),
    # Contact
    ('<span class="info-page__label">پەیوەندی</span>',
     '<span class="info-page__label" data-i18n="contact.label">پەیوەندی</span>'),
    ('id="contact-title">پەیوەندیمان پێوە بکە</h2>',
     'id="contact-title" data-i18n="contact.title">پەیوەندیمان پێوە بکە</h2>'),
    ('<p class="info-page__lead">پرسیار، پێشنیار',
     '<p class="info-page__lead" data-i18n="contact.lead">پرسیار، پێشنیار'),
    ('<span class="contact-card__label">فرۆشگا</span>', '<span class="contact-card__label" data-i18n="contact.store">فرۆشگا</span>'),
    ('<span class="contact-card__label">ئیمەیڵ</span>', '<span class="contact-card__label" data-i18n="contact.email">ئیمەیڵ</span>'),
    ('<span class="contact-card__label">ناوچە</span>', '<span class="contact-card__label" data-i18n="contact.region">ناوچە</span>'),
    ('<span class="contact-card__value">عێراق — گەیاندن بۆ هەموو شارەکان</span>',
     '<span class="contact-card__value" data-i18n="contact.regionV">عێراق — گەیاندن بۆ هەموو شارەکان</span>'),
    ('<span class="contact-card__label">تێلیگرام</span>', '<span class="contact-card__label" data-i18n="contact.tg">تێلیگرام</span>'),
    ('<span class="contact-card__value">پشتیوانی ڕاستەوخۆ</span>', '<span class="contact-card__value" data-i18n="contact.tgV">پشتیوانی ڕاستەوخۆ</span>'),
    ('<label for="contactName">ناو</label>', '<label for="contactName" data-i18n="contact.name">ناو</label>'),
    ('id="contactName" name="name" placeholder="ناوی تۆ"', 'id="contactName" name="name" data-i18n-placeholder="contact.namePh" placeholder="ناوی تۆ"'),
    ('<label for="contactEmail">ئیمەیڵ</label>', '<label for="contactEmail" data-i18n="contact.email">ئیمەیڵ</label>'),
    ('<label for="contactMessage">پەیام</label>', '<label for="contactMessage" data-i18n="contact.msg">پەیام</label>'),
    ('id="contactMessage" name="message" placeholder="پەیامەکەت لێرە بنووسە..."',
     'id="contactMessage" name="message" data-i18n-placeholder="contact.msgPh" placeholder="پەیامەکەت لێرە بنووسە..."'),
    ('class="contact-form__btn" type="submit">ناردنی پەیام</button>',
     'class="contact-form__btn" type="submit" data-i18n="contact.send">ناردنی پەیام</button>'),
    ('<p class="contact-form__note">دوگمەی ناردن', '<p class="contact-form__note" data-i18n="contact.note">دوگمەی ناردن'),
    ('id="contactSuccess" role="status">پەیامەکەت ئامادەیە', 'id="contactSuccess" role="status" data-i18n="contact.ok">پەیامەکەت ئامادەیە'),
]

PRODUCT_TAGS = [
    ('<span class="product-card__tag">نوێ</span>', '<span class="product-card__tag" data-i18n="tag.new">نوێ</span>'),
]

# Add tag translations to i18n - actually tags like Hot, Premium, AI, MM can stay or translate
# Skip product tags for now


def patch_text(text: str) -> str:
    for old, new in REPLACEMENTS:
        if old in text:
            text = text.replace(old, new)
    return text


def sync_assets(text: str) -> str:
    if "  <style>" in text:
        start = text.index("  <style>") + len("  <style>")
        end = text.index("  </style>", start)
        text = text[:start] + "\n" + CSS + "\n  " + text[end:]
    js_block = "  <script>\n" + JS_BUNDLE + "\n  </script>"
    marker = "  <script>\n/* MM IRAQ"
    if marker in text:
        start = text.index(marker)
        end = text.index("  </script>", start) + len("  </script>")
        text = text[:start] + js_block + text[end:]
    elif "  <script>\n(function () {" in text:
        start = text.index("  <script>\n(function () {")
        end = text.index("  </script>", start) + len("  </script>")
        text = text[:start] + js_block + text[end:]
    return text


def main():
    for path in ROOT.rglob("index.html"):
        text = path.read_text(encoding="utf-8")
        text = patch_text(text)
        text = sync_assets(text)
        path.write_text(text, encoding="utf-8")
        print("patched", path.relative_to(ROOT))


if __name__ == "__main__":
    main()
