export type DatePreset = 'today' | 'week' | 'month' | 'year'

/** Calendar day (YYYY-MM-DD) in the browser's local timezone. Never use toISOString().slice(0, 10): that is the UTC day and is wrong 00:00–03:00 in Iraq. */
export function localDateIso(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function resolveDatePresetRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date()
  const end = localDateIso(now)
  let startDate = new Date(now)
  if (preset === 'week') {
    const day = now.getDay()
    const diffToMonday = (day + 6) % 7
    startDate.setDate(now.getDate() - diffToMonday)
  } else if (preset === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  } else if (preset === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1)
  }
  return { start: localDateIso(startDate), end }
}
