import { STOREFRONT_CATEGORY_BG_PRESETS } from './storefrontCategoryCardTheme'
import { STOREFRONT_PAGE_BG } from './storefrontTheme'

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

function normalizeHex(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length === 3) {
    return `#${h
      .split('')
      .map((c) => c + c)
      .join('')}`
  }
  return `#${h.slice(0, 6)}`
}

function mixHex(from: string, to: string, amount: number): string {
  const a = normalizeHex(from)
  const b = normalizeHex(to)
  const t = Math.min(1, Math.max(0, amount))
  const ar = Number.parseInt(a.slice(1, 3), 16)
  const ag = Number.parseInt(a.slice(3, 5), 16)
  const ab = Number.parseInt(a.slice(5, 7), 16)
  const br = Number.parseInt(b.slice(1, 3), 16)
  const bg = Number.parseInt(b.slice(3, 5), 16)
  const bb = Number.parseInt(b.slice(5, 7), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`
}

export function sectionPreset(sectionKey: StorefrontSectionKey) {
  return STOREFRONT_CATEGORY_BG_PRESETS[
    SECTION_PRESET_INDEX[sectionKey] % STOREFRONT_CATEGORY_BG_PRESETS.length
  ]
}

/** Dark at top → fades into storefront page background at bottom. */
export function sectionPanelGradient(sectionKey: StorefrontSectionKey): string {
  const { from, to } = sectionPreset(sectionKey)
  const mid = mixHex(from, to, 0.4)
  const light = mixHex(to, STOREFRONT_PAGE_BG, 0.4)
  const pale = mixHex(to, STOREFRONT_PAGE_BG, 0.78)
  const blend = mixHex(to, STOREFRONT_PAGE_BG, 0.94)
  return [
    `linear-gradient(180deg,`,
    `${from} 0%,`,
    `${mixHex(from, mid, 0.28)} 10%,`,
    `${mid} 26%,`,
    `${light} 46%,`,
    `${pale} 62%,`,
    `${blend} 76%,`,
    `${STOREFRONT_PAGE_BG} 90%,`,
    `${STOREFRONT_PAGE_BG} 100%)`,
  ].join(' ')
}

export function sectionPanelShadow(sectionKey: StorefrontSectionKey): string {
  const { from } = sectionPreset(sectionKey)
  const rgb = normalizeHex(from)
  const r = Number.parseInt(rgb.slice(1, 3), 16)
  const g = Number.parseInt(rgb.slice(3, 5), 16)
  const b = Number.parseInt(rgb.slice(5, 7), 16)
  return `0 10px 36px rgba(${r}, ${g}, ${b}, 0.14)`
}
