export type AmPm = 'AM' | 'PM'

export function to24Hour(hour12: number, ampm: AmPm): number {
  const h = Math.min(12, Math.max(1, hour12))
  if (ampm === 'AM') return h === 12 ? 0 : h
  return h === 12 ? 12 : h + 12
}

export function from24Hour(hour24: number): { hour12: number; ampm: AmPm } {
  const h = ((Math.floor(hour24) % 24) + 24) % 24
  const ampm: AmPm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return { hour12, ampm }
}

export function clampMinute(minute: number): number {
  return Math.min(59, Math.max(0, Math.floor(minute)))
}

export const HOUR12_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i)

export function formatMinuteOption(minute: number): string {
  return String(clampMinute(minute)).padStart(2, '0')
}
