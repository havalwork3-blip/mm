import type { Lang } from '../../i18n/strings'

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
    categoriesCount: '{n} پۆل',
    productCount: '{n} بەرهەم',
    addToCart: 'زیادکردن بۆ سەبەتە',
    inCart: 'لە سەبەتەدا',
    cart: 'سەبەتە',
    cartEmpty: 'سەبەتەکەت بەتاڵە',
    cartEmptyHint: 'بەرهەمێک زیاد بکە بۆ دەستپێکردن',
    total: 'کۆی گشتی',
    proceedCheckout: 'بەردەوامبوون بۆ داواکاری',
    checkout: 'تەواوکردنی داواکاری',
    customerName: 'ناو',
    customerPhone: 'ژمارەی مۆبایل',
    customerAddress: 'ناونیشان',
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
    categoriesCount: '{n} أقسام',
    productCount: '{n} منتج',
    addToCart: 'أضف إلى السلة',
    inCart: 'في السلة',
    cart: 'السلة',
    cartEmpty: 'سلتك فارغة',
    cartEmptyHint: 'أضف منتجاً للبدء',
    total: 'المجموع',
    proceedCheckout: 'متابعة الطلب',
    checkout: 'إتمام الطلب',
    customerName: 'الاسم',
    customerPhone: 'رقم الهاتف',
    customerAddress: 'العنوان',
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
    categoriesCount: '{n} categories',
    productCount: '{n} products',
    addToCart: 'Add to cart',
    inCart: 'In cart',
    cart: 'Cart',
    cartEmpty: 'Your cart is empty',
    cartEmptyHint: 'Add a product to get started',
    total: 'Total',
    proceedCheckout: 'Proceed to checkout',
    checkout: 'Checkout',
    customerName: 'Name',
    customerPhone: 'Phone',
    customerAddress: 'Address',
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
  shopTagline: string
  catalogTitle: string
  catalogSubtitle: string
  categoriesCount: string
  productCount: string
  addToCart: string
  inCart: string
  cart: string
  cartEmpty: string
  cartEmptyHint: string
  total: string
  proceedCheckout: string
  checkout: string
  customerName: string
  customerPhone: string
  customerAddress: string
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
