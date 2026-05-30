/* MM IRAQ — Kurdish (ckb), Arabic (ar), English (en) */
window.MMI18n = (function () {
  var LANGS = ["ckb", "ar", "en"];
  var META = {
    ckb: { dir: "rtl", code: "KU", htmlLang: "ckb" },
    ar: { dir: "rtl", code: "AR", htmlLang: "ar" },
    en: { dir: "ltr", code: "EN", htmlLang: "en" }
  };

  var T = {
    ckb: {
      ui: {
        navAria: "ناڤیگەیشن", menu: "مێنیو", close: "داخستن", search: "گەڕان",
        langSwitch: "گۆڕینی زمان", shopCta: "ئێستا بازاری بکە", seeAll: "هەمووی ببینە ←",
        backTop: "گەڕانەوە بۆ سەرەوە", chat: "پەیاممان بنێرە",
        dockHome: "سەرەوە", dockExplore: "گەڕان", dockFav: "دڵخواز", dockShop: "فرۆشگا"
      },
      nav: { luxury: "ئێکسسوارات", explore: "گەڕان", tech: "تەکنەلۆژیا", shop: "شۆپی ئۆنلاین", services: "خزمەتگوزاری", more: "زیاتر" },
      footer: {
        tagline: "فرۆشگای ئێکسسواراتی مۆدێرن — لوکس، تەکنەلۆژیا، و خزمەتگوزاری لە یەک شوێن.",
        sections: "بەشەکان", help: "یارمەتی", social: "تۆڕە کۆمەڵایەتییەکان",
        store: "فرۆشگا", shopShort: "شۆپ", contact: "پەیوەندی", about: "دەربارە", terms: "مەرج و ڕێساکان",
        copy: "© 2026 MM IRAQ. هەموو مافەکان پارێزراون.", line2: "ئێکسسوارات · تەکنەلۆژیا · عێراق"
      },
      search: {
        aria: "گەڕان", placeholder: "ناوی کاڵا بنووسە...", hint: "ناوی کاڵا بنووسە — وێنە و پێشنیاری نزیک پیشان دەدرێت",
        found: " ئەنجام دۆزرایەوە", none: "هیچ کاڵایەک نەدۆزرایەوە",
        typo: "هەڵەی نووسین؟ ئەنجامە نزیکەکان پیشان دراون ↓",
        looking: "ئایا دەگەڕێیت بۆ: «", lookingEnd: "»؟", near: "نزیکە بە: "
      },
      cta: { shop: "ئێستا بازاری بکە", learn: "زیاتر بزانە", start: "دەست پێ بکە", explore: "ئێستا بگەڕێ", aboutMore: "زیاتر دەربارەمان بزانە ←" },
      hero: {
        aria: "بانێری سەرەکی", prev: "پێشوو", next: "دواتر", s1: "سلاید ١", s2: "سلاید ٢", s3: "سلاید ٣",
        h1: "ئێکسسواراتی <span>لوکس و مۆدێرن</span>", h1sub: "کۆمەڵێک بەرهەمی premium بۆ ستایلی ژیانت — کوالیتی بەرز، دیزاینی جوان.",
        h2: "شۆپی <span>زیرەک MM IRAQ</span>", h2sub: "فرۆشگای ئۆنلاینی RTL، کۆگا، و بەڕێوەبردنی بەرهەم لە یەک پلاتفۆرم.",
        h3: "گەیاندنی <span>خێرا و متمانەپێکراو</span>", h3sub: "لۆجستیکی پێشکەوتوو و چاودێری کاتی ڕاستەقینە بۆ هەموو داواکارییەک."
      },
      feat: {
        d1: "گەیاندنی خێرا", d1s: "گەیاندن بۆ هەموو عێراق",
        q1: "کوالیتی premium", q1s: "بەرهەمی ڕەسەن و متمانەپێکراو",
        s1: "پشتیوانی ٢٤/٧", s1s: "لە تێلیگرام و تەلەفۆن",
        p1: "پارەدانێکی سەلامەت", p1s: "COD و گەڕانەوەی ئاسان"
      },
      homeAbout: {
        label: "ئێمە کێین", title: "بەخێربێیت بۆ جیهانی MM IRAQ",
        lead: "لەم پێڕستەدا لوکس، تەکنەلۆژیا، و خزمەتگوزاری لە یەک ئەزموونی تەواودا کۆدەکرێنەوە — بۆ ئەو کەسانەی ستایل و کارامەیی هاوکات گرنگیان پێ دەدەن. ئێمە نەک تەنها فرۆشگایەکین، بەڵکو هاوبەشی بازرگانی و تەکنەلۆژیایین بۆ عێراق.",
        c1t: "کۆمەڵێک هەڵبژاردە", c1d: "ئێکسسواراتی لوکس، ئامێری تەکنەلۆژیا، و شۆپی زیرەک — هەمووی لە ژێر یەک براند.",
        c2t: "دروستکراو بۆ عێراق", c2d: "گەیاندن، پشتیوانی RTL، و خزمەتگوزاری ناوخۆیی بۆ هەموو شارەکان.",
        c3t: "زیرەک و خێرا", c3d: "کۆگای ئۆتۆمات، ڕاپۆرتی AI، و چاودێری داواکاری بە کاتی ڕاستەقینە."
      },
      explore: { title: "زیاتر لە MM IRAQ بگەڕێ" },
      showcase: {
        s1: "ئێکسسوارات", s2: "هێدسێتی پڕۆ", s3: "MM IRAQ", s4: "MM Control",
        s5: "پشکی Elite", s6: "کورسی Elite", s7: "کیی Mech", s8: "ماوس Elite",
        s9: "ساعەتی زیرەک", s10: "ئامێری تەکنە", s11: "دەنگی ستودیۆ",
        s12: "MM KILLSWITCH", s13: "MM ROUX", s14: "Wireless Pro"
      },
      tag: { new: "نوێ", hot: "Hot", premium: "Premium", ai: "AI", mm: "MM", discount: "-١٥٪" },
      sections: { luxury: "ئێکسسواراتی لوکس", tech: "تەکنەلۆژیا", shop: "شۆپ", services: "خزمەتگوزاری" },
      luxury: {
        title: "ئێکسسواراتی لوکس", sub: "هەڵبژاردەی دەستچێن و ستایلی premium",
        cinemaT: "کۆڵێکشنێکی نوێ — وەرزی ٢٠٢٦", cinemaS: "دیزاینی تایبەت MM IRAQ بۆ ئەو کەسانەی ستایل و کوالیتی گرنگی پێ دەدەن",
        cinemaA: "کۆڵێکشنێکی نوێ"
      },
      tech: {
        title: "ئامێر و تەکنەلۆژیا", sub: "هێدسێت، ماوس، کیبۆرد، و زیاتر",
        cinemaT: "تەکنەلۆژیا + بازرگانی", cinemaS: "ڕاپۆرتی خۆکاری تێلیگرام و داشبۆردی بەڕێوەبردن بۆ تیمەکەت", cinemaA: "تەکنەلۆژیا و بازرگانی"
      },
      shop: { title: "شۆپ و کۆگای زیرەک", sub: "پلاتفۆرمی فرۆشتن و بەڕێوەبردن" },
      services: { title: "خزمەتگوزارییەکان", sub: "لۆجستیک، AI، و پشتیوانی" },
      about: {
        label: "دەربارە", title: "دەربارەی MM IRAQ",
        lead: "MM IRAQ ناوەندێکی مۆدێرنە بۆ بازرگانی ئێکسسوارات، تەکنەلۆژیا، و خزمەتگوزاری پێشکەوتوو لە عێراق. ئامانجمان دابینکردنی ئەزموونێکی premiumـە — لە هەڵبژاردنی بەرهەمەوە تا گەیاندن و پشتیوانی.",
        l1: "ئێکسسواراتی لوکس و مۆدێرن بۆ کڕیارانی جیاواز", l2: "فرۆشگای ئۆنلاینی RTL و سیستەمی کۆگای زیرەک",
        l3: "ڕاپۆرتی خۆکاری تێلیگرام و چارەسەری بازرگانی", l4: "گەیاندنی خێرا و پشتیوانی بەردەوام",
        st1n: "+١٠٠", st1t: "بەرهەمی جیاواز", st2n: "٢٤/٧", st2t: "پشتیوانی", st3n: "🇮🇶", st3t: "گەیاندن بۆ عێراق"
      },
      terms: {
        label: "مەرج و ڕێساکان", title: "مەرج و ڕێساکانی بەکارهێنان",
        lead: "بە بەکارهێنانی ماڵپەڕ و خزمەتگوزارییەکانی MM IRAQ، ڕازی دەبیت بەم مەرجانە. تکایە بە وردی بیخوێنەرەوە.",
        l1: "هەموو نرخ و بەردەستی بەرهەمەکان دەتوانن بگۆڕدرێن بەبێ ئاگاداری پێشوەخت.",
        l2: "داواکارییەکان دوای پشتڕاستکردنەوە پرۆسێس دەکرێن؛ MM IRAQ مافی هەڵوەشاندنەوەی داواکاری هەیە لە حاڵەتی کێشەدا.",
        l3: "گەیاندن بەپێی شار و ناوچە جیاواز دەبێت؛ کاتی گەیاندن پێشبینییە نەک گەرەنتی.",
        l4: "گەڕانەوەی بەرهەم تەنها لە حاڵەتی کەموکوڕی یان هەڵەدا قبوڵ دەکرێت، بەپێی سیاسەتی فرۆشگا.",
        l5: "زانیاری کەسی کڕیار بە شێوەی پارێزراو بەکاردەهێنرێت تەنها بۆ مەبەستی داواکاری و پشتیوانی.",
        l6: "هەر گۆڕانکارییەک لەم مەرجانە لەسەر ئەم پەڕەیە بڵاو دەکرێتەوە."
      },
      contact: {
        label: "پەیوەندی", title: "پەیوەندیمان پێوە بکە",
        lead: "پرسیار، پێشنیار، یان داواکاری هاوکاری؟ تیمەکەمان ئامادەیە یارمەتیت بدات.",
        store: "فرۆشگا", email: "ئیمەیڵ", region: "ناوچە", regionV: "عێراق — گەیاندن بۆ هەموو شارەکان",
        tg: "تێلیگرام", tgV: "پشتیوانی ڕاستەوخۆ", name: "ناو", namePh: "ناوی تۆ", msg: "پەیام",
        msgPh: "پەیامەکەت لێرە بنووسە...", send: "ناردنی پەیام",
        note: "پەیامەکەت ڕاستەوخۆ دەنێردرێت بۆ تیمەکەمان.",
        ok: "پەیامەکەت نێردرا — سوپاس!",
        err: "ناردن سەرکەوتوو نەبوو. دووبارە هەوڵبدەرەوە.",
        mailSub: "پەیام لە ماڵپەڕی MM IRAQ — "
      },
      products: {
        p1: "کڵاوی چەرم Premium", p2: "کەمی چوارینە لوکس", p3: "ساعەتی زیرەک MM Edition", p4: "جانتای دەستی دیزاین",
        p5: "هێدسێت گەیمینگ Pro", p6: "ماوس RGB Wireless", p7: "کیبۆرد Mechanical", p8: "Webcam 4K Stream",
        p9: "پلاتفۆرمی شۆپی RTL", p10: "داشبۆردی کۆگا", p11: "بەڕێوەبردنی بەرهەم", p12: "ئامار و ڕاپۆرت",
        p13: "ڕاپۆرتی تێلیگرام", p14: "گەیاندنی خێرا", p15: "پشتیوانی کڕیار", p16: "چارەسەری تایبەت"
      },
      meta: {
        homeTitle: "MM IRAQ — فرۆشگای ئێکسسوارات", homeDesc: "MM IRAQ — فرۆشگای ئێکسسواراتی لوکس، تەکنەلۆژیا، و خزمەتگوزاری پێشکەوتوو",
        luxuryTitle: "ئێکسسواراتی لوکس — MM IRAQ", luxuryDesc: "هەڵبژاردەی دەستچێن و ستایلی premium",
        techTitle: "تەکنەلۆژیا — MM IRAQ", techDesc: "ئامێر و تەکنەلۆژیا",
        shopTitle: "شۆپ — MM IRAQ", shopDesc: "شۆپ و کۆگای زیرەک",
        servicesTitle: "خزمەتگوزاری — MM IRAQ", servicesDesc: "لۆجستیک، AI، و پشتیوانی",
        exploreTitle: "گەڕان — MM IRAQ", exploreDesc: "زیاتر لە MM IRAQ بگەڕێ",
        aboutTitle: "دەربارە — MM IRAQ", aboutDesc: "دەربارەی MM IRAQ",
        termsTitle: "مەرج و ڕێساکان — MM IRAQ", termsDesc: "مەرج و ڕێساکانی بەکارهێنان",
        contactTitle: "پەیوەندی — MM IRAQ", contactDesc: "پەیوەندیمان پێوە بکە"
      }
    },
    ar: {
      ui: {
        navAria: "التنقل", menu: "القائمة", close: "إغلاق", search: "بحث",
        langSwitch: "تغيير اللغة", shopCta: "تسوق الآن", seeAll: "عرض الكل ←",
        backTop: "العودة للأعلى", chat: "أرسل رسالة",
        dockHome: "الرئيسية", dockExplore: "استكشاف", dockFav: "المفضلة", dockShop: "المتجر"
      },
      nav: { luxury: "الإكسسوارات", explore: "استكشاف", tech: "التكنولوجيا", shop: "المتجر الإلكتروني", services: "الخدمات", more: "المزيد" },
      footer: {
        tagline: "متجر إكسسوارات عصري — فخامة، تكنولوجيا، وخدمات في مكان واحد.",
        sections: "الأقسام", help: "المساعدة", social: "الشبكات الاجتماعية",
        store: "المتجر", shopShort: "شوب", contact: "اتصل بنا", about: "من نحن", terms: "الشروط",
        copy: "© 2026 MM IRAQ. جميع الحقوق محفوظة.", line2: "إكسسوارات · تكنولوجيا · العراق"
      },
      search: {
        aria: "بحث", placeholder: "اكتب اسم المنتج...", hint: "اكتب اسم المنتج — ستظهر الصور والاقتراحات القريبة",
        found: " نتيجة", none: "لم يُعثر على أي منتج",
        typo: "خطأ إملائي؟ تم عرض نتائج قريبة ↓",
        looking: "هل تبحث عن: «", lookingEnd: "»؟", near: "قريب من: "
      },
      cta: { shop: "تسوق الآن", learn: "اعرف المزيد", start: "ابدأ الآن", explore: "استكشف الآن", aboutMore: "المزيد عنا ←" },
      hero: {
        aria: "البانر الرئيسي", prev: "السابق", next: "التالي", s1: "شريحة ١", s2: "شريحة ٢", s3: "شريحة ٣",
        h1: "إكسسوارات <span>فاخرة وعصرية</span>", h1sub: "مجموعة منتجات premium لأسلوب حياتك — جودة عالية وتصميم أنيق.",
        h2: "متجر <span>MM IRAQ الذكي</span>", h2sub: "متجر RTL، مخزون، وإدارة منتجات في منصة واحدة.",
        h3: "توصيل <span>سريع وموثوق</span>", h3sub: "لوجستيات متقدمة وتتبع فوري لكل طلب."
      },
      feat: {
        d1: "توصيل سريع", d1s: "لجميع أنحاء العراق",
        q1: "جودة premium", q1s: "منتجات أصلية وموثوقة",
        s1: "دعم ٢٤/٧", s1s: "عبر تيليغرام والهاتف",
        p1: "دفع آمن", p1s: "COD وإرجاع سهل"
      },
      homeAbout: {
        label: "من نحن", title: "مرحباً بك في عالم MM IRAQ",
        lead: "هنا نجمع الفخامة والتكنولوجيا والخدمات في تجربة واحدة — لمن يقدّر الأسلوب والعملية معاً. نحن شريك تجاري وتقني في العراق، وليس مجرد متجر.",
        c1t: "تشكيلة متنوعة", c1d: "إكسسوارات فاخرة، أجهزة تقنية، ومتجر ذكي — تحت علامة واحدة.",
        c2t: "صُنع للعراق", c2d: "توصيل، دعم RTL، وخدمات محلية لجميع المدن.",
        c3t: "ذكي وسريع", c3d: "مخزون آلي، تقارير AI، وتتبع الطلبات لحظياً."
      },
      explore: { title: "استكشف المزيد من MM IRAQ" },
      showcase: {
        s1: "الإكسسوارات", s2: "سماعة Pro", s3: "MM IRAQ", s4: "MM Control",
        s5: "وسادة Elite", s6: "كرسي Elite", s7: "مفتاح Mech", s8: "فأرة Elite",
        s9: "ساعة ذكية", s10: "معدات تقنية", s11: "صوت استوديو",
        s12: "MM KILLSWITCH", s13: "MM ROUX", s14: "Wireless Pro"
      },
      tag: { new: "جديد", hot: "رائج", premium: "Premium", ai: "AI", mm: "MM", discount: "-15%" },
      sections: { luxury: "إكسسوارات فاخرة", tech: "التكنولوجيا", shop: "المتجر", services: "الخدمات" },
      luxury: {
        title: "إكسسوارات فاخرة", sub: "اختيار يدوي وأسلوب premium",
        cinemaT: "مجموعة جديدة — موسم ٢٠٢٦", cinemaS: "تصميم حصري من MM IRAQ لمن يقدّر الأسلوب والجودة",
        cinemaA: "مجموعة جديدة"
      },
      tech: {
        title: "أجهزة وتكنولوجيا", sub: "سماعات، فأرة، لوحة مفاتيح، والمزيد",
        cinemaT: "تكنولوجيا + أعمال", cinemaS: "تقارير تيليغرام تلقائية ولوحة إدارة لفريقك", cinemaA: "تكنولوجيا وأعمال"
      },
      shop: { title: "متجر ومخزون ذكي", sub: "منصة بيع وإدارة" },
      services: { title: "الخدمات", sub: "لوجستيات، AI، ودعم" },
      about: {
        label: "من نحن", title: "عن MM IRAQ",
        lead: "MM IRAQ مركز عصري للتجارة في الإكسسوارات والتكنولوجيا والخدمات المتقدمة في العراق. هدفنا تجربة premium — من اختيار المنتج إلى التوصيل والدعم.",
        l1: "إكسسوارات فاخرة وعصرية لعملاء متنوعين", l2: "متجر RTL ونظام مخزون ذكي",
        l3: "تقارير تيليغرام تلقائية وحلول أعمال", l4: "توصيل سريع ودعم مستمر",
        st1n: "+١٠٠", st1t: "منتج متنوع", st2n: "٢٤/٧", st2t: "دعم", st3n: "🇮🇶", st3t: "توصيل للعراق"
      },
      terms: {
        label: "الشروط", title: "شروط الاستخدام",
        lead: "باستخدام موقع وخدمات MM IRAQ، فإنك توافق على هذه الشروط. يرجى قراءتها بعناية.",
        l1: "قد تتغير الأسعار والتوفر دون إشعار مسبق.", l2: "تُعالَج الطلبات بعد التأكيد؛ يحق لـ MM IRAQ إلغاء الطلب عند وجود مشكلة.",
        l3: "يختلف التوصيل حسب المدينة والمنطقة؛ الوقت تقديري وليس ضماناً.", l4: "يُقبل الإرجاع فقط عند النقص أو الخطأ، وفق سياسة المتجر.",
        l5: "تُستخدم بيانات العملاء بشكل آمن فقط لأغراض الطلب والدعم.", l6: "أي تغيير في هذه الشروط يُنشر على هذه الصفحة."
      },
      contact: {
        label: "اتصل بنا", title: "تواصل معنا",
        lead: "سؤال أو اقتراح أو طلب مساعدة؟ فريقنا جاهز لمساعدتك.",
        store: "المتجر", email: "البريد", region: "المنطقة", regionV: "العراق — توصيل لجميع المدن",
        tg: "تيليغرام", tgV: "دعم مباشر", name: "الاسم", namePh: "اسمك", msg: "الرسالة",
        msgPh: "اكتب رسالتك هنا...", send: "إرسال الرسالة",
        note: "تُرسل رسالتك مباشرة إلى فريقنا.", ok: "تم إرسال رسالتك — شكراً!",
        err: "فشل الإرسال. حاول مرة أخرى.",
        mailSub: "رسالة من موقع MM IRAQ — "
      },
      products: {
        p1: "قبعة جلد Premium", p2: "نظارات فاخرة", p3: "ساعة ذكية MM Edition", p4: "حقيبة يد Designer",
        p5: "سماعة Gaming Pro", p6: "فأرة RGB Wireless", p7: "لوحة Mechanical", p8: "Webcam 4K Stream",
        p9: "منصة متجر RTL", p10: "لوحة المخزون", p11: "إدارة المنتجات", p12: "إحصائيات وتقارير",
        p13: "تقرير تيليغرام", p14: "توصيل سريع", p15: "دعم العملاء", p16: "حلول مخصصة"
      },
      meta: {
        homeTitle: "MM IRAQ — متجر الإكسسوارات", homeDesc: "MM IRAQ — إكسسوارات فاخرة، تكنولوجيا، وخدمات متقدمة",
        luxuryTitle: "إكسسوارات فاخرة — MM IRAQ", luxuryDesc: "اختيار يدوي وأسلوب premium",
        techTitle: "التكنولوجيا — MM IRAQ", techDesc: "أجهزة وتكنولوجيا",
        shopTitle: "المتجر — MM IRAQ", shopDesc: "متجر ومخزون ذكي",
        servicesTitle: "الخدمات — MM IRAQ", servicesDesc: "لوجستيات، AI، ودعم",
        exploreTitle: "استكشاف — MM IRAQ", exploreDesc: "استكشف المزيد من MM IRAQ",
        aboutTitle: "من نحن — MM IRAQ", aboutDesc: "عن MM IRAQ",
        termsTitle: "الشروط — MM IRAQ", termsDesc: "شروط الاستخدام",
        contactTitle: "اتصل بنا — MM IRAQ", contactDesc: "تواصل معنا"
      }
    },
    en: {
      ui: {
        navAria: "Navigation", menu: "Menu", close: "Close", search: "Search",
        langSwitch: "Switch language", shopCta: "Shop now", seeAll: "See all ←",
        backTop: "Back to top", chat: "Send a message",
        dockHome: "Home", dockExplore: "Explore", dockFav: "Favorites", dockShop: "Store"
      },
      nav: { luxury: "Accessories", explore: "Explore", tech: "Technology", shop: "Online shop", services: "Services", more: "More" },
      footer: {
        tagline: "Modern accessories store — luxury, tech, and services in one place.",
        sections: "Sections", help: "Help", social: "Social media",
        store: "Store", shopShort: "Shop", contact: "Contact", about: "About", terms: "Terms",
        copy: "© 2026 MM IRAQ. All rights reserved.", line2: "Accessories · Technology · Iraq"
      },
      search: {
        aria: "Search", placeholder: "Type product name...", hint: "Type a product name — images and close matches will appear",
        found: " results found", none: "No products found",
        typo: "Typo? Showing close matches ↓",
        looking: "Are you looking for: «", lookingEnd: "»?", near: "Close to: "
      },
      cta: { shop: "Shop now", learn: "Learn more", start: "Get started", explore: "Explore now", aboutMore: "Learn more about us ←" },
      hero: {
        aria: "Main banner", prev: "Previous", next: "Next", s1: "Slide 1", s2: "Slide 2", s3: "Slide 3",
        h1: "Luxury & <span>modern accessories</span>", h1sub: "A premium product range for your lifestyle — high quality, beautiful design.",
        h2: "MM IRAQ <span>smart shop</span>", h2sub: "RTL online store, inventory, and product management in one platform.",
        h3: "<span>Fast & reliable</span> delivery", h3sub: "Advanced logistics and real-time tracking for every order."
      },
      feat: {
        d1: "Fast delivery", d1s: "Delivery across Iraq",
        q1: "Premium quality", q1s: "Authentic, trusted products",
        s1: "24/7 support", s1s: "Via Telegram and phone",
        p1: "Secure payment", p1s: "COD and easy returns"
      },
      homeAbout: {
        label: "Who we are", title: "Welcome to the MM IRAQ world",
        lead: "Here luxury, technology, and services come together in one complete experience — for those who value style and practicality. We are a business and tech partner in Iraq, not just a store.",
        c1t: "One curated range", c1d: "Luxury accessories, tech gear, and a smart shop — under one brand.",
        c2t: "Built for Iraq", c2d: "Delivery, RTL support, and local service for every city.",
        c3t: "Smart & fast", c3d: "Automated inventory, AI reports, and real-time order tracking."
      },
      explore: { title: "Explore more from MM IRAQ" },
      showcase: {
        s1: "Accessories", s2: "Pro Headset", s3: "MM IRAQ", s4: "MM Control",
        s5: "Elite Pillow", s6: "Elite Chair", s7: "Mech Key", s8: "Elite Mouse",
        s9: "Smart Watch", s10: "Tech Gear", s11: "Studio Audio",
        s12: "MM KILLSWITCH", s13: "MM ROUX", s14: "Wireless Pro"
      },
      tag: { new: "New", hot: "Hot", premium: "Premium", ai: "AI", mm: "MM", discount: "-15%" },
      sections: { luxury: "Luxury accessories", tech: "Technology", shop: "Shop", services: "Services" },
      luxury: {
        title: "Luxury accessories", sub: "Handpicked pieces and premium style",
        cinemaT: "New collection — Season 2026", cinemaS: "Exclusive MM IRAQ design for those who value style and quality",
        cinemaA: "New collection"
      },
      tech: {
        title: "Devices & technology", sub: "Headsets, mice, keyboards, and more",
        cinemaT: "Technology + business", cinemaS: "Automated Telegram reports and a management dashboard for your team",
        cinemaA: "Technology and business"
      },
      shop: { title: "Smart shop & inventory", sub: "Sales and management platform" },
      services: { title: "Services", sub: "Logistics, AI, and support" },
      about: {
        label: "About", title: "About MM IRAQ",
        lead: "MM IRAQ is a modern hub for accessories commerce, technology, and advanced services in Iraq. Our goal is a premium experience — from product selection to delivery and support.",
        l1: "Luxury and modern accessories for diverse customers", l2: "RTL online store and smart inventory system",
        l3: "Automated Telegram reports and business solutions", l4: "Fast delivery and ongoing support",
        st1n: "100+", st1t: "Unique products", st2n: "24/7", st2t: "Support", st3n: "🇮🇶", st3t: "Delivery in Iraq"
      },
      terms: {
        label: "Terms", title: "Terms of use",
        lead: "By using the MM IRAQ website and services, you agree to these terms. Please read them carefully.",
        l1: "Prices and availability may change without prior notice.", l2: "Orders are processed after confirmation; MM IRAQ may cancel an order if issues arise.",
        l3: "Delivery varies by city and region; times are estimates, not guarantees.", l4: "Returns are accepted only for defects or errors, per store policy.",
        l5: "Customer data is used securely only for order and support purposes.", l6: "Any changes to these terms will be posted on this page."
      },
      contact: {
        label: "Contact", title: "Contact us",
        lead: "Questions, suggestions, or need help? Our team is ready to assist.",
        store: "Store", email: "Email", region: "Region", regionV: "Iraq — delivery to all cities",
        tg: "Telegram", tgV: "Live support", name: "Name", namePh: "Your name", msg: "Message",
        msgPh: "Write your message here...", send: "Send message",
        note: "Your message is sent directly to our team.", ok: "Message sent — thank you!",
        err: "Could not send. Please try again.",
        mailSub: "Message from MM IRAQ website — "
      },
      products: {
        p1: "Premium Leather Cap", p2: "Luxury Square Glasses", p3: "MM Edition Smart Watch", p4: "Designer Handbag",
        p5: "Gaming Headset Pro", p6: "RGB Wireless Mouse", p7: "Mechanical Keyboard", p8: "Webcam 4K Stream",
        p9: "RTL Shop Platform", p10: "Inventory Dashboard", p11: "Product Management", p12: "Analytics & Reports",
        p13: "Telegram Report", p14: "Express Delivery", p15: "Customer Support", p16: "Custom Solutions"
      },
      meta: {
        homeTitle: "MM IRAQ — Accessories Store", homeDesc: "MM IRAQ — luxury accessories, technology, and advanced services",
        luxuryTitle: "Luxury Accessories — MM IRAQ", luxuryDesc: "Handpicked pieces and premium style",
        techTitle: "Technology — MM IRAQ", techDesc: "Devices and technology",
        shopTitle: "Shop — MM IRAQ", shopDesc: "Smart shop and inventory",
        servicesTitle: "Services — MM IRAQ", servicesDesc: "Logistics, AI, and support",
        exploreTitle: "Explore — MM IRAQ", exploreDesc: "Explore more from MM IRAQ",
        aboutTitle: "About — MM IRAQ", aboutDesc: "About MM IRAQ",
        termsTitle: "Terms — MM IRAQ", termsDesc: "Terms of use",
        contactTitle: "Contact — MM IRAQ", contactDesc: "Contact us"
      }
    }
  };

  function t(key, lang) {
    lang = lang || getLang();
    var parts = key.split(".");
    var obj = T[lang];
    for (var i = 0; i < parts.length; i++) {
      if (!obj || obj[parts[i]] === undefined) return key;
      obj = obj[parts[i]];
    }
    return obj;
  }

  function applyLang(lang) {
    if (LANGS.indexOf(lang) === -1) lang = "ckb";
    localStorage.setItem("mm-lang", lang);
    var meta = META[lang];
    document.documentElement.lang = meta.htmlLang;
    document.documentElement.dir = meta.dir;
    var codeEl = document.getElementById("langCode");
    if (codeEl) codeEl.textContent = meta.code;

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var val = t(key, lang);
      if (el.getAttribute("data-i18n-html") === "1") el.innerHTML = val;
      else el.textContent = val;
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"), lang);
    });

    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"), lang));
    });

    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      el.title = t(el.getAttribute("data-i18n-title"), lang);
    });

    var page = document.getElementById("top");
    var pageKey = page ? page.getAttribute("data-page") : "home";
    var titleKey = "meta." + pageKey + "Title";
    var descKey = "meta." + pageKey + "Desc";
    if (T[lang].meta[pageKey + "Title"]) {
      document.title = t(titleKey, lang);
    }
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && T[lang].meta[pageKey + "Desc"]) {
      metaDesc.content = t(descKey, lang);
    }

    document.dispatchEvent(new CustomEvent("mm:langchange", { detail: { lang: lang } }));
  }

  function getLang() {
    var s = localStorage.getItem("mm-lang");
    return LANGS.indexOf(s) !== -1 ? s : "ckb";
  }

  function cycleLang() {
    var i = LANGS.indexOf(getLang());
    var next = LANGS[(i + 1) % LANGS.length];
    applyLang(next);
    return next;
  }

  function deepMerge(target, source) {
    if (!source || typeof source !== "object") return target;
    Object.keys(source).forEach(function (key) {
      var sv = source[key];
      var tv = target[key];
      if (sv && typeof sv === "object" && !Array.isArray(sv) && tv && typeof tv === "object" && !Array.isArray(tv)) {
        deepMerge(tv, sv);
      } else if (sv !== undefined && sv !== null) {
        target[key] = sv;
      }
    });
    return target;
  }

  function mergeTranslations(remote) {
    if (!remote || typeof remote !== "object") return;
    LANGS.forEach(function (lang) {
      if (remote[lang]) deepMerge(T[lang], remote[lang]);
    });
  }

  function loadFromCms(callback) {
    var api = "https://dashboard.mmiraq.com/api/public/marketing-site/";
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      api = "http://127.0.0.1:8001/api/public/marketing-site/";
    }
    fetch(api)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.is_published && data.translations) mergeTranslations(data.translations);
      })
      .catch(function () {})
      .finally(function () { if (callback) callback(); });
  }

  function init() {
    applyLang(getLang());
  }

  return {
    t: t, applyLang: applyLang, getLang: getLang, cycleLang: cycleLang, init: init,
    mergeTranslations: mergeTranslations, loadFromCms: loadFromCms,
    LANGS: LANGS, T: T
  };
})();
