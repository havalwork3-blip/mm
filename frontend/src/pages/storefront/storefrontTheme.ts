import type { CSSProperties } from 'react'

/** Talabat-inspired light storefront theme (accent from shop settings). */

export const DEFAULT_ACCENT = '#FF5A00'

export function resolveAccent(color?: string | null): string {
  const c = color?.trim()
  if (!c || !/^#[0-9A-Fa-f]{3,8}$/.test(c)) return DEFAULT_ACCENT
  return c
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((x) => x + x)
          .join('')
      : h.length >= 6
        ? h.slice(0, 6)
        : null
  if (!full) return null
  const n = Number.parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function accentRgb(accent: string): string {
  const rgb = hexToRgb(accent)
  return rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '255, 90, 0'
}

/** CSS custom properties for storefront root */
export function storefrontCssVars(accent: string): CSSProperties {
  return {
    '--sf-accent': accent,
    '--sf-accent-rgb': accentRgb(accent),
  } as CSSProperties
}

export function accentAlpha(accent: string, alpha: number): string {
  return `rgba(${accentRgb(accent)}, ${alpha})`
}

/** Max width scales with viewport; content areas add SF_INSET_X for padding. */
export const SF_MAIN = 'mx-auto w-full max-w-[100%] lg:max-w-[1280px] xl:max-w-[1400px]'

export const SF_SHELL = [
  SF_MAIN,
  'px-[max(1rem,env(safe-area-inset-left))]',
  'pe-[max(1rem,env(safe-area-inset-right))]',
  'sm:px-6',
  'md:px-8',
].join(' ')

/** Full-width desktop header bar (wider than main content column). */
export const SF_DESKTOP_SHELL = [
  'mx-auto w-full max-w-[1400px]',
  'px-6',
  'xl:px-10',
].join(' ')

export const SF_INSET_X =
  'px-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))] sm:px-6 md:px-8'

export const SF_PRODUCT_GRID =
  'grid grid-cols-2 gap-3 min-[380px]:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5 2xl:grid-cols-6'

/** Home collection rows — full grid on tablet/desktop (no horizontal scroll). */
export const SF_COLLECTION_GRID =
  'sf-collection-grid grid grid-cols-2 gap-3 min-[380px]:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5'

/** Horizontal scroll row inside home section panels. */
export const SF_SECTION_SCROLL_ROW =
  'sf-section-scroll-row sf-scrollbar-none flex flex-nowrap gap-3.5 overflow-x-auto px-1 pb-1 sm:gap-4 md:gap-5'

export const SF_SECTION_PRODUCT_WIDTH = 'w-[9.25rem] shrink-0 sm:w-[10rem] lg:w-[10.75rem]'

export const SF_SECTION_CAT_WIDTH = 'w-[7rem] shrink-0 min-[380px]:w-[7.5rem] sm:w-[8rem] lg:w-[8.5rem]'
