/** Strip non-digits; normalize Iraqi local numbers (07…) to 964… for wa.me. */
export function normalizePhoneDigits(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0') && digits.length >= 10) {
    digits = `964${digits.slice(1)}`
  }
  return digits
}

export function buildWhatsAppUrl(phone: string): string | null {
  const digits = normalizePhoneDigits(phone)
  if (!digits) return null
  return `https://wa.me/${digits}`
}
