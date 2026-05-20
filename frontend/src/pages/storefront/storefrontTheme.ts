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
export const SF_MAIN = 'mx-auto w-full max-w-[100%] lg:max-w-6xl xl:max-w-7xl'

export const SF_SHELL = [
  SF_MAIN,
  'px-[max(1rem,env(safe-area-inset-left))]',
  'pe-[max(1rem,env(safe-area-inset-right))]',
  'sm:px-6',
  'md:px-8',
].join(' ')

export const SF_INSET_X =
  'px-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))] sm:px-6 md:px-8'

export const SF_PRODUCT_GRID =
  'grid grid-cols-2 gap-3 min-[380px]:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-5 xl:grid-cols-6'

export const SF_CATEGORY_GRID =
  'hidden gap-3 md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
