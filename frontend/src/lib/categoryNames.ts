import type { Lang } from '../i18n/strings'

export type CategoryNames = {
  name?: string
  name_ku?: string
  name_ar?: string
  name_en?: string
}

/** Pick storefront/admin label for the active UI language. */
export function categoryDisplayName(cat: CategoryNames, lang: Lang): string {
  const ku = (cat.name_ku || cat.name || '').trim()
  if (lang === 'ar') {
    const ar = (cat.name_ar || '').trim()
    if (ar) return ar
  }
  if (lang === 'en') {
    const en = (cat.name_en || '').trim()
    if (en) return en
  }
  return ku
}
