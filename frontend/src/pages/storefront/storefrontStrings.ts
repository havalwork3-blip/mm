import type { Lang } from '../../i18n/strings'
import type { StorefrontSocialPlatform } from '../../lib/storefrontSocial'

const SOCIAL_KU: Record<StorefrontSocialPlatform, string> = {
  facebook: 'فەیسبووک',
  instagram: 'ئینستاگرام',
  tiktok: 'تیکتۆک',
  youtube: 'یوتیوب',
  twitter: 'ئێکس',
  telegram: 'تێلێگرام',
  whatsapp: 'واتسئاپ',
  snapchat: 'سناپچات',
  website: 'ماڵپەڕ',
}

const SOCIAL_AR: Record<StorefrontSocialPlatform, string> = {
  facebook: 'فيسبوك',
  instagram: 'إنستغرام',
  tiktok: 'تيك توك',
  youtube: 'يوتيوب',
  twitter: 'إكس',
  telegram: 'تيليغرام',
  whatsapp: 'واتساب',
  snapchat: 'سناب شات',
  website: 'الموقع',
}

const SOCIAL_EN: Record<StorefrontSocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'X',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  snapchat: 'Snapchat',
  website: 'Website',
}

const STRINGS = {
  ku: {
    hello: 'سڵاو',
    searchPlaceholder: 'گەڕان بۆ بەرهەم…',
    categories: 'پۆلەکان',
    viewAll: 'هەمووی ببینە',
    offers: 'پێشکەشەکان',
    shopNow: 'ئێستا بکڕە',
    home: 'سەرەکی',
    shopTagline: 'ئێکسسواراتی مۆدێرن و ناوازە',
    catalogTitle: 'بەرهەمەکان',
    catalogSubtitle: 'هەڵبژاردە بکە و داواکاری بنێرە',
    promoDefault: 'گەیاندنی خێرا · داواکاری ئاسان',
    allCategories: 'هەموو',
    allProducts: 'هەموو بەرهەمەکان',
    popular: 'بەناوبانگ',
    deliveryFast: 'گەیاندنی خێرا',
    orderEasy: 'داواکاری ئاسان',
    support: 'پەیوەندی ئاسان',
    contactUs: 'پەیوەندیمان پێوە بکە',
    aboutUs: 'دەربارەی ئێمە',
    faq: 'پرسیارە باوەکان',
    shopLocation: 'ناونیشانی دووکان',
    openMap: 'کردنەوەی نەخشە',
    menu: 'مێنوو',
    menuInfo: 'زانیاری',
    infoEmpty: 'هێشتا ناوەڕۆک زیاد نەکراوە.',
    iqd: 'دینار',
    currencyLabel: 'دراو',
    language: 'زمان',
    lightMode: 'دۆخی ڕووناک',
    darkMode: 'دۆخی تاریک',
    followUs: 'شوێنمان بکەوە',
    appearance: 'ڕووکار',
    searchNoResults: 'هیچ بەرهەمێک نەدۆزرایەوە',
    searchTypeHint: 'یەک پیت بنووسە بۆ بینینی بەرهەمەکان',
    socialPlatforms: SOCIAL_KU,
    scrollToProducts: 'بەرهەمەکان',
    categoriesCount: '{n} پۆل',
    productCount: '{n} بەرهەم',
    addToCart: 'زیادکردن بۆ سەبەتە',
    inCart: 'لە سەبەتەدا',
    viewCart: 'بینینی سەبەتە',
    cart: 'سەبەتە',
    cartEmpty: 'سەبەتەکەت بەتاڵە',
    cartEmptyHint: 'بەرهەمێک زیاد بکە بۆ دەستپێکردن',
    subtotal: 'کۆی بەرهەمەکان',
    deliveryFee: 'کرێی گەیاندن',
    deliveryArea: 'ناوچەی گەیاندن',
    selectDeliveryArea: 'ناوچە هەڵبژێرە',
    deliveryAreaRequired: 'تکایە ناوچەی گەیاندن هەڵبژێرە',
    deliveryFree: 'گەیاندن خۆڕاییە',
    deliveryFreeHint: 'گەیاندن خۆڕاییە لە {amount} زیاتر',
    deliveryFreeRemaining: 'بۆ گەیاندنی خۆڕایی {amount} زیاتر بکڕە',
    total: 'کۆی گشتی',
    proceedCheckout: 'بەردەوامبوون بۆ داواکاری',
    checkout: 'تەواوکردنی داواکاری',
    customerName: 'ناو',
    customerPhone: 'ژمارەی مۆبایل',
    customerAddress: 'ناونیشان',
    useMyLocation: 'شوێنەکەم دیاری بکە',
    locating: 'دیاریکردنی شوێن…',
    locationUnsupported: 'وێبگەڕەکەت پشتیوانی شوێن ناکات',
    locationDenied: 'ڕێگەی شوێن نەدراوە — لە ڕێکخستنەکاندا چالاکی بکە',
    locationUnavailable: 'نەتوانرا شوێن بدۆزرێتەوە، دووبارە هەوڵبدەرەوە',
    locationTimeout: 'کات تەواو بوو — دووبارە هەوڵبدەرەوە',
    openOnMap: 'کردنەوە لە نەخشە',
    submitOrder: 'ناردنی داواکاری',
    submitting: 'ناردن…',
    successTitle: 'داواکاریەکەت وەرگیرا!',
    successBody: 'سوپاس! بەم زووانە پەیوەندیت پێوە دەکەین.',
    close: 'داخستن',
    loading: 'بارکردن…',
    loadError: 'نەتوانرا بەرهەمەکان بار بکرێن',
    retry: 'دووبارە هەوڵبدەرەوە',
    noProducts: 'ئێستا هیچ بەرهەمێک بەردەست نییە',
    required: 'پڕکردنەوەی ئەم خانەیە پێویستە',
    orderError: 'ناردنی داواکاری سەرکەوتوو نەبوو',
    usd: 'USD',
    decrease: 'کەمکردنەوە',
    increase: 'زیادکردن',
    remove: 'لابردن',
    quantity: 'ژمارە',
    pickCategory: 'پۆلێک هەڵبژێرە',
    pickCategoryHint: 'پۆلێک بکە بۆ بینینی بەرهەمەکان',
    viewAllProducts: 'هەموو بەرهەمەکان ببینە',
    backToCategories: 'گەڕانەوە بۆ پۆلەکان',
    filterByCategory: 'فلتەر بە پۆل',
    noProductsInCategory: 'لەم پۆلەدا بەرهەم نییە',
    searchResults: 'ئەنجام بۆ «{q}»',
    addedToCart: 'زیادکرا!',
    tapToAdd: 'کلیک بکە بۆ زیادکردن',
    viewProduct: 'وردەکاری',
    productDetails: 'وردەکاری بەرهەم',
    orderNow: 'زیادکردن بۆ سەبەتە',
    backToProducts: 'گەڕانەوە',
    shopCategories: 'پۆلەکانی فرۆشگا',
    outOfStock: 'نەماوە',
    discontinued: 'وەستاوە',
    unavailable: 'بەردەست نییە',
    unavailableHint: 'ئەم بەرهەمە ئێستا بەردەست نییە. دواتر سەیری بکەرەوە یان پەیوەندیمان پێوە بکە.',
    cannotOrder: 'ناتوانیت داوا بکەیت',
    shopHighlights: 'تایبەتمەندیەکان',
    bestsellers: 'پرفرۆشترین',
    bestsellersHint: 'زۆرترین فرۆشراو',
    newArrivals: 'نوێترین',
    newArrivalsHint: 'تازە گەیشتووە',
    onSale: 'داشکاندن',
    onSaleHint: 'نرخی تایبەت',
    availableNow: 'ئێستا بەردەستە',
    availableNowHint: 'دڵخواز · سەبەتە · هاوشێوە — تێکەڵاو',
    myFavorites: 'دڵخوازەکانم',
    myFavoritesHint: 'لیستی تۆ',
    addToFavorites: 'زیادکردن بۆ دڵخواز',
    removeFromFavorites: 'لابردن لە دڵخواز',
    favoritesEmpty: 'هێشتا دڵخوازت نییە',
    favoritesEmptyHint: 'لەسەر دڵ بگرە بۆ پاشەکەوتکردن',
    sort: 'فلتەرکردن',
    sortDefault: 'بنەڕەت',
    sortPriceAsc: 'نرخ: کەم بۆ زۆر',
    sortPriceDesc: 'نرخ: زۆر بۆ کەم',
    sortName: 'ناو',
    sortNewest: 'نوێترین',
    filterInStock: 'بەردەست',
    filterOnSale: 'داشکاندن',
    clearFilters: 'پاککردنەوە',
    customerNotes: 'تێبینی (ئارەزوومەندانە)',
    customerNotesPlaceholder: 'کاتێکی گەیاندن، ڕێنمایی، …',
    orderNumber: 'ژمارەی داواکاری: #{id}',
    orderWhatsApp: 'پەیوەندی لە واتسئاپ',
    shareProduct: 'هاوبەشکردنی بەرهەم',
    linkCopied: 'لینک کۆپی کرا',
    recentlyViewed: 'دواین بیندراوەکان',
    relatedProducts: 'بەرهەمە پەیوەندیدارەکان',
  },
  ar: {
    hello: 'مرحباً',
    searchPlaceholder: 'ابحث عن منتج…',
    categories: 'الأقسام',
    viewAll: 'عرض الكل',
    offers: 'العروض',
    shopNow: 'تسوق الآن',
    home: 'الرئيسية',
    shopTagline: 'إكسسوارات عصرية ومميزة',
    catalogTitle: 'المنتجات',
    catalogSubtitle: 'اختر وأرسل طلبك',
    promoDefault: 'توصيل سريع · طلب سهل',
    allCategories: 'الكل',
    allProducts: 'كل المنتجات',
    popular: 'شائع',
    deliveryFast: 'توصيل سريع',
    orderEasy: 'طلب سهل',
    support: 'دعم سريع',
    contactUs: 'اتصل بنا',
    aboutUs: 'من نحن',
    faq: 'الأسئلة الشائعة',
    shopLocation: 'موقع المتجر',
    openMap: 'فتح الخريطة',
    menu: 'القائمة',
    menuInfo: 'معلومات',
    infoEmpty: 'لم يُضف محتوى بعد.',
    iqd: 'دينار',
    currencyLabel: 'العملة',
    language: 'اللغة',
    lightMode: 'الوضع الفاتح',
    darkMode: 'الوضع الداكن',
    followUs: 'تابعنا',
    appearance: 'المظهر',
    searchNoResults: 'لم يُعثر على منتجات',
    searchTypeHint: 'اكتب حرفاً واحداً لعرض المنتجات',
    socialPlatforms: SOCIAL_AR,
    scrollToProducts: 'المنتجات',
    categoriesCount: '{n} أقسام',
    productCount: '{n} منتج',
    addToCart: 'أضف إلى السلة',
    inCart: 'في السلة',
    viewCart: 'عرض السلة',
    cart: 'السلة',
    cartEmpty: 'سلتك فارغة',
    cartEmptyHint: 'أضف منتجاً للبدء',
    subtotal: 'مجموع المنتجات',
    deliveryFee: 'رسوم التوصيل',
    deliveryArea: 'منطقة التوصيل',
    selectDeliveryArea: 'اختر المنطقة',
    deliveryAreaRequired: 'يرجى اختيار منطقة التوصيل',
    deliveryFree: 'توصيل مجاني',
    deliveryFreeHint: 'توصيل مجاني للطلبات فوق {amount}',
    deliveryFreeRemaining: 'أضف {amount} للحصول على توصيل مجاني',
    total: 'المجموع',
    proceedCheckout: 'متابعة الطلب',
    checkout: 'إتمام الطلب',
    customerName: 'الاسم',
    customerPhone: 'رقم الهاتف',
    customerAddress: 'العنوان',
    useMyLocation: 'تحديد موقعي',
    locating: 'جارٍ تحديد الموقع…',
    locationUnsupported: 'المتصفح لا يدعم تحديد الموقع',
    locationDenied: 'لم يُسمح بالموقع — فعّله من الإعدادات',
    locationUnavailable: 'تعذر تحديد الموقع، حاول مرة أخرى',
    locationTimeout: 'انتهت المهلة — حاول مرة أخرى',
    openOnMap: 'فتح على الخريطة',
    submitOrder: 'إرسال الطلب',
    submitting: 'جارٍ الإرسال…',
    successTitle: 'تم استلام طلبك!',
    successBody: 'شكراً! سنتواصل معك قريباً.',
    close: 'إغلاق',
    loading: 'جارٍ التحميل…',
    loadError: 'تعذر تحميل المنتجات',
    retry: 'إعادة المحاولة',
    noProducts: 'لا توجد منتجات متاحة حالياً',
    required: 'هذا الحقل مطلوب',
    orderError: 'فشل إرسال الطلب',
    usd: 'USD',
    decrease: 'تقليل',
    increase: 'زيادة',
    remove: 'إزالة',
    quantity: 'الكمية',
    pickCategory: 'اختر قسماً',
    pickCategoryHint: 'اضغط على قسم لعرض منتجاته',
    viewAllProducts: 'عرض كل المنتجات',
    backToCategories: 'العودة إلى الأقسام',
    filterByCategory: 'تصفية حسب القسم',
    noProductsInCategory: 'لا توجد منتجات في هذا القسم',
    searchResults: 'نتائج «{q}»',
    addedToCart: 'تمت الإضافة!',
    tapToAdd: 'اضغط للإضافة',
    viewProduct: 'التفاصيل',
    productDetails: 'تفاصيل المنتج',
    orderNow: 'أضف إلى السلة',
    backToProducts: 'رجوع',
    shopCategories: 'أقسام المتجر',
    outOfStock: 'نفد المخزون',
    discontinued: 'غير متوفر',
    unavailable: 'غير متاح',
    unavailableHint: 'هذا المنتج غير متاح حالياً. تحقق لاحقاً أو تواصل معنا.',
    cannotOrder: 'لا يمكن الطلب',
    shopHighlights: 'مميز',
    bestsellers: 'الأكثر مبيعاً',
    bestsellersHint: 'الأكثر طلباً',
    newArrivals: 'وصل حديثاً',
    newArrivalsHint: 'منتجات جديدة',
    onSale: 'تخفيضات',
    onSaleHint: 'أسعار خاصة',
    availableNow: 'متوفر الآن',
    availableNowHint: 'مفضلة · السلة · مشابه — مختلط',
    myFavorites: 'مفضلتي',
    myFavoritesHint: 'قائمتك',
    addToFavorites: 'إضافة للمفضلة',
    removeFromFavorites: 'إزالة من المفضلة',
    favoritesEmpty: 'لا مفضلات بعد',
    favoritesEmptyHint: 'اضغط القلب لحفظ المنتج',
    sort: 'ترتيب',
    sortDefault: 'افتراضي',
    sortPriceAsc: 'السعر: من الأقل',
    sortPriceDesc: 'السعر: من الأعلى',
    sortName: 'الاسم',
    sortNewest: 'الأحدث',
    filterInStock: 'متوفر',
    filterOnSale: 'تخفيض',
    clearFilters: 'مسح الفلاتر',
    customerNotes: 'ملاحظة (اختياري)',
    customerNotesPlaceholder: 'وقت التوصيل، تعليمات، …',
    orderNumber: 'رقم الطلب: #{id}',
    orderWhatsApp: 'تواصل عبر واتساب',
    shareProduct: 'مشاركة المنتج',
    linkCopied: 'تم نسخ الرابط',
    recentlyViewed: 'شوهد مؤخراً',
    relatedProducts: 'منتجات ذات صلة',
  },
  en: {
    hello: 'Hello',
    searchPlaceholder: 'Search products…',
    categories: 'Categories',
    viewAll: 'View all',
    offers: 'Offers',
    shopNow: 'Shop now',
    home: 'Home',
    shopTagline: 'Modern & unique accessories',
    catalogTitle: 'Products',
    catalogSubtitle: 'Browse and place your order',
    promoDefault: 'Fast delivery · Easy ordering',
    allCategories: 'All',
    allProducts: 'All products',
    popular: 'Popular',
    deliveryFast: 'Fast delivery',
    orderEasy: 'Easy order',
    support: 'Quick support',
    contactUs: 'Contact us',
    aboutUs: 'About us',
    faq: 'FAQ',
    shopLocation: 'Store location',
    openMap: 'Open map',
    menu: 'Menu',
    menuInfo: 'Info',
    infoEmpty: 'No content added yet.',
    iqd: 'IQD',
    currencyLabel: 'Currency',
    language: 'Language',
    lightMode: 'Light mode',
    darkMode: 'Dark mode',
    followUs: 'Follow us',
    appearance: 'Appearance',
    searchNoResults: 'No products found',
    searchTypeHint: 'Type one letter to see matching products',
    socialPlatforms: SOCIAL_EN,
    scrollToProducts: 'Products',
    categoriesCount: '{n} categories',
    productCount: '{n} products',
    addToCart: 'Add to cart',
    inCart: 'In cart',
    viewCart: 'View cart',
    cart: 'Cart',
    cartEmpty: 'Your cart is empty',
    cartEmptyHint: 'Add a product to get started',
    subtotal: 'Subtotal',
    deliveryFee: 'Delivery fee',
    deliveryArea: 'Delivery area',
    selectDeliveryArea: 'Select area',
    deliveryAreaRequired: 'Please select a delivery area',
    deliveryFree: 'Free delivery',
    deliveryFreeHint: 'Free delivery on orders over {amount}',
    deliveryFreeRemaining: 'Add {amount} more for free delivery',
    total: 'Total',
    proceedCheckout: 'Proceed to checkout',
    checkout: 'Checkout',
    customerName: 'Name',
    customerPhone: 'Phone',
    customerAddress: 'Address',
    useMyLocation: 'Use my location',
    locating: 'Getting location…',
    locationUnsupported: 'Your browser does not support location',
    locationDenied: 'Location permission denied — enable it in settings',
    locationUnavailable: 'Could not get location, try again',
    locationTimeout: 'Timed out — try again',
    openOnMap: 'Open on map',
    submitOrder: 'Place order',
    submitting: 'Submitting…',
    successTitle: 'Order received!',
    successBody: 'Thank you! We will contact you shortly.',
    close: 'Close',
    loading: 'Loading…',
    loadError: 'Could not load products',
    retry: 'Retry',
    noProducts: 'No products available right now',
    required: 'This field is required',
    orderError: 'Could not submit order',
    usd: 'USD',
    decrease: 'Decrease',
    increase: 'Increase',
    remove: 'Remove',
    quantity: 'Qty',
    pickCategory: 'Pick a category',
    pickCategoryHint: 'Tap a category to browse its products',
    viewAllProducts: 'View all products',
    backToCategories: 'Back to categories',
    filterByCategory: 'Filter by category',
    noProductsInCategory: 'No products in this category',
    searchResults: 'Results for "{q}"',
    addedToCart: 'Added!',
    tapToAdd: 'Tap to add',
    viewProduct: 'View',
    productDetails: 'Product details',
    orderNow: 'Add to cart',
    backToProducts: 'Back',
    shopCategories: 'Shop categories',
    outOfStock: 'Out of stock',
    discontinued: 'No longer available',
    unavailable: 'Unavailable',
    unavailableHint: 'This item is not available right now. Check back later or contact the shop.',
    cannotOrder: 'Cannot order',
    shopHighlights: 'Highlights',
    bestsellers: 'Best sellers',
    bestsellersHint: 'Top ordered items',
    newArrivals: 'New arrivals',
    newArrivalsHint: 'Fresh in store',
    onSale: 'On sale',
    onSaleHint: 'Special prices',
    availableNow: 'In stock',
    availableNowHint: 'Favorites · cart · similar — mixed for you',
    myFavorites: 'My favorites',
    myFavoritesHint: 'Your saved list',
    addToFavorites: 'Add to favorites',
    removeFromFavorites: 'Remove from favorites',
    favoritesEmpty: 'No favorites yet',
    favoritesEmptyHint: 'Tap the heart on any product to save it here',
    sort: 'Sort',
    sortDefault: 'Default',
    sortPriceAsc: 'Price: low to high',
    sortPriceDesc: 'Price: high to low',
    sortName: 'Name',
    sortNewest: 'Newest',
    filterInStock: 'In stock',
    filterOnSale: 'On sale',
    clearFilters: 'Clear filters',
    customerNotes: 'Note (optional)',
    customerNotesPlaceholder: 'Delivery time, instructions, …',
    orderNumber: 'Order #{id}',
    orderWhatsApp: 'Contact on WhatsApp',
    shareProduct: 'Share product',
    linkCopied: 'Link copied',
    recentlyViewed: 'Recently viewed',
    relatedProducts: 'Related products',
  },
}

export type StorefrontStrings = {
  hello: string
  searchPlaceholder: string
  categories: string
  viewAll: string
  offers: string
  shopNow: string
  home: string
  promoDefault: string
  allCategories: string
  allProducts: string
  popular: string
  deliveryFast: string
  orderEasy: string
  support: string
  contactUs: string
  aboutUs: string
  faq: string
  shopLocation: string
  openMap: string
  menu: string
  menuInfo: string
  infoEmpty: string
  iqd: string
  currencyLabel: string
  language: string
  lightMode: string
  darkMode: string
  followUs: string
  appearance: string
  searchNoResults: string
  searchTypeHint: string
  socialPlatforms: Record<StorefrontSocialPlatform, string>
  scrollToProducts: string
  shopTagline: string
  catalogTitle: string
  catalogSubtitle: string
  categoriesCount: string
  productCount: string
  addToCart: string
  inCart: string
  viewCart: string
  cart: string
  cartEmpty: string
  cartEmptyHint: string
  subtotal: string
  deliveryFee: string
  deliveryArea: string
  selectDeliveryArea: string
  deliveryAreaRequired: string
  deliveryFree: string
  deliveryFreeHint: string
  deliveryFreeRemaining: string
  total: string
  proceedCheckout: string
  checkout: string
  customerName: string
  customerPhone: string
  customerAddress: string
  useMyLocation: string
  locating: string
  locationUnsupported: string
  locationDenied: string
  locationUnavailable: string
  locationTimeout: string
  openOnMap: string
  submitOrder: string
  submitting: string
  successTitle: string
  successBody: string
  close: string
  loading: string
  loadError: string
  retry: string
  noProducts: string
  required: string
  orderError: string
  usd: string
  decrease: string
  increase: string
  remove: string
  quantity: string
  pickCategory: string
  pickCategoryHint: string
  viewAllProducts: string
  backToCategories: string
  filterByCategory: string
  noProductsInCategory: string
  searchResults: string
  addedToCart: string
  tapToAdd: string
  viewProduct: string
  productDetails: string
  orderNow: string
  backToProducts: string
  shopCategories: string
  outOfStock: string
  discontinued: string
  unavailable: string
  unavailableHint: string
  cannotOrder: string
  shopHighlights: string
  bestsellers: string
  bestsellersHint: string
  newArrivals: string
  newArrivalsHint: string
  onSale: string
  onSaleHint: string
  availableNow: string
  availableNowHint: string
  myFavorites: string
  myFavoritesHint: string
  addToFavorites: string
  removeFromFavorites: string
  favoritesEmpty: string
  favoritesEmptyHint: string
  sort: string
  sortDefault: string
  sortPriceAsc: string
  sortPriceDesc: string
  sortName: string
  sortNewest: string
  filterInStock: string
  filterOnSale: string
  clearFilters: string
  customerNotes: string
  customerNotesPlaceholder: string
  orderNumber: string
  orderWhatsApp: string
  shareProduct: string
  linkCopied: string
  recentlyViewed: string
  relatedProducts: string
}

export function storefrontStrings(lang: Lang): StorefrontStrings {
  if (lang === 'ar') return STRINGS.ar
  if (lang === 'en') return STRINGS.en
  return STRINGS.ku
}

export function formatUsd(amount: number): string {
  const fixed = amount.toFixed(2)
  const trimmed = fixed.replace(/\.?0+$/, '')
  return trimmed
}
