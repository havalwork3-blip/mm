import { STOREFRONT_CATEGORY_BG_PRESETS } from './storefrontCategoryCardTheme'

/** One shared panel background per home section (not per card). */
export type StorefrontSectionKey =
  | 'categories'
  | 'recently_viewed'
  | 'bestsellers'
  | 'new_arrivals'
  | 'on_sale'
  | 'available_now'

const SECTION_PRESET_INDEX: Record<StorefrontSectionKey, number> = {
  categories: 0,
  recently_viewed: 4,
  bestsellers: 2,
  new_arrivals: 1,
  on_sale: 3,
  available_now: 6,
}

export function sectionPanelGradient(sectionKey: StorefrontSectionKey): string {
  const preset =
    STOREFRONT_CATEGORY_BG_PRESETS[
      SECTION_PRESET_INDEX[sectionKey] % STOREFRONT_CATEGORY_BG_PRESETS.length
    ]
  return `linear-gradient(145deg, ${preset.from} 0%, ${preset.to} 100%)`
}
