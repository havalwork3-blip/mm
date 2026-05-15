import type { Config } from 'tailwindcss'

/**
 * Tailwind v4 is primarily configured via `src/index.css` (@import "tailwindcss").
 * This file keeps tooling-aware `content` paths and documents RTL:
 *
 * - Set `dir="rtl"` on `<html>` or a root wrapper (see `App.tsx`).
 * - Use logical properties: `ms-*`, `me-*`, `ps-*`, `pe-*`, `border-s-*`, etc.
 * - Use `rtl:` / `ltr:` variants when you need direction-specific rules.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
} satisfies Config
