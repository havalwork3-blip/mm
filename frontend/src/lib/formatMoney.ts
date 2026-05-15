/**
 * Display helper: at most `maxFrac` digits after the decimal; strip trailing zeros
 * and a trailing dot (e.g. 12.00 → 12, 12.50 → 12.5).
 */
export function formatDecimalTrim(
  value: string | number | null | undefined,
  maxFrac = 2,
): string {
  if (value === null || value === undefined) return '0'
  const raw = String(value).replace(/,/g, '').trim()
  if (raw === '') return '0'
  const n = parseFloat(raw)
  if (!Number.isFinite(n)) return String(value)
  let out = n.toFixed(maxFrac).replace(/\.?0+$/, '')
  if (out === '-0') out = '0'
  return out || '0'
}

/** USD amounts in the UI: up to 2 fraction digits, no redundant trailing zeros. */
export function formatMoneyCompact(value: string | number | null | undefined): string {
  return formatDecimalTrim(value, 2)
}
