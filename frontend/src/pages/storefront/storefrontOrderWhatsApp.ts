import type { StorefrontOrderResponse } from '../../api/storefrontApi'
import type { Lang } from '../../i18n/strings'
import { buildWhatsAppUrl } from '../../lib/whatsappUrl'

const TEMPLATES: Record<Lang, (orderId: number, total: string) => string> = {
  ku: (id, total) =>
    `سڵاو، داواکاری ئۆنڵاینم نارد (#${id}). کۆی گشتی: ${total}. تکایە پشتڕاستی بکەن.`,
  ar: (id, total) =>
    `مرحباً، أرسلت طلباً عبر الإنترنت (#${id}). المجموع: ${total}. يرجى التأكيد.`,
  en: (id, total) =>
    `Hello, I placed an online order (#${id}). Total: ${total}. Please confirm.`,
}

export function buildCustomerOrderWhatsAppUrl(
  phone: string,
  order: StorefrontOrderResponse,
  lang: Lang,
): string | null {
  const base = buildWhatsAppUrl(phone)
  if (!base) return null
  const text = TEMPLATES[lang](order.id, order.total_amount)
  return `${base}?text=${encodeURIComponent(text)}`
}
