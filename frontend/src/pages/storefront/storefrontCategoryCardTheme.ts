import type { PublicStorefrontCategory } from '../../api/storefrontApi'

/** Beautiful default gradients when merchant has not set custom colors. */
export const STOREFRONT_CATEGORY_BG_PRESETS = [
  { id: 'violet', from: '#5b21b6', to: '#c4b5fd', labelKey: 'violet' as const },
  { id: 'ocean', from: '#0369a1', to: '#7dd3fc', labelKey: 'ocean' as const },
  { id: 'emerald', from: '#047857', to: '#6ee7b7', labelKey: 'emerald' as const },
  { id: 'sunset', from: '#c2410c', to: '#fdba74', labelKey: 'sunset' as const },
  { id: 'rose', from: '#be123c', to: '#fda4af', labelKey: 'rose' as const },
  { id: 'indigo', from: '#3730a3', to: '#a5b4fc', labelKey: 'indigo' as const },
  { id: 'teal', from: '#0f766e', to: '#5eead4', labelKey: 'teal' as const },
  { id: 'gold', from: '#b45309', to: '#fde68a', labelKey: 'gold' as const },
] as const

export type StorefrontCategoryBgPreset = (typeof STOREFRONT_CATEGORY_BG_PRESETS)[number]

function isHexColor(v: string | null | undefined): v is string {
  return Boolean(v && /^#[0-9A-Fa-f]{6}$/.test(v))
}

export function categoryCardGradient(
  cat: Pick<PublicStorefrontCategory, 'storefront_bg_from' | 'storefront_bg_to'>,
  fallbackIndex = 0,
): string {
  const from = cat.storefront_bg_from
  const to = cat.storefront_bg_to
  if (isHexColor(from) && isHexColor(to)) {
    return `linear-gradient(145deg, ${from} 0%, ${to} 100%)`
  }
  if (isHexColor(from)) {
    return `linear-gradient(145deg, ${from} 0%, ${from}cc 100%)`
  }
  const preset = STOREFRONT_CATEGORY_BG_PRESETS[fallbackIndex % STOREFRONT_CATEGORY_BG_PRESETS.length]
  return `linear-gradient(145deg, ${preset.from} 0%, ${preset.to} 100%)`
}

export function sortStorefrontCategories<T extends PublicStorefrontCategory>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const ao = a.storefront_home_order
    const bo = b.storefront_home_order
    const aHas = ao != null && Number.isFinite(ao)
    const bHas = bo != null && Number.isFinite(bo)
    if (aHas && bHas) return ao - bo
    if (aHas) return -1
    if (bHas) return 1
    const an = (a.name_ku || a.name || '').toLowerCase()
    const bn = (b.name_ku || b.name || '').toLowerCase()
    return an.localeCompare(bn, undefined, { sensitivity: 'base' })
  })
}

export function presetMatchesCategory(
  cat: { storefront_bg_from?: string | null; storefront_bg_to?: string | null },
  preset: StorefrontCategoryBgPreset,
): boolean {
  return (
    (cat.storefront_bg_from || '').toUpperCase() === preset.from.toUpperCase() &&
    (cat.storefront_bg_to || '').toUpperCase() === preset.to.toUpperCase()
  )
}
