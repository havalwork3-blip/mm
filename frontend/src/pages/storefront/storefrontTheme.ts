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

export function accentAlpha(accent: string, alpha: number): string {
  return `rgba(${accentRgb(accent)}, ${alpha})`
}
