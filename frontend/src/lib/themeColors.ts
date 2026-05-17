import type { ShopSettingsRow } from '../types/api'

export type ThemePalette = {
  primaryColor: string
  accentColor: string
  backgroundColor: string
  darkBackgroundColor: string
  sidebarColor: string
  surfaceColor: string
  surfaceColorDark: string
  successColor: string
  warningColor: string
  dangerColor: string
}

export const THEME_PALETTE_DEFAULTS: ThemePalette = {
  primaryColor: '#7c3aed',
  accentColor: '#06b6d4',
  backgroundColor: '#f1f5f9',
  darkBackgroundColor: '#0f172a',
  sidebarColor: '#0f172a',
  surfaceColor: '#ffffff',
  surfaceColorDark: '#1e293b',
  successColor: '#16a34a',
  warningColor: '#f59e0b',
  dangerColor: '#ef4444',
}

export const PRIMARY_PRESETS = [
  '#7c3aed',
  '#6366f1',
  '#2563eb',
  '#0891b2',
  '#059669',
  '#d97706',
  '#db2777',
  '#dc2626',
]

export const BACKGROUND_PRESETS = ['#f8fafc', '#f1f5f9', '#e2e8f0', '#fef3c7', '#ecfeff', '#fdf2f8']

export const ACCENT_PRESETS = ['#06b6d4', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899']

const HEX_RE = /^#([0-9a-fA-F]{6})$/

export function normalizeHex(raw: string, fallback: string): string {
  const t = raw.trim()
  if (!t) return fallback
  const withHash = t.startsWith('#') ? t : `#${t}`
  if (HEX_RE.test(withHash)) return withHash.toLowerCase()
  return fallback
}

export function paletteFromShopSettings(s: ShopSettingsRow): ThemePalette {
  const d = THEME_PALETTE_DEFAULTS
  return {
    primaryColor: normalizeHex(s.primary_color, d.primaryColor),
    accentColor: normalizeHex(s.accent_color ?? '', d.accentColor),
    backgroundColor: normalizeHex(s.background_color ?? '', d.backgroundColor),
    darkBackgroundColor: normalizeHex(s.dark_background_color ?? '', d.darkBackgroundColor),
    sidebarColor: normalizeHex(s.sidebar_color ?? '', d.sidebarColor),
    surfaceColor: normalizeHex(s.surface_color ?? '', d.surfaceColor),
    surfaceColorDark: normalizeHex(s.surface_color_dark ?? '', d.surfaceColorDark),
    successColor: normalizeHex(s.success_color ?? '', d.successColor),
    warningColor: normalizeHex(s.warning_color ?? '', d.warningColor),
    dangerColor: normalizeHex(s.danger_color ?? '', d.dangerColor),
  }
}

export function shopThemePatchFromPalette(palette: ThemePalette) {
  return {
    primary_color: palette.primaryColor,
    background_color: palette.backgroundColor,
    dark_background_color: palette.darkBackgroundColor,
    accent_color: palette.accentColor,
    sidebar_color: palette.sidebarColor,
    surface_color: palette.surfaceColor,
    surface_color_dark: palette.surfaceColorDark,
    success_color: palette.successColor,
    warning_color: palette.warningColor,
    danger_color: palette.dangerColor,
  }
}

export function applyThemePalette(palette: ThemePalette, mode: 'light' | 'dark') {
  const root = document.documentElement
  const isDark = mode === 'dark'

  root.style.setProperty('--primary-color', palette.primaryColor)
  root.style.setProperty('--accent-color', palette.accentColor)
  root.style.setProperty('--success-color', palette.successColor)
  root.style.setProperty('--warning-color', palette.warningColor)
  root.style.setProperty('--danger-color', palette.dangerColor)
  root.style.setProperty('--sidebar-bg', palette.sidebarColor)
  root.style.setProperty(
    '--surface-bg',
    isDark ? palette.surfaceColorDark : palette.surfaceColor,
  )
  root.style.setProperty(
    '--app-bg-color',
    isDark ? palette.darkBackgroundColor : palette.backgroundColor,
  )

  root.style.setProperty('--color-violet-500', palette.primaryColor)
  root.style.setProperty('--color-violet-600', palette.primaryColor)
  root.style.setProperty('--color-violet-700', palette.primaryColor)
  root.style.setProperty('--color-indigo-600', palette.primaryColor)
  root.style.setProperty('--color-indigo-700', palette.primaryColor)

  root.style.setProperty('--color-cyan-600', palette.accentColor)
  root.style.setProperty('--color-sky-600', palette.accentColor)
  root.style.setProperty('--color-emerald-600', palette.successColor)
  root.style.setProperty('--color-amber-600', palette.warningColor)
  root.style.setProperty('--color-red-600', palette.dangerColor)

  root.classList.toggle('dark', isDark)
  root.style.colorScheme = isDark ? 'dark' : 'light'
}
