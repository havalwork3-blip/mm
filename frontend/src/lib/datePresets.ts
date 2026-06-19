export type DatePreset = 'today' | 'week' | 'month' | 'year'

function formatDateInputValue(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function resolveDatePresetRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date()
  const end = formatDateInputValue(now)
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
  return { start: formatDateInputValue(startDate), end }
}
