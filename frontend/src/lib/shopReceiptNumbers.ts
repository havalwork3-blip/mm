/** Shop-scoped receipt / invoice numbers — never use global database row ids. */

export function digitsOnlyAscii(s: string, maxLen = 128): string {
  return s.replace(/\D/g, '').slice(0, maxLen)
}

/** Sale receipt # for display and print (per shop). */
export function formatSaleReceiptNumber(receiptNumber: number | null | undefined): string {
  if (receiptNumber == null || !Number.isFinite(receiptNumber)) return ''
  return String(receiptNumber)
}

/** Purchase invoice / receipt # from invoice_number only (per shop). */
export function formatPurchaseInvoiceNumber(invoiceNumber: string | null | undefined): string {
  const normalized = String(invoiceNumber ?? '').trim()
  if (normalized === '' || !/^\d+$/.test(normalized)) return ''
  const trimmed = normalized.replace(/^0+/, '')
  return trimmed === '' ? '0' : trimmed
}

export function nextPurchaseInvoiceNumberFromRows(
  rows: { invoice_number?: string | null }[],
): string {
  let maxNum = 0
  for (const row of rows) {
    const digits = digitsOnlyAscii(String(row.invoice_number ?? ''))
    if (digits === '') continue
    const n = Number.parseInt(digits, 10)
    if (Number.isFinite(n)) maxNum = Math.max(maxNum, n)
  }
  return String(maxNum + 1)
}
