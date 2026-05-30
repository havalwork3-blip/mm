import type { LucideIcon } from 'lucide-react'
import {
  FileText,
  Globe,
  Home,
  Image,
  LayoutGrid,
  Mail,
  Package,
  Search,
  Settings,
  Sparkles,
  Store,
} from 'lucide-react'

export type Lang = 'ckb' | 'ar' | 'en'

export const LANG_LABELS: Record<Lang, string> = {
  ckb: 'کوردی',
  ar: 'عەرەبی',
  en: 'English',
}

export type CmsSection = {
  id: string
  label: string
  icon: LucideIcon
  /** Top-level translation key */
  key: string
  pageSection?: string
}

export type CmsNavGroup = {
  label: string
  items: CmsSection[]
}

export const CMS_NAV_GROUPS: CmsNavGroup[] = [
  {
    label: 'ماڵپەڕی سەرەکی',
    items: [
      { id: 'hero', label: 'بانێر / Hero', icon: Image, key: 'hero', pageSection: 'hero' },
      { id: 'feat', label: 'تایبەتمەندییەکان', icon: Sparkles, key: 'feat', pageSection: 'features' },
      { id: 'homeAbout', label: 'دەربارە (سەرەکی)', icon: Home, key: 'homeAbout', pageSection: 'homeAbout' },
      { id: 'explore', label: 'گەڕان / Explore', icon: LayoutGrid, key: 'explore', pageSection: 'explore' },
      { id: 'showcase', label: 'کارتی گەڕان', icon: LayoutGrid, key: 'showcase' },
    ],
  },
  {
    label: 'ڕووکار',
    items: [
      { id: 'ui', label: 'دوگمە و UI', icon: Settings, key: 'ui' },
      { id: 'nav', label: 'ناڤیگەیشن', icon: Globe, key: 'nav' },
      { id: 'footer', label: 'فووتەر', icon: FileText, key: 'footer' },
      { id: 'search', label: 'گەڕان', icon: Search, key: 'search' },
      { id: 'cta', label: 'دوگمەکانی CTA', icon: Sparkles, key: 'cta' },
    ],
  },
  {
    label: 'پەڕەکان',
    items: [
      { id: 'luxury', label: 'لوکس', icon: Store, key: 'luxury', pageSection: 'luxury' },
      { id: 'tech', label: 'تەکنەلۆژیا', icon: Package, key: 'tech', pageSection: 'tech' },
      { id: 'shop', label: 'شۆپ', icon: Store, key: 'shop', pageSection: 'shop' },
      { id: 'services', label: 'خزمەتگوزاری', icon: Settings, key: 'services', pageSection: 'services' },
      { id: 'about', label: 'دەربارە', icon: FileText, key: 'about', pageSection: 'about' },
      { id: 'terms', label: 'مەرجەکان', icon: FileText, key: 'terms', pageSection: 'terms' },
      { id: 'contact', label: 'دەقی پەیوەندی', icon: Mail, key: 'contact', pageSection: 'contact' },
    ],
  },
  {
    label: 'زیادە',
    items: [
      { id: 'products', label: 'ناوی کاڵاکان', icon: Package, key: 'products' },
      { id: 'tag', label: 'تاگەکان', icon: Sparkles, key: 'tag' },
      { id: 'meta', label: 'SEO / Meta', icon: Globe, key: 'meta' },
      { id: 'sections', label: 'ناونیشانی بەشەکان', icon: FileText, key: 'sections' },
    ],
  },
]

export const CMS_SECTION_MAP = Object.fromEntries(
  CMS_NAV_GROUPS.flatMap((g) => g.items.map((s) => [s.id, s])),
) as Record<string, CmsSection>

export const PAGE_SECTION_LABELS: Record<string, string> = {
  hero: 'بانێر',
  features: 'تایبەتمەندی',
  homeAbout: 'دەربارە',
  explore: 'گەڕان',
  luxury: 'لوکس',
  tech: 'تەکنە',
  shop: 'شۆپ',
  services: 'خزمەتگوزاری',
  about: 'دەربارە',
  terms: 'مەرج',
  contact: 'پەیوەندی',
}

/** Human-readable labels for common field keys */
export const FIELD_LABELS: Record<string, string> = {
  title: 'ناونیشان',
  sub: 'ژێرناونیشان',
  label: 'لەیبڵ',
  lead: 'دەقی سەرەکی',
  tagline: 'تاگلاین',
  copy: 'مافی چاپ',
  line2: 'هێڵی ٢',
  placeholder: 'placeholder',
  hint: 'ڕێنمایی',
  h1: 'سەرناون (HTML)',
  h1sub: 'ژێرناون ١',
  h2: 'سلاید ٢ (HTML)',
  h2sub: 'ژێرناون ٢',
  h3: 'سلاید ٣ (HTML)',
  h3sub: 'ژێرناون ٣',
  name: 'ناو',
  email: 'ئیمەیڵ',
  msg: 'پەیام',
  send: 'دوگمەی ناردن',
  note: 'تێبینی فۆرم',
  ok: 'پەیامی سەرکەوتن',
  mailSub: 'بابەتی ئیمەیڵ',
  namePh: 'placeholder ناو',
  msgPh: 'placeholder پەیام',
  store: 'فرۆشگا',
  region: 'ناوچە',
  regionV: 'نرخی ناوچە',
  tg: 'تێلیگرام',
  tgV: 'نرخی تێلیگرام',
}
