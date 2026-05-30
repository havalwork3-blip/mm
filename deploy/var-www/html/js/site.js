(function () {
    var slides = document.querySelectorAll(".hero-slide");
    var dots = document.querySelectorAll(".hero-dot");
    var heroNext = document.getElementById("heroNext");
    var heroPrev = document.getElementById("heroPrev");
    var current = 0;
    var timer;

    if (slides.length && heroNext && heroPrev) {
      function goTo(n) {
        current = (n + slides.length) % slides.length;
        slides.forEach(function (s, i) { s.classList.toggle("is-active", i === current); });
        dots.forEach(function (d, i) { d.classList.toggle("is-active", i === current); });
      }

      function next() { goTo(current + 1); }
      function resetTimer() {
        clearInterval(timer);
        timer = setInterval(next, 6000);
      }

      heroNext.addEventListener("click", function () { goTo(current + 1); resetTimer(); });
      heroPrev.addEventListener("click", function () { goTo(current - 1); resetTimer(); });
      dots.forEach(function (d) {
        d.addEventListener("click", function () { goTo(+d.dataset.go); resetTimer(); });
      });
      resetTimer();
    }

    var toggle = document.getElementById("menuToggle");
    var menuClose = document.getElementById("menuClose");
    var sidebarOverlay = document.getElementById("sidebarOverlay");
    var nav = document.getElementById("mainNav");

    function openMenu() {
      nav.classList.add("is-open");
      sidebarOverlay.classList.add("is-open");
      sidebarOverlay.setAttribute("aria-hidden", "false");
      toggle.classList.add("is-active");
      toggle.setAttribute("aria-expanded", "true");
      document.body.classList.add("menu-open");
    }
    function closeMenu() {
      nav.classList.remove("is-open");
      sidebarOverlay.classList.remove("is-open");
      sidebarOverlay.setAttribute("aria-hidden", "true");
      toggle.classList.remove("is-active");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    }

    if (toggle && nav) {
    toggle.addEventListener("click", function () {
      if (nav.classList.contains("is-open")) closeMenu();
      else openMenu();
    });
    if (menuClose) menuClose.addEventListener("click", closeMenu);
    if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeMenu);
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) closeMenu();
    });
    }

    /* Fit explore mosaic to viewport (desktop) */
    var mosaicTilt = document.querySelector(".explore-showcase__tilt");
    function fitExploreMosaic() {
      if (!mosaicTilt) return;
      mosaicTilt.style.setProperty("--mosaic-scale", "1");
      if (window.innerWidth < 1025) return;
      var rect = mosaicTilt.getBoundingClientRect();
      var budget = window.innerHeight * 0.65;
      if (rect.height > budget && budget > 0) {
        mosaicTilt.style.setProperty("--mosaic-scale", String((budget / rect.height) * 0.98));
      }
    }
    fitExploreMosaic();
    window.addEventListener("resize", fitExploreMosaic);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitExploreMosaic);
    }
    window.addEventListener("load", fitExploreMosaic);

    /* Floating dock + back-to-top */
    var backTop = document.getElementById("backTop");
    var floatDock = document.getElementById("floatDock");
    var dockSearch = document.getElementById("dockSearch");
    var langToggle = document.getElementById("langToggle");
    var langCode = document.getElementById("langCode");
    var searchOpenBtn = document.getElementById("searchOpen");

    if (backTop) {
      backTop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      window.addEventListener("scroll", function () {
        backTop.classList.toggle("is-visible", window.scrollY > 420);
      }, { passive: true });
    }

    if (dockSearch && searchOpenBtn) {
      dockSearch.addEventListener("click", function () {
        searchOpenBtn.click();
      });
    }

    if (floatDock) {
      var dockIndicator = document.getElementById("dockIndicator");
      var dockBtns = floatDock.querySelectorAll(".float-dock__btn[data-dock]");
      var pageToDock = {
        home: "home",
        explore: "grid",
        luxury: "fav",
        tech: "fav",
        shop: "bookmark",
        services: "bookmark",
        about: "home",
        terms: "home",
        contact: "home"
      };
      var mainEl = document.getElementById("top");
      var currentPage = mainEl ? mainEl.getAttribute("data-page") : "home";

      function moveDockIndicator(activeBtn) {
        if (!dockIndicator || !activeBtn) return;
        dockIndicator.style.top = activeBtn.offsetTop + "px";
      }

      function setDockActive(dock) {
        var activeBtn = null;
        dockBtns.forEach(function (btn) {
          var isActive = btn.getAttribute("data-dock") === dock;
          btn.classList.toggle("is-active", isActive);
          if (isActive) activeBtn = btn;
        });
        moveDockIndicator(activeBtn);
      }

      window.setDockActive = setDockActive;
      setDockActive(pageToDock[currentPage] || "home");
      window.addEventListener("resize", function () {
        var active = floatDock.querySelector(".float-dock__btn.is-active");
        moveDockIndicator(active);
      });
    }

    function scrollToSection(id) {
      var el = document.getElementById(id);
      if (!el) return;
      var header = document.querySelector(".site-header");
      var headerH = header ? header.offsetHeight : 68;
      var top = el.getBoundingClientRect().top + window.scrollY - headerH - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }

    document.querySelectorAll('a[href^="#"]:not([href="#"])').forEach(function (link) {
      link.addEventListener("click", function (e) {
        var hash = link.getAttribute("href");
        if (!hash || hash === "#") return;
        var id = hash.slice(1);
        var target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        scrollToSection(id);
        if (nav.classList.contains("is-open")) closeMenu();
      });
    });

    if (window.MMI18n) {
      if (langToggle && langCode) {
        langToggle.addEventListener("click", function () {
          MMI18n.cycleLang();
        });
      }
      MMI18n.loadFromCms(function () {
        MMI18n.init();
        loadMarketingProducts(function () {
          if (window.mmRebuildSearchCatalog) window.mmRebuildSearchCatalog();
        });
      });
    } else if (langToggle && langCode) {
      langToggle.addEventListener("click", function () {
        var html = document.documentElement;
        var isKu = html.getAttribute("lang") === "ckb";
        if (isKu) {
          html.setAttribute("lang", "en");
          html.setAttribute("dir", "ltr");
          langCode.textContent = "EN";
        } else {
          html.setAttribute("lang", "ckb");
          html.setAttribute("dir", "rtl");
          langCode.textContent = "KU";
        }
      });
    }

    function getMarketingApiBase() {
      if (window.MMI18n && typeof MMI18n.getMarketingApiBase === "function") {
        return MMI18n.getMarketingApiBase();
      }
      if (typeof window !== "undefined" && window.location) {
        var h = window.location.hostname;
        if (h === "localhost" || h === "127.0.0.1") {
          return "http://127.0.0.1:8001";
        }
        if (h === "mmiraq.com" || h === "www.mmiraq.com") {
          return window.location.origin;
        }
      }
      return "https://dashboard.mmiraq.com";
    }

    function mmProductTitle(p, lang) {
      lang = lang || (window.MMI18n ? MMI18n.getLang() : "ckb");
      if (!p.title) return "";
      return p.title[lang] || p.title.ckb || p.title.ar || p.title.en || "";
    }

    function mmProductTag(p, lang) {
      lang = lang || (window.MMI18n ? MMI18n.getLang() : "ckb");
      var t = p.tag || {};
      if (t.text) return t.text[lang] || t.text.ckb || t.text.en || "";
      if (t.key && window.MMI18n) {
        var k = MMI18n.t("tag." + t.key);
        return k !== "tag." + t.key ? k : t.key;
      }
      return t.key || "";
    }

    function buildProductCardHtml(p, delay) {
      var title = mmProductTitle(p);
      var tag = mmProductTag(p);
      var href = p.link_url || ("/" + p.page + "/");
      var tone = p.tone || "violet";
      var imgStyle = p.image_url ? " style=\"background-image:url('" + String(p.image_url).replace(/'/g, "%27") + "')\"" : "";
      var imgClass = p.image_url ? " product-card__media--has-img" : "";
      var tagHtml = tag ? "<span class=\"product-card__tag\">" + tag + "</span>" : "";
      var delayClass = delay ? " reveal reveal-delay-" + delay : " reveal";
      return "<a class=\"product-card" + delayClass + "\" href=\"" + href + "\" data-mm-product-id=\"" + p.id + "\">" +
        "<div class=\"product-card__media product-card__media--" + tone + imgClass + "\"" + imgStyle + ">" + tagHtml + "</div>" +
        "<div class=\"product-card__body\"><h3 class=\"product-card__name\">" + title + "</h3></div></a>";
    }

    function renderProductsMount(mount, data) {
      mount._mmProductData = data;
      var cats = data.categories || [];
      var products = data.products || [];
      var html = "";
      if (cats.length) {
        cats.forEach(function (cat) {
          var lang = window.MMI18n ? MMI18n.getLang() : "ckb";
          var catTitle = (cat.title && (cat.title[lang] || cat.title.ckb || cat.title.en)) || "";
          var catProducts = products.filter(function (p) { return p.category_id === cat.id; });
          if (!catProducts.length) return;
          html += "<div class=\"product-category-block\"><h3 class=\"product-category__title\">" + catTitle + "</h3><div class=\"product-grid\">";
          catProducts.forEach(function (p, i) { html += buildProductCardHtml(p, (i % 4) + 1); });
          html += "</div></div>";
        });
        var loose = products.filter(function (p) { return !p.category_id; });
        if (loose.length) {
          html += "<div class=\"product-grid\">";
          loose.forEach(function (p, i) { html += buildProductCardHtml(p, (i % 4) + 1); });
          html += "</div>";
        }
      } else {
        html += "<div class=\"product-grid\">";
        products.forEach(function (p, i) { html += buildProductCardHtml(p, (i % 4) + 1); });
        html += "</div>";
      }
      mount.innerHTML = html;
      mount.querySelectorAll(".reveal").forEach(function (el) {
        if ("IntersectionObserver" in window) return;
        el.classList.add("is-visible");
      });
    }

    function loadMarketingProducts(done) {
      var mounts = document.querySelectorAll("[data-mm-products]");
      if (!mounts.length) { if (done) done(); return; }
      var pending = mounts.length;
      mounts.forEach(function (mount) {
        var page = mount.getAttribute("data-mm-products");
        fetch(getMarketingApiBase() + "/api/public/marketing-products/?page=" + encodeURIComponent(page), { cache: "no-store" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            if (data && data.products && data.products.length) renderProductsMount(mount, data);
          })
          .catch(function () {})
          .finally(function () {
            pending -= 1;
            if (pending <= 0 && done) done();
          });
      });
    }

    if (window.MMI18n) {
      document.addEventListener("mm:langchange", function () {
        document.querySelectorAll("[data-mm-products]").forEach(function (mount) {
          if (mount._mmProductData) renderProductsMount(mount, mount._mmProductData);
        });
        if (window.mmRebuildSearchCatalog) window.mmRebuildSearchCatalog();
      });
    }

    /* Search */
    var searchPanel = document.getElementById("searchPanel");
    var searchOpen = document.getElementById("searchOpen");
    var searchClose = document.getElementById("searchClose");
    var searchInput = document.getElementById("searchInput");
    var searchCount = document.getElementById("searchCount");
    var searchSuggest = document.getElementById("searchSuggest");
    var searchResults = document.getElementById("searchResults");
    var productCards = document.querySelectorAll(".product-card");
    var storeSections = document.querySelectorAll(".store-section");
    var SHOP_URL = "https://shopping.mmiraq.com/";
    var GLOBAL_CATALOG = [
      { i18n: "products.p1", href: "/luxury/", tone: "violet", sectionKey: "sections.luxury" },
      { i18n: "products.p2", href: "/luxury/", tone: "gold", sectionKey: "sections.luxury" },
      { i18n: "products.p3", href: "/luxury/", tone: "cyan", sectionKey: "sections.luxury" },
      { i18n: "products.p4", href: "/luxury/", tone: "indigo", sectionKey: "sections.luxury" },
      { i18n: "products.p5", href: "/tech/", tone: "violet", sectionKey: "sections.tech" },
      { i18n: "products.p6", href: "/tech/", tone: "cyan", sectionKey: "sections.tech" },
      { i18n: "products.p7", href: "/tech/", tone: "gold", sectionKey: "sections.tech" },
      { i18n: "products.p8", href: "/tech/", tone: "indigo", sectionKey: "sections.tech" },
      { i18n: "products.p9", href: "/shop/", tone: "violet", sectionKey: "sections.shop" },
      { i18n: "products.p10", href: "/shop/", tone: "cyan", sectionKey: "sections.shop" },
      { i18n: "products.p11", href: "/shop/", tone: "gold", sectionKey: "sections.shop" },
      { i18n: "products.p12", href: "/shop/", tone: "indigo", sectionKey: "sections.shop" },
      { i18n: "products.p13", href: "/services/", tone: "violet", sectionKey: "sections.services" },
      { i18n: "products.p14", href: "/services/", tone: "cyan", sectionKey: "sections.services" },
      { i18n: "products.p15", href: "/services/", tone: "gold", sectionKey: "sections.services" },
      { i18n: "products.p16", href: "/services/", tone: "indigo", sectionKey: "sections.services" }
    ];

    function catalogItemName(item) {
      if (item.i18n && window.MMI18n) return MMI18n.t(item.i18n);
      return item.name || "";
    }
    function catalogItemSection(item) {
      if (item.sectionKey && window.MMI18n) return MMI18n.t(item.sectionKey);
      return item.section || "";
    }
    function hydrateCatalog() {
      GLOBAL_CATALOG.forEach(function (item) {
        item.name = catalogItemName(item);
        item.section = catalogItemSection(item);
      });
    }
    hydrateCatalog();
    if (window.MMI18n) {
      document.addEventListener("mm:langchange", function () {
        hydrateCatalog();
        if (searchInput && normalizeSearch(searchInput.value)) runSearch(false);
      });
    }

    var catalog = GLOBAL_CATALOG.slice();

    window.mmRebuildSearchCatalog = function () {
      catalog = GLOBAL_CATALOG.slice();
      hydrateCatalog();
      var cards = document.querySelectorAll(".product-card");
      cards.forEach(function (card, idx) {
        var nameEl = card.querySelector(".product-card__name");
        var mediaEl = card.querySelector(".product-card__media");
        var section = card.closest(".store-section");
        var sectionTitle = section ? section.querySelector(".store-section__title") : null;
        var catTitle = card.closest(".product-category-block");
        var catHeading = catTitle ? catTitle.querySelector(".product-category__title") : null;
        var tone = "violet";
        if (mediaEl) {
          mediaEl.classList.forEach(function (c) {
            var m = c.match(/product-card__media--(\w+)/);
            if (m && m[1] !== "has" && m[1] !== "img") tone = m[1];
          });
        }
        var name = nameEl ? nameEl.textContent.trim() : "";
        var href = card.getAttribute("href") || SHOP_URL;
        var sectionName = catHeading ? catHeading.textContent.trim() : (sectionTitle ? sectionTitle.textContent.trim() : "");
        var existing = catalog.findIndex(function (item) { return item.card === card; });
        var entry = {
          id: idx,
          name: name,
          href: href,
          tone: tone,
          section: sectionName,
          card: card
        };
        if (existing >= 0) {
          catalog[existing] = Object.assign({}, catalog[existing], entry);
        } else if (name) {
          entry.id = catalog.length;
          catalog.push(entry);
        }
      });
    };

    window.mmRebuildSearchCatalog();

    function normalizeSearch(text) {
      return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
    }

    function levenshtein(a, b) {
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      var row = [];
      var i, j;
      for (j = 0; j <= b.length; j++) row[j] = j;
      for (i = 1; i <= a.length; i++) {
        var prev = i;
        for (j = 1; j <= b.length; j++) {
          var val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], row[j], prev) + 1;
          row[j - 1] = prev;
          prev = val;
        }
        row[b.length] = prev;
      }
      return row[b.length];
    }

    function subsequenceScore(q, text) {
      var qi = 0;
      for (var i = 0; i < text.length && qi < q.length; i++) {
        if (text[i] === q[qi]) qi++;
      }
      return qi / q.length;
    }

    function scoreItem(query, item) {
      if (!query) return { score: 0, fuzzy: false, label: "" };
      var name = normalizeSearch(item.name);
      var section = normalizeSearch(item.section);
      var haystack = name + " " + section;

      if (name.indexOf(query) !== -1 || haystack.indexOf(query) !== -1) {
        return { score: 100, fuzzy: false, label: "" };
      }

      var best = 0;
      var bestWord = item.name;
      var parts = haystack.split(/\s+/).filter(Boolean);
      parts.push(name);

      parts.forEach(function (word) {
        if (word.indexOf(query) === 0) {
          best = Math.max(best, 92);
          bestWord = word;
          return;
        }
        if (query.length >= 2) {
          var dist = levenshtein(query, word);
          var maxLen = Math.max(query.length, word.length);
          var sim = 1 - dist / maxLen;
          if (sim > best / 100) {
            best = Math.max(best, sim * 100);
            bestWord = word;
          }
        }
        var sub = subsequenceScore(query, word);
        if (sub >= 0.65) {
          best = Math.max(best, 55 + sub * 30);
          bestWord = word;
        }
      });

      if (best >= 52) {
        return { score: best, fuzzy: true, label: bestWord };
      }
      return { score: 0, fuzzy: false, label: "" };
    }

    function getMatches(query) {
      if (!query) return [];
      return catalog
        .map(function (item) {
          var s = scoreItem(query, item);
          return { item: item, score: s.score, fuzzy: s.fuzzy, label: s.label };
        })
        .filter(function (m) { return m.score >= 52; })
        .sort(function (a, b) { return b.score - a.score; });
    }

    function thumbClass(tone) {
      return "search-result__thumb search-result__thumb--" + (tone || "violet");
    }

    function renderResults(matches) {
      searchResults.innerHTML = "";
      matches.forEach(function (m) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.className = "search-result";
        a.href = m.item.href;
        a.dataset.cardId = String(m.item.id);

        var thumb = document.createElement("div");
        thumb.className = thumbClass(m.item.tone);
        thumb.setAttribute("aria-hidden", "true");

        var body = document.createElement("div");
        body.className = "search-result__body";

        var name = document.createElement("span");
        name.className = "search-result__name";
        name.textContent = m.item.name;

        var meta = document.createElement("span");
        meta.className = "search-result__meta";
        meta.textContent = m.item.section;

        body.appendChild(name);
        body.appendChild(meta);

        if (m.fuzzy) {
          var badge = document.createElement("span");
          badge.className = "search-result__badge";
          badge.textContent = (window.MMI18n ? MMI18n.t("search.near") : "نزیکە بە: ") + m.label;
          body.appendChild(badge);
        }

        a.appendChild(thumb);
        a.appendChild(body);
        li.appendChild(a);
        searchResults.appendChild(li);

        a.addEventListener("click", function (e) {
          if (m.item.card && document.body.contains(m.item.card)) {
            e.preventDefault();
            focusCard(m.item.card);
            closeSearch(false);
          }
        });
      });
    }

    function focusCard(card) {
      productCards.forEach(function (c) { c.classList.remove("is-search-match"); });
      if (!card) return;
      card.classList.remove("is-search-hidden");
      card.classList.add("is-search-match");
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(function () { card.classList.remove("is-search-match"); }, 2200);
    }

    function runSearch(scrollToFirst) {
      var q = normalizeSearch(searchInput.value);
      var matches = getMatches(q);
      var visible = 0;
      var hasExact = matches.some(function (m) { return !m.fuzzy; });

      productCards.forEach(function (card) {
        card.classList.remove("is-search-match");
      });

      if (!q) {
        productCards.forEach(function (card) { card.classList.remove("is-search-hidden"); });
        storeSections.forEach(function (section) { section.classList.remove("is-search-empty"); });
        searchCount.hidden = true;
        searchSuggest.hidden = true;
        searchResults.innerHTML = "";
        return;
      }

      var matchedNames = {};
      matches.forEach(function (m) { matchedNames[m.item.name] = true; });

      productCards.forEach(function (card) {
        var nameEl = card.querySelector(".product-card__name");
        var name = nameEl ? nameEl.textContent.trim() : "";
        var hide = !matchedNames[name];
        card.classList.toggle("is-search-hidden", hide);
        if (!hide) visible++;
      });

      storeSections.forEach(function (section) {
        var sectionCards = section.querySelectorAll(".product-card:not(.is-search-hidden)");
        section.classList.toggle("is-search-empty", sectionCards.length === 0);
      });

      renderResults(matches);

      searchCount.hidden = false;
      var resultCount = productCards.length ? visible : matches.length;
      if (resultCount > 0) {
        var fuzzyCount = matches.filter(function (m) { return m.fuzzy; }).length;
        searchCount.textContent = resultCount + (window.MMI18n ? MMI18n.t("search.found") : " ئەنجام دۆزرایەوە");
        searchCount.classList.remove("is-empty");
        if (fuzzyCount > 0 && !hasExact) {
          searchSuggest.hidden = false;
          searchSuggest.textContent = window.MMI18n ? MMI18n.t("search.typo") : "هەڵەی نووسین؟ ئەنجامە نزیکەکان پیشان دراون ↓";
        } else {
          searchSuggest.hidden = true;
        }
      } else {
        searchCount.textContent = window.MMI18n ? MMI18n.t("search.none") : "هیچ کاڵایەک نەدۆزرایەوە";
        searchCount.classList.add("is-empty");
        if (catalog.length) {
          searchSuggest.hidden = false;
          var guess = catalog
            .map(function (item) {
              var s = scoreItem(q, item);
              return { item: item, score: s.score, label: s.label };
            })
            .sort(function (a, b) { return b.score - a.score; })[0];
          if (guess && guess.score > 25) {
            var lk = window.MMI18n ? MMI18n.t("search.looking") : "ئایا دەگەڕێیت بۆ: «";
            var le = window.MMI18n ? MMI18n.t("search.lookingEnd") : "»؟";
            searchSuggest.textContent = lk + guess.item.name + le;
          } else {
            searchSuggest.hidden = true;
          }
        }
      }

      if (scrollToFirst && matches.length > 0 && matches[0].item.card) {
        focusCard(matches[0].item.card);
      }
    }

    function openSearch() {
      searchPanel.hidden = false;
      searchPanel.classList.add("is-open");
      searchOpen.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      setTimeout(function () { searchInput.focus(); }, 50);
    }

    function closeSearch(reset) {
      searchPanel.classList.remove("is-open");
      searchOpen.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      if (reset) {
        searchInput.value = "";
        searchSuggest.hidden = true;
        searchResults.innerHTML = "";
        productCards.forEach(function (c) { c.classList.remove("is-search-match"); });
        runSearch(false);
      }
      setTimeout(function () { searchPanel.hidden = true; }, 250);
    }

    searchOpen.addEventListener("click", openSearch);
    searchClose.addEventListener("click", function () { closeSearch(true); });
    searchPanel.addEventListener("click", function (e) {
      if (e.target === searchPanel) closeSearch(true);
    });
    searchInput.addEventListener("input", function () { runSearch(false); });
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeSearch(true);
      if (e.key === "Enter") {
        e.preventDefault();
        runSearch(true);
        closeSearch(false);
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && searchPanel.classList.contains("is-open")) closeSearch(true);
    });

    var contactForm = document.getElementById("contactForm");
    var contactSuccess = document.getElementById("contactSuccess");
    var contactBtn = contactForm ? contactForm.querySelector(".contact-form__btn") : null;
    if (contactForm) {
      contactForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var nameEl = document.getElementById("contactName");
        var emailEl = document.getElementById("contactEmail");
        var msgEl = document.getElementById("contactMessage");
        var honeypot = document.getElementById("contactWebsite");
        var name = nameEl ? nameEl.value.trim() : "";
        var email = emailEl ? emailEl.value.trim() : "";
        var message = msgEl ? msgEl.value.trim() : "";
        if (!name || !email || !message) return;
        var api = getMarketingApiBase() + "/api/public/marketing-contact/";
        var lang = window.MMI18n ? MMI18n.getLang() : "ckb";
        if (contactBtn) contactBtn.disabled = true;
        fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name,
            email: email,
            message: message,
            lang: lang,
            website: honeypot ? honeypot.value : ""
          })
        }).then(function (r) {
          if (!r.ok) throw new Error("fail");
          contactForm.reset();
          if (contactSuccess) {
            contactSuccess.textContent = window.MMI18n ? MMI18n.t("contact.ok") : "پەیامەکەت نێردرا — سوپاس!";
            contactSuccess.classList.add("is-visible");
          }
        }).catch(function () {
          if (contactSuccess) {
            contactSuccess.textContent = window.MMI18n ? MMI18n.t("contact.err") : "ناردن سەرکەوتوو نەبوو.";
            contactSuccess.classList.add("is-visible");
          }
        }).finally(function () {
          if (contactBtn) contactBtn.disabled = false;
        });
      });
    }


    var items = document.querySelectorAll(".reveal");
    if (!items.length || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("is-visible"); obs.unobserve(e.target); }
        });
      }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
      items.forEach(function (el) { obs.observe(el); });
    }
    })();