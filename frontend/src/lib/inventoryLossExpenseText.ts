import { formatMoneyCompact } from './formatMoney'

/** Display name for auto inventory-loss expenses (Kurdish + legacy English). */
export function formatInventoryLossExpenseName(name: string): string {
  const trimmed = name.trim()
  const legacy = /^Inventory loss\s*[-–—]\s*(.+)$/i.exec(trimmed)
  if (legacy) return `زەرەری کۆگا — ${legacy[1]}`
  return trimmed
}

/** Display note for auto inventory-loss expenses (Kurdish + legacy English). */
export function formatInventoryLossExpenseNote(note: string): string {
  const trimmed = note.trim()
  if (!trimmed) return trimmed

  const stripTag = (s: string) =>
    s
      .replace(/^\[AUTO_DISCONTINUE_LOSS\]\s*/i, '')
      .replace(/^\[AUTO_INVENTORY_LOSS\]\s*/i, '')
      .trim()

  if (trimmed.includes('واز لە هێنانەوە') || trimmed.includes('کەمکردنەوەی دەستی کۆگا')) {
    return stripTag(trimmed)
  }

  const discontinued = /^\[AUTO_DISCONTINUE_LOSS\]\s*Product stop-carrying write-off\s*\(-(\d+)\s*@\s*buy\s*([\d.]+)\s*USD\)/i.exec(
    trimmed,
  )
  if (discontinued) {
    const qty = discontinued[1]
    const buy = formatMoneyCompact(discontinued[2])
    const loss = formatMoneyCompact(String(Number(qty) * Number(discontinued[2].replace(/,/g, ''))))
    return `واز لە هێنانەوە: ${qty} دانە × ${buy} USD (کۆی گشتی ${loss} USD)`
  }

  const manual = /^\[AUTO_INVENTORY_LOSS\]\s*Product stock decreased manually\s*\(-(\d+)\s*@\s*buy\s*([\d.]+)\s*USD\)/i.exec(
    trimmed,
  )
  if (manual) {
    const qty = manual[1]
    const buy = formatMoneyCompact(manual[2])
    const loss = formatMoneyCompact(String(Number(qty) * Number(manual[2].replace(/,/g, ''))))
    return `کەمکردنەوەی دەستی کۆگا: ${qty} دانە × ${buy} USD (کۆی گشتی ${loss} USD)`
  }

  return stripTag(trimmed)
}
